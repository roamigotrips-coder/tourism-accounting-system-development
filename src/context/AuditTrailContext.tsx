import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { fetchAuditLogs as fetchAuditLogsDb, insertAuditLog as insertAuditLogDb } from '../lib/supabaseSync';

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
  entityLabel: string;
  description: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  diffs?: FieldDiff[];
  ipAddress: string;
  sessionId: string;
  tags: string[];
  severity: 'info' | 'warning' | 'critical';
  isReversible: boolean;
  metadata?: Record<string, unknown>;
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
  loading: boolean;
  error: string | null;
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

// ─── Context ──────────────────────────────────────────────────────────────────

const AuditTrailContext = createContext<AuditTrailContextValue | null>(null);

let logCounter = 1;

export function AuditTrailProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Load from Supabase on mount ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchAuditLogsDb();
        if (!cancelled) {
          if (data !== null) {
            setLogs(data);
            logCounter = data.length + 1;
          }
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load audit logs');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
    insertAuditLogDb(entry).catch(() => {});
    return entry;
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
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
    <AuditTrailContext.Provider value={{ logs, stats, loading, error, logAction, clearLogs, exportCSV, getEntityHistory, getDiff }}>
      {children}
    </AuditTrailContext.Provider>
  );
}

export function useAuditTrail() {
  const ctx = useContext(AuditTrailContext);
  if (!ctx) throw new Error('useAuditTrail must be used inside AuditTrailProvider');
  return ctx;
}
