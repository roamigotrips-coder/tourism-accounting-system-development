import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, X, Save, Trash2, Edit2, Eye, Download,
  FileText, DollarSign, Clock, AlertTriangle, CheckCircle,
  CreditCard, Filter, ChevronDown, ChevronUp, Receipt,
  Building2, CalendarDays, Banknote, TrendingDown,
} from 'lucide-react';
import { type Bill, type BillItem, fetchBills, upsertBill, deleteBill } from '../lib/supabaseSync';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';

// ─── Constants ───────────────────────────────────────────────────────────────

const CURRENCIES = ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'INR'];
const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Cheque', 'Online'];
const STATUS_OPTIONS: Bill['status'][] = [
  'Draft', 'Pending Approval', 'Approved', 'Partially Paid', 'Paid', 'Overdue', 'Void',
];

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  'Draft':            { bg: 'bg-gray-100',    text: 'text-gray-600' },
  'Pending Approval': { bg: 'bg-amber-100',   text: 'text-amber-700' },
  'Approved':         { bg: 'bg-blue-100',     text: 'text-blue-700' },
  'Partially Paid':   { bg: 'bg-orange-100',   text: 'text-orange-700' },
  'Paid':             { bg: 'bg-emerald-100',  text: 'text-emerald-700' },
  'Overdue':          { bg: 'bg-red-100',      text: 'text-red-700' },
  'Void':             { bg: 'bg-slate-200',    text: 'text-slate-500' },
};

const today = () => new Date().toISOString().split('T')[0];

// ─── Blank line-item helper ──────────────────────────────────────────────────

function blankItem(billId: string): BillItem {
  return {
    id: crypto.randomUUID(), billId, description: '', accountId: '',
    quantity: 1, unitPrice: 0, taxRate: 5, total: 0,
  };
}

// ─── Form state type ─────────────────────────────────────────────────────────

interface BillForm {
  id: string;
  billNumber: string;
  vendor: string;
  vendorBillRef: string;
  date: string;
  dueDate: string;
  currency: string;
  purchaseOrderId: string;
  notes: string;
  items: BillItem[];
}

function emptyForm(billNumber: string): BillForm {
  const id = crypto.randomUUID();
  return {
    id, billNumber, vendor: '', vendorBillRef: '', date: today(),
    dueDate: '', currency: 'AED', purchaseOrderId: '', notes: '',
    items: [blankItem(id)],
  };
}

// ─── Payment form state ──────────────────────────────────────────────────────

interface PaymentForm {
  amount: string;
  date: string;
  method: string;
  reference: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcLineTotal(item: BillItem) {
  return item.quantity * item.unitPrice;
}

function calcSubtotal(items: BillItem[]) {
  return items.reduce((s, i) => s + calcLineTotal(i), 0);
}

function calcVAT(items: BillItem[]) {
  return items.reduce((s, i) => s + (calcLineTotal(i) * i.taxRate / 100), 0);
}

function nextBillNumber(bills: Bill[]): string {
  const nums = bills
    .map(b => parseInt(b.billNumber.replace('BILL-', ''), 10))
    .filter(n => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `BILL-${String(max + 1).padStart(4, '0')}`;
}

function fmt(n: number, cur: string) {
  return `${cur} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Status badge component ─────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_BADGE[status] ?? STATUS_BADGE['Draft'];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${c.bg} ${c.text}`}>
      {status}
    </span>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function Bills() {
  // ─── Data state ──────────────────────────────────────────────────────────
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── UI state ────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [vendorFilter, setVendorFilter] = useState<string>('All');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BillForm>(emptyForm('BILL-0001'));
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ─── Payment modal state ─────────────────────────────────────────────────
  const [payBill, setPayBill] = useState<Bill | null>(null);
  const [payForm, setPayForm] = useState<PaymentForm>({ amount: '', date: today(), method: 'Bank Transfer', reference: '' });

  // ─── Load bills ──────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    setError(null);
    const data = await fetchBills();
    if (!data) { setError('Failed to load bills'); setLoading(false); return; }
    // Auto-detect overdue
    const todayStr = today();
    const updated = data.map(b => {
      if (b.dueDate < todayStr && b.amountPaid < b.total &&
          !['Paid', 'Void', 'Draft'].includes(b.status)) {
        return { ...b, status: 'Overdue' as const };
      }
      return b;
    });
    setBills(updated);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ─── Derived data ────────────────────────────────────────────────────────
  const vendors = useMemo(() => {
    const set = new Set(bills.map(b => b.vendor).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [bills]);

  const filtered = useMemo(() => {
    return bills.filter(b => {
      if (statusFilter !== 'All' && b.status !== statusFilter) return false;
      if (vendorFilter !== 'All' && b.vendor !== vendorFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!b.billNumber.toLowerCase().includes(q) &&
            !b.vendor.toLowerCase().includes(q) &&
            !(b.vendorBillRef ?? '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [bills, statusFilter, vendorFilter, search]);

  const stats = useMemo(() => {
    const totalBills = bills.length;
    const pending = bills.filter(b => b.status === 'Pending Approval').length;
    const overdueAmt = bills.filter(b => b.status === 'Overdue').reduce((s, b) => s + (b.total - b.amountPaid), 0);
    const payable = bills.filter(b => !['Paid', 'Void'].includes(b.status)).reduce((s, b) => s + (b.total - b.amountPaid), 0);
    return { totalBills, pending, overdueAmt, payable };
  }, [bills]);

  // ─── Form helpers ────────────────────────────────────────────────────────
  const openNew = () => {
    const num = nextBillNumber(bills);
    setForm(emptyForm(num));
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (b: Bill) => {
    setForm({
      id: b.id, billNumber: b.billNumber, vendor: b.vendor,
      vendorBillRef: b.vendorBillRef ?? '', date: b.date,
      dueDate: b.dueDate, currency: b.currency,
      purchaseOrderId: b.purchaseOrderId ?? '', notes: b.notes ?? '',
      items: b.items.length ? b.items : [blankItem(b.id)],
    });
    setEditingId(b.id);
    setShowForm(true);
  };

  const updateItem = (idx: number, patch: Partial<BillItem>) => {
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], ...patch };
      items[idx].total = calcLineTotal(items[idx]);
      return { ...f, items };
    });
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, blankItem(f.id)] }));
  const removeItem = (idx: number) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const formSubtotal = calcSubtotal(form.items);
  const formVAT = calcVAT(form.items);
  const formTotal = formSubtotal + formVAT;

  const saveBill = async () => {
    if (!form.vendor.trim() || !form.dueDate) return;
    const existing = editingId ? bills.find(b => b.id === editingId) : null;
    const bill: Bill = {
      id: form.id,
      billNumber: form.billNumber,
      vendor: form.vendor.trim(),
      vendorBillRef: form.vendorBillRef || undefined,
      date: form.date,
      dueDate: form.dueDate,
      status: existing?.status ?? 'Draft',
      subtotal: formSubtotal,
      vat: formVAT,
      total: formTotal,
      currency: form.currency,
      amountPaid: existing?.amountPaid ?? 0,
      purchaseOrderId: form.purchaseOrderId || undefined,
      recurring: false,
      notes: form.notes || undefined,
      items: form.items.map(i => ({ ...i, total: calcLineTotal(i) })),
    };
    await upsertBill(bill);
    setShowForm(false);
    await load();
  };

  const removeBill = async (id: string) => {
    if (!confirm('Delete this bill?')) return;
    await deleteBill(id);
    await load();
  };

  const voidBill = async (b: Bill) => {
    await upsertBill({ ...b, status: 'Void' });
    await load();
  };

  const approveBill = async (b: Bill) => {
    await upsertBill({ ...b, status: 'Approved' });
    await load();
  };

  // ─── Payment helpers ─────────────────────────────────────────────────────
  const openPayment = (b: Bill) => {
    const balance = b.total - b.amountPaid;
    setPayBill(b);
    setPayForm({ amount: balance.toFixed(2), date: today(), method: 'Bank Transfer', reference: '' });
  };

  const submitPayment = async () => {
    if (!payBill) return;
    const amt = parseFloat(payForm.amount);
    if (isNaN(amt) || amt <= 0) return;
    const newPaid = Math.min(payBill.amountPaid + amt, payBill.total);
    const newStatus: Bill['status'] = newPaid >= payBill.total ? 'Paid' : 'Partially Paid';
    await upsertBill({ ...payBill, amountPaid: newPaid, status: newStatus });
    setPayBill(null);
    await load();
  };

  // ─── CSV export ──────────────────────────────────────────────────────────
  const exportCSV = () => {
    const header = 'Bill #,Vendor,Vendor Ref,Date,Due Date,Status,Total,Paid,Balance,Currency\n';
    const rows = filtered.map(b =>
      `${b.billNumber},${b.vendor},${b.vendorBillRef ?? ''},${b.date},${b.dueDate},${b.status},${b.total},${b.amountPaid},${b.total - b.amountPaid},${b.currency}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bills-${today()}.csv`;
    a.click();
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Receipt size={24} className="text-emerald-600" /> Vendor Bills
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage vendor bills, payments and purchase invoices</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600">
            <Download size={14} /> Export
          </button>
          <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium">
            <Plus size={14} /> New Bill
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Bills', value: stats.totalBills, icon: <FileText size={18} />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Pending Approval', value: stats.pending, icon: <Clock size={18} />, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Overdue Amount', value: fmt(stats.overdueAmt, 'AED'), icon: <AlertTriangle size={18} />, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Total Payable', value: fmt(stats.payable, 'AED'), icon: <TrendingDown size={18} />, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center ${c.color}`}>{c.icon}</div>
            <div>
              <p className="text-xs text-slate-500">{c.label}</p>
              <p className="text-lg font-bold text-slate-800">{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bills..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter size={13} className="text-slate-400" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-2 py-2 focus:ring-2 focus:ring-emerald-500">
            <option value="All">All Status</option>
            {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <select value={vendorFilter} onChange={e => setVendorFilter(e.target.value)}
          className="text-sm border border-slate-300 rounded-lg px-2 py-2 focus:ring-2 focus:ring-emerald-500">
          {vendors.map(v => <option key={v} value={v}>{v === 'All' ? 'All Vendors' : v}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3">Bill #</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Vendor Ref</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400">No bills found</td></tr>
              )}
              {filtered.map(b => {
                const balance = b.total - b.amountPaid;
                const isExpanded = expandedId === b.id;
                return (
                  <tr key={b.id} className="hover:bg-slate-50/60 group">
                    <td className="px-4 py-3 font-medium text-emerald-700 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : b.id)}>
                      <span className="flex items-center gap-1">
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {b.billNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{b.vendor}</td>
                    <td className="px-4 py-3 text-slate-500">{b.vendorBillRef ?? '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{b.date}</td>
                    <td className="px-4 py-3 text-slate-600">{b.dueDate}</td>
                    <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">{fmt(b.total, b.currency)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{fmt(b.amountPaid, b.currency)}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">{fmt(balance, b.currency)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(b)} title="Edit" className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-emerald-600">
                          <Edit2 size={14} />
                        </button>
                        {balance > 0 && b.status !== 'Void' && b.status !== 'Draft' && (
                          <button onClick={() => openPayment(b)} title="Record Payment" className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600">
                            <Banknote size={14} />
                          </button>
                        )}
                        {b.status === 'Pending Approval' && (
                          <button onClick={() => approveBill(b)} title="Approve" className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-emerald-600">
                            <CheckCircle size={14} />
                          </button>
                        )}
                        {b.status !== 'Void' && b.status !== 'Paid' && (
                          <button onClick={() => voidBill(b)} title="Void" className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-orange-500">
                            <X size={14} />
                          </button>
                        )}
                        <button onClick={() => removeBill(b.id)} title="Delete" className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Expanded row detail */}
        {expandedId && (() => {
          const b = bills.find(x => x.id === expandedId);
          if (!b) return null;
          return (
            <div className="border-t border-slate-200 bg-slate-50/50 px-6 py-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div><span className="text-slate-400">PO Reference</span><p className="font-medium text-slate-700">{b.purchaseOrderId || '-'}</p></div>
                <div><span className="text-slate-400">Currency</span><p className="font-medium text-slate-700">{b.currency}</p></div>
                <div><span className="text-slate-400">Subtotal</span><p className="font-medium text-slate-700">{fmt(b.subtotal, b.currency)}</p></div>
                <div><span className="text-slate-400">VAT</span><p className="font-medium text-slate-700">{fmt(b.vat, b.currency)}</p></div>
              </div>
              {b.notes && <p className="text-xs text-slate-500 italic">{b.notes}</p>}
              {b.items.length > 0 && (
                <table className="w-full text-xs mt-2">
                  <thead><tr className="text-slate-400 border-b border-slate-200">
                    <th className="text-left py-1 pr-2">Description</th>
                    <th className="text-left py-1 pr-2">Account</th>
                    <th className="text-right py-1 pr-2">Qty</th>
                    <th className="text-right py-1 pr-2">Unit Price</th>
                    <th className="text-right py-1 pr-2">Tax %</th>
                    <th className="text-right py-1">Total</th>
                  </tr></thead>
                  <tbody>
                    {b.items.map(i => (
                      <tr key={i.id} className="border-b border-slate-100">
                        <td className="py-1 pr-2 text-slate-700">{i.description}</td>
                        <td className="py-1 pr-2 text-slate-500">{i.accountId || '-'}</td>
                        <td className="py-1 pr-2 text-right">{i.quantity}</td>
                        <td className="py-1 pr-2 text-right">{i.unitPrice.toFixed(2)}</td>
                        <td className="py-1 pr-2 text-right">{i.taxRate}%</td>
                        <td className="py-1 text-right font-medium">{(i.quantity * i.unitPrice).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })()}
      </div>

      {/* ═══ Bill Form Modal ═══ */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Receipt size={18} className="text-emerald-600" />
                {editingId ? 'Edit Bill' : 'New Vendor Bill'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18} /></button>
            </div>

            <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Top fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Bill Number</label>
                  <input value={form.billNumber} readOnly className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Vendor <span className="text-red-400">*</span></label>
                  <input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="Vendor name" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Vendor Bill Reference</label>
                  <input value={form.vendorBillRef} onChange={e => setForm(f => ({ ...f, vendorBillRef: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="e.g. INV-2024-123" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Due Date <span className="text-red-400">*</span></label>
                  <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Currency</label>
                  <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">PO Reference</label>
                  <input value={form.purchaseOrderId} onChange={e => setForm(f => ({ ...f, purchaseOrderId: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="PO-0001 (optional)" />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-700">Line Items</h3>
                  <button onClick={addItem} className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                    <Plus size={12} /> Add Line
                  </button>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs text-slate-500 font-semibold">
                        <th className="px-3 py-2 text-left">Description</th>
                        <th className="px-3 py-2 text-left w-[120px]">Account</th>
                        <th className="px-3 py-2 text-right w-[70px]">Qty</th>
                        <th className="px-3 py-2 text-right w-[100px]">Unit Price</th>
                        <th className="px-3 py-2 text-right w-[70px]">Tax %</th>
                        <th className="px-3 py-2 text-right w-[90px]">Total</th>
                        <th className="px-3 py-2 w-[40px]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {form.items.map((item, idx) => (
                        <tr key={item.id}>
                          <td className="px-2 py-1">
                            <input value={item.description} onChange={e => updateItem(idx, { description: e.target.value })}
                              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500" placeholder="Description" />
                          </td>
                          <td className="px-2 py-1">
                            <input value={item.accountId ?? ''} onChange={e => updateItem(idx, { accountId: e.target.value })}
                              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500" placeholder="Account" />
                          </td>
                          <td className="px-2 py-1">
                            <input type="number" min={0} value={item.quantity} onChange={e => updateItem(idx, { quantity: +e.target.value })}
                              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded text-right focus:ring-1 focus:ring-emerald-500" />
                          </td>
                          <td className="px-2 py-1">
                            <input type="number" min={0} step="0.01" value={item.unitPrice} onChange={e => updateItem(idx, { unitPrice: +e.target.value })}
                              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded text-right focus:ring-1 focus:ring-emerald-500" />
                          </td>
                          <td className="px-2 py-1">
                            <input type="number" min={0} max={100} value={item.taxRate} onChange={e => updateItem(idx, { taxRate: +e.target.value })}
                              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded text-right focus:ring-1 focus:ring-emerald-500" />
                          </td>
                          <td className="px-2 py-1 text-right text-sm font-medium text-slate-700">
                            {calcLineTotal(item).toFixed(2)}
                          </td>
                          <td className="px-2 py-1 text-center">
                            {form.items.length > 1 && (
                              <button onClick={() => removeItem(idx)} className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500">
                                <Trash2 size={13} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="flex justify-end mt-3">
                  <div className="w-64 space-y-1 text-sm">
                    <div className="flex justify-between text-slate-500">
                      <span>Subtotal</span><span>{fmt(formSubtotal, form.currency)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>VAT (5%)</span><span>{fmt(formVAT, form.currency)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200 pt-1">
                      <span>Total</span><span>{fmt(formTotal, form.currency)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="Internal notes..." />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-600">Cancel</button>
              <button onClick={saveBill} className="flex items-center gap-1.5 px-5 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium">
                <Save size={14} /> {editingId ? 'Update Bill' : 'Create Bill'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Payment Modal ═══ */}
      {payBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <CreditCard size={18} className="text-blue-600" /> Record Payment
              </h2>
              <button onClick={() => setPayBill(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <p className="text-blue-800 font-medium">{payBill.billNumber} — {payBill.vendor}</p>
                <p className="text-blue-600 text-xs mt-1">
                  Total: {fmt(payBill.total, payBill.currency)} | Paid: {fmt(payBill.amountPaid, payBill.currency)} | Balance: {fmt(payBill.total - payBill.amountPaid, payBill.currency)}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Amount</label>
                <input type="number" min={0} step="0.01" value={payForm.amount}
                  onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Payment Date</label>
                <input type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Method</label>
                <select value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Reference</label>
                <input value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Cheque no. / Txn ID" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button onClick={() => setPayBill(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-600">Cancel</button>
              <button onClick={submitPayment} className="flex items-center gap-1.5 px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                <DollarSign size={14} /> Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
