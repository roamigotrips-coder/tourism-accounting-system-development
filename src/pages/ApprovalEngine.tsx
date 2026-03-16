import { useState } from 'react';
import {
  CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronRight,
  FileText, User, ArrowRight, Send, Shield,
  TrendingUp, Filter, Search, Eye, MessageSquare
} from 'lucide-react';
import { useApproval, WorkflowStage, ApprovalItem } from '../context/ApprovalContext';
import { getCFOThreshold } from '../utils/approvalThresholds';

// ─── Stage config ─────────────────────────────────────────────────────────────
const STAGES: { stage: WorkflowStage; label: string; color: string; bg: string; icon: React.ReactNode }[] = [
  { stage: 'Draft',              label: 'Draft',              color: 'text-slate-600',  bg: 'bg-slate-100',  icon: <FileText size={14}/> },
  { stage: 'Submitted',          label: 'Submitted',          color: 'text-blue-600',   bg: 'bg-blue-100',   icon: <Send size={14}/> },
  { stage: 'Manager Approval',   label: 'Manager Approval',   color: 'text-amber-600',  bg: 'bg-amber-100',  icon: <User size={14}/> },
  { stage: 'Finance Approval',   label: 'Finance Approval',   color: 'text-purple-600', bg: 'bg-purple-100', icon: <Shield size={14}/> },
  { stage: 'Accounting Posting', label: 'Accounting Posting', color: 'text-indigo-600', bg: 'bg-indigo-100', icon: <TrendingUp size={14}/> },
  { stage: 'Posted',             label: 'Posted',             color: 'text-green-600',  bg: 'bg-green-100',  icon: <CheckCircle size={14}/> },
  { stage: 'Rejected',           label: 'Rejected',           color: 'text-red-600',    bg: 'bg-red-100',    icon: <XCircle size={14}/> },
  { stage: 'Correction Requested', label: 'Correction',       color: 'text-orange-600', bg: 'bg-orange-100', icon: <AlertTriangle size={14}/> },
];

function stageMeta(s: WorkflowStage) {
  return STAGES.find(x => x.stage === s) ?? STAGES[0];
}

function StageBadge({ stage }: { stage: WorkflowStage }) {
  const m = stageMeta(stage);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${m.bg} ${m.color}`}>
      {m.icon}{m.label}
    </span>
  );
}

// ─── Workflow Pipeline Visual ─────────────────────────────────────────────────
function WorkflowPipeline({ current }: { current: WorkflowStage }) {
  const pipeline: WorkflowStage[] = ['Draft', 'Submitted', 'Manager Approval', 'Finance Approval', 'Accounting Posting', 'Posted'];
  const idx = pipeline.indexOf(current);
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {pipeline.map((s, i) => {
        const done = idx > i;
        const active = idx === i;
        const m = stageMeta(s);
        return (
          <div key={s} className="flex items-center gap-1">
            <div className={`px-2 py-0.5 rounded text-xs font-medium ${
              done ? 'bg-green-100 text-green-700' :
              active ? `${m.bg} ${m.color} ring-1 ring-current` :
              'bg-slate-100 text-slate-400'
            }`}>
              {s === 'Accounting Posting' ? 'Acctg Post' : s}
            </div>
            {i < pipeline.length - 1 && (
              <ArrowRight size={10} className={done ? 'text-green-400' : 'text-slate-300'} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Action buttons per stage ─────────────────────────────────────────────────
function ActionButtons({
  item, onAdvance, onReject, onCorrection, onResubmit, onPost,
}: {
  item: ApprovalItem;
  onAdvance: (id: string, by: string, note?: string) => void;
  onReject: (id: string, by: string, reason: string) => void;
  onCorrection: (id: string, by: string, note: string) => void;
  onResubmit: (id: string, by: string) => void;
  onPost: (id: string, by: string) => void;
}) {
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);
  const [mode, setMode] = useState<'advance' | 'reject' | 'correction' | null>(null);

  const actionLabel: Record<WorkflowStage, string> = {
    'Draft':                '▶ Submit',
    'Submitted':            '▶ Send to Manager',
    'Manager Approval':     '✓ Manager Approve',
    'Finance Approval':     '✓ Finance Approve',
    'Accounting Posting':   '🏦 Post to GL',
    'Posted':               '',
    'Rejected':             '↩ Re-submit',
    'Correction Requested': '↩ Re-submit',
  };

  const label = actionLabel[item.status];
  if (!label) return <span className="text-xs text-slate-400">No actions</span>;

  const handlePrimary = () => {
    if (item.status === 'Accounting Posting') { onPost(item.id, 'Senior Accountant'); return; }
    if (item.status === 'Rejected' || item.status === 'Correction Requested') { onResubmit(item.id, item.submittedBy); return; }
    if (mode === 'advance') { onAdvance(item.id, 'Current User', comment); setMode(null); setComment(''); return; }
    if (!showComment) { setShowComment(true); setMode('advance'); return; }
    onAdvance(item.id, 'Current User', comment);
    setShowComment(false); setMode(null); setComment('');
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1 flex-wrap">
        <button onClick={handlePrimary}
          className="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 font-medium">
          {label}
        </button>
        {!['Draft', 'Posted', 'Rejected', 'Correction Requested'].includes(item.status) && (
          <>
            <button onClick={() => { setMode('correction'); setShowComment(true); }}
              className="px-3 py-1.5 bg-amber-500 text-white text-xs rounded hover:bg-amber-600 font-medium">
              ✏ Correct
            </button>
            <button onClick={() => { setMode('reject'); setShowComment(true); }}
              className="px-3 py-1.5 bg-red-500 text-white text-xs rounded hover:bg-red-600 font-medium">
              ✗ Reject
            </button>
          </>
        )}
        {showComment && (
          <button onClick={() => { setShowComment(false); setMode(null); setComment(''); }}
            className="px-2 py-1.5 bg-slate-200 text-slate-600 text-xs rounded hover:bg-slate-300">
            Cancel
          </button>
        )}
      </div>
      {showComment && (
        <div className="flex gap-1">
          <input value={comment} onChange={e => setComment(e.target.value)} placeholder={mode === 'reject' ? 'Rejection reason (required)' : mode === 'correction' ? 'Correction note...' : 'Optional comment...'}
            className="flex-1 border rounded px-2 py-1 text-xs" />
          <button onClick={() => {
            if (mode === 'reject') { if (!comment.trim()) return; onReject(item.id, 'Current User', comment); }
            else if (mode === 'correction') { if (!comment.trim()) return; onCorrection(item.id, 'Current User', comment); }
            else { onAdvance(item.id, 'Current User', comment); }
            setShowComment(false); setMode(null); setComment('');
          }} className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
            Confirm
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Item Card ────────────────────────────────────────────────────────────────
function ItemCard({
  item, onAdvance, onReject, onCorrection, onResubmit, onPost,
}: {
  item: ApprovalItem;
  onAdvance: (id: string, by: string, note?: string) => void;
  onReject: (id: string, by: string, reason: string) => void;
  onCorrection: (id: string, by: string, note: string) => void;
  onResubmit: (id: string, by: string) => void;
  onPost: (id: string, by: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfoThreshold = getCFOThreshold();
  const isCFO = item.totalAmount >= cfoThreshold;

  return (
    <div className={`bg-white border rounded-lg shadow-sm ${isCFO ? 'border-red-200' : 'border-slate-200'}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold text-sm text-slate-800">{item.title}</span>
              {isCFO && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded font-medium">CFO Required</span>}
              <StageBadge stage={item.status} />
              <span className={`px-1.5 py-0.5 rounded text-xs ${item.priority === 'Urgent' ? 'bg-red-100 text-red-600' : item.priority === 'High' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                {item.priority}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
              <span>#{item.refNumber}</span>
              <span>•</span>
              <span>{item.type}</span>
              <span>•</span>
              <span>{item.party}</span>
              <span>•</span>
              <span className="font-semibold text-slate-700">{item.currency} {item.totalAmount.toLocaleString('en-AE', { minimumFractionDigits: 2 })}</span>
              <span>•</span>
              <span>by {item.submittedBy}</span>
            </div>
            <div className="mt-2">
              <WorkflowPipeline current={item.status} />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setExpanded(!expanded)}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-400">
              {expanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
            </button>
          </div>
        </div>

        <div className="mt-3">
          <ActionButtons item={item} onAdvance={onAdvance} onReject={onReject} onCorrection={onCorrection} onResubmit={onResubmit} onPost={onPost} />
        </div>
      </div>

      {expanded && (
        <div className="border-t bg-slate-50 p-4 space-y-4">
          {/* Routing info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-white rounded p-2 border">
              <div className="text-slate-500 mb-1">Manager Approver</div>
              <div className="font-semibold text-slate-800">{item.managerLabel}</div>
            </div>
            <div className="bg-white rounded p-2 border">
              <div className="text-slate-500 mb-1">Finance Approver</div>
              <div className="font-semibold text-slate-800">{item.financeLabel}</div>
            </div>
            <div className="bg-white rounded p-2 border">
              <div className="text-slate-500 mb-1">Amount (excl. VAT)</div>
              <div className="font-semibold text-slate-800">{item.currency} {item.amount.toLocaleString()}</div>
            </div>
            <div className="bg-white rounded p-2 border">
              <div className="text-slate-500 mb-1">VAT (5%)</div>
              <div className="font-semibold text-slate-800">{item.currency} {item.vatAmount.toLocaleString()}</div>
            </div>
          </div>

          {/* Threshold rule */}
          <div className={`p-3 rounded text-xs border ${isCFO ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <span className={`font-semibold ${isCFO ? 'text-red-700' : 'text-green-700'}`}>
              {isCFO ? '🔴 CFO Approval Required' : '🟢 Finance Manager Approval'} — 
              {isCFO ? ` Amount ≥ AED ${cfoThreshold.toLocaleString()} threshold` : ` Amount < AED ${cfoThreshold.toLocaleString()} threshold`}
            </span>
          </div>

          {/* Correction / rejection notes */}
          {item.correctionNote && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs">
              <span className="font-semibold text-amber-700">Correction Required: </span>
              <span className="text-amber-800">{item.correctionNote}</span>
            </div>
          )}
          {item.rejectionReason && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs">
              <span className="font-semibold text-red-700">Rejected: </span>
              <span className="text-red-800">{item.rejectionReason}</span>
            </div>
          )}

          {/* History */}
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
              <MessageSquare size={12}/> Approval History
            </div>
            <div className="space-y-2">
              {item.history.map(h => (
                <div key={h.id} className="flex gap-3 text-xs">
                  <div className="w-32 text-slate-400 shrink-0">
                    {new Date(h.timestamp).toLocaleDateString()}
                  </div>
                  <div className="flex-1">
                    <span className="font-medium text-slate-700">{h.performedBy}</span>
                    <span className="text-slate-500"> — {h.action}</span>
                    {h.notes && <div className="text-slate-400 italic mt-0.5">"{h.notes}"</div>}
                  </div>
                  <div className="shrink-0">
                    <StageBadge stage={h.toStatus} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ApprovalEngine() {
  const { items, stats, advanceStage, rejectItem, requestCorrection, resubmit, postToGL } = useApproval();
  const [activeTab, setActiveTab] = useState<WorkflowStage | 'All'>('All');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const cfoThreshold = getCFOThreshold();

  const tabs: { key: WorkflowStage | 'All'; label: string; count: number }[] = [
    { key: 'All',                label: 'All',              count: stats.total },
    { key: 'Draft',              label: 'Draft',            count: stats.draft },
    { key: 'Submitted',          label: 'Submitted',        count: stats.submitted },
    { key: 'Manager Approval',   label: 'Manager',          count: stats.managerApproval },
    { key: 'Finance Approval',   label: 'Finance',          count: stats.financeApproval },
    { key: 'Accounting Posting', label: 'Acctg Post',       count: stats.accountingPosting },
    { key: 'Posted',             label: 'Posted',           count: stats.posted },
    { key: 'Rejected',           label: 'Rejected',         count: stats.rejected },
    { key: 'Correction Requested', label: 'Correction',     count: stats.correctionRequested },
  ];

  const filtered = items
    .filter(i => activeTab === 'All' || i.status === activeTab)
    .filter(i => typeFilter === 'All' || i.type === typeFilter)
    .filter(i => !search || i.title.toLowerCase().includes(search.toLowerCase()) || i.refNumber.toLowerCase().includes(search.toLowerCase()) || i.party.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Approval Engine</h1>
          <p className="text-slate-500 text-sm mt-1">Maker-Checker workflow: Draft → Submitted → Manager Approval → Finance Approval → Accounting Posting</p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <div>CFO Threshold: <span className="font-bold text-red-600">AED {cfoThreshold.toLocaleString()}</span></div>
          <div className="text-slate-400">Configure in Settings → Approval Controls</div>
        </div>
      </div>

      {/* Pipeline Overview */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="text-sm font-semibold text-slate-700 mb-4">Workflow Pipeline</div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { stage: 'Draft', label: 'Draft', count: stats.draft, color: 'bg-slate-100 text-slate-600 border-slate-200' },
            { stage: 'Submitted', label: 'Submitted', count: stats.submitted, color: 'bg-blue-100 text-blue-700 border-blue-200' },
            { stage: 'Manager Approval', label: 'Manager Approval', count: stats.managerApproval, color: 'bg-amber-100 text-amber-700 border-amber-200' },
            { stage: 'Finance Approval', label: 'Finance Approval', count: stats.financeApproval, color: 'bg-purple-100 text-purple-700 border-purple-200' },
            { stage: 'Accounting Posting', label: 'Acctg Posting', count: stats.accountingPosting, color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
            { stage: 'Posted', label: 'Posted', count: stats.posted, color: 'bg-green-100 text-green-700 border-green-200' },
          ].map((s, i, arr) => (
            <div key={s.stage} className="flex items-center gap-2">
              <div className={`px-4 py-3 rounded-lg border text-center min-w-[100px] ${s.color}`}>
                <div className="text-2xl font-bold">{s.count}</div>
                <div className="text-xs font-medium mt-0.5">{s.label}</div>
              </div>
              {i < arr.length - 1 && <ArrowRight size={18} className="text-slate-300" />}
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4 text-xs">
          <div className="bg-amber-50 border border-amber-200 rounded p-3">
            <div className="font-semibold text-amber-700">Pending Value</div>
            <div className="text-lg font-bold text-amber-800">AED {stats.pendingValue.toLocaleString('en-AE', { minimumFractionDigits: 0 })}</div>
            <div className="text-amber-600">awaiting approval</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <div className="font-semibold text-red-700">Rejected</div>
            <div className="text-lg font-bold text-red-800">{stats.rejected}</div>
            <div className="text-red-600">needs attention</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded p-3">
            <div className="font-semibold text-orange-700">Correction Needed</div>
            <div className="text-lg font-bold text-orange-800">{stats.correctionRequested}</div>
            <div className="text-orange-600">waiting re-submission</div>
          </div>
        </div>
      </div>

      {/* Threshold Rules */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="text-sm font-semibold text-slate-700 mb-3">Active Threshold Rules</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center">
              <User size={14} className="text-green-700" />
            </div>
            <div>
              <div className="text-xs font-semibold text-green-800">Amount &lt; AED {cfoThreshold.toLocaleString()}</div>
              <div className="text-xs text-green-600">Finance Manager approves at Manager stage</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="w-8 h-8 bg-red-200 rounded-full flex items-center justify-center">
              <Shield size={14} className="text-red-700" />
            </div>
            <div>
              <div className="text-xs font-semibold text-red-800">Amount ≥ AED {cfoThreshold.toLocaleString()}</div>
              <div className="text-xs text-red-600">CFO approves at Manager stage + Finance Director at Finance stage</div>
            </div>
          </div>
        </div>
        <div className="mt-2 text-xs text-slate-400">Configure in Settings → Approval Controls</div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search requests..."
            className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option value="All">All Types</option>
            <option value="Invoice">Invoice</option>
            <option value="Expense">Expense</option>
            <option value="Purchase">Purchase</option>
            <option value="Journal Entry">Journal Entry</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap border-b border-slate-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.label}
            {t.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${activeTab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Eye size={32} className="mx-auto mb-2 opacity-30" />
            <div>No approval requests found</div>
          </div>
        ) : (
          filtered.map(item => (
            <ItemCard key={item.id} item={item}
              onAdvance={advanceStage}
              onReject={rejectItem}
              onCorrection={requestCorrection}
              onResubmit={resubmit}
              onPost={(id, by) => postToGL(id, by)}
            />
          ))
        )}
      </div>

      {/* DB Schema */}
      <div className="bg-slate-900 rounded-xl p-5 text-xs font-mono">
        <div className="text-green-400 font-semibold mb-3">-- Database Tables</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              name: 'approval_workflows',
              cols: ['id UUID PK', 'module VARCHAR(50)', 'threshold_amount DECIMAL', 'approver_role VARCHAR', 'sequence INT', 'is_active BOOLEAN', 'created_at TIMESTAMP']
            },
            {
              name: 'approval_requests',
              cols: ['id UUID PK', 'module VARCHAR(50)', 'record_id VARCHAR(100)', 'requested_by UUID → users', 'status VARCHAR(50)', 'amount DECIMAL', 'currency CHAR(3)', 'created_at TIMESTAMP']
            },
            {
              name: 'approval_actions',
              cols: ['id UUID PK', 'request_id UUID → requests', 'user_id UUID → users', 'action VARCHAR(100)', 'from_status VARCHAR', 'to_status VARCHAR', 'comments TEXT', 'timestamp TIMESTAMP']
            }
          ].map(t => (
            <div key={t.name}>
              <div className="text-blue-400 mb-2">TABLE {t.name}</div>
              {t.cols.map(c => <div key={c} className="text-slate-400 pl-2">• {c}</div>)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
