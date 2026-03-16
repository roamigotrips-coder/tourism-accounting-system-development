import { useState, useMemo } from 'react';
import { FileSearch, Download, Search, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Eye } from 'lucide-react';
import { useAccountingEngine, AccountType, LedgerEntry } from '../context/AccountingEngine';

const TYPE_COLORS: Record<AccountType, string> = {
  Asset:     'bg-blue-100 text-blue-700 border-blue-200',
  Liability: 'bg-purple-100 text-purple-700 border-purple-200',
  Equity:    'bg-yellow-100 text-yellow-700 border-yellow-200',
  Revenue:   'bg-green-100 text-green-700 border-green-200',
  Expense:   'bg-red-100 text-red-700 border-red-200',
};

const TYPE_BG: Record<AccountType, string> = {
  Asset:     'bg-blue-50 border-blue-200',
  Liability: 'bg-purple-50 border-purple-200',
  Equity:    'bg-yellow-50 border-yellow-200',
  Revenue:   'bg-green-50 border-green-200',
  Expense:   'bg-red-50 border-red-200',
};

function fmt(n: number) {
  return Math.abs(n).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function AccountLedgerPanel({ accountId, onClose }: { accountId: string; onClose: () => void }) {
  const { getAccountLedger, accounts } = useAccountingEngine();
  const account = accounts.find(a => a.id === accountId);
  const entries = getAccountLedger(accountId);

  if (!account) return null;

  const totalDebits = entries.filter(e => e.journalEntryId !== 'OPENING').reduce((s, e) => s + e.debit, 0);
  const totalCredits = entries.filter(e => e.journalEntryId !== 'OPENING').reduce((s, e) => s + e.credit, 0);
  const closingBalance = entries.length > 0 ? entries[entries.length - 1].runningBalance : 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-4">
        <div className={`p-6 rounded-t-2xl border-b ${TYPE_BG[account.type]}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-semibold mb-2 ${TYPE_COLORS[account.type]}`}>
                {account.type}
              </div>
              <h2 className="text-xl font-bold text-gray-900">{account.code} — {account.name}</h2>
              <p className="text-sm text-gray-500 mt-0.5">Normal Balance: {account.normalBalance}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/60 rounded-lg text-gray-500">✕</button>
          </div>
          <div className="grid grid-cols-4 gap-4 mt-4">
            {[
              { label: 'Opening Balance', value: account.openingBalance, type: account.openingBalanceType },
              { label: 'Total Debits', value: totalDebits, type: 'Debit' },
              { label: 'Total Credits', value: totalCredits, type: 'Credit' },
              { label: 'Closing Balance', value: Math.abs(closingBalance), type: closingBalance >= 0 ? 'Debit' : 'Credit' },
            ].map(({ label, value, type }) => (
              <div key={label} className="bg-white/70 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-500">{label}</div>
                <div className="font-bold text-gray-900 mt-1">AED {fmt(value)}</div>
                <div className={`text-xs mt-0.5 font-semibold ${type === 'Debit' ? 'text-blue-600' : 'text-green-600'}`}>{type}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Entry #</th>
                <th className="px-4 py-3 text-left font-semibold">Description</th>
                <th className="px-4 py-3 text-left font-semibold">Reference</th>
                <th className="px-4 py-3 text-right font-semibold text-blue-700">Debit</th>
                <th className="px-4 py-3 text-right font-semibold text-green-700">Credit</th>
                <th className="px-4 py-3 text-right font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map(e => (
                <tr key={e.id} className={`hover:bg-gray-50 ${e.journalEntryId === 'OPENING' ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-600">{e.date}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-blue-700">{e.entryNumber}</td>
                  <td className="px-4 py-2.5 text-gray-800 max-w-[200px] truncate">{e.description}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{e.reference || '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{e.debit > 0 ? <span className="text-blue-700 font-semibold">{fmt(e.debit)}</span> : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{e.credit > 0 ? <span className="text-green-700 font-semibold">{fmt(e.credit)}</span> : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold">
                    <span className={e.runningBalance >= 0 ? 'text-gray-900' : 'text-red-600'}>
                      {e.runningBalance < 0 ? '(' : ''}{fmt(e.runningBalance)}{e.runningBalance < 0 ? ')' : ''}
                    </span>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No transactions for this account.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function GeneralLedger() {
  const { accounts, ledger, entries } = useAccountingEngine();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [viewingAccount, setViewingAccount] = useState<string | null>(null);

  const postedCount = entries.filter(e => e.status === 'Posted').length;
  const totalDebits = entries.filter(e => e.status === 'Posted').reduce((s, e) => s + e.totalDebit, 0);

  const accountsWithData = useMemo(() => {
    return accounts
      .filter(acc => {
        const hasData = (ledger.get(acc.id) || []).length > 0;
        const matchQ = !search || acc.name.toLowerCase().includes(search.toLowerCase()) || acc.code.includes(search);
        const matchT = typeFilter === 'All' || acc.type === typeFilter;
        return hasData && matchQ && matchT;
      })
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [accounts, ledger, search, typeFilter]);

  const groupedByType = useMemo(() => {
    const groups: Record<string, typeof accountsWithData> = {};
    accountsWithData.forEach(acc => {
      if (!groups[acc.type]) groups[acc.type] = [];
      groups[acc.type].push(acc);
    });
    return groups;
  }, [accountsWithData]);

  function toggleExpand(id: string) {
    setExpandedAccounts(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function getLedgerEntries(accountId: string): LedgerEntry[] {
    return (ledger.get(accountId) || []);
  }

  function getBalance(accountId: string): number {
    const entries = getLedgerEntries(accountId);
    return entries.length > 0 ? entries[entries.length - 1].runningBalance : 0;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FileSearch size={32} className="text-blue-600" /> General Ledger
          </h1>
          <p className="text-gray-500 mt-1">Auto-updated from posted journal entries · {postedCount} posted entries · AED {(totalDebits/1000).toFixed(0)}K total movement</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 border">
          <Download size={16} /> Export Ledger
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        {['Asset','Liability','Equity','Revenue','Expense'].map(type => {
          const accs = (groupedByType[type] || []);
          const totalBal = accs.reduce((s, a) => s + Math.abs(getBalance(a.id)), 0);
          return (
            <div key={type} className={`border rounded-xl p-4 cursor-pointer transition-all ${TYPE_BG[type as AccountType]} ${typeFilter === type ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
              onClick={() => setTypeFilter(typeFilter === type ? 'All' : type)}>
              <div className="text-sm text-gray-600">{type}s</div>
              <div className="text-xl font-bold text-gray-900 mt-1">AED {(totalBal/1000).toFixed(0)}K</div>
              <div className="text-xs text-gray-500 mt-0.5">{accs.length} accounts</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-xl p-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search accounts by name or code..."
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-2">
          {['All','Asset','Liability','Equity','Revenue','Expense'].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${typeFilter === t ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Ledger by Type */}
      <div className="space-y-4">
        {Object.entries(groupedByType).map(([type, accs]) => (
          <div key={type} className={`border-2 rounded-xl overflow-hidden ${TYPE_BG[type as AccountType]}`}>
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`text-sm px-3 py-1 rounded-full border font-semibold ${TYPE_COLORS[type as AccountType]}`}>{type}</span>
                <span className="font-semibold text-gray-800">{accs.length} accounts</span>
              </div>
              <div className="text-sm font-semibold text-gray-700">
                Total: AED {fmt(accs.reduce((s, a) => s + Math.abs(getBalance(a.id)), 0))}
              </div>
            </div>

            {accs.map(acc => {
              const accEntries = getLedgerEntries(acc.id);
              const balance = getBalance(acc.id);
              const isExpanded = expandedAccounts.has(acc.id);
              const nonOpening = accEntries.filter(e => e.journalEntryId !== 'OPENING');
              const totDr = nonOpening.reduce((s, e) => s + e.debit, 0);
              const totCr = nonOpening.reduce((s, e) => s + e.credit, 0);

              return (
                <div key={acc.id} className="border-b last:border-0 bg-white/80">
                  {/* Account Header Row */}
                  <div className="flex items-center justify-between px-6 py-3 hover:bg-white/60 cursor-pointer"
                    onClick={() => toggleExpand(acc.id)}>
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                      <span className="font-mono text-sm font-semibold text-gray-600">{acc.code}</span>
                      <span className="font-semibold text-gray-900">{acc.name}</span>
                      <span className="text-xs text-gray-400">({accEntries.length} txns)</span>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <div className="text-xs text-gray-400">Debits</div>
                        <div className="font-semibold text-blue-700">{fmt(totDr)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-400">Credits</div>
                        <div className="font-semibold text-green-700">{fmt(totCr)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-400">Balance</div>
                        <div className={`font-bold text-lg flex items-center gap-1 ${balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                          {balance > 0 ? <TrendingUp size={14} className="text-green-500" /> : <TrendingDown size={14} className="text-red-500" />}
                          {balance < 0 ? '(' : ''}{fmt(balance)}{balance < 0 ? ')' : ''}
                        </div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); setViewingAccount(acc.id); }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200">
                        <Eye size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Lines */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-2 text-left font-semibold text-gray-500">Date</th>
                            <th className="px-6 py-2 text-left font-semibold text-gray-500">Entry #</th>
                            <th className="px-6 py-2 text-left font-semibold text-gray-500">Description</th>
                            <th className="px-6 py-2 text-left font-semibold text-gray-500">Ref</th>
                            <th className="px-6 py-2 text-right font-semibold text-blue-600">Debit</th>
                            <th className="px-6 py-2 text-right font-semibold text-green-600">Credit</th>
                            <th className="px-6 py-2 text-right font-semibold text-gray-500">Running Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {accEntries.map(e => (
                            <tr key={e.id} className={`hover:bg-blue-50/50 ${e.journalEntryId === 'OPENING' ? 'bg-blue-50/80 font-semibold' : ''}`}>
                              <td className="px-6 py-2 text-gray-600">{e.date}</td>
                              <td className="px-6 py-2 font-mono text-blue-700">{e.entryNumber}</td>
                              <td className="px-6 py-2 text-gray-800 max-w-[200px] truncate">{e.description}</td>
                              <td className="px-6 py-2 text-gray-500 font-mono">{e.reference || '—'}</td>
                              <td className="px-6 py-2 text-right font-mono">{e.debit > 0 ? <span className="text-blue-700">{fmt(e.debit)}</span> : '—'}</td>
                              <td className="px-6 py-2 text-right font-mono">{e.credit > 0 ? <span className="text-green-700">{fmt(e.credit)}</span> : '—'}</td>
                              <td className="px-6 py-2 text-right font-mono font-semibold">
                                <span className={e.runningBalance < 0 ? 'text-red-600' : 'text-gray-900'}>
                                  {e.runningBalance < 0 ? '(' : ''}{fmt(e.runningBalance)}{e.runningBalance < 0 ? ')' : ''}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {accountsWithData.length === 0 && (
          <div className="bg-white border rounded-xl p-16 text-center text-gray-400">
            <FileSearch size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg">No accounts with transactions found.</p>
            <p className="text-sm mt-1">Post journal entries to see them reflected here.</p>
          </div>
        )}
      </div>

      {viewingAccount && <AccountLedgerPanel accountId={viewingAccount} onClose={() => setViewingAccount(null)} />}
    </div>
  );
}
