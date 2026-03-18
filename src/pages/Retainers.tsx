import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Pause, Play, Trash2, PenSquare } from 'lucide-react';
import {
  fetchRetainers as fetchRetainersDb, upsertRetainer as upsertRetainerDb, deleteRetainerDb,
  type Retainer,
} from '../lib/supabaseSync';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';

function nextDate(start: Date, interval: Retainer['interval']): Date {
  const d = new Date(start);
  if (interval === 'Monthly') d.setMonth(d.getMonth() + 1);
  if (interval === 'Quarterly') d.setMonth(d.getMonth() + 3);
  if (interval === 'Yearly') d.setFullYear(d.getFullYear() + 1);
  return d;
}

export default function Retainers() {
  const [items, setItems] = useState<Retainer[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Retainer | null>(null);
  const [form, setForm] = useState<Partial<Retainer>>({ currency: 'AED', interval: 'Monthly', status: 'Active', startDate: new Date().toISOString().split('T')[0] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchRetainersDb();
        if (!cancelled && data) setItems(data);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load retainers');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const kpis = useMemo(() => {
    const active = items.filter(i => i.status === 'Active');
    const mrr = active.filter(i => i.interval === 'Monthly').reduce((s,i)=>s+i.amount,0)
      + active.filter(i => i.interval === 'Quarterly').reduce((s,i)=>s+i.amount/3,0)
      + active.filter(i => i.interval === 'Yearly').reduce((s,i)=>s+i.amount/12,0);
    return { total: items.length, active: active.length, paused: items.filter(i=>i.status==='Paused').length, mrr };
  }, [items]);

  const openNew = () => { setEditing(null); setForm({ currency: 'AED', interval: 'Monthly', status: 'Active', startDate: new Date().toISOString().split('T')[0] }); setShowModal(true); };
  const openEdit = (r: Retainer) => { setEditing(r); setForm(r); setShowModal(true); };

  const computeNextInvoice = (f: Partial<Retainer>): string => {
    const base = f.startDate ? new Date(f.startDate) : new Date();
    const nxt = nextDate(base, (f.interval as Retainer['interval']) || 'Monthly');
    return nxt.toISOString().split('T')[0];
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer || !form.amount || !form.interval || !form.startDate || !form.status) return;
    const obj: Retainer = {
      id: editing ? editing.id : `RTN-${Date.now()}`,
      customer: form.customer!, description: form.description||'', amount: Number(form.amount)||0,
      currency: form.currency||'AED', interval: form.interval as any, startDate: form.startDate!, endDate: form.endDate,
      status: form.status as any, nextInvoiceOn: computeNextInvoice(form),
    };
    if (editing) setItems(prev => prev.map(i => i.id === editing.id ? obj : i));
    else setItems(prev => [obj, ...prev]);
    upsertRetainerDb(obj).catch(() => {});
    setShowModal(false);
  };

  const togglePause = (id: string) => setItems(prev => prev.map(i => {
    if (i.id !== id) return i;
    const updated = { ...i, status: (i.status === 'Paused' ? 'Active' : 'Paused') as Retainer['status'] };
    upsertRetainerDb(updated).catch(() => {});
    return updated;
  }));
  const remove = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    deleteRetainerDb(id).catch(() => {});
  };

  if (loading) return <LoadingSpinner message="Loading retainers..." />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Retainer Invoices</h1>
          <p className="text-slate-500 text-sm">Manage upfront retainers and bill on a schedule.</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700"><Plus size={16}/> New Retainer</button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border rounded-xl p-4 bg-white"><div className="text-xs text-slate-500">Total</div><div className="text-2xl font-bold text-slate-800">{kpis.total}</div></div>
        <div className="border rounded-xl p-4 bg-white"><div className="text-xs text-slate-500">Active</div><div className="text-2xl font-bold text-slate-800">{kpis.active}</div></div>
        <div className="border rounded-xl p-4 bg-white"><div className="text-xs text-slate-500">Paused</div><div className="text-2xl font-bold text-slate-800">{kpis.paused}</div></div>
        <div className="border rounded-xl p-4 bg-white"><div className="text-xs text-slate-500">Monthly Value (est.)</div><div className="text-2xl font-bold text-emerald-700">{kpis.mrr.toLocaleString(undefined,{minimumFractionDigits:2})}</div></div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="font-semibold text-slate-800">Retainers</div>
          <div className="text-xs text-slate-500">{items.length} records</div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr><th className="text-left px-3 py-2">Customer</th><th className="text-left px-3 py-2">Description</th><th className="text-right px-3 py-2">Amount</th><th className="text-left px-3 py-2">Interval</th><th className="text-left px-3 py-2">Start</th><th className="text-left px-3 py-2">Next Invoice</th><th className="text-right px-3 py-2">Actions</th></tr>
          </thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-800">{i.customer}</td>
                <td className="px-3 py-2 text-slate-500">{i.description||'—'}</td>
                <td className="px-3 py-2 text-right">{i.currency} {i.amount.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                <td className="px-3 py-2">{i.interval}</td>
                <td className="px-3 py-2">{i.startDate}</td>
                <td className="px-3 py-2">{i.nextInvoiceOn}</td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex gap-1">
                    <button onClick={() => openEdit(i)} className="text-slate-600 hover:text-slate-800" title="Edit"><PenSquare size={16}/></button>
                    <button onClick={() => togglePause(i.id)} className="text-blue-600 hover:text-blue-800" title="Pause/Resume">{i.status==='Paused'?<Play size={16}/>:<Pause size={16}/>}</button>
                    <button onClick={() => remove(i.id)} className="text-red-500 hover:text-red-700" title="Delete"><Trash2 size={16}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="font-semibold text-slate-800">{editing?'Edit Retainer':'New Retainer'}</div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={save} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer *</label>
                <input value={form.customer||''} onChange={e=>setForm(v=>({...v,customer:e.target.value}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input value={form.description||''} onChange={e=>setForm(v=>({...v,description:e.target.value}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount *</label>
                  <input type="number" step="0.01" required value={form.amount as any} onChange={e=>setForm(v=>({...v,amount:Number(e.target.value)}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                  <select value={form.currency as any} onChange={e=>setForm(v=>({...v,currency:e.target.value}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm">
                    {['AED','USD','EUR','GBP','INR'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Interval *</label>
                  <select required value={form.interval as any} onChange={e=>setForm(v=>({...v,interval:e.target.value as any}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm">
                    <option>Monthly</option>
                    <option>Quarterly</option>
                    <option>Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date *</label>
                  <input type="date" required value={form.startDate as any} onChange={e=>setForm(v=>({...v,startDate:e.target.value}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                  <input type="date" value={form.endDate as any} onChange={e=>setForm(v=>({...v,endDate:e.target.value}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status *</label>
                  <select required value={form.status as any} onChange={e=>setForm(v=>({...v,status:e.target.value as any}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm">
                    <option>Active</option>
                    <option>Paused</option>
                    <option>Cancelled</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={()=>setShowModal(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm">Cancel</button>
                <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm"><Save size={16}/> Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
