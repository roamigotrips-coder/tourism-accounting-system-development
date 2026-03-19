import { useState, useEffect } from 'react';
import {
  Plus, Search, X, Save, Trash2, Edit2, Eye, FileText,
  Send, CheckCircle, XCircle, Clock, AlertTriangle, ArrowRightCircle,
  ReceiptText, ShoppingCart, Copy, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  type Quote, type QuoteItem,
  fetchQuotes, upsertQuote, deleteQuote,
} from '../lib/supabaseSync';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';
import { useCurrency } from '../context/CurrencyContext';
import { showToast } from '../lib/toast';

// ─── Constants ───────────────────────────────────────────────────────────────

// currencies loaded from CurrencyContext inside component

type QuoteStatus = Quote['status'];

const statusCfg: Record<QuoteStatus, { bg: string; text: string; icon: React.ReactNode }> = {
  Draft:     { bg: 'bg-slate-100',   text: 'text-slate-600',   icon: <FileText size={11} /> },
  Sent:      { bg: 'bg-blue-50',     text: 'text-blue-700',    icon: <Send size={11} /> },
  Accepted:  { bg: 'bg-emerald-50',  text: 'text-emerald-700', icon: <CheckCircle size={11} /> },
  Declined:  { bg: 'bg-red-50',      text: 'text-red-700',     icon: <XCircle size={11} /> },
  Expired:   { bg: 'bg-amber-50',    text: 'text-amber-700',   icon: <AlertTriangle size={11} /> },
  Converted: { bg: 'bg-purple-50',   text: 'text-purple-700',  icon: <ArrowRightCircle size={11} /> },
};

function StatusBadge({ status }: { status: QuoteStatus }) {
  const c = statusCfg[status] ?? statusCfg.Draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${c.bg} ${c.text}`}>
      {c.icon}{status}
    </span>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nextQuoteNumber(quotes: Quote[]): string {
  const nums = quotes.map(q => parseInt(q.quoteNumber.replace('QT-', ''), 10)).filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `QT-${String(next).padStart(4, '0')}`;
}

function calcItemTotal(item: QuoteItem): number {
  return (item.quantity * item.unitPrice) * (1 - item.discountPct / 100);
}

function blankItem(quoteId: string): QuoteItem {
  return {
    id: crypto.randomUUID(), quoteId, description: '', quantity: 1,
    unitPrice: 0, discountPct: 0, taxRate: 5, total: 0,
  };
}

function blankQuote(quoteNumber: string): Quote {
  const id = crypto.randomUUID();
  const today = new Date().toISOString().slice(0, 10);
  const expiry = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  return {
    id, quoteNumber, customer: '', date: today, expiryDate: expiry,
    status: 'Draft', subtotal: 0, discountPct: 0, vat: 0, total: 0,
    currency: 'AED', notes: '', terms: '', items: [blankItem(id)],
  };
}

function fmt(n: number, cur: string) {
  return `${cur} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Quotes() {
  const { currencies: allCurrencies } = useCurrency();
  const currencies = allCurrencies.filter(c => c.enabled).map(c => c.code);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Quote>(blankQuote('QT-0001'));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<string>('date');
  const [sortAsc, setSortAsc] = useState(false);

  // ── Load ──
  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await fetchQuotes();
      if (data) setQuotes(data); else setError('Failed to load quotes');
      setLoading(false);
    })();
  }, []);

  // ── Recalculate form totals whenever items change ──
  function recalcForm(q: Quote): Quote {
    const items = q.items.map(it => ({ ...it, total: calcItemTotal(it) }));
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const vat = subtotal * 0.05;
    return { ...q, items, subtotal, vat, total: subtotal + vat };
  }

  // ── CRUD ──
  async function handleSave() {
    const final = recalcForm(form);
    await upsertQuote(final);
    setQuotes(prev => {
      const idx = prev.findIndex(q => q.id === final.id);
      return idx >= 0 ? prev.map(q => q.id === final.id ? final : q) : [final, ...prev];
    });
    setModalOpen(false);
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this quote?')) return;
    await deleteQuote(id);
    setQuotes(prev => prev.filter(q => q.id !== id));
  }

  async function handleStatusChange(id: string, status: QuoteStatus) {
    const q = quotes.find(q => q.id === id);
    if (!q) return;
    const updated = { ...q, status };
    await upsertQuote(updated);
    setQuotes(prev => prev.map(x => x.id === id ? updated : x));
  }

  async function handleConvert(id: string, target: 'invoice' | 'salesorder') {
    const q = quotes.find(q => q.id === id);
    if (!q) return;
    const updated: Quote = {
      ...q,
      status: 'Converted',
      ...(target === 'invoice' ? { convertedToInv: crypto.randomUUID() } : { convertedToSo: crypto.randomUUID() }),
    };
    await upsertQuote(updated);
    setQuotes(prev => prev.map(x => x.id === id ? updated : x));
    showToast(`Quote ${q.quoteNumber} converted to ${target === 'invoice' ? 'Invoice' : 'Sales Order'} successfully.`, 'success');
  }

  // ── Open form ──
  function openNew() {
    setForm(blankQuote(nextQuoteNumber(quotes)));
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(q: Quote) {
    setForm({ ...q, items: q.items.length ? q.items : [blankItem(q.id)] });
    setEditingId(q.id);
    setModalOpen(true);
  }

  // ── Item editing ──
  function updateItem(idx: number, field: keyof QuoteItem, value: string | number) {
    setForm(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: value };
      return recalcForm({ ...prev, items });
    });
  }

  function addItem() {
    setForm(prev => ({ ...prev, items: [...prev.items, blankItem(prev.id)] }));
  }

  function removeItem(idx: number) {
    setForm(prev => {
      const items = prev.items.filter((_, i) => i !== idx);
      return recalcForm({ ...prev, items: items.length ? items : [blankItem(prev.id)] });
    });
  }

  // ── Filter / Sort ──
  const filtered = quotes
    .filter(q => filterStatus === 'All' || q.status === filterStatus)
    .filter(q => {
      if (!search) return true;
      const s = search.toLowerCase();
      return q.quoteNumber.toLowerCase().includes(s)
        || q.customer.toLowerCase().includes(s)
        || (q.agent ?? '').toLowerCase().includes(s);
    })
    .sort((a, b) => {
      let va: any = (a as any)[sortCol];
      let vb: any = (b as any)[sortCol];
      if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb ?? '').toLowerCase(); }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });

  // ── Stats ──
  const totalQuotes = quotes.length;
  const accepted = quotes.filter(q => q.status === 'Accepted').length;
  const pending = quotes.filter(q => q.status === 'Draft' || q.status === 'Sent').length;
  const totalValue = quotes.reduce((s, q) => s + q.total, 0);

  const viewQuote = viewId ? quotes.find(q => q.id === viewId) : null;

  function toggleSort(col: string) {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  }

  function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return null;
    return sortAsc ? <ChevronUp size={13} /> : <ChevronDown size={13} />;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quotes & Estimates</h1>
          <p className="text-sm text-slate-500 mt-1">Manage quotations and convert to invoices or sales orders</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-sm transition">
          <Plus size={16} /> New Quote
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Quotes', value: totalQuotes, color: 'text-slate-700', bg: 'bg-white' },
          { label: 'Accepted', value: accepted, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Pending', value: pending, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Total Value', value: fmt(totalValue, 'AED'), color: 'text-purple-700', bg: 'bg-purple-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl border border-slate-200 p-4 shadow-sm`}>
            <p className="text-xs font-medium text-slate-500">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search quotes..." className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
          <option value="All">All Statuses</option>
          {(['Draft', 'Sent', 'Accepted', 'Declined', 'Expired', 'Converted'] as QuoteStatus[]).map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {[
                  { key: 'quoteNumber', label: 'Quote #' },
                  { key: 'customer', label: 'Customer' },
                  { key: 'date', label: 'Date' },
                  { key: 'expiryDate', label: 'Expiry' },
                  { key: 'status', label: 'Status' },
                  { key: 'total', label: 'Total' },
                ].map(c => (
                  <th key={c.key} onClick={() => toggleSort(c.key)} className="px-4 py-3 text-left font-semibold text-slate-600 cursor-pointer select-none whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">{c.label}<SortIcon col={c.key} /></span>
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400">No quotes found</td></tr>
              ) : filtered.map(q => (
                <tr key={q.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition">
                  <td className="px-4 py-3 font-medium text-slate-800">{q.quoteNumber}</td>
                  <td className="px-4 py-3 text-slate-700">{q.customer}</td>
                  <td className="px-4 py-3 text-slate-600">{q.date}</td>
                  <td className="px-4 py-3 text-slate-600">{q.expiryDate}</td>
                  <td className="px-4 py-3"><StatusBadge status={q.status} /></td>
                  <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{fmt(q.total, q.currency)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setViewId(q.id)} title="View" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Eye size={15} /></button>
                      <button onClick={() => openEdit(q)} title="Edit" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Edit2 size={15} /></button>
                      {q.status === 'Draft' && (
                        <button onClick={() => handleStatusChange(q.id, 'Sent')} title="Mark Sent" className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"><Send size={15} /></button>
                      )}
                      {q.status === 'Sent' && (
                        <>
                          <button onClick={() => handleStatusChange(q.id, 'Accepted')} title="Accept" className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600"><CheckCircle size={15} /></button>
                          <button onClick={() => handleStatusChange(q.id, 'Declined')} title="Decline" className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><XCircle size={15} /></button>
                        </>
                      )}
                      {q.status === 'Accepted' && (
                        <>
                          <button onClick={() => handleConvert(q.id, 'invoice')} title="Convert to Invoice" className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-600"><ReceiptText size={15} /></button>
                          <button onClick={() => handleConvert(q.id, 'salesorder')} title="Convert to Sales Order" className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-600"><ShoppingCart size={15} /></button>
                        </>
                      )}
                      <button onClick={() => handleDelete(q.id)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── View Detail Modal ── */}
      {viewQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setViewId(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto m-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">{viewQuote.quoteNumber}</h2>
              <button onClick={() => setViewId(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div><span className="text-slate-500">Customer:</span> <span className="font-medium text-slate-800">{viewQuote.customer}</span></div>
              {viewQuote.agent && <div><span className="text-slate-500">Agent:</span> <span className="font-medium text-slate-800">{viewQuote.agent}</span></div>}
              <div><span className="text-slate-500">Date:</span> {viewQuote.date}</div>
              <div><span className="text-slate-500">Expiry:</span> {viewQuote.expiryDate}</div>
              <div><span className="text-slate-500">Status:</span> <StatusBadge status={viewQuote.status} /></div>
              <div><span className="text-slate-500">Currency:</span> {viewQuote.currency}</div>
            </div>
            <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden mb-4">
              <thead><tr className="bg-slate-50">
                <th className="px-3 py-2 text-left text-slate-600">Description</th>
                <th className="px-3 py-2 text-right text-slate-600">Qty</th>
                <th className="px-3 py-2 text-right text-slate-600">Unit Price</th>
                <th className="px-3 py-2 text-right text-slate-600">Disc %</th>
                <th className="px-3 py-2 text-right text-slate-600">Tax %</th>
                <th className="px-3 py-2 text-right text-slate-600">Total</th>
              </tr></thead>
              <tbody>
                {viewQuote.items.map(it => (
                  <tr key={it.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-700">{it.description}</td>
                    <td className="px-3 py-2 text-right">{it.quantity}</td>
                    <td className="px-3 py-2 text-right">{it.unitPrice.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{it.discountPct}</td>
                    <td className="px-3 py-2 text-right">{it.taxRate}</td>
                    <td className="px-3 py-2 text-right font-medium">{calcItemTotal(it).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-col items-end gap-1 text-sm">
              <div className="flex gap-8"><span className="text-slate-500">Subtotal:</span><span className="font-medium w-28 text-right">{fmt(viewQuote.subtotal, viewQuote.currency)}</span></div>
              <div className="flex gap-8"><span className="text-slate-500">VAT (5%):</span><span className="font-medium w-28 text-right">{fmt(viewQuote.vat, viewQuote.currency)}</span></div>
              <div className="flex gap-8 border-t border-slate-200 pt-1 mt-1"><span className="font-semibold text-slate-700">Total:</span><span className="font-bold w-28 text-right text-emerald-700">{fmt(viewQuote.total, viewQuote.currency)}</span></div>
            </div>
            {viewQuote.notes && <div className="mt-4 text-sm"><span className="text-slate-500 font-medium">Notes:</span><p className="text-slate-600 mt-1">{viewQuote.notes}</p></div>}
            {viewQuote.terms && <div className="mt-3 text-sm"><span className="text-slate-500 font-medium">Terms:</span><p className="text-slate-600 mt-1">{viewQuote.terms}</p></div>}
          </div>
        </div>
      )}

      {/* ── Form Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setModalOpen(false); setEditingId(null); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-slate-800">{editingId ? 'Edit Quote' : 'New Quote'}</h2>
              <button onClick={() => { setModalOpen(false); setEditingId(null); }} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-5">
              {/* Top fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Quote #</label>
                  <input value={form.quoteNumber} readOnly className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Customer *</label>
                  <input value={form.customer} onChange={e => setForm(p => ({ ...p, customer: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" placeholder="Customer name" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Agent</label>
                  <input value={form.agent ?? ''} onChange={e => setForm(p => ({ ...p, agent: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" placeholder="Optional agent" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Expiry Date</label>
                  <input type="date" value={form.expiryDate} onChange={e => setForm(p => ({ ...p, expiryDate: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Currency</label>
                  <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none">
                    {currencies.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Line items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-slate-700">Line Items</label>
                  <button onClick={addItem} className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"><Plus size={14} /> Add Item</button>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-3 py-2 text-left text-slate-600 font-medium">Description</th>
                        <th className="px-3 py-2 text-right text-slate-600 font-medium w-20">Qty</th>
                        <th className="px-3 py-2 text-right text-slate-600 font-medium w-28">Unit Price</th>
                        <th className="px-3 py-2 text-right text-slate-600 font-medium w-20">Disc %</th>
                        <th className="px-3 py-2 text-right text-slate-600 font-medium w-20">Tax %</th>
                        <th className="px-3 py-2 text-right text-slate-600 font-medium w-28">Total</th>
                        <th className="px-2 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((it, idx) => (
                        <tr key={it.id} className="border-t border-slate-100">
                          <td className="px-2 py-1.5">
                            <input value={it.description} onChange={e => updateItem(idx, 'description', e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-emerald-400 outline-none" placeholder="Description" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min={0} value={it.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm text-right focus:ring-1 focus:ring-emerald-400 outline-none" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min={0} step={0.01} value={it.unitPrice} onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))} className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm text-right focus:ring-1 focus:ring-emerald-400 outline-none" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min={0} max={100} value={it.discountPct} onChange={e => updateItem(idx, 'discountPct', Number(e.target.value))} className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm text-right focus:ring-1 focus:ring-emerald-400 outline-none" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min={0} max={100} value={it.taxRate} onChange={e => updateItem(idx, 'taxRate', Number(e.target.value))} className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm text-right focus:ring-1 focus:ring-emerald-400 outline-none" />
                          </td>
                          <td className="px-3 py-1.5 text-right font-medium text-slate-700">{calcItemTotal(it).toFixed(2)}</td>
                          <td className="px-1 py-1.5 text-center">
                            <button onClick={() => removeItem(idx)} className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="flex flex-col items-end mt-3 space-y-1 text-sm">
                  <div className="flex gap-6"><span className="text-slate-500 w-24 text-right">Subtotal:</span><span className="font-medium w-32 text-right">{fmt(recalcForm(form).subtotal, form.currency)}</span></div>
                  <div className="flex gap-6"><span className="text-slate-500 w-24 text-right">VAT (5%):</span><span className="font-medium w-32 text-right">{fmt(recalcForm(form).vat, form.currency)}</span></div>
                  <div className="flex gap-6 border-t border-slate-200 pt-1"><span className="font-semibold text-slate-700 w-24 text-right">Total:</span><span className="font-bold w-32 text-right text-emerald-700">{fmt(recalcForm(form).total, form.currency)}</span></div>
                </div>
              </div>

              {/* Notes / Terms */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                  <textarea rows={3} value={form.notes ?? ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none" placeholder="Internal notes..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Terms & Conditions</label>
                  <textarea rows={3} value={form.terms ?? ''} onChange={e => setForm(p => ({ ...p, terms: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none" placeholder="Payment terms, validity period..." />
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
              <button onClick={() => { setModalOpen(false); setEditingId(null); }} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Cancel</button>
              <button onClick={handleSave} disabled={!form.customer.trim()} className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium shadow-sm transition">
                <Save size={15} /> {editingId ? 'Update Quote' : 'Save Quote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
