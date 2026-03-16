import { TrendingUp, TrendingDown, Clock, CheckCircle, AlertTriangle, Sparkles, ArrowRight, BookOpen, CreditCard, ShoppingBag, Users, Building2, Zap, ArrowUpCircle, ArrowDownCircle, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useAccountingEngine } from '../context/AccountingEngine';
import { useBookingEstimates } from '../context/BookingEstimateContext';
import { agents } from '../data/mockData';

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n >= 1_000_000 ? `AED ${(n / 1_000_000).toFixed(2)}M`
  : n >= 1_000   ? `AED ${(n / 1_000).toFixed(1)}K`
  : `AED ${n.toLocaleString()}`;

const today = new Date().toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

// ─── sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col gap-1">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-bold text-slate-800 leading-tight">{value}</p>
      {sub && (
        <p className={`text-xs font-medium flex items-center gap-1 ${positive === undefined ? 'text-slate-400' : positive ? 'text-emerald-600' : 'text-red-500'}`}>
          {positive !== undefined && (positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />)}
          {sub}
        </p>
      )}
    </div>
  );
}

function SmartAlert({ type, title, body }: { type: 'warn' | 'info' | 'ok'; title: string; body: string }) {
  const styles = {
    warn: { bg: 'bg-amber-50 border-amber-200', icon: <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" /> },
    info: { bg: 'bg-blue-50 border-blue-200',   icon: <Sparkles    size={15} className="text-blue-500 shrink-0 mt-0.5"  /> },
    ok:   { bg: 'bg-emerald-50 border-emerald-200', icon: <CheckCircle size={15} className="text-emerald-500 shrink-0 mt-0.5" /> },
  }[type];
  return (
    <div className={`flex gap-2.5 p-3 rounded-xl border text-sm ${styles.bg}`}>
      {styles.icon}
      <div>
        <p className="font-semibold text-slate-700">{title}</p>
        <p className="text-slate-500 text-xs mt-0.5">{body}</p>
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, color }: { icon: React.ElementType; label: string; color: string }) {
  return (
    <button className={`flex flex-col items-center gap-2 p-4 rounded-2xl border border-slate-100 bg-white hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 w-full`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <span className="text-xs font-semibold text-slate-600 text-center leading-tight">{label}</span>
    </button>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { trialBalance, entries, transactionLock } = useAccountingEngine();
  const { estimates, pendingCount } = useBookingEstimates();

  // ── GL-derived KPIs ──────────────────────────────────────────────────────────
  const glRevenue  = trialBalance.filter(t => t.accountType === 'Revenue') .reduce((s, t) => s + t.closingBalance, 0);
  const glExpenses = trialBalance.filter(t => t.accountType === 'Expense') .reduce((s, t) => s + t.closingBalance, 0);
  const glCash     = trialBalance.filter(t => ['Cash', 'Bank Account'].includes(t.accountName)).reduce((s, t) => s + t.closingBalance, 0);
  const netProfit  = glRevenue - glExpenses;
  const glAR       = trialBalance.find(t => t.accountName === 'Accounts Receivable')?.closingBalance ?? 0;
  const glAP       = trialBalance.find(t => t.accountName === 'Accounts Payable')?.closingBalance ?? 0;

  // ── Monthly trend from posted entries ────────────────────────────────────────
  const periodMap = new Map<string, { revenue: number; expenses: number }>();
  entries.filter(e => e.status === 'Posted').forEach(je => {
    const p = periodMap.get(je.period) || { revenue: 0, expenses: 0 };
    je.lines.forEach(l => {
      if (l.accountType === 'Revenue') p.revenue += l.credit - l.debit;
      if (l.accountType === 'Expense') p.expenses += l.debit - l.credit;
    });
    periodMap.set(je.period, p);
  });
  const chartData = Array.from(periodMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, d]) => ({
      month: new Date(period + '-01').toLocaleString('default', { month: 'short' }),
      Revenue:  Math.round(d.revenue),
      Expenses: Math.round(d.expenses),
    }));

  // ── Smart Insights (rule-based AI) ───────────────────────────────────────────
  const insights: { type: 'warn' | 'info' | 'ok'; title: string; body: string }[] = [];

  if (pendingCount > 0)
    insights.push({ type: 'warn', title: `${pendingCount} estimate${pendingCount > 1 ? 's' : ''} awaiting approval`, body: 'Go to Finance Approval Queue to review and approve bookings before invoicing.' });

  const postedCount = entries.filter(e => e.status === 'Posted').length;
  const draftCount  = entries.filter(e => e.status === 'Draft').length;
  if (draftCount > 0)
    insights.push({ type: 'info', title: `${draftCount} journal entr${draftCount > 1 ? 'ies' : 'y'} in Draft`, body: 'Submit drafts for approval so they post to the General Ledger and appear in reports.' });

  if (glAP > 0)
    insights.push({ type: 'warn', title: `Supplier payables: ${fmt(glAP)}`, body: 'Outstanding payables in Accounts Payable. Reconcile with Bank & Cash before period close.' });

  if (transactionLock)
    insights.push({ type: 'info', title: `Transactions locked until ${transactionLock.lockDate}`, body: `Set by ${transactionLock.lockedBy}. No entries can be created or edited before this date.` });

  const margin = glRevenue > 0 ? ((netProfit / glRevenue) * 100) : 0;
  if (glRevenue > 0 && margin < 15)
    insights.push({ type: 'warn', title: `Profit margin is ${margin.toFixed(1)}% — below 15%`, body: 'Review tour package costing and supplier rates to improve margins.' });

  if (postedCount > 0 && draftCount === 0 && pendingCount === 0)
    insights.push({ type: 'ok', title: 'All entries are posted and up to date', body: 'General Ledger is clean. Reports reflect real-time financial data.' });

  // ── Recent bookings ───────────────────────────────────────────────────────────
  const recentEstimates = estimates.slice(0, 5);

  // ── Top agents by outstanding ─────────────────────────────────────────────────
  const topAgents = agents.slice(0, 4);

  return (
    <div className="space-y-6">

      {/* ── Greeting header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Good morning, Admin</h1>
          <p className="text-slate-400 text-sm mt-0.5">{today}</p>
        </div>
        {transactionLock && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold border border-amber-200">
            <AlertTriangle size={12} /> Locked until {transactionLock.lockDate}
          </div>
        )}
      </div>

      {/* ── 4 core KPIs from GL ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Revenue"    value={fmt(glRevenue)}  sub="From GL — posted entries" />
        <KpiCard label="Total Expenses"   value={fmt(glExpenses)} sub="From GL — posted entries" />
        <KpiCard label="Net Profit"       value={fmt(netProfit)}  sub={`${margin.toFixed(1)}% margin`} positive={netProfit >= 0} />
        <KpiCard label="Cash & Bank"      value={fmt(glCash)}     sub="Cash + Bank Account balance" positive={glCash > 0} />
      </div>

      {/* ── Row: Smart Insights + Quick Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Smart Insights */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <Sparkles size={15} className="text-blue-500" />
            <h2 className="font-semibold text-slate-800">Smart Insights</h2>
            <span className="ml-auto text-xs text-slate-400">Auto-generated from your data</span>
          </div>
          <div className="p-4 space-y-2.5">
            {insights.length === 0 ? (
              <SmartAlert type="ok" title="Everything looks good!" body="No pending actions. Your books are balanced and all entries are posted." />
            ) : (
              insights.map((ins, i) => <SmartAlert key={i} type={ins.type} title={ins.title} body={ins.body} />)
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <Zap size={15} className="text-emerald-500" />
            <h2 className="font-semibold text-slate-800">Quick Actions</h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <QuickAction icon={BookOpen}      label="New Booking"       color="bg-emerald-500" />
            <QuickAction icon={CheckCircle}   label="Approve Queue"     color="bg-blue-500"    />
            <QuickAction icon={ArrowDownCircle} label="Record Payment"  color="bg-cyan-500"    />
            <QuickAction icon={ShoppingBag}   label="New Expense"       color="bg-orange-500"  />
            <QuickAction icon={CreditCard}    label="New Invoice"       color="bg-purple-500"  />
            <QuickAction icon={Activity}      label="Journal Entry"     color="bg-slate-500"   />
          </div>
        </div>
      </div>

      {/* ── Row: Revenue chart + AR/AP ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Revenue vs Expenses chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Revenue vs Expenses</h2>
            <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">From General Ledger</span>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${v / 1000}K`} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => `AED ${Number(v).toLocaleString()}`} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="Revenue"  fill="#10b981" radius={[4,4,0,0]} />
                <Bar dataKey="Expenses" fill="#f87171" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-52 text-slate-400 text-sm">Post journal entries to see the trend</div>
          )}
        </div>

        {/* Receivables & Payables */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-4">
          <h2 className="font-semibold text-slate-800">Receivables & Payables</h2>

          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownCircle size={14} className="text-emerald-600" />
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Accounts Receivable</p>
            </div>
            <p className="text-xl font-bold text-emerald-700">{fmt(glAR)}</p>
            <p className="text-xs text-emerald-500 mt-1">Money owed by agents & customers</p>
          </div>

          <div className="rounded-xl bg-rose-50 border border-rose-100 p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpCircle size={14} className="text-rose-600" />
              <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide">Accounts Payable</p>
            </div>
            <p className="text-xl font-bold text-rose-700">{fmt(glAP)}</p>
            <p className="text-xs text-rose-500 mt-1">Money owed to suppliers</p>
          </div>

          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={14} className="text-blue-600" />
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Pending Approvals</p>
            </div>
            <p className="text-xl font-bold text-blue-700">{pendingCount}</p>
            <p className="text-xs text-blue-500 mt-1">Booking estimates need review</p>
          </div>
        </div>
      </div>

      {/* ── Row: Recent Bookings + Agent Balances ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent Booking Estimates */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Recent Bookings</h2>
            <button className="flex items-center gap-1 text-xs text-emerald-600 font-semibold hover:underline">
              View All <ArrowRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {recentEstimates.map(b => (
              <div key={b.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                    <BookOpen size={13} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{b.customer}</p>
                    <p className="text-xs text-slate-400">{b.bookingRef} · {b.serviceType}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-800">{b.currency} {b.total.toLocaleString()}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    b.status === 'Approved'         ? 'bg-emerald-50 text-emerald-700' :
                    b.status === 'Pending Approval' ? 'bg-amber-50 text-amber-700'    :
                    b.status === 'Invoiced'         ? 'bg-blue-50 text-blue-700'       :
                    'bg-red-50 text-red-700'
                  }`}>{b.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Outstanding */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <Users size={14} className="text-amber-500" />
            <h2 className="font-semibold text-slate-800">Agent Balances</h2>
          </div>
          <div className="p-4 space-y-3">
            {topAgents.map(agent => {
              const pct = Math.min(100, (agent.outstanding / agent.creditLimit) * 100);
              const danger = pct > 80;
              return (
                <div key={agent.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                        {agent.name.split(' ').slice(0,2).map((n:string)=>n[0]).join('')}
                      </div>
                      <p className="text-xs font-medium text-slate-700 truncate max-w-[90px]">{agent.name}</p>
                    </div>
                    <p className={`text-xs font-bold ${danger ? 'text-red-600' : 'text-amber-600'}`}>
                      AED {(agent.outstanding/1000).toFixed(0)}K
                    </p>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${danger ? 'bg-red-400' : 'bg-amber-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 text-right">{pct.toFixed(0)}% of credit limit</p>
                </div>
              );
            })}
          </div>

          <div className="mx-4 mb-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1 mb-1">
              <Building2 size={11} className="text-purple-500" />
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Total Payables (GL)</p>
            </div>
            <p className="text-base font-bold text-purple-700">{fmt(glAP)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
