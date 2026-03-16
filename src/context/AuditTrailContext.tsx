import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'APPROVE'
  | 'REJECT'
  | 'POST'
  | 'SUBMIT'
  | 'REVERSE'
  | 'LOGIN'
  | 'EXPORT'
  | 'IMPORT'
  | 'PAYMENT'
  | 'MATCH'
  | 'UNMATCH'
  | 'CONVERT'
  | 'CLOSE_PERIOD'
  | 'REOPEN_PERIOD';

export type AuditModule =
  | 'Sales & Booking Estimate'
  | 'Invoices'
  | 'Expenses'
  | 'Journal Entries'
  | 'Chart of Accounts'
  | 'General Ledger'
  | 'Trial Balance'
  | 'Bank & Cash'
  | 'Bank Reconciliation'
  | 'Purchases'
  | 'Agents'
  | 'Suppliers'
  | 'Transport'
  | 'CRM Leads'
  | 'HR Module'
  | 'VAT & Tax'
  | 'Forecasting'
  | 'Settings'
  | 'Finance Approval Queue'
  | 'Tour Package Costing'
  | 'Multi-Currency'
  | 'Fixed Assets'
  | 'Inventory'
  | 'System';

export interface FieldDiff {
  field: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
  type: 'text' | 'number' | 'date' | 'status' | 'currency' | 'boolean';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  action: AuditAction;
  module: AuditModule;
  entityId: string;
  entityType: string;
  entityLabel: string;        // human-readable label e.g. "Invoice INV-0042"
  description: string;        // human-readable summary
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  diffs?: FieldDiff[];        // computed diff between old and new
  ipAddress: string;
  sessionId: string;
  tags: string[];             // searchable tags e.g. ["high-value", "approved"]
  severity: 'info' | 'warning' | 'critical';
  isReversible: boolean;
  metadata?: Record<string, unknown>; // extra context
}

export interface AuditStats {
  total: number;
  today: number;
  byAction: Record<string, number>;
  byModule: Record<string, number>;
  byUser: Record<string, number>;
  criticalCount: number;
  lastActivity: string;
}

interface AuditTrailContextValue {
  logs: AuditLog[];
  stats: AuditStats;
  logAction: (params: LogActionParams) => AuditLog;
  clearLogs: () => void;
  exportCSV: (filtered?: AuditLog[]) => void;
  getEntityHistory: (entityId: string) => AuditLog[];
  getDiff: (oldValues: Record<string, unknown>, newValues: Record<string, unknown>) => FieldDiff[];
}

export interface LogActionParams {
  action: AuditAction;
  module: AuditModule;
  entityId: string;
  entityType: string;
  entityLabel: string;
  description: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  tags?: string[];
  severity?: 'info' | 'warning' | 'critical';
  metadata?: Record<string, unknown>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CURRENT_USER = { id: 'USR001', name: 'John Admin', role: 'Administrator' };

const randomIP = () => {
  const subnets = ['192.168.1', '10.0.0', '172.16.0'];
  return `${subnets[Math.floor(Math.random() * subnets.length)]}.${Math.floor(Math.random() * 254) + 1}`;
};

const randomSession = () => 'sess_' + Math.random().toString(36).slice(2, 10);
const SESSION_ID = randomSession();

function computeDiffs(
  oldVals: Record<string, unknown> = {},
  newVals: Record<string, unknown> = {}
): FieldDiff[] {
  const allKeys = new Set([...Object.keys(oldVals), ...Object.keys(newVals)]);
  const diffs: FieldDiff[] = [];
  allKeys.forEach(key => {
    const ov = oldVals[key];
    const nv = newVals[key];
    if (JSON.stringify(ov) !== JSON.stringify(nv)) {
      let type: FieldDiff['type'] = 'text';
      if (typeof ov === 'number' || typeof nv === 'number') {
        type = key.toLowerCase().includes('amount') || key.toLowerCase().includes('price') || key.toLowerCase().includes('salary')
          ? 'currency' : 'number';
      }
      if (key.toLowerCase().includes('date')) type = 'date';
      if (key.toLowerCase() === 'status') type = 'status';
      if (typeof ov === 'boolean' || typeof nv === 'boolean') type = 'boolean';
      diffs.push({
        field: key,
        label: key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim(),
        oldValue: ov,
        newValue: nv,
        type,
      });
    }
  });
  return diffs;
}

function computeStats(logs: AuditLog[]): AuditStats {
  const today = new Date().toISOString().split('T')[0];
  const byAction: Record<string, number> = {};
  const byModule: Record<string, number> = {};
  const byUser: Record<string, number> = {};
  let criticalCount = 0;
  logs.forEach(l => {
    byAction[l.action] = (byAction[l.action] || 0) + 1;
    byModule[l.module] = (byModule[l.module] || 0) + 1;
    byUser[l.userName] = (byUser[l.userName] || 0) + 1;
    if (l.severity === 'critical') criticalCount++;
  });
  return {
    total: logs.length,
    today: logs.filter(l => l.timestamp.startsWith(today)).length,
    byAction,
    byModule,
    byUser,
    criticalCount,
    lastActivity: logs.length > 0 ? logs[0].timestamp : '',
  };
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SEED_LOGS: AuditLog[] = [
  {
    id: 'AL001', timestamp: '2024-01-25T10:30:15Z',
    userId: 'USR001', userName: 'John Admin', userRole: 'Administrator',
    action: 'CREATE', module: 'Journal Entries', entityId: 'JE-2024-007',
    entityType: 'JournalEntry', entityLabel: 'Journal Entry JE-2024-007',
    description: 'Created journal entry for Sales Revenue AED 15,000',
    oldValues: undefined,
    newValues: { date: '2024-01-25', description: 'Sales Revenue', totalDebit: 15000, status: 'Draft' },
    diffs: [],
    ipAddress: '192.168.1.100', sessionId: 'sess_abc123', tags: ['journal', 'sales'],
    severity: 'info', isReversible: true,
  },
  {
    id: 'AL002', timestamp: '2024-01-25T09:15:22Z',
    userId: 'USR002', userName: 'Sarah Manager', userRole: 'Manager',
    action: 'APPROVE', module: 'Invoices', entityId: 'INV-0042',
    entityType: 'Invoice', entityLabel: 'Invoice INV-0042',
    description: 'Approved invoice INV-0042 for AED 12,500',
    oldValues: { status: 'Pending Approval' },
    newValues: { status: 'Approved', approvedBy: 'Sarah Manager', approvedAt: '2024-01-25T09:15:22Z' },
    diffs: [{ field: 'status', label: 'Status', oldValue: 'Pending Approval', newValue: 'Approved', type: 'status' }],
    ipAddress: '192.168.1.105', sessionId: 'sess_def456', tags: ['invoice', 'approved', 'high-value'],
    severity: 'info', isReversible: false,
  },
  {
    id: 'AL003', timestamp: '2024-01-24T16:45:08Z',
    userId: 'USR001', userName: 'John Admin', userRole: 'Administrator',
    action: 'UPDATE', module: 'Chart of Accounts', entityId: '1000',
    entityType: 'Account', entityLabel: 'Account 1000 - Cash',
    description: 'Updated description of Cash account',
    oldValues: { name: 'Cash', description: '' },
    newValues: { name: 'Cash', description: 'Main cash account for petty cash' },
    diffs: [{ field: 'description', label: 'Description', oldValue: '', newValue: 'Main cash account for petty cash', type: 'text' }],
    ipAddress: '192.168.1.100', sessionId: 'sess_abc123', tags: ['chart-of-accounts'],
    severity: 'info', isReversible: true,
  },
  {
    id: 'AL004', timestamp: '2024-01-24T14:20:33Z',
    userId: 'USR003', userName: 'Mike Sales', userRole: 'Sales Staff',
    action: 'SUBMIT', module: 'Sales & Booking Estimate', entityId: 'BK-2024-0098',
    entityType: 'BookingEstimate', entityLabel: 'Booking BK-2024-0098',
    description: 'Submitted booking estimate to Finance for approval',
    oldValues: { status: 'Draft' },
    newValues: { status: 'Pending Approval', submittedBy: 'Mike Sales' },
    diffs: [{ field: 'status', label: 'Status', oldValue: 'Draft', newValue: 'Pending Approval', type: 'status' }],
    ipAddress: '192.168.1.110', sessionId: 'sess_ghi789', tags: ['booking', 'estimate'],
    severity: 'info', isReversible: false,
  },
  {
    id: 'AL005', timestamp: '2024-01-24T11:30:00Z',
    userId: 'USR002', userName: 'Sarah Manager', userRole: 'Manager',
    action: 'DELETE', module: 'Purchases', entityId: 'PO-0189',
    entityType: 'PurchaseOrder', entityLabel: 'Purchase Order PO-0189',
    description: 'Deleted purchase order PO-0189 (City Transport, AED 3,500)',
    oldValues: { supplier: 'City Transport', amount: 3500, status: 'Draft' },
    newValues: undefined,
    diffs: [],
    ipAddress: '192.168.1.105', sessionId: 'sess_def456', tags: ['purchase', 'deleted'],
    severity: 'warning', isReversible: false,
  },
  {
    id: 'AL006', timestamp: '2024-01-23T15:10:42Z',
    userId: 'USR004', userName: 'David Transport', userRole: 'Operations',
    action: 'CREATE', module: 'Transport', entityId: 'VEH-025',
    entityType: 'Vehicle', entityLabel: 'Vehicle VEH-025',
    description: 'Added new vehicle (Plate: AB-12345, Type: Van)',
    oldValues: undefined,
    newValues: { plate: 'AB-12345', type: 'Van', status: 'Active' },
    diffs: [],
    ipAddress: '192.168.1.115', sessionId: 'sess_jkl012', tags: ['transport', 'vehicle'],
    severity: 'info', isReversible: true,
  },
  {
    id: 'AL007', timestamp: '2024-01-23T13:45:18Z',
    userId: 'USR001', userName: 'John Admin', userRole: 'Administrator',
    action: 'POST', module: 'Journal Entries', entityId: 'JE-2024-006',
    entityType: 'JournalEntry', entityLabel: 'Journal Entry JE-2024-006',
    description: 'Posted journal entry JE-2024-006 to General Ledger',
    oldValues: { status: 'Approved' },
    newValues: { status: 'Posted', postedAt: '2024-01-23T13:45:18Z' },
    diffs: [{ field: 'status', label: 'Status', oldValue: 'Approved', newValue: 'Posted', type: 'status' }],
    ipAddress: '192.168.1.100', sessionId: 'sess_abc123', tags: ['journal', 'posted', 'gl'],
    severity: 'info', isReversible: true,
  },
  {
    id: 'AL008', timestamp: '2024-01-22T10:20:00Z',
    userId: 'USR005', userName: 'Lisa Accounts', userRole: 'Accountant',
    action: 'PAYMENT', module: 'Bank & Cash', entityId: 'TXN-0056',
    entityType: 'Transaction', entityLabel: 'Transaction TXN-0056',
    description: 'Recorded payment receipt of AED 12,000 from agent',
    oldValues: undefined,
    newValues: { amount: 12000, type: 'Credit', reference: 'TXN-0056' },
    diffs: [],
    ipAddress: '192.168.1.120', sessionId: 'sess_mno345', tags: ['payment', 'bank'],
    severity: 'info', isReversible: false,
  },
  {
    id: 'AL009', timestamp: '2024-01-22T09:00:00Z',
    userId: 'USR002', userName: 'Sarah Manager', userRole: 'Manager',
    action: 'CREATE', module: 'HR Module', entityId: 'EMP-015',
    entityType: 'Employee', entityLabel: 'Employee Alice Brown',
    description: 'Added new employee Alice Brown (Driver, Salary: AED 3,500)',
    oldValues: undefined,
    newValues: { name: 'Alice Brown', role: 'Driver', salary: 3500, department: 'Operations' },
    diffs: [],
    ipAddress: '192.168.1.105', sessionId: 'sess_def456', tags: ['hr', 'employee'],
    severity: 'info', isReversible: true,
  },
  {
    id: 'AL010', timestamp: '2024-01-21T16:30:45Z',
    userId: 'USR003', userName: 'Mike Sales', userRole: 'Sales Staff',
    action: 'CONVERT', module: 'CRM Leads', entityId: 'LD-0045',
    entityType: 'Lead', entityLabel: 'Lead LD-0045',
    description: 'Converted lead LD-0045 to booking BK-2024-0092',
    oldValues: { status: 'Hot', value: 5000 },
    newValues: { status: 'Converted', bookingRef: 'BK-2024-0092' },
    diffs: [{ field: 'status', label: 'Status', oldValue: 'Hot', newValue: 'Converted', type: 'status' }],
    ipAddress: '192.168.1.110', sessionId: 'sess_ghi789', tags: ['crm', 'converted'],
    severity: 'info', isReversible: false,
  },
  {
    id: 'AL011', timestamp: '2024-01-21T11:00:00Z',
    userId: 'USR001', userName: 'John Admin', userRole: 'Administrator',
    action: 'REJECT', module: 'Finance Approval Queue', entityId: 'BK-2024-0090',
    entityType: 'BookingEstimate', entityLabel: 'Booking Estimate BK-2024-0090',
    description: 'Rejected booking estimate — reason: Missing supplier invoice',
    oldValues: { status: 'Pending Approval' },
    newValues: { status: 'Rejected', rejectionReason: 'Missing supplier invoice' },
    diffs: [{ field: 'status', label: 'Status', oldValue: 'Pending Approval', newValue: 'Rejected', type: 'status' }],
    ipAddress: '192.168.1.100', sessionId: 'sess_abc123', tags: ['approval', 'rejected'],
    severity: 'warning', isReversible: false,
  },
  {
    id: 'AL012', timestamp: '2024-01-20T14:15:00Z',
    userId: 'USR001', userName: 'John Admin', userRole: 'Administrator',
    action: 'CLOSE_PERIOD', module: 'Journal Entries', entityId: '2024-01',
    entityType: 'AccountingPeriod', entityLabel: 'Period January 2024',
    description: 'Closed accounting period January 2024 — no further posting allowed',
    oldValues: { status: 'Open' },
    newValues: { status: 'Closed', closedBy: 'John Admin', closedAt: '2024-01-20T14:15:00Z' },
    diffs: [{ field: 'status', label: 'Status', oldValue: 'Open', newValue: 'Closed', type: 'status' }],
    ipAddress: '192.168.1.100', sessionId: 'sess_abc123', tags: ['period', 'closed'],
    severity: 'critical', isReversible: false,
  },
  {
    id: 'AL013', timestamp: '2024-01-19T09:30:00Z',
    userId: 'USR005', userName: 'Lisa Accounts', userRole: 'Accountant',
    action: 'REVERSE', module: 'Journal Entries', entityId: 'JE-2024-004',
    entityType: 'JournalEntry', entityLabel: 'Journal Entry JE-2024-004',
    description: 'Reversed journal entry JE-2024-004 — new reversal entry JE-2024-004R created',
    oldValues: { status: 'Posted' },
    newValues: { status: 'Reversed', reversedBy: 'JE-2024-004R' },
    diffs: [{ field: 'status', label: 'Status', oldValue: 'Posted', newValue: 'Reversed', type: 'status' }],
    ipAddress: '192.168.1.120', sessionId: 'sess_mno345', tags: ['journal', 'reversed'],
    severity: 'warning', isReversible: false,
  },
  {
    id: 'AL014', timestamp: '2024-01-18T15:45:00Z',
    userId: 'USR003', userName: 'Mike Sales', userRole: 'Sales Staff',
    action: 'IMPORT', module: 'Sales & Booking Estimate', entityId: 'IMPORT-20240118',
    entityType: 'BulkImport', entityLabel: 'Bulk Import 2024-01-18',
    description: 'Imported 12 bookings from Excel file (bookings_jan2024.xlsx)',
    oldValues: undefined,
    newValues: { fileNme: 'bookings_jan2024.xlsx', rowsImported: 12, rowsFailed: 0 },
    diffs: [],
    ipAddress: '192.168.1.110', sessionId: 'sess_ghi789', tags: ['import', 'bulk'],
    severity: 'info', isReversible: false,
  },
  {
    id: 'AL015', timestamp: '2024-01-17T10:00:00Z',
    userId: 'USR001', userName: 'John Admin', userRole: 'Administrator',
    action: 'UPDATE', module: 'Expenses', entityId: 'EXP-0078',
    entityType: 'Expense', entityLabel: 'Expense EXP-0078',
    description: 'Updated expense EXP-0078 — amount changed from AED 800 to AED 950',
    oldValues: { amount: 800, category: 'Fuel', status: 'Pending' },
    newValues: { amount: 950, category: 'Fuel', status: 'Pending' },
    diffs: [{ field: 'amount', label: 'Amount', oldValue: 800, newValue: 950, type: 'currency' }],
    ipAddress: '192.168.1.100', sessionId: 'sess_abc123', tags: ['expense', 'updated'],
    severity: 'info', isReversible: true,
  },
];

// ─── Context ──────────────────────────────────────────────────────────────────

const AuditTrailContext = createContext<AuditTrailContextValue | null>(null);

const STORAGE_KEY = 'accountspro_audit_logs';

let logCounter = SEED_LOGS.length + 1;

export function AuditTrailProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<AuditLog[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AuditLog[];
        if (parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    return SEED_LOGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(0, 500)));
    } catch { /* ignore */ }
  }, [logs]);

  const getDiff = useCallback((
    oldValues: Record<string, unknown>,
    newValues: Record<string, unknown>
  ): FieldDiff[] => computeDiffs(oldValues, newValues), []);

  const logAction = useCallback((params: LogActionParams): AuditLog => {
    const diffs = (params.oldValues && params.newValues)
      ? computeDiffs(params.oldValues, params.newValues)
      : (params.newValues ? computeDiffs({}, params.newValues) : []);

    const entry: AuditLog = {
      id: `AL${String(logCounter++).padStart(4, '0')}`,
      timestamp: new Date().toISOString(),
      userId: CURRENT_USER.id,
      userName: CURRENT_USER.name,
      userRole: CURRENT_USER.role,
      action: params.action,
      module: params.module,
      entityId: params.entityId,
      entityType: params.entityType,
      entityLabel: params.entityLabel,
      description: params.description,
      oldValues: params.oldValues,
      newValues: params.newValues,
      diffs,
      ipAddress: randomIP(),
      sessionId: SESSION_ID,
      tags: params.tags || [],
      severity: params.severity || 'info',
      isReversible: params.action === 'CREATE' || params.action === 'UPDATE',
      metadata: params.metadata,
    };
    setLogs(prev => [entry, ...prev]);
    return entry;
  }, []);

  const clearLogs = useCallback(() => {
    setLogs(SEED_LOGS);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const getEntityHistory = useCallback((entityId: string): AuditLog[] => {
    return logs.filter(l => l.entityId === entityId).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [logs]);

  const exportCSV = useCallback((filtered?: AuditLog[]) => {
    const data = filtered || logs;
    const headers = [
      'ID', 'Timestamp', 'User', 'Role', 'Action', 'Module',
      'Entity ID', 'Entity Type', 'Description', 'Severity',
      'IP Address', 'Session ID', 'Tags', 'Old Values', 'New Values'
    ];
    const rows = data.map(l => [
      l.id, l.timestamp, l.userName, l.userRole, l.action, l.module,
      l.entityId, l.entityType,
      `"${l.description.replace(/"/g, '""')}"`,
      l.severity, l.ipAddress, l.sessionId,
      `"${l.tags.join(', ')}"`,
      l.oldValues ? `"${JSON.stringify(l.oldValues).replace(/"/g, '""')}"` : '',
      l.newValues ? `"${JSON.stringify(l.newValues).replace(/"/g, '""')}"` : '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_trail_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [logs]);

  const stats = computeStats(logs);

  return (
    <AuditTrailContext.Provider value={{ logs, stats, logAction, clearLogs, exportCSV, getEntityHistory, getDiff }}>
      {children}
    </AuditTrailContext.Provider>
  );
}

export function useAuditTrail() {
  const ctx = useContext(AuditTrailContext);
  if (!ctx) throw new Error('useAuditTrail must be used inside AuditTrailProvider');
  return ctx;
}
