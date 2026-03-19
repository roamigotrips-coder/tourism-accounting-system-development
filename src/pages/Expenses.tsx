import { useState, useEffect } from 'react';
import {
  Plus, Search, X, Save, Eye, Paperclip,
  Clock, CheckCircle, AlertCircle, ShieldCheck,
  Lock, ArrowRight, FileText, RefreshCw, Info,
  ChevronDown, ChevronUp, Send, Ban,
} from 'lucide-react';
import { fetchExpenses, upsertExpense } from '../lib/supabaseSync';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import AttachmentPanel from '../components/AttachmentPanel';
import { useAttachments } from '../context/AttachmentsContext';
import { useApproval } from '../context/ApprovalContext';
import type { ApprovalItem } from '../context/ApprovalContext';
import { routeApproval, getCFOThreshold, getWorkflowSteps } from '../utils/approvalThresholds';
import { catchAndReport } from '../lib/toast';

const categories = ['All', 'Fuel', 'Driver Salary', 'Hotel Payment', 'Activity Tickets', 'Office Rent', 'Marketing'];
const paymentModes = ['Cash', 'Bank Transfer', 'Credit Card', 'Cheque', 'Online'];
const supplierOptions = ['Desert Safari Adventures', 'Luxury Hotels Group', 'Gulf Transport Co.', 'Office Landlord', 'Media Agency', 'Internal', 'Other'];
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

interface ExpenseForm {
  category: string; supplier: string; description: string;
  amount: string; paymentMode: string; date: string; status: string;
}
interface ExpenseItem {
  id: string; category: string; supplier: string; description: string;
  amount: number; paymentMode: string; date?: string; status: 'Paid' | 'Pending';
}

const emptyForm: ExpenseForm = {
  category: 'Fuel', supplier: '', description: '', amount: '',
  paymentMode: 'Cash', date: new Date().toISOString().split('T')[0], status: 'Pending',
};

// ─── Approval Status Badge ────────────────────────────────────────────────────
function ApprovalBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    'Not Submitted': { bg: 'bg-slate-100', text: 'text-slate-500', icon: <Clock size={10} /> },
    'Draft':         { bg: 'bg-slate-100', text: 'text-slate-500', icon: <FileText size={10} /> },
    'Submitted':     { bg: 'bg-blue-50',   text: 'text-blue-700',  icon: <Send size={10} /> },
    'Under Review':  { bg: 'bg-amber-50',  text: 'text-amber-700', icon: <RefreshCw size={10} /> },
    'Approved':      { bg: 'bg-emerald-50',text: 'text-emerald-700',icon: <CheckCircle size={10} /> },
    'Rejected':      { bg: 'bg-red-50',    text: 'text-red-700',   icon: <Ban size={10} /> },
    'Correction Requested': { bg: 'bg-orange-50', text: 'text-orange-700', icon: <AlertCircle size={10} /> },
    'Posted':        { bg: 'bg-violet-50', text: 'text-violet-700',icon: <ShieldCheck size={10} /> },
  };
  const c = cfg[status] ?? cfg['Not Submitted'];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${c.bg} ${c.text}`}>
      {c.icon}{status}
    </span>
  );
}

// ─── Workflow Timeline ────────────────────────────────────────────────────────
function WorkflowTimeline({ approval, amount }: { approval: ApprovalItem | undefined; amount: number }) {
  const routing = routeApproval(amount, 'Expense');
  const steps = getWorkflowSteps(routing);
  const currentStatus = approval?.status ?? 'Not Submitted';

  const getStepState = (stepRole: string): 'done' | 'active' | 'pending' => {
    if (currentStatus === 'Posted') return 'done';
    if (currentStatus === 'Accounting Posting' && stepRole === 'accountant') return 'active';
    if (currentStatus === 'Finance Approval' && stepRole === 'finance_director') return 'active';
    if (currentStatus === 'Finance Approval') return stepRole === 'cfo' || stepRole === 'finance_manager' ? 'done' : 'pending';
    if (currentStatus === 'Manager Approval' && (stepRole === 'cfo' || stepRole === 'finance_manager')) return 'active';
    if (currentStatus === 'Submitted' && stepRole === 'reviewer') return 'active';
    if ((currentStatus === 'Draft' || currentStatus === 'Not Submitted') && stepRole === 'maker') return 'active';
    if (stepRole === 'maker') return 'done';
    return 'pending';
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {steps.map((s, i) => {
        const state = getStepState(s.role);
        return (
          <div key={s.step} className="flex items-center gap-1">
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              state === 'done' ? 'bg-emerald-100 text-emerald-700' :
              state === 'active' ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-400' :
              'bg-slate-100 text-slate-400'
            }`}>
              {state === 'done' ? <CheckCircle size={9} /> : state === 'active' ? <Clock size={9} /> : <Lock size={9} />}
              {s.label}
            </div>
            {i < steps.length - 1 && <ArrowRight size={8} className="text-slate-300" />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Approval Panel (expanded view) ──────────────────────────────────────────
function ApprovalPanel({ exp, approval, onSubmit, onPostGL, canPost }: {
  exp: ExpenseItem;
  approval: ApprovalItem | undefined;
  onSubmit: () => void;
  onPostGL: () => void;
  canPost: boolean;
}) {
  const routing = routeApproval(exp.amount, 'Expense');
  const cfoThreshold = getCFOThreshold();
  const needsCFO = exp.amount >= cfoThreshold;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-violet-600" />
          <span className="font-semibold text-slate-800 text-sm">Approval Status</span>
        </div>
        <ApprovalBadge status={approval?.status ?? 'Not Submitted'} />
      </div>

      {/* Threshold Rule */}
      <div className={`rounded-lg px-3 py-2.5 border text-xs ${needsCFO ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
        <div className="flex items-start gap-2">
          <Info size={12} className={`mt-0.5 ${needsCFO ? 'text-red-500' : 'text-blue-500'}`} />
          <div>
            <p className={`font-semibold ${needsCFO ? 'text-red-700' : 'text-blue-700'}`}>
              {needsCFO
                ? `🔴 CFO Approval Required (AED ${exp.amount.toLocaleString()} ≥ AED ${cfoThreshold.toLocaleString()})`
                : `🟢 Finance Manager Approval (AED ${exp.amount.toLocaleString()} < AED ${cfoThreshold.toLocaleString()})`}
            </p>
            <p className={`mt-0.5 ${needsCFO ? 'text-red-600' : 'text-blue-600'}`}>
              Assigned to: <strong>{routing.primaryLabel}</strong>
              {routing.requiresSecondApproval && ` → Finance Director (second approval)`}
            </p>
          </div>
        </div>
      </div>

      {/* Workflow */}
      <div>
        <p className="text-xs text-slate-500 mb-1.5 font-medium">WORKFLOW</p>
        <WorkflowTimeline approval={approval} amount={exp.amount} />
      </div>

      {/* History */}
      {approval && approval.history.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-500 font-medium">HISTORY</p>
          {approval.history.slice(-4).map((h, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
              <div>
                <span className="font-medium text-slate-700">{h.action}</span>
                <span className="text-slate-400"> · {h.performedBy} · {new Date(h.timestamp).toLocaleString()}</span>
                {h.notes && <p className="text-slate-500 italic mt-0.5">{h.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rejection / Correction Note */}
      {approval?.status === 'Rejected' && approval.rejectionReason && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
          <p className="font-semibold mb-0.5">❌ Rejected:</p>
          <p>{approval.rejectionReason}</p>
        </div>
      )}
      {approval?.status === 'Correction Requested' && approval.correctionNote && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-700">
          <p className="font-semibold mb-0.5">⚠️ Correction Required:</p>
          <p>{approval.correctionNote}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {!approval && (
          <button onClick={onSubmit}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-xs font-semibold">
            <Send size={12} /> Submit for Approval
          </button>
        )}
        {approval && approval.status === 'Correction Requested' && (
          <button onClick={onSubmit}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-orange-600 text-white hover:bg-orange-700 rounded-lg text-xs font-semibold">
            <RefreshCw size={12} /> Resubmit
          </button>
        )}
        {approval && approval.status !== 'Posted' && (
          <button
            onClick={onPostGL}
            disabled={!canPost}
            title={!canPost ? `Awaiting ${routing.primaryLabel} approval before GL posting` : 'Post to General Ledger'}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
              canPost
                ? 'bg-violet-600 text-white hover:bg-violet-700'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}>
            {canPost ? <CheckCircle size={12} /> : <Lock size={12} />}
            {canPost ? 'Post to GL' : `🔒 Awaiting ${routing.primaryLabel}`}
          </button>
        )}
        {approval?.status === 'Posted' && (
          <div className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-violet-50 text-violet-700 rounded-lg text-xs font-semibold">
            <ShieldCheck size={12} /> Posted to GL {approval.glEntryRef && `· ${approval.glEntryRef}`}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── View Expense Modal ───────────────────────────────────────────────────────
function ViewExpenseModal({
  exp, approval, onClose, onSubmit, onPostGL, canPost,
}: {
  exp: ExpenseItem;
  approval: ApprovalItem | undefined;
  onClose: () => void;
  onSubmit: () => void;
  onPostGL: () => void;
  canPost: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-orange-600 to-orange-700 rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-white">{exp.id}</h2>
            <p className="text-orange-100 text-sm">{exp.category} · {exp.date || '—'}</p>
          </div>
          <div className="flex items-center gap-2">
            <ApprovalBadge status={approval?.status ?? 'Not Submitted'} />
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg text-white"><X size={20} /></button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Category', value: exp.category },
              { label: 'Supplier', value: exp.supplier || '—' },
              { label: 'Payment Mode', value: exp.paymentMode },
              { label: 'Payment Status', value: exp.status },
              { label: 'Date', value: exp.date || '—' },
              { label: 'Amount', value: `AED ${exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            ].map(f => (
              <div key={f.label} className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-400 mb-0.5">{f.label}</p>
                <p className="font-semibold text-slate-800 text-sm">{f.value}</p>
              </div>
            ))}
          </div>

          {exp.description && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <p className="text-xs text-amber-500 font-bold uppercase mb-1">Description</p>
              <p className="text-sm text-slate-700">{exp.description}</p>
            </div>
          )}

          {/* Approval Panel */}
          <ApprovalPanel
            exp={exp} approval={approval}
            onSubmit={onSubmit} onPostGL={onPostGL} canPost={canPost}
          />

          {/* Attachments */}
          <AttachmentPanel module="expense" documentId={exp.id} title="Expense Attachments" allowEmailIn />
        </div>

        <div className="flex justify-end p-5 border-t border-slate-100">
          <button onClick={onClose} className="px-5 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Expense Modal ────────────────────────────────────────────────────────
function AddExpenseModal({ onClose, onSave }: { onClose: () => void; onSave: (exp: ExpenseItem) => void }) {
  const [form, setForm] = useState<ExpenseForm>(emptyForm);
  const [savedId, setSavedId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const cfoThreshold = getCFOThreshold();
  const amount = parseFloat(form.amount) || 0;
  const routing = routeApproval(amount, 'Expense');
  const needsCFO = amount >= cfoThreshold;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.category) e.category = 'Required';
    if (!form.description.trim()) e.description = 'Required';
    if (!form.amount || parseFloat(form.amount) <= 0) e.amount = 'Must be > 0';
    if (!form.date) e.date = 'Required';
    return e;
  };

  const handleSubmit = (evt: React.FormEvent) => {
    evt.preventDefault();
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    const newExp: ExpenseItem = {
      id: `EXP-${Date.now().toString().slice(-5)}`,
      category: form.category, supplier: form.supplier,
      description: form.description, amount: parseFloat(form.amount) || 0,
      paymentMode: form.paymentMode, date: form.date,
      status: form.status as 'Paid' | 'Pending',
    };
    onSave(newExp);
    setSavedId(newExp.id);
  };

  const fieldCls = (name: string) =>
    `w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 ${errors[name] ? 'border-red-400 bg-red-50' : 'border-slate-200'}`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Add Expense</h2>
            <p className="text-sm text-slate-500 mt-0.5">Record a new operational expense</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={20} /></button>
        </div>

        {!savedId ? (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category <span className="text-red-500">*</span></label>
                <select name="category" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  className={fieldCls('category')}>
                  {categories.slice(1).map(c => <option key={c}>{c}</option>)}
                </select>
                {errors.category && <p className="text-xs text-red-500 mt-0.5">{errors.category}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Supplier / Vendor</label>
                <select value={form.supplier} onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))}
                  className={fieldCls('supplier')}>
                  <option value="">Select Supplier</option>
                  {supplierOptions.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Description <span className="text-red-500">*</span></label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. Fuel for vehicle DXB-A-12345" className={fieldCls('description')} />
                {errors.description && <p className="text-xs text-red-500 mt-0.5">{errors.description}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (AED) <span className="text-red-500">*</span></label>
                <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                  min="0" step="0.01" placeholder="0.00" className={fieldCls('amount')} />
                {errors.amount && <p className="text-xs text-red-500 mt-0.5">{errors.amount}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date <span className="text-red-500">*</span></label>
                <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  className={fieldCls('date')} />
                {errors.date && <p className="text-xs text-red-500 mt-0.5">{errors.date}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Mode</label>
                <select value={form.paymentMode} onChange={e => setForm(p => ({ ...p, paymentMode: e.target.value }))}
                  className={fieldCls('paymentMode')}>
                  {paymentModes.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                  className={fieldCls('status')}>
                  <option>Pending</option>
                  <option>Paid</option>
                </select>
              </div>
            </div>

            {/* Live Approval Preview */}
            {amount > 0 && (
              <div className={`rounded-xl border p-3 text-xs ${needsCFO ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <ShieldCheck size={13} className={needsCFO ? 'text-red-600' : 'text-blue-600'} />
                  <span className={`font-semibold ${needsCFO ? 'text-red-700' : 'text-blue-700'}`}>
                    {needsCFO ? '🔴 CFO Approval Required' : '🟢 Finance Manager Approval'}
                  </span>
                </div>
                <p className={needsCFO ? 'text-red-600' : 'text-blue-600'}>
                  AED {amount.toLocaleString()} {needsCFO ? `≥` : `<`} AED {cfoThreshold.toLocaleString()} threshold → <strong>{routing.primaryLabel}</strong>
                  {routing.requiresSecondApproval && ' + Finance Director second approval'}
                </p>
                <p className="text-slate-400 mt-1">
                  Workflow: Maker → Reviewer → {routing.primaryLabel}{routing.requiresSecondApproval ? ' → Finance Director' : ''} → Post GL
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={onClose}
                className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="submit"
                className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 font-medium">
                <Save size={16} /> Save & Submit for Approval
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <CheckCircle size={20} className="text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Expense <strong>{savedId}</strong> saved & submitted for approval!</p>
                <p className="text-xs text-emerald-600 mt-0.5">An approval request has been created. Finance team will review shortly.</p>
              </div>
            </div>
            <div className={`rounded-xl border p-3 text-xs ${parseFloat(form.amount) >= cfoThreshold ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
              <p className="font-semibold">Assigned to: {routeApproval(parseFloat(form.amount) || 0, 'Expense').primaryLabel}</p>
              <p className="mt-0.5">Workflow: Maker → Reviewer → {routeApproval(parseFloat(form.amount) || 0, 'Expense').primaryLabel} → Post GL</p>
            </div>
            <AttachmentPanel module="expense" documentId={savedId} title="Attach Receipt / Bills" allowEmailIn />
            <div className="flex justify-end">
              <button onClick={onClose} className="px-5 py-2.5 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 font-medium">Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Expenses() {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [viewExp, setViewExp] = useState<ExpenseItem | null>(null);
  const [expandedApproval, setExpandedApproval] = useState<string | null>(null);
  const [expenseList, setExpenseList] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const { getByDocument } = useAttachments();
  const { ensureApprovalRequest, getByRef, canPostByRef, postToGL } = useApproval();
  const cfoThreshold = getCFOThreshold();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchExpenses();
        if (!cancelled && data) setExpenseList(data as ExpenseItem[]);
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const submitExpenseForApproval = (exp: ExpenseItem) => {
    const routing = routeApproval(exp.amount, 'Expense');
    ensureApprovalRequest({
      refNumber: exp.id,
      type: 'Expense',
      title: `Expense — ${exp.category}`,
      description: exp.description,
      amount: exp.amount,
      currency: 'AED',
      submittedBy: 'Operations User',
      submittedAt: new Date().toISOString(),
      submittedByDept: 'Operations',
      priority: exp.amount >= cfoThreshold ? 'High' : 'Normal',
      dueDate: exp.date,
      party: exp.supplier || 'Internal',
      partyType: 'Supplier',
      category: exp.category,
      notes: exp.description,
      sourceData: exp as unknown as Record<string, unknown>,
    });
    showToast(`Expense ${exp.id} submitted for ${routing.primaryLabel} approval.`);
  };

  const postExpenseToGL = (exp: ExpenseItem) => {
    const request = getByRef(exp.id, 'Expense');
    if (!request) {
      showToast('Submit for approval first.', 'error');
      return;
    }
    if (!canPostByRef(exp.id, 'Expense')) {
      const routing = routeApproval(exp.amount, 'Expense');
      showToast(`❌ Cannot post — awaiting ${routing.primaryLabel} approval.`, 'error');
      return;
    }
    if (request.status === 'Posted') {
      showToast('Already posted to GL.', 'success');
      return;
    }
    postToGL(request.id, 'Finance User');
    showToast(`✅ Expense ${exp.id} posted to GL successfully.`);
  };

  const filtered = expenseList.filter(e =>
    (filter === 'All' || e.category === filter) &&
    (e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.supplier.toLowerCase().includes(search.toLowerCase()))
  );

  const totalExpenses = filtered.reduce((s, e) => s + e.amount, 0);
  const paidExpenses = filtered.filter(e => e.status === 'Paid').reduce((s, e) => s + e.amount, 0);
  const pendingApproval = expenseList.filter(e => {
    const a = getByRef(e.id, 'Expense');
    return a && ['Submitted', 'Under Review'].includes(a.status);
  }).length;
  const needsCFOCount = expenseList.filter(e => e.amount >= cfoThreshold).length;

  const categoryData = categories.slice(1).map(cat => ({
    name: cat,
    value: expenseList.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter(c => c.value > 0);

  if (loading) return <LoadingSpinner message="Loading expenses..." />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="space-y-6 relative">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl border text-sm font-medium ${
          toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-red-600 text-white border-red-700'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Expense Management</h1>
          <p className="text-slate-500 mt-1">Track operational costs · Maker-Checker approval workflow</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2.5 rounded-lg hover:bg-orange-700 text-sm font-medium">
          <Plus size={16} /> Add Expense
        </button>
      </div>

      {/* CFO Threshold Banner */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl px-5 py-3 flex flex-wrap items-center gap-4">
        <ShieldCheck size={18} className="text-violet-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-violet-800">Maker-Checker Approval Active</p>
          <p className="text-xs text-violet-600 mt-0.5">
            Expenses &lt; AED {cfoThreshold.toLocaleString()} → Finance Manager · ≥ AED {cfoThreshold.toLocaleString()} → CFO approval required.
            <span className="ml-1 text-violet-400">GL posting blocked until approved.</span>
          </p>
        </div>
        <div className="flex gap-3 text-xs">
          {pendingApproval > 0 && (
            <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full font-medium">
              <Clock size={11} /> {pendingApproval} Pending
            </span>
          )}
          {needsCFOCount > 0 && (
            <span className="flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-full font-medium">
              <ShieldCheck size={11} /> {needsCFOCount} Need CFO
            </span>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Expenses', value: `AED ${totalExpenses.toLocaleString()}`, color: 'text-slate-800', bg: 'bg-white' },
          { label: 'Paid', value: `AED ${paidExpenses.toLocaleString()}`, color: 'text-emerald-600', bg: 'bg-white' },
          { label: 'Pending', value: `AED ${(totalExpenses - paidExpenses).toLocaleString()}`, color: 'text-amber-600', bg: 'bg-white' },
          { label: 'Awaiting Approval', value: pendingApproval, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-5 shadow-sm border border-slate-100`}>
            <p className="text-xs text-slate-500 uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search expenses..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none" />
            </div>
            <select value={filter} onChange={e => setFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">ID</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Description</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Amount</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">Approver</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">Approval</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No expenses found.</td></tr>
                )}
                {filtered.map(e => {
                  const attCount = getByDocument('expense', e.id).length;
                  const approval = getByRef(e.id, 'Expense');
                  const approvalStatus = approval?.status ?? 'Not Submitted';
                  const canPost = canPostByRef(e.id, 'Expense');
                  const needsCFO = e.amount >= cfoThreshold;
                  const routing = routeApproval(e.amount, 'Expense');
                  const isExpanded = expandedApproval === e.id;

                  return (
                    <>
                      <tr key={e.id} className={`border-t border-slate-50 hover:bg-slate-50/50 ${approvalStatus === 'Posted' ? 'bg-violet-50/30' : ''}`}>
                        <td className="px-4 py-3 font-medium text-slate-600">{e.id}</td>
                        <td className="px-4 py-3">
                          <div>
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-medium">{e.category}</span>
                            {needsCFO && (
                              <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[10px] font-bold">CFO</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 max-w-[160px] truncate">{e.description}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          AED {e.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${needsCFO ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                            {routing.primaryLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <ApprovalBadge status={approvalStatus} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-center flex-wrap">
                            <button onClick={() => setViewExp(e)}
                              className="flex items-center gap-1 px-2 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-medium">
                              <Eye size={12} /> View
                            </button>
                            <button
                              onClick={() => setExpandedApproval(isExpanded ? null : e.id)}
                              className="flex items-center gap-1 px-2 py-1.5 bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-lg text-xs font-medium">
                              <ShieldCheck size={12} />
                              {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                            </button>
                            {!approval && (
                              <button onClick={() => submitExpenseForApproval(e)}
                                className="flex items-center gap-1 px-2 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-xs font-medium">
                                <Send size={11} /> Submit
                              </button>
                            )}
                            {approval && approval.status !== 'Posted' && (
                              <button
                                onClick={() => postExpenseToGL(e)}
                                disabled={!canPost}
                                title={!canPost ? `Awaiting ${routing.primaryLabel} approval` : 'Post to GL'}
                                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium ${
                                  canPost
                                    ? 'bg-violet-600 text-white hover:bg-violet-700'
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                }`}>
                                {canPost ? <CheckCircle size={11} /> : <Lock size={11} />}
                                Post GL
                              </button>
                            )}
                            {approval?.status === 'Posted' && (
                              <span className="flex items-center gap-1 px-2 py-1.5 bg-violet-50 text-violet-700 rounded-lg text-xs font-medium">
                                <ShieldCheck size={11} /> Posted
                              </span>
                            )}
                            {attCount > 0 && (
                              <span className="flex items-center gap-1 px-2 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium">
                                <Paperclip size={11} /> {attCount}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                      {/* Expanded Approval Panel */}
                      {isExpanded && (
                        <tr key={`${e.id}-approval`} className="border-t border-violet-100 bg-violet-50/20">
                          <td colSpan={7} className="px-4 py-3">
                            <ApprovalPanel
                              exp={e}
                              approval={approval}
                              onSubmit={() => submitExpenseForApproval(e)}
                              onPostGL={() => postExpenseToGL(e)}
                              canPost={canPost}
                            />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Chart + Approval Summary */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-800 mb-4">Expenses by Category</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={40} outerRadius={75} paddingAngle={3} dataKey="value">
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: unknown) => `AED ${Number(v).toLocaleString()}`} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Approval Summary */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <ShieldCheck size={16} className="text-violet-600" /> Approval Summary
            </h3>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Not Submitted', color: 'bg-slate-400', count: expenseList.filter(e => !getByRef(e.id, 'Expense')).length },
                { label: 'Pending Review', color: 'bg-amber-400', count: expenseList.filter(e => { const a = getByRef(e.id, 'Expense'); return a && (['Submitted', 'Manager Approval', 'Finance Approval'] as string[]).includes(a.status); }).length },
                { label: 'Finance Approved', color: 'bg-emerald-500', count: expenseList.filter(e => { const a = getByRef(e.id, 'Expense'); return a && (['Accounting Posting'] as string[]).includes(a.status); }).length },
                { label: 'Posted to GL', color: 'bg-violet-500', count: expenseList.filter(e => getByRef(e.id, 'Expense')?.status === 'Posted').length },
                { label: 'Rejected', color: 'bg-red-400', count: expenseList.filter(e => getByRef(e.id, 'Expense')?.status === 'Rejected').length },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                  <span className="text-slate-600 flex-1">{s.label}</span>
                  <span className="font-semibold text-slate-800">{s.count}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
              <div className="flex justify-between"><span>CFO Threshold</span><span className="font-semibold text-red-600">AED {cfoThreshold.toLocaleString()}</span></div>
              <div className="flex justify-between mt-1"><span>Need CFO Approval</span><span className="font-semibold text-red-600">{needsCFOCount}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showModal && (
        <AddExpenseModal
          onClose={() => setShowModal(false)}
          onSave={exp => {
            setExpenseList(prev => [exp, ...prev]);
            upsertExpense(exp as any).catch(catchAndReport('Save expense'));
            submitExpenseForApproval(exp);
            setShowModal(false);
          }}
        />
      )}
      {viewExp && (
        <ViewExpenseModal
          exp={viewExp}
          approval={getByRef(viewExp.id, 'Expense')}
          onClose={() => setViewExp(null)}
          onSubmit={() => { submitExpenseForApproval(viewExp); setViewExp(null); }}
          onPostGL={() => { postExpenseToGL(viewExp); setViewExp(null); }}
          canPost={canPostByRef(viewExp.id, 'Expense')}
        />
      )}
    </div>
  );
}
