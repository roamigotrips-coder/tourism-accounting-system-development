import { useState, useEffect } from 'react';
import { FileText, Download, Database } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, Pie, Cell, PieChart as RechartsPieChart,
} from 'recharts';
import { fetchAgents, fetchSuppliers } from '../lib/supabaseSync';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';
import type { Agent, Supplier } from '../data/mockData';
import { useAccountingEngine } from '../context/AccountingEngine';

// ── Tourism-specific data (not in GL) ────────────────────────────────────────
const destinationData: { name: string; revenue: number; bookings: number }[] = [];

const SERVICE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

// ── GL Source badge ───────────────────────────────────────────────────────────
function GlBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
      <Database size={9} /> GL
    </span>
  );
}

export default function Reports() {
  const { trialBalance, entries } = useAccountingEngine();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [agentsData, suppliersData] = await Promise.all([fetchAgents(), fetchSuppliers()]);
        if (!cancelled) {
          if (agentsData) setAgents(agentsData);
          if (suppliersData) setSuppliers(suppliersData);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Aggregate from Trial Balance (General Ledger) ─────────────────────────
  const glRevenue   = trialBalance.filter(t => t.accountType === 'Revenue')  .reduce((s, t) => s + t.closingBalance, 0);
  const glExpenses  = trialBalance.filter(t => t.accountType === 'Expense')  .reduce((s, t) => s + t.closingBalance, 0);
  const glNetProfit = glRevenue - glExpenses;
  const glAssets     = trialBalance.filter(t => t.accountType === 'Asset')    .reduce((s, t) => s + t.closingBalance, 0);
  const glLiabilities= trialBalance.filter(t => t.accountType === 'Liability').reduce((s, t) => s + t.closingBalance, 0);
  const glEquity     = trialBalance.filter(t => t.accountType === 'Equity')   .reduce((s, t) => s + t.closingBalance, 0);

  // ── Monthly P&L from posted journal entries ───────────────────────────────
  const periodMap = new Map<string, { revenue: number; expenses: number }>();
  entries
    .filter(e => e.status === 'Posted')
    .forEach(je => {
      const p = periodMap.get(je.period) || { revenue: 0, expenses: 0 };
      je.lines.forEach(line => {
        if (line.accountType === 'Revenue') p.revenue += line.credit - line.debit;
        if (line.accountType === 'Expense') p.expenses += line.debit - line.credit;
      });
      periodMap.set(je.period, p);
    });

  const monthlyData = Array.from(periodMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, d]) => ({
      month: new Date(period + '-01').toLocaleString('default', { month: 'short', year: '2-digit' }),
      revenue:  Math.round(d.revenue),
      expenses: Math.round(d.expenses),
      profit:   Math.round(d.revenue - d.expenses),
    }));

  // ── Revenue by account (pie) from GL ─────────────────────────────────────
  const revenueByAccount = trialBalance
    .filter(t => t.accountType === 'Revenue' && t.closingBalance > 0)
    .map((t, i) => ({ name: t.accountName, value: t.closingBalance, color: SERVICE_COLORS[i % SERVICE_COLORS.length] }));

  // ── Account balances grouped by type ─────────────────────────────────────
  const typeOrder = ['Revenue', 'Expense', 'Asset', 'Liability', 'Equity'] as const;
  const typeColors: Record<string, string> = {
    Revenue: 'text-emerald-700 bg-emerald-50',
    Expense: 'text-red-700 bg-red-50',
    Asset: 'text-blue-700 bg-blue-50',
    Liability: 'text-amber-700 bg-amber-50',
    Equity: 'text-purple-700 bg-purple-50',
  };

  if (loading) return <LoadingSpinner message="Loading..." />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reports</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            Financial & tourism analytics
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
              <Database size={11} /> Financial figures sourced from General Ledger
            </span>
          </p>
        </div>
        <button className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 text-sm font-medium">
          <Download size={16} /> Export All Reports
        </button>
      </div>

      {/* ── GL Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between mb-1">
            <p className="text-emerald-100 text-xs uppercase tracking-wide">Total Revenue</p>
            <GlBadge />
          </div>
          <p className="text-2xl font-bold">AED {(glRevenue / 1000).toFixed(1)}K</p>
          <p className="text-xs text-emerald-200 mt-1">From posted revenue accounts</p>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between mb-1">
            <p className="text-red-100 text-xs uppercase tracking-wide">Total Expenses</p>
            <GlBadge />
          </div>
          <p className="text-2xl font-bold">AED {(glExpenses / 1000).toFixed(1)}K</p>
          <p className="text-xs text-red-200 mt-1">From posted expense accounts</p>
        </div>
        <div className={`bg-gradient-to-br rounded-xl p-5 text-white ${glNetProfit >= 0 ? 'from-blue-500 to-blue-600' : 'from-orange-500 to-orange-600'}`}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-blue-100 text-xs uppercase tracking-wide">Net Profit / Loss</p>
            <GlBadge />
          </div>
          <p className="text-2xl font-bold">AED {(glNetProfit / 1000).toFixed(1)}K</p>
          <p className="text-xs text-blue-200 mt-1">{glNetProfit >= 0 ? 'Net profit' : 'Net loss'} — Revenue minus Expenses</p>
        </div>
      </div>

      {/* ── Balance Sheet Summary ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Assets</p>
            <GlBadge />
          </div>
          <p className="text-xl font-bold text-blue-700">AED {glAssets.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Liabilities</p>
            <GlBadge />
          </div>
          <p className="text-xl font-bold text-amber-700">AED {glLiabilities.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Equity</p>
            <GlBadge />
          </div>
          <p className="text-xl font-bold text-purple-700">AED {glEquity.toLocaleString()}</p>
        </div>
      </div>

      {/* ── P&L Trend + Revenue Breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-800">Profit & Loss Trend</h3>
              <GlBadge />
            </div>
            <button className="text-xs text-blue-600 hover:underline">Download</button>
          </div>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v / 1000}K`} />
                <Tooltip formatter={(v: any) => `AED ${Number(v).toLocaleString()}`} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="revenue"  stroke="#3b82f6" strokeWidth={2} name="Revenue"  />
                <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} name="Expenses" />
                <Line type="monotone" dataKey="profit"   stroke="#10b981" strokeWidth={2} name="Profit"   />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
              No posted journal entries yet
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-800">Revenue by Account</h3>
              <GlBadge />
            </div>
          </div>
          {revenueByAccount.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <RechartsPieChart>
                <Pie data={revenueByAccount} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                  {revenueByAccount.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v: any) => `AED ${Number(v).toLocaleString()}`} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </RechartsPieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">No revenue accounts with balances</div>
          )}
        </div>
      </div>

      {/* ── GL Account Balances ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-800">GL Account Balances</h3>
            <GlBadge />
          </div>
          <button className="text-xs text-blue-600 hover:underline flex items-center gap-1"><FileText size={13} /> Export</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-5 py-3 font-medium text-slate-600">Code</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Account</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Type</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Debit</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Credit</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Balance</th>
              </tr>
            </thead>
            <tbody>
              {typeOrder.flatMap(type => {
                const rows = trialBalance.filter(t => t.accountType === type);
                if (rows.length === 0) return [];
                return [
                  <tr key={`hdr-${type}`} className="bg-slate-50/80">
                    <td colSpan={6} className="px-5 py-2">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${typeColors[type]}`}>{type.toUpperCase()}</span>
                    </td>
                  </tr>,
                  ...rows.map(t => (
                    <tr key={t.accountId} className="border-t border-slate-50 hover:bg-slate-50/50">
                      <td className="px-5 py-2.5 font-mono text-xs text-slate-500">{t.accountCode}</td>
                      <td className="px-5 py-2.5 text-slate-700">{t.accountName}</td>
                      <td className="px-5 py-2.5">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${typeColors[t.accountType]}`}>{t.accountType}</span>
                      </td>
                      <td className="px-5 py-2.5 text-right text-slate-600">{t.totalDebit > 0 ? t.totalDebit.toLocaleString() : '—'}</td>
                      <td className="px-5 py-2.5 text-right text-slate-600">{t.totalCredit > 0 ? t.totalCredit.toLocaleString() : '—'}</td>
                      <td className={`px-5 py-2.5 text-right font-semibold ${t.closingBalance >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                        AED {t.closingBalance.toLocaleString()}
                      </td>
                    </tr>
                  )),
                ];
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Tourism Reports (non-GL) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Destination Revenue</h3>
            <button className="text-xs text-blue-600 hover:underline">Download</button>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={destinationData} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${v / 1000}K`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={85} />
              <Tooltip formatter={(v: any) => `AED ${Number(v).toLocaleString()}`} />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Agent Outstanding Summary</h3>
            <button className="text-xs text-blue-600 hover:underline">Download</button>
          </div>
          <div className="space-y-3">
            {agents.slice(0, 5).map(agent => (
              <div key={agent.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-600">
                    {agent.name.split(' ').slice(0, 2).map((n: string) => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{agent.name}</p>
                    <p className="text-xs text-slate-400">{agent.country}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-amber-600">AED {agent.outstanding.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400">{((agent.outstanding / agent.creditLimit) * 100).toFixed(0)}% of limit</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Supplier Payables ── */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">Supplier Payables Summary</h3>
          <button className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Download size={13} /> Full Report</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-5 py-3 font-medium text-slate-600">Supplier</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Type</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Total Payable</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Paid</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Balance</th>
                <th className="text-center px-5 py-3 font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s: any) => (
                <tr key={s.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                  <td className="px-5 py-3 font-medium text-slate-800">{s.name}</td>
                  <td className="px-5 py-3"><span className="px-2 py-1 bg-slate-100 rounded text-xs">{s.type}</span></td>
                  <td className="px-5 py-3 text-right text-slate-600">AED {s.totalPayable.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right text-emerald-600">AED {s.paidAmount.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right font-medium text-red-600">AED {(s.totalPayable - s.paidAmount).toLocaleString()}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${s.totalPayable === s.paidAmount ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {s.totalPayable === s.paidAmount ? 'Cleared' : 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
