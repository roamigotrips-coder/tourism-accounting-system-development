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

/** Wraps a Supabase query and throws if the DB returns an error. */
async function sbThrow<T>(query: PromiseLike<{ data: T; error: any }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw error;
  return data as T;
}

// ─── Connection test ──────────────────────────────────────────────────────────

export async function testConnection(): Promise<boolean> {
  try {
    // Try a lightweight RPC-free query; if accounts doesn't exist yet we also
    // try a raw REST health check so the indicator still works before schema is applied.
    const { error } = await supabase.from('accounts').select('id').limit(1);
    if (!error) return true;
    // Table may not exist yet — check if Supabase itself is reachable
    const { error: e2 } = await supabase.from('app_settings').select('key').limit(1);
    return !e2;
  } catch {
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. ACCOUNTING CORE
// ══════════════════════════════════════════════════════════════════════════════

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

export async function fetchAccounts(): Promise<Account[]> {
  const { data, error } = await supabase.from('accounts').select('*').order('code');
  if (error) throw error; if (!data) return [];
  return data.map(dbToAccount);
}

export async function upsertAccounts(accounts: Account[]): Promise<void> {
  if (accounts.length === 0) return;
  await sbThrow(supabase.from('accounts').upsert(accounts.map(accountToDb), { onConflict: 'id' }));
}

export async function upsertAccount(account: Account): Promise<void> {
  await sbThrow(supabase.from('accounts').upsert(accountToDb(account), { onConflict: 'id' }));
}

export async function deleteAccount(id: string): Promise<void> {
  await sbThrow(supabase.from('accounts').delete().eq('id', id));
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

export async function fetchJournalEntries(): Promise<JournalEntry[]> {
  const [{ data: entries, error: e1 }, { data: lines, error: e2 }] = await Promise.all([
    supabase.from('journal_entries').select('*').order('date'),
    supabase.from('journal_entry_lines').select('*'),
  ]);
  if (e1 || e2 || !entries || !lines) return null;
  return entries.map(row => dbToEntry(row, lines.filter((l: any) => l.journal_entry_id === row.id)));
}

export async function upsertJournalEntry(je: JournalEntry): Promise<void> {
  await sbThrow(supabase.from('journal_entries').upsert(entryToDb(je), { onConflict: 'id' }));
  await sbThrow(supabase.from('journal_entry_lines').delete().eq('journal_entry_id', je.id));
  if (je.lines.length > 0) {
    await sbThrow(supabase.from('journal_entry_lines').insert(je.lines.map(l => lineToDb(l, je.id))));
  }
}

export async function upsertJournalEntries(entries: JournalEntry[]): Promise<void> {
  if (entries.length === 0) return;
  await sbThrow(supabase.from('journal_entries').upsert(entries.map(entryToDb), { onConflict: 'id' }));
}

export async function deleteJournalEntry(id: string): Promise<void> {
  await sbThrow(supabase.from('journal_entries').delete().eq('id', id));
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

export async function fetchPeriods(): Promise<AccountingPeriod[]> {
  const { data, error } = await supabase.from('accounting_periods').select('*').order('period');
  if (error) throw error; if (!data) return [];
  return data.map(dbToPeriod);
}

export async function upsertPeriods(periods: AccountingPeriod[]): Promise<void> {
  if (periods.length === 0) return;
  await sbThrow(supabase.from('accounting_periods').upsert(periods.map(periodToDb), { onConflict: 'id' }));
}

export async function upsertPeriod(p: AccountingPeriod): Promise<void> {
  await sbThrow(supabase.from('accounting_periods').upsert(periodToDb(p), { onConflict: 'id' }));
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
  await sbThrow(supabase.from('transaction_lock').upsert({
    id:            1,
    lock_date:     lock.lockDate,
    locked_by:     lock.lockedBy,
    locked_at:     lock.lockedAt,
    has_password:  lock.hasPassword,
    password_hash: lock.passwordHash ?? null,
  }, { onConflict: 'id' }));
}

export async function clearTransactionLockDb(): Promise<void> {
  await sbThrow(supabase.from('transaction_lock').delete().eq('id', 1));
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

export async function fetchEstimates(): Promise<BookingEstimate[]> {
  const { data, error } = await supabase.from('booking_estimates').select('*').order('submitted_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(dbToEstimate);
}

export async function upsertEstimate(e: BookingEstimate): Promise<void> {
  await sbThrow(supabase.from('booking_estimates').upsert(estimateToDb(e), { onConflict: 'id' }));
}

export async function upsertEstimates(estimates: BookingEstimate[]): Promise<void> {
  if (estimates.length === 0) return;
  await sbThrow(supabase.from('booking_estimates').upsert(estimates.map(estimateToDb), { onConflict: 'id' }));
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. APPROVAL WORKFLOW
// ══════════════════════════════════════════════════════════════════════════════

import type { ApprovalItem, ApprovalHistoryEvent, ApprovalRule } from '../context/ApprovalContext';

function dbToApprovalItem(row: any, history: any[]): ApprovalItem {
  return {
    id:              row.id,
    refNumber:       row.ref_number,
    type:            row.type,
    title:           row.title,
    description:     row.description ?? '',
    amount:          Number(row.amount),
    currency:        row.currency,
    vatAmount:       Number(row.vat_amount),
    totalAmount:     Number(row.total_amount),
    submittedBy:     row.submitted_by,
    submittedAt:     row.submitted_at,
    submittedByDept: row.submitted_by_dept ?? '',
    status:          row.status,
    priority:        row.priority,
    dueDate:         row.due_date ?? undefined,
    party:           row.party ?? '',
    partyType:       row.party_type ?? '',
    category:        row.category ?? undefined,
    notes:           row.notes ?? undefined,
    attachments:     [],
    history:         history.map(dbToApprovalHistory),
    glPosted:        row.gl_posted,
    glEntryRef:      row.gl_entry_ref ?? undefined,
    correctionNote:  row.correction_note ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    tags:            row.tags ?? [],
    sourceData:      row.source_data ?? undefined,
    managerRole:     row.manager_role ?? '',
    managerLabel:    row.manager_label ?? '',
    financeRole:     row.finance_role ?? '',
    financeLabel:    row.finance_label ?? '',
    requiresCFO:     row.requires_cfo ?? false,
    stageHistory:    row.stage_history ?? [],
  };
}

function approvalItemToDb(item: ApprovalItem) {
  return {
    id:                item.id,
    ref_number:        item.refNumber,
    type:              item.type,
    title:             item.title,
    description:       item.description,
    amount:            item.amount,
    currency:          item.currency,
    vat_amount:        item.vatAmount,
    total_amount:      item.totalAmount,
    submitted_by:      item.submittedBy,
    submitted_at:      item.submittedAt,
    submitted_by_dept: item.submittedByDept,
    status:            item.status,
    priority:          item.priority,
    due_date:          item.dueDate ?? null,
    party:             item.party,
    party_type:        item.partyType,
    category:          item.category ?? null,
    notes:             item.notes ?? null,
    gl_posted:         item.glPosted,
    gl_entry_ref:      item.glEntryRef ?? null,
    correction_note:   item.correctionNote ?? null,
    rejection_reason:  item.rejectionReason ?? null,
    tags:              item.tags,
    source_data:       item.sourceData ?? null,
    manager_role:      item.managerRole,
    manager_label:     item.managerLabel,
    finance_role:      item.financeRole,
    finance_label:     item.financeLabel,
    requires_cfo:      item.requiresCFO,
    stage_history:     item.stageHistory,
  };
}

function dbToApprovalHistory(row: any): ApprovalHistoryEvent {
  return {
    id:          row.id,
    timestamp:   row.timestamp,
    action:      row.action,
    performedBy: row.performed_by,
    fromStatus:  row.from_status,
    toStatus:    row.to_status,
    notes:       row.notes ?? undefined,
    stage:       row.stage ?? undefined,
  };
}

function approvalHistoryToDb(h: ApprovalHistoryEvent, itemId: string) {
  return {
    id:           h.id,
    item_id:      itemId,
    timestamp:    h.timestamp,
    action:       h.action,
    performed_by: h.performedBy,
    from_status:  h.fromStatus,
    to_status:    h.toStatus,
    notes:        h.notes ?? null,
    stage:        h.stage ?? null,
  };
}

export async function fetchApprovalItems(): Promise<ApprovalItem[]> {
  const [{ data: items, error: e1 }, { data: history, error: e2 }] = await Promise.all([
    supabase.from('approval_items').select('*').order('submitted_at', { ascending: false }),
    supabase.from('approval_history').select('*').order('timestamp'),
  ]);
  if (e1 || e2 || !items || !history) return null;
  return items.map(row => dbToApprovalItem(row, history.filter((h: any) => h.item_id === row.id)));
}

export async function upsertApprovalItem(item: ApprovalItem): Promise<void> {
  await sbThrow(supabase.from('approval_items').upsert(approvalItemToDb(item), { onConflict: 'id' }));
  await sbThrow(supabase.from('approval_history').delete().eq('item_id', item.id));
  if (item.history.length > 0) {
    await sbThrow(supabase.from('approval_history').insert(item.history.map(h => approvalHistoryToDb(h, item.id))));
  }
}

export async function upsertApprovalItems(items: ApprovalItem[]): Promise<void> {
  if (items.length === 0) return;
  await sbThrow(supabase.from('approval_items').upsert(items.map(approvalItemToDb), { onConflict: 'id' }));
  const allHistory = items.flatMap(item => item.history.map(h => approvalHistoryToDb(h, item.id)));
  if (allHistory.length > 0) {
    const itemIds = items.map(i => i.id);
    await sbThrow(supabase.from('approval_history').delete().in('item_id', itemIds));
    await sbThrow(supabase.from('approval_history').insert(allHistory));
  }
}

function dbToApprovalRule(row: any): ApprovalRule {
  return {
    id:                     row.id,
    name:                   row.name,
    itemType:               row.item_type,
    amountThreshold:        Number(row.amount_threshold),
    approver:               row.approver,
    isActive:               row.is_active,
    requiresSecondApproval: row.requires_second_approval,
    secondApprover:         row.second_approver ?? undefined,
    createdAt:              row.created_at,
  };
}

function approvalRuleToDb(r: ApprovalRule) {
  return {
    id:                       r.id,
    name:                     r.name,
    item_type:                r.itemType,
    amount_threshold:         r.amountThreshold,
    approver:                 r.approver,
    is_active:                r.isActive,
    requires_second_approval: r.requiresSecondApproval,
    second_approver:          r.secondApprover ?? null,
    created_at:               r.createdAt,
  };
}

export async function fetchApprovalRules(): Promise<ApprovalRule[]> {
  const { data, error } = await supabase.from('approval_rules').select('*');
  if (error) throw error; if (!data) return [];
  return data.map(dbToApprovalRule);
}

export async function upsertApprovalRules(rules: ApprovalRule[]): Promise<void> {
  if (rules.length === 0) return;
  await sbThrow(supabase.from('approval_rules').upsert(rules.map(approvalRuleToDb), { onConflict: 'id' }));
}

export async function upsertApprovalRule(rule: ApprovalRule): Promise<void> {
  await sbThrow(supabase.from('approval_rules').upsert(approvalRuleToDb(rule), { onConflict: 'id' }));
}

export async function deleteApprovalRuleDb(id: string): Promise<void> {
  await sbThrow(supabase.from('approval_rules').delete().eq('id', id));
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. AUDIT TRAIL
// ══════════════════════════════════════════════════════════════════════════════

import type { AuditLog } from '../context/AuditTrailContext';

function dbToAuditLog(row: any): AuditLog {
  return {
    id:           row.id,
    timestamp:    row.timestamp,
    userId:       row.user_id,
    userName:     row.user_name,
    userRole:     row.user_role ?? '',
    action:       row.action,
    module:       row.module,
    entityId:     row.entity_id,
    entityType:   row.entity_type,
    entityLabel:  row.entity_label ?? '',
    description:  row.description ?? '',
    oldValues:    row.old_values ?? undefined,
    newValues:    row.new_values ?? undefined,
    diffs:        row.diffs ?? undefined,
    ipAddress:    row.ip_address ?? '',
    sessionId:    row.session_id ?? '',
    tags:         row.tags ?? [],
    severity:     row.severity ?? 'info',
    isReversible: row.is_reversible ?? false,
    metadata:     row.metadata ?? undefined,
  };
}

function auditLogToDb(log: AuditLog) {
  return {
    id:            log.id,
    timestamp:     log.timestamp,
    user_id:       log.userId,
    user_name:     log.userName,
    user_role:     log.userRole,
    action:        log.action,
    module:        log.module,
    entity_id:     log.entityId,
    entity_type:   log.entityType,
    entity_label:  log.entityLabel,
    description:   log.description,
    old_values:    log.oldValues ?? null,
    new_values:    log.newValues ?? null,
    diffs:         log.diffs ?? null,
    ip_address:    log.ipAddress,
    session_id:    log.sessionId,
    tags:          log.tags,
    severity:      log.severity,
    is_reversible: log.isReversible,
    metadata:      log.metadata ?? null,
  };
}

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  const { data, error } = await supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(500);
  if (error) throw error; if (!data) return [];
  return data.map(dbToAuditLog);
}

export async function insertAuditLog(log: AuditLog): Promise<void> {
  await sbThrow(supabase.from('audit_logs').insert(auditLogToDb(log)));
}

export async function upsertAuditLogs(logs: AuditLog[]): Promise<void> {
  if (logs.length === 0) return;
  await sbThrow(supabase.from('audit_logs').upsert(logs.map(auditLogToDb), { onConflict: 'id' }));
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. BANK FEEDS & RECONCILIATION
// ══════════════════════════════════════════════════════════════════════════════

import type { BankConnection, FeedTransaction, FeedSchedule, WebhookEvent } from '../utils/bankFeedService';
import type { BookTx, RecMatch } from '../utils/reconciliationEngine';

function dbToBankConnection(row: any): BankConnection {
  return {
    id:               row.id,
    providerId:       row.provider_id,
    providerName:     row.provider_name,
    accountName:      row.account_name,
    accountNumber:    row.account_number,
    accountType:      row.account_type,
    currency:         row.currency,
    balance:          Number(row.balance),
    availableBalance: Number(row.available_balance),
    status:           row.status,
    lastSync:         row.last_sync,
    nextSync:         row.next_sync,
    syncFrequency:    row.sync_frequency,
    autoMatch:        row.auto_match,
    autoPost:         row.auto_post,
    totalImported:    row.total_imported,
    totalMatched:     row.total_matched,
    connectedAt:      row.connected_at,
    consentExpiry:    row.consent_expiry,
    errorMessage:     row.error_message ?? undefined,
  };
}

function bankConnectionToDb(c: BankConnection) {
  return {
    id:                c.id,
    provider_id:       c.providerId,
    provider_name:     c.providerName,
    account_name:      c.accountName,
    account_number:    c.accountNumber,
    account_type:      c.accountType,
    currency:          c.currency,
    balance:           c.balance,
    available_balance: c.availableBalance,
    status:            c.status,
    last_sync:         c.lastSync ?? null,
    next_sync:         c.nextSync ?? null,
    sync_frequency:    c.syncFrequency,
    auto_match:        c.autoMatch,
    auto_post:         c.autoPost,
    total_imported:    c.totalImported,
    total_matched:     c.totalMatched,
    connected_at:      c.connectedAt,
    consent_expiry:    c.consentExpiry ?? null,
    error_message:     c.errorMessage ?? null,
  };
}

export async function fetchBankConnections(): Promise<BankConnection[]> {
  const { data, error } = await supabase.from('bank_connections').select('*');
  if (error) throw error; if (!data) return [];
  return data.map(dbToBankConnection);
}

export async function upsertBankConnection(c: BankConnection): Promise<void> {
  await sbThrow(supabase.from('bank_connections').upsert(bankConnectionToDb(c), { onConflict: 'id' }));
}

export async function upsertBankConnections(conns: BankConnection[]): Promise<void> {
  if (conns.length === 0) return;
  await sbThrow(supabase.from('bank_connections').upsert(conns.map(bankConnectionToDb), { onConflict: 'id' }));
}

export async function deleteBankConnection(id: string): Promise<void> {
  await sbThrow(supabase.from('bank_connections').delete().eq('id', id));
}

function dbToFeedTransaction(row: any): FeedTransaction {
  return {
    id:               row.id,
    feedId:           row.feed_id,
    connectionId:     row.connection_id,
    providerRef:      row.provider_ref,
    date:             row.date,
    description:      row.description,
    reference:        row.reference,
    debit:            Number(row.debit),
    credit:           Number(row.credit),
    balance:          Number(row.balance),
    status:           row.status,
    matchedWith:      row.matched_with ?? undefined,
    source:           row.source,
    bank:             row.bank,
    rawData:          row.raw_data ?? {},
    enriched:         row.enriched ?? false,
    category:         row.category ?? undefined,
    merchantName:     row.merchant_name ?? undefined,
    merchantCategory: row.merchant_category ?? undefined,
    pending:          row.pending ?? false,
    reversed:         row.reversed ?? false,
  };
}

function feedTransactionToDb(t: FeedTransaction) {
  return {
    id:                t.id,
    feed_id:           t.feedId ?? null,
    connection_id:     t.connectionId,
    provider_ref:      t.providerRef ?? null,
    date:              t.date,
    description:       t.description,
    reference:         t.reference ?? null,
    debit:             t.debit,
    credit:            t.credit,
    balance:           t.balance,
    status:            t.status,
    matched_with:      t.matchedWith ?? null,
    source:            t.source,
    bank:              t.bank ?? null,
    raw_data:          t.rawData ?? {},
    enriched:          t.enriched ?? false,
    category:          t.category ?? null,
    merchant_name:     t.merchantName ?? null,
    merchant_category: t.merchantCategory ?? null,
    pending:           t.pending ?? false,
    reversed:          t.reversed ?? false,
  };
}

export async function fetchFeedTransactions(): Promise<FeedTransaction[]> {
  const { data, error } = await supabase.from('feed_transactions').select('*').order('date', { ascending: false });
  if (error) throw error; if (!data) return [];
  return data.map(dbToFeedTransaction);
}

export async function upsertFeedTransactions(txs: FeedTransaction[]): Promise<void> {
  if (txs.length === 0) return;
  await sbThrow(supabase.from('feed_transactions').upsert(txs.map(feedTransactionToDb), { onConflict: 'id' }));
}

export async function upsertFeedTransaction(t: FeedTransaction): Promise<void> {
  await sbThrow(supabase.from('feed_transactions').upsert(feedTransactionToDb(t), { onConflict: 'id' }));
}

function dbToBookTx(row: any): BookTx {
  return {
    id:          row.id,
    date:        row.date,
    description: row.description,
    reference:   row.reference,
    amount:      Number(row.amount),
    type:        row.type,
    status:      row.status,
    matchedWith: row.matched_with ?? undefined,
    source:      row.source ?? undefined,
    category:    row.category ?? undefined,
  };
}

function bookTxToDb(t: BookTx) {
  return {
    id:           t.id,
    date:         t.date,
    description:  t.description,
    reference:    t.reference ?? null,
    amount:       t.amount,
    type:         t.type,
    status:       t.status,
    matched_with: t.matchedWith ?? null,
    source:       t.source ?? null,
    category:     t.category ?? null,
  };
}

export async function fetchBookTransactions(): Promise<BookTx[]> {
  const { data, error } = await supabase.from('book_transactions').select('*').order('date', { ascending: false });
  if (error) throw error; if (!data) return [];
  return data.map(dbToBookTx);
}

export async function upsertBookTransactions(txs: BookTx[]): Promise<void> {
  if (txs.length === 0) return;
  await sbThrow(supabase.from('book_transactions').upsert(txs.map(bookTxToDb), { onConflict: 'id' }));
}

function dbToRecMatch(row: any): RecMatch {
  return {
    id:         row.id,
    bankTxId:   row.bank_tx_id,
    bookTxId:   row.book_tx_id,
    matchedBy:  row.matched_by,
    matchedAt:  row.matched_at,
    difference: Number(row.difference),
    method:     row.method,
    confidence: row.confidence,
    score:      row.score,
    reasons:    row.reasons ?? [],
    note:       row.note ?? undefined,
  };
}

function recMatchToDb(m: RecMatch) {
  return {
    id:          m.id,
    bank_tx_id:  m.bankTxId,
    book_tx_id:  m.bookTxId,
    matched_by:  m.matchedBy,
    matched_at:  m.matchedAt,
    difference:  m.difference,
    method:      m.method,
    confidence:  m.confidence,
    score:       m.score,
    reasons:     m.reasons,
    note:        m.note ?? null,
  };
}

export async function fetchRecMatches(): Promise<RecMatch[]> {
  const { data, error } = await supabase.from('rec_matches').select('*');
  if (error) throw error; if (!data) return [];
  return data.map(dbToRecMatch);
}

export async function upsertRecMatches(matches: RecMatch[]): Promise<void> {
  if (matches.length === 0) return;
  await sbThrow(supabase.from('rec_matches').upsert(matches.map(recMatchToDb), { onConflict: 'id' }));
}

export async function insertSyncLog(log: any): Promise<void> {
  await sbThrow(supabase.from('sync_logs').insert({
    id:               log.id || `SL-${Date.now()}`,
    connection_id:    log.connectionId,
    started_at:       log.startedAt,
    completed_at:     log.completedAt ?? null,
    status:           log.status,
    new_transactions: log.newTransactions ?? 0,
    auto_matched:     log.autoMatched ?? 0,
    errors:           log.errors ?? [],
    provider:         log.provider ?? null,
  }));
}

export async function fetchFeedSchedules(): Promise<FeedSchedule[]> {
  const { data, error } = await supabase.from('feed_schedules').select('*');
  if (error) throw error; if (!data) return [];
  return data.map((row: any) => ({
    connectionId: row.connection_id,
    frequency:    row.frequency,
    lastRun:      row.last_run ?? '',
    nextRun:      row.next_run ?? '',
    enabled:      row.enabled,
    retryCount:   row.retry_count,
    maxRetries:   row.max_retries,
  }));
}

export async function upsertFeedSchedule(s: FeedSchedule): Promise<void> {
  await sbThrow(supabase.from('feed_schedules').upsert({
    connection_id: s.connectionId,
    frequency:     s.frequency,
    last_run:      s.lastRun ?? null,
    next_run:      s.nextRun ?? null,
    enabled:       s.enabled,
    retry_count:   s.retryCount,
    max_retries:   s.maxRetries,
  }, { onConflict: 'connection_id' }));
}

export async function fetchWebhookEvents(): Promise<WebhookEvent[]> {
  const { data, error } = await supabase.from('webhook_events').select('*').order('received_at', { ascending: false }).limit(100);
  if (error) throw error; if (!data) return [];
  return data.map((row: any) => ({
    id:           row.id,
    type:         row.type,
    connectionId: row.connection_id,
    payload:      row.payload,
    receivedAt:   row.received_at,
    processed:    row.processed,
  }));
}

export async function insertWebhookEvent(e: WebhookEvent): Promise<void> {
  await sbThrow(supabase.from('webhook_events').insert({
    id:            e.id,
    type:          e.type,
    connection_id: e.connectionId,
    payload:       e.payload,
    received_at:   e.receivedAt,
    processed:     e.processed,
  }));
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. MULTI-CURRENCY
// ══════════════════════════════════════════════════════════════════════════════

import type { Currency, CurrencyRate } from '../context/CurrencyContext';

export async function fetchCurrencies(): Promise<Currency[]> {
  const { data, error } = await supabase.from('currencies').select('*');
  if (error) throw error; if (!data) return [];
  return data.map((row: any) => ({ code: row.code, symbol: row.symbol, name: row.name, enabled: row.enabled }));
}

export async function upsertCurrencies(currencies: Currency[]): Promise<void> {
  if (currencies.length === 0) return;
  await sbThrow(supabase.from('currencies').upsert(currencies.map(c => ({ code: c.code, symbol: c.symbol, name: c.name, enabled: c.enabled })), { onConflict: 'code' }));
}

export async function fetchCurrencyRates(): Promise<CurrencyRate[]> {
  const { data, error } = await supabase.from('currency_rates').select('*');
  if (error) throw error; if (!data) return [];
  return data.map((row: any) => ({ code: row.code, rate: Number(row.rate), date: row.date, source: row.source ?? 'Manual' }));
}

export async function upsertCurrencyRates(rates: CurrencyRate[]): Promise<void> {
  if (rates.length === 0) return;
  await sbThrow(supabase.from('currency_rates').upsert(rates.map(r => ({ code: r.code, rate: r.rate, date: r.date, source: r.source ?? 'Manual' })), { onConflict: 'code' }));
}

export async function fetchSetting(key: string): Promise<string | null> {
  const { data } = await supabase.from('app_settings').select('value').eq('key', key).single();
  return data?.value ?? null;
}

export async function saveSetting(key: string, value: string): Promise<void> {
  await sbThrow(supabase.from('app_settings').upsert({ key, value }, { onConflict: 'key' }));
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. AUTOMATION (Workflows)
// ══════════════════════════════════════════════════════════════════════════════

import type { Workflow } from '../context/AutomationContext';

export async function fetchWorkflows(): Promise<Workflow[]> {
  const { data, error } = await supabase.from('workflows').select('*').order('created_at', { ascending: false });
  if (error) throw error; if (!data) return [];
  return data.map((row: any) => ({ id: row.id, name: row.name, description: row.description ?? undefined, enabled: row.enabled, trigger: row.trigger, conditions: row.conditions ?? [], actions: row.actions ?? [], createdAt: row.created_at }));
}

export async function upsertWorkflow(w: Workflow): Promise<void> {
  await sbThrow(supabase.from('workflows').upsert({ id: w.id, name: w.name, description: w.description ?? null, enabled: w.enabled, trigger: w.trigger, conditions: w.conditions, actions: w.actions, created_at: w.createdAt }, { onConflict: 'id' }));
}

export async function upsertWorkflows(workflows: Workflow[]): Promise<void> {
  if (workflows.length === 0) return;
  await sbThrow(supabase.from('workflows').upsert(workflows.map(w => ({ id: w.id, name: w.name, description: w.description ?? null, enabled: w.enabled, trigger: w.trigger, conditions: w.conditions, actions: w.actions, created_at: w.createdAt })), { onConflict: 'id' }));
}

export async function deleteWorkflowDb(id: string): Promise<void> {
  await sbThrow(supabase.from('workflows').delete().eq('id', id));
}

export async function fetchAutomationLogs(): Promise<{ id: string; time: string; message: string }[]> {
  const { data, error } = await supabase.from('automation_logs').select('*').order('time', { ascending: false }).limit(200);
  if (error) throw error; if (!data) return [];
  return data.map((row: any) => ({ id: row.id, time: row.time, message: row.message }));
}

export async function insertAutomationLog(log: { id: string; time: string; message: string }): Promise<void> {
  await sbThrow(supabase.from('automation_logs').insert({ id: log.id, time: log.time, message: log.message }));
}

// ══════════════════════════════════════════════════════════════════════════════
// 7. ATTACHMENTS & DOCUMENTS
// ══════════════════════════════════════════════════════════════════════════════

import type { Attachment, EmailInRoute } from '../context/AttachmentsContext';

function dbToAttachment(row: any, notes: any[]): Attachment {
  return {
    id:         row.id,
    fileName:   row.file_name,
    mimeType:   row.mime_type,
    size:       row.size,
    dataUrl:    row.data_url ?? undefined,
    ocrText:    row.ocr_text ?? undefined,
    uploadedAt: row.uploaded_at,
    uploadedBy: row.uploaded_by,
    source:     row.source,
    module:     row.module,
    documentId: row.document_id,
    notes:      notes.map((n: any) => ({ id: n.id, text: n.text, createdAt: n.created_at, createdBy: n.created_by })),
    tags:       row.tags ?? [],
    version:    row.version ?? 1,
  };
}

function attachmentToDb(a: Attachment) {
  return {
    id:          a.id,
    file_name:   a.fileName,
    mime_type:   a.mimeType,
    size:        a.size,
    data_url:    a.dataUrl ?? null,
    ocr_text:    a.ocrText ?? null,
    uploaded_at: a.uploadedAt,
    uploaded_by: a.uploadedBy,
    source:      a.source,
    module:      a.module,
    document_id: a.documentId,
    tags:        a.tags,
    version:     a.version,
  };
}

export async function fetchAttachments(): Promise<Attachment[]> {
  const [{ data: atts, error: e1 }, { data: notes, error: e2 }] = await Promise.all([
    supabase.from('attachments').select('*').order('uploaded_at', { ascending: false }),
    supabase.from('attachment_notes').select('*'),
  ]);
  if (e1 || e2 || !atts || !notes) return null;
  return atts.map(row => dbToAttachment(row, notes.filter((n: any) => n.attachment_id === row.id)));
}

export async function upsertAttachment(a: Attachment): Promise<void> {
  await sbThrow(supabase.from('attachments').upsert(attachmentToDb(a), { onConflict: 'id' }));
  await sbThrow(supabase.from('attachment_notes').delete().eq('attachment_id', a.id));
  if (a.notes.length > 0) {
    await sbThrow(supabase.from('attachment_notes').insert(a.notes.map(n => ({ id: n.id, attachment_id: a.id, text: n.text, created_at: n.createdAt, created_by: n.createdBy }))));
  }
}

export async function upsertAttachments(attachments: Attachment[]): Promise<void> {
  if (attachments.length === 0) return;
  await sbThrow(supabase.from('attachments').upsert(attachments.map(attachmentToDb), { onConflict: 'id' }));
}

export async function deleteAttachmentDb(id: string): Promise<void> {
  await sbThrow(supabase.from('attachments').delete().eq('id', id));
}

function dbToEmailRoute(row: any): EmailInRoute {
  return { id: row.id, address: row.address, name: row.name, routeTo: row.route_to, autoLink: row.auto_link, enabled: row.enabled };
}

function emailRouteToDb(r: EmailInRoute) {
  return { id: r.id, address: r.address, name: r.name, route_to: r.routeTo, auto_link: r.autoLink, enabled: r.enabled };
}

export async function fetchEmailRoutes(): Promise<EmailInRoute[]> {
  const { data, error } = await supabase.from('email_routes').select('*');
  if (error) throw error; if (!data) return [];
  return data.map(dbToEmailRoute);
}

export async function upsertEmailRoutes(routes: EmailInRoute[]): Promise<void> {
  if (routes.length === 0) return;
  await sbThrow(supabase.from('email_routes').upsert(routes.map(emailRouteToDb), { onConflict: 'id' }));
}

export async function upsertEmailRoute(route: EmailInRoute): Promise<void> {
  await sbThrow(supabase.from('email_routes').upsert(emailRouteToDb(route), { onConflict: 'id' }));
}

export async function deleteEmailRouteDb(id: string): Promise<void> {
  await sbThrow(supabase.from('email_routes').delete().eq('id', id));
}

// ══════════════════════════════════════════════════════════════════════════════
// 8. ROLE PRESETS
// ══════════════════════════════════════════════════════════════════════════════

import type { RolePreset } from '../context/PresetsContext';

export async function fetchRolePresets(): Promise<RolePreset[]> {
  const { data, error } = await supabase.from('role_presets').select('*');
  if (error) throw error; if (!data) return [];
  return data.map((row: any) => ({ id: row.id, name: row.name, emoji: row.emoji, description: row.description, color: row.color, permissions: row.permissions ?? {}, isSystem: row.is_system }));
}

export async function upsertRolePresets(presets: RolePreset[]): Promise<void> {
  if (presets.length === 0) return;
  await sbThrow(supabase.from('role_presets').upsert(presets.map(p => ({ id: p.id, name: p.name, emoji: p.emoji, description: p.description, color: p.color, permissions: p.permissions, is_system: p.isSystem })), { onConflict: 'id' }));
}

export async function upsertRolePreset(p: RolePreset): Promise<void> {
  await sbThrow(supabase.from('role_presets').upsert({ id: p.id, name: p.name, emoji: p.emoji, description: p.description, color: p.color, permissions: p.permissions, is_system: p.isSystem }, { onConflict: 'id' }));
}

export async function deleteRolePresetDb(id: string): Promise<void> {
  await sbThrow(supabase.from('role_presets').delete().eq('id', id));
}

// ══════════════════════════════════════════════════════════════════════════════
// 9. FORM BUILDER
// ══════════════════════════════════════════════════════════════════════════════

import type { FormConfiguration } from '../types/formBuilder';

export async function fetchFormConfigurations(): Promise<FormConfiguration[]> {
  const { data, error } = await supabase.from('form_configurations').select('*');
  if (error) throw error; if (!data) return [];
  return data.map((row: any) => ({ formId: row.form_id, formName: row.form_name, formDescription: row.form_description ?? undefined, module: row.module, fields: row.fields ?? [] }));
}

export async function upsertFormConfiguration(config: FormConfiguration): Promise<void> {
  await sbThrow(supabase.from('form_configurations').upsert({ form_id: config.formId, form_name: config.formName, form_description: config.formDescription ?? null, module: config.module, fields: config.fields }, { onConflict: 'form_id' }));
}

export async function upsertFormConfigurations(configs: FormConfiguration[]): Promise<void> {
  if (configs.length === 0) return;
  await sbThrow(supabase.from('form_configurations').upsert(configs.map(c => ({ form_id: c.formId, form_name: c.formName, form_description: c.formDescription ?? null, module: c.module, fields: c.fields })), { onConflict: 'form_id' }));
}

export async function deleteFormConfigurationDb(formId: string): Promise<void> {
  await sbThrow(supabase.from('form_configurations').delete().eq('form_id', formId));
}

// ══════════════════════════════════════════════════════════════════════════════
// 10. ADDITIONAL ENTITIES (Agents, Suppliers, Invoices, etc.)
// ══════════════════════════════════════════════════════════════════════════════

import type {
  Agent, Supplier, Expense, Invoice, Vehicle, TourPackage, VATRecord,
  Lead, Employee, BankAccount, Payment,
} from '../data/mockData';

// ─── Agents ───────────────────────────────────────────────────────────────────

function dbToAgent(row: any): Agent {
  return {
    id:            row.id,
    name:          row.name,
    country:       row.country,
    creditLimit:   Number(row.credit_limit),
    outstanding:   Number(row.outstanding),
    paymentTerms:  row.payment_terms,
    commission:    Number(row.commission),
    totalBookings: row.total_bookings,
    status:        row.status,
    email:         row.email,
    phone:         row.phone,
  };
}

function agentToDb(a: Agent) {
  return {
    id:             a.id,
    name:           a.name,
    country:        a.country,
    credit_limit:   a.creditLimit,
    outstanding:    a.outstanding,
    payment_terms:  a.paymentTerms,
    commission:     a.commission,
    total_bookings: a.totalBookings,
    status:         a.status,
    email:          a.email,
    phone:          a.phone,
  };
}

export async function fetchAgents(): Promise<Agent[]> {
  const { data, error } = await supabase.from('agents').select('*');
  if (error) throw error; if (!data) return [];
  return data.map(dbToAgent);
}

export async function upsertAgent(agent: Agent): Promise<void> {
  await sbThrow(supabase.from('agents').upsert(agentToDb(agent), { onConflict: 'id' }));
}

export async function upsertAgents(agents: Agent[]): Promise<void> {
  if (agents.length === 0) return;
  await sbThrow(supabase.from('agents').upsert(agents.map(agentToDb), { onConflict: 'id' }));
}

export async function deleteAgentDb(id: string): Promise<void> {
  await sbThrow(supabase.from('agents').delete().eq('id', id));
}

// ─── Suppliers ────────────────────────────────────────────────────────────────

function dbToSupplier(row: any): Supplier {
  return {
    id:           row.id,
    name:         row.name,
    type:         row.type,
    contact:      row.contact,
    email:        row.email,
    totalPayable: Number(row.total_payable),
    paidAmount:   Number(row.paid_amount),
    status:       row.status,
  };
}

function supplierToDb(s: Supplier) {
  return {
    id:            s.id,
    name:          s.name,
    type:          s.type,
    contact:       s.contact,
    email:         s.email,
    total_payable: s.totalPayable,
    paid_amount:   s.paidAmount,
    status:        s.status,
  };
}

export async function fetchSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase.from('suppliers').select('*');
  if (error) throw error; if (!data) return [];
  return data.map(dbToSupplier);
}

export async function upsertSupplier(supplier: Supplier): Promise<void> {
  await sbThrow(supabase.from('suppliers').upsert(supplierToDb(supplier), { onConflict: 'id' }));
}

export async function upsertSuppliers(suppliers: Supplier[]): Promise<void> {
  if (suppliers.length === 0) return;
  await sbThrow(supabase.from('suppliers').upsert(suppliers.map(supplierToDb), { onConflict: 'id' }));
}

export async function deleteSupplierDb(id: string): Promise<void> {
  await sbThrow(supabase.from('suppliers').delete().eq('id', id));
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

function dbToExpense(row: any): Expense {
  return {
    id:          row.id,
    category:    row.category,
    supplier:    row.supplier,
    amount:      Number(row.amount),
    paymentMode: row.payment_mode,
    date:        row.date,
    description: row.description,
    status:      row.status,
  };
}

function expenseToDb(e: Expense) {
  return {
    id:           e.id,
    category:     e.category,
    supplier:     e.supplier,
    amount:       e.amount,
    payment_mode: e.paymentMode,
    date:         e.date,
    description:  e.description,
    status:       e.status,
  };
}

export async function fetchExpenses(): Promise<Expense[]> {
  const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false });
  if (error) throw error; if (!data) return [];
  return data.map(dbToExpense);
}

export async function upsertExpense(expense: Expense): Promise<void> {
  await sbThrow(supabase.from('expenses').upsert(expenseToDb(expense), { onConflict: 'id' }));
}

export async function upsertExpenses(expenses: Expense[]): Promise<void> {
  if (expenses.length === 0) return;
  await sbThrow(supabase.from('expenses').upsert(expenses.map(expenseToDb), { onConflict: 'id' }));
}

export async function deleteExpenseDb(id: string): Promise<void> {
  await sbThrow(supabase.from('expenses').delete().eq('id', id));
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

function dbToInvoice(row: any): Invoice {
  return {
    id:       row.id,
    type:     row.type,
    party:    row.party,
    amount:   Number(row.amount),
    vat:      Number(row.vat),
    total:    Number(row.total),
    currency: row.currency,
    date:     row.date,
    dueDate:  row.due_date,
    status:   row.status,
  };
}

function invoiceToDb(inv: Invoice) {
  return {
    id:       inv.id,
    type:     inv.type,
    party:    inv.party,
    amount:   inv.amount,
    vat:      inv.vat,
    total:    inv.total,
    currency: inv.currency,
    date:     inv.date,
    due_date: inv.dueDate,
    status:   inv.status,
  };
}

export async function fetchInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase.from('invoices').select('*').order('date', { ascending: false });
  if (error) throw error; if (!data) return [];
  return data.map(dbToInvoice);
}

export async function upsertInvoice(invoice: Invoice): Promise<void> {
  await sbThrow(supabase.from('invoices').upsert(invoiceToDb(invoice), { onConflict: 'id' }));
}

export async function upsertInvoices(invoices: Invoice[]): Promise<void> {
  if (invoices.length === 0) return;
  await sbThrow(supabase.from('invoices').upsert(invoices.map(invoiceToDb), { onConflict: 'id' }));
}

export async function deleteInvoiceDb(id: string): Promise<void> {
  await sbThrow(supabase.from('invoices').delete().eq('id', id));
}

// ─── Vehicles ─────────────────────────────────────────────────────────────────

function dbToVehicle(row: any): Vehicle {
  return {
    id:       row.id,
    plate:    row.plate,
    type:     row.type,
    driver:   row.driver,
    status:   row.status,
    fuelCost: Number(row.fuel_cost),
    trips:    row.trips,
    revenue:  Number(row.revenue),
  };
}

function vehicleToDb(v: Vehicle) {
  return {
    id:        v.id,
    plate:     v.plate,
    type:      v.type,
    driver:    v.driver,
    status:    v.status,
    fuel_cost: v.fuelCost,
    trips:     v.trips,
    revenue:   v.revenue,
  };
}

export async function fetchVehicles(): Promise<Vehicle[]> {
  const { data, error } = await supabase.from('vehicles').select('*');
  if (error) throw error; if (!data) return [];
  return data.map(dbToVehicle);
}

export async function upsertVehicle(vehicle: Vehicle): Promise<void> {
  await sbThrow(supabase.from('vehicles').upsert(vehicleToDb(vehicle), { onConflict: 'id' }));
}

export async function upsertVehicles(vehicles: Vehicle[]): Promise<void> {
  if (vehicles.length === 0) return;
  await sbThrow(supabase.from('vehicles').upsert(vehicles.map(vehicleToDb), { onConflict: 'id' }));
}

export async function deleteVehicleDb(id: string): Promise<void> {
  await sbThrow(supabase.from('vehicles').delete().eq('id', id));
}

// ─── Tour Packages ────────────────────────────────────────────────────────────

function dbToTourPackage(row: any): TourPackage {
  return {
    id:           row.id,
    name:         row.name,
    price:        Number(row.price),
    hotelCost:    Number(row.hotel_cost),
    transferCost: Number(row.transfer_cost),
    ticketsCost:  Number(row.tickets_cost),
    guideCost:    Number(row.guide_cost),
    otherCost:    Number(row.other_cost),
    profit:       Number(row.profit),
    bookings:     row.bookings,
  };
}

function tourPackageToDb(tp: TourPackage) {
  return {
    id:            tp.id,
    name:          tp.name,
    price:         tp.price,
    hotel_cost:    tp.hotelCost,
    transfer_cost: tp.transferCost,
    tickets_cost:  tp.ticketsCost,
    guide_cost:    tp.guideCost,
    other_cost:    tp.otherCost,
    profit:        tp.profit,
    bookings:      tp.bookings,
  };
}

export async function fetchTourPackages(): Promise<TourPackage[]> {
  const { data, error } = await supabase.from('tour_packages').select('*');
  if (error) throw error; if (!data) return [];
  return data.map(dbToTourPackage);
}

export async function upsertTourPackage(tp: TourPackage): Promise<void> {
  await sbThrow(supabase.from('tour_packages').upsert(tourPackageToDb(tp), { onConflict: 'id' }));
}

export async function upsertTourPackages(packages: TourPackage[]): Promise<void> {
  if (packages.length === 0) return;
  await sbThrow(supabase.from('tour_packages').upsert(packages.map(tourPackageToDb), { onConflict: 'id' }));
}

export async function deleteTourPackageDb(id: string): Promise<void> {
  await sbThrow(supabase.from('tour_packages').delete().eq('id', id));
}

// ─── VAT Records ──────────────────────────────────────────────────────────────

function dbToVATRecord(row: any): VATRecord & { id?: string } {
  return {
    id:        row.id,
    month:     row.month,
    outputVAT: Number(row.output_vat),
    inputVAT:  Number(row.input_vat),
    netVAT:    Number(row.net_vat),
    status:    row.status,
  };
}

function vatRecordToDb(v: VATRecord & { id?: string }) {
  return {
    id:         v.id ?? `vat-${v.month}`,
    month:      v.month,
    output_vat: v.outputVAT,
    input_vat:  v.inputVAT,
    net_vat:    v.netVAT,
    status:     v.status,
  };
}

export async function fetchVATRecords(): Promise<(VATRecord & { id?: string })[]> {
  const { data, error } = await supabase.from('vat_records').select('*');
  if (error) throw error; if (!data) return [];
  return data.map(dbToVATRecord);
}

export async function upsertVATRecord(record: VATRecord & { id?: string }): Promise<void> {
  await sbThrow(supabase.from('vat_records').upsert(vatRecordToDb(record), { onConflict: 'id' }));
}

export async function upsertVATRecords(records: (VATRecord & { id?: string })[]): Promise<void> {
  if (records.length === 0) return;
  await sbThrow(supabase.from('vat_records').upsert(records.map(vatRecordToDb), { onConflict: 'id' }));
}

export async function deleteVATRecordDb(id: string): Promise<void> {
  await sbThrow(supabase.from('vat_records').delete().eq('id', id));
}

// ─── Leads ────────────────────────────────────────────────────────────────────

function dbToLead(row: any): Lead {
  return {
    id:       row.id,
    name:     row.name,
    email:    row.email,
    phone:    row.phone,
    source:   row.source,
    service:  row.service,
    status:   row.status,
    value:    Number(row.value),
    date:     row.date,
    followUp: row.follow_up,
  };
}

function leadToDb(l: Lead) {
  return {
    id:        l.id,
    name:      l.name,
    email:     l.email,
    phone:     l.phone,
    source:    l.source,
    service:   l.service,
    status:    l.status,
    value:     l.value,
    date:      l.date,
    follow_up: l.followUp,
  };
}

export async function fetchLeads(): Promise<Lead[]> {
  const { data, error } = await supabase.from('leads').select('*').order('date', { ascending: false });
  if (error) throw error; if (!data) return [];
  return data.map(dbToLead);
}

export async function upsertLead(lead: Lead): Promise<void> {
  await sbThrow(supabase.from('leads').upsert(leadToDb(lead), { onConflict: 'id' }));
}

export async function upsertLeads(leads: Lead[]): Promise<void> {
  if (leads.length === 0) return;
  await sbThrow(supabase.from('leads').upsert(leads.map(leadToDb), { onConflict: 'id' }));
}

export async function deleteLeadDb(id: string): Promise<void> {
  await sbThrow(supabase.from('leads').delete().eq('id', id));
}

// ─── Employees ────────────────────────────────────────────────────────────────

function dbToEmployee(row: any): Employee {
  return {
    id:         row.id,
    name:       row.name,
    department: row.department,
    role:       row.role,
    salary:     Number(row.salary),
    attendance: Number(row.attendance),
    joinDate:   row.join_date,
    status:     row.status,
  };
}

function employeeToDb(e: Employee) {
  return {
    id:         e.id,
    name:       e.name,
    department: e.department,
    role:       e.role,
    salary:     e.salary,
    attendance: e.attendance,
    join_date:  e.joinDate,
    status:     e.status,
  };
}

export async function fetchEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase.from('employees').select('*');
  if (error) throw error; if (!data) return [];
  return data.map(dbToEmployee);
}

export async function upsertEmployee(employee: Employee): Promise<void> {
  await sbThrow(supabase.from('employees').upsert(employeeToDb(employee), { onConflict: 'id' }));
}

export async function upsertEmployees(employees: Employee[]): Promise<void> {
  if (employees.length === 0) return;
  await sbThrow(supabase.from('employees').upsert(employees.map(employeeToDb), { onConflict: 'id' }));
}

export async function deleteEmployeeDb(id: string): Promise<void> {
  await sbThrow(supabase.from('employees').delete().eq('id', id));
}

// ─── Bank / Cash Accounts ─────────────────────────────────────────────────────

function dbToBankAccount(row: any): BankAccount {
  return {
    id:       row.id,
    name:     row.name,
    type:     row.type,
    balance:  Number(row.balance),
    currency: row.currency,
    bank:     row.bank,
  };
}

function bankAccountToDb(b: BankAccount) {
  return {
    id:       b.id,
    name:     b.name,
    type:     b.type,
    balance:  b.balance,
    currency: b.currency,
    bank:     b.bank,
  };
}

export async function fetchBankCashAccounts(): Promise<BankAccount[]> {
  const { data, error } = await supabase.from('bank_cash_accounts').select('*');
  if (error) throw error; if (!data) return [];
  return data.map(dbToBankAccount);
}

export async function upsertBankCashAccount(account: BankAccount): Promise<void> {
  await sbThrow(supabase.from('bank_cash_accounts').upsert(bankAccountToDb(account), { onConflict: 'id' }));
}

export async function upsertBankCashAccounts(accounts: BankAccount[]): Promise<void> {
  if (accounts.length === 0) return;
  await sbThrow(supabase.from('bank_cash_accounts').upsert(accounts.map(bankAccountToDb), { onConflict: 'id' }));
}

export async function deleteBankCashAccountDb(id: string): Promise<void> {
  await sbThrow(supabase.from('bank_cash_accounts').delete().eq('id', id));
}

// ─── Payments Register ────────────────────────────────────────────────────────

function dbToPayment(row: any): Payment {
  return {
    id:        row.id,
    type:      row.type,
    party:     row.party,
    amount:    Number(row.amount),
    method:    row.method,
    date:      row.date,
    reference: row.reference,
    status:    row.status,
  };
}

function paymentToDb(p: Payment) {
  return {
    id:        p.id,
    type:      p.type,
    party:     p.party,
    amount:    p.amount,
    method:    p.method,
    date:      p.date,
    reference: p.reference,
    status:    p.status,
  };
}

export async function fetchPayments(): Promise<Payment[]> {
  const { data, error } = await supabase.from('payments_register').select('*').order('date', { ascending: false });
  if (error) throw error; if (!data) return [];
  return data.map(dbToPayment);
}

export async function upsertPayment(payment: Payment): Promise<void> {
  await sbThrow(supabase.from('payments_register').upsert(paymentToDb(payment), { onConflict: 'id' }));
}

export async function upsertPayments(payments: Payment[]): Promise<void> {
  if (payments.length === 0) return;
  await sbThrow(supabase.from('payments_register').upsert(payments.map(paymentToDb), { onConflict: 'id' }));
}

export async function deletePaymentDb(id: string): Promise<void> {
  await sbThrow(supabase.from('payments_register').delete().eq('id', id));
}

// ══════════════════════════════════════════════════════════════════════════════
// 11. PROJECTS & TIME TRACKING
// ══════════════════════════════════════════════════════════════════════════════

export type Project = {
  id: string;
  name: string;
  client?: string;
  code?: string;
  status: 'Active' | 'Paused' | 'Completed';
  hourlyRate: number;
  budgetHours?: number;
  createdAt: string;
};

export type TimeEntry = {
  id: string;
  projectId: string;
  user: string;
  date: string;
  notes?: string;
  durationMin: number;
};

function dbToProject(row: any): Project {
  return {
    id:          row.id,
    name:        row.name,
    client:      row.client ?? undefined,
    code:        row.code ?? undefined,
    status:      row.status,
    hourlyRate:  Number(row.hourly_rate),
    budgetHours: row.budget_hours != null ? Number(row.budget_hours) : undefined,
    createdAt:   row.created_at,
  };
}

function projectToDb(p: Project) {
  return {
    id:           p.id,
    name:         p.name,
    client:       p.client ?? null,
    code:         p.code ?? null,
    status:       p.status,
    hourly_rate:  p.hourlyRate,
    budget_hours: p.budgetHours ?? null,
    created_at:   p.createdAt,
  };
}

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
  if (error) throw error; if (!data) return [];
  return data.map(dbToProject);
}

export async function upsertProject(project: Project): Promise<void> {
  await sbThrow(supabase.from('projects').upsert(projectToDb(project), { onConflict: 'id' }));
}

export async function upsertProjects(projects: Project[]): Promise<void> {
  if (projects.length === 0) return;
  await sbThrow(supabase.from('projects').upsert(projects.map(projectToDb), { onConflict: 'id' }));
}

export async function deleteProjectDb(id: string): Promise<void> {
  await sbThrow(supabase.from('projects').delete().eq('id', id));
}

// ─── Time Entries ─────────────────────────────────────────────────────────────

function dbToTimeEntry(row: any): TimeEntry {
  return {
    id:          row.id,
    projectId:   row.project_id,
    user:        row.user_name,
    date:        row.date,
    notes:       row.notes ?? undefined,
    durationMin: row.duration_min,
  };
}

function timeEntryToDb(t: TimeEntry) {
  return {
    id:           t.id,
    project_id:   t.projectId,
    user_name:    t.user,
    date:         t.date,
    notes:        t.notes ?? null,
    duration_min: t.durationMin,
  };
}

export async function fetchTimeEntries(): Promise<TimeEntry[]> {
  const { data, error } = await supabase.from('time_entries').select('*').order('date', { ascending: false });
  if (error) throw error; if (!data) return [];
  return data.map(dbToTimeEntry);
}

export async function upsertTimeEntry(entry: TimeEntry): Promise<void> {
  await sbThrow(supabase.from('time_entries').upsert(timeEntryToDb(entry), { onConflict: 'id' }));
}

export async function upsertTimeEntries(entries: TimeEntry[]): Promise<void> {
  if (entries.length === 0) return;
  await sbThrow(supabase.from('time_entries').upsert(entries.map(timeEntryToDb), { onConflict: 'id' }));
}

export async function deleteTimeEntryDb(id: string): Promise<void> {
  await sbThrow(supabase.from('time_entries').delete().eq('id', id));
}

// ══════════════════════════════════════════════════════════════════════════════
// 12. RETAINERS
// ══════════════════════════════════════════════════════════════════════════════

export type Retainer = {
  id: string;
  customer: string;
  description?: string;
  amount: number;
  currency: string;
  interval: 'Monthly' | 'Quarterly' | 'Yearly';
  startDate: string;
  endDate?: string;
  status: 'Active' | 'Paused' | 'Cancelled';
  nextInvoiceOn: string;
};

function dbToRetainer(row: any): Retainer {
  return {
    id:            row.id,
    customer:      row.customer,
    description:   row.description ?? undefined,
    amount:        Number(row.amount),
    currency:      row.currency,
    interval:      row.interval,
    startDate:     row.start_date,
    endDate:       row.end_date ?? undefined,
    status:        row.status,
    nextInvoiceOn: row.next_invoice_on,
  };
}

function retainerToDb(r: Retainer) {
  return {
    id:              r.id,
    customer:        r.customer,
    description:     r.description ?? null,
    amount:          r.amount,
    currency:        r.currency,
    interval:        r.interval,
    start_date:      r.startDate,
    end_date:        r.endDate ?? null,
    status:          r.status,
    next_invoice_on: r.nextInvoiceOn,
  };
}

export async function fetchRetainers(): Promise<Retainer[]> {
  const { data, error } = await supabase.from('retainers').select('*');
  if (error) throw error; if (!data) return [];
  return data.map(dbToRetainer);
}

export async function upsertRetainer(retainer: Retainer): Promise<void> {
  await sbThrow(supabase.from('retainers').upsert(retainerToDb(retainer), { onConflict: 'id' }));
}

export async function upsertRetainers(retainers: Retainer[]): Promise<void> {
  if (retainers.length === 0) return;
  await sbThrow(supabase.from('retainers').upsert(retainers.map(retainerToDb), { onConflict: 'id' }));
}

export async function deleteRetainerDb(id: string): Promise<void> {
  await sbThrow(supabase.from('retainers').delete().eq('id', id));
}

/* ─── PURCHASE ORDERS ──────────────────────────────────────── */

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplier: string;
  supplierType: string;
  date: string;
  dueDate: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  vat: number;
  total: number;
  currency: string;
  status: 'draft' | 'pending' | 'approved' | 'received' | 'cancelled';
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  linkedBooking?: string;
  notes?: string;
}

function dbToPurchaseOrder(row: any, items: any[]): PurchaseOrder {
  return {
    id: row.id,
    poNumber: row.po_number,
    supplier: row.supplier,
    supplierType: row.supplier_type,
    date: row.date,
    dueDate: row.due_date,
    items: items.filter(i => i.purchase_order_id === row.id).map(i => ({
      id: i.id, purchaseOrderId: i.purchase_order_id,
      description: i.description, quantity: i.quantity,
      unitPrice: i.unit_price, total: i.total,
    })),
    subtotal: row.subtotal,
    vat: row.vat,
    total: row.total,
    currency: row.currency,
    status: row.status,
    paymentStatus: row.payment_status,
    linkedBooking: row.linked_booking ?? undefined,
    notes: row.notes ?? undefined,
  };
}

export async function fetchPurchaseOrders(): Promise<PurchaseOrder[]> {
  const [{ data: orders, error: e1 }, { data: items }] = await Promise.all([
    supabase.from('purchase_orders').select('*'),
    supabase.from('purchase_order_items').select('*'),
  ]);
  if (e1 || !orders) return null;
  return orders.map(o => dbToPurchaseOrder(o, items ?? []));
}

export async function upsertPurchaseOrder(po: PurchaseOrder): Promise<void> {
  await sbThrow(supabase.from('purchase_orders').upsert({
    id: po.id, po_number: po.poNumber, supplier: po.supplier,
    supplier_type: po.supplierType, date: po.date, due_date: po.dueDate,
    subtotal: po.subtotal, vat: po.vat, total: po.total,
    currency: po.currency, status: po.status, payment_status: po.paymentStatus,
    linked_booking: po.linkedBooking ?? null, notes: po.notes ?? null,
  }, { onConflict: 'id' }));
  // Upsert items
  if (po.items.length > 0) {
    await sbThrow(supabase.from('purchase_order_items').upsert(
      po.items.map(i => ({
        id: i.id, purchase_order_id: po.id,
        description: i.description, quantity: i.quantity,
        unit_price: i.unitPrice, total: i.total,
      })),
      { onConflict: 'id' }
    ));
  }
}

export async function deletePurchaseOrderDb(id: string): Promise<void> {
  await sbThrow(supabase.from('purchase_orders').delete().eq('id', id));
}

/* ─── RECURRING BILLING ────────────────────────────────────── */

export interface RecurringBillingEntry {
  id: string;
  name: string;
  frequency: string;
  amount: number;
  debitAccountId: string;
  creditAccountId: string;
  description: string;
  nextRunDate: string | null;
  startDate: string;
  status: string;
  lastRunDate: string | null;
  runCount: number;
}

function dbToRecurringBilling(row: any): RecurringBillingEntry {
  return {
    id: row.id, name: row.name, frequency: row.frequency,
    amount: row.amount, debitAccountId: row.debit_account_id,
    creditAccountId: row.credit_account_id, description: row.description,
    nextRunDate: row.next_run_date, startDate: row.start_date,
    status: row.status, lastRunDate: row.last_run_date, runCount: row.run_count,
  };
}

function recurringBillingToDb(r: RecurringBillingEntry) {
  return {
    id: r.id, name: r.name, frequency: r.frequency, amount: r.amount,
    debit_account_id: r.debitAccountId, credit_account_id: r.creditAccountId,
    description: r.description, next_run_date: r.nextRunDate,
    start_date: r.startDate, status: r.status,
    last_run_date: r.lastRunDate, run_count: r.runCount,
  };
}

export async function fetchRecurringBilling(): Promise<RecurringBillingEntry[]> {
  const { data, error } = await supabase.from('recurring_billing').select('*');
  if (error) throw error; if (!data) return [];
  return data.map(dbToRecurringBilling);
}

export async function upsertRecurringBilling(entry: RecurringBillingEntry): Promise<void> {
  await sbThrow(supabase.from('recurring_billing').upsert(recurringBillingToDb(entry), { onConflict: 'id' }));
}

export async function deleteRecurringBillingDb(id: string): Promise<void> {
  await sbThrow(supabase.from('recurring_billing').delete().eq('id', id));
}

/* ─── RECURRING PROFILES ───────────────────────────────────── */

export interface RecurringProfile {
  id: string;
  customerId: string;
  customerName: string;
  planName: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  startDate: string;
  endDate: string | null;
  amount: number;
  currency: string;
  status: 'active' | 'paused' | 'cancelled' | 'expired';
  billingAnchorDay: number;
  nextBillingDate: string;
  lastBilledDate: string | null;
  totalBilled: number;
  invoiceCount: number;
  createdAt: string;
}

function dbToRecurringProfile(row: any): RecurringProfile {
  return {
    id: row.id, customerId: row.customer_id, customerName: row.customer_name,
    planName: row.plan_name, frequency: row.frequency, startDate: row.start_date,
    endDate: row.end_date, amount: row.amount, currency: row.currency,
    status: row.status, billingAnchorDay: row.billing_anchor_day,
    nextBillingDate: row.next_billing_date ?? '', lastBilledDate: row.last_billed_date,
    totalBilled: row.total_billed, invoiceCount: row.invoice_count,
    createdAt: row.created_at,
  };
}

function recurringProfileToDb(r: RecurringProfile) {
  return {
    id: r.id, customer_id: r.customerId, customer_name: r.customerName,
    plan_name: r.planName, frequency: r.frequency, start_date: r.startDate,
    end_date: r.endDate, amount: r.amount, currency: r.currency,
    status: r.status, billing_anchor_day: r.billingAnchorDay,
    next_billing_date: r.nextBillingDate || null, last_billed_date: r.lastBilledDate,
    total_billed: r.totalBilled, invoice_count: r.invoiceCount,
  };
}

export async function fetchRecurringProfiles(): Promise<RecurringProfile[]> {
  const { data, error } = await supabase.from('recurring_profiles').select('*');
  if (error) throw error; if (!data) return [];
  return data.map(dbToRecurringProfile);
}

export async function upsertRecurringProfile(profile: RecurringProfile): Promise<void> {
  await sbThrow(supabase.from('recurring_profiles').upsert(recurringProfileToDb(profile), { onConflict: 'id' }));
}

export async function deleteRecurringProfileDb(id: string): Promise<void> {
  await sbThrow(supabase.from('recurring_profiles').delete().eq('id', id));
}

/* ─── RECURRING INVOICES ───────────────────────────────────── */

export interface RecurringInvoiceRecord {
  id: string;
  profileId: string;
  customerName: string;
  planName: string;
  invoiceId: string | null;
  generationDate: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  currency: string;
  isProrated: boolean;
  status: 'generated' | 'sent' | 'paid' | 'overdue' | 'cancelled';
}

function dbToRecurringInvoice(row: any): RecurringInvoiceRecord {
  return {
    id: row.id, profileId: row.profile_id, customerName: row.customer_name,
    planName: row.plan_name, invoiceId: row.invoice_id,
    generationDate: row.generation_date, periodStart: row.period_start,
    periodEnd: row.period_end, amount: row.amount, currency: row.currency,
    isProrated: row.is_prorated, status: row.status,
  };
}

function recurringInvoiceToDb(r: RecurringInvoiceRecord) {
  return {
    id: r.id, profile_id: r.profileId, customer_name: r.customerName,
    plan_name: r.planName, invoice_id: r.invoiceId,
    generation_date: r.generationDate, period_start: r.periodStart,
    period_end: r.periodEnd, amount: r.amount, currency: r.currency,
    is_prorated: r.isProrated, status: r.status,
  };
}

export async function fetchRecurringInvoices(): Promise<RecurringInvoiceRecord[]> {
  const { data, error } = await supabase.from('recurring_invoices').select('*');
  if (error) throw error; if (!data) return [];
  return data.map(dbToRecurringInvoice);
}

export async function upsertRecurringInvoice(inv: RecurringInvoiceRecord): Promise<void> {
  await sbThrow(supabase.from('recurring_invoices').upsert(recurringInvoiceToDb(inv), { onConflict: 'id' }));
}

export async function deleteRecurringInvoiceDb(id: string): Promise<void> {
  await sbThrow(supabase.from('recurring_invoices').delete().eq('id', id));
}

/* ─── INVENTORY ITEMS ──────────────────────────────────────── */

export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  unit: string;
  quantity: number;
  minStockLevel: number;
  maxStockLevel: number;
  unitCost: number;
  location: string;
  status: string;
  supplier: string;
  lastReorderDate?: string;
}

function dbToInventoryItem(row: any): InventoryItem {
  return {
    id: row.id, code: row.code, name: row.name, category: row.category,
    description: row.description, unit: row.unit, quantity: row.quantity,
    minStockLevel: row.min_stock_level, maxStockLevel: row.max_stock_level,
    unitCost: row.unit_cost, location: row.location, status: row.status,
    supplier: row.supplier, lastReorderDate: row.last_reorder_date ?? undefined,
  };
}

function inventoryItemToDb(i: InventoryItem) {
  return {
    id: i.id, code: i.code, name: i.name, category: i.category,
    description: i.description, unit: i.unit, quantity: i.quantity,
    min_stock_level: i.minStockLevel, max_stock_level: i.maxStockLevel,
    unit_cost: i.unitCost, location: i.location, status: i.status,
    supplier: i.supplier, last_reorder_date: i.lastReorderDate ?? null,
  };
}

export async function fetchInventoryItems(): Promise<InventoryItem[]> {
  const { data, error } = await supabase.from('inventory_items').select('*');
  if (error) throw error; if (!data) return [];
  return data.map(dbToInventoryItem);
}

export async function upsertInventoryItem(item: InventoryItem): Promise<void> {
  await sbThrow(supabase.from('inventory_items').upsert(inventoryItemToDb(item), { onConflict: 'id' }));
}

export async function deleteInventoryItemDb(id: string): Promise<void> {
  await sbThrow(supabase.from('inventory_items').delete().eq('id', id));
}

/* ─── FIXED ASSETS ─────────────────────────────────────────── */

export interface FixedAsset {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  location: string;
  purchaseDate: string;
  purchasePrice: number;
  salvageValue: number;
  usefulLifeYears: number;
  depreciationMethod: string;
  accumulatedDepreciation: number;
  currentValue: number;
  status: string;
  assignedTo?: string;
  warrantyExpiry?: string;
  maintenanceDate?: string;
}

function dbToFixedAsset(row: any): FixedAsset {
  return {
    id: row.id, code: row.code, name: row.name, category: row.category,
    description: row.description, location: row.location,
    purchaseDate: row.purchase_date, purchasePrice: row.purchase_price,
    salvageValue: row.salvage_value, usefulLifeYears: row.useful_life_years,
    depreciationMethod: row.depreciation_method,
    accumulatedDepreciation: row.accumulated_depreciation,
    currentValue: row.current_value, status: row.status,
    assignedTo: row.assigned_to ?? undefined,
    warrantyExpiry: row.warranty_expiry ?? undefined,
    maintenanceDate: row.maintenance_date ?? undefined,
  };
}

function fixedAssetToDb(a: FixedAsset) {
  return {
    id: a.id, code: a.code, name: a.name, category: a.category,
    description: a.description, location: a.location,
    purchase_date: a.purchaseDate, purchase_price: a.purchasePrice,
    salvage_value: a.salvageValue, useful_life_years: a.usefulLifeYears,
    depreciation_method: a.depreciationMethod,
    accumulated_depreciation: a.accumulatedDepreciation,
    current_value: a.currentValue, status: a.status,
    assigned_to: a.assignedTo ?? null,
    warranty_expiry: a.warrantyExpiry ?? null,
    maintenance_date: a.maintenanceDate ?? null,
  };
}

export async function fetchFixedAssets(): Promise<FixedAsset[]> {
  const { data, error } = await supabase.from('fixed_assets').select('*');
  if (error) throw error; if (!data) return [];
  return data.map(dbToFixedAsset);
}

export async function upsertFixedAsset(asset: FixedAsset): Promise<void> {
  await sbThrow(supabase.from('fixed_assets').upsert(fixedAssetToDb(asset), { onConflict: 'id' }));
}

export async function deleteFixedAssetDb(id: string): Promise<void> {
  await sbThrow(supabase.from('fixed_assets').delete().eq('id', id));
}

/* ─── CURRENCY POSTING DOCS ────────────────────────────────── */

export interface CurrencyPostingDoc {
  id: string;
  type: 'invoice' | 'expense' | 'payment' | 'journal';
  reference: string;
  party: string;
  foreignCurrency: string;
  foreignAmount: number;
  exchangeRate: number;
  baseAmount: number;
  status: 'pending' | 'posted' | 'failed';
  postingDate: string;
  lines: { account: string; accountCode: string; debitBase: number; creditBase: number }[];
}

function dbToCurrencyPostingDoc(row: any): CurrencyPostingDoc {
  return {
    id: row.id, type: row.type, reference: row.reference, party: row.party,
    foreignCurrency: row.foreign_currency, foreignAmount: row.foreign_amount,
    exchangeRate: row.exchange_rate, baseAmount: row.base_amount,
    status: row.status, postingDate: row.posting_date,
    lines: row.lines ?? [],
  };
}

function currencyPostingDocToDb(d: CurrencyPostingDoc) {
  return {
    id: d.id, type: d.type, reference: d.reference, party: d.party,
    foreign_currency: d.foreignCurrency, foreign_amount: d.foreignAmount,
    exchange_rate: d.exchangeRate, base_amount: d.baseAmount,
    status: d.status, posting_date: d.postingDate,
    lines: JSON.stringify(d.lines),
  };
}

export async function fetchCurrencyPostingDocs(): Promise<CurrencyPostingDoc[]> {
  const { data, error } = await supabase.from('currency_posting_docs').select('*');
  if (error) throw error; if (!data) return [];
  return data.map(dbToCurrencyPostingDoc);
}

export async function upsertCurrencyPostingDoc(doc: CurrencyPostingDoc): Promise<void> {
  await sbThrow(supabase.from('currency_posting_docs').upsert(currencyPostingDocToDb(doc), { onConflict: 'id' }));
}

export async function deleteCurrencyPostingDocDb(id: string): Promise<void> {
  await sbThrow(supabase.from('currency_posting_docs').delete().eq('id', id));
}

/* ─── SUPPLIER AUTOMATION RULES ────────────────────────────── */

export interface SupplierAutomationRule {
  id: string;
  name: string;
  supplier: string;
  status: string;
  lastRun: string;
  matches: number;
}

function dbToSupplierAutomationRule(row: any): SupplierAutomationRule {
  return {
    id: row.id, name: row.name, supplier: row.supplier,
    status: row.status, lastRun: row.last_run ?? '', matches: row.matches,
  };
}

export async function fetchSupplierAutomationRules(): Promise<SupplierAutomationRule[]> {
  const { data, error } = await supabase.from('supplier_automation_rules').select('*');
  if (error) throw error; if (!data) return [];
  return data.map(dbToSupplierAutomationRule);
}

export async function upsertSupplierAutomationRule(rule: SupplierAutomationRule): Promise<void> {
  await sbThrow(supabase.from('supplier_automation_rules').upsert({
    id: rule.id, name: rule.name, supplier: rule.supplier,
    status: rule.status, last_run: rule.lastRun, matches: rule.matches,
  }, { onConflict: 'id' }));
}

/* ─── SUPPLIER PENDING INVOICES ────────────────────────────── */

export interface SupplierPendingInvoice {
  id: string;
  supplier: string;
  amount: number;
  bookings: number;
  status: string;
  uploadDate: string;
}

function dbToSupplierPendingInvoice(row: any): SupplierPendingInvoice {
  return {
    id: row.id, supplier: row.supplier, amount: row.amount,
    bookings: row.bookings, status: row.status, uploadDate: row.upload_date,
  };
}

export async function fetchSupplierPendingInvoices(): Promise<SupplierPendingInvoice[]> {
  const { data, error } = await supabase.from('supplier_pending_invoices').select('*');
  if (error) throw error; if (!data) return [];
  return data.map(dbToSupplierPendingInvoice);
}

export async function upsertSupplierPendingInvoice(inv: SupplierPendingInvoice): Promise<void> {
  await sbThrow(supabase.from('supplier_pending_invoices').upsert({
    id: inv.id, supplier: inv.supplier, amount: inv.amount,
    bookings: inv.bookings, status: inv.status, upload_date: inv.uploadDate,
  }, { onConflict: 'id' }));
}

// ══════════════════════════════════════════════════════════════════════════════
// 14. SALES PIPELINE — Quotes, Sales Orders, Credit Notes, Bills
// ══════════════════════════════════════════════════════════════════════════════

/* ─── QUOTES ──────────────────────────────────────────────── */

export interface Quote {
  id: string;
  quoteNumber: string;
  customer: string;
  agent?: string;
  date: string;
  expiryDate: string;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Declined' | 'Expired' | 'Converted';
  subtotal: number;
  discountPct: number;
  vat: number;
  total: number;
  currency: string;
  notes?: string;
  terms?: string;
  convertedToSo?: string;
  convertedToInv?: string;
  createdAt?: string;
  items: QuoteItem[];
}

export interface QuoteItem {
  id: string;
  quoteId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  taxRate: number;
  total: number;
}

function dbToQuote(row: any, items: QuoteItem[]): Quote {
  return {
    id: row.id, quoteNumber: row.quote_number, customer: row.customer,
    agent: row.agent ?? undefined, date: row.date, expiryDate: row.expiry_date,
    status: row.status, subtotal: Number(row.subtotal), discountPct: Number(row.discount_pct),
    vat: Number(row.vat), total: Number(row.total), currency: row.currency,
    notes: row.notes ?? undefined, terms: row.terms ?? undefined,
    convertedToSo: row.converted_to_so ?? undefined,
    convertedToInv: row.converted_to_inv ?? undefined,
    createdAt: row.created_at, items,
  };
}

function dbToQuoteItem(row: any): QuoteItem {
  return {
    id: row.id, quoteId: row.quote_id, description: row.description,
    quantity: Number(row.quantity), unitPrice: Number(row.unit_price),
    discountPct: Number(row.discount_pct), taxRate: Number(row.tax_rate),
    total: Number(row.total),
  };
}

export async function fetchQuotes(): Promise<Quote[]> {
  const { data: rows, error } = await supabase.from('quotes').select('*').order('created_at', { ascending: false });
  if (error) throw error; if (!rows) return [];
  const { data: itemRows } = await supabase.from('quote_items').select('*');
  const allItems = (itemRows ?? []).map(dbToQuoteItem);
  return rows.map(r => dbToQuote(r, allItems.filter(i => i.quoteId === r.id)));
}

export async function upsertQuote(q: Quote): Promise<void> {
  await sbThrow(supabase.from('quotes').upsert({
    id: q.id, quote_number: q.quoteNumber, customer: q.customer, agent: q.agent ?? null,
    date: q.date, expiry_date: q.expiryDate, status: q.status, subtotal: q.subtotal,
    discount_pct: q.discountPct, vat: q.vat, total: q.total, currency: q.currency,
    notes: q.notes ?? null, terms: q.terms ?? null,
    converted_to_so: q.convertedToSo ?? null, converted_to_inv: q.convertedToInv ?? null,
  }, { onConflict: 'id' }));
  // Upsert items
  if (q.items.length > 0) {
    await sbThrow(supabase.from('quote_items').upsert(q.items.map(i => ({
      id: i.id, quote_id: i.quoteId, description: i.description,
      quantity: i.quantity, unit_price: i.unitPrice, discount_pct: i.discountPct,
      tax_rate: i.taxRate, total: i.total,
    })), { onConflict: 'id' }));
  }
}

export async function deleteQuote(id: string): Promise<void> {
  await sbThrow(supabase.from('quotes').delete().eq('id', id));
}

/* ─── SALES ORDERS ────────────────────────────────────────── */

export interface SalesOrder {
  id: string;
  soNumber: string;
  customer: string;
  agent?: string;
  date: string;
  deliveryDate?: string;
  status: 'Draft' | 'Confirmed' | 'In Progress' | 'Delivered' | 'Invoiced' | 'Cancelled';
  subtotal: number;
  vat: number;
  total: number;
  currency: string;
  quoteId?: string;
  invoiceId?: string;
  notes?: string;
  createdAt?: string;
  items: SalesOrderItem[];
}

export interface SalesOrderItem {
  id: string;
  salesOrderId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  taxRate: number;
  total: number;
}

function dbToSalesOrder(row: any, items: SalesOrderItem[]): SalesOrder {
  return {
    id: row.id, soNumber: row.so_number, customer: row.customer,
    agent: row.agent ?? undefined, date: row.date,
    deliveryDate: row.delivery_date ?? undefined, status: row.status,
    subtotal: Number(row.subtotal), vat: Number(row.vat), total: Number(row.total),
    currency: row.currency, quoteId: row.quote_id ?? undefined,
    invoiceId: row.invoice_id ?? undefined, notes: row.notes ?? undefined,
    createdAt: row.created_at, items,
  };
}

function dbToSalesOrderItem(row: any): SalesOrderItem {
  return {
    id: row.id, salesOrderId: row.sales_order_id, description: row.description,
    quantity: Number(row.quantity), unitPrice: Number(row.unit_price),
    discountPct: Number(row.discount_pct), taxRate: Number(row.tax_rate),
    total: Number(row.total),
  };
}

export async function fetchSalesOrders(): Promise<SalesOrder[]> {
  const { data: rows, error } = await supabase.from('sales_orders').select('*').order('created_at', { ascending: false });
  if (error) throw error; if (!rows) return [];
  const { data: itemRows } = await supabase.from('sales_order_items').select('*');
  const allItems = (itemRows ?? []).map(dbToSalesOrderItem);
  return rows.map(r => dbToSalesOrder(r, allItems.filter(i => i.salesOrderId === r.id)));
}

export async function upsertSalesOrder(so: SalesOrder): Promise<void> {
  await sbThrow(supabase.from('sales_orders').upsert({
    id: so.id, so_number: so.soNumber, customer: so.customer, agent: so.agent ?? null,
    date: so.date, delivery_date: so.deliveryDate ?? null, status: so.status,
    subtotal: so.subtotal, vat: so.vat, total: so.total, currency: so.currency,
    quote_id: so.quoteId ?? null, invoice_id: so.invoiceId ?? null, notes: so.notes ?? null,
  }, { onConflict: 'id' }));
  if (so.items.length > 0) {
    await sbThrow(supabase.from('sales_order_items').upsert(so.items.map(i => ({
      id: i.id, sales_order_id: i.salesOrderId, description: i.description,
      quantity: i.quantity, unit_price: i.unitPrice, discount_pct: i.discountPct,
      tax_rate: i.taxRate, total: i.total,
    })), { onConflict: 'id' }));
  }
}

export async function deleteSalesOrder(id: string): Promise<void> {
  await sbThrow(supabase.from('sales_orders').delete().eq('id', id));
}

/* ─── CREDIT NOTES ────────────────────────────────────────── */

export interface CreditNote {
  id: string;
  cnNumber: string;
  type: 'Credit' | 'Debit';
  invoiceId?: string;
  customer: string;
  date: string;
  reason: string;
  subtotal: number;
  vat: number;
  total: number;
  currency: string;
  status: 'Draft' | 'Open' | 'Applied' | 'Void';
  refundStatus: 'None' | 'Partial' | 'Full';
  refundAmount: number;
  createdAt?: string;
  items: CreditNoteItem[];
}

export interface CreditNoteItem {
  id: string;
  creditNoteId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

function dbToCreditNote(row: any, items: CreditNoteItem[]): CreditNote {
  return {
    id: row.id, cnNumber: row.cn_number, type: row.type,
    invoiceId: row.invoice_id ?? undefined, customer: row.customer,
    date: row.date, reason: row.reason, subtotal: Number(row.subtotal),
    vat: Number(row.vat), total: Number(row.total), currency: row.currency,
    status: row.status, refundStatus: row.refund_status,
    refundAmount: Number(row.refund_amount), createdAt: row.created_at, items,
  };
}

function dbToCreditNoteItem(row: any): CreditNoteItem {
  return {
    id: row.id, creditNoteId: row.credit_note_id, description: row.description,
    quantity: Number(row.quantity), unitPrice: Number(row.unit_price),
    total: Number(row.total),
  };
}

export async function fetchCreditNotes(): Promise<CreditNote[]> {
  const { data: rows, error } = await supabase.from('credit_notes').select('*').order('created_at', { ascending: false });
  if (error) throw error; if (!rows) return [];
  const { data: itemRows } = await supabase.from('credit_note_items').select('*');
  const allItems = (itemRows ?? []).map(dbToCreditNoteItem);
  return rows.map(r => dbToCreditNote(r, allItems.filter(i => i.creditNoteId === r.id)));
}

export async function upsertCreditNote(cn: CreditNote): Promise<void> {
  await sbThrow(supabase.from('credit_notes').upsert({
    id: cn.id, cn_number: cn.cnNumber, type: cn.type,
    invoice_id: cn.invoiceId ?? null, customer: cn.customer,
    date: cn.date, reason: cn.reason, subtotal: cn.subtotal,
    vat: cn.vat, total: cn.total, currency: cn.currency,
    status: cn.status, refund_status: cn.refundStatus,
    refund_amount: cn.refundAmount,
  }, { onConflict: 'id' }));
  if (cn.items.length > 0) {
    await sbThrow(supabase.from('credit_note_items').upsert(cn.items.map(i => ({
      id: i.id, credit_note_id: i.creditNoteId, description: i.description,
      quantity: i.quantity, unit_price: i.unitPrice, total: i.total,
    })), { onConflict: 'id' }));
  }
}

export async function deleteCreditNote(id: string): Promise<void> {
  await sbThrow(supabase.from('credit_notes').delete().eq('id', id));
}

/* ─── BILLS ───────────────────────────────────────────────── */

export interface Bill {
  id: string;
  billNumber: string;
  vendor: string;
  vendorBillRef?: string;
  date: string;
  dueDate: string;
  status: 'Draft' | 'Pending Approval' | 'Approved' | 'Partially Paid' | 'Paid' | 'Overdue' | 'Void';
  subtotal: number;
  vat: number;
  total: number;
  currency: string;
  amountPaid: number;
  purchaseOrderId?: string;
  recurring: boolean;
  recurringProfileId?: string;
  notes?: string;
  createdAt?: string;
  items: BillItem[];
}

export interface BillItem {
  id: string;
  billId: string;
  description: string;
  accountId?: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
}

function dbToBill(row: any, items: BillItem[]): Bill {
  return {
    id: row.id, billNumber: row.bill_number, vendor: row.vendor,
    vendorBillRef: row.vendor_bill_ref ?? undefined, date: row.date,
    dueDate: row.due_date, status: row.status, subtotal: Number(row.subtotal),
    vat: Number(row.vat), total: Number(row.total), currency: row.currency,
    amountPaid: Number(row.amount_paid), purchaseOrderId: row.purchase_order_id ?? undefined,
    recurring: row.recurring, recurringProfileId: row.recurring_profile_id ?? undefined,
    notes: row.notes ?? undefined, createdAt: row.created_at, items,
  };
}

function dbToBillItem(row: any): BillItem {
  return {
    id: row.id, billId: row.bill_id, description: row.description,
    accountId: row.account_id ?? undefined, quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price), taxRate: Number(row.tax_rate),
    total: Number(row.total),
  };
}

export async function fetchBills(): Promise<Bill[]> {
  const { data: rows, error } = await supabase.from('bills').select('*').order('created_at', { ascending: false });
  if (error) throw error; if (!rows) return [];
  const { data: itemRows } = await supabase.from('bill_items').select('*');
  const allItems = (itemRows ?? []).map(dbToBillItem);
  return rows.map(r => dbToBill(r, allItems.filter(i => i.billId === r.id)));
}

export async function upsertBill(b: Bill): Promise<void> {
  await sbThrow(supabase.from('bills').upsert({
    id: b.id, bill_number: b.billNumber, vendor: b.vendor,
    vendor_bill_ref: b.vendorBillRef ?? null, date: b.date,
    due_date: b.dueDate, status: b.status, subtotal: b.subtotal,
    vat: b.vat, total: b.total, currency: b.currency,
    amount_paid: b.amountPaid, purchase_order_id: b.purchaseOrderId ?? null,
    recurring: b.recurring, recurring_profile_id: b.recurringProfileId ?? null,
    notes: b.notes ?? null,
  }, { onConflict: 'id' }));
  if (b.items.length > 0) {
    await sbThrow(supabase.from('bill_items').upsert(b.items.map(i => ({
      id: i.id, bill_id: i.billId, description: i.description,
      account_id: i.accountId ?? null, quantity: i.quantity,
      unit_price: i.unitPrice, tax_rate: i.taxRate, total: i.total,
    })), { onConflict: 'id' }));
  }
}

export async function deleteBill(id: string): Promise<void> {
  await sbThrow(supabase.from('bills').delete().eq('id', id));
}
