import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { catchAndReport } from '../lib/toast';
import { getCFOThreshold, routeApproval } from '../utils/approvalThresholds';
import {
  fetchApprovalItems as fetchApprovalItemsDb,
  upsertApprovalItem as upsertApprovalItemDb,
  fetchApprovalRules as fetchApprovalRulesDb,
  upsertApprovalRule as upsertApprovalRuleDb,
  deleteApprovalRuleDb,
} from '../lib/supabaseSync';

// ─── 5-Stage Workflow ─────────────────────────────────────────────────────────
//
//   Draft → Submitted → Manager Approval → Finance Approval → Accounting Posting
//
// Threshold rules determine WHO approves at Manager & Finance stages.
// GL posting is BLOCKED until stage = 'Accounting Posting' (Posted).

export type WorkflowStage =
  | 'Draft'
  | 'Submitted'
  | 'Manager Approval'
  | 'Finance Approval'
  | 'Accounting Posting'
  | 'Posted'
  | 'Rejected'
  | 'Correction Requested';

export type ApprovalItemType = 'Invoice' | 'Expense' | 'Journal Entry' | 'Purchase' | 'Credit Note';
export type ApprovalPriority = 'Low' | 'Normal' | 'High' | 'Urgent';

// Alias so existing code referencing ApprovalStatus still compiles
export type ApprovalStatus = WorkflowStage;

export interface StageInfo {
  stage: WorkflowStage;
  assignedRole: string;       // who must act at this stage
  assignedLabel: string;      // display label
  actedBy?: string;
  actedAt?: string;
  notes?: string;
  isCFORequired: boolean;
}

export interface ApprovalHistoryEvent {
  id: string;
  timestamp: string;
  action: string;
  performedBy: string;
  fromStatus: WorkflowStage;
  toStatus: WorkflowStage;
  notes?: string;
  stage?: string;
}

export interface ApprovalAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface ApprovalItem {
  id: string;
  refNumber: string;
  type: ApprovalItemType;
  title: string;
  description: string;
  amount: number;
  currency: string;
  vatAmount: number;
  totalAmount: number;
  submittedBy: string;
  submittedAt: string;
  submittedByDept: string;
  status: WorkflowStage;
  priority: ApprovalPriority;
  dueDate?: string;
  party: string;
  partyType: string;
  category?: string;
  notes?: string;
  attachments: ApprovalAttachment[];
  history: ApprovalHistoryEvent[];
  glPosted: boolean;
  glEntryRef?: string;
  correctionNote?: string;
  rejectionReason?: string;
  tags: string[];
  sourceData?: Record<string, unknown>;
  // Workflow routing
  managerRole: string;        // who approves at Manager stage
  managerLabel: string;
  financeRole: string;        // who approves at Finance stage
  financeLabel: string;
  requiresCFO: boolean;
  // Stage tracking
  stageHistory: StageInfo[];
}

export interface ApprovalRule {
  id: string;
  name: string;
  itemType: ApprovalItemType | 'All';
  amountThreshold: number;
  approver: string;
  isActive: boolean;
  requiresSecondApproval: boolean;
  secondApprover?: string;
  createdAt: string;
}

export interface ApprovalStats {
  total: number;
  draft: number;
  submitted: number;
  managerApproval: number;
  financeApproval: number;
  accountingPosting: number;
  posted: number;
  rejected: number;
  correctionRequested: number;
  pendingValue: number;
  approvedValue: number;
  avgApprovalHours: number;
}

// ─── Allowed transitions (strict state machine) ───────────────────────────────
const TRANSITIONS: Record<WorkflowStage, WorkflowStage[]> = {
  'Draft':                ['Submitted', 'Rejected'],
  'Submitted':            ['Manager Approval', 'Correction Requested', 'Rejected'],
  'Manager Approval':     ['Finance Approval', 'Correction Requested', 'Rejected'],
  'Finance Approval':     ['Accounting Posting', 'Correction Requested', 'Rejected'],
  'Accounting Posting':   ['Posted', 'Correction Requested', 'Rejected'],
  'Posted':               [],
  'Rejected':             ['Submitted'],                // re-submit after fix
  'Correction Requested': ['Submitted'],
};

export function canTransition(from: WorkflowStage, to: WorkflowStage): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── Build stage info from routing ───────────────────────────────────────────
function buildStageHistory(routing: ReturnType<typeof routeApproval>): StageInfo[] {
  return [
    {
      stage: 'Draft',
      assignedRole: 'maker',
      assignedLabel: 'Maker',
      isCFORequired: false,
    },
    {
      stage: 'Submitted',
      assignedRole: 'reviewer',
      assignedLabel: 'Reviewer',
      isCFORequired: false,
    },
    {
      stage: 'Manager Approval',
      assignedRole: routing.primaryApprover,
      assignedLabel: routing.primaryLabel,
      isCFORequired: routing.primaryApprover === 'cfo',
    },
    {
      stage: 'Finance Approval',
      assignedRole: routing.requiresSecondApproval && routing.secondApprover
        ? routing.secondApprover
        : 'finance_director',
      assignedLabel: routing.requiresSecondApproval
        ? 'Finance Director'
        : 'Finance Manager',
      isCFORequired: false,
    },
    {
      stage: 'Accounting Posting',
      assignedRole: 'accountant',
      assignedLabel: 'Senior Accountant',
      isCFORequired: false,
    },
  ];
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface ApprovalContextType {
  items: ApprovalItem[];
  rules: ApprovalRule[];
  stats: ApprovalStats;
  loading: boolean;
  error: string | null;
  // Core workflow actions
  submitForApproval: (item: Omit<ApprovalItem, 'id' | 'status' | 'history' | 'glPosted' | 'attachments' | 'tags' | 'stageHistory' | 'managerRole' | 'managerLabel' | 'financeRole' | 'financeLabel' | 'requiresCFO' | 'vatAmount' | 'totalAmount'>) => string;
  advanceStage: (id: string, performedBy: string, notes?: string) => void;
  rejectItem: (id: string, rejectedBy: string, reason: string) => void;
  requestCorrection: (id: string, requestedBy: string, note: string) => void;
  resubmit: (id: string, submittedBy: string) => void;
  postToGL: (id: string, postedBy: string) => boolean;
  // Helpers
  ensureApprovalRequest: (item: Omit<ApprovalItem, 'id' | 'status' | 'history' | 'glPosted' | 'attachments' | 'tags' | 'stageHistory' | 'managerRole' | 'managerLabel' | 'financeRole' | 'financeLabel' | 'requiresCFO' | 'vatAmount' | 'totalAmount'>) => string;
  getByRef: (refNumber: string, type?: ApprovalItemType) => ApprovalItem | undefined;
  canPostByRef: (refNumber: string, type?: ApprovalItemType) => boolean;
  getPendingCount: () => number;
  getItemsByStage: (stage: WorkflowStage | 'All') => ApprovalItem[];
  // Rules CRUD
  addRule: (rule: Omit<ApprovalRule, 'id' | 'createdAt'>) => void;
  updateRule: (id: string, rule: Partial<ApprovalRule>) => void;
  deleteRule: (id: string) => void;
  // legacy compat
  approveItem: (id: string, approver: string, notes?: string) => void;
  updateStatus: (id: string, status: WorkflowStage, performedBy: string, notes?: string) => void;
  getItemsByStatus: (status: WorkflowStage | 'All') => ApprovalItem[];
}

const ApprovalContext = createContext<ApprovalContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ApprovalProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [rules, setRules] = useState<ApprovalRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Load from Supabase on mount ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [itemsData, rulesData] = await Promise.all([
          fetchApprovalItemsDb(),
          fetchApprovalRulesDb(),
        ]);
        if (cancelled) return;
        if (itemsData !== null) setItems(itemsData);
        if (rulesData !== null) setRules(rulesData);
        setError(null);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load approval data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const addHistory = useCallback((item: ApprovalItem, action: string, performedBy: string, from: WorkflowStage, to: WorkflowStage, notes?: string): ApprovalItem => ({
    ...item, status: to,
    history: [...item.history, { id: `h${Date.now()}`, timestamp: new Date().toISOString(), action, performedBy, fromStatus: from, toStatus: to, notes }],
  }), []);

  // Helper to update item and sync to DB
  const updateItemAndSync = useCallback((updater: (prev: ApprovalItem[]) => ApprovalItem[]) => {
    setItems(prev => {
      const next = updater(prev);
      // find changed items and sync them
      next.forEach(item => {
        const old = prev.find(p => p.id === item.id);
        if (!old || old !== item) upsertApprovalItemDb(item).catch(catchAndReport('Update approval item'));
      });
      return next;
    });
  }, []);

  // ── Submit: Draft → Submitted ──────────────────────────────────────────────
  const submitForApproval = useCallback((itemData: Omit<ApprovalItem, 'id' | 'status' | 'history' | 'glPosted' | 'attachments' | 'tags' | 'stageHistory' | 'managerRole' | 'managerLabel' | 'financeRole' | 'financeLabel' | 'requiresCFO' | 'vatAmount' | 'totalAmount'>) => {
    const routing = routeApproval(itemData.amount, itemData.type as 'Invoice' | 'Expense' | 'Purchase' | 'Journal Entry');
    const requiresCFO = itemData.amount >= getCFOThreshold();
    const id = `APQ-${String(Date.now()).slice(-6)}`;
    const vat = Math.round(itemData.amount * 0.05 * 100) / 100;
    const newItem: ApprovalItem = {
      ...itemData, id,
      vatAmount: vat, totalAmount: itemData.amount + vat,
      status: 'Submitted', glPosted: false, attachments: [], tags: [],
      managerRole: routing.primaryApprover, managerLabel: routing.primaryLabel,
      financeRole: routing.requiresSecondApproval && routing.secondApprover ? routing.secondApprover : 'finance_director',
      financeLabel: routing.requiresSecondApproval ? 'Finance Director' : 'Finance Manager',
      requiresCFO, stageHistory: buildStageHistory(routing),
      history: [
        { id: `h${Date.now()}-1`, timestamp: new Date().toISOString(), action: 'Draft created and submitted', performedBy: itemData.submittedBy, fromStatus: 'Draft', toStatus: 'Submitted' }
      ],
    };
    setItems(prev => [newItem, ...prev]);
    upsertApprovalItemDb(newItem).catch(catchAndReport('Submit approval item'));
    return id;
  }, []);

  const ensureApprovalRequest = useCallback((itemData: Omit<ApprovalItem, 'id' | 'status' | 'history' | 'glPosted' | 'attachments' | 'tags' | 'stageHistory' | 'managerRole' | 'managerLabel' | 'financeRole' | 'financeLabel' | 'requiresCFO' | 'vatAmount' | 'totalAmount'>) => {
    const existing = items.find(i => i.refNumber === itemData.refNumber && i.type === itemData.type);
    if (existing) return existing.id;
    return submitForApproval(itemData);
  }, [items, submitForApproval]);

  // ── Advance: moves to next stage ───────────────────────────────────────────
  const advanceStage = useCallback((id: string, performedBy: string, notes?: string) => {
    const stageOrder: WorkflowStage[] = ['Draft', 'Submitted', 'Manager Approval', 'Finance Approval', 'Accounting Posting', 'Posted'];
    updateItemAndSync(prev => prev.map(item => {
      if (item.id !== id) return item;
      const idx = stageOrder.indexOf(item.status);
      if (idx === -1 || idx >= stageOrder.length - 1) return item;
      const nextStage = stageOrder[idx + 1];
      if (!canTransition(item.status, nextStage)) return item;
      const actionLabel =
        item.status === 'Draft' ? 'Submitted for approval' :
        item.status === 'Submitted' ? 'Sent to Manager for approval' :
        item.status === 'Manager Approval' ? `Manager approved — sent to Finance (${item.financeLabel})` :
        item.status === 'Finance Approval' ? 'Finance approved — ready for accounting posting' :
        item.status === 'Accounting Posting' ? 'Posted to General Ledger' : 'Advanced';
      return addHistory(item, actionLabel, performedBy, item.status, nextStage, notes);
    }));
  }, [addHistory, updateItemAndSync]);

  // ── Reject ─────────────────────────────────────────────────────────────────
  const rejectItem = useCallback((id: string, rejectedBy: string, reason: string) => {
    updateItemAndSync(prev => prev.map(item => {
      if (item.id !== id) return item;
      return addHistory({ ...item, rejectionReason: reason }, `Rejected: ${reason}`, rejectedBy, item.status, 'Rejected', reason);
    }));
  }, [addHistory, updateItemAndSync]);

  // ── Request Correction ─────────────────────────────────────────────────────
  const requestCorrection = useCallback((id: string, requestedBy: string, note: string) => {
    updateItemAndSync(prev => prev.map(item => {
      if (item.id !== id) return item;
      return addHistory({ ...item, correctionNote: note }, `Correction requested: ${note}`, requestedBy, item.status, 'Correction Requested', note);
    }));
  }, [addHistory, updateItemAndSync]);

  // ── Re-submit after correction/rejection ────────────────────────────────────
  const resubmit = useCallback((id: string, submittedBy: string) => {
    updateItemAndSync(prev => prev.map(item => {
      if (item.id !== id) return item;
      if (!canTransition(item.status, 'Submitted')) return item;
      return addHistory({ ...item, correctionNote: '', rejectionReason: '' }, 'Re-submitted after correction', submittedBy, item.status, 'Submitted');
    }));
  }, [addHistory, updateItemAndSync]);

  // ── Post to GL: only from Accounting Posting stage ─────────────────────────
  const postToGL = useCallback((id: string, postedBy: string): boolean => {
    let success = false;
    const glRef = `JE-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    updateItemAndSync(prev => prev.map(item => {
      if (item.id !== id) return item;
      if (item.status !== 'Accounting Posting') {
        return addHistory(item, `GL posting blocked — must reach Accounting Posting stage first (current: ${item.status})`, postedBy, item.status, item.status, 'Cannot post until Finance Approval is complete');
      }
      success = true;
      return addHistory({ ...item, glPosted: true, glEntryRef: glRef }, 'Posted to General Ledger', postedBy, 'Accounting Posting', 'Posted');
    }));
    return success;
  }, [addHistory, updateItemAndSync]);

  // ── Legacy compat ──────────────────────────────────────────────────────────
  const approveItem = useCallback((id: string, approver: string, notes?: string) => {
    advanceStage(id, approver, notes);
  }, [advanceStage]);

  const updateStatus = useCallback((id: string, status: WorkflowStage, performedBy: string, notes?: string) => {
    updateItemAndSync(prev => prev.map(item => item.id !== id ? item : addHistory(item, `Status → ${status}`, performedBy, item.status, status, notes)));
  }, [addHistory, updateItemAndSync]);

  // ── Queries ────────────────────────────────────────────────────────────────
  const getByRef = useCallback((refNumber: string, type?: ApprovalItemType) =>
    items.find(i => i.refNumber === refNumber && (!type || i.type === type)), [items]);

  const canPostByRef = useCallback((refNumber: string, type?: ApprovalItemType) => {
    const item = items.find(i => i.refNumber === refNumber && (!type || i.type === type));
    return !!item && (item.status === 'Accounting Posting' || item.status === 'Posted');
  }, [items]);

  const getPendingCount = useCallback(() =>
    items.filter(i => ['Submitted', 'Manager Approval', 'Finance Approval', 'Accounting Posting', 'Correction Requested'].includes(i.status)).length, [items]);

  const getItemsByStage = useCallback((stage: WorkflowStage | 'All') =>
    stage === 'All' ? items : items.filter(i => i.status === stage), [items]);

  const getItemsByStatus = getItemsByStage;

  // ── Rules CRUD ─────────────────────────────────────────────────────────────
  const addRule = useCallback((rule: Omit<ApprovalRule, 'id' | 'createdAt'>) => {
    const newRule: ApprovalRule = { ...rule, id: `R${Date.now()}`, createdAt: new Date().toISOString().split('T')[0] };
    setRules(prev => [...prev, newRule]);
    upsertApprovalRuleDb(newRule).catch(catchAndReport('Add approval rule'));
  }, []);
  const updateRule = useCallback((id: string, update: Partial<ApprovalRule>) => {
    setRules(prev => {
      const next = prev.map(r => r.id === id ? { ...r, ...update } : r);
      const changed = next.find(r => r.id === id);
      if (changed) upsertApprovalRuleDb(changed).catch(catchAndReport('Update approval rule'));
      return next;
    });
  }, []);
  const deleteRule = useCallback((id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
    deleteApprovalRuleDb(id).catch(catchAndReport('Delete approval rule'));
  }, []);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats: ApprovalStats = {
    total: items.length,
    draft: items.filter(i => i.status === 'Draft').length,
    submitted: items.filter(i => i.status === 'Submitted').length,
    managerApproval: items.filter(i => i.status === 'Manager Approval').length,
    financeApproval: items.filter(i => i.status === 'Finance Approval').length,
    accountingPosting: items.filter(i => i.status === 'Accounting Posting').length,
    posted: items.filter(i => i.status === 'Posted').length,
    rejected: items.filter(i => i.status === 'Rejected').length,
    correctionRequested: items.filter(i => i.status === 'Correction Requested').length,
    pendingValue: items.filter(i => ['Submitted', 'Manager Approval', 'Finance Approval', 'Accounting Posting'].includes(i.status)).reduce((s, i) => s + i.totalAmount, 0),
    approvedValue: items.filter(i => ['Posted'].includes(i.status)).reduce((s, i) => s + i.totalAmount, 0),
    avgApprovalHours: 4.2,
  };

  return (
    <ApprovalContext.Provider value={{
      items, rules, stats, loading, error,
      submitForApproval, advanceStage, rejectItem, requestCorrection, resubmit, postToGL,
      ensureApprovalRequest, getByRef, canPostByRef, getPendingCount, getItemsByStage,
      addRule, updateRule, deleteRule,
      approveItem, updateStatus, getItemsByStatus,
    }}>
      {children}
    </ApprovalContext.Provider>
  );
}

export function useApproval() {
  const ctx = useContext(ApprovalContext);
  if (!ctx) throw new Error('useApproval must be used within ApprovalProvider');
  return ctx;
}
