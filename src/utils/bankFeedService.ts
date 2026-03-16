// ─── Bank Feed Service ─────────────────────────────────────────────────────────
// Simulates a real Bank Provider API → Feed Service → Transactions → Auto-Match pipeline
// In production: replace fetchFromProvider() with real Open Banking / CBUAE API calls

import type { BankTx } from './reconciliationEngine';

// ─── Provider Types ────────────────────────────────────────────────────────────
export type ProviderStatus = 'connected' | 'disconnected' | 'error' | 'syncing' | 'pending_auth';
export type SyncFrequency = 'realtime' | 'hourly' | 'daily' | 'manual';
export type FeedStatus = 'success' | 'partial' | 'error' | 'no_new';

export interface BankProvider {
  id: string;
  name: string;
  code: string;               // e.g. 'ENBD', 'ADCB', 'FAB'
  country: string;
  logo: string;               // emoji fallback
  color: string;
  supportsRealtime: boolean;
  supportsBalance: boolean;
  apiEndpoint: string;        // mock endpoint
  authType: 'oauth2' | 'apikey' | 'credentials';
  status: ProviderStatus;
}

export interface BankConnection {
  id: string;
  providerId: string;
  providerName: string;
  accountName: string;
  accountNumber: string;      // masked e.g. ****4521
  accountType: 'current' | 'savings' | 'credit' | 'deposit';
  currency: string;
  balance: number;
  availableBalance: number;
  status: ProviderStatus;
  lastSync: string;
  nextSync: string;
  syncFrequency: SyncFrequency;
  autoMatch: boolean;
  autoPost: boolean;
  totalImported: number;
  totalMatched: number;
  connectedAt: string;
  errorMessage?: string;
  consentExpiry?: string;
}

export interface FeedTransaction extends BankTx {
  feedId: string;
  connectionId: string;
  providerRef: string;
  rawData: Record<string, string | number>;
  enriched: boolean;
  category?: string;
  merchantName?: string;
  merchantCategory?: string;
  location?: string;
  pending: boolean;
  reversed: boolean;
  originalAmount?: number;
  originalCurrency?: string;
  fxRate?: number;
}

export interface SyncResult {
  connectionId: string;
  status: FeedStatus;
  fetched: number;
  newTransactions: number;
  duplicates: number;
  autoMatched: number;
  errors: string[];
  transactions: FeedTransaction[];
  syncedAt: string;
  duration: number;           // ms
}

export interface FeedSchedule {
  connectionId: string;
  frequency: SyncFrequency;
  lastRun: string;
  nextRun: string;
  enabled: boolean;
  retryCount: number;
  maxRetries: number;
}

export interface WebhookEvent {
  id: string;
  type: 'transaction.created' | 'transaction.updated' | 'balance.updated' | 'connection.status';
  connectionId: string;
  payload: Record<string, unknown>;
  receivedAt: string;
  processed: boolean;
}

// ─── Available Bank Providers ──────────────────────────────────────────────────
export const BANK_PROVIDERS: BankProvider[] = [
  {
    id: 'enbd', name: 'Emirates NBD', code: 'ENBD', country: 'UAE',
    logo: '🏦', color: 'bg-yellow-500',
    supportsRealtime: true, supportsBalance: true,
    apiEndpoint: 'https://api.emiratesnbd.com/openbanking/v2',
    authType: 'oauth2', status: 'disconnected',
  },
  {
    id: 'adcb', name: 'Abu Dhabi Commercial Bank', code: 'ADCB', country: 'UAE',
    logo: '🏛', color: 'bg-blue-600',
    supportsRealtime: true, supportsBalance: true,
    apiEndpoint: 'https://api.adcb.com/openbanking/v1',
    authType: 'oauth2', status: 'disconnected',
  },
  {
    id: 'fab', name: 'First Abu Dhabi Bank', code: 'FAB', country: 'UAE',
    logo: '🏦', color: 'bg-emerald-600',
    supportsRealtime: false, supportsBalance: true,
    apiEndpoint: 'https://api.bankfab.com/openbanking/v1',
    authType: 'oauth2', status: 'disconnected',
  },
  {
    id: 'mashreq', name: 'Mashreq Bank', code: 'MASHREQ', country: 'UAE',
    logo: '🔴', color: 'bg-red-600',
    supportsRealtime: false, supportsBalance: true,
    apiEndpoint: 'https://api.mashreq.com/banking/v2',
    authType: 'apikey', status: 'disconnected',
  },
  {
    id: 'rakbank', name: 'RAK Bank', code: 'RAK', country: 'UAE',
    logo: '🟤', color: 'bg-amber-700',
    supportsRealtime: false, supportsBalance: false,
    apiEndpoint: 'https://api.rakbank.ae/openbanking/v1',
    authType: 'credentials', status: 'disconnected',
  },
  {
    id: 'cbd', name: 'Commercial Bank of Dubai', code: 'CBD', country: 'UAE',
    logo: '🟦', color: 'bg-blue-800',
    supportsRealtime: false, supportsBalance: true,
    apiEndpoint: 'https://api.cbd.ae/banking/v1',
    authType: 'oauth2', status: 'disconnected',
  },
];

// ─── Mock Transaction Generator ────────────────────────────────────────────────
// Simulates transactions returned by a bank provider API
const MERCHANT_TEMPLATES = [
  { desc: 'Transfer from Global Tours UK', ref: 'AGT', debit: 0, credit: 15000, cat: 'Agent Receipt', merchant: 'Global Tours UK' },
  { desc: 'Payment to Marriott Hotels UAE', ref: 'HTL', debit: 8500, credit: 0, cat: 'Hotel Payment', merchant: 'Marriott Hotels' },
  { desc: 'Card payment - Desert Safari LLC', ref: 'ACT', debit: 3200, credit: 0, cat: 'Activity Payment', merchant: 'Desert Safari LLC' },
  { desc: 'Receipt from Asia Pacific Travel', ref: 'AGT', debit: 0, credit: 22000, cat: 'Agent Receipt', merchant: 'Asia Pacific Travel' },
  { desc: 'Bank charges and fees', ref: 'CHG', debit: 250, credit: 0, cat: 'Bank Charges', merchant: 'Bank' },
  { desc: 'Fuel purchase - ADNOC', ref: 'FUEL', debit: 1200, credit: 0, cat: 'Fuel', merchant: 'ADNOC' },
  { desc: 'Office supplies - Amazon AE', ref: 'EXP', debit: 450, credit: 0, cat: 'Office Expense', merchant: 'Amazon AE' },
  { desc: 'Transfer from Euro Holidays Ltd', ref: 'AGT', debit: 0, credit: 18500, cat: 'Agent Receipt', merchant: 'Euro Holidays' },
  { desc: 'Driver salary payment', ref: 'SAL', debit: 4500, credit: 0, cat: 'Payroll', merchant: 'Internal' },
  { desc: 'VAT payment to FTA', ref: 'VAT', debit: 12500, credit: 0, cat: 'VAT Payment', merchant: 'FTA UAE' },
  { desc: 'Online payment gateway receipt', ref: 'OPG', debit: 0, credit: 5250, cat: 'Customer Receipt', merchant: 'Payment Gateway' },
  { desc: 'Telecom - Etisalat business', ref: 'UTIL', debit: 890, credit: 0, cat: 'Utilities', merchant: 'Etisalat' },
];

let txCounter = 1000;

export function generateMockTransactions(
  connectionId: string,
  count: number = 8,
  bank: string = 'Emirates NBD'
): FeedTransaction[] {
  const now = new Date();
  const txs: FeedTransaction[] = [];

  for (let i = 0; i < count; i++) {
    const template = MERCHANT_TEMPLATES[Math.floor(Math.random() * MERCHANT_TEMPLATES.length)];
    const daysAgo = Math.floor(Math.random() * 7);
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);

    const amount = template.credit > 0
      ? template.credit * (0.8 + Math.random() * 0.4)
      : template.debit * (0.8 + Math.random() * 0.4);
    const rounded = Math.round(amount * 100) / 100;

    txCounter++;
    const id = `FEED-${txCounter}`;

    txs.push({
      id,
      feedId: `FD-${Date.now()}-${i}`,
      connectionId,
      providerRef: `${template.ref}-${txCounter}`,
      date: date.toISOString().split('T')[0],
      description: template.desc,
      reference: `${template.ref}-${txCounter}`,
      debit: template.debit > 0 ? rounded : 0,
      credit: template.credit > 0 ? rounded : 0,
      balance: 400000 + Math.random() * 100000,
      status: 'Unmatched',
      source: 'Feed',
      bank,
      rawData: { template: template.desc, amount: rounded },
      enriched: true,
      category: template.cat,
      merchantName: template.merchant,
      merchantCategory: template.cat,
      pending: Math.random() < 0.1,
      reversed: false,
    });
  }

  return txs;
}

// ─── Duplicate Detection ───────────────────────────────────────────────────────
export function detectDuplicates(
  incoming: FeedTransaction[],
  existing: BankTx[]
): { unique: FeedTransaction[]; duplicates: FeedTransaction[] } {
  const unique: FeedTransaction[] = [];
  const duplicates: FeedTransaction[] = [];

  for (const tx of incoming) {
    const isDuplicate = existing.some(e => {
      // Match by provider reference
      if (e.reference === tx.reference) return true;
      // Match by amount + date + direction within 1 day
      const eDate = new Date(e.date).getTime();
      const tDate = new Date(tx.date).getTime();
      const dayDiff = Math.abs(eDate - tDate) / (1000 * 60 * 60 * 24);
      const eAmt = e.debit || e.credit;
      const tAmt = tx.debit || tx.credit;
      return dayDiff <= 1 && Math.abs(eAmt - tAmt) < 0.01;
    });

    if (isDuplicate) duplicates.push(tx);
    else unique.push(tx);
  }

  return { unique, duplicates };
}

// ─── Category Enrichment ───────────────────────────────────────────────────────
const CATEGORY_RULES: { pattern: RegExp; category: string }[] = [
  { pattern: /hotel|marriott|hilton|hyatt|rotana|sofitel/i, category: 'Hotel Payment' },
  { pattern: /safari|excursion|activity|ticket|attraction/i, category: 'Activity Payment' },
  { pattern: /visa|immigration|embassy/i, category: 'Visa Services' },
  { pattern: /fuel|adnoc|enoc|petrol/i, category: 'Fuel' },
  { pattern: /salary|payroll|wages|driver/i, category: 'Payroll' },
  { pattern: /vat|fta|tax/i, category: 'VAT Payment' },
  { pattern: /charge|fee|commission/i, category: 'Bank Charges' },
  { pattern: /transfer|receipt|agent|tours|travel|holiday/i, category: 'Agent Receipt' },
  { pattern: /rent|office|lease/i, category: 'Office Rent' },
  { pattern: /telecom|etisalat|du |phone|internet/i, category: 'Utilities' },
  { pattern: /amazon|supplies|stationery/i, category: 'Office Expense' },
  { pattern: /marketing|google|meta|advertising/i, category: 'Marketing' },
];

export function enrichTransaction(tx: FeedTransaction): FeedTransaction {
  const text = `${tx.description} ${tx.reference}`.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) {
      return { ...tx, category: rule.category, enriched: true };
    }
  }
  return { ...tx, enriched: true };
}

// ─── Sync Simulator ───────────────────────────────────────────────────────────
// Simulates what a real bank feed sync would do
export async function simulateSync(
  connection: BankConnection,
  existingTxs: BankTx[],
  onProgress?: (pct: number) => void
): Promise<SyncResult> {
  const start = Date.now();

  // Simulate network latency
  await new Promise(r => setTimeout(r, 500));
  onProgress?.(20);

  // Generate raw transactions from provider
  const count = 4 + Math.floor(Math.random() * 8);
  const raw = generateMockTransactions(connection.id, count, connection.providerName);
  onProgress?.(50);

  // Duplicate detection
  const { unique, duplicates } = detectDuplicates(raw, existingTxs);
  onProgress?.(70);

  // Category enrichment
  const enriched = unique.map(enrichTransaction);
  onProgress?.(90);

  await new Promise(r => setTimeout(r, 200));
  onProgress?.(100);

  return {
    connectionId: connection.id,
    status: unique.length > 0 ? 'success' : 'no_new',
    fetched: raw.length,
    newTransactions: unique.length,
    duplicates: duplicates.length,
    autoMatched: 0, // Will be updated after matching
    errors: [],
    transactions: enriched,
    syncedAt: new Date().toISOString(),
    duration: Date.now() - start,
  };
}

// ─── Feed Schedule Calculator ──────────────────────────────────────────────────
export function calcNextSync(frequency: SyncFrequency, from: Date = new Date()): string {
  const d = new Date(from);
  switch (frequency) {
    case 'realtime': d.setMinutes(d.getMinutes() + 5); break;
    case 'hourly':   d.setHours(d.getHours() + 1);     break;
    case 'daily':    d.setDate(d.getDate() + 1);        break;
    case 'manual':   d.setFullYear(d.getFullYear() + 99); break;
  }
  return d.toISOString();
}

// ─── API Documentation (for developer reference) ───────────────────────────────
export const API_DOCS = {
  baseUrl: '/api/v1/bank-feeds',
  endpoints: [
    {
      method: 'GET', path: '/providers',
      description: 'List all available bank providers',
      response: 'BankProvider[]',
    },
    {
      method: 'POST', path: '/connections',
      description: 'Create a new bank connection (OAuth2 redirect or API key)',
      body: '{ providerId, accountNumber, authCode?, apiKey? }',
      response: 'BankConnection',
    },
    {
      method: 'GET', path: '/connections',
      description: 'List all active bank connections',
      response: 'BankConnection[]',
    },
    {
      method: 'DELETE', path: '/connections/:id',
      description: 'Disconnect a bank connection and revoke consent',
      response: '{ success: true }',
    },
    {
      method: 'POST', path: '/connections/:id/sync',
      description: 'Trigger a manual sync for a connection',
      response: 'SyncResult',
    },
    {
      method: 'GET', path: '/transactions',
      description: 'Get feed transactions with filters',
      query: '{ connectionId?, dateFrom?, dateTo?, status?, category? }',
      response: 'FeedTransaction[]',
    },
    {
      method: 'POST', path: '/transactions/:id/match',
      description: 'Manually match a feed transaction to a book transaction',
      body: '{ bookTxId, note? }',
      response: 'RecMatch',
    },
    {
      method: 'POST', path: '/rules',
      description: 'Create a bank rule for auto-categorization/matching',
      body: '{ name, pattern, action, category, direction? }',
      response: 'BankRule',
    },
    {
      method: 'POST', path: '/webhooks',
      description: 'Register a webhook for real-time transaction events',
      body: '{ url, events: ["transaction.created", "balance.updated"] }',
      response: 'WebhookRegistration',
    },
  ],
  dbTables: [
    {
      name: 'bank_connections',
      columns: ['id', 'provider_id', 'account_name', 'account_number', 'currency', 'status', 'last_sync', 'next_sync', 'sync_frequency', 'auto_match', 'auto_post', 'consent_expiry', 'created_at'],
    },
    {
      name: 'feed_transactions',
      columns: ['id', 'feed_id', 'connection_id', 'provider_ref', 'date', 'description', 'reference', 'debit', 'credit', 'balance', 'status', 'category', 'merchant_name', 'pending', 'reversed', 'enriched', 'created_at'],
    },
    {
      name: 'feed_sync_logs',
      columns: ['id', 'connection_id', 'status', 'fetched', 'new_count', 'duplicate_count', 'auto_matched', 'errors', 'synced_at', 'duration_ms'],
    },
    {
      name: 'feed_schedules',
      columns: ['id', 'connection_id', 'frequency', 'last_run', 'next_run', 'enabled', 'retry_count'],
    },
    {
      name: 'webhook_events',
      columns: ['id', 'type', 'connection_id', 'payload', 'received_at', 'processed'],
    },
  ],
};
