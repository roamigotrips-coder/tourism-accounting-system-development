import { useState, useEffect } from 'react';
import {
  Plus, Search, Download, X, Save, Printer, Eye, CheckCircle,
  Clock, AlertCircle, ChevronDown, ChevronUp, FileText,
  TrendingUp, Building2, User, Package, ThumbsUp, ThumbsDown,
  ReceiptText, Info, BarChart3, Paperclip,
  ShieldCheck, Lock, ArrowRight, Send, RefreshCw, Ban,
} from 'lucide-react';
import { routeApproval, getCFOThreshold, getWorkflowSteps } from '../utils/approvalThresholds';
import type { ApprovalItem } from '../context/ApprovalContext';
import { fetchInvoices, upsertInvoice } from '../lib/supabaseSync';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';
import RecordPaymentModal, { type RecordPaymentConfig, type PaymentRecord } from '../components/RecordPaymentModal';
import { useBookingEstimates, type BookingEstimate } from '../context/BookingEstimateContext';
import { useApproval } from '../context/ApprovalContext';
import { catchAndReport } from '../lib/toast';
import AttachmentPanel from '../components/AttachmentPanel';
import { useAttachments } from '../context/AttachmentsContext';
import { useAuditTrail } from '../context/AuditTrailContext';

// ─── Approval Status Badge ────────────────────────────────────────────────────
function ApprovalBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    'Not Submitted':       { bg: 'bg-slate-100',   text: 'text-slate-500',   icon: <Clock size={10} /> },
    'Draft':               { bg: 'bg-slate-100',   text: 'text-slate-500',   icon: <FileText size={10} /> },
    'Submitted':           { bg: 'bg-blue-50',     text: 'text-blue-700',    icon: <Send size={10} /> },
    'Under Review':        { bg: 'bg-amber-50',    text: 'text-amber-700',   icon: <RefreshCw size={10} /> },
    'Approved':            { bg: 'bg-emerald-50',  text: 'text-emerald-700', icon: <CheckCircle size={10} /> },
    'Rejected':            { bg: 'bg-red-50',      text: 'text-red-700',     icon: <Ban size={10} /> },
    'Correction Requested':{ bg: 'bg-orange-50',   text: 'text-orange-700',  icon: <AlertCircle size={10} /> },
    'Posted':              { bg: 'bg-violet-50',   text: 'text-violet-700',  icon: <ShieldCheck size={10} /> },
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
  const routing = routeApproval(amount, 'Invoice');
  const steps = getWorkflowSteps(routing);
  const currentStatus = approval?.status ?? 'Not Submitted';
  const getStepState = (role: string): 'done' | 'active' | 'pending' => {
    if (currentStatus === 'Posted') return 'done';
    if (currentStatus === 'Accounting Posting' && role === 'accountant') return 'active';
    if (currentStatus === 'Finance Approval' && role === 'finance_director') return 'active';
    if (currentStatus === 'Finance Approval') return (role === 'cfo' || role === 'finance_manager') ? 'done' : 'pending';
    if (currentStatus === 'Manager Approval' && (role === 'cfo' || role === 'finance_manager')) return 'active';
    if (currentStatus === 'Submitted' && role === 'reviewer') return 'active';
    if ((currentStatus === 'Draft' || currentStatus === 'Not Submitted') && role === 'maker') return 'active';
    if (role === 'maker') return 'done';
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

// ─── Invoice Approval Panel ───────────────────────────────────────────────────
function InvoiceApprovalPanel({ inv, approval, onSubmit, onPostGL, canPost }: {
  inv: InvoiceData;
  approval: ApprovalItem | undefined;
  onSubmit: () => void;
  onPostGL: () => void;
  canPost: boolean;
}) {
  const routing = routeApproval(inv.total, 'Invoice');
  const cfoThreshold = getCFOThreshold();
  const needsCFO = inv.total >= cfoThreshold;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={15} className="text-violet-600" />
          <span className="font-semibold text-slate-800 text-sm">Approval & GL Posting</span>
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
                ? `🔴 CFO Approval Required (${inv.currency} ${inv.total.toLocaleString()} ≥ AED ${cfoThreshold.toLocaleString()})`
                : `🟢 Finance Manager Approval (${inv.currency} ${inv.total.toLocaleString()} < AED ${cfoThreshold.toLocaleString()})`}
            </p>
            <p className={`mt-0.5 ${needsCFO ? 'text-red-600' : 'text-blue-600'}`}>
              Assigned to: <strong>{routing.primaryLabel}</strong>
              {routing.requiresSecondApproval && ` + Finance Director`}
            </p>
          </div>
        </div>
      </div>

      {/* Workflow */}
      <div>
        <p className="text-xs text-slate-500 mb-1.5 font-medium">WORKFLOW</p>
        <WorkflowTimeline approval={approval} amount={inv.total} />
      </div>

      {/* History */}
      {approval && approval.history.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-500 font-medium">HISTORY</p>
          {approval.history.slice(-3).map((h, i) => (
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

      {/* Rejection Note */}
      {approval?.status === 'Rejected' && approval.rejectionReason && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
          <p className="font-semibold mb-0.5">❌ Rejected:</p>
          <p>{approval.rejectionReason}</p>
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

const TYPES = ['All', 'Agent', 'Customer', 'Supplier'];
const CURRENCIES = ['AED', 'USD', 'EUR', 'GBP'];
const AGENT_OPTIONS = ['Global Tours UK', 'Euro Holidays', 'Asia Travel Co', 'US Travels Inc', 'India Voyages'];
const SUPPLIER_OPTIONS = ['Marriott Hotels UAE', 'Desert Safari LLC', 'City Transport Co', 'Dubai Attractions', 'Premium Stays'];
const STATUS_OPTIONS = ['Unpaid', 'Paid', 'Overdue'];

const COMPANY = {
  name: 'Arabian Horizon Tourism LLC',
  address: 'Office 1204, Deira Tower, Baniyas Road, Deira, Dubai, UAE',
  phone: '+971 4 234 5678',
  email: 'accounts@arabianhorizon.ae',
  trn: 'TRN 100234567800003',
  logo: '🌴',
};

interface LineItem { description: string; qty: string; unitPrice: string; }

interface InvoiceForm {
  type: string; party: string; customParty: string; currency: string;
  date: string; dueDate: string; status: string; notes: string;
  items: LineItem[];
}

type InvoiceData = {
  id: string; type: 'Agent' | 'Customer' | 'Supplier';
  party: string; amount: number; vat: number; total: number;
  currency: string; date: string; dueDate: string;
  status: 'Paid' | 'Unpaid' | 'Overdue'; notes?: string; items?: LineItem[];
  fromEstimate?: string;
};

const emptyForm: InvoiceForm = {
  type: 'Agent', party: '', customParty: '', currency: 'AED',
  date: new Date().toISOString().split('T')[0], dueDate: '', status: 'Unpaid',
  notes: '', items: [{ description: '', qty: '1', unitPrice: '' }],
};

function calcItems(items: LineItem[]) {
  return items.reduce((sum, it) => sum + (parseFloat(it.qty) || 0) * (parseFloat(it.unitPrice) || 0), 0);
}

// ─── Printable Invoice ────────────────────────────────────────────────────────
function PrintableInvoice({ inv, onClose }: { inv: InvoiceData; onClose: () => void }) {
  const items: LineItem[] = inv.items?.length
    ? inv.items
    : [{ description: 'Tourism Services', qty: '1', unitPrice: String(inv.amount) }];
  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <style>{`@media print{body *{visibility:hidden!important}#printable-invoice,#printable-invoice *{visibility:visible!important}#printable-invoice{position:fixed!important;inset:0!important;width:100%!important;background:white!important}.no-print{display:none!important}}`}</style>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-4">
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2"><Eye size={18} className="text-emerald-600" /><span className="font-semibold text-slate-700">Invoice Preview — {inv.id}</span></div>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 font-medium"><Printer size={15} /> Print / Save PDF</button>
            <button onClick={onClose} className="flex items-center gap-2 bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm hover:bg-slate-300 font-medium"><X size={15} /> Close</button>
          </div>
        </div>
        <div id="printable-invoice" className="p-10 font-sans text-slate-800">
          <div className="flex justify-between items-start mb-8">
            <div>
              <div className="text-4xl mb-1">{COMPANY.logo}</div>
              <h1 className="text-xl font-bold text-emerald-700">{COMPANY.name}</h1>
              <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">{COMPANY.address}</p>
              <p className="text-xs text-slate-500">{COMPANY.phone} · {COMPANY.email}</p>
              <p className="text-xs font-semibold text-slate-600 mt-1">{COMPANY.trn}</p>
            </div>
            <div className="text-right">
              <div className={`inline-block px-4 py-1 rounded-full text-sm font-bold mb-2 ${inv.type === 'Agent' ? 'bg-blue-100 text-blue-700' : inv.type === 'Customer' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>{inv.type.toUpperCase()} INVOICE</div>
              <h2 className="text-3xl font-extrabold text-slate-800">{inv.id}</h2>
              <p className="text-sm text-slate-500 mt-1">Date: <span className="font-medium text-slate-700">{inv.date}</span></p>
              <p className="text-sm text-slate-500">Due: <span className="font-medium text-red-600">{inv.dueDate}</span></p>
              {inv.fromEstimate && <p className="text-xs text-blue-500 mt-1">Booking Ref: {inv.fromEstimate}</p>}
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : inv.status === 'Overdue' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{inv.status.toUpperCase()}</span>
            </div>
          </div>
          <div className="mb-8 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Bill To</p>
            <p className="text-lg font-bold text-slate-800">{inv.party}</p>
            <p className="text-sm text-slate-500">{inv.type} Account</p>
          </div>
          <table className="w-full text-sm mb-6">
            <thead><tr className="bg-emerald-600 text-white"><th className="text-left px-4 py-3 rounded-tl-lg">#</th><th className="text-left px-4 py-3">Description</th><th className="text-right px-4 py-3">Qty</th><th className="text-right px-4 py-3">Unit Price</th><th className="text-right px-4 py-3 rounded-tr-lg">Amount</th></tr></thead>
            <tbody>{items.map((it, idx) => { const qty = parseFloat(it.qty)||1; const up = parseFloat(it.unitPrice)||0; return (<tr key={idx} className={idx%2===0?'bg-white':'bg-slate-50'}><td className="px-4 py-3 text-slate-400">{idx+1}</td><td className="px-4 py-3 font-medium text-slate-700">{it.description||'Tourism Services'}</td><td className="px-4 py-3 text-right text-slate-600">{qty}</td><td className="px-4 py-3 text-right text-slate-600">{inv.currency} {up.toLocaleString(undefined,{minimumFractionDigits:2})}</td><td className="px-4 py-3 text-right font-semibold text-slate-800">{inv.currency} {(qty*up).toLocaleString(undefined,{minimumFractionDigits:2})}</td></tr>); })}</tbody>
          </table>
          <div className="flex justify-end mb-6"><div className="w-72 space-y-2"><div className="flex justify-between text-sm text-slate-600 py-1 border-b border-slate-100"><span>Subtotal</span><span>{inv.currency} {inv.amount.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div><div className="flex justify-between text-sm text-slate-600 py-1 border-b border-slate-100"><span>VAT (5%)</span><span>{inv.currency} {inv.vat.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div><div className="flex justify-between font-bold text-base py-2 bg-emerald-50 px-3 rounded-lg"><span className="text-emerald-800">Total Due</span><span className="text-emerald-700">{inv.currency} {inv.total.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div></div></div>
          {inv.notes && (<div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100"><p className="text-xs font-bold text-blue-400 uppercase mb-1">Notes</p><p className="text-sm text-slate-600">{inv.notes}</p></div>)}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mb-6"><p className="text-xs font-bold text-slate-400 uppercase mb-2">Payment Instructions</p><div className="grid grid-cols-2 gap-2 text-sm"><div><span className="text-slate-500">Bank:</span> <span className="font-medium">Emirates NBD</span></div><div><span className="text-slate-500">Account:</span> <span className="font-medium">1234567890</span></div><div><span className="text-slate-500">IBAN:</span> <span className="font-medium">AE070331234567890123456</span></div><div><span className="text-slate-500">Swift:</span> <span className="font-medium">EBILAEAD</span></div></div></div>
          <div className="border-t border-slate-200 pt-4 text-center text-xs text-slate-400"><p>Thank you for your business! · {COMPANY.name} · {COMPANY.email}</p><p className="mt-1">This is a computer-generated invoice and is valid without a signature.</p></div>
        </div>
        {/* Attachment Panel below printable area */}
        <div className="no-print px-8 pb-6">
          <AttachmentPanel
            module="invoice"
            documentId={inv.id}
            title={`Attachments for ${inv.id}`}
            allowEmailIn={true}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Estimate Detail Modal ────────────────────────────────────────────────────
function EstimateDetailModal({ est, onClose, onApprove, onReject }: {
  est: BookingEstimate; onClose: () => void;
  onApprove: () => void; onReject: (reason: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><FileText size={20} className="text-white" /></div>
            <div>
              <h2 className="text-lg font-bold text-white">Booking Estimate — {est.id}</h2>
              <p className="text-blue-100 text-sm">{est.bookingRef} · Submitted {new Date(est.submittedAt).toLocaleDateString()}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg text-white"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Status */}
          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${
              est.status === 'Pending Approval' ? 'bg-amber-100 text-amber-700' :
              est.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
              est.status === 'Rejected' ? 'bg-red-100 text-red-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {est.status === 'Pending Approval' && <Clock size={14} />}
              {est.status === 'Approved' && <CheckCircle size={14} />}
              {est.status === 'Rejected' && <AlertCircle size={14} />}
              {est.status === 'Invoiced' && <ReceiptText size={14} />}
              {est.status}
            </span>
            {est.approvedBy && <span className="text-xs text-slate-500">Approved by <strong>{est.approvedBy}</strong> on {new Date(est.approvedAt!).toLocaleDateString()}</span>}
            {est.rejectedBy && <span className="text-xs text-red-500">Rejected by <strong>{est.rejectedBy}</strong>: {est.rejectionReason}</span>}
          </div>

          {/* Core Info */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Agent / Partner', value: est.agent, icon: <Building2 size={14} /> },
              { label: 'Customer', value: est.customer, icon: <User size={14} /> },
              { label: 'Service Type', value: est.serviceType, icon: <Package size={14} /> },
              { label: 'Service Date', value: est.serviceDate, icon: <Clock size={14} /> },
              { label: 'Currency', value: est.currency, icon: <Info size={14} /> },
              { label: 'Payment Status', value: est.paymentStatus, icon: <BarChart3 size={14} /> },
            ].map(f => (
              <div key={f.label} className="bg-slate-50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">{f.icon}{f.label}</div>
                <p className="font-semibold text-slate-800 text-sm">{f.value || '—'}</p>
              </div>
            ))}
          </div>

          {/* Financials */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <p className="text-xs font-bold text-blue-400 uppercase mb-3">Financial Summary</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span className="text-slate-600">Selling Price</span><span className="font-semibold">{est.currency} {est.sellingPrice.toLocaleString(undefined, {minimumFractionDigits:2})}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-600">VAT (5%)</span><span className="font-semibold">{est.currency} {est.vat.toLocaleString(undefined, {minimumFractionDigits:2})}</span></div>
              <div className="flex justify-between text-sm font-bold border-t border-blue-200 pt-2"><span className="text-blue-800">Total</span><span className="text-blue-700 text-base">{est.currency} {est.total.toLocaleString(undefined, {minimumFractionDigits:2})}</span></div>
            </div>
          </div>

          {/* Tour Package Costing */}
          {est.isTourPackage && est.costing && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-800 px-4 py-3 flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-400" />
                <span className="text-white font-semibold text-sm">Tour Package Costing Breakdown</span>
                {est.costing.costingFile && (
                  <span className="ml-auto text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full">📎 {est.costing.costingFile}</span>
                )}
              </div>
              <div className="p-4 space-y-2">
                {[
                  { label: 'Hotel', value: est.costing.hotel },
                  { label: 'Transfer', value: est.costing.transfer },
                  { label: 'Tickets / Entrance', value: est.costing.tickets },
                  { label: 'Activities', value: est.costing.activities },
                  { label: 'Tour Guide', value: est.costing.guide },
                  { label: 'Visa / Documentation', value: est.costing.visa },
                  { label: 'Other', value: est.costing.other },
                ].filter(c => c.value > 0).map(c => (
                  <div key={c.label} className="flex justify-between text-sm">
                    <span className="text-slate-500">{c.label}</span>
                    <span className="font-medium text-slate-700">{est.currency} {c.value.toLocaleString(undefined,{minimumFractionDigits:2})}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold border-t border-slate-200 pt-2">
                  <span className="text-slate-700">Total Cost</span>
                  <span className="text-slate-800">{est.currency} {est.costing.totalCost.toLocaleString(undefined,{minimumFractionDigits:2})}</span>
                </div>
                <div className={`flex justify-between text-sm font-bold rounded-lg px-3 py-2 ${est.costing.profit >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  <span>{est.costing.profit >= 0 ? '✅ Profit' : '❌ Loss'}</span>
                  <span>{est.currency} {Math.abs(est.costing.profit).toLocaleString(undefined,{minimumFractionDigits:2})} ({Math.abs(est.costing.margin).toFixed(1)}%)</span>
                </div>
                {est.costing.notes && <p className="text-xs text-slate-500 mt-1 italic">{est.costing.notes}</p>}
              </div>
            </div>
          )}

          {/* Notes */}
          {est.notes && (
            <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
              <p className="text-xs font-bold text-amber-500 uppercase mb-1">Sales Notes</p>
              <p className="text-sm text-slate-600">{est.notes}</p>
            </div>
          )}

          {/* Rejection reason input */}
          {rejecting && (
            <div className="bg-red-50 rounded-xl p-4 border border-red-200">
              <label className="block text-sm font-semibold text-red-700 mb-2">Rejection Reason <span className="text-red-500">*</span></label>
              <textarea
                value={reason} onChange={e => setReason(e.target.value)}
                rows={3} placeholder="Explain why this estimate is being rejected…"
                className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 resize-none"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {est.status === 'Pending Approval' && (
          <div className="flex gap-3 justify-end px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
            <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Close</button>
            {!rejecting ? (
              <>
                <button onClick={() => setRejecting(true)} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium border border-red-200">
                  <ThumbsDown size={15} /> Reject
                </button>
                <button onClick={onApprove} className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-sm font-semibold shadow-sm">
                  <ThumbsUp size={15} /> Approve & Generate Invoice
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setRejecting(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Back</button>
                <button
                  onClick={() => { if (reason.trim()) onReject(reason); }}
                  disabled={!reason.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  <ThumbsDown size={15} /> Confirm Rejection
                </button>
              </>
            )}
          </div>
        )}
        {est.status !== 'Pending Approval' && (
          <div className="flex justify-end px-6 py-4 border-t border-slate-100">
            <button onClick={onClose} className="px-5 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Invoices() {
  const { estimates, approveEstimate, rejectEstimate, markInvoiced, pendingCount } = useBookingEstimates();
  const { ensureApprovalRequest, getByRef, canPostByRef, postToGL } = useApproval();
  const { logAction } = useAuditTrail();

  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'invoices' | 'estimates'>('estimates');
  const [showModal, setShowModal] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<InvoiceData | null>(null);
  const [viewEstimate, setViewEstimate] = useState<BookingEstimate | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<RecordPaymentConfig | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<Record<string, PaymentRecord[]>>({});
  const [form, setForm] = useState<InvoiceForm>(emptyForm);
  const [invoiceList, setInvoiceList] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [estFilter, setEstFilter] = useState<'All' | 'Pending Approval' | 'Approved' | 'Rejected' | 'Invoiced'>('Pending Approval');
  const [approvedEstimate, setApprovedEstimate] = useState<BookingEstimate | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [newInvoiceId, setNewInvoiceId] = useState<string>('');
  const [expandedApproval, setExpandedApproval] = useState<string | null>(null);
  const cfoThreshold = getCFOThreshold();
  const { getByDocument } = useAttachments();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchInvoices();
        if (!cancelled && data) setInvoiceList(data as InvoiceData[]);
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

  // ─── Invoice Helpers ────────────────────────────────────────────────────────
  const filtered = invoiceList.filter(i =>
    (filter === 'All' || i.type === filter) &&
    (i.id.toLowerCase().includes(search.toLowerCase()) || i.party.toLowerCase().includes(search.toLowerCase()))
  );
  const totalAmount = filtered.reduce((s, i) => s + i.total, 0);
  const paidAmount = filtered.filter(i => i.status === 'Paid').reduce((s, i) => s + i.total, 0);
  const _overdueCount = filtered.filter(i => i.status === 'Overdue').length; void _overdueCount;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleItemChange = (idx: number, field: keyof LineItem, value: string) =>
    setForm(prev => { const items = [...prev.items]; items[idx] = { ...items[idx], [field]: value }; return { ...prev, items }; });
  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, { description: '', qty: '1', unitPrice: '' }] }));
  const removeItem = (idx: number) => setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));

  const partyOptions = form.type === 'Agent' ? AGENT_OPTIONS : form.type === 'Supplier' ? SUPPLIER_OPTIONS : [];
  const subtotal = calcItems(form.items);
  const vat = subtotal * 0.05;
  const total = subtotal + vat;

  const handleSubmit = (evt: React.FormEvent) => {
    evt.preventDefault();
    const partyName = form.party === 'other' || !partyOptions.length ? form.customParty : form.party;
    const invId = `INV-${String(invoiceList.length + 1).padStart(3, '0')}`;
    const newInvoice: InvoiceData = {
      id: invId,
      type: form.type as 'Agent' | 'Customer' | 'Supplier',
      party: partyName, amount: subtotal, vat, total,
      currency: form.currency, date: form.date, dueDate: form.dueDate,
      status: form.status as 'Paid' | 'Unpaid' | 'Overdue',
      notes: form.notes, items: form.items,
    };
    setInvoiceList(prev => [newInvoice, ...prev]);
    upsertInvoice(newInvoice as any).catch(catchAndReport('Save invoice'));
    routeApproval(newInvoice.total, 'Invoice');
    ensureApprovalRequest({
      refNumber: newInvoice.id,
      type: 'Invoice',
      title: `${newInvoice.type} Invoice — ${newInvoice.party}`,
      description: newInvoice.notes || 'Invoice created from Invoice System',
      amount: newInvoice.amount,
      currency: newInvoice.currency,
      submittedBy: 'Finance User',
      submittedAt: new Date().toISOString(),
      submittedByDept: 'Finance',
      priority: newInvoice.total >= getCFOThreshold() ? 'High' : 'Normal',
      dueDate: newInvoice.dueDate,
      party: newInvoice.party,
      partyType: newInvoice.type,
      category: `${newInvoice.type} Invoice`,
      notes: newInvoice.notes,
      sourceData: newInvoice as unknown as Record<string, unknown>,
    });
    setNewInvoiceId(invId);
    showToast('Invoice created and submitted for approval — you can now attach files below.');
  };

  const submitInvoiceForApproval = (inv: InvoiceData) => {
    const routing = routeApproval(inv.total, 'Invoice');
    ensureApprovalRequest({
      refNumber: inv.id,
      type: 'Invoice',
      title: `${inv.type} Invoice — ${inv.party}`,
      description: inv.notes || 'Invoice submitted manually for approval',
      amount: inv.amount,
      currency: inv.currency,
      submittedBy: 'Finance User',
      submittedAt: new Date().toISOString(),
      submittedByDept: 'Finance',
      priority: inv.total >= getCFOThreshold() ? 'High' : 'Normal',
      dueDate: inv.dueDate,
      party: inv.party,
      partyType: inv.type,
      category: `${inv.type} Invoice`,
      notes: inv.notes,
      sourceData: inv as unknown as Record<string, unknown>,
    });
    showToast(`Invoice ${inv.id} submitted for ${routing.primaryLabel} approval.`);
  };

  const postInvoiceToGL = (inv: InvoiceData) => {
    const request = getByRef(inv.id, 'Invoice');
    if (!request) {
      showToast(`Invoice ${inv.id} must be submitted for approval first.`, 'error');
      return;
    }
    if (!canPostByRef(inv.id, 'Invoice')) {
      showToast(`Invoice ${inv.id} cannot post to GL until approved.`, 'error');
      return;
    }
    if (request.status === 'Posted') {
      showToast(`Invoice ${inv.id} is already posted.`, 'success');
      return;
    }
    postToGL(request.id, 'Finance User');
    showToast(`Invoice ${inv.id} posted to GL successfully.`);
  };

  const openPaymentModal = (inv: InvoiceData) => {
    setPaymentConfig({
      invoiceId: inv.id, partyName: inv.party, partyType: inv.type,
      totalAmount: inv.total, paidAmount: inv.status === 'Paid' ? inv.total : 0,
      currency: inv.currency, dueDate: inv.dueDate, existingPayments: paymentHistory[inv.id] || [],
    });
  };

  const handlePaymentSave = (payment: PaymentRecord, newStatus: 'Paid' | 'Partial' | 'Unpaid') => {
    if (!paymentConfig) return;
    const invId = paymentConfig.invoiceId;
    setPaymentHistory(prev => ({ ...prev, [invId]: [...(prev[invId] || []), payment] }));
    setInvoiceList(prev => prev.map(inv =>
      inv.id === invId ? { ...inv, status: newStatus === 'Paid' ? 'Paid' : inv.status } : inv
    ));
  };

  // ─── Estimate Actions ───────────────────────────────────────────────────────
  const handleApprove = (est: BookingEstimate) => {
    const approved = approveEstimate(est.id, 'Finance Manager');
    if (!approved) return;

    // Auto-generate invoice from estimate
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);
    const newInvoice: InvoiceData = {
      id: `INV-${String(invoiceList.length + 1).padStart(3, '0')}`,
      type: 'Agent',
      party: approved.agent,
      amount: approved.sellingPrice,
      vat: approved.vat,
      total: approved.total,
      currency: approved.currency,
      date: new Date().toISOString().split('T')[0],
      dueDate: dueDate.toISOString().split('T')[0],
      status: 'Unpaid',
      notes: `Auto-generated from Booking Estimate ${approved.id} (${approved.bookingRef}). ${approved.notes}`.trim(),
      items: [{
        description: `${approved.serviceType} — ${approved.customer} (${approved.serviceDate})`,
        qty: '1',
        unitPrice: String(approved.sellingPrice),
      }],
      fromEstimate: approved.bookingRef,
    };
    setInvoiceList(prev => [newInvoice, ...prev]);
    upsertInvoice(newInvoice as any).catch(catchAndReport('Save invoice'));
    ensureApprovalRequest({
      refNumber: newInvoice.id,
      type: 'Invoice',
      title: `Agent Invoice — ${newInvoice.party}`,
      description: `Auto-generated from Booking Estimate ${approved.id}`,
      amount: newInvoice.amount,
      currency: newInvoice.currency,
      submittedBy: 'Finance Manager',
      submittedAt: new Date().toISOString(),
      submittedByDept: 'Finance',
      priority: approved.total > 5000 ? 'High' : 'Normal',
      dueDate: newInvoice.dueDate,
      party: newInvoice.party,
      partyType: newInvoice.type,
      category: approved.serviceType,
      notes: newInvoice.notes,
      sourceData: approved as unknown as Record<string, unknown>,
    });
    markInvoiced(approved.id, newInvoice.id);
    setViewEstimate(null);
    setApprovedEstimate({ ...approved, invoiceId: newInvoice.id });
    showToast(`✅ Estimate approved! Invoice ${newInvoice.id} generated automatically.`);
    setTimeout(() => setApprovedEstimate(null), 5000);
    // Audit log
    logAction({
      action: 'APPROVE',
      module: 'Invoices',
      entityId: approved.id,
      entityType: 'BookingEstimate',
      entityLabel: `Booking Estimate ${approved.id}`,
      description: `Approved estimate ${approved.id} — auto-generated invoice ${newInvoice.id} for AED ${approved.total.toFixed(2)}`,
      oldValues: { status: 'Pending Approval' },
      newValues: { status: 'Approved', invoiceId: newInvoice.id, approvedBy: 'Finance Manager' },
      tags: ['estimate', 'approved', 'invoice'],
      severity: 'info',
    });
    // Switch to invoices tab to see it
    setTimeout(() => setActiveTab('invoices'), 1000);
  };

  const handleReject = (est: BookingEstimate, reason: string) => {
    rejectEstimate(est.id, 'Finance Manager', reason);
    setViewEstimate(null);
    showToast(`Estimate ${est.id} rejected.`, 'error');
    logAction({
      action: 'REJECT',
      module: 'Invoices',
      entityId: est.id,
      entityType: 'BookingEstimate',
      entityLabel: `Booking Estimate ${est.id}`,
      description: `Rejected estimate ${est.id} — reason: ${reason}`,
      oldValues: { status: 'Pending Approval' },
      newValues: { status: 'Rejected', rejectionReason: reason, rejectedBy: 'Finance Manager' },
      tags: ['estimate', 'rejected'],
      severity: 'warning',
    });
  };

  // ─── Estimate filter ────────────────────────────────────────────────────────
  const filteredEstimates = estimates.filter(e => estFilter === 'All' || e.status === estFilter);

  if (loading) return <LoadingSpinner message="Loading invoices..." />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="space-y-6 relative">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl border text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-red-600 text-white border-red-700'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Approved Estimate Banner */}
      {approvedEstimate && (
        <div className="bg-emerald-600 text-white rounded-xl px-5 py-4 flex items-center gap-4 shadow-lg">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
            <CheckCircle size={22} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="font-bold">Estimate Approved & Invoice Generated!</p>
            <p className="text-emerald-100 text-sm">Invoice <strong>{approvedEstimate.invoiceId}</strong> has been created for <strong>{approvedEstimate.agent}</strong> — {approvedEstimate.currency} {approvedEstimate.total.toLocaleString()}</p>
          </div>
          <button onClick={() => setApprovedEstimate(null)} className="p-1.5 hover:bg-white/20 rounded-lg"><X size={16} /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            Invoice System
            {pendingCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500 text-white text-xs font-bold rounded-full animate-pulse">
                <Clock size={11} /> {pendingCount} Pending
              </span>
            )}
          </h1>
          <p className="text-slate-500 mt-1">Finance approval queue, invoices & payment tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setForm(emptyForm); setShowModal(true); }}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 text-sm font-medium"
          >
            <Plus size={16} /> Create Invoice
          </button>
          <div className="relative group">
            <button className="flex items-center gap-1 px-3 py-2.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-sm font-medium">
              <FileText size={14} /> From... <ChevronDown size={12} />
            </button>
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 hidden group-hover:block">
              <button className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2">
                <FileText size={14} /> From Quote
              </button>
              <button className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2">
                <FileText size={14} /> From Sales Order
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Invoiced', value: `AED ${totalAmount.toLocaleString()}`, color: 'text-slate-800' },
          { label: 'Collected', value: `AED ${paidAmount.toLocaleString()}`, color: 'text-emerald-600' },
          { label: 'Outstanding', value: `AED ${(totalAmount - paidAmount).toLocaleString()}`, color: 'text-amber-600' },
          { label: 'Pending Approval', value: pendingCount, color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
            <p className="text-xs text-slate-500 uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Maker-Checker Banner */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl px-5 py-3 flex flex-wrap items-center gap-4">
        <ShieldCheck size={18} className="text-violet-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-violet-800">Maker-Checker Approval Active</p>
          <p className="text-xs text-violet-600 mt-0.5">
            Invoices &lt; AED {cfoThreshold.toLocaleString()} → <strong>Finance Manager</strong> approval ·
            ≥ AED {cfoThreshold.toLocaleString()} → <strong>CFO</strong> approval required.
            <span className="ml-1 text-violet-400">GL posting is blocked until approved. Change threshold in Settings → Approval Controls.</span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
            <ArrowRight size={10} /> Maker → Reviewer → Approver → GL
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {[
          { key: 'estimates', label: '📋 Finance Approval Queue', badge: pendingCount },
          { key: 'invoices', label: '🧾 Invoices', badge: 0 },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            {tab.badge > 0 && (
              <span className="w-5 h-5 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── FINANCE APPROVAL QUEUE TAB ─────────────────────────────────────── */}
      {activeTab === 'estimates' && (
        <div className="space-y-4">
          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3.5 flex items-start gap-3">
            <Info size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Finance Approval Queue</p>
              <p className="text-sm text-blue-600 mt-0.5">
                Booking estimates submitted by the Sales team appear here. Review each estimate, verify the costing, then <strong>Approve</strong> to auto-generate an invoice or <strong>Reject</strong> with a reason.
              </p>
            </div>
          </div>

          {/* Estimate Status Filter */}
          <div className="flex gap-2 flex-wrap">
            {(['All', 'Pending Approval', 'Approved', 'Rejected', 'Invoiced'] as const).map(s => (
              <button key={s} onClick={() => setEstFilter(s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  estFilter === s
                    ? s === 'Pending Approval' ? 'bg-amber-500 text-white'
                    : s === 'Approved' ? 'bg-emerald-600 text-white'
                    : s === 'Rejected' ? 'bg-red-500 text-white'
                    : s === 'Invoiced' ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>
                {s === 'Pending Approval' && <Clock size={11} />}
                {s === 'Approved' && <CheckCircle size={11} />}
                {s === 'Rejected' && <AlertCircle size={11} />}
                {s === 'Invoiced' && <ReceiptText size={11} />}
                {s}
                {s === 'Pending Approval' && pendingCount > 0 && (
                  <span className="w-4 h-4 bg-white text-amber-600 rounded-full text-xs flex items-center justify-center font-bold">{pendingCount}</span>
                )}
              </button>
            ))}
          </div>

          {/* Estimate Cards */}
          {filteredEstimates.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 p-12 text-center">
              <div className="text-5xl mb-3">📭</div>
              <p className="text-slate-500 font-medium">No estimates in this category</p>
              <p className="text-slate-400 text-sm mt-1">Estimates submitted from Sales & Booking will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEstimates.map(est => (
                <EstimateCard
                  key={est.id}
                  est={est}
                  onView={() => setViewEstimate(est)}
                  onApprove={() => handleApprove(est)}
                  onReject={(reason) => handleReject(est, reason)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── INVOICES TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'invoices' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {TYPES.map(t => (
                <button key={t} onClick={() => setFilter(t)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${filter === t ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{t}</button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  {['Invoice #', 'Source', 'Type', 'Party', 'Amount', 'VAT', 'Total', 'Date', 'Due Date', 'Status', 'Actions'].map(h => (
                    <th key={h} className={`px-4 py-3 font-medium text-slate-600 text-left`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (<tr><td colSpan={11} className="px-4 py-10 text-center text-slate-400">No invoices found.</td></tr>)}
                {filtered.map(inv => {
                  const approval = getByRef(inv.id, 'Invoice');
                  const approvalStatus = approval?.status ?? 'Not Submitted';
                  const canPost = canPostByRef(inv.id, 'Invoice');
                  const routing = routeApproval(inv.total, 'Invoice');
                  const needsCFO = inv.total >= cfoThreshold;
                  const isExpanded = expandedApproval === inv.id;

                  return (
                    <>
                    <tr key={inv.id} className={`border-t border-slate-50 hover:bg-slate-50/60 transition-colors ${approvalStatus === 'Posted' ? 'bg-violet-50/20' : ''}`}>
                      <td className="px-4 py-3 font-semibold text-blue-600">{inv.id}</td>
                      <td className="px-4 py-3">
                        {inv.fromEstimate
                          ? <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full w-fit"><ReceiptText size={10} />{inv.fromEstimate}</span>
                          : <span className="text-xs text-slate-400">Manual</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${inv.type === 'Agent' ? 'bg-blue-50 text-blue-700' : inv.type === 'Customer' ? 'bg-purple-50 text-purple-700' : 'bg-amber-50 text-amber-700'}`}>{inv.type}</span>
                          {needsCFO && <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[10px] font-bold">CFO</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium">{inv.party}</td>
                      <td className="px-4 py-3 text-slate-600">{inv.currency} {inv.amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-500">{inv.currency} {inv.vat.toLocaleString()}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{inv.currency} {inv.total.toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-500">{inv.date}</td>
                      <td className="px-4 py-3 text-slate-500">{inv.dueDate}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${inv.status === 'Paid' ? 'bg-emerald-50 text-emerald-700' : inv.status === 'Overdue' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{inv.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          <button onClick={() => setViewInvoice(inv)} className="flex items-center gap-1 px-2 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-medium"><Eye size={13} /> View</button>
                          <button onClick={() => setViewInvoice(inv)} className="flex items-center gap-1 px-2 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-medium"><Download size={13} /> PDF</button>
                          {/* Approval toggle */}
                          <button
                            onClick={() => setExpandedApproval(isExpanded ? null : inv.id)}
                            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium ${isExpanded ? 'bg-violet-200 text-violet-800' : 'bg-violet-50 text-violet-700 hover:bg-violet-100'}`}>
                            <ShieldCheck size={12} />
                            <ApprovalBadge status={approvalStatus} />
                            {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                          </button>
                          {(() => { const cnt = getByDocument('invoice', inv.id).length; return cnt > 0 ? (
                            <span className="flex items-center gap-1 px-2 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium">
                              <Paperclip size={12} /> {cnt}
                            </span>
                          ) : null; })()}
                          {inv.status !== 'Paid' && (
                            <button onClick={() => openPaymentModal(inv)} className="flex items-center gap-1 px-2 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs font-medium shadow-sm"><CheckCircle size={13} /> Pay</button>
                          )}
                          {!approval && (
                            <button onClick={() => submitInvoiceForApproval(inv)}
                              className="flex items-center gap-1 px-2 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-xs font-medium">
                              <Send size={11} /> Submit
                            </button>
                          )}
                          {approval && approval.status !== 'Posted' && (
                            <button
                              onClick={() => postInvoiceToGL(inv)}
                              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium ${
                                canPost ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              }`}
                              disabled={!canPost}
                              title={!canPost ? `Awaiting ${routing.primaryLabel} approval` : 'Post to General Ledger'}>
                              {canPost ? <CheckCircle size={11} /> : <Lock size={11} />}
                              Post GL
                            </button>
                          )}
                          {approval?.status === 'Posted' && (
                            <span className="flex items-center gap-1 px-2 py-1.5 bg-violet-50 text-violet-700 rounded-lg text-xs font-medium">
                              <ShieldCheck size={11} /> Posted
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Expanded Approval Panel */}
                    {isExpanded && (
                      <tr key={`${inv.id}-appr`} className="border-t border-violet-100 bg-violet-50/10">
                        <td colSpan={11} className="px-4 py-3">
                          <InvoiceApprovalPanel
                            inv={inv}
                            approval={approval}
                            onSubmit={() => { submitInvoiceForApproval(inv); setExpandedApproval(null); }}
                            onPostGL={() => postInvoiceToGL(inv)}
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
      )}

      {/* ─── Modals ────────────────────────────────────────────────────────── */}
      {paymentConfig && (
        <RecordPaymentModal config={paymentConfig} onClose={() => setPaymentConfig(null)}
          onSave={(payment, newStatus) => { handlePaymentSave(payment, newStatus); setPaymentConfig(null); }} />
      )}
      {viewInvoice && <PrintableInvoice inv={viewInvoice} onClose={() => setViewInvoice(null)} />}
      {viewEstimate && (
        <EstimateDetailModal
          est={viewEstimate}
          onClose={() => setViewEstimate(null)}
          onApprove={() => handleApprove(viewEstimate)}
          onReject={(reason) => handleReject(viewEstimate, reason)}
        />
      )}

      {/* ─── Create Invoice Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div><h2 className="text-xl font-bold text-slate-800">Create Invoice</h2><p className="text-sm text-slate-500 mt-0.5">Fill all details to generate a new invoice</p></div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Type <span className="text-red-500">*</span></label>
                  <select name="type" value={form.type} onChange={handleChange} required className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                    <option value="Agent">Agent Invoice</option>
                    <option value="Customer">Customer Invoice</option>
                    <option value="Supplier">Supplier Invoice</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                  <select name="currency" value={form.currency} onChange={handleChange} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select name="status" value={form.status} onChange={handleChange} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                    {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {form.type === 'Customer' ? 'Customer Name' : form.type === 'Agent' ? 'Agent' : 'Supplier'} <span className="text-red-500">*</span>
                </label>
                {partyOptions.length > 0 && (
                  <select name="party" value={form.party} onChange={handleChange} required className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                    <option value="">Select {form.type}…</option>
                    {partyOptions.map(p => <option key={p}>{p}</option>)}
                    <option value="other">Other (enter below)</option>
                  </select>
                )}
                {(form.type === 'Customer' || form.party === 'other') && (
                  <input name="customParty" value={form.customParty} onChange={handleChange} required placeholder={form.type === 'Customer' ? 'Enter customer name' : 'Enter name'}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 mt-2" />
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Date <span className="text-red-500">*</span></label>
                  <input type="date" name="date" value={form.date} onChange={handleChange} required className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Due Date <span className="text-red-500">*</span></label>
                  <input type="date" name="dueDate" value={form.dueDate} onChange={handleChange} required className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
              </div>
              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Line Items <span className="text-red-500">*</span></label>
                  <button type="button" onClick={addItem} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"><Plus size={13} /> Add Item</button>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50"><tr><th className="text-left px-3 py-2 text-slate-500 font-medium">Description</th><th className="text-right px-3 py-2 text-slate-500 font-medium w-16">Qty</th><th className="text-right px-3 py-2 text-slate-500 font-medium w-28">Unit Price</th><th className="text-right px-3 py-2 text-slate-500 font-medium w-28">Amount</th><th className="w-8 px-2 py-2"></th></tr></thead>
                    <tbody>
                      {form.items.map((item, idx) => {
                        const lineTotal = (parseFloat(item.qty)||0)*(parseFloat(item.unitPrice)||0);
                        return (
                          <tr key={idx} className="border-t border-slate-100">
                            <td className="px-2 py-1.5"><input value={item.description} onChange={e => handleItemChange(idx,'description',e.target.value)} placeholder="Service description" required className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" /></td>
                            <td className="px-2 py-1.5"><input type="number" min="1" value={item.qty} onChange={e => handleItemChange(idx,'qty',e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" /></td>
                            <td className="px-2 py-1.5"><input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => handleItemChange(idx,'unitPrice',e.target.value)} placeholder="0.00" required className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" /></td>
                            <td className="px-3 py-1.5 text-right font-semibold text-slate-700">{form.currency} {lineTotal.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                            <td className="px-2 py-1.5 text-center">{form.items.length > 1 && <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><X size={14} /></button>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {subtotal > 0 && (
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 space-y-1.5 text-sm">
                  <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{form.currency} {subtotal.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
                  <div className="flex justify-between text-slate-600"><span>VAT (5%)</span><span>{form.currency} {vat.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
                  <div className="flex justify-between font-bold text-emerald-800 border-t border-emerald-200 pt-1.5"><span>Total</span><span>{form.currency} {total.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes / Terms</label>
                <textarea name="notes" value={form.notes} onChange={handleChange} rows={2} placeholder="Payment terms, booking references, or additional notes…"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none" />
              </div>

              {/* Attachments — shown after invoice is created */}
              {newInvoiceId ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                    <span className="text-sm text-emerald-800 font-medium">Invoice <strong>{newInvoiceId}</strong> created! Attach supporting documents below.</span>
                  </div>
                  <AttachmentPanel
                    module="invoice"
                    documentId={newInvoiceId}
                    title="Invoice Attachments"
                    allowEmailIn={true}
                  />
                  <div className="flex gap-3 justify-end pt-2">
                    <button type="button" onClick={() => { setShowModal(false); setNewInvoiceId(''); setForm(emptyForm); }}
                      className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 font-medium">
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3 justify-end pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 font-medium">Cancel</button>
                  <button type="submit" className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 font-medium"><Save size={15} /> Create Invoice</button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Estimate Card Component ──────────────────────────────────────────────────
function EstimateCard({ est, onView, onApprove, onReject }: {
  est: BookingEstimate;
  onView: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const statusCfg = {
    'Pending Approval': { bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', icon: <Clock size={13} /> },
    'Approved': { bg: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle size={13} /> },
    'Rejected': { bg: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700', icon: <AlertCircle size={13} /> },
    'Invoiced': { bg: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-700', icon: <ReceiptText size={13} /> },
  }[est.status] ?? { bg: 'bg-slate-50 border-slate-200', badge: 'bg-slate-100 text-slate-600', icon: null };

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${statusCfg.bg}`}>
      {/* Card Header */}
      <div className="flex items-start gap-4 p-4">
        {/* Left: Icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          est.status === 'Pending Approval' ? 'bg-amber-400' :
          est.status === 'Approved' ? 'bg-emerald-500' :
          est.status === 'Rejected' ? 'bg-red-400' : 'bg-blue-500'
        }`}>
          <FileText size={18} className="text-white" />
        </div>

        {/* Middle: Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-bold text-slate-800 text-sm">{est.id}</span>
            <span className="text-slate-400 text-xs">·</span>
            <span className="text-slate-600 text-xs font-medium">{est.bookingRef}</span>
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${statusCfg.badge}`}>
              {statusCfg.icon}{est.status}
            </span>
            {est.isTourPackage && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                <Package size={10} /> Tour Package
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span><strong className="text-slate-700">Agent:</strong> {est.agent}</span>
            <span><strong className="text-slate-700">Customer:</strong> {est.customer}</span>
            <span><strong className="text-slate-700">Service:</strong> {est.serviceType}</span>
            <span><strong className="text-slate-700">Date:</strong> {est.serviceDate}</span>
            <span><strong className="text-slate-700">Submitted:</strong> {new Date(est.submittedAt).toLocaleDateString()}</span>
          </div>
          {est.status === 'Rejected' && est.rejectionReason && (
            <p className="text-xs text-red-600 mt-1 italic">❌ Rejected: {est.rejectionReason}</p>
          )}
          {est.status === 'Invoiced' && est.invoiceId && (
            <p className="text-xs text-blue-600 mt-1">🧾 Invoice generated: <strong>{est.invoiceId}</strong></p>
          )}
        </div>

        {/* Right: Amount + Actions */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className="text-right">
            <p className="text-xs text-slate-400">Total</p>
            <p className="text-lg font-bold text-slate-800">{est.currency} {est.total.toLocaleString()}</p>
            {est.isTourPackage && est.costing && (
              <p className={`text-xs font-semibold ${est.costing.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {est.costing.profit >= 0 ? '✅' : '❌'} Profit: {est.currency} {Math.abs(est.costing.profit).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex gap-1.5">
            <button onClick={onView} className="flex items-center gap-1 px-2.5 py-1.5 bg-white text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-medium border border-slate-200">
              <Eye size={12} /> Details
            </button>
            <button onClick={() => setExpanded(!expanded)} className="p-1.5 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 text-slate-500">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded: Costing + Quick Actions */}
      {expanded && (
        <div className="border-t border-slate-200 bg-white/70 p-4 space-y-4">
          {/* Financial summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-400 mb-1">Selling Price</p>
              <p className="font-bold text-slate-800 text-sm">{est.currency} {est.sellingPrice.toLocaleString()}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-400 mb-1">VAT (5%)</p>
              <p className="font-bold text-slate-800 text-sm">{est.currency} {est.vat.toLocaleString()}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xs text-blue-400 mb-1">Total</p>
              <p className="font-bold text-blue-700 text-sm">{est.currency} {est.total.toLocaleString()}</p>
            </div>
          </div>

          {/* Tour Package Costing */}
          {est.isTourPackage && est.costing && (
            <div className="bg-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-semibold text-sm flex items-center gap-2"><TrendingUp size={14} className="text-emerald-400" /> Package Costing</span>
                {est.costing.costingFile && <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full">📎 {est.costing.costingFile}</span>}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                {[
                  { label: 'Hotel', value: est.costing.hotel },
                  { label: 'Transfer', value: est.costing.transfer },
                  { label: 'Tickets', value: est.costing.tickets },
                  { label: 'Activities', value: est.costing.activities },
                  { label: 'Guide', value: est.costing.guide },
                  { label: 'Visa', value: est.costing.visa },
                  { label: 'Other', value: est.costing.other },
                ].filter(c => c.value > 0).map(c => (
                  <div key={c.label} className="bg-white/10 rounded-lg p-2.5 text-center">
                    <p className="text-slate-400 text-xs mb-0.5">{c.label}</p>
                    <p className="text-white font-semibold text-sm">{est.currency} {c.value.toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <div className={`flex justify-between items-center rounded-lg px-4 py-3 ${est.costing.profit >= 0 ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
                <div>
                  <p className="text-xs text-slate-300">Total Cost: <strong className="text-white">{est.currency} {est.costing.totalCost.toLocaleString()}</strong></p>
                  <p className="text-xs text-slate-300">Margin: <strong className="text-white">{Math.abs(est.costing.margin).toFixed(1)}%</strong></p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-300">{est.costing.profit >= 0 ? '✅ Profit' : '❌ Loss'}</p>
                  <p className={`text-lg font-bold ${est.costing.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{est.currency} {Math.abs(est.costing.profit).toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {est.notes && <p className="text-xs text-slate-500 italic bg-amber-50 rounded-lg p-2.5 border border-amber-100">💬 {est.notes}</p>}

          {/* Quick Actions for Pending */}
          {est.status === 'Pending Approval' && !rejecting && (
            <div className="flex gap-3 pt-1">
              <button onClick={() => setRejecting(true)} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-sm font-semibold border border-red-200">
                <ThumbsDown size={15} /> Reject
              </button>
              <button onClick={onApprove} className="flex-2 flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-sm font-semibold shadow-md">
                <ThumbsUp size={15} /> Approve & Generate Invoice
              </button>
            </div>
          )}

          {/* Rejection input */}
          {rejecting && (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-red-700">Rejection Reason <span className="text-red-500">*</span></label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
                placeholder="Explain why this estimate is being rejected…"
                className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none" />
              <div className="flex gap-2">
                <button onClick={() => setRejecting(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Back</button>
                <button onClick={() => { if(reason.trim()) { onReject(reason); setRejecting(false); } }} disabled={!reason.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm font-semibold disabled:opacity-50">
                  <ThumbsDown size={14} /> Confirm Reject
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
