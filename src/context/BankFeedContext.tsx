import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { catchAndReport } from '../lib/toast';
import {
  type BankConnection, type FeedTransaction, type SyncResult, type FeedSchedule,
  type WebhookEvent, simulateSync, calcNextSync,
} from '../utils/bankFeedService';
import { runAutoMatch, type BankTx, type BookTx, type RecMatch } from '../utils/reconciliationEngine';
import {
  fetchBankConnections as fetchBankConnectionsDb,
  upsertBankConnection as upsertBankConnectionDb,
  deleteBankConnection as deleteBankConnectionDb,
  fetchFeedTransactions as fetchFeedTransactionsDb,
  upsertFeedTransactions as upsertFeedTransactionsDb,
  upsertFeedTransaction as upsertFeedTransactionDb,
  fetchBookTransactions as fetchBookTransactionsDb,
  upsertBookTransactions as upsertBookTransactionsDb,
  fetchRecMatches as fetchRecMatchesDb,
  upsertRecMatches as upsertRecMatchesDb,
  insertSyncLog as insertSyncLogDb,
  fetchFeedSchedules as fetchFeedSchedulesDb,
  upsertFeedSchedule as upsertFeedScheduleDb,
  fetchWebhookEvents as fetchWebhookEventsDb,
  insertWebhookEvent as insertWebhookEventDb,
} from '../lib/supabaseSync';

// ─── Context Types ─────────────────────────────────────────────────────────────
interface BankFeedContextType {
  connections: BankConnection[];
  addConnection: (c: BankConnection) => void;
  updateConnection: (id: string, updates: Partial<BankConnection>) => void;
  removeConnection: (id: string) => void;
  feedTransactions: FeedTransaction[];
  addFeedTransactions: (txs: FeedTransaction[]) => void;
  updateFeedTx: (id: string, updates: Partial<FeedTransaction>) => void;
  bookTransactions: BookTx[];
  setBookTransactions: (txs: BookTx[]) => void;
  matches: RecMatch[];
  setMatches: (m: RecMatch[]) => void;
  syncLogs: SyncResult[];
  syncingIds: Set<string>;
  syncConnection: (connectionId: string) => Promise<void>;
  syncAll: () => Promise<void>;
  schedules: FeedSchedule[];
  updateSchedule: (connectionId: string, updates: Partial<FeedSchedule>) => void;
  webhookEvents: WebhookEvent[];
  addWebhookEvent: (e: WebhookEvent) => void;
  totalUnmatched: number;
  totalMatched: number;
  totalPending: number;
  lastSyncTime: string | null;
  loading: boolean;
  error: string | null;
}

const BankFeedContext = createContext<BankFeedContextType | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────
export function BankFeedProvider({ children }: { children: ReactNode }) {
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [feedTransactions, setFeedTransactions] = useState<FeedTransaction[]>([]);
  const [bookTransactions, setBookTransactions] = useState<BookTx[]>([]);
  const [matches, setMatchesState] = useState<RecMatch[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncResult[]>([]);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [schedules, setSchedules] = useState<FeedSchedule[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Load from Supabase on mount ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [conns, feedTxs, bookTxs, recs, scheds, whEvents] = await Promise.all([
          fetchBankConnectionsDb(),
          fetchFeedTransactionsDb(),
          fetchBookTransactionsDb(),
          fetchRecMatchesDb(),
          fetchFeedSchedulesDb(),
          fetchWebhookEventsDb(),
        ]);
        if (cancelled) return;
        if (conns !== null) setConnections(conns);
        if (feedTxs !== null) setFeedTransactions(feedTxs);
        if (bookTxs !== null) setBookTransactions(bookTxs);
        if (recs !== null) setMatchesState(recs);
        if (scheds !== null) setSchedules(scheds);
        if (whEvents !== null) setWebhookEvents(whEvents);
        setError(null);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load bank feed data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
    upsertBankConnectionDb(c).catch(catchAndReport('Add bank connection'));
  }, []);

  const updateConnection = useCallback((id: string, updates: Partial<BankConnection>) => {
    setConnections(prev => {
      const next = prev.map(c => c.id === id ? { ...c, ...updates } : c);
      const changed = next.find(c => c.id === id);
      if (changed) upsertBankConnectionDb(changed).catch(catchAndReport('Update bank connection'));
      return next;
    });
  }, []);

  const removeConnection = useCallback((id: string) => {
    setConnections(prev => prev.filter(c => c.id !== id));
    setFeedTransactions(prev => prev.filter(t => t.connectionId !== id));
    deleteBankConnectionDb(id).catch(catchAndReport('Delete bank connection'));
  }, []);

  const addFeedTransactions = useCallback((txs: FeedTransaction[]) => {
    setFeedTransactions(prev => {
      const existingIds = new Set(prev.map(t => t.id));
      const newTxs = txs.filter(t => !existingIds.has(t.id));
      if (newTxs.length > 0) upsertFeedTransactionsDb(newTxs).catch(catchAndReport('Save feed transactions'));
      return [...prev, ...newTxs];
    });
  }, []);

  const updateFeedTx = useCallback((id: string, updates: Partial<FeedTransaction>) => {
    setFeedTransactions(prev => {
      const next = prev.map(t => t.id === id ? { ...t, ...updates } : t);
      const changed = next.find(t => t.id === id);
      if (changed) upsertFeedTransactionDb(changed).catch(catchAndReport('Update feed transaction'));
      return next;
    });
  }, []);

  const setBookTransactionsWrapper = useCallback((txs: BookTx[]) => {
    setBookTransactions(txs);
    upsertBookTransactionsDb(txs).catch(catchAndReport('Save book transactions'));
  }, []);

  const setMatches = useCallback((m: RecMatch[]) => {
    setMatchesState(m);
    upsertRecMatchesDb(m).catch(catchAndReport('Save reconciliation matches'));
  }, []);

  const updateSchedule = useCallback((connectionId: string, updates: Partial<FeedSchedule>) => {
    setSchedules(prev => {
      const exists = prev.find(s => s.connectionId === connectionId);
      let updated: FeedSchedule;
      if (exists) {
        updated = { ...exists, ...updates };
        const next = prev.map(s => s.connectionId === connectionId ? updated : s);
        upsertFeedScheduleDb(updated).catch(catchAndReport('Update feed schedule'));
        return next;
      }
      updated = { connectionId, frequency: 'daily', lastRun: '', nextRun: '', enabled: true, retryCount: 0, maxRetries: 3, ...updates };
      upsertFeedScheduleDb(updated).catch(catchAndReport('Add feed schedule'));
      return [...prev, updated];
    });
  }, []);

  const addWebhookEvent = useCallback((e: WebhookEvent) => {
    setWebhookEvents(prev => [e, ...prev].slice(0, 100));
    insertWebhookEventDb(e).catch(catchAndReport('Save webhook event'));
  }, []);

  const syncConnection = useCallback(async (connectionId: string) => {
    const conn = connections.find(c => c.id === connectionId);
    if (!conn || syncingIds.has(connectionId)) return;

    setSyncingIds(prev => new Set([...prev, connectionId]));
    updateConnection(connectionId, { status: 'syncing' });

    try {
      const result = await simulateSync(conn, feedTransactions);

      if (result.newTransactions > 0) {
        addFeedTransactions(result.transactions);

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

          setFeedTransactions(prev => {
            const updated = new Map(updatedBankTxs.map((b: BankTx) => [b.id, b]));
            return prev.map(t => {
              const u = updated.get(t.id);
              return u ? { ...t, status: u.status, matchedWith: u.matchedWith } : t;
            });
          });
          setMatches(newMatches);
        }

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
      insertSyncLogDb(result).catch(catchAndReport('Save sync log'));
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
      bookTransactions, setBookTransactions: setBookTransactionsWrapper,
      matches, setMatches,
      syncLogs, syncingIds, syncConnection, syncAll,
      schedules, updateSchedule,
      webhookEvents, addWebhookEvent,
      totalUnmatched, totalMatched, totalPending, lastSyncTime,
      loading, error,
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
