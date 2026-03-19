import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, X, Save, Trash2, Edit3, FileText, Copy,
  ShoppingCart, TrendingUp, CheckCircle, Truck, Receipt,
  ChevronDown, ChevronUp, Filter, Download,
} from 'lucide-react';
import {
  SalesOrder, SalesOrderItem,
  fetchSalesOrders, upsertSalesOrder, deleteSalesOrder,
} from '../lib/supabaseSync';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';

// ─── Constants ───────────────────────────────────────────────────────────────

const CURRENCIES = ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'INR'];

type SOStatus = SalesOrder['status'];

const STATUS_CFG: Record<SOStatus, { bg: string; text: string }> = {
  Draft:        { bg: 'bg-slate-100',   text: 'text-slate-600' },
  Confirmed:    { bg: 'bg-blue-50',     text: 'text-blue-700' },
  'In Progress':{ bg: 'bg-amber-50',    text: 'text-amber-700' },
  Delivered:    { bg: 'bg-emerald-50',  text: 'text-emerald-700' },
  Invoiced:     { bg: 'bg-purple-50',   text: 'text-purple-700' },
  Cancelled:    { bg: 'bg-red-50',      text: 'text-red-600' },
};

function StatusBadge({ status }: { status: SOStatus }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.Draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${c.bg} ${c.text}`}>
      {status}
    </span>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number, cur: string) =>
  new Intl.NumberFormat('en-AE', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(n);

const today = () => new Date().toISOString().slice(0, 10);

function nextSoNumber(orders: SalesOrder[]): string {
  const nums = orders.map(o => parseInt(o.soNumber.replace(/\D/g, ''), 10)).filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `SO-${String(next).padStart(4, '0')}`;
}

function blankItem(soId: string): SalesOrderItem {
  return { id: crypto.randomUUID(), salesOrderId: soId, description: '', quantity: 1, unitPrice: 0, discountPct: 0, taxRate: 5, total: 0 };
}

function calcItemTotal(i: SalesOrderItem): number {
  const base = i.quantity * i.unitPrice;
  const afterDisc = base * (1 - i.discountPct / 100);
  return +(afterDisc * (1 + i.taxRate / 100)).toFixed(2);
}

function calcTotals(items: SalesOrderItem[]) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice * (1 - i.discountPct / 100), 0);
  const vat = subtotal * 0.05;
  return { subtotal: +subtotal.toFixed(2), vat: +vat.toFixed(2), total: +(subtotal + vat).toFixed(2) };
}

// ─── Form State ──────────────────────────────────────────────────────────────

interface FormState {
  id: string;
  soNumber: string;
  customer: string;
  agent: string;
  date: string;
  deliveryDate: string;
  currency: string;
  notes: string;
  status: SOStatus;
  items: SalesOrderItem[];
}

function emptyForm(soNumber: string): FormState {
  const id = crypto.randomUUID();
  return {
    id, soNumber, customer: '', agent: '', date: today(), deliveryDate: '',
    currency: 'AED', notes: '', status: 'Draft', items: [blankItem(id)],
  };
}

function orderToForm(o: SalesOrder): FormState {
  return {
    id: o.id, soNumber: o.soNumber, customer: o.customer, agent: o.agent ?? '',
    date: o.date, deliveryDate: o.deliveryDate ?? '', currency: o.currency,
    notes: o.notes ?? '', status: o.status,
    items: o.items.length > 0 ? o.items : [blankItem(o.id)],
  };
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SalesOrders() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SOStatus | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm('SO-0001'));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    const data = await fetchSalesOrders();
    if (data) { setOrders(data); setError(null); }
    else setError('Failed to load sales orders');
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = orders;
    if (statusFilter) list = list.filter(o => o.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        o.soNumber.toLowerCase().includes(q) ||
        o.customer.toLowerCase().includes(q) ||
        (o.agent ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [orders, search, statusFilter]);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: orders.length,
    confirmed: orders.filter(o => o.status === 'Confirmed').length,
    delivered: orders.filter(o => o.status === 'Delivered').length,
    value: orders.reduce((s, o) => s + o.total, 0),
  }), [orders]);

  // ── Open form ───────────────────────────────────────────────────────────────
  const openNew = () => { setEditingId(null); setForm(emptyForm(nextSoNumber(orders))); setShowModal(true); };
  const openEdit = (o: SalesOrder) => { setEditingId(o.id); setForm(orderToForm(o)); setShowModal(true); };

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.customer.trim()) return;
    setSaving(true);
    const items: SalesOrderItem[] = form.items
      .filter(i => i.description.trim())
      .map(i => ({ ...i, salesOrderId: form.id, total: calcItemTotal(i) }));
    const { subtotal, vat, total } = calcTotals(items);
    const so: SalesOrder = {
      id: form.id, soNumber: form.soNumber, customer: form.customer.trim(),
      agent: form.agent.trim() || undefined, date: form.date,
      deliveryDate: form.deliveryDate || undefined, status: form.status,
      subtotal, vat, total, currency: form.currency, notes: form.notes.trim() || undefined,
      items,
    };
    await upsertSalesOrder(so);
    setShowModal(false);
    await load();
    setSaving(false);
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this sales order?')) return;
    await deleteSalesOrder(id);
    await load();
  };

  // ── Convert to Invoice ──────────────────────────────────────────────────────
  const handleConvertToInvoice = async (o: SalesOrder) => {
    if (!confirm(`Convert ${o.soNumber} to Invoice? Status will be set to Invoiced.`)) return;
    const updated: SalesOrder = { ...o, status: 'Invoiced' };
    await upsertSalesOrder(updated);
    await load();
  };

  // ── Line item helpers ───────────────────────────────────────────────────────
  const updateItem = (idx: number, patch: Partial<SalesOrderItem>) => {
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], ...patch };
      return { ...f, items };
    });
  };
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, blankItem(f.id)] }));
  const removeItem = (idx: number) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const formTotals = useMemo(() => {
    const valid = form.items.filter(i => i.description.trim());
    return calcTotals(valid);
  }, [form.items]);

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sales Orders</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage customer sales orders and track fulfilment</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium text-sm shadow-sm">
          <Plus size={16} /> New Sales Order
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Orders',  value: stats.total,                          icon: <ShoppingCart size={20} className="text-emerald-600" />, bg: 'bg-emerald-50' },
          { label: 'Confirmed',     value: stats.confirmed,                      icon: <CheckCircle size={20} className="text-blue-600" />,    bg: 'bg-blue-50' },
          { label: 'Delivered',     value: stats.delivered,                       icon: <Truck size={20} className="text-amber-600" />,         bg: 'bg-amber-50' },
          { label: 'Total Value',   value: fmt(stats.value, 'AED'),              icon: <TrendingUp size={20} className="text-purple-600" />,   bg: 'bg-purple-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}>{s.icon}</div>
            <div>
              <p className="text-xs text-slate-500 font-medium">{s.label}</p>
              <p className="text-lg font-bold text-slate-800">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by SO #, customer, or agent..."
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as SOStatus | '')}
            className="pl-8 pr-8 py-2.5 text-sm border border-slate-200 rounded-lg appearance-none bg-white focus:ring-2 focus:ring-emerald-500 outline-none">
            <option value="">All Statuses</option>
            {(['Draft','Confirmed','In Progress','Delivered','Invoiced','Cancelled'] as SOStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['SO #','Customer','Date','Delivery Date','Status','Total','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400">
                  <FileText size={32} className="mx-auto mb-2 opacity-40" />No sales orders found
                </td></tr>
              )}
              {filtered.map(o => (
                <tr key={o.id} className="hover:bg-slate-50/60 transition">
                  <td className="px-4 py-3 font-medium text-emerald-700">{o.soNumber}</td>
                  <td className="px-4 py-3 text-slate-700">{o.customer}</td>
                  <td className="px-4 py-3 text-slate-600">{o.date}</td>
                  <td className="px-4 py-3 text-slate-600">{o.deliveryDate ?? '-'}</td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{fmt(o.total, o.currency)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setExpandedId(expandedId === o.id ? null : o.id)} title="Details"
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-500">{expandedId === o.id ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}</button>
                      <button onClick={() => openEdit(o)} title="Edit" className="p-1.5 rounded hover:bg-slate-100 text-slate-500"><Edit3 size={15}/></button>
                      {(o.status === 'Confirmed' || o.status === 'Delivered') && (
                        <button onClick={() => handleConvertToInvoice(o)} title="Convert to Invoice"
                          className="p-1.5 rounded hover:bg-purple-100 text-purple-600"><Receipt size={15}/></button>
                      )}
                      <button onClick={() => handleDelete(o.id)} title="Delete" className="p-1.5 rounded hover:bg-red-100 text-red-500"><Trash2 size={15}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expanded detail */}
      {expandedId && (() => {
        const o = orders.find(x => x.id === expandedId);
        if (!o) return null;
        return (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">{o.soNumber} - Line Items</h3>
              <button onClick={() => setExpandedId(null)} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
            </div>
            {o.agent && <p className="text-xs text-slate-500">Agent: {o.agent}</p>}
            {o.notes && <p className="text-xs text-slate-500">Notes: {o.notes}</p>}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase">
                  <th className="text-left py-2 px-2">Description</th>
                  <th className="text-right py-2 px-2">Qty</th>
                  <th className="text-right py-2 px-2">Unit Price</th>
                  <th className="text-right py-2 px-2">Disc %</th>
                  <th className="text-right py-2 px-2">Tax %</th>
                  <th className="text-right py-2 px-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {o.items.map(i => (
                  <tr key={i.id}>
                    <td className="py-2 px-2 text-slate-700">{i.description}</td>
                    <td className="py-2 px-2 text-right text-slate-600">{i.quantity}</td>
                    <td className="py-2 px-2 text-right text-slate-600">{fmt(i.unitPrice, o.currency)}</td>
                    <td className="py-2 px-2 text-right text-slate-600">{i.discountPct}%</td>
                    <td className="py-2 px-2 text-right text-slate-600">{i.taxRate}%</td>
                    <td className="py-2 px-2 text-right font-medium text-slate-800">{fmt(i.total, o.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end">
              <div className="text-right space-y-1 text-sm">
                <p className="text-slate-500">Subtotal: <span className="font-medium text-slate-700">{fmt(o.subtotal, o.currency)}</span></p>
                <p className="text-slate-500">VAT (5%): <span className="font-medium text-slate-700">{fmt(o.vat, o.currency)}</span></p>
                <p className="text-slate-800 font-bold">Total: {fmt(o.total, o.currency)}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal ──────────────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 bg-black/40 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 mb-8">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">{editingId ? 'Edit Sales Order' : 'New Sales Order'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>

            <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Top fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">SO Number</label>
                  <input value={form.soNumber} readOnly className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Customer *</label>
                  <input value={form.customer} onChange={e => setForm(f => ({ ...f, customer: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Customer name" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Agent</label>
                  <input value={form.agent} onChange={e => setForm(f => ({ ...f, agent: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Optional" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Delivery Date</label>
                  <input type="date" value={form.deliveryDate} onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Currency</label>
                  <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white">
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as SOStatus }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white">
                    {(['Draft','Confirmed','In Progress','Delivered','Invoiced','Cancelled'] as SOStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
                  <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Optional notes" />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-slate-700">Line Items</h3>
                  <button onClick={addItem} className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700">
                    <Plus size={14}/> Add Line
                  </button>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                        <th className="text-left px-3 py-2">Description</th>
                        <th className="text-right px-2 py-2 w-16">Qty</th>
                        <th className="text-right px-2 py-2 w-24">Unit Price</th>
                        <th className="text-right px-2 py-2 w-16">Disc %</th>
                        <th className="text-right px-2 py-2 w-16">Tax %</th>
                        <th className="text-right px-2 py-2 w-24">Total</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {form.items.map((item, idx) => (
                        <tr key={item.id}>
                          <td className="px-2 py-1.5">
                            <input value={item.description} onChange={e => updateItem(idx, { description: e.target.value })}
                              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="Description" />
                          </td>
                          <td className="px-1 py-1.5">
                            <input type="number" min={0} value={item.quantity} onChange={e => updateItem(idx, { quantity: +e.target.value })}
                              className="w-full px-2 py-1.5 text-sm text-right border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500 outline-none" />
                          </td>
                          <td className="px-1 py-1.5">
                            <input type="number" min={0} step={0.01} value={item.unitPrice} onChange={e => updateItem(idx, { unitPrice: +e.target.value })}
                              className="w-full px-2 py-1.5 text-sm text-right border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500 outline-none" />
                          </td>
                          <td className="px-1 py-1.5">
                            <input type="number" min={0} max={100} value={item.discountPct} onChange={e => updateItem(idx, { discountPct: +e.target.value })}
                              className="w-full px-2 py-1.5 text-sm text-right border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500 outline-none" />
                          </td>
                          <td className="px-1 py-1.5">
                            <input type="number" min={0} max={100} value={item.taxRate} onChange={e => updateItem(idx, { taxRate: +e.target.value })}
                              className="w-full px-2 py-1.5 text-sm text-right border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500 outline-none" />
                          </td>
                          <td className="px-2 py-1.5 text-right font-medium text-slate-700 text-sm">
                            {fmt(calcItemTotal(item), form.currency)}
                          </td>
                          <td className="px-1 py-1.5">
                            {form.items.length > 1 && (
                              <button onClick={() => removeItem(idx)} className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="flex justify-end mt-3">
                  <div className="w-64 space-y-1.5 text-sm">
                    <div className="flex justify-between text-slate-500">
                      <span>Subtotal</span><span className="font-medium text-slate-700">{fmt(formTotals.subtotal, form.currency)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>VAT (5%)</span><span className="font-medium text-slate-700">{fmt(formTotals.vat, form.currency)}</span>
                    </div>
                    <div className="flex justify-between text-slate-800 font-bold border-t border-slate-200 pt-1.5">
                      <span>Total</span><span>{fmt(formTotals.total, form.currency)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving || !form.customer.trim()}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm">
                <Save size={15}/> {saving ? 'Saving...' : 'Save Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
