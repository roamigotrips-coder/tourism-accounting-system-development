import { useState, useEffect } from 'react';
import { Tag, Plus, Edit2, Trash2, X, Save, Percent, DollarSign, CheckCircle, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PriceList { id: string; name: string; type: 'sales' | 'purchase'; currency: string; markupPct: number; discountPct: number; isDefault: boolean; validFrom: string; validTo: string; status: 'Active' | 'Inactive'; }
interface PriceListItem { id: string; priceListId: string; itemId: string; itemName: string; standardPrice: number; listPrice: number; markupPct: number; discountPct: number; }
interface CompositeItem { id: string; code: string; name: string; description: string; sellingPrice: number; costPrice: number; status: string; components: CompositeComponent[]; }
interface CompositeComponent { id: string; compositeItemId: string; inventoryItemId: string; itemName: string; quantity: number; unitCost: number; }

export default function PriceLists() {
  const [lists, setLists] = useState<PriceList[]>([]);
  const [items, setItems] = useState<PriceListItem[]>([]);
  const [composites, setComposites] = useState<CompositeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'lists' | 'composites'>('lists');
  const [showModal, setShowModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedList, setSelectedList] = useState<PriceList | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', type: 'sales' as 'sales' | 'purchase', currency: 'AED', markupPct: 0, discountPct: 0, validFrom: '', validTo: '', status: 'Active' as 'Active' | 'Inactive' });
  const [itemForm, setItemForm] = useState({ itemName: '', standardPrice: 0, listPrice: 0, markupPct: 0, discountPct: 0 });

  useEffect(() => {
    (async () => {
      const { data: pl } = await supabase.from('price_lists').select('*').order('created_at', { ascending: false });
      const { data: pli } = await supabase.from('price_list_items').select('*');
      const { data: ci } = await supabase.from('composite_items').select('*');
      const { data: cic } = await supabase.from('composite_item_components').select('*');
      setLists((pl ?? []).map((r: any) => ({ id: r.id, name: r.name, type: r.type, currency: r.currency, markupPct: Number(r.markup_pct), discountPct: Number(r.discount_pct), isDefault: r.is_default, validFrom: r.valid_from ?? '', validTo: r.valid_to ?? '', status: r.status })));
      setItems((pli ?? []).map((r: any) => ({ id: r.id, priceListId: r.price_list_id, itemId: r.item_id ?? '', itemName: r.item_name, standardPrice: Number(r.standard_price), listPrice: Number(r.list_price), markupPct: Number(r.markup_pct), discountPct: Number(r.discount_pct) })));
      const comps = (cic ?? []).map((r: any) => ({ id: r.id, compositeItemId: r.composite_item_id, inventoryItemId: r.inventory_item_id, itemName: r.item_name, quantity: Number(r.quantity), unitCost: Number(r.unit_cost) }));
      setComposites((ci ?? []).map((r: any) => ({ id: r.id, code: r.code, name: r.name, description: r.description, sellingPrice: Number(r.selling_price), costPrice: Number(r.cost_price), status: r.status, components: comps.filter(c => c.compositeItemId === r.id) })));
      setLoading(false);
    })();
  }, []);

  const listItems = selectedList ? items.filter(i => i.priceListId === selectedList.id) : [];
  const activeCount = lists.filter(l => l.status === 'Active').length;
  const defaultList = lists.find(l => l.isDefault);

  const saveList = async () => {
    if (!form.name) return;
    const id = editId || crypto.randomUUID();
    await supabase.from('price_lists').upsert({ id, name: form.name, type: form.type, currency: form.currency, markup_pct: form.markupPct, discount_pct: form.discountPct, valid_from: form.validFrom || null, valid_to: form.validTo || null, status: form.status, is_default: false }, { onConflict: 'id' });
    const nl: PriceList = { id, ...form, isDefault: false };
    setLists(prev => editId ? prev.map(l => l.id === id ? nl : l) : [nl, ...prev]);
    setShowModal(false); setEditId(null);
  };

  const deleteList = async (id: string) => {
    if (!confirm('Delete this price list?')) return;
    await supabase.from('price_lists').delete().eq('id', id);
    setLists(prev => prev.filter(l => l.id !== id));
    if (selectedList?.id === id) setSelectedList(null);
  };

  const addItem = async () => {
    if (!selectedList || !itemForm.itemName) return;
    const id = crypto.randomUUID();
    await supabase.from('price_list_items').upsert({ id, price_list_id: selectedList.id, item_name: itemForm.itemName, standard_price: itemForm.standardPrice, list_price: itemForm.listPrice, markup_pct: itemForm.markupPct, discount_pct: itemForm.discountPct }, { onConflict: 'id' });
    setItems(prev => [...prev, { id, priceListId: selectedList.id, itemId: '', ...itemForm }]);
    setItemForm({ itemName: '', standardPrice: 0, listPrice: 0, markupPct: 0, discountPct: 0 });
    setShowItemModal(false);
  };

  const deleteItem = async (id: string) => {
    await supabase.from('price_list_items').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Tag className="text-emerald-600" size={24} /> Price Lists</h1>
          <p className="text-slate-500 mt-1">Manage pricing strategies, markups, and composite items</p>
        </div>
        <button onClick={() => { setForm({ name: '', type: 'sales', currency: 'AED', markupPct: 0, discountPct: 0, validFrom: '', validTo: '', status: 'Active' }); setEditId(null); setShowModal(true); }} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 text-sm font-medium">
          <Plus size={16} /> New Price List
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"><p className="text-xs font-semibold text-slate-400 uppercase">Total Lists</p><p className="text-2xl font-bold text-slate-800">{lists.length}</p></div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"><p className="text-xs font-semibold text-slate-400 uppercase">Active</p><p className="text-2xl font-bold text-emerald-600">{activeCount}</p></div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"><p className="text-xs font-semibold text-slate-400 uppercase">Default List</p><p className="text-lg font-bold text-blue-600">{defaultList?.name || 'None'}</p></div>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {(['lists', 'composites'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === t ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            {t === 'lists' ? 'Price Lists' : 'Composite Items'}
          </button>
        ))}
      </div>

      {activeTab === 'lists' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            {lists.map(l => (
              <div key={l.id} onClick={() => setSelectedList(l)} className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${selectedList?.id === l.id ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-100'}`}>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-semibold text-slate-700">{l.name}</h4>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${l.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{l.status}</span>
                </div>
                <p className="text-xs text-slate-400">{l.type} &middot; {l.currency} &middot; {l.markupPct > 0 ? `+${l.markupPct}%` : ''} {l.discountPct > 0 ? `-${l.discountPct}%` : ''}</p>
                <div className="flex gap-1 mt-2">
                  <button onClick={e => { e.stopPropagation(); setForm({ name: l.name, type: l.type, currency: l.currency, markupPct: l.markupPct, discountPct: l.discountPct, validFrom: l.validFrom, validTo: l.validTo, status: l.status }); setEditId(l.id); setShowModal(true); }} className="p-1 text-slate-400 hover:text-blue-600"><Edit2 size={13} /></button>
                  <button onClick={e => { e.stopPropagation(); deleteList(l.id); }} className="p-1 text-slate-400 hover:text-red-600"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <span className="font-semibold text-slate-800">{selectedList ? `Items in: ${selectedList.name}` : 'Select a price list'}</span>
              {selectedList && <button onClick={() => setShowItemModal(true)} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700"><Plus size={13} /> Add Item</button>}
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Item</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Standard</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-400 uppercase">List Price</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Markup %</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Discount %</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-400 uppercase">Del</th>
              </tr></thead>
              <tbody>
                {listItems.map(i => (
                  <tr key={i.id} className="border-b border-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-700">{i.itemName}</td>
                    <td className="px-5 py-3 text-right text-slate-500">{i.standardPrice.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right font-semibold text-emerald-700">{i.listPrice.toLocaleString()}</td>
                    <td className="px-5 py-3 text-center text-blue-600">{i.markupPct}%</td>
                    <td className="px-5 py-3 text-center text-amber-600">{i.discountPct}%</td>
                    <td className="px-3 py-3 text-center"><button onClick={() => deleteItem(i.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={13} /></button></td>
                  </tr>
                ))}
                {listItems.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-slate-400">{selectedList ? 'No items yet' : 'Select a list to view items'}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'composites' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 font-semibold text-slate-800 flex items-center gap-2"><Package size={16} className="text-purple-500" /> Composite Items (Kits & Assemblies)</div>
          {composites.length === 0 ? (
            <div className="text-center py-12 text-slate-400">No composite items. Create kits by bundling inventory items.</div>
          ) : composites.map(ci => (
            <div key={ci.id} className="border-b border-slate-50 p-5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-slate-700">{ci.code} — {ci.name}</h4>
                  <p className="text-xs text-slate-400">{ci.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-700">Sell: AED {ci.sellingPrice.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">Cost: AED {ci.costPrice.toLocaleString()}</p>
                </div>
              </div>
              {ci.components.length > 0 && (
                <div className="mt-2 bg-slate-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Components</p>
                  {ci.components.map(c => (
                    <div key={c.id} className="flex justify-between text-xs text-slate-600 py-1">
                      <span>{c.itemName} x{c.quantity}</span>
                      <span>AED {(c.quantity * c.unitCost).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-slate-800">{editId ? 'Edit' : 'New'} Price List</h3><button onClick={() => setShowModal(false)}><X size={20} className="text-slate-400" /></button></div>
            <div className="space-y-3">
              <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Name *</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Type</label><select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as any }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm"><option value="sales">Sales</option><option value="purchase">Purchase</option></select></div>
                <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Currency</label><select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm"><option>AED</option><option>USD</option><option>EUR</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Markup %</label><input type="number" value={form.markupPct} onChange={e => setForm(p => ({ ...p, markupPct: Number(e.target.value) }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" /></div>
                <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Discount %</label><input type="number" value={form.discountPct} onChange={e => setForm(p => ({ ...p, discountPct: Number(e.target.value) }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Valid From</label><input type="date" value={form.validFrom} onChange={e => setForm(p => ({ ...p, validFrom: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" /></div>
                <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Valid To</label><input type="date" value={form.validTo} onChange={e => setForm(p => ({ ...p, validTo: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" /></div>
              </div>
              <button onClick={saveList} className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 flex items-center justify-center gap-2"><Save size={16} /> Save</button>
            </div>
          </div>
        </div>
      )}

      {showItemModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowItemModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-slate-800">Add Item</h3><button onClick={() => setShowItemModal(false)}><X size={20} className="text-slate-400" /></button></div>
            <div className="space-y-3">
              <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Item Name *</label><input value={itemForm.itemName} onChange={e => setItemForm(p => ({ ...p, itemName: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Standard Price</label><input type="number" value={itemForm.standardPrice} onChange={e => setItemForm(p => ({ ...p, standardPrice: Number(e.target.value) }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" /></div>
                <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">List Price</label><input type="number" value={itemForm.listPrice} onChange={e => setItemForm(p => ({ ...p, listPrice: Number(e.target.value) }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Markup %</label><input type="number" value={itemForm.markupPct} onChange={e => setItemForm(p => ({ ...p, markupPct: Number(e.target.value) }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" /></div>
                <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Discount %</label><input type="number" value={itemForm.discountPct} onChange={e => setItemForm(p => ({ ...p, discountPct: Number(e.target.value) }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" /></div>
              </div>
              <button onClick={addItem} className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700">Add Item</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
