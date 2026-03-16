import { useState } from 'react';
import {
  X, Save, CreditCard, Building2, Wallet, Smartphone,
  CheckCircle, AlertCircle, DollarSign, Calendar, Hash,
  FileText, User, ChevronDown, ChevronUp, Clock
} from 'lucide-react';

export interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: string;
  reference: string;
  account: string;
  notes: string;
  receivedBy: string;
  status: 'Completed' | 'Processing' | 'Failed';
  createdAt: string;
}

export interface RecordPaymentConfig {
  invoiceId: string;
  partyName: string;
  partyType: 'Agent' | 'Customer' | 'Supplier';
  totalAmount: number;
  paidAmount: number;
  currency: string;
  dueDate?: string;
  existingPayments?: PaymentRecord[];
}

interface Props {
  config: RecordPaymentConfig;
  onClose: () => void;
  onSave: (payment: PaymentRecord, newStatus: 'Paid' | 'Partial' | 'Unpaid') => void;
}

const PAYMENT_METHODS = [
  { value: 'Bank Transfer', label: 'Bank Transfer', icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
  { value: 'Card Payment', label: 'Card Payment', icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-50' },
  { value: 'Cash', label: 'Cash', icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { value: 'Cheque', label: 'Cheque', icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
  { value: 'Online Payment', label: 'Online / Link', icon: Smartphone, color: 'text-pink-600', bg: 'bg-pink-50' },
];

const ACCOUNTS = ['Emirates NBD – Main', 'ADCB – Operations', 'Cash Register', 'Petty Cash', 'FAB – Collections'];
const STAFF = ['Ahmed Al Mansouri', 'Sara Khan', 'Ravi Sharma', 'Emma Wilson', 'Mohammed Ali'];

export default function RecordPaymentModal({ config, onClose, onSave }: Props) {
  const balance = config.totalAmount - config.paidAmount;
  const [showHistory, setShowHistory] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [savedPayment, setSavedPayment] = useState<PaymentRecord | null>(null);

  const [form, setForm] = useState({
    amount: balance > 0 ? String(balance.toFixed(2)) : '',
    method: 'Bank Transfer',
    date: new Date().toISOString().split('T')[0],
    reference: '',
    account: ACCOUNTS[0],
    receivedBy: STAFF[0],
    notes: '',
    status: 'Completed' as 'Completed' | 'Processing' | 'Failed',
  });

  const amountNum = parseFloat(form.amount) || 0;
  const newPaid = config.paidAmount + amountNum;
  const newBalance = config.totalAmount - newPaid;
  const isOverpayment = amountNum > balance + 0.01;
  const isFullPayment = Math.abs(newBalance) < 0.01;
  const isPartial = newPaid < config.totalAmount - 0.01 && amountNum > 0;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleMethodSelect = (method: string) => {
    setForm(prev => ({ ...prev, method }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isOverpayment) return;

    const payment: PaymentRecord = {
      id: `PMT-${Date.now()}`,
      date: form.date,
      amount: amountNum,
      method: form.method,
      reference: form.reference || `REF-${Date.now()}`,
      account: form.account,
      notes: form.notes,
      receivedBy: form.receivedBy,
      status: form.status,
      createdAt: new Date().toISOString(),
    };

    const newStatus: 'Paid' | 'Partial' | 'Unpaid' =
      isFullPayment ? 'Paid' : isPartial ? 'Partial' : 'Unpaid';

    setSavedPayment(payment);
    setSubmitted(true);
    onSave(payment, newStatus);
  };

  const paidPct = Math.min((config.paidAmount / config.totalAmount) * 100, 100);
  const newPaidPct = Math.min((newPaid / config.totalAmount) * 100, 100);

  if (submitted && savedPayment) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-1">Payment Recorded!</h2>
          <p className="text-slate-500 text-sm mb-6">
            {isFullPayment ? '✅ Invoice is now fully paid' : `⏳ Partial payment recorded — AED ${newBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} still outstanding`}
          </p>

          <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2 text-sm mb-6">
            <div className="flex justify-between">
              <span className="text-slate-500">Payment ID</span>
              <span className="font-mono font-medium text-slate-800">{savedPayment.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Amount</span>
              <span className="font-bold text-emerald-700">{config.currency} {savedPayment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Method</span>
              <span className="font-medium">{savedPayment.method}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Reference</span>
              <span className="font-mono text-xs">{savedPayment.reference}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Date</span>
              <span>{savedPayment.date}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full bg-emerald-600 text-white py-2.5 rounded-xl font-medium hover:bg-emerald-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl my-4">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
              <DollarSign size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Record Payment</h2>
              <p className="text-sm text-slate-500">{config.invoiceId} · {config.partyName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Invoice Summary Bar */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
          <div className="grid grid-cols-3 gap-4 text-sm mb-3">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Invoice Total</p>
              <p className="font-bold text-slate-800 text-base">{config.currency} {config.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Already Paid</p>
              <p className="font-bold text-emerald-600 text-base">{config.currency} {config.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Balance Due</p>
              <p className={`font-bold text-base ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {config.currency} {balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative">
            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
              <div className="h-2.5 rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${paidPct}%` }} />
              {amountNum > 0 && !isOverpayment && (
                <div
                  className="h-2.5 rounded-full bg-blue-400 absolute top-0 transition-all duration-300"
                  style={{ left: `${paidPct}%`, width: `${Math.min(newPaidPct - paidPct, 100 - paidPct)}%` }}
                />
              )}
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>{paidPct.toFixed(0)}% paid</span>
              {amountNum > 0 && !isOverpayment && (
                <span className="text-blue-600 font-medium">→ {newPaidPct.toFixed(0)}% after this payment</span>
              )}
            </div>
          </div>

          {/* Due date warning */}
          {config.dueDate && new Date(config.dueDate) < new Date() && (
            <div className="flex items-center gap-2 mt-2 text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">
              <AlertCircle size={12} />
              <span>Overdue since {config.dueDate}</span>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Amount */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Payment Amount ({config.currency}) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">{config.currency}</span>
              <input
                type="number" name="amount" value={form.amount} onChange={handleChange}
                required min="0.01" max={balance + 0.01} step="0.01" placeholder="0.00"
                className={`w-full pl-14 pr-4 py-3 border rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 transition-colors
                  ${isOverpayment
                    ? 'border-red-300 bg-red-50 focus:ring-red-300/30 focus:border-red-400'
                    : isFullPayment && amountNum > 0
                    ? 'border-emerald-400 bg-emerald-50 focus:ring-emerald-300/30 focus:border-emerald-500'
                    : 'border-slate-200 focus:ring-emerald-500/20 focus:border-emerald-500'
                  }`}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              {isOverpayment ? (
                <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle size={11} /> Amount exceeds balance due ({config.currency} {balance.toFixed(2)})</p>
              ) : isFullPayment && amountNum > 0 ? (
                <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle size={11} /> Full payment — invoice will be marked as Paid</p>
              ) : isPartial ? (
                <p className="text-xs text-blue-600 flex items-center gap-1"><Clock size={11} /> Partial payment — {config.currency} {newBalance.toFixed(2)} will remain outstanding</p>
              ) : <span />}
              <button
                type="button"
                onClick={() => setForm(p => ({ ...p, amount: balance.toFixed(2) }))}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Pay full balance
              </button>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Payment Method <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-5 gap-2">
              {PAYMENT_METHODS.map(m => {
                const Icon = m.icon;
                const active = form.method === m.value;
                return (
                  <button
                    key={m.value} type="button"
                    onClick={() => handleMethodSelect(m.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-medium transition-all
                      ${active ? `border-emerald-500 ${m.bg} ${m.color}` : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}
                  >
                    <Icon size={18} className={active ? m.color : 'text-slate-400'} />
                    <span className="text-center leading-tight">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date + Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                <span className="flex items-center gap-1"><Calendar size={13} /> Payment Date <span className="text-red-500">*</span></span>
              </label>
              <input type="date" name="date" value={form.date} onChange={handleChange} required
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                <span className="flex items-center gap-1"><Hash size={13} /> Reference / TXN No.</span>
              </label>
              <input name="reference" value={form.reference} onChange={handleChange}
                placeholder="e.g. TXN-2024-001 or Cheque #"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
            </div>
          </div>

          {/* Account + Received By */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                <span className="flex items-center gap-1"><Building2 size={13} /> Deposit to Account <span className="text-red-500">*</span></span>
              </label>
              <select name="account" value={form.account} onChange={handleChange} required
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                {ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                <span className="flex items-center gap-1"><User size={13} /> Received By <span className="text-red-500">*</span></span>
              </label>
              <select name="receivedBy" value={form.receivedBy} onChange={handleChange} required
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                {STAFF.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Transaction Status</label>
            <div className="flex gap-3">
              {(['Completed', 'Processing', 'Failed'] as const).map(s => (
                <button
                  key={s} type="button"
                  onClick={() => setForm(p => ({ ...p, status: s }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all
                    ${form.status === s
                      ? s === 'Completed' ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : s === 'Processing' ? 'border-amber-400 bg-amber-50 text-amber-700'
                        : 'border-red-400 bg-red-50 text-red-700'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                >
                  {s === 'Completed' ? '✅ ' : s === 'Processing' ? '⏳ ' : '❌ '}{s}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Internal Notes</label>
            <textarea name="notes" value={form.notes} onChange={handleChange} rows={2}
              placeholder="e.g. Paid via SWIFT from HSBC UK, ref #TXN123..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none" />
          </div>

          {/* Payment summary preview */}
          {amountNum > 0 && !isOverpayment && (
            <div className={`rounded-xl p-4 border text-sm space-y-1.5 ${isFullPayment ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200'}`}>
              <p className={`font-semibold text-sm mb-2 ${isFullPayment ? 'text-emerald-800' : 'text-blue-800'}`}>
                {isFullPayment ? '✅ This payment will fully settle the invoice' : '⏳ Partial Payment Summary'}
              </p>
              <div className="flex justify-between text-slate-600">
                <span>This payment</span>
                <span className="font-semibold">{config.currency} {amountNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total paid after</span>
                <span className="font-semibold text-emerald-700">{config.currency} {newPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              {!isFullPayment && (
                <div className="flex justify-between border-t border-blue-200 pt-1.5">
                  <span className="text-slate-700 font-medium">Remaining balance</span>
                  <span className="font-bold text-red-600">{config.currency} {newBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1.5" style={{ borderColor: isFullPayment ? '#a7f3d0' : '#bfdbfe' }}>
                <span className="text-slate-700 font-medium">New Status</span>
                <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${isFullPayment ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {isFullPayment ? 'PAID' : 'PARTIAL'}
                </span>
              </div>
            </div>
          )}

          {/* Payment History Toggle */}
          {config.existingPayments && config.existingPayments.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Clock size={14} className="text-slate-400" />
                  Payment History ({config.existingPayments.length} payments)
                </span>
                {showHistory ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
              </button>
              {showHistory && (
                <div className="border-t border-slate-100 divide-y divide-slate-50">
                  {config.existingPayments.map(p => (
                    <div key={p.id} className="px-4 py-3 flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-slate-700">{config.currency} {p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        <p className="text-xs text-slate-400">{p.method} · {p.date} · {p.receivedBy}</p>
                        {p.reference && <p className="text-xs font-mono text-slate-400">{p.reference}</p>}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' :
                        p.status === 'Processing' ? 'bg-amber-50 text-amber-700' :
                        'bg-red-50 text-red-700'
                      }`}>{p.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 font-medium transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isOverpayment || amountNum <= 0}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm
                ${isOverpayment || amountNum <= 0
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-md'
                }`}
            >
              <Save size={15} />
              {isFullPayment ? 'Record Full Payment' : isPartial ? 'Record Partial Payment' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
