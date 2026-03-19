import { useState, useEffect } from 'react';
import { Banknote, Plus, X, Save, Play, CheckCircle, Clock, Users, DollarSign, FileText, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PayrollRun { id: string; period: string; runDate: string; status: string; totalGross: number; totalDeductions: number; totalNet: number; employeeCount: number; processedAt: string | null; postedAt: string | null; slips: PayrollSlip[]; }
interface PayrollSlip { id: string; runId: string; employeeId: string; employeeName: string; basicSalary: number; allowances: number; deductions: number; grossPay: number; netPay: number; status: string; }

export default function Payroll() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [showSlipPreview, setShowSlipPreview] = useState<PayrollSlip | null>(null);
  const [form, setForm] = useState({ period: '', runDate: new Date().toISOString().slice(0, 10) });

  useEffect(() => {
    (async () => {
      const { data: r } = await supabase.from('payroll_runs').select('*').order('created_at', { ascending: false });
      const { data: s } = await supabase.from('payroll_slips').select('*').order('employee_name');
      const slips = (s ?? []).map((x: any) => ({ id: x.id, runId: x.run_id, employeeId: x.employee_id, employeeName: x.employee_name, basicSalary: Number(x.basic_salary), allowances: Number(x.allowances), deductions: Number(x.deductions), grossPay: Number(x.gross_pay), netPay: Number(x.net_pay), status: x.status }));
      setRuns((r ?? []).map((x: any) => ({ id: x.id, period: x.period, runDate: x.run_date, status: x.status, totalGross: Number(x.total_gross), totalDeductions: Number(x.total_deductions), totalNet: Number(x.total_net), employeeCount: x.employee_count, processedAt: x.processed_at, postedAt: x.posted_at, slips: slips.filter(sl => sl.runId === x.id) })));
      setLoading(false);
    })();
  }, []);

  const totalPayroll = runs.filter(r => r.status === 'Completed').reduce((sum, r) => sum + r.totalNet, 0);
  const draftRuns = runs.filter(r => r.status === 'Draft').length;
  const totalEmployees = runs.length > 0 ? runs[0].employeeCount : 0;

  const createRun = async () => {
    if (!form.period) return;
    const id = crypto.randomUUID();
    // Fetch employees from HR module
    const { data: employees } = await supabase.from('employees').select('*').eq('status', 'Active');
    const emps = employees ?? [];

    const newSlips: PayrollSlip[] = emps.map((emp: any) => {
      const basic = Number(emp.salary) || 0;
      const allowances = Math.round(basic * 0.15 * 100) / 100; // 15% default allowance
      const deductions = Math.round(basic * 0.05 * 100) / 100; // 5% default deduction
      return {
        id: crypto.randomUUID(), runId: id, employeeId: emp.id, employeeName: emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
        basicSalary: basic, allowances, deductions, grossPay: basic + allowances, netPay: basic + allowances - deductions, status: 'Draft'
      };
    });

    const totalGross = newSlips.reduce((s, sl) => s + sl.grossPay, 0);
    const totalDeductions = newSlips.reduce((s, sl) => s + sl.deductions, 0);
    const totalNet = newSlips.reduce((s, sl) => s + sl.netPay, 0);

    await supabase.from('payroll_runs').upsert({ id, period: form.period, run_date: form.runDate, status: 'Draft', total_gross: totalGross, total_deductions: totalDeductions, total_net: totalNet, employee_count: newSlips.length }, { onConflict: 'id' });

    if (newSlips.length > 0) {
      await supabase.from('payroll_slips').upsert(newSlips.map(sl => ({ id: sl.id, run_id: sl.runId, employee_id: sl.employeeId, employee_name: sl.employeeName, basic_salary: sl.basicSalary, allowances: sl.allowances, deductions: sl.deductions, gross_pay: sl.grossPay, net_pay: sl.netPay, status: sl.status })), { onConflict: 'id' });
    }

    const newRun: PayrollRun = { id, period: form.period, runDate: form.runDate, status: 'Draft', totalGross, totalDeductions, totalNet, employeeCount: newSlips.length, processedAt: null, postedAt: null, slips: newSlips };
    setRuns(prev => [newRun, ...prev]);
    setShowModal(false);
  };

  const processRun = async (run: PayrollRun) => {
    const now = new Date().toISOString();
    await supabase.from('payroll_runs').update({ status: 'Completed', processed_at: now }).eq('id', run.id);
    await supabase.from('payroll_slips').update({ status: 'Processed' }).eq('run_id', run.id);
    setRuns(prev => prev.map(r => r.id === run.id ? { ...r, status: 'Completed', processedAt: now, slips: r.slips.map(s => ({ ...s, status: 'Processed' })) } : r));
    if (selectedRun?.id === run.id) setSelectedRun(prev => prev ? { ...prev, status: 'Completed', processedAt: now, slips: prev.slips.map(s => ({ ...s, status: 'Processed' })) } : null);
  };

  const postToGL = async (run: PayrollRun) => {
    const now = new Date().toISOString();
    await supabase.from('payroll_runs').update({ posted_at: now }).eq('id', run.id);
    // Create journal entry for payroll
    const jeId = crypto.randomUUID();
    await supabase.from('journal_entries').upsert({ id: jeId, entry_number: `PAY-${run.period}`, date: run.runDate, description: `Payroll for ${run.period}`, status: 'Posted', total_debit: run.totalGross, total_credit: run.totalGross, source: 'Payroll' }, { onConflict: 'id' });
    setRuns(prev => prev.map(r => r.id === run.id ? { ...r, postedAt: now } : r));
    if (selectedRun?.id === run.id) setSelectedRun(prev => prev ? { ...prev, postedAt: now } : null);
  };

  const updateSlip = async (slip: PayrollSlip, field: string, value: number) => {
    const updated = { ...slip, [field]: value };
    updated.grossPay = updated.basicSalary + updated.allowances;
    updated.netPay = updated.grossPay - updated.deductions;

    await supabase.from('payroll_slips').update({ [field === 'basicSalary' ? 'basic_salary' : field]: value, gross_pay: updated.grossPay, net_pay: updated.netPay }).eq('id', slip.id);

    setRuns(prev => prev.map(r => {
      if (r.id !== slip.runId) return r;
      const newSlips = r.slips.map(s => s.id === slip.id ? updated : s);
      const totalGross = newSlips.reduce((sum, s) => sum + s.grossPay, 0);
      const totalDeductions = newSlips.reduce((sum, s) => sum + s.deductions, 0);
      const totalNet = newSlips.reduce((sum, s) => sum + s.netPay, 0);
      supabase.from('payroll_runs').update({ total_gross: totalGross, total_deductions: totalDeductions, total_net: totalNet }).eq('id', r.id);
      return { ...r, slips: newSlips, totalGross, totalDeductions, totalNet };
    }));

    if (selectedRun?.id === slip.runId) {
      setSelectedRun(prev => {
        if (!prev) return null;
        const newSlips = prev.slips.map(s => s.id === slip.id ? updated : s);
        return { ...prev, slips: newSlips, totalGross: newSlips.reduce((sum, s) => sum + s.grossPay, 0), totalDeductions: newSlips.reduce((sum, s) => sum + s.deductions, 0), totalNet: newSlips.reduce((sum, s) => sum + s.netPay, 0) };
      });
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Banknote className="text-emerald-600" size={24} /> Payroll</h1>
          <p className="text-slate-500 mt-1">Process payroll runs and generate pay slips</p>
        </div>
        <button onClick={() => { setForm({ period: '', runDate: new Date().toISOString().slice(0, 10) }); setShowModal(true); }} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 text-sm font-medium">
          <Plus size={16} /> New Payroll Run
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"><p className="text-xs font-semibold text-slate-400 uppercase">Total Payroll (Completed)</p><p className="text-2xl font-bold text-emerald-600">AED {totalPayroll.toLocaleString()}</p></div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"><p className="text-xs font-semibold text-slate-400 uppercase">Draft Runs</p><p className="text-2xl font-bold text-amber-600">{draftRuns}</p></div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"><p className="text-xs font-semibold text-slate-400 uppercase">Employees (Latest Run)</p><p className="text-2xl font-bold text-blue-600">{totalEmployees}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-800">Payroll Runs</h3>
          {runs.map(r => (
            <div key={r.id} onClick={() => setSelectedRun(r)} className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${selectedRun?.id === r.id ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-100'}`}>
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-semibold text-slate-700 text-sm">{r.period}</h4>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${r.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' : r.status === 'Draft' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{r.status}</span>
              </div>
              <p className="text-xs text-slate-400">{r.employeeCount} employees &middot; {r.runDate}</p>
              <p className="text-sm font-bold text-slate-700 mt-1">AED {r.totalNet.toLocaleString()}</p>
            </div>
          ))}
          {runs.length === 0 && <div className="text-center py-8 text-slate-400 text-sm">No payroll runs yet</div>}
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <span className="font-semibold text-slate-800">{selectedRun ? `Payroll: ${selectedRun.period}` : 'Select a payroll run'}</span>
            {selectedRun && (
              <div className="flex items-center gap-2">
                {selectedRun.status === 'Draft' && (
                  <button onClick={() => processRun(selectedRun)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 flex items-center gap-1"><Play size={12} /> Process</button>
                )}
                {selectedRun.status === 'Completed' && !selectedRun.postedAt && (
                  <button onClick={() => postToGL(selectedRun)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 flex items-center gap-1"><FileText size={12} /> Post to GL</button>
                )}
                {selectedRun.postedAt && <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><CheckCircle size={12} /> Posted</span>}
              </div>
            )}
          </div>
          {selectedRun ? (
            <div className="p-5">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-400 uppercase font-semibold">Gross Pay</p><p className="text-lg font-bold text-slate-800">AED {selectedRun.totalGross.toLocaleString()}</p></div>
                <div className="bg-red-50 rounded-xl p-3"><p className="text-xs text-red-600 uppercase font-semibold">Deductions</p><p className="text-lg font-bold text-red-700">AED {selectedRun.totalDeductions.toLocaleString()}</p></div>
                <div className="bg-emerald-50 rounded-xl p-3"><p className="text-xs text-emerald-600 uppercase font-semibold">Net Pay</p><p className="text-lg font-bold text-emerald-700">AED {selectedRun.totalNet.toLocaleString()}</p></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase">Employee</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-400 uppercase">Basic</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-400 uppercase">Allowances</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-400 uppercase">Deductions</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-400 uppercase">Gross</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-400 uppercase">Net</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-slate-400 uppercase">Actions</th>
                  </tr></thead>
                  <tbody>
                    {selectedRun.slips.map(sl => (
                      <tr key={sl.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-3 py-2 font-medium text-slate-700">{sl.employeeName}</td>
                        <td className="px-3 py-2 text-right text-slate-600">
                          {selectedRun.status === 'Draft' ? (
                            <input type="number" value={sl.basicSalary || ''} onChange={e => updateSlip(sl, 'basicSalary', Number(e.target.value))} className="w-24 text-right px-2 py-1 border border-slate-200 rounded text-sm" />
                          ) : sl.basicSalary.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600">
                          {selectedRun.status === 'Draft' ? (
                            <input type="number" value={sl.allowances || ''} onChange={e => updateSlip(sl, 'allowances', Number(e.target.value))} className="w-24 text-right px-2 py-1 border border-slate-200 rounded text-sm" />
                          ) : sl.allowances.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right text-red-600">
                          {selectedRun.status === 'Draft' ? (
                            <input type="number" value={sl.deductions || ''} onChange={e => updateSlip(sl, 'deductions', Number(e.target.value))} className="w-24 text-right px-2 py-1 border border-slate-200 rounded text-sm" />
                          ) : sl.deductions.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-slate-700">{sl.grossPay.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-700">{sl.netPay.toLocaleString()}</td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => setShowSlipPreview(sl)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Eye size={14} /></button>
                        </td>
                      </tr>
                    ))}
                    {selectedRun.slips.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate-400">No employees found. Add employees in HR module first.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400">Click a payroll run to view details</div>
          )}
        </div>
      </div>

      {/* Pay Slip Preview Modal */}
      {showSlipPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSlipPreview(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-slate-800">Pay Slip</h3><button onClick={() => setShowSlipPreview(null)}><X size={20} className="text-slate-400" /></button></div>
            <div className="border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="text-center border-b border-slate-100 pb-3">
                <h4 className="font-bold text-slate-800">Tourism Accounting Pro</h4>
                <p className="text-xs text-slate-400">Pay Slip — {selectedRun?.period}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><p className="text-xs text-slate-400">Employee</p><p className="font-medium text-slate-700">{showSlipPreview.employeeName}</p></div>
                <div><p className="text-xs text-slate-400">Period</p><p className="font-medium text-slate-700">{selectedRun?.period}</p></div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Basic Salary</span><span className="font-medium">AED {showSlipPreview.basicSalary.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Allowances</span><span className="font-medium text-emerald-600">+ AED {showSlipPreview.allowances.toLocaleString()}</span></div>
                <div className="flex justify-between border-t border-slate-100 pt-2"><span className="font-semibold text-slate-700">Gross Pay</span><span className="font-bold">AED {showSlipPreview.grossPay.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Deductions</span><span className="font-medium text-red-600">- AED {showSlipPreview.deductions.toLocaleString()}</span></div>
                <div className="flex justify-between border-t-2 border-slate-200 pt-2"><span className="font-bold text-slate-800">Net Pay</span><span className="font-bold text-emerald-700 text-lg">AED {showSlipPreview.netPay.toLocaleString()}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Payroll Run Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-slate-800">New Payroll Run</h3><button onClick={() => setShowModal(false)}><X size={20} className="text-slate-400" /></button></div>
            <div className="space-y-4">
              <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Period *</label><input type="month" value={form.period} onChange={e => setForm(p => ({ ...p, period: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" /></div>
              <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Run Date</label><input type="date" value={form.runDate} onChange={e => setForm(p => ({ ...p, runDate: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" /></div>
              <p className="text-xs text-slate-400">Employees will be auto-populated from the HR module.</p>
              <button onClick={createRun} className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 flex items-center justify-center gap-2"><Save size={16} /> Create Payroll Run</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
