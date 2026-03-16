/**
 * Supabase sync helpers for AccountsPro.
 * Each function handles camelCase ↔ snake_case mapping.
 * Pattern: fetch-on-load, write-through on mutation.
 */
import { supabase } from './supabase';
import type {
  Account, JournalEntry, JournalLine, AccountingPeriod, TransactionLock,
} from '../context/AccountingEngine';
import type { BookingEstimate } from '../context/BookingEstimateContext';

// ─── Connection test ──────────────────────────────────────────────────────────

export async function testConnection(): Promise<boolean> {
  const { error } = await supabase.from('accounts').select('id').limit(1);
  return !error;
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

function dbToAccount(row: any): Account {
  return {
    id:                   row.id,
    code:                 row.code,
    name:                 row.name,
    type:                 row.type,
    normalBalance:        row.normal_balance,
    parentId:             row.parent_id ?? undefined,
    description:          row.description ?? undefined,
    status:               row.status,
    isDefault:            row.is_default,
    openingBalance:       Number(row.opening_balance),
    openingBalanceType:   row.opening_balance_type,
    createdAt:            row.created_at,
  };
}

function accountToDb(a: Account) {
  return {
    id:                   a.id,
    code:                 a.code,
    name:                 a.name,
    type:                 a.type,
    normal_balance:       a.normalBalance,
    parent_id:            a.parentId ?? null,
    description:          a.description ?? null,
    status:               a.status,
    is_default:           a.isDefault,
    opening_balance:      a.openingBalance,
    opening_balance_type: a.openingBalanceType,
    created_at:           a.createdAt,
  };
}

export async function fetchAccounts(): Promise<Account[] | null> {
  const { data, error } = await supabase.from('accounts').select('*').order('code');
  if (error || !data) return null;
  return data.map(dbToAccount);
}

export async function upsertAccounts(accounts: Account[]): Promise<void> {
  await supabase.from('accounts').upsert(accounts.map(accountToDb), { onConflict: 'id' });
}

export async function upsertAccount(account: Account): Promise<void> {
  await supabase.from('accounts').upsert(accountToDb(account), { onConflict: 'id' });
}

export async function deleteAccount(id: string): Promise<void> {
  await supabase.from('accounts').delete().eq('id', id);
}

// ─── Journal Entries ──────────────────────────────────────────────────────────

function dbToEntry(row: any, lines: any[]): JournalEntry {
  return {
    id:              row.id,
    entryNumber:     row.entry_number,
    date:            row.date,
    period:          row.period,
    description:     row.description,
    reference:       row.reference,
    status:          row.status,
    totalDebit:      Number(row.total_debit),
    totalCredit:     Number(row.total_credit),
    isBalanced:      row.is_balanced,
    createdBy:       row.created_by,
    createdAt:       row.created_at,
    submittedAt:     row.submitted_at ?? undefined,
    approvedBy:      row.approved_by ?? undefined,
    approvedAt:      row.approved_at ?? undefined,
    postedAt:        row.posted_at ?? undefined,
    rejectedBy:      row.rejected_by ?? undefined,
    rejectedAt:      row.rejected_at ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    reversalOf:      row.reversal_of ?? undefined,
    reversedBy:      row.reversed_by ?? undefined,
    source:          row.source,
    attachments:     [],
    auditLog:        [],
    lines:           lines.map(dbToLine),
  };
}

function dbToLine(row: any): JournalLine {
  return {
    id:          row.id,
    accountId:   row.account_id,
    accountCode: row.account_code,
    accountName: row.account_name,
    accountType: row.account_type,
    description: row.description,
    debit:       Number(row.debit),
    credit:      Number(row.credit),
    reference:   row.reference ?? undefined,
  };
}

function entryToDb(je: JournalEntry) {
  return {
    id:              je.id,
    entry_number:    je.entryNumber,
    date:            je.date,
    period:          je.period,
    description:     je.description,
    reference:       je.reference,
    status:          je.status,
    total_debit:     je.totalDebit,
    total_credit:    je.totalCredit,
    is_balanced:     je.isBalanced,
    created_by:      je.createdBy,
    created_at:      je.createdAt,
    submitted_at:    je.submittedAt ?? null,
    approved_by:     je.approvedBy ?? null,
    approved_at:     je.approvedAt ?? null,
    posted_at:       je.postedAt ?? null,
    rejected_by:     je.rejectedBy ?? null,
    rejected_at:     je.rejectedAt ?? null,
    rejection_reason:je.rejectionReason ?? null,
    reversal_of:     je.reversalOf ?? null,
    reversed_by:     je.reversedBy ?? null,
    source:          je.source,
  };
}

function lineToDb(line: JournalLine, jeId: string) {
  return {
    id:               line.id,
    journal_entry_id: jeId,
    account_id:       line.accountId,
    account_code:     line.accountCode,
    account_name:     line.accountName,
    account_type:     line.accountType,
    description:      line.description,
    debit:            line.debit,
    credit:           line.credit,
    reference:        line.reference ?? null,
  };
}

export async function fetchJournalEntries(): Promise<JournalEntry[] | null> {
  const [{ data: entries, error: e1 }, { data: lines, error: e2 }] = await Promise.all([
    supabase.from('journal_entries').select('*').order('date'),
    supabase.from('journal_entry_lines').select('*'),
  ]);
  if (e1 || e2 || !entries || !lines) return null;
  return entries.map(row => dbToEntry(row, lines.filter((l: any) => l.journal_entry_id === row.id)));
}

export async function upsertJournalEntry(je: JournalEntry): Promise<void> {
  await supabase.from('journal_entries').upsert(entryToDb(je), { onConflict: 'id' });
  // Delete old lines and re-insert (simplest approach for updates)
  await supabase.from('journal_entry_lines').delete().eq('journal_entry_id', je.id);
  if (je.lines.length > 0) {
    await supabase.from('journal_entry_lines').insert(je.lines.map(l => lineToDb(l, je.id)));
  }
}

export async function deleteJournalEntry(id: string): Promise<void> {
  await supabase.from('journal_entries').delete().eq('id', id);
  // Lines are deleted via CASCADE
}

// ─── Accounting Periods ───────────────────────────────────────────────────────

function dbToPeriod(row: any): AccountingPeriod {
  return {
    id:        row.id,
    name:      row.name,
    period:    row.period,
    startDate: row.start_date,
    endDate:   row.end_date,
    status:    row.status,
    closedBy:  row.closed_by ?? undefined,
    closedAt:  row.closed_at ?? undefined,
  };
}

function periodToDb(p: AccountingPeriod) {
  return {
    id:         p.id,
    name:       p.name,
    period:     p.period,
    start_date: p.startDate,
    end_date:   p.endDate,
    status:     p.status,
    closed_by:  p.closedBy ?? null,
    closed_at:  p.closedAt ?? null,
  };
}

export async function fetchPeriods(): Promise<AccountingPeriod[] | null> {
  const { data, error } = await supabase.from('accounting_periods').select('*').order('period');
  if (error || !data) return null;
  return data.map(dbToPeriod);
}

export async function upsertPeriods(periods: AccountingPeriod[]): Promise<void> {
  await supabase.from('accounting_periods').upsert(periods.map(periodToDb), { onConflict: 'id' });
}

export async function upsertPeriod(p: AccountingPeriod): Promise<void> {
  await supabase.from('accounting_periods').upsert(periodToDb(p), { onConflict: 'id' });
}

// ─── Transaction Lock ─────────────────────────────────────────────────────────

export async function fetchTransactionLock(): Promise<TransactionLock | null> {
  const { data } = await supabase.from('transaction_lock').select('*').eq('id', 1).single();
  if (!data) return null;
  return {
    lockDate:     data.lock_date,
    lockedBy:     data.locked_by,
    lockedAt:     data.locked_at,
    hasPassword:  data.has_password,
    passwordHash: data.password_hash ?? undefined,
  };
}

export async function saveTransactionLock(lock: TransactionLock): Promise<void> {
  await supabase.from('transaction_lock').upsert({
    id:            1,
    lock_date:     lock.lockDate,
    locked_by:     lock.lockedBy,
    locked_at:     lock.lockedAt,
    has_password:  lock.hasPassword,
    password_hash: lock.passwordHash ?? null,
  }, { onConflict: 'id' });
}

export async function clearTransactionLockDb(): Promise<void> {
  await supabase.from('transaction_lock').delete().eq('id', 1);
}

// ─── Booking Estimates ────────────────────────────────────────────────────────

function dbToEstimate(row: any): BookingEstimate {
  return {
    id:              row.id,
    bookingRef:      row.booking_ref,
    agent:           row.agent,
    customer:        row.customer,
    serviceType:     row.service_type,
    serviceDate:     row.service_date,
    checkIn:         row.check_in ?? undefined,
    checkOut:        row.check_out ?? undefined,
    sellingPrice:    Number(row.selling_price),
    vat:             Number(row.vat),
    total:           Number(row.total),
    currency:        row.currency,
    paymentStatus:   row.payment_status,
    paymentReceived: row.payment_received != null ? Number(row.payment_received) : undefined,
    paymentMade:     row.payment_made     != null ? Number(row.payment_made)     : undefined,
    notes:           row.notes ?? '',
    submittedAt:     row.submitted_at,
    submittedBy:     row.submitted_by,
    status:          row.status,
    isTourPackage:   row.is_tour_package ?? false,
    costing:         row.costing ?? undefined,
    approvedBy:      row.approved_by  ?? undefined,
    approvedAt:      row.approved_at  ?? undefined,
    rejectedBy:      row.rejected_by  ?? undefined,
    rejectedAt:      row.rejected_at  ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    invoiceId:       row.invoice_id   ?? undefined,
  };
}

function estimateToDb(e: BookingEstimate) {
  return {
    id:               e.id,
    booking_ref:      e.bookingRef,
    agent:            e.agent,
    customer:         e.customer,
    service_type:     e.serviceType,
    service_date:     e.serviceDate,
    check_in:         e.checkIn  ?? null,
    check_out:        e.checkOut ?? null,
    selling_price:    e.sellingPrice,
    vat:              e.vat,
    total:            e.total,
    currency:         e.currency,
    payment_status:   e.paymentStatus,
    payment_received: e.paymentReceived ?? null,
    payment_made:     e.paymentMade     ?? null,
    notes:            e.notes,
    submitted_at:     e.submittedAt,
    submitted_by:     e.submittedBy,
    status:           e.status,
    is_tour_package:  e.isTourPackage ?? false,
    costing:          e.costing ?? null,
    approved_by:      e.approvedBy  ?? null,
    approved_at:      e.approvedAt  ?? null,
    rejected_by:      e.rejectedBy  ?? null,
    rejected_at:      e.rejectedAt  ?? null,
    rejection_reason: e.rejectionReason ?? null,
    invoice_id:       e.invoiceId   ?? null,
  };
}

export async function fetchEstimates(): Promise<BookingEstimate[] | null> {
  const { data, error } = await supabase.from('booking_estimates').select('*').order('submitted_at', { ascending: false });
  if (error || !data) return null;
  return data.map(dbToEstimate);
}

export async function upsertEstimate(e: BookingEstimate): Promise<void> {
  await supabase.from('booking_estimates').upsert(estimateToDb(e), { onConflict: 'id' });
}

export async function upsertEstimates(estimates: BookingEstimate[]): Promise<void> {
  await supabase.from('booking_estimates').upsert(estimates.map(estimateToDb), { onConflict: 'id' });
}
