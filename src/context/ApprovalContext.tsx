import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getCFOThreshold, routeApproval } from '../utils/approvalThresholds';

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

// ─── Seed Data ────────────────────────────────────────────────────────────────
function makeSeedItem(
  id: string,
  refNumber: string,
  type: ApprovalItemType,
  title: string,
  description: string,
  amount: number,
  currency: string,
  party: string,
  partyType: string,
  category: string,
  submittedBy: string,
  dept: string,
  status: WorkflowStage,
  priority: ApprovalPriority,
  glPosted: boolean,
  glEntryRef?: string,
): ApprovalItem {
  const routing = routeApproval(amount, type as 'Invoice' | 'Expense' | 'Purchase' | 'Journal Entry');
  const requiresCFO = amount >= getCFOThreshold();
  return {
    id, refNumber, type, title, description, amount, currency,
    vatAmount: Math.round(amount * 0.05 * 100) / 100,
    totalAmount: Math.round(amount * 1.05 * 100) / 100,
    submittedBy, submittedAt: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
    submittedByDept: dept, status, priority,
    party, partyType, category,
    notes: '', attachments: [], correctionNote: '', rejectionReason: '', tags: [],
    glPosted, glEntryRef,
    managerRole: routing.primaryApprover,
    managerLabel: routing.primaryLabel,
    financeRole: routing.requiresSecondApproval && routing.secondApprover ? routing.secondApprover : 'finance_director',
    financeLabel: routing.requiresSecondApproval ? 'Finance Director' : 'Finance Manager',
    requiresCFO,
    stageHistory: buildStageHistory(routing),
    history: [
      { id: `h${Date.now()}-1`, timestamp: new Date(Date.now() - 86400000).toISOString(), action: 'Draft created', performedBy: submittedBy, fromStatus: 'Draft', toStatus: 'Draft' },
      ...(status !== 'Draft' ? [{ id: `h${Date.now()}-2`, timestamp: new Date(Date.now() - 72000000).toISOString(), action: 'Submitted for approval', performedBy: submittedBy, fromStatus: 'Draft' as WorkflowStage, toStatus: 'Submitted' as WorkflowStage }] : []),
      ...((['Manager Approval', 'Finance Approval', 'Accounting Posting', 'Posted'] as WorkflowStage[]).includes(status) ? [{ id: `h${Date.now()}-3`, timestamp: new Date(Date.now() - 48000000).toISOString(), action: 'Moved to Manager Approval', performedBy: 'System', fromStatus: 'Submitted' as WorkflowStage, toStatus: 'Manager Approval' as WorkflowStage }] : []),
      ...((['Finance Approval', 'Accounting Posting', 'Posted'] as WorkflowStage[]).includes(status) ? [{ id: `h${Date.now()}-4`, timestamp: new Date(Date.now() - 36000000).toISOString(), action: 'Manager Approved', performedBy: routing.primaryLabel, fromStatus: 'Manager Approval' as WorkflowStage, toStatus: 'Finance Approval' as WorkflowStage }] : []),
      ...((['Accounting Posting', 'Posted'] as WorkflowStage[]).includes(status) ? [{ id: `h${Date.now()}-5`, timestamp: new Date(Date.now() - 24000000).toISOString(), action: 'Finance Approved', performedBy: 'Finance Director', fromStatus: 'Finance Approval' as WorkflowStage, toStatus: 'Accounting Posting' as WorkflowStage }] : []),
      ...(status === 'Posted' ? [{ id: `h${Date.now()}-6`, timestamp: new Date(Date.now() - 3600000).toISOString(), action: 'Posted to General Ledger', performedBy: 'Senior Accountant', fromStatus: 'Accounting Posting' as WorkflowStage, toStatus: 'Posted' as WorkflowStage }] : []),
    ],
  };
}

const SEED_ITEMS: ApprovalItem[] = [
  makeSeedItem('APQ-001', 'INV-2024-0089', 'Invoice', 'Agent Invoice — Global Tours UK', 'Desert Safari Package × 4 guests', 12500, 'AED', 'Global Tours UK', 'Agent', 'Tour Package', 'Sara Ahmed', 'Sales', 'Manager Approval', 'High', false),
  makeSeedItem('APQ-002', 'EXP-2024-0142', 'Expense', 'Fuel & Transport — June Fleet', 'Monthly fuel for 8 vehicles', 4800, 'AED', 'Gulf Transport Co.', 'Supplier', 'Fuel', 'Omar Khalid', 'Operations', 'Finance Approval', 'Normal', false),
  makeSeedItem('APQ-003', 'INV-2024-0091', 'Invoice', 'Customer Invoice — Dubai Tour', '5-day Dubai Experience Package', 8750, 'AED', 'Mr. James Wilson', 'Customer', 'Tour Package', 'Aisha Rahman', 'Sales', 'Accounting Posting', 'Normal', false),
  makeSeedItem('APQ-004', 'EXP-2024-0139', 'Expense', 'Hotel Payments — Marriott May', 'Hotel costs for May group bookings', 22000, 'AED', 'Marriott Hotels UAE', 'Supplier', 'Hotel Payment', 'Ravi Shankar', 'Operations', 'Correction Requested', 'High', false),
  makeSeedItem('APQ-005', 'INV-2024-0085', 'Invoice', 'Supplier Invoice — Desert Safari', 'Activity tickets and guide fees', 6200, 'AED', 'Desert Safari LLC', 'Supplier', 'Activities', 'Sara Ahmed', 'Finance', 'Posted', 'Normal', true, 'JE-2024-0156'),
  makeSeedItem('APQ-006', 'EXP-2024-0145', 'Expense', 'Marketing Campaign — Social Media', 'Instagram & Google Ads June', 9500, 'AED', 'Digital Media Agency', 'Supplier', 'Marketing', 'Layla Hassan', 'Marketing', 'Rejected', 'Normal', false),
  makeSeedItem('APQ-007', 'INV-2024-0092', 'Invoice', 'Agent Invoice — Euro Holidays', 'Visa Services + Airport Transfers × 12 pax', 5400, 'USD', 'Euro Holidays', 'Agent', 'Visa Services', 'Sara Ahmed', 'Sales', 'Submitted', 'Urgent', false),
  makeSeedItem('APQ-008', 'PO-2024-0033', 'Purchase', 'Purchase Order — Office Supplies', 'Monthly office supplies', 1200, 'AED', 'Al Futtaim Stationery', 'Supplier', 'Office Supplies', 'Fatima Al Zaabi', 'Admin', 'Draft', 'Low', false),
];

const SEED_RULES: ApprovalRule[] = [
  { id: 'R1', name: 'High-Value Invoice → CFO', itemType: 'Invoice', amountThreshold: 10000, approver: 'CFO', isActive: true, requiresSecondApproval: true, secondApprover: 'Finance Director', createdAt: '2024-01-01' },
  { id: 'R2', name: 'Standard Expense → Finance Manager', itemType: 'Expense', amountThreshold: 0, approver: 'Finance Manager', isActive: true, requiresSecondApproval: false, createdAt: '2024-01-01' },
  { id: 'R3', name: 'Purchase Order → Finance Manager', itemType: 'Purchase', amountThreshold: 5000, approver: 'Finance Manager', isActive: true, requiresSecondApproval: false, createdAt: '2024-01-01' },
  { id: 'R4', name: 'Journal Entry → Senior Accountant', itemType: 'Journal Entry', amountThreshold: 0, approver: 'Senior Accountant', isActive: true, requiresSecondApproval: true, secondApprover: 'Finance Manager', createdAt: '2024-01-01' },
];

// ─── Context ──────────────────────────────────────────────────────────────────

interface ApprovalContextType {
  items: ApprovalItem[];
  rules: ApprovalRule[];
  stats: ApprovalStats;
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
  const [items, setItems] = useState<ApprovalItem[]>(() => {
    try { const s = localStorage.getItem('approvalQueue'); return s ? JSON.parse(s) : SEED_ITEMS; }
    catch { return SEED_ITEMS; }
  });

  const [rules, setRules] = useState<ApprovalRule[]>(() => {
    try { const s = localStorage.getItem('approvalRules'); return s ? JSON.parse(s) : SEED_RULES; }
    catch { return SEED_RULES; }
  });

  useEffect(() => { localStorage.setItem('approvalQueue', JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem('approvalRules', JSON.stringify(rules)); }, [rules]);

  // Mirror to DB-table keys
  useEffect(() => {
    const requests = items.map(i => ({ id: i.id, module: i.type, record_id: i.refNumber, requested_by: i.submittedBy, status: i.status, created_at: i.submittedAt, amount: i.totalAmount, currency: i.currency }));
    const actions = items.flatMap(i => i.history.map(h => ({ id: h.id, request_id: i.id, user_id: h.performedBy, action: h.action, comments: h.notes || '', timestamp: h.timestamp })));
    localStorage.setItem('approval_requests', JSON.stringify(requests));
    localStorage.setItem('approval_actions', JSON.stringify(actions));
  }, [items]);

  const addHistory = useCallback((item: ApprovalItem, action: string, performedBy: string, from: WorkflowStage, to: WorkflowStage, notes?: string): ApprovalItem => ({
    ...item, status: to,
    history: [...item.history, { id: `h${Date.now()}`, timestamp: new Date().toISOString(), action, performedBy, fromStatus: from, toStatus: to, notes }],
  }), []);

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
    setItems(prev => prev.map(item => {
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
  }, [addHistory]);

  // ── Reject ─────────────────────────────────────────────────────────────────
  const rejectItem = useCallback((id: string, rejectedBy: string, reason: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      return addHistory({ ...item, rejectionReason: reason }, `Rejected: ${reason}`, rejectedBy, item.status, 'Rejected', reason);
    }));
  }, [addHistory]);

  // ── Request Correction ─────────────────────────────────────────────────────
  const requestCorrection = useCallback((id: string, requestedBy: string, note: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      return addHistory({ ...item, correctionNote: note }, `Correction requested: ${note}`, requestedBy, item.status, 'Correction Requested', note);
    }));
  }, [addHistory]);

  // ── Re-submit after correction/rejection ────────────────────────────────────
  const resubmit = useCallback((id: string, submittedBy: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      if (!canTransition(item.status, 'Submitted')) return item;
      return addHistory({ ...item, correctionNote: '', rejectionReason: '' }, 'Re-submitted after correction', submittedBy, item.status, 'Submitted');
    }));
  }, [addHistory]);

  // ── Post to GL: only from Accounting Posting stage ─────────────────────────
  const postToGL = useCallback((id: string, postedBy: string): boolean => {
    let success = false;
    const glRef = `JE-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      if (item.status !== 'Accounting Posting') {
        // Block — log the attempt
        return addHistory(item, `GL posting blocked — must reach Accounting Posting stage first (current: ${item.status})`, postedBy, item.status, item.status, 'Cannot post until Finance Approval is complete');
      }
      success = true;
      return addHistory({ ...item, glPosted: true, glEntryRef: glRef }, 'Posted to General Ledger', postedBy, 'Accounting Posting', 'Posted');
    }));
    return success;
  }, [addHistory]);

  // ── Legacy compat ──────────────────────────────────────────────────────────
  const approveItem = useCallback((id: string, approver: string, notes?: string) => {
    advanceStage(id, approver, notes);
  }, [advanceStage]);

  const updateStatus = useCallback((id: string, status: WorkflowStage, performedBy: string, notes?: string) => {
    setItems(prev => prev.map(item => item.id !== id ? item : addHistory(item, `Status → ${status}`, performedBy, item.status, status, notes)));
  }, [addHistory]);

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
    setRules(prev => [...prev, { ...rule, id: `R${Date.now()}`, createdAt: new Date().toISOString().split('T')[0] }]);
  }, []);
  const updateRule = useCallback((id: string, update: Partial<ApprovalRule>) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, ...update } : r));
  }, []);
  const deleteRule = useCallback((id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
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
      items, rules, stats,
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
