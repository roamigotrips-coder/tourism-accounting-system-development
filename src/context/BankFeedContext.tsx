import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  type BankConnection, type FeedTransaction, type SyncResult, type FeedSchedule,
  type WebhookEvent, simulateSync, calcNextSync,
} from '../utils/bankFeedService';
import { runAutoMatch, type BankTx, type BookTx, type RecMatch } from '../utils/reconciliationEngine';

// ─── Context Types ─────────────────────────────────────────────────────────────
interface BankFeedContextType {
  // Connections
  connections: BankConnection[];
  addConnection: (c: BankConnection) => void;
  updateConnection: (id: string, updates: Partial<BankConnection>) => void;
  removeConnection: (id: string) => void;

  // Feed Transactions
  feedTransactions: FeedTransaction[];
  addFeedTransactions: (txs: FeedTransaction[]) => void;
  updateFeedTx: (id: string, updates: Partial<FeedTransaction>) => void;

  // Book Transactions (mirror from Reconciliation)
  bookTransactions: BookTx[];
  setBookTransactions: (txs: BookTx[]) => void;

  // Matches
  matches: RecMatch[];
  setMatches: (m: RecMatch[]) => void;

  // Sync
  syncLogs: SyncResult[];
  syncingIds: Set<string>;
  syncConnection: (connectionId: string) => Promise<void>;
  syncAll: () => Promise<void>;

  // Schedules
  schedules: FeedSchedule[];
  updateSchedule: (connectionId: string, updates: Partial<FeedSchedule>) => void;

  // Webhooks
  webhookEvents: WebhookEvent[];
  addWebhookEvent: (e: WebhookEvent) => void;

  // Stats
  totalUnmatched: number;
  totalMatched: number;
  totalPending: number;
  lastSyncTime: string | null;
}

const BankFeedContext = createContext<BankFeedContextType | null>(null);

// ─── Initial Mock Connections ──────────────────────────────────────────────────
const INIT_CONNECTIONS: BankConnection[] = [
  {
    id: 'conn-001', providerId: 'enbd', providerName: 'Emirates NBD',
    accountName: 'Main Operating Account', accountNumber: '****4521',
    accountType: 'current', currency: 'AED', balance: 402325, availableBalance: 398000,
    status: 'connected', lastSync: new Date(Date.now() - 3600000).toISOString(),
    nextSync: new Date(Date.now() + 3600000).toISOString(),
    syncFrequency: 'hourly', autoMatch: true, autoPost: false,
    totalImported: 284, totalMatched: 271,
    connectedAt: '2024-01-15T09:00:00Z', consentExpiry: '2025-01-15T09:00:00Z',
  },
  {
    id: 'conn-002', providerId: 'adcb', providerName: 'ADCB',
    accountName: 'Petty Cash Account', accountNumber: '****8834',
    accountType: 'current', currency: 'AED', balance: 25000, availableBalance: 25000,
    status: 'connected', lastSync: new Date(Date.now() - 86400000).toISOString(),
    nextSync: new Date(Date.now() + 86400000).toISOString(),
    syncFrequency: 'daily', autoMatch: true, autoPost: false,
    totalImported: 56, totalMatched: 52,
    connectedAt: '2024-02-01T09:00:00Z', consentExpiry: '2025-02-01T09:00:00Z',
  },
];

// ─── Initial Feed Transactions ─────────────────────────────────────────────────
const INIT_FEED_TXS: FeedTransaction[] = [
  {
    id: 'FEED-001', feedId: 'FD-001', connectionId: 'conn-001', providerRef: 'ENBD-TXN-001',
    date: '2024-03-25', description: 'Transfer from Global Tours UK', reference: 'AGT-4521',
    debit: 0, credit: 15000, balance: 402325, status: 'Matched', matchedWith: 'BOOK-001',
    source: 'Feed', bank: 'Emirates NBD',
    rawData: {}, enriched: true, category: 'Agent Receipt', merchantName: 'Global Tours UK',
    merchantCategory: 'Travel Agency', pending: false, reversed: false,
  },
  {
    id: 'FEED-002', feedId: 'FD-002', connectionId: 'conn-001', providerRef: 'ENBD-TXN-002',
    date: '2024-03-24', description: 'Payment to Marriott Hotels UAE', reference: 'HTL-2024',
    debit: 8500, credit: 0, balance: 387325, status: 'Matched', matchedWith: 'BOOK-002',
    source: 'Feed', bank: 'Emirates NBD',
    rawData: {}, enriched: true, category: 'Hotel Payment', merchantName: 'Marriott Hotels',
    merchantCategory: 'Hospitality', pending: false, reversed: false,
  },
  {
    id: 'FEED-003', feedId: 'FD-003', connectionId: 'conn-001', providerRef: 'ENBD-TXN-003',
    date: '2024-03-23', description: 'Bank charges and fees Q1', reference: 'CHG-Q1',
    debit: 250, credit: 0, balance: 395825, status: 'Unmatched',
    source: 'Feed', bank: 'Emirates NBD',
    rawData: {}, enriched: true, category: 'Bank Charges', merchantName: 'Emirates NBD',
    merchantCategory: 'Banking', pending: false, reversed: false,
  },
  {
    id: 'FEED-004', feedId: 'FD-004', connectionId: 'conn-001', providerRef: 'ENBD-TXN-004',
    date: '2024-03-22', description: 'Receipt from Asia Pacific Travel Co', reference: 'AGT-APT',
    debit: 0, credit: 22000, balance: 396075, status: 'Unmatched',
    source: 'Feed', bank: 'Emirates NBD',
    rawData: {}, enriched: true, category: 'Agent Receipt', merchantName: 'Asia Pacific Travel',
    merchantCategory: 'Travel Agency', pending: false, reversed: false,
  },
  {
    id: 'FEED-005', feedId: 'FD-005', connectionId: 'conn-001', providerRef: 'ENBD-TXN-005',
    date: '2024-03-21', description: 'Desert Safari LLC - Activity payment', reference: 'ACT-DSL',
    debit: 3200, credit: 0, balance: 374075, status: 'Partial', matchedWith: 'BOOK-003',
    source: 'Feed', bank: 'Emirates NBD',
    rawData: {}, enriched: true, category: 'Activity Payment', merchantName: 'Desert Safari LLC',
    merchantCategory: 'Tourism', pending: false, reversed: false,
  },
  {
    id: 'FEED-006', feedId: 'FD-006', connectionId: 'conn-002', providerRef: 'ADCB-TXN-001',
    date: '2024-03-20', description: 'ADNOC Fuel purchase', reference: 'FUEL-001',
    debit: 1200, credit: 0, balance: 23800, status: 'Unmatched',
    source: 'Feed', bank: 'ADCB',
    rawData: {}, enriched: true, category: 'Fuel', merchantName: 'ADNOC',
    merchantCategory: 'Fuel Station', pending: false, reversed: false,
  },
  {
    id: 'FEED-007', feedId: 'FD-007', connectionId: 'conn-001', providerRef: 'ENBD-TXN-006',
    date: '2024-03-19', description: 'Online payment gateway receipt', reference: 'OPG-2024',
    debit: 0, credit: 5250, balance: 379325, status: 'Unmatched',
    source: 'Feed', bank: 'Emirates NBD',
    rawData: {}, enriched: true, category: 'Customer Receipt', merchantName: 'Payment Gateway',
    merchantCategory: 'Online Payment', pending: true, reversed: false,
  },
  {
    id: 'FEED-008', feedId: 'FD-008', connectionId: 'conn-001', providerRef: 'ENBD-TXN-007',
    date: '2024-03-18', description: 'VAT payment to FTA UAE', reference: 'VAT-Q1-2024',
    debit: 12500, credit: 0, balance: 374075, status: 'Matched', matchedWith: 'BOOK-004',
    source: 'Feed', bank: 'Emirates NBD',
    rawData: {}, enriched: true, category: 'VAT Payment', merchantName: 'FTA UAE',
    merchantCategory: 'Government', pending: false, reversed: false,
  },
];

const INIT_BOOK_TXS: BookTx[] = [
  { id: 'BOOK-001', date: '2024-03-25', description: 'Agent Receipt - Global Tours UK', reference: 'AGT-4521', amount: 15000, type: 'Credit', status: 'Matched', matchedWith: 'FEED-001', source: 'Invoice', category: 'Agent Receipt' },
  { id: 'BOOK-002', date: '2024-03-24', description: 'Supplier Payment - Marriott Hotels', reference: 'PO-HTL-001', amount: 8500, type: 'Debit', status: 'Matched', matchedWith: 'FEED-002', source: 'Payment', category: 'Hotel Payment' },
  { id: 'BOOK-003', date: '2024-03-21', description: 'Activity Expense - Desert Safari', reference: 'EXP-ACT-001', amount: 3500, type: 'Debit', status: 'Partial', matchedWith: 'FEED-005', source: 'Manual', category: 'Activity Payment' },
  { id: 'BOOK-004', date: '2024-03-18', description: 'VAT Return Q1 2024', reference: 'VAT-Q1-2024', amount: 12500, type: 'Debit', status: 'Matched', matchedWith: 'FEED-008', source: 'Manual', category: 'VAT Payment' },
  { id: 'BOOK-005', date: '2024-03-20', description: 'Customer Invoice Payment', reference: 'INV-2024-045', amount: 9800, type: 'Credit', status: 'Unmatched', source: 'Invoice', category: 'Customer Receipt' },
  { id: 'BOOK-006', date: '2024-03-22', description: 'Office Rent March 2024', reference: 'RENT-MAR', amount: 18000, type: 'Debit', status: 'Unmatched', source: 'Manual', category: 'Office Rent' },
];

const INIT_MATCHES: RecMatch[] = [
  { id: 'M-001', bankTxId: 'FEED-001', bookTxId: 'BOOK-001', matchedBy: 'Auto', matchedAt: new Date(Date.now() - 3600000).toISOString(), difference: 0, method: 'Auto', confidence: 'High', score: 98, reasons: ['Exact amount match', 'Same date', 'Reference exact match'] },
  { id: 'M-002', bankTxId: 'FEED-002', bookTxId: 'BOOK-002', matchedBy: 'Auto', matchedAt: new Date(Date.now() - 7200000).toISOString(), difference: 0, method: 'Auto', confidence: 'High', score: 94, reasons: ['Exact amount match', 'Same date', 'Merchant name match'] },
  { id: 'M-003', bankTxId: 'FEED-005', bookTxId: 'BOOK-003', matchedBy: 'Admin', matchedAt: new Date(Date.now() - 86400000).toISOString(), difference: 300, method: 'Manual', confidence: 'Medium', score: 71, reasons: ['Amount within 10%', 'Same date', 'Partial reference match'], note: 'Difference of AED 300 to be adjusted next cycle' },
  { id: 'M-004', bankTxId: 'FEED-008', bookTxId: 'BOOK-004', matchedBy: 'Auto', matchedAt: new Date(Date.now() - 172800000).toISOString(), difference: 0, method: 'Reference', confidence: 'High', score: 100, reasons: ['Exact amount match', 'Same date', 'Reference exact match: VAT-Q1-2024'] },
];

// ─── Provider ──────────────────────────────────────────────────────────────────
export function BankFeedProvider({ children }: { children: ReactNode }) {
  const [connections, setConnections] = useState<BankConnection[]>(INIT_CONNECTIONS);
  const [feedTransactions, setFeedTransactions] = useState<FeedTransaction[]>(INIT_FEED_TXS);
  const [bookTransactions, setBookTransactions] = useState<BookTx[]>(INIT_BOOK_TXS);
  const [matches, setMatches] = useState<RecMatch[]>(INIT_MATCHES);
  const [syncLogs, setSyncLogs] = useState<SyncResult[]>([]);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [schedules, setSchedules] = useState<FeedSchedule[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Auto-sync scheduler (checks every minute)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      connections.forEach(conn => {
        if (conn.status !== 'connected') return;
        if (conn.syncFrequency === 'manual') return;
        const next = new Date(conn.nextSync);
        if (now >= next && !syncingIds.has(conn.id)) {
          syncConnection(conn.id);
        }
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [connections, syncingIds]);

  const addConnection = useCallback((c: BankConnection) => {
    setConnections(prev => [...prev, c]);
  }, []);

  const updateConnection = useCallback((id: string, updates: Partial<BankConnection>) => {
    setConnections(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const removeConnection = useCallback((id: string) => {
    setConnections(prev => prev.filter(c => c.id !== id));
    setFeedTransactions(prev => prev.filter(t => t.connectionId !== id));
  }, []);

  const addFeedTransactions = useCallback((txs: FeedTransaction[]) => {
    setFeedTransactions(prev => {
      const existingIds = new Set(prev.map(t => t.id));
      const newTxs = txs.filter(t => !existingIds.has(t.id));
      return [...prev, ...newTxs];
    });
  }, []);

  const updateFeedTx = useCallback((id: string, updates: Partial<FeedTransaction>) => {
    setFeedTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const updateSchedule = useCallback((connectionId: string, updates: Partial<FeedSchedule>) => {
    setSchedules(prev => {
      const exists = prev.find(s => s.connectionId === connectionId);
      if (exists) return prev.map(s => s.connectionId === connectionId ? { ...s, ...updates } : s);
      return [...prev, { connectionId, frequency: 'daily', lastRun: '', nextRun: '', enabled: true, retryCount: 0, maxRetries: 3, ...updates }];
    });
  }, []);

  const addWebhookEvent = useCallback((e: WebhookEvent) => {
    setWebhookEvents(prev => [e, ...prev].slice(0, 100));
  }, []);

  const syncConnection = useCallback(async (connectionId: string) => {
    const conn = connections.find(c => c.id === connectionId);
    if (!conn || syncingIds.has(connectionId)) return;

    setSyncingIds(prev => new Set([...prev, connectionId]));
    updateConnection(connectionId, { status: 'syncing' });

    try {
      const result = await simulateSync(conn, feedTransactions);

      // Add new transactions
      if (result.newTransactions > 0) {
        addFeedTransactions(result.transactions);

        // Auto-match if enabled
        if (conn.autoMatch && result.transactions.length > 0) {
          const bankTxsForMatch: BankTx[] = result.transactions.map(t => ({
            id: t.id, date: t.date, description: t.description,
            reference: t.reference, debit: t.debit, credit: t.credit,
            balance: t.balance, status: t.status, source: t.source, bank: t.bank,
          }));
          const autoResult = runAutoMatch(
            [...bankTxsForMatch], bookTransactions, matches
          );
          const { updatedBankTxs, matches: newMatches } = autoResult;
          result.autoMatched = newMatches.length - matches.length;

          // Update statuses
          setFeedTransactions(prev => {
            const updated = new Map(updatedBankTxs.map((b: BankTx) => [b.id, b]));
            return prev.map(t => {
              const u = updated.get(t.id);
              return u ? { ...t, status: u.status, matchedWith: u.matchedWith } : t;
            });
          });
          setMatches(newMatches);
        }

        // Add webhook event
        addWebhookEvent({
          id: `WH-${Date.now()}`,
          type: 'transaction.created',
          connectionId,
          payload: { count: result.newTransactions, autoMatched: result.autoMatched },
          receivedAt: new Date().toISOString(),
          processed: true,
        });
      }

      setSyncLogs(prev => [result, ...prev].slice(0, 50));
      setLastSyncTime(new Date().toISOString());

      updateConnection(connectionId, {
        status: 'connected',
        lastSync: new Date().toISOString(),
        nextSync: calcNextSync(conn.syncFrequency),
        totalImported: conn.totalImported + result.newTransactions,
        totalMatched: conn.totalMatched + result.autoMatched,
      });
    } catch (err) {
      updateConnection(connectionId, { status: 'error', errorMessage: String(err) });
    } finally {
      setSyncingIds(prev => { const s = new Set(prev); s.delete(connectionId); return s; });
    }
  }, [connections, feedTransactions, bookTransactions, matches, syncingIds, addFeedTransactions, updateConnection, addWebhookEvent]);

  const syncAll = useCallback(async () => {
    const connected = connections.filter(c => c.status === 'connected' || c.status === 'error');
    for (const conn of connected) {
      await syncConnection(conn.id);
    }
  }, [connections, syncConnection]);

  const totalUnmatched = feedTransactions.filter(t => t.status === 'Unmatched').length;
  const totalMatched = feedTransactions.filter(t => t.status === 'Matched').length;
  const totalPending = feedTransactions.filter(t => t.pending).length;

  return (
    <BankFeedContext.Provider value={{
      connections, addConnection, updateConnection, removeConnection,
      feedTransactions, addFeedTransactions, updateFeedTx,
      bookTransactions, setBookTransactions,
      matches, setMatches,
      syncLogs, syncingIds, syncConnection, syncAll,
      schedules, updateSchedule,
      webhookEvents, addWebhookEvent,
      totalUnmatched, totalMatched, totalPending, lastSyncTime,
    }}>
      {children}
    </BankFeedContext.Provider>
  );
}

export function useBankFeed() {
  const ctx = useContext(BankFeedContext);
  if (!ctx) throw new Error('useBankFeed must be used within BankFeedProvider');
  return ctx;
}
