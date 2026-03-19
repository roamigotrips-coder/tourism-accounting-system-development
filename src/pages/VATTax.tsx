import { useState, useEffect } from 'react';
import { FileText, AlertTriangle, CheckCircle, Plus, X, Save } from 'lucide-react';
import { fetchVATRecords, upsertVATRecord } from '../lib/supabaseSync';
import type { VATRecord } from '../data/mockData';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';
import { catchAndReport } from '../lib/toast';

interface VATForm {
  period: string;
  outputVAT: string;
  inputVAT: string;
  status: string;
}

const emptyForm: VATForm = { period: '', outputVAT: '', inputVAT: '', status: 'Pending' };

export default function VATTax() {
  const [showModal, setShowModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [form, setForm] = useState<VATForm>(emptyForm);
  const [vatList, setVatList] = useState<VATRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchVATRecords();
        if (!cancelled && data) setVatList(data);
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const [trnInput, setTrnInput] = useState('100-1234-5678-90');
  const [editingTrn, setEditingTrn] = useState(false);

  const totalOutput = vatList.reduce((s, v) => s + v.outputVAT, 0);
  const totalInput = vatList.reduce((s, v) => s + v.inputVAT, 0);
  const totalNet = vatList.reduce((s, v) => s + v.netVAT, 0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (evt: React.FormEvent) => {
    evt.preventDefault();
    const output = parseFloat(form.outputVAT) || 0;
    const input = parseFloat(form.inputVAT) || 0;
    const newRecord = {
      month: form.period,
      outputVAT: output,
      inputVAT: input,
      netVAT: output - input,
      status: form.status as 'Filed' | 'Pending' | 'Due',
    };
    setVatList(prev => [newRecord, ...prev]);
    upsertVATRecord(newRecord).catch(catchAndReport('Save VAT record'));
    setForm(emptyForm);
    setShowModal(false);
  };

  if (loading) return <LoadingSpinner message="Loading VAT records..." />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">VAT & Tax (UAE Compliance)</h1>
          <p className="text-slate-500 mt-1">FTA VAT reporting & TRN tracking</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 text-sm font-medium">
          <Plus size={16} /> Add VAT Record
        </button>
      </div>

      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-blue-100 text-sm">Tax Registration Number (TRN)</p>
            {editingTrn ? (
              <div className="flex items-center gap-2 mt-1">
                <input value={trnInput} onChange={e => setTrnInput(e.target.value)}
                  className="bg-white/20 text-white placeholder-blue-200 border border-white/30 rounded-lg px-3 py-1 text-lg font-bold font-mono focus:outline-none"
                  placeholder="TRN Number" />
                <button onClick={() => setEditingTrn(false)} className="bg-white text-blue-700 px-3 py-1 rounded-lg text-sm font-medium">Save</button>
              </div>
            ) : (
              <div className="flex items-center gap-3 mt-1">
                <h2 className="text-2xl font-bold font-mono">{trnInput}</h2>
                <button onClick={() => setEditingTrn(true)} className="text-blue-200 text-xs hover:text-white underline">Edit</button>
              </div>
            )}
            <p className="text-blue-200 text-sm mt-1">VAT Rate: 5% | Registered Entity</p>
          </div>
          <button onClick={() => setShowReturnModal(true)} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 self-start">
            <FileText size={14} /> Generate VAT Return
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 uppercase">Output VAT (Sales)</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">AED {totalOutput.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1">VAT collected from customers</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 uppercase">Input VAT (Purchases)</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">AED {totalInput.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1">VAT paid on expenses</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 uppercase">Net VAT Payable</p>
          <p className="text-2xl font-bold text-red-600 mt-1">AED {totalNet.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1">Due to FTA</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="p-5 border-b border-slate-100"><h3 className="font-semibold text-slate-800">VAT Summary</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50">
                <th className="text-left px-5 py-3 font-medium text-slate-600">Period</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Output VAT</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Input VAT</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Net Payable</th>
                <th className="text-center px-5 py-3 font-medium text-slate-600">Status</th>
              </tr></thead>
              <tbody>
                {vatList.map((v, i) => (
                  <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-5 py-3 font-medium text-slate-800">{v.month}</td>
                    <td className="px-5 py-3 text-right text-blue-600">AED {v.outputVAT.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-emerald-600">AED {v.inputVAT.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right font-medium text-red-600">AED {v.netVAT.toLocaleString()}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        v.status === 'Filed' ? 'bg-emerald-50 text-emerald-700' :
                        v.status === 'Pending' ? 'bg-amber-50 text-amber-700' :
                        'bg-red-50 text-red-700'
                      }`}>
                        {v.status === 'Filed' ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-800 mb-4">VAT Comparison</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={vatList.map(v => ({ month: v.month.split(' ')[0].substring(0, 3), output: v.outputVAT, input: v.inputVAT, net: v.netVAT }))}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v / 1000}K`} />
              <Tooltip formatter={(v: any) => `AED ${Number(v).toLocaleString()}`} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="output" fill="#3b82f6" name="Output" radius={[4, 4, 0, 0]} />
              <Bar dataKey="input" fill="#10b981" name="Input" radius={[4, 4, 0, 0]} />
              <Bar dataKey="net" fill="#ef4444" name="Net" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Add VAT Record Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Add VAT Record</h2>
                <p className="text-sm text-slate-500 mt-0.5">Record VAT for a new period</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Period (e.g. April 2024) <span className="text-red-500">*</span></label>
                <input name="period" value={form.period} onChange={handleChange} required placeholder="April 2024"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Output VAT (AED) <span className="text-red-500">*</span></label>
                <input type="number" name="outputVAT" value={form.outputVAT} onChange={handleChange} required min="0" step="0.01" placeholder="0.00"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Input VAT (AED) <span className="text-red-500">*</span></label>
                <input type="number" name="inputVAT" value={form.inputVAT} onChange={handleChange} required min="0" step="0.01" placeholder="0.00"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
              </div>
              {form.outputVAT && form.inputVAT && (
                <div className="bg-slate-50 rounded-lg p-3 text-sm">
                  <div className="flex justify-between text-slate-600"><span>Output VAT</span><span>AED {parseFloat(form.outputVAT).toLocaleString()}</span></div>
                  <div className="flex justify-between text-slate-600"><span>Input VAT</span><span>AED {parseFloat(form.inputVAT).toLocaleString()}</span></div>
                  <div className="flex justify-between font-bold text-red-700 border-t border-slate-200 pt-1 mt-1"><span>Net Payable</span><span>AED {(parseFloat(form.outputVAT) - parseFloat(form.inputVAT)).toFixed(2)}</span></div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select name="status" value={form.status} onChange={handleChange}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                  <option value="Pending">Pending</option>
                  <option value="Filed">Filed</option>
                  <option value="Due">Due</option>
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
                  <Save size={16} /> Add Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VAT Return Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">VAT Return Summary</h2>
              <button onClick={() => setShowReturnModal(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-xs text-blue-600 font-medium uppercase">TRN</p>
                <p className="text-lg font-bold font-mono text-blue-800 mt-0.5">{trnInput}</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-slate-100"><span className="text-slate-600">Total Output VAT</span><span className="font-medium text-slate-800">AED {totalOutput.toLocaleString()}</span></div>
                <div className="flex justify-between py-2 border-b border-slate-100"><span className="text-slate-600">Total Input VAT</span><span className="font-medium text-slate-800">AED {totalInput.toLocaleString()}</span></div>
                <div className="flex justify-between py-2"><span className="font-bold text-slate-800">Net VAT Payable</span><span className="font-bold text-red-600">AED {totalNet.toLocaleString()}</span></div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-700">
                <strong>Note:</strong> Please review all records before submission to the FTA portal. Ensure all invoices and expenses are accounted for.
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowReturnModal(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Close</button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Download PDF</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
