import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  fetchAccounts as fetchAccountsDb,
  upsertAccount as upsertAccountDb,
  fetchJournalEntries as fetchJournalEntriesDb,
  upsertJournalEntry as upsertJournalEntryDb,
  deleteJournalEntry as deleteJournalEntryDb,
  fetchPeriods as fetchPeriodsDb,
  upsertPeriod as upsertPeriodDb,
  fetchTransactionLock as fetchTransactionLockDb,
  saveTransactionLock as saveTransactionLockDb,
  clearTransactionLockDb,
} from '../lib/supabaseSync';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
export type EntryStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Posted' | 'Rejected' | 'Reversed';
export type NormalBalance = 'Debit' | 'Credit';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  parentId?: string;
  description?: string;
  status: 'Active' | 'Inactive';
  isDefault: boolean;
  openingBalance: number;
  openingBalanceType: 'Debit' | 'Credit';
  createdAt: string;
}

export interface JournalLine {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  description: string;
  debit: number;
  credit: number;
  reference?: string;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  period: string;           // e.g. "2024-01"
  description: string;
  reference: string;
  status: EntryStatus;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  createdBy: string;
  createdAt: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  postedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  reversalOf?: string;       // original entry id if this is a reversal
  reversedBy?: string;       // reversal entry id
  attachments: Attachment[];
  auditLog: AuditEvent[];
  source: 'Manual' | 'Invoice' | 'Payment' | 'FXRevaluation' | 'Recurring' | 'System';
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  details?: string;
  oldValue?: string;
  newValue?: string;
}

export interface AccountingPeriod {
  id: string;
  name: string;          // e.g. "January 2024"
  period: string;        // e.g. "2024-01"
  startDate: string;
  endDate: string;
  status: 'Open' | 'Closed' | 'Locked';
  closedBy?: string;
  closedAt?: string;
}

export interface LedgerEntry {
  id: string;
  date: string;
  period: string;
  entryNumber: string;
  journalEntryId: string;
  description: string;
  reference: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  debit: number;
  credit: number;
  runningBalance: number;
  source: JournalEntry['source'];
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  lineId?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
}

// ─── Default Data (empty — user creates all data) ──────────────────────


// ─── Validation Engine ────────────────────────────────────────────────────────

export function validateJournalEntry(
  entry: Partial<JournalEntry>,
  accounts: Account[],
  periods: AccountingPeriod[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Rule 1: Required fields
  if (!entry.date) errors.push({ code: 'E001', message: 'Transaction date is required.', field: 'date' });
  if (!entry.description?.trim()) errors.push({ code: 'E002', message: 'Description is required.', field: 'description' });
  if (!entry.reference?.trim()) errors.push({ code: 'E003', message: 'Reference number is required.', field: 'reference' });

  // Rule 2: Lines minimum
  if (!entry.lines || entry.lines.length < 2) {
    errors.push({ code: 'E004', message: 'A journal entry must have at least 2 lines (one debit, one credit).' });
  }

  if (entry.lines && entry.lines.length >= 2) {
    let totalDebit = 0;
    let totalCredit = 0;
    let hasDebitLine = false;
    let hasCreditLine = false;

    entry.lines.forEach(line => {
      // Rule 3: Each line must have an account
      if (!line.accountId) {
        errors.push({ code: 'E005', message: 'Each line must have an account selected.', lineId: line.id });
      }
      // Rule 4: Each line must have a description
      if (!line.description?.trim()) {
        errors.push({ code: 'E006', message: `Line description is required.`, lineId: line.id });
      }
      // Rule 5: Line cannot have both debit and credit
      if (line.debit > 0 && line.credit > 0) {
        errors.push({ code: 'E007', message: 'A line cannot have both debit and credit amounts.', lineId: line.id });
      }
      // Rule 6: Line must have a non-zero amount
      if (line.debit === 0 && line.credit === 0) {
        errors.push({ code: 'E008', message: 'Each line must have a non-zero amount.', lineId: line.id });
      }

      totalDebit += line.debit;
      totalCredit += line.credit;
      if (line.debit > 0) hasDebitLine = true;
      if (line.credit > 0) hasCreditLine = true;

      // Rule 7: Account must exist and be Active
      if (line.accountId) {
        const account = accounts.find(a => a.id === line.accountId);
        if (!account) {
          errors.push({ code: 'E009', message: `Account "${line.accountCode}" not found.`, lineId: line.id });
        } else if (account.status === 'Inactive') {
          errors.push({ code: 'E010', message: `Account "${account.name}" (${account.code}) is inactive. Cannot post to inactive accounts.`, lineId: line.id });
        }
      }
    });

    // Rule 8: Must have at least one debit and one credit
    if (!hasDebitLine) errors.push({ code: 'E011', message: 'Entry must have at least one debit line.' });
    if (!hasCreditLine) errors.push({ code: 'E012', message: 'Entry must have at least one credit line.' });

    // Rule 9: CORE RULE — Total Debit must equal Total Credit
    const debitRounded = Math.round(totalDebit * 100) / 100;
    const creditRounded = Math.round(totalCredit * 100) / 100;
    if (debitRounded !== creditRounded) {
      errors.push({
        code: 'E013',
        message: `⚖️ UNBALANCED ENTRY: Total Debit (${debitRounded.toFixed(2)}) ≠ Total Credit (${creditRounded.toFixed(2)}). Difference: ${Math.abs(debitRounded - creditRounded).toFixed(2)}.`
      });
    }

    // Rule 10: Totals must be > 0
    if (totalDebit === 0) {
      errors.push({ code: 'E014', message: 'Total debit amount must be greater than zero.' });
    }
  }

  // Rule 11: Closed period check
  if (entry.date) {
    const entryPeriod = entry.date.substring(0, 7); // "YYYY-MM"
    const period = periods.find(p => p.period === entryPeriod);
    if (period && (period.status === 'Closed' || period.status === 'Locked')) {
      errors.push({
        code: 'E015',
        message: `Cannot post to ${period.name} — period is ${period.status}. Please select a date in an open period.`,
        field: 'date'
      });
    }
    if (!period) {
      warnings.push({ code: 'W001', message: `No accounting period found for ${entryPeriod}. Entry will still be saved.` });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── Compute Ledger from Entries ──────────────────────────────────────────────

export function buildLedger(entries: JournalEntry[], accounts: Account[]): Map<string, LedgerEntry[]> {
  const ledgerMap = new Map<string, LedgerEntry[]>();

  // Initialize with opening balances
  accounts.forEach(acc => {
    const openingEntry: LedgerEntry = {
      id: `OB-${acc.id}`,
      date: '2024-01-01',
      period: '2024-01',
      entryNumber: 'OB-001',
      journalEntryId: 'OPENING',
      description: 'Opening Balance',
      reference: 'OB',
      accountId: acc.id,
      accountCode: acc.code,
      accountName: acc.name,
      accountType: acc.type,
      debit: acc.openingBalanceType === 'Debit' ? acc.openingBalance : 0,
      credit: acc.openingBalanceType === 'Credit' ? acc.openingBalance : 0,
      runningBalance: acc.openingBalanceType === 'Debit' ? acc.openingBalance : -acc.openingBalance,
      source: 'System',
    };
    if (acc.openingBalance > 0) {
      ledgerMap.set(acc.id, [openingEntry]);
    } else {
      ledgerMap.set(acc.id, []);
    }
  });

  // Process posted entries
  const postedEntries = entries
    .filter(e => e.status === 'Posted')
    .sort((a, b) => a.date.localeCompare(b.date));

  postedEntries.forEach(je => {
    je.lines.forEach(line => {
      const existing = ledgerMap.get(line.accountId) || [];
      const lastBalance = existing.length > 0 ? existing[existing.length - 1].runningBalance : 0;
      const account = accounts.find(a => a.id === line.accountId);
      const normalBalance = account?.normalBalance || 'Debit';

      let runningBalance: number;
      if (normalBalance === 'Debit') {
        runningBalance = lastBalance + line.debit - line.credit;
      } else {
        runningBalance = lastBalance - line.debit + line.credit;
      }

      const ledgerEntry: LedgerEntry = {
        id: `${je.id}-${line.id}`,
        date: je.date,
        period: je.period,
        entryNumber: je.entryNumber,
        journalEntryId: je.id,
        description: line.description || je.description,
        reference: je.reference,
        accountId: line.accountId,
        accountCode: line.accountCode,
        accountName: line.accountName,
        accountType: line.accountType,
        debit: line.debit,
        credit: line.credit,
        runningBalance,
        source: je.source,
      };
      existing.push(ledgerEntry);
      ledgerMap.set(line.accountId, existing);
    });
  });

  return ledgerMap;
}

// ─── Compute Trial Balance ─────────────────────────────────────────────────────

export interface TrialBalanceLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  isBalanced: boolean;
}

export function buildTrialBalance(ledger: Map<string, LedgerEntry[]>, accounts: Account[]): TrialBalanceLine[] {
  return accounts
    .filter(acc => acc.status === 'Active')
    .map(acc => {
      const entries = ledger.get(acc.id) || [];
      const nonOpening = entries.filter(e => e.journalEntryId !== 'OPENING');
      const totalDebit = nonOpening.reduce((s, e) => s + e.debit, 0);
      const totalCredit = nonOpening.reduce((s, e) => s + e.credit, 0);
      const openingBalance = acc.openingBalance;
      let closingBalance: number;
      if (acc.normalBalance === 'Debit') {
        closingBalance = openingBalance + totalDebit - totalCredit;
      } else {
        closingBalance = openingBalance - totalDebit + totalCredit;
      }
      return {
        accountId: acc.id,
        accountCode: acc.code,
        accountName: acc.name,
        accountType: acc.type,
        normalBalance: acc.normalBalance,
        openingBalance,
        totalDebit,
        totalCredit,
        closingBalance,
        isBalanced: Math.round(closingBalance * 100) === Math.round((openingBalance + totalDebit - totalCredit) * 100),
      };
    })
    .filter(t => t.openingBalance !== 0 || t.totalDebit !== 0 || t.totalCredit !== 0);
}

// ─── Transaction Lock ─────────────────────────────────────────────────────────

export interface TransactionLock {
  lockDate: string;       // ISO date string — transactions on/before this are locked
  lockedBy: string;
  lockedAt: string;
  hasPassword: boolean;
  passwordHash?: string;  // SHA-256 hex of the password (demo: simple btoa)
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AccountingEngineContextType {
  // State
  accounts: Account[];
  entries: JournalEntry[];
  periods: AccountingPeriod[];
  ledger: Map<string, LedgerEntry[]>;
  trialBalance: TrialBalanceLine[];
  globalAuditLog: AuditEvent[];
  transactionLock: TransactionLock | null;
  loading: boolean;
  error: string | null;

  // Account actions
  addAccount: (acc: Omit<Account, 'id' | 'createdAt'>) => Account;
  updateAccount: (id: string, changes: Partial<Account>) => void;
  deactivateAccount: (id: string) => boolean;

  // Period actions
  closePeriod: (periodId: string, userName: string) => boolean;
  reopenPeriod: (periodId: string) => boolean;
  addPeriod: (p: Omit<AccountingPeriod, 'id'>) => void;

  // Transaction lock actions
  setTransactionLock: (lockDate: string, lockedBy: string, password?: string) => void;
  clearTransactionLock: (password?: string) => boolean;
  isTransactionLocked: (date: string) => boolean;

  // Journal entry actions
  validateEntry: (entry: Partial<JournalEntry>) => ValidationResult;
  saveDraft: (entry: Partial<JournalEntry>) => JournalEntry | null;
  submitForApproval: (entryId: string, userName: string) => boolean;
  approveEntry: (entryId: string, userName: string) => boolean;
  rejectEntry: (entryId: string, userName: string, reason: string) => boolean;
  postEntry: (entryId: string, userName: string) => boolean;
  reverseEntry: (entryId: string, userName: string, reason: string) => JournalEntry | null;
  deleteEntry: (entryId: string) => boolean;

  // Helpers
  getAccountLedger: (accountId: string) => LedgerEntry[];
  getAccountBalance: (accountId: string) => number;
  nextEntryNumber: () => string;
  nextAccountCode: (type: AccountType) => string;
}

const AccountingEngineContext = createContext<AccountingEngineContextType | null>(null);

export function AccountingEngineProvider({ children }: { children: ReactNode }) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [globalAuditLog, setGlobalAuditLog] = useState<AuditEvent[]>([]);
  const [transactionLock, setTransactionLockState] = useState<TransactionLock | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Load from Supabase on mount ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [accs, ents, pers, lock] = await Promise.all([
          fetchAccountsDb(),
          fetchJournalEntriesDb(),
          fetchPeriodsDb(),
          fetchTransactionLockDb(),
        ]);
        if (cancelled) return;
        if (accs !== null) setAccounts(accs);
        if (ents !== null) setEntries(ents);
        if (pers !== null) setPeriods(pers);
        setTransactionLockState(lock);
        setError(null);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load accounting data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);


  // Derived state
  const ledger = buildLedger(entries, accounts);
  const trialBalance = buildTrialBalance(ledger, accounts);

  const addAudit = useCallback((event: Omit<AuditEvent, 'id' | 'timestamp'>) => {
    const ae: AuditEvent = { ...event, id: `AE-${Date.now()}`, timestamp: new Date().toISOString() };
    setGlobalAuditLog(prev => [ae, ...prev].slice(0, 500));
    return ae;
  }, []);

  // ── Transaction Lock actions ─────────────────────────────────────────────────

  const isTransactionLocked = useCallback((date: string): boolean => {
    if (!transactionLock) return false;
    return date <= transactionLock.lockDate;
  }, [transactionLock]);

  const setTransactionLock = useCallback((lockDate: string, lockedBy: string, password?: string) => {
    const lock: TransactionLock = {
      lockDate,
      lockedBy,
      lockedAt: new Date().toISOString(),
      hasPassword: !!password,
      passwordHash: password ? btoa(password) : undefined,
    };
    setTransactionLockState(lock);
    saveTransactionLockDb(lock).catch(() => {});
    addAudit({ userId: 'U1', userName: lockedBy, action: 'Transaction Lock Set', details: `Locked up to ${lockDate}`, module: 'Transaction Lock' } as any);
  }, [addAudit]);

  const clearTransactionLock = useCallback((password?: string): boolean => {
    if (!transactionLock) return true;
    if (transactionLock.hasPassword) {
      const supplied = password ? btoa(password) : '';
      if (supplied !== transactionLock.passwordHash) return false;
    }
    addAudit({ userId: 'U1', userName: 'Current User', action: 'Transaction Lock Cleared', details: `Was locked up to ${transactionLock.lockDate}`, module: 'Transaction Lock' } as any);
    setTransactionLockState(null);
    clearTransactionLockDb().catch(() => {});
    return true;
  }, [transactionLock, addAudit]);

  // ── Account actions ──────────────────────────────────────────────────────────

  const addAccount = useCallback((acc: Omit<Account, 'id' | 'createdAt'>): Account => {
    const newAcc: Account = { ...acc, id: `ACC-${Date.now()}`, createdAt: new Date().toISOString() };
    setAccounts(prev => [...prev, newAcc]);
    upsertAccountDb(newAcc).catch(() => {});
    addAudit({ userId: 'U1', userName: 'Current User', action: 'Created Account', details: `${newAcc.code} - ${newAcc.name}`, module: 'Chart of Accounts' } as any);
    return newAcc;
  }, [addAudit]);

  const updateAccount = useCallback((id: string, changes: Partial<Account>) => {
    setAccounts(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, ...changes } : a);
      const changedAcc = updated.find(a => a.id === id);
      if (changedAcc) upsertAccountDb(changedAcc).catch(() => {});
      return updated;
    });
    addAudit({ userId: 'U1', userName: 'Current User', action: 'Updated Account', details: `Account ID: ${id}`, module: 'Chart of Accounts' } as any);
  }, [addAudit]);

  const deactivateAccount = useCallback((id: string): boolean => {
    const hasEntries = entries.some(e => e.status === 'Posted' && e.lines.some(l => l.accountId === id));
    if (hasEntries) return false;
    setAccounts(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, status: 'Inactive' as const } : a);
      const changedAcc = updated.find(a => a.id === id);
      if (changedAcc) upsertAccountDb(changedAcc).catch(() => {});
      return updated;
    });
    addAudit({ userId: 'U1', userName: 'Current User', action: 'Deactivated Account', details: `Account ID: ${id}`, module: 'Chart of Accounts' } as any);
    return true;
  }, [entries, addAudit]);

  // ── Period actions ───────────────────────────────────────────────────────────

  const closePeriod = useCallback((periodId: string, userName: string): boolean => {
    const period = periods.find(p => p.id === periodId);
    if (!period || period.status !== 'Open') return false;
    const updated = { ...period, status: 'Closed' as const, closedBy: userName, closedAt: new Date().toISOString() };
    setPeriods(prev => prev.map(p => p.id === periodId ? updated : p));
    upsertPeriodDb(updated).catch(() => {});
    addAudit({ userId: 'U1', userName, action: 'Closed Period', details: period.name, module: 'Accounting Periods' } as any);
    return true;
  }, [periods, addAudit]);

  const reopenPeriod = useCallback((periodId: string): boolean => {
    const period = periods.find(p => p.id === periodId);
    if (!period || period.status === 'Locked') return false;
    const updated = { ...period, status: 'Open' as const, closedBy: undefined, closedAt: undefined };
    setPeriods(prev => prev.map(p => p.id === periodId ? updated : p));
    upsertPeriodDb(updated).catch(() => {});
    addAudit({ userId: 'U1', userName: 'Current User', action: 'Reopened Period', details: period?.name, module: 'Accounting Periods' } as any);
    return true;
  }, [periods, addAudit]);

  const addPeriod = useCallback((p: Omit<AccountingPeriod, 'id'>) => {
    const newP: AccountingPeriod = { ...p, id: `P-${Date.now()}` };
    setPeriods(prev => [...prev, newP]);
    upsertPeriodDb(newP).catch(() => {});
  }, []);

  // ── Journal Entry actions ────────────────────────────────────────────────────

  const nextEntryNumber = useCallback((): string => {
    const year = new Date().getFullYear();
    const existing = entries.filter(e => e.entryNumber.startsWith(`JE-${year}`));
    const maxNum = existing.reduce((max, e) => {
      const parts = e.entryNumber.split('-');
      const num = parseInt(parts[parts.length - 1]) || 0;
      return Math.max(max, num);
    }, 0);
    return `JE-${year}-${String(maxNum + 1).padStart(4, '0')}`;
  }, [entries]);

  const nextAccountCode = useCallback((type: AccountType): string => {
    const prefix = { Asset: 1, Liability: 2, Equity: 3, Revenue: 4, Expense: 5 }[type];
    const same = accounts.filter(a => a.code.startsWith(String(prefix)));
    const maxCode = same.reduce((max, a) => Math.max(max, parseInt(a.code) || 0), prefix * 1000);
    return String(maxCode + 100);
  }, [accounts]);

  const validateEntry = useCallback((entry: Partial<JournalEntry>): ValidationResult => {
    return validateJournalEntry(entry, accounts, periods);
  }, [accounts, periods]);

  const saveDraft = useCallback((entry: Partial<JournalEntry>): JournalEntry | null => {
    const entryDate = entry.date || new Date().toISOString().split('T')[0];
    if (isTransactionLocked(entryDate)) return null;
    const totalDebit = entry.lines?.reduce((s, l) => s + l.debit, 0) || 0;
    const totalCredit = entry.lines?.reduce((s, l) => s + l.credit, 0) || 0;
    const now = new Date().toISOString();
    const je: JournalEntry = {
      id: entry.id || `JE-${Date.now()}`,
      entryNumber: entry.entryNumber || nextEntryNumber(),
      date: entry.date || now.split('T')[0],
      period: (entry.date || now.split('T')[0]).substring(0, 7),
      description: entry.description || '',
      reference: entry.reference || '',
      status: 'Draft',
      lines: entry.lines || [],
      totalDebit,
      totalCredit,
      isBalanced: Math.round(totalDebit * 100) === Math.round(totalCredit * 100),
      createdBy: 'Current User',
      createdAt: now,
      attachments: entry.attachments || [],
      auditLog: [{ id: `A-${Date.now()}`, timestamp: now, userId: 'U1', userName: 'Current User', action: 'Created Draft', details: 'Journal entry saved as draft' }],
      source: entry.source || 'Manual',
    };

    setEntries(prev => {
      const existing = prev.find(e => e.id === je.id);
      if (existing) return prev.map(e => e.id === je.id ? { ...je, status: existing.status === 'Draft' ? 'Draft' : existing.status } : e);
      return [...prev, je];
    });
    upsertJournalEntryDb(je).catch(() => {});
    addAudit({ userId: 'U1', userName: 'Current User', action: 'Saved Draft', details: je.entryNumber, module: 'Journal Entries' } as any);
    return je;
  }, [nextEntryNumber, addAudit]);

  const submitForApproval = useCallback((entryId: string, userName: string): boolean => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry || entry.status !== 'Draft') return false;
    const validation = validateEntry(entry);
    if (!validation.valid) return false;
    const now = new Date().toISOString();
    const auditEvent: AuditEvent = { id: `A-${Date.now()}`, timestamp: now, userId: 'U1', userName, action: 'Submitted for Approval', details: 'Sent to finance team' };
    const updated = { ...entry, status: 'Pending Approval' as const, submittedAt: now, auditLog: [...entry.auditLog, auditEvent] };
    setEntries(prev => prev.map(e => e.id === entryId ? updated : e));
    upsertJournalEntryDb(updated).catch(() => {});
    addAudit({ userId: 'U1', userName, action: 'Submitted for Approval', details: entry.entryNumber, module: 'Journal Entries' } as any);
    return true;
  }, [entries, validateEntry, addAudit]);

  const approveEntry = useCallback((entryId: string, userName: string): boolean => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry || entry.status !== 'Pending Approval') return false;
    const now = new Date().toISOString();
    const auditEvent: AuditEvent = { id: `A-${Date.now()}`, timestamp: now, userId: 'U1', userName, action: 'Approved', details: 'Entry approved for posting' };
    const updated = { ...entry, status: 'Approved' as const, approvedBy: userName, approvedAt: now, auditLog: [...entry.auditLog, auditEvent] };
    setEntries(prev => prev.map(e => e.id === entryId ? updated : e));
    upsertJournalEntryDb(updated).catch(() => {});
    addAudit({ userId: 'U1', userName, action: 'Approved Entry', details: entry.entryNumber, module: 'Journal Entries' } as any);
    return true;
  }, [entries, addAudit]);

  const rejectEntry = useCallback((entryId: string, userName: string, reason: string): boolean => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry || entry.status !== 'Pending Approval') return false;
    const now = new Date().toISOString();
    const auditEvent: AuditEvent = { id: `A-${Date.now()}`, timestamp: now, userId: 'U1', userName, action: 'Rejected', details: reason };
    const updated = { ...entry, status: 'Rejected' as const, rejectedBy: userName, rejectedAt: now, rejectionReason: reason, auditLog: [...entry.auditLog, auditEvent] };
    setEntries(prev => prev.map(e => e.id === entryId ? updated : e));
    upsertJournalEntryDb(updated).catch(() => {});
    addAudit({ userId: 'U1', userName, action: 'Rejected Entry', details: `${entry.entryNumber}: ${reason}`, module: 'Journal Entries' } as any);
    return true;
  }, [entries, addAudit]);

  const postEntry = useCallback((entryId: string, userName: string): boolean => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry || (entry.status !== 'Approved' && entry.status !== 'Pending Approval')) return false;
    if (isTransactionLocked(entry.date)) return false;
    const validation = validateEntry(entry);
    if (!validation.valid) return false;
    const now = new Date().toISOString();
    const auditEvent: AuditEvent = { id: `A-${Date.now()}`, timestamp: now, userId: 'U1', userName, action: 'Posted to General Ledger', details: 'Entry posted — GL and Trial Balance updated' };
    const updated = { ...entry, status: 'Posted' as const, postedAt: now, approvedBy: entry.approvedBy || userName, approvedAt: entry.approvedAt || now, auditLog: [...entry.auditLog, auditEvent] };
    setEntries(prev => prev.map(e => e.id === entryId ? updated : e));
    upsertJournalEntryDb(updated).catch(() => {});
    addAudit({ userId: 'U1', userName, action: 'Posted Entry', details: entry.entryNumber, module: 'Journal Entries', newValue: 'Posted' } as any);
    return true;
  }, [entries, validateEntry, addAudit]);

  const reverseEntry = useCallback((entryId: string, userName: string, reason: string): JournalEntry | null => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry || entry.status !== 'Posted') return null;
    const now = new Date().toISOString();
    const reversalEntry: JournalEntry = {
      ...entry,
      id: `JE-REV-${Date.now()}`,
      entryNumber: `${entry.entryNumber}-REV`,
      date: now.split('T')[0],
      period: now.substring(0, 7),
      description: `REVERSAL: ${entry.description} — ${reason}`,
      status: 'Posted',
      reversalOf: entryId,
      createdBy: userName,
      createdAt: now,
      postedAt: now,
      approvedBy: userName,
      approvedAt: now,
      auditLog: [{ id: `A-${Date.now()}`, timestamp: now, userId: 'U1', userName, action: 'Reversal Created & Posted', details: reason }],
      lines: entry.lines.map(l => ({ ...l, id: `${l.id}-REV`, debit: l.credit, credit: l.debit })),
    };
    const auditEvent: AuditEvent = { id: `A-${Date.now()}`, timestamp: now, userId: 'U1', userName, action: 'Reversed', details: reason };
    const originalUpdated = { ...entry, status: 'Reversed' as EntryStatus, reversedBy: reversalEntry.id, auditLog: [...entry.auditLog, auditEvent] };
    setEntries(prev => [...prev.map(e => e.id === entryId ? originalUpdated : e), reversalEntry]);
    upsertJournalEntryDb(originalUpdated).catch(() => {});
    upsertJournalEntryDb(reversalEntry).catch(() => {});
    addAudit({ userId: 'U1', userName, action: 'Reversed Entry', details: `${entry.entryNumber} → ${reversalEntry.entryNumber}`, module: 'Journal Entries' } as any);
    return reversalEntry;
  }, [entries, addAudit]);

  const deleteEntry = useCallback((entryId: string): boolean => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry || entry.status === 'Posted') return false;
    if (isTransactionLocked(entry.date)) return false;
    setEntries(prev => prev.filter(e => e.id !== entryId));
    deleteJournalEntryDb(entryId).catch(() => {});
    addAudit({ userId: 'U1', userName: 'Current User', action: 'Deleted Entry', details: entry.entryNumber, module: 'Journal Entries' } as any);
    return true;
  }, [entries, addAudit]);

  const getAccountLedger = useCallback((accountId: string): LedgerEntry[] => {
    return ledger.get(accountId) || [];
  }, [ledger]);

  const getAccountBalance = useCallback((accountId: string): number => {
    const entries = ledger.get(accountId) || [];
    return entries.length > 0 ? entries[entries.length - 1].runningBalance : 0;
  }, [ledger]);

  return (
    <AccountingEngineContext.Provider value={{
      accounts, entries, periods, ledger, trialBalance, globalAuditLog, transactionLock, loading, error,
      addAccount, updateAccount, deactivateAccount,
      closePeriod, reopenPeriod, addPeriod,
      setTransactionLock, clearTransactionLock, isTransactionLocked,
      validateEntry, saveDraft, submitForApproval, approveEntry, rejectEntry, postEntry, reverseEntry, deleteEntry,
      getAccountLedger, getAccountBalance, nextEntryNumber, nextAccountCode,
    }}>
      {children}
    </AccountingEngineContext.Provider>
  );
}

export function useAccountingEngine() {
  const ctx = useContext(AccountingEngineContext);
  if (!ctx) throw new Error('useAccountingEngine must be used inside AccountingEngineProvider');
  return ctx;
}
