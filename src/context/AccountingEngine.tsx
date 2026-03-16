import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  fetchAccounts, fetchJournalEntries, fetchPeriods, fetchTransactionLock,
  upsertAccount, upsertAccounts, upsertJournalEntry, deleteJournalEntry,
  upsertPeriod, upsertPeriods, saveTransactionLock, clearTransactionLockDb,
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

// ─── Default Data ─────────────────────────────────────────────────────────────

const DEFAULT_ACCOUNTS: Account[] = [
  // Assets
  { id: 'A1000', code: '1000', name: 'Cash',                   type: 'Asset',     normalBalance: 'Debit',  isDefault: true, status: 'Active', openingBalance: 50000, openingBalanceType: 'Debit',  description: 'Petty cash and on-hand cash', createdAt: '2024-01-01' },
  { id: 'A1100', code: '1100', name: 'Bank Account',            type: 'Asset',     normalBalance: 'Debit',  isDefault: true, status: 'Active', openingBalance: 150000,openingBalanceType: 'Debit',  description: 'Primary bank account', createdAt: '2024-01-01' },
  { id: 'A1200', code: '1200', name: 'Accounts Receivable',     type: 'Asset',     normalBalance: 'Debit',  isDefault: true, status: 'Active', openingBalance: 45000, openingBalanceType: 'Debit',  description: 'Money owed by customers/agents', createdAt: '2024-01-01' },
  { id: 'A1300', code: '1300', name: 'Inventory',               type: 'Asset',     normalBalance: 'Debit',  isDefault: true, status: 'Active', openingBalance: 25000, openingBalanceType: 'Debit',  description: 'Tourism packages and tickets', createdAt: '2024-01-01' },
  { id: 'A1400', code: '1400', name: 'Prepaid Expenses',        type: 'Asset',     normalBalance: 'Debit',  isDefault: false, status: 'Active', openingBalance: 0,     openingBalanceType: 'Debit',  description: 'Advance payments', createdAt: '2024-01-01' },
  { id: 'A1500', code: '1500', name: 'Fixed Assets',            type: 'Asset',     normalBalance: 'Debit',  isDefault: true, status: 'Active', openingBalance: 200000,openingBalanceType: 'Debit',  description: 'Vehicles, equipment, furniture', createdAt: '2024-01-01' },
  { id: 'A1600', code: '1600', name: 'Accumulated Depreciation',type: 'Asset',     normalBalance: 'Credit', isDefault: false, status: 'Active', openingBalance: 15000, openingBalanceType: 'Credit', description: 'Contra asset for fixed assets', createdAt: '2024-01-01' },
  // Liabilities
  { id: 'L2000', code: '2000', name: 'Accounts Payable',        type: 'Liability', normalBalance: 'Credit', isDefault: true, status: 'Active', openingBalance: 32000, openingBalanceType: 'Credit', description: 'Money owed to suppliers', createdAt: '2024-01-01' },
  { id: 'L2100', code: '2100', name: 'Accrued Expenses',        type: 'Liability', normalBalance: 'Credit', isDefault: false, status: 'Active', openingBalance: 8000,  openingBalanceType: 'Credit', description: 'Expenses incurred not yet paid', createdAt: '2024-01-01' },
  { id: 'L2200', code: '2200', name: 'VAT Payable',             type: 'Liability', normalBalance: 'Credit', isDefault: false, status: 'Active', openingBalance: 5000,  openingBalanceType: 'Credit', description: 'VAT collected, owed to FTA', createdAt: '2024-01-01' },
  { id: 'L2300', code: '2300', name: 'Unearned Revenue',        type: 'Liability', normalBalance: 'Credit', isDefault: false, status: 'Active', openingBalance: 0,     openingBalanceType: 'Credit', description: 'Advance bookings received', createdAt: '2024-01-01' },
  // Equity
  { id: 'E3000', code: '3000', name: 'Owner Equity',            type: 'Equity',    normalBalance: 'Credit', isDefault: true, status: 'Active', openingBalance: 500000,openingBalanceType: 'Credit', description: 'Owner capital', createdAt: '2024-01-01' },
  { id: 'E3100', code: '3100', name: 'Retained Earnings',       type: 'Equity',    normalBalance: 'Credit', isDefault: true, status: 'Active', openingBalance: 25000, openingBalanceType: 'Credit', description: 'Accumulated profit', createdAt: '2024-01-01' },
  { id: 'E3200', code: '3200', name: 'Drawings',                type: 'Equity',    normalBalance: 'Debit',  isDefault: false, status: 'Active', openingBalance: 0,     openingBalanceType: 'Debit',  description: 'Owner withdrawals', createdAt: '2024-01-01' },
  // Revenue
  { id: 'R4000', code: '4000', name: 'Sales Revenue',           type: 'Revenue',   normalBalance: 'Credit', isDefault: true, status: 'Active', openingBalance: 0,     openingBalanceType: 'Credit', description: 'Tour package revenue', createdAt: '2024-01-01' },
  { id: 'R4100', code: '4100', name: 'Service Income',          type: 'Revenue',   normalBalance: 'Credit', isDefault: false, status: 'Active', openingBalance: 0,     openingBalanceType: 'Credit', description: 'Transfer, visa, activity income', createdAt: '2024-01-01' },
  { id: 'R4200', code: '4200', name: 'Other Income',            type: 'Revenue',   normalBalance: 'Credit', isDefault: false, status: 'Active', openingBalance: 0,     openingBalanceType: 'Credit', description: 'Miscellaneous income', createdAt: '2024-01-01' },
  { id: 'R4300', code: '4300', name: 'FX Gain',                 type: 'Revenue',   normalBalance: 'Credit', isDefault: false, status: 'Active', openingBalance: 0,     openingBalanceType: 'Credit', description: 'Foreign exchange gain', createdAt: '2024-01-01' },
  // Expenses
  { id: 'X5000', code: '5000', name: 'Office Expense',          type: 'Expense',   normalBalance: 'Debit',  isDefault: true, status: 'Active', openingBalance: 0,     openingBalanceType: 'Debit',  description: 'General office costs', createdAt: '2024-01-01' },
  { id: 'X5100', code: '5100', name: 'Salaries',                type: 'Expense',   normalBalance: 'Debit',  isDefault: true, status: 'Active', openingBalance: 0,     openingBalanceType: 'Debit',  description: 'Employee salaries', createdAt: '2024-01-01' },
  { id: 'X5200', code: '5200', name: 'Marketing',               type: 'Expense',   normalBalance: 'Debit',  isDefault: false, status: 'Active', openingBalance: 0,     openingBalanceType: 'Debit',  description: 'Advertising and promotion', createdAt: '2024-01-01' },
  { id: 'X5300', code: '5300', name: 'Travel & Transport',      type: 'Expense',   normalBalance: 'Debit',  isDefault: false, status: 'Active', openingBalance: 0,     openingBalanceType: 'Debit',  description: 'Fuel and transport costs', createdAt: '2024-01-01' },
  { id: 'X5400', code: '5400', name: 'Utilities',               type: 'Expense',   normalBalance: 'Debit',  isDefault: false, status: 'Active', openingBalance: 0,     openingBalanceType: 'Debit',  description: 'Electricity, water, internet', createdAt: '2024-01-01' },
  { id: 'X5500', code: '5500', name: 'Depreciation',            type: 'Expense',   normalBalance: 'Debit',  isDefault: false, status: 'Active', openingBalance: 0,     openingBalanceType: 'Debit',  description: 'Periodic depreciation charge', createdAt: '2024-01-01' },
  { id: 'X5600', code: '5600', name: 'Bank Charges',            type: 'Expense',   normalBalance: 'Debit',  isDefault: false, status: 'Active', openingBalance: 0,     openingBalanceType: 'Debit',  description: 'Bank fees and service charges', createdAt: '2024-01-01' },
  { id: 'X5700', code: '5700', name: 'FX Loss',                 type: 'Expense',   normalBalance: 'Debit',  isDefault: false, status: 'Active', openingBalance: 0,     openingBalanceType: 'Debit',  description: 'Foreign exchange loss', createdAt: '2024-01-01' },
];

const SEED_ENTRIES: JournalEntry[] = [
  {
    id: 'JE001', entryNumber: 'JE-2024-001', date: '2024-01-15', period: '2024-01',
    description: 'Sales Revenue from Tour Package Booking', reference: 'BK-2024-0089',
    status: 'Posted', source: 'Manual', createdBy: 'John Admin', createdAt: '2024-01-15T09:30:00Z',
    postedAt: '2024-01-15T10:00:00Z', approvedBy: 'Sarah Manager', approvedAt: '2024-01-15T09:55:00Z',
    totalDebit: 12500, totalCredit: 12500, isBalanced: true, attachments: [], auditLog: [
      { id: 'A1', timestamp: '2024-01-15T09:30:00Z', userId: 'U1', userName: 'John Admin', action: 'Created', details: 'Journal entry created' },
      { id: 'A2', timestamp: '2024-01-15T09:55:00Z', userId: 'U2', userName: 'Sarah Manager', action: 'Approved', details: 'Entry reviewed and approved' },
      { id: 'A3', timestamp: '2024-01-15T10:00:00Z', userId: 'U2', userName: 'Sarah Manager', action: 'Posted', details: 'Posted to General Ledger' },
    ],
    lines: [
      { id: 'L1', accountId: 'A1200', accountCode: '1200', accountName: 'Accounts Receivable', accountType: 'Asset',    description: 'Agent receivable - BK-2024-0089', debit: 12500, credit: 0 },
      { id: 'L2', accountId: 'R4000', accountCode: '4000', accountName: 'Sales Revenue',        accountType: 'Revenue',  description: 'Tour package revenue',            debit: 0,     credit: 11905 },
      { id: 'L3', accountId: 'L2200', accountCode: '2200', accountName: 'VAT Payable',          accountType: 'Liability',description: 'VAT 5%',                         debit: 0,     credit: 595 },
    ]
  },
  {
    id: 'JE002', entryNumber: 'JE-2024-002', date: '2024-01-18', period: '2024-01',
    description: 'Office Rent Payment', reference: 'RENT-JAN-2024',
    status: 'Posted', source: 'Manual', createdBy: 'John Admin', createdAt: '2024-01-18T14:20:00Z',
    postedAt: '2024-01-18T15:00:00Z', approvedBy: 'Sarah Manager', approvedAt: '2024-01-18T14:50:00Z',
    totalDebit: 8000, totalCredit: 8000, isBalanced: true, attachments: [], auditLog: [],
    lines: [
      { id: 'L1', accountId: 'X5000', accountCode: '5000', accountName: 'Office Expense', accountType: 'Expense', description: 'January 2024 rent',    debit: 8000, credit: 0 },
      { id: 'L2', accountId: 'A1100', accountCode: '1100', accountName: 'Bank Account',   accountType: 'Asset',   description: 'Paid via bank transfer', debit: 0,    credit: 8000 },
    ]
  },
  {
    id: 'JE003', entryNumber: 'JE-2024-003', date: '2024-01-20', period: '2024-01',
    description: 'Supplier Payment - City Hotel', reference: 'SUP-0056',
    status: 'Posted', source: 'Payment', createdBy: 'admin', createdAt: '2024-01-20T10:15:00Z',
    postedAt: '2024-01-20T11:00:00Z', approvedBy: 'Sarah Manager', approvedAt: '2024-01-20T10:50:00Z',
    totalDebit: 4500, totalCredit: 4500, isBalanced: true, attachments: [], auditLog: [],
    lines: [
      { id: 'L1', accountId: 'L2000', accountCode: '2000', accountName: 'Accounts Payable', accountType: 'Liability', description: 'Clearing supplier payable', debit: 4500, credit: 0 },
      { id: 'L2', accountId: 'A1000', accountCode: '1000', accountName: 'Cash',             accountType: 'Asset',     description: 'Cash paid to hotel',       debit: 0,    credit: 4500 },
    ]
  },
  {
    id: 'JE004', entryNumber: 'JE-2024-004', date: '2024-01-22', period: '2024-01',
    description: 'Staff Salaries - January 2024', reference: 'PAY-JAN-2024',
    status: 'Posted', source: 'Manual', createdBy: 'admin', createdAt: '2024-01-22T09:00:00Z',
    postedAt: '2024-01-22T10:00:00Z', approvedBy: 'Sarah Manager', approvedAt: '2024-01-22T09:45:00Z',
    totalDebit: 35000, totalCredit: 35000, isBalanced: true, attachments: [], auditLog: [],
    lines: [
      { id: 'L1', accountId: 'X5100', accountCode: '5100', accountName: 'Salaries',      accountType: 'Expense', description: 'January 2024 payroll', debit: 35000, credit: 0 },
      { id: 'L2', accountId: 'A1100', accountCode: '1100', accountName: 'Bank Account',  accountType: 'Asset',   description: 'Bank transfer payroll', debit: 0,     credit: 35000 },
    ]
  },
  {
    id: 'JE005', entryNumber: 'JE-2024-005', date: '2024-02-05', period: '2024-02',
    description: 'Tour Package Revenue - Feb batch', reference: 'BK-2024-BATCH-02',
    status: 'Posted', source: 'Invoice', createdBy: 'system', createdAt: '2024-02-05T08:00:00Z',
    postedAt: '2024-02-05T08:30:00Z', approvedBy: 'Sarah Manager', approvedAt: '2024-02-05T08:25:00Z',
    totalDebit: 28500, totalCredit: 28500, isBalanced: true, attachments: [], auditLog: [],
    lines: [
      { id: 'L1', accountId: 'A1200', accountCode: '1200', accountName: 'Accounts Receivable', accountType: 'Asset',    description: 'Agent receivables Feb batch', debit: 28500, credit: 0 },
      { id: 'L2', accountId: 'R4000', accountCode: '4000', accountName: 'Sales Revenue',        accountType: 'Revenue',  description: 'Feb package revenue',         debit: 0,     credit: 27143 },
      { id: 'L3', accountId: 'L2200', accountCode: '2200', accountName: 'VAT Payable',          accountType: 'Liability',description: 'VAT 5%',                      debit: 0,     credit: 1357 },
    ]
  },
  {
    id: 'JE006', entryNumber: 'JE-2024-006', date: '2024-02-10', period: '2024-02',
    description: 'Fuel Expense - Fleet Vehicles', reference: 'FUEL-FEB-2024',
    status: 'Pending Approval', source: 'Manual', createdBy: 'Mike Sales', createdAt: '2024-02-10T11:00:00Z',
    totalDebit: 2800, totalCredit: 2800, isBalanced: true, attachments: [], auditLog: [
      { id: 'A1', timestamp: '2024-02-10T11:00:00Z', userId: 'U3', userName: 'Mike Sales', action: 'Created', details: 'Fuel expense entry created' },
      { id: 'A2', timestamp: '2024-02-10T11:05:00Z', userId: 'U3', userName: 'Mike Sales', action: 'Submitted for Approval', details: 'Sent to finance team for review' },
    ],
    lines: [
      { id: 'L1', accountId: 'X5300', accountCode: '5300', accountName: 'Travel & Transport', accountType: 'Expense', description: 'Fleet fuel - February', debit: 2800, credit: 0 },
      { id: 'L2', accountId: 'A1000', accountCode: '1000', accountName: 'Cash',               accountType: 'Asset',   description: 'Cash paid at pump',    debit: 0,    credit: 2800 },
    ]
  },
  {
    id: 'JE007', entryNumber: 'JE-2024-007', date: '2024-02-15', period: '2024-02',
    description: 'Marketing Campaign - Social Media', reference: 'MKT-FEB-2024',
    status: 'Draft', source: 'Manual', createdBy: 'Mike Sales', createdAt: '2024-02-15T14:00:00Z',
    totalDebit: 5000, totalCredit: 5000, isBalanced: true, attachments: [], auditLog: [],
    lines: [
      { id: 'L1', accountId: 'X5200', accountCode: '5200', accountName: 'Marketing',     accountType: 'Expense', description: 'Feb digital campaign', debit: 5000, credit: 0 },
      { id: 'L2', accountId: 'L2000', accountCode: '2000', accountName: 'Accounts Payable', accountType: 'Liability', description: 'Agency payable',   debit: 0,    credit: 5000 },
    ]
  },
];

const SEED_PERIODS: AccountingPeriod[] = [
  { id: 'P1', name: 'January 2024', period: '2024-01', startDate: '2024-01-01', endDate: '2024-01-31', status: 'Closed', closedBy: 'Sarah Manager', closedAt: '2024-02-05T10:00:00Z' },
  { id: 'P2', name: 'February 2024', period: '2024-02', startDate: '2024-02-01', endDate: '2024-02-29', status: 'Open' },
  { id: 'P3', name: 'March 2024', period: '2024-03', startDate: '2024-03-01', endDate: '2024-03-31', status: 'Open' },
  { id: 'P4', name: 'April 2024', period: '2024-04', startDate: '2024-04-01', endDate: '2024-04-30', status: 'Open' },
  { id: 'P5', name: 'May 2024', period: '2024-05', startDate: '2024-05-01', endDate: '2024-05-31', status: 'Open' },
  { id: 'P6', name: 'June 2024', period: '2024-06', startDate: '2024-06-01', endDate: '2024-06-30', status: 'Open' },
];

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
  // ── Initial state from localStorage (instant) ──────────────────────────────
  const [accounts, setAccounts] = useState<Account[]>(() => {
    try { const s = localStorage.getItem('ae_accounts'); return s ? JSON.parse(s) : DEFAULT_ACCOUNTS; }
    catch { return DEFAULT_ACCOUNTS; }
  });
  const [entries, setEntries] = useState<JournalEntry[]>(() => {
    try { const s = localStorage.getItem('ae_entries'); return s ? JSON.parse(s) : SEED_ENTRIES; }
    catch { return SEED_ENTRIES; }
  });
  const [periods, setPeriods] = useState<AccountingPeriod[]>(() => {
    try { const s = localStorage.getItem('ae_periods'); return s ? JSON.parse(s) : SEED_PERIODS; }
    catch { return SEED_PERIODS; }
  });
  const [globalAuditLog, setGlobalAuditLog] = useState<AuditEvent[]>(() => {
    try { const s = localStorage.getItem('ae_audit'); return s ? JSON.parse(s) : []; }
    catch { return []; }
  });
  const [transactionLock, setTransactionLockState] = useState<TransactionLock | null>(() => {
    try { const s = localStorage.getItem('ae_txlock'); return s ? JSON.parse(s) : null; }
    catch { return null; }
  });

  // ── Load from Supabase on mount (overrides localStorage if data exists) ─────
  useEffect(() => {
    fetchAccounts().then(data => {
      if (data && data.length > 0) {
        setAccounts(data);
        localStorage.setItem('ae_accounts', JSON.stringify(data));
      } else if (data && data.length === 0) {
        // Seed Supabase with defaults on first run
        upsertAccounts(accounts);
      }
    });
    fetchJournalEntries().then(data => {
      if (data && data.length > 0) {
        setEntries(data);
        localStorage.setItem('ae_entries', JSON.stringify(data));
      } else if (data && data.length === 0) {
        // Seed Supabase with existing localStorage entries
        Promise.all(entries.map(e => upsertJournalEntry(e)));
      }
    });
    fetchPeriods().then(data => {
      if (data && data.length > 0) {
        setPeriods(data);
        localStorage.setItem('ae_periods', JSON.stringify(data));
      } else if (data && data.length === 0) {
        upsertPeriods(periods);
      }
    });
    fetchTransactionLock().then(lock => {
      if (lock) setTransactionLockState(lock);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Keep localStorage in sync (offline fallback) ───────────────────────────
  useEffect(() => { localStorage.setItem('ae_accounts', JSON.stringify(accounts)); }, [accounts]);
  useEffect(() => { localStorage.setItem('ae_entries', JSON.stringify(entries)); }, [entries]);
  useEffect(() => { localStorage.setItem('ae_periods', JSON.stringify(periods)); }, [periods]);
  useEffect(() => { localStorage.setItem('ae_audit', JSON.stringify(globalAuditLog)); }, [globalAuditLog]);
  useEffect(() => {
    if (transactionLock) localStorage.setItem('ae_txlock', JSON.stringify(transactionLock));
    else localStorage.removeItem('ae_txlock');
  }, [transactionLock]);

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
    saveTransactionLock(lock);
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
    clearTransactionLockDb();
    return true;
  }, [transactionLock, addAudit]);

  // ── Account actions ──────────────────────────────────────────────────────────

  const addAccount = useCallback((acc: Omit<Account, 'id' | 'createdAt'>): Account => {
    const newAcc: Account = { ...acc, id: `ACC-${Date.now()}`, createdAt: new Date().toISOString() };
    setAccounts(prev => [...prev, newAcc]);
    upsertAccount(newAcc);
    addAudit({ userId: 'U1', userName: 'Current User', action: 'Created Account', details: `${newAcc.code} - ${newAcc.name}`, module: 'Chart of Accounts' } as any);
    return newAcc;
  }, [addAudit]);

  const updateAccount = useCallback((id: string, changes: Partial<Account>) => {
    setAccounts(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, ...changes } : a);
      const changedAcc = updated.find(a => a.id === id);
      if (changedAcc) upsertAccount(changedAcc);
      return updated;
    });
    addAudit({ userId: 'U1', userName: 'Current User', action: 'Updated Account', details: `Account ID: ${id}`, module: 'Chart of Accounts' } as any);
  }, [addAudit]);

  const deactivateAccount = useCallback((id: string): boolean => {
    const hasEntries = entries.some(e => e.status === 'Posted' && e.lines.some(l => l.accountId === id));
    if (hasEntries) return false;
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, status: 'Inactive' } : a));
    addAudit({ userId: 'U1', userName: 'Current User', action: 'Deactivated Account', details: `Account ID: ${id}`, module: 'Chart of Accounts' } as any);
    return true;
  }, [entries, addAudit]);

  // ── Period actions ───────────────────────────────────────────────────────────

  const closePeriod = useCallback((periodId: string, userName: string): boolean => {
    const period = periods.find(p => p.id === periodId);
    if (!period || period.status !== 'Open') return false;
    const updated = { ...period, status: 'Closed' as const, closedBy: userName, closedAt: new Date().toISOString() };
    setPeriods(prev => prev.map(p => p.id === periodId ? updated : p));
    upsertPeriod(updated);
    addAudit({ userId: 'U1', userName, action: 'Closed Period', details: period.name, module: 'Accounting Periods' } as any);
    return true;
  }, [periods, addAudit]);

  const reopenPeriod = useCallback((periodId: string): boolean => {
    const period = periods.find(p => p.id === periodId);
    if (!period || period.status === 'Locked') return false;
    const updated = { ...period, status: 'Open' as const, closedBy: undefined, closedAt: undefined };
    setPeriods(prev => prev.map(p => p.id === periodId ? updated : p));
    upsertPeriod(updated);
    addAudit({ userId: 'U1', userName: 'Current User', action: 'Reopened Period', details: period?.name, module: 'Accounting Periods' } as any);
    return true;
  }, [periods, addAudit]);

  const addPeriod = useCallback((p: Omit<AccountingPeriod, 'id'>) => {
    const newP = { ...p, id: `P-${Date.now()}` };
    setPeriods(prev => [...prev, newP]);
    upsertPeriod(newP);
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
    upsertJournalEntry(je);
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
    upsertJournalEntry(updated);
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
    upsertJournalEntry(updated);
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
    upsertJournalEntry(updated);
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
    upsertJournalEntry(updated);
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
    upsertJournalEntry(originalUpdated);
    upsertJournalEntry(reversalEntry);
    addAudit({ userId: 'U1', userName, action: 'Reversed Entry', details: `${entry.entryNumber} → ${reversalEntry.entryNumber}`, module: 'Journal Entries' } as any);
    return reversalEntry;
  }, [entries, addAudit]);

  const deleteEntry = useCallback((entryId: string): boolean => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry || entry.status === 'Posted') return false;
    if (isTransactionLocked(entry.date)) return false;
    setEntries(prev => prev.filter(e => e.id !== entryId));
    deleteJournalEntry(entryId);
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
      accounts, entries, periods, ledger, trialBalance, globalAuditLog, transactionLock,
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
