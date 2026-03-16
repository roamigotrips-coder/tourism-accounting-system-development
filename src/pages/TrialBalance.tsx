import { useState, useMemo } from 'react';
import { Scale, Download, Printer, CheckCircle, AlertCircle, Info, TrendingUp, TrendingDown } from 'lucide-react';
import { useAccountingEngine, AccountType, TrialBalanceLine } from '../context/AccountingEngine';

const TYPE_COLORS: Record<AccountType, string> = {
  Asset:     'bg-blue-50 border-blue-200 text-blue-700',
  Liability: 'bg-purple-50 border-purple-200 text-purple-700',
  Equity:    'bg-yellow-50 border-yellow-200 text-yellow-700',
  Revenue:   'bg-green-50 border-green-200 text-green-700',
  Expense:   'bg-red-50 border-red-200 text-red-700',
};

function fmt(n: number) {
  return Math.abs(n).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TYPE_ORDER: AccountType[] = ['Asset','Liability','Equity','Revenue','Expense'];

export default function TrialBalance() {
  const { trialBalance, periods, entries } = useAccountingEngine();
  const [selectedPeriod, setSelectedPeriod] = useState('All');
  const [showZeroBalance, setShowZeroBalance] = useState(false);
  const [groupByType, setGroupByType] = useState(true);

  const openPeriods = periods;
  const postedEntries = entries.filter(e => e.status === 'Posted');

  const displayAccounts: TrialBalanceLine[] = useMemo(() => {
    return trialBalance.filter(acc => showZeroBalance || acc.closingBalance !== 0 || acc.totalDebit !== 0 || acc.totalCredit !== 0);
  }, [trialBalance, showZeroBalance]);

  const grouped = useMemo(() => {
    const g: Partial<Record<AccountType, TrialBalanceLine[]>> = {};
    displayAccounts.forEach(acc => {
      if (!g[acc.accountType]) g[acc.accountType] = [];
      g[acc.accountType]!.push(acc);
    });
    return g;
  }, [displayAccounts]);

  const totals = useMemo(() => {
    const totalDebitCol = displayAccounts.reduce((s, a) => s + (a.normalBalance === 'Debit' ? a.closingBalance : 0), 0);
    const totalCreditCol = displayAccounts.reduce((s, a) => s + (a.normalBalance === 'Credit' ? a.closingBalance : 0), 0);
    const totalDebitMov = displayAccounts.reduce((s, a) => s + a.totalDebit, 0);
    const totalCreditMov = displayAccounts.reduce((s, a) => s + a.totalCredit, 0);
    const totalAssets = displayAccounts.filter(a => a.accountType === 'Asset').reduce((s, a) => s + a.closingBalance, 0);
    const totalLiabilities = displayAccounts.filter(a => a.accountType === 'Liability').reduce((s, a) => s + a.closingBalance, 0);
    const totalEquity = displayAccounts.filter(a => a.accountType === 'Equity').reduce((s, a) => s + a.closingBalance, 0);
    const totalRevenue = displayAccounts.filter(a => a.accountType === 'Revenue').reduce((s, a) => s + a.closingBalance, 0);
    const totalExpenses = displayAccounts.filter(a => a.accountType === 'Expense').reduce((s, a) => s + a.closingBalance, 0);
    const netProfit = totalRevenue - totalExpenses;
    const isBalanced = Math.round(totalDebitCol * 100) === Math.round(totalCreditCol * 100);
    return { totalDebitCol, totalCreditCol, totalDebitMov, totalCreditMov, totalAssets, totalLiabilities, totalEquity, totalRevenue, totalExpenses, netProfit, isBalanced };
  }, [displayAccounts]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Scale size={32} className="text-blue-600" /> Trial Balance
          </h1>
          <p className="text-gray-500 mt-1">Auto-computed from {postedEntries.length} posted journal entries · Live balance sheet check</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 border rounded-lg hover:bg-gray-200 text-sm">
            <Download size={16} /> Export CSV
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 border rounded-lg hover:bg-gray-200 text-sm">
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      {/* Balance Status */}
      <div className={`flex items-center gap-4 p-5 rounded-2xl border-2 ${totals.isBalanced ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
        <div className={`w-14 h-14 rounded-full flex items-center justify-center ${totals.isBalanced ? 'bg-green-100' : 'bg-red-100'}`}>
          {totals.isBalanced
            ? <CheckCircle size={32} className="text-green-600" />
            : <AlertCircle size={32} className="text-red-600" />
          }
        </div>
        <div className="flex-1">
          <h2 className={`text-xl font-bold ${totals.isBalanced ? 'text-green-800' : 'text-red-800'}`}>
            {totals.isBalanced ? '✓ Trial Balance is Balanced' : '✗ Trial Balance is UNBALANCED'}
          </h2>
          <p className={`text-sm mt-0.5 ${totals.isBalanced ? 'text-green-600' : 'text-red-600'}`}>
            {totals.isBalanced
              ? 'All debit and credit totals match. Your books are in balance.'
              : `Difference: AED ${fmt(Math.abs(totals.totalDebitCol - totals.totalCreditCol))} — Check for missing or incorrect journal entries.`
            }
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className={`px-6 py-3 rounded-xl ${totals.isBalanced ? 'bg-green-100' : 'bg-red-100'}`}>
            <div className="text-xs text-gray-500">Total Debit</div>
            <div className="font-bold text-blue-700 text-lg">{fmt(totals.totalDebitCol)}</div>
          </div>
          <div className={`px-6 py-3 rounded-xl ${totals.isBalanced ? 'bg-green-100' : 'bg-red-100'}`}>
            <div className="text-xs text-gray-500">Total Credit</div>
            <div className="font-bold text-green-700 text-lg">{fmt(totals.totalCreditCol)}</div>
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Assets', value: totals.totalAssets, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: TrendingUp },
          { label: 'Total Liabilities', value: totals.totalLiabilities, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: TrendingDown },
          { label: 'Total Equity', value: totals.totalEquity, color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', icon: TrendingUp },
          { label: 'Total Revenue', value: totals.totalRevenue, color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: TrendingUp },
          { label: 'Net Profit / Loss', value: totals.netProfit, color: totals.netProfit >= 0 ? 'text-green-700' : 'text-red-700', bg: totals.netProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200', icon: totals.netProfit >= 0 ? TrendingUp : TrendingDown },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className={`border rounded-xl p-4 ${bg}`}>
            <div className="flex items-center gap-2">
              <Icon size={16} className={color} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
            <div className={`font-bold text-xl mt-2 ${color}`}>
              AED {fmt(value)}
            </div>
          </div>
        ))}
      </div>

      {/* Accounting Equation Check */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Info size={16} className="text-slate-600" />
          <span className="font-semibold text-slate-700">Accounting Equation: Assets = Liabilities + Equity</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-blue-700">AED {fmt(totals.totalAssets)}</span>
            <span className="text-gray-500">(Assets)</span>
          </div>
          <span className="text-gray-400">=</span>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-purple-700">AED {fmt(totals.totalLiabilities)}</span>
            <span className="text-gray-500">(Liabilities)</span>
          </div>
          <span className="text-gray-400">+</span>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-yellow-700">AED {fmt(totals.totalEquity)}</span>
            <span className="text-gray-500">(Equity)</span>
          </div>
          <div className={`ml-auto flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold ${Math.round(totals.totalAssets * 100) === Math.round((totals.totalLiabilities + totals.totalEquity) * 100) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {Math.round(totals.totalAssets * 100) === Math.round((totals.totalLiabilities + totals.totalEquity) * 100) ? '✓ Equation Balances' : '✗ Equation Unbalanced'}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white border rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm">
            <option value="All">All Periods</option>
            {openPeriods.map(p => <option key={p.id} value={p.period}>{p.name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showZeroBalance} onChange={e => setShowZeroBalance(e.target.checked)} className="rounded" />
            Show zero-balance accounts
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={groupByType} onChange={e => setGroupByType(e.target.checked)} className="rounded" />
            Group by account type
          </label>
        </div>
        <div className="text-sm text-gray-500">{displayAccounts.length} accounts</div>
      </div>

      {/* Trial Balance Table */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        {/* Print Header */}
        <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900">AccountsPro — Trial Balance</h3>
            <p className="text-sm text-gray-500">As at {new Date().toLocaleDateString('en-AE', { year: 'numeric', month: 'long', day: 'numeric' })} · Basis: Accrual</p>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${totals.isBalanced ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {totals.isBalanced ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            <span className="font-semibold">{totals.isBalanced ? 'Balanced' : 'Unbalanced'}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-white">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Code</th>
                <th className="px-4 py-3 text-left font-semibold">Account Name</th>
                <th className="px-4 py-3 text-left font-semibold">Type</th>
                <th className="px-4 py-3 text-right font-semibold">Opening Balance</th>
                <th className="px-4 py-3 text-right font-semibold text-blue-300">Period Debits</th>
                <th className="px-4 py-3 text-right font-semibold text-green-300">Period Credits</th>
                <th className="px-4 py-3 text-right font-semibold">Closing Balance</th>
                <th className="px-4 py-3 text-center font-semibold">Dr/Cr</th>
              </tr>
            </thead>
            <tbody>
              {groupByType ? (
                TYPE_ORDER.map(type => {
                  const typeAccs = grouped[type];
                  if (!typeAccs || typeAccs.length === 0) return null;
                  const typeTotalDebit = typeAccs.reduce((s, a) => s + a.totalDebit, 0);
                  const typeTotalCredit = typeAccs.reduce((s, a) => s + a.totalCredit, 0);
                  const typeTotalBalance = typeAccs.reduce((s, a) => s + a.closingBalance, 0);
                  return (
                    <>
                      {/* Section Header */}
                      <tr key={`header-${type}`} className={`${TYPE_COLORS[type]} border-y`}>
                        <td colSpan={8} className="px-4 py-2 font-bold text-sm tracking-wide uppercase">
                          {type}s
                        </td>
                      </tr>
                      {typeAccs.map((acc, i) => (
                        <tr key={acc.accountId} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/30 border-b border-gray-100`}>
                          <td className="px-4 py-2.5 font-mono text-sm font-semibold text-gray-600">{acc.accountCode}</td>
                          <td className="px-4 py-2.5 text-gray-900">{acc.accountName}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TYPE_COLORS[acc.accountType]}`}>{acc.accountType}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-600">{fmt(acc.openingBalance)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-blue-700">{acc.totalDebit > 0 ? fmt(acc.totalDebit) : '—'}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-green-700">{acc.totalCredit > 0 ? fmt(acc.totalCredit) : '—'}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold">
                            <span className={acc.closingBalance < 0 ? 'text-red-600' : 'text-gray-900'}>
                              {acc.closingBalance < 0 ? '(' : ''}{fmt(acc.closingBalance)}{acc.closingBalance < 0 ? ')' : ''}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${acc.normalBalance === 'Debit' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                              {acc.normalBalance === 'Debit' ? 'Dr' : 'Cr'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {/* Section Subtotal */}
                      <tr key={`total-${type}`} className={`${TYPE_COLORS[type]} border-y-2`}>
                        <td colSpan={3} className="px-4 py-2.5 font-bold text-right">Subtotal — {type}s</td>
                        <td className="px-4 py-2.5 text-right font-bold font-mono">{fmt(typeAccs.reduce((s, a) => s + a.openingBalance, 0))}</td>
                        <td className="px-4 py-2.5 text-right font-bold font-mono text-blue-700">{fmt(typeTotalDebit)}</td>
                        <td className="px-4 py-2.5 text-right font-bold font-mono text-green-700">{fmt(typeTotalCredit)}</td>
                        <td className="px-4 py-2.5 text-right font-bold font-mono">{fmt(typeTotalBalance)}</td>
                        <td></td>
                      </tr>
                    </>
                  );
                })
              ) : (
                displayAccounts.map((acc, i) => (
                  <tr key={acc.accountId} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/30 border-b border-gray-100`}>
                    <td className="px-4 py-2.5 font-mono text-sm font-semibold text-gray-600">{acc.accountCode}</td>
                    <td className="px-4 py-2.5 text-gray-900">{acc.accountName}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TYPE_COLORS[acc.accountType]}`}>{acc.accountType}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-600">{fmt(acc.openingBalance)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-blue-700">{acc.totalDebit > 0 ? fmt(acc.totalDebit) : '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-green-700">{acc.totalCredit > 0 ? fmt(acc.totalCredit) : '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold">{fmt(acc.closingBalance)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${acc.normalBalance === 'Debit' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                        {acc.normalBalance === 'Debit' ? 'Dr' : 'Cr'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Grand Total */}
            <tfoot>
              <tr className="bg-gray-900 text-white">
                <td colSpan={3} className="px-4 py-4 font-bold text-lg text-right">GRAND TOTAL</td>
                <td className="px-4 py-4 text-right font-bold font-mono">{fmt(displayAccounts.reduce((s, a) => s + a.openingBalance, 0))}</td>
                <td className="px-4 py-4 text-right font-bold font-mono text-blue-300">{fmt(totals.totalDebitMov)}</td>
                <td className="px-4 py-4 text-right font-bold font-mono text-green-300">{fmt(totals.totalCreditMov)}</td>
                <td colSpan={2} className={`px-4 py-4 text-center font-bold text-lg ${totals.isBalanced ? 'text-green-400' : 'text-red-400'}`}>
                  {totals.isBalanced ? '✓ BALANCED' : '✗ DIFFERENCE: AED ' + fmt(Math.abs(totals.totalDebitCol - totals.totalCreditCol))}
                </td>
              </tr>
              {/* Net Profit */}
              <tr className={`${totals.netProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border-t-2`}>
                <td colSpan={5} className="px-4 py-3 font-bold text-gray-800">
                  Net Profit / (Loss) = Revenue − Expenses = AED {fmt(totals.totalRevenue)} − AED {fmt(totals.totalExpenses - totals.totalRevenue < 0 ? totals.totalExpenses : totals.totalExpenses)}
                </td>
                <td colSpan={3} className={`px-4 py-3 text-right font-bold text-xl ${totals.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {totals.netProfit < 0 ? '(' : ''}AED {fmt(totals.netProfit)}{totals.netProfit < 0 ? ')' : ''}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Period Management Info */}
      <div className="bg-white border rounded-xl p-5">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Scale size={16} /> Accounting Periods</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {openPeriods.map(p => (
            <div key={p.id} className={`rounded-xl p-3 border ${p.status === 'Open' ? 'bg-green-50 border-green-200' : p.status === 'Closed' ? 'bg-gray-50 border-gray-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-800 text-sm">{p.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${p.status === 'Open' ? 'bg-green-100 text-green-700' : p.status === 'Closed' ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-700'}`}>
                  {p.status}
                </span>
              </div>
              {p.closedBy && <p className="text-xs text-gray-400 mt-1">Closed by {p.closedBy}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
