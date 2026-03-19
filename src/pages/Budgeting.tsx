import { useState, useEffect } from 'react';
import { Wallet, Plus, Edit2, Trash2, X, Save, BarChart3, TrendingUp, TrendingDown, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { supabase } from '../lib/supabase';

interface Budget { id: string; name: string; fiscalYear: string; type: 'income' | 'expense' | 'combined'; status: 'Draft' | 'Active' | 'Closed'; periodType: string; createdBy: string; }
interface BudgetLine { id: string; budgetId: string; accountId: string; accountName: string; period: string; budgetedAmount: number; actualAmount: number; variance: number; }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function Budgeting() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; name: string; type: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', fiscalYear: new Date().getFullYear().toString(), type: 'expense' as Budget['type'], periodType: 'monthly', status: 'Draft' as Budget['status'] });
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: b } = await supabase.from('budgets').select('*').order('created_at', { ascending: false });
      const { data: bl } = await supabase.from('budget_lines').select('*');
      const { data: acc } = await supabase.from('accounts').select('id, name, type').order('code');
      setBudgets((b ?? []).map((r: any) => ({ id: r.id, name: r.name, fiscalYear: r.fiscal_year, type: r.type, status: r.status, periodType: r.period_type, createdBy: r.created_by })));
      setLines((bl ?? []).map((r: any) => ({ id: r.id, budgetId: r.budget_id, accountId: r.account_id, accountName: r.account_name, period: r.period, budgetedAmount: Number(r.budgeted_amount), actualAmount: Number(r.actual_amount), variance: Number(r.variance) })));
      setAccounts((acc ?? []).map((r: any) => ({ id: r.id, name: r.name, type: r.type })));
      setLoading(false);
    })();
  }, []);

  const budgetLines = selectedBudget ? lines.filter(l => l.budgetId === selectedBudget.id) : [];
  const totalBudgeted = budgetLines.reduce((s, l) => s + l.budgetedAmount, 0);
  const totalActual = budgetLines.reduce((s, l) => s + l.actualAmount, 0);
  const totalVariance = totalBudgeted - totalActual;
  const variancePct = totalBudgeted > 0 ? ((totalVariance / totalBudgeted) * 100).toFixed(1) : '0';

  // Group lines by period for chart
  const chartData = MONTHS.map((m, i) => {
    const period = selectedBudget ? `${selectedBudget.fiscalYear}-${String(i + 1).padStart(2, '0')}` : '';
    const periodLines = budgetLines.filter(l => l.period === period);
    return { month: m, Budget: periodLines.reduce((s, l) => s + l.budgetedAmount, 0), Actual: periodLines.reduce((s, l) => s + l.actualAmount, 0) };
  });

  // Group by account for grid
  const accountGroups = new Map<string, { accountName: string; months: Record<string, { budgeted: number; actual: number }> }>();
  budgetLines.forEach(l => {
    if (!accountGroups.has(l.accountId)) accountGroups.set(l.accountId, { accountName: l.accountName, months: {} });
    const grp = accountGroups.get(l.accountId)!;
    grp.months[l.period] = { budgeted: l.budgetedAmount, actual: l.actualAmount };
  });

  const saveBudget = async () => {
    if (!form.name) return;
    const id = editId || crypto.randomUUID();
    await supabase.from('budgets').upsert({ id, name: form.name, fiscal_year: form.fiscalYear, type: form.type, period_type: form.periodType, status: form.status, created_by: 'Admin' }, { onConflict: 'id' });
    const newB: Budget = { id, name: form.name, fiscalYear: form.fiscalYear, type: form.type, status: form.status, periodType: form.periodType, createdBy: 'Admin' };
    setBudgets(prev => editId ? prev.map(b => b.id === id ? newB : b) : [newB, ...prev]);
    // Create default lines for each account and month if new
    if (!editId) {
      const relevantAccounts = accounts.filter(a => form.type === 'expense' ? a.type === 'Expense' : form.type === 'income' ? a.type === 'Revenue' : ['Revenue', 'Expense'].includes(a.type));
      const newLines: BudgetLine[] = [];
      for (const acc of relevantAccounts.slice(0, 10)) {
        for (let m = 1; m <= 12; m++) {
          const lineId = crypto.randomUUID();
          const period = `${form.fiscalYear}-${String(m).padStart(2, '0')}`;
          newLines.push({ id: lineId, budgetId: id, accountId: acc.id, accountName: acc.name, period, budgetedAmount: 0, actualAmount: 0, variance: 0 });
        }
      }
      if (newLines.length > 0) {
        await supabase.from('budget_lines').upsert(newLines.map(l => ({ id: l.id, budget_id: l.budgetId, account_id: l.accountId, account_name: l.accountName, period: l.period, budgeted_amount: l.budgetedAmount, actual_amount: l.actualAmount, variance: l.variance })), { onConflict: 'id' });
        setLines(prev => [...prev, ...newLines]);
      }
    }
    setShowModal(false);
    setEditId(null);
  };

  const deleteBudget = async (id: string) => {
    if (!confirm('Delete this budget?')) return;
    await supabase.from('budgets').delete().eq('id', id);
    setBudgets(prev => prev.filter(b => b.id !== id));
    if (selectedBudget?.id === id) setSelectedBudget(null);
  };

  const updateLineAmount = async (lineId: string, amount: number) => {
    const line = lines.find(l => l.id === lineId);
    if (!line) return;
    const updated = { ...line, budgetedAmount: amount, variance: amount - line.actualAmount };
    await supabase.from('budget_lines').update({ budgeted_amount: amount, variance: updated.variance }).eq('id', lineId);
    setLines(prev => prev.map(l => l.id === lineId ? updated : l));
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Wallet className="text-emerald-600" size={24} /> Budgeting</h1>
          <p className="text-slate-500 mt-1">Plan and track income & expense budgets against actuals</p>
        </div>
        <button onClick={() => { setForm({ name: '', fiscalYear: new Date().getFullYear().toString(), type: 'expense', periodType: 'monthly', status: 'Draft' }); setEditId(null); setShowModal(true); }} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 text-sm font-medium">
          <Plus size={16} /> New Budget
        </button>
      </div>

      {/* Budget List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {budgets.map(b => (
          <div key={b.id} onClick={() => setSelectedBudget(b)} className={`bg-white rounded-2xl border shadow-sm p-5 cursor-pointer transition-all hover:shadow-md ${selectedBudget?.id === b.id ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-100'}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-slate-800">{b.name}</h3>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${b.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : b.status === 'Closed' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'}`}>{b.status}</span>
            </div>
            <p className="text-sm text-slate-500">{b.fiscalYear} &middot; {b.type} &middot; {b.periodType}</p>
            <div className="flex gap-2 mt-3">
              <button onClick={e => { e.stopPropagation(); setForm({ name: b.name, fiscalYear: b.fiscalYear, type: b.type, periodType: b.periodType, status: b.status }); setEditId(b.id); setShowModal(true); }} className="p-1.5 text-slate-400 hover:text-blue-600"><Edit2 size={14} /></button>
              <button onClick={e => { e.stopPropagation(); deleteBudget(b.id); }} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {budgets.length === 0 && <div className="col-span-3 text-center py-12 text-slate-400">No budgets yet. Create one to get started.</div>}
      </div>

      {selectedBudget && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase">Total Budget</p>
              <p className="text-xl font-bold text-slate-800">AED {totalBudgeted.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase">Total Actual</p>
              <p className="text-xl font-bold text-blue-600">AED {totalActual.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase">Variance</p>
              <p className={`text-xl font-bold flex items-center gap-1 ${totalVariance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {totalVariance >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />} AED {Math.abs(totalVariance).toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase">Variance %</p>
              <p className={`text-xl font-bold ${Number(variancePct) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{variancePct}%</p>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><BarChart3 size={16} className="text-blue-500" /> Budget vs Actuals</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => `AED ${Number(v).toLocaleString()}`} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend />
                <Bar dataKey="Budget" fill="#10b981" radius={[4,4,0,0]} />
                <Bar dataKey="Actual" fill="#3b82f6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Budget Grid */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 font-semibold text-slate-800">Budget Detail: {selectedBudget.name}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase sticky left-0 bg-white min-w-[160px]">Account</th>
                  {MONTHS.map(m => <th key={m} className="text-center px-3 py-3 text-xs font-semibold text-slate-400 uppercase min-w-[100px]">{m}</th>)}
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Total</th>
                </tr></thead>
                <tbody>
                  {Array.from(accountGroups.entries()).map(([accId, grp]) => {
                    let rowTotal = 0;
                    return (
                      <tr key={accId} className="border-b border-slate-50">
                        <td className="px-4 py-2 font-medium text-slate-700 sticky left-0 bg-white">{grp.accountName}</td>
                        {MONTHS.map((_, i) => {
                          const period = `${selectedBudget.fiscalYear}-${String(i + 1).padStart(2, '0')}`;
                          const cell = grp.months[period];
                          const budgeted = cell?.budgeted ?? 0;
                          const actual = cell?.actual ?? 0;
                          const diff = budgeted - actual;
                          rowTotal += budgeted;
                          const line = budgetLines.find(l => l.accountId === accId && l.period === period);
                          return (
                            <td key={i} className="px-2 py-1 text-center">
                              <input type="number" value={budgeted || ''} onChange={e => line && updateLineAmount(line.id, Number(e.target.value) || 0)} className="w-20 px-1.5 py-1 text-xs border border-slate-200 rounded text-center" placeholder="0" />
                              {actual > 0 && <div className={`text-[10px] mt-0.5 ${diff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{actual.toLocaleString()}</div>}
                            </td>
                          );
                        })}
                        <td className="px-4 py-2 text-right font-bold text-slate-700">{rowTotal.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-slate-800">{editId ? 'Edit' : 'New'} Budget</h3><button onClick={() => setShowModal(false)}><X size={20} className="text-slate-400" /></button></div>
            <div className="space-y-4">
              <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Name *</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Fiscal Year</label><input value={form.fiscalYear} onChange={e => setForm(p => ({ ...p, fiscalYear: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" /></div>
                <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Type</label><select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as any }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm"><option value="expense">Expense</option><option value="income">Income</option><option value="combined">Combined</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Period</label><select value={form.periodType} onChange={e => setForm(p => ({ ...p, periodType: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select></div>
                <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Status</label><select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as any }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm"><option value="Draft">Draft</option><option value="Active">Active</option><option value="Closed">Closed</option></select></div>
              </div>
              <button onClick={saveBudget} className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 flex items-center justify-center gap-2"><Save size={16} /> {editId ? 'Update' : 'Create'} Budget</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
