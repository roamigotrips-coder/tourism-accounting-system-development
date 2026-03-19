import { useState, useEffect } from 'react';
import { Truck, Plus, X, Save, CheckCircle, Clock, Package, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Challan { id: string; challanNumber: string; salesOrderId: string | null; customer: string; date: string; status: string; items: string; notes: string; dispatchedAt: string | null; deliveredAt: string | null; }

export default function DeliveryChallans() {
  const [challans, setChallans] = useState<Challan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedChallan, setSelectedChallan] = useState<Challan | null>(null);
  const [form, setForm] = useState({ challanNumber: '', salesOrderId: '', customer: '', date: new Date().toISOString().slice(0, 10), items: '', notes: '' });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('delivery_challans').select('*').order('created_at', { ascending: false });
      setChallans((data ?? []).map((r: any) => ({ id: r.id, challanNumber: r.challan_number, salesOrderId: r.sales_order_id, customer: r.customer, date: r.date, status: r.status, items: r.items || '', notes: r.notes || '', dispatchedAt: r.dispatched_at, deliveredAt: r.delivered_at })));
      setLoading(false);
    })();
  }, []);

  const dispatched = challans.filter(c => c.status === 'Dispatched').length;
  const delivered = challans.filter(c => c.status === 'Delivered').length;
  const pending = challans.filter(c => c.status === 'Draft').length;

  const createChallan = async () => {
    if (!form.customer || !form.date) return;
    const id = crypto.randomUUID();
    const num = form.challanNumber || `DC-${Date.now().toString(36).toUpperCase()}`;
    await supabase.from('delivery_challans').upsert({ id, challan_number: num, sales_order_id: form.salesOrderId || null, customer: form.customer, date: form.date, status: 'Draft', items: form.items, notes: form.notes }, { onConflict: 'id' });
    const newC: Challan = { id, challanNumber: num, salesOrderId: form.salesOrderId || null, customer: form.customer, date: form.date, status: 'Draft', items: form.items, notes: form.notes, dispatchedAt: null, deliveredAt: null };
    setChallans(prev => [newC, ...prev]);
    setShowModal(false);
  };

  const updateStatus = async (challan: Challan, status: string) => {
    const now = new Date().toISOString();
    const updates: any = { status };
    if (status === 'Dispatched') updates.dispatched_at = now;
    if (status === 'Delivered') updates.delivered_at = now;
    await supabase.from('delivery_challans').update(updates).eq('id', challan.id);
    setChallans(prev => prev.map(c => c.id === challan.id ? { ...c, status, ...(status === 'Dispatched' ? { dispatchedAt: now } : {}), ...(status === 'Delivered' ? { deliveredAt: now } : {}) } : c));
    if (selectedChallan?.id === challan.id) setSelectedChallan(prev => prev ? { ...prev, status, ...(status === 'Dispatched' ? { dispatchedAt: now } : {}), ...(status === 'Delivered' ? { deliveredAt: now } : {}) } : null);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Truck className="text-emerald-600" size={24} /> Delivery Challans</h1>
          <p className="text-slate-500 mt-1">Track goods dispatch and delivery status</p>
        </div>
        <button onClick={() => { setForm({ challanNumber: '', salesOrderId: '', customer: '', date: new Date().toISOString().slice(0, 10), items: '', notes: '' }); setShowModal(true); }} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 text-sm font-medium">
          <Plus size={16} /> New Challan
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"><p className="text-xs font-semibold text-slate-400 uppercase">Pending</p><p className="text-2xl font-bold text-amber-600">{pending}</p></div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"><p className="text-xs font-semibold text-slate-400 uppercase">Dispatched</p><p className="text-2xl font-bold text-blue-600">{dispatched}</p></div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"><p className="text-xs font-semibold text-slate-400 uppercase">Delivered</p><p className="text-2xl font-bold text-emerald-600">{delivered}</p></div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 font-semibold text-slate-800">All Challans</div>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-100">
            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Challan #</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Customer</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Date</th>
            <th className="text-center px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Status</th>
            <th className="text-center px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Actions</th>
          </tr></thead>
          <tbody>
            {challans.map(c => (
              <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-5 py-3 font-medium text-slate-700">{c.challanNumber}</td>
                <td className="px-5 py-3 text-slate-600">{c.customer}</td>
                <td className="px-5 py-3 text-slate-500">{c.date}</td>
                <td className="px-5 py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${c.status === 'Delivered' ? 'bg-emerald-50 text-emerald-700' : c.status === 'Dispatched' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>{c.status}</span>
                </td>
                <td className="px-5 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => setSelectedChallan(c)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="View"><Eye size={15} /></button>
                    {c.status === 'Draft' && <button onClick={() => updateStatus(c, 'Dispatched')} className="px-2 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Dispatch</button>}
                    {c.status === 'Dispatched' && <button onClick={() => updateStatus(c, 'Delivered')} className="px-2 py-1 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Delivered</button>}
                  </div>
                </td>
              </tr>
            ))}
            {challans.length === 0 && <tr><td colSpan={5} className="text-center py-12 text-slate-400">No delivery challans yet</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selectedChallan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedChallan(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-slate-800">Challan: {selectedChallan.challanNumber}</h3><button onClick={() => setSelectedChallan(null)}><X size={20} className="text-slate-400" /></button></div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-slate-400 uppercase font-semibold">Customer</p><p className="text-sm font-medium text-slate-700">{selectedChallan.customer}</p></div>
                <div><p className="text-xs text-slate-400 uppercase font-semibold">Date</p><p className="text-sm font-medium text-slate-700">{selectedChallan.date}</p></div>
                <div><p className="text-xs text-slate-400 uppercase font-semibold">Status</p><p className="text-sm font-medium text-slate-700">{selectedChallan.status}</p></div>
                {selectedChallan.salesOrderId && <div><p className="text-xs text-slate-400 uppercase font-semibold">Sales Order</p><p className="text-sm font-medium text-slate-700">{selectedChallan.salesOrderId}</p></div>}
              </div>
              {selectedChallan.items && (
                <div><p className="text-xs text-slate-400 uppercase font-semibold mb-1">Items</p><p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap">{selectedChallan.items}</p></div>
              )}
              {selectedChallan.notes && (
                <div><p className="text-xs text-slate-400 uppercase font-semibold mb-1">Notes</p><p className="text-sm text-slate-600">{selectedChallan.notes}</p></div>
              )}
              <div className="flex items-center gap-3 text-xs text-slate-400">
                {selectedChallan.dispatchedAt && <span className="flex items-center gap-1"><Package size={12} /> Dispatched: {new Date(selectedChallan.dispatchedAt).toLocaleDateString()}</span>}
                {selectedChallan.deliveredAt && <span className="flex items-center gap-1"><CheckCircle size={12} /> Delivered: {new Date(selectedChallan.deliveredAt).toLocaleDateString()}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-slate-800">New Delivery Challan</h3><button onClick={() => setShowModal(false)}><X size={20} className="text-slate-400" /></button></div>
            <div className="space-y-4">
              <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Customer *</label><input value={form.customer} onChange={e => setForm(p => ({ ...p, customer: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" /></div>
              <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Challan Number</label><input value={form.challanNumber} onChange={e => setForm(p => ({ ...p, challanNumber: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" placeholder="Auto-generated if empty" /></div>
              <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Date *</label><input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" /></div>
              <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Sales Order ID</label><input value={form.salesOrderId} onChange={e => setForm(p => ({ ...p, salesOrderId: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" placeholder="Optional" /></div>
              <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Items Description</label><textarea value={form.items} onChange={e => setForm(p => ({ ...p, items: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" rows={3} placeholder="List items being delivered..." /></div>
              <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Notes</label><input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" /></div>
              <button onClick={createChallan} className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 flex items-center justify-center gap-2"><Save size={16} /> Create Challan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
