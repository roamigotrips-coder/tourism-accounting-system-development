import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, X, Save, Trash2, Edit2, FileText, DollarSign,
  CreditCard, ArrowDownCircle, ArrowUpCircle, Filter, RefreshCw,
} from 'lucide-react';
import {
  CreditNote, CreditNoteItem, fetchCreditNotes, upsertCreditNote, deleteCreditNote,
} from '../lib/supabaseSync';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';

/* ─── Helpers ──────────────────────────────────────────────── */

const STATUS_BADGE: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-600',
  Open: 'bg-blue-50 text-blue-700',
  Applied: 'bg-emerald-50 text-emerald-700',
  Void: 'bg-red-50 text-red-700',
};

const REFUND_BADGE: Record<string, string> = {
  None: 'bg-slate-100 text-slate-500',
  Partial: 'bg-amber-50 text-amber-700',
  Full: 'bg-emerald-50 text-emerald-700',
};

const fmt = (n: number, c = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(n);

function emptyItem(creditNoteId: string): CreditNoteItem {
  return { id: crypto.randomUUID(), creditNoteId, description: '', quantity: 1, unitPrice: 0, total: 0 };
}

function blankNote(type: 'Credit' | 'Debit', nextNum: string): CreditNote {
  const id = crypto.randomUUID();
  return {
    id, cnNumber: nextNum, type, customer: '', invoiceId: '',
    date: new Date().toISOString().slice(0, 10), reason: '', subtotal: 0,
    vat: 0, total: 0, currency: 'USD', status: 'Draft',
    refundStatus: 'None', refundAmount: 0, items: [emptyItem(id)],
  };
}

function nextNumber(notes: CreditNote[], type: 'Credit' | 'Debit'): string {
  const prefix = type === 'Credit' ? 'CN' : 'DN';
  const nums = notes.filter(n => n.type === type).map(n => {
    const m = n.cnNumber.match(/\d+$/);
    return m ? parseInt(m[0], 10) : 0;
  });
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `${prefix}-${String(next).padStart(4, '0')}`;
}

function recalc(items: CreditNoteItem[]): { subtotal: number; vat: number; total: number } {
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const vat = +(subtotal * 0.05).toFixed(2);
  return { subtotal, vat, total: +(subtotal + vat).toFixed(2) };
}

/* ─── Main Component ───────────────────────────────────────── */

export default function CreditNotes() {
  const [notes, setNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'Credit' | 'Debit'>('Credit');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // modals
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CreditNote | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundTarget, setRefundTarget] = useState<CreditNote | null>(null);
  const [refundAmt, setRefundAmt] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    const data = await fetchCreditNotes();
    if (data) setNotes(data); else setError('Failed to load credit/debit notes.');
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  /* ── filtered list ── */
  const filtered = useMemo(() => {
    let list = notes.filter(n => n.type === tab);
    if (statusFilter !== 'All') list = list.filter(n => n.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(n =>
        n.cnNumber.toLowerCase().includes(q) ||
        n.customer.toLowerCase().includes(q) ||
        (n.invoiceId ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [notes, tab, search, statusFilter]);

  /* ── stats ── */
  const stats = useMemo(() => {
    const cn = notes.filter(n => n.type === 'Credit');
    const dn = notes.filter(n => n.type === 'Debit');
    const openAmt = notes.filter(n => n.status === 'Open').reduce((s, n) => s + n.total, 0);
    const appliedAmt = notes.filter(n => n.status === 'Applied').reduce((s, n) => s + n.total, 0);
    return { creditCount: cn.length, debitCount: dn.length, openAmt, appliedAmt };
  }, [notes]);

  /* ── form helpers ── */
  const openNew = () => {
    const note = blankNote(tab, nextNumber(notes, tab));
    setEditing(note);
    setFormOpen(true);
  };

  const openEdit = (n: CreditNote) => {
    setEditing({ ...n, items: n.items.map(i => ({ ...i })) });
    setFormOpen(true);
  };

  const closeForm = () => { setFormOpen(false); setEditing(null); };

  const saveForm = async () => {
    if (!editing) return;
    const totals = recalc(editing.items);
    const toSave: CreditNote = { ...editing, ...totals };
    await upsertCreditNote(toSave);
    closeForm();
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this note?')) return;
    await deleteCreditNote(id);
    load();
  };

  const updateField = <K extends keyof CreditNote>(k: K, v: CreditNote[K]) => {
    if (!editing) return;
    const updated = { ...editing, [k]: v };
    if (k === 'type') {
      updated.cnNumber = nextNumber(notes, v as 'Credit' | 'Debit');
    }
    setEditing(updated);
  };

  const updateItem = (idx: number, field: keyof CreditNoteItem, value: string | number) => {
    if (!editing) return;
    const items = editing.items.map((it, i) => {
      if (i !== idx) return it;
      const upd = { ...it, [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        upd.total = +((upd.quantity * upd.unitPrice).toFixed(2));
      }
      return upd;
    });
    setEditing({ ...editing, items });
  };

  const addItem = () => {
    if (!editing) return;
    setEditing({ ...editing, items: [...editing.items, emptyItem(editing.id)] });
  };

  const removeItem = (idx: number) => {
    if (!editing || editing.items.length <= 1) return;
    setEditing({ ...editing, items: editing.items.filter((_, i) => i !== idx) });
  };

  /* ── refund ── */
  const openRefund = (n: CreditNote) => {
    setRefundTarget(n);
    setRefundAmt(String(n.refundAmount || ''));
    setRefundOpen(true);
  };

  const saveRefund = async () => {
    if (!refundTarget) return;
    const amt = Math.min(Math.max(parseFloat(refundAmt) || 0, 0), refundTarget.total);
    let rs: 'None' | 'Partial' | 'Full' = 'None';
    if (amt > 0 && amt < refundTarget.total) rs = 'Partial';
    else if (amt >= refundTarget.total) rs = 'Full';
    await upsertCreditNote({ ...refundTarget, refundAmount: amt, refundStatus: rs });
    setRefundOpen(false);
    setRefundTarget(null);
    load();
  };

  /* ── computed totals for form ── */
  const formTotals = editing ? recalc(editing.items) : { subtotal: 0, vat: 0, total: 0 };

  /* ─── Render ─────────────────────────────────────────────── */

  if (loading) return <LoadingSpinner message="Loading credit & debit notes..." />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Credit Notes & Debit Notes</h1>
          <p className="text-sm text-slate-500 mt-1">Manage credit and debit adjustments</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          <Plus size={16} /> New {tab} Note
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Credit Notes', value: stats.creditCount, icon: <ArrowDownCircle size={20} className="text-emerald-600" />, bg: 'bg-emerald-50' },
          { label: 'Total Debit Notes', value: stats.debitCount, icon: <ArrowUpCircle size={20} className="text-slate-600" />, bg: 'bg-slate-50' },
          { label: 'Open Amount', value: fmt(stats.openAmt), icon: <DollarSign size={20} className="text-blue-600" />, bg: 'bg-blue-50' },
          { label: 'Applied Amount', value: fmt(stats.appliedAmt), icon: <CreditCard size={20} className="text-emerald-600" />, bg: 'bg-emerald-50' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-xl p-4 flex items-center gap-3`}>
            <div className="p-2 bg-white rounded-lg shadow-sm">{s.icon}</div>
            <div>
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="text-lg font-bold text-slate-800">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex bg-slate-100 rounded-lg p-1">
          {(['Credit', 'Debit'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === t ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>
              {t} Notes
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-slate-200 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none">
            {['All', 'Draft', 'Open', 'Applied', 'Void'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-left">
              {['CN/DN #', 'Type', 'Customer', 'Invoice #', 'Date', 'Status', 'Total', 'Refund', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center py-12 text-slate-400">No {tab.toLowerCase()} notes found.</td></tr>
            )}
            {filtered.map(n => (
              <tr key={n.id} className="hover:bg-slate-50 transition">
                <td className="px-4 py-3 font-medium text-slate-800">{n.cnNumber}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${n.type === 'Credit' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                    {n.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">{n.customer}</td>
                <td className="px-4 py-3 text-slate-500">{n.invoiceId || '—'}</td>
                <td className="px-4 py-3 text-slate-500">{n.date}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_BADGE[n.status]}`}>{n.status}</span>
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">{fmt(n.total, n.currency)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${REFUND_BADGE[n.refundStatus]}`}>{n.refundStatus}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(n)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" title="Edit"><Edit2 size={14} /></button>
                    {n.status === 'Open' && (
                      <button onClick={() => openRefund(n)} className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600" title="Record Refund"><RefreshCw size={14} /></button>
                    )}
                    <button onClick={() => handleDelete(n.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Delete"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── Form Modal ─────────────────────────────────────── */}
      {formOpen && editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileText size={18} className="text-emerald-600" />
                {editing.createdAt ? 'Edit' : 'New'} {editing.type} Note
              </h2>
              <button onClick={closeForm} className="p-1 rounded hover:bg-slate-100"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Top fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                  <select value={editing.type} onChange={e => updateField('type', e.target.value as 'Credit' | 'Debit')}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                    <option>Credit</option><option>Debit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{editing.type === 'Credit' ? 'CN' : 'DN'} #</label>
                  <input value={editing.cnNumber} readOnly className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                  <input type="date" value={editing.date} onChange={e => updateField('date', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Customer</label>
                  <input value={editing.customer} onChange={e => updateField('customer', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Customer name" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Invoice # (optional)</label>
                  <input value={editing.invoiceId ?? ''} onChange={e => updateField('invoiceId', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="INV-0001" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Currency</label>
                  <select value={editing.currency} onChange={e => updateField('currency', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                    {['USD', 'EUR', 'GBP', 'AED', 'SAR'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Reason</label>
                  <input value={editing.reason} onChange={e => updateField('reason', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Reason for note" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                  <select value={editing.status} onChange={e => updateField('status', e.target.value as CreditNote['status'])}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                    {['Draft', 'Open', 'Applied', 'Void'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Line items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Line Items</label>
                  <button onClick={addItem} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
                    <Plus size={12} /> Add Line
                  </button>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600">
                        <th className="px-3 py-2 text-left font-medium">Description</th>
                        <th className="px-3 py-2 text-right font-medium w-20">Qty</th>
                        <th className="px-3 py-2 text-right font-medium w-28">Unit Price</th>
                        <th className="px-3 py-2 text-right font-medium w-28">Total</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {editing.items.map((it, idx) => (
                        <tr key={it.id}>
                          <td className="px-3 py-1.5">
                            <input value={it.description} onChange={e => updateItem(idx, 'description', e.target.value)}
                              className="w-full border-0 bg-transparent text-sm focus:ring-0 outline-none" placeholder="Item description" />
                          </td>
                          <td className="px-3 py-1.5">
                            <input type="number" min={1} value={it.quantity} onChange={e => updateItem(idx, 'quantity', +e.target.value)}
                              className="w-full text-right border-0 bg-transparent text-sm focus:ring-0 outline-none" />
                          </td>
                          <td className="px-3 py-1.5">
                            <input type="number" min={0} step={0.01} value={it.unitPrice} onChange={e => updateItem(idx, 'unitPrice', +e.target.value)}
                              className="w-full text-right border-0 bg-transparent text-sm focus:ring-0 outline-none" />
                          </td>
                          <td className="px-3 py-1.5 text-right text-slate-700 font-medium">{fmt(it.total, editing.currency)}</td>
                          <td className="px-2 py-1.5">
                            {editing.items.length > 1 && (
                              <button onClick={() => removeItem(idx)} className="p-1 rounded hover:bg-red-50 text-red-400"><X size={14} /></button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-1 text-sm">
                  <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{fmt(formTotals.subtotal, editing.currency)}</span></div>
                  <div className="flex justify-between text-slate-600"><span>VAT (5%)</span><span>{fmt(formTotals.vat, editing.currency)}</span></div>
                  <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200 pt-1"><span>Total</span><span>{fmt(formTotals.total, editing.currency)}</span></div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button onClick={closeForm} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition">Cancel</button>
              <button onClick={saveForm} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition">
                <Save size={14} /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Refund Modal ───────────────────────────────────── */}
      {refundOpen && refundTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <RefreshCw size={18} className="text-emerald-600" /> Record Refund
              </h2>
              <button onClick={() => setRefundOpen(false)} className="p-1 rounded hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Note</span>
                <span className="font-medium text-slate-800">{refundTarget.cnNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total Amount</span>
                <span className="font-medium text-slate-800">{fmt(refundTarget.total, refundTarget.currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Previously Refunded</span>
                <span className="font-medium text-slate-800">{fmt(refundTarget.refundAmount, refundTarget.currency)}</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Refund Amount</label>
                <input type="number" min={0} max={refundTarget.total} step={0.01}
                  value={refundAmt} onChange={e => setRefundAmt(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="0.00" />
                <p className="text-xs text-slate-400 mt-1">
                  Max: {fmt(refundTarget.total, refundTarget.currency)}
                </p>
              </div>
              <div className="text-sm text-slate-600">
                Refund status will be:{' '}
                <span className="font-semibold">
                  {(() => {
                    const a = parseFloat(refundAmt) || 0;
                    if (a <= 0) return 'None';
                    if (a < refundTarget.total) return 'Partial';
                    return 'Full';
                  })()}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button onClick={() => setRefundOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition">Cancel</button>
              <button onClick={saveRefund} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition">
                <Save size={14} /> Save Refund
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
