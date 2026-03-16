import { useState } from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle, ArrowRight, Shield } from 'lucide-react';
import { useApproval, WorkflowStage } from '../context/ApprovalContext';

export default function FinanceApprovalQueue() {
  const { items, stats, advanceStage, rejectItem, requestCorrection, postToGL, getItemsByStage } = useApproval();
  const [tab, setTab] = useState<WorkflowStage | 'All'>('All');
  const [comment, setComment] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<'approve' | 'reject' | 'correct' | null>(null);

  const displayed = getItemsByStage(tab);

  const stageColor: Record<string, string> = {
    'Draft': 'bg-slate-100 text-slate-600',
    'Submitted': 'bg-blue-100 text-blue-700',
    'Manager Approval': 'bg-amber-100 text-amber-700',
    'Finance Approval': 'bg-purple-100 text-purple-700',
    'Accounting Posting': 'bg-indigo-100 text-indigo-700',
    'Posted': 'bg-green-100 text-green-700',
    'Rejected': 'bg-red-100 text-red-700',
    'Correction Requested': 'bg-orange-100 text-orange-700',
  };

  const handleAction = (id: string) => {
    if (!comment.trim() && (actionMode === 'reject' || actionMode === 'correct')) return;
    if (actionMode === 'approve') advanceStage(id, 'Finance User', comment);
    else if (actionMode === 'reject') rejectItem(id, 'Finance User', comment);
    else if (actionMode === 'correct') requestCorrection(id, 'Finance User', comment);
    setActionId(null); setActionMode(null); setComment('');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Finance Approval Queue</h1>
          <p className="text-slate-500 text-sm">Workflow: Draft → Submitted → Manager Approval → Finance Approval → Accounting Posting</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Submitted', value: stats.submitted, color: 'text-blue-600', icon: <Clock size={18}/> },
          { label: 'Manager Approval', value: stats.managerApproval, color: 'text-amber-600', icon: <Shield size={18}/> },
          { label: 'Finance Approval', value: stats.financeApproval, color: 'text-purple-600', icon: <Shield size={18}/> },
          { label: 'Acctg Posting', value: stats.accountingPosting, color: 'text-indigo-600', icon: <ArrowRight size={18}/> },
          { label: 'Posted', value: stats.posted, color: 'text-green-600', icon: <CheckCircle size={18}/> },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border p-4">
            <div className={`${k.color} mb-1`}>{k.icon}</div>
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-xs text-slate-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap border-b">
        {(['All', 'Submitted', 'Manager Approval', 'Finance Approval', 'Accounting Posting', 'Posted', 'Rejected', 'Correction Requested'] as (WorkflowStage | 'All')[]).map(t => {
          const cnt = t === 'All' ? items.length : items.filter(i => i.status === t).length;
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t} {cnt > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-slate-100">{cnt}</span>}
            </button>
          );
        })}
      </div>

      {/* Items */}
      <div className="space-y-3">
        {displayed.length === 0 && (
          <div className="text-center py-12 text-slate-400">No items in this stage</div>
        )}
        {displayed.map(item => (
          <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800">{item.title}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stageColor[item.status] ?? 'bg-slate-100 text-slate-600'}`}>{item.status}</span>
                  {item.requiresCFO && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">CFO Required</span>}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  #{item.refNumber} · {item.type} · {item.party} · <span className="font-semibold text-slate-700">{item.currency} {item.totalAmount.toLocaleString()}</span> · by {item.submittedBy}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Manager: <strong>{item.managerLabel}</strong> · Finance: <strong>{item.financeLabel}</strong>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                {item.status !== 'Posted' && item.status !== 'Rejected' && (
                  <>
                    {item.status === 'Accounting Posting' ? (
                      <button onClick={() => postToGL(item.id, 'Finance User')}
                        className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700">Post GL</button>
                    ) : (
                      <button onClick={() => { setActionId(item.id); setActionMode('approve'); }}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700">
                        <CheckCircle size={12} className="inline mr-1"/>Advance
                      </button>
                    )}
                    <button onClick={() => { setActionId(item.id); setActionMode('correct'); }}
                      className="px-3 py-1.5 bg-amber-500 text-white text-xs rounded hover:bg-amber-600">
                      <AlertTriangle size={12} className="inline mr-1"/>Correct
                    </button>
                    <button onClick={() => { setActionId(item.id); setActionMode('reject'); }}
                      className="px-3 py-1.5 bg-red-500 text-white text-xs rounded hover:bg-red-600">
                      <XCircle size={12} className="inline mr-1"/>Reject
                    </button>
                  </>
                )}
                {item.status === 'Posted' && item.glEntryRef && (
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">{item.glEntryRef}</span>
                )}
              </div>
            </div>

            {actionId === item.id && actionMode && (
              <div className="flex gap-2 pt-2 border-t">
                <input value={comment} onChange={e => setComment(e.target.value)}
                  placeholder={actionMode === 'reject' ? 'Rejection reason (required)' : actionMode === 'correct' ? 'Correction note (required)' : 'Optional comment...'}
                  className="flex-1 border rounded px-3 py-1.5 text-sm" />
                <button onClick={() => handleAction(item.id)}
                  className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">Confirm</button>
                <button onClick={() => { setActionId(null); setActionMode(null); setComment(''); }}
                  className="px-3 py-1.5 bg-slate-200 text-slate-600 text-sm rounded hover:bg-slate-300">Cancel</button>
              </div>
            )}

            {item.correctionNote && (
              <div className="text-xs bg-amber-50 border border-amber-200 rounded p-2">
                <strong className="text-amber-700">Correction: </strong>{item.correctionNote}
              </div>
            )}
            {item.rejectionReason && (
              <div className="text-xs bg-red-50 border border-red-200 rounded p-2">
                <strong className="text-red-700">Rejected: </strong>{item.rejectionReason}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
