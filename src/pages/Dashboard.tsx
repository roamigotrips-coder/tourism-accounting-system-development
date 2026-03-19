import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, Clock, CheckCircle, AlertTriangle, Sparkles, ArrowRight, BookOpen, CreditCard, ShoppingBag, Users, Building2, Zap, ArrowUpCircle, ArrowDownCircle, Activity, Landmark, Wallet, CalendarDays } from 'lucide-react';
import { AreaChart, Area, LineChart, Line, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useAccountingEngine } from '../context/AccountingEngine';
import { useBookingEstimates } from '../context/BookingEstimateContext';
import { fetchAgents, fetchInvoices, fetchBills, fetchExpenses, fetchBankCashAccounts } from '../lib/supabaseSync';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';
import type { Agent, Invoice, Expense, BankAccount } from '../data/mockData';
import type { Bill } from '../lib/supabaseSync';

// ── palette ──────────────────────────────────────────────────────────────────
const EMERALD = '#10b981', RED = '#f87171', AMBER = '#f59e0b', BLUE = '#3b82f6', PURPLE = '#8b5cf6', CYAN = '#06b6d4';
const AGING_COLORS = [EMERALD, BLUE, AMBER, PURPLE, RED];

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n >= 1_000_000 ? `AED ${(n / 1_000_000).toFixed(2)}M`
  : n >= 1_000   ? `AED ${(n / 1_000).toFixed(1)}K`
  : `AED ${n.toLocaleString()}`;

const today = new Date();
const todayStr = today.toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const diffDays = (due: string) => Math.floor((today.getTime() - new Date(due).getTime()) / 86_400_000);

type Period = 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'all';
const PERIOD_LABELS: Record<Period, string> = {
  this_month: 'This Month', last_month: 'Last Month', this_quarter: 'This Quarter', this_year: 'This Year', all: 'All Time',
};

function inPeriod(dateStr: string, p: Period): boolean {
  if (p === 'all') return true;
  const d = new Date(dateStr), y = today.getFullYear(), m = today.getMonth();
  if (p === 'this_month') return d.getFullYear() === y && d.getMonth() === m;
  if (p === 'last_month') { const lm = m === 0 ? 11 : m - 1, ly = m === 0 ? y - 1 : y; return d.getFullYear() === ly && d.getMonth() === lm; }
  if (p === 'this_quarter') { const qs = Math.floor(m / 3) * 3; return d.getFullYear() === y && d.getMonth() >= qs && d.getMonth() <= qs + 2; }
  return d.getFullYear() === y;
}

function agingBucket(dueDate: string): string {
  const d = diffDays(dueDate);
  if (d <= 0) return 'Current';
  if (d <= 30) return '1-30';
  if (d <= 60) return '31-60';
  if (d <= 90) return '61-90';
  return '90+';
}

// ── sub-components ───────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, positive, icon: Icon }: { label: string; value: string; sub?: string; positive?: boolean; icon?: React.ElementType }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={14} className="text-slate-400" />}
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{label}</p>
      </div>
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
    info: { bg: 'bg-blue-50 border-blue-200',   icon: <Sparkles size={15} className="text-blue-500 shrink-0 mt-0.5" /> },
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
    <button className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-slate-100 bg-white hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 w-full">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <span className="text-xs font-semibold text-slate-600 text-center leading-tight">{label}</span>
    </button>
  );
}

function CardShell({ children, title, badge, icon: Icon, className = '' }: { children: React.ReactNode; title: string; badge?: string; icon?: React.ElementType; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm ${className}`}>
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
        {Icon && <Icon size={15} className="text-slate-400" />}
        <h2 className="font-semibold text-slate-800">{title}</h2>
        {badge && <span className="ml-auto text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">{badge}</span>}
      </div>
      {children}
    </div>
  );
}

// ── main ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { trialBalance, entries, transactionLock } = useAccountingEngine();
  const { estimates, pendingCount } = useBookingEstimates();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [invoiceList, setInvoiceList] = useState<Invoice[]>([]);
  const [billList, setBillList] = useState<Bill[]>([]);
  const [expenseList, setExpenseList] = useState<Expense[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ag, inv, bl, ex, ba] = await Promise.all([
          fetchAgents(), fetchInvoices(), fetchBills(), fetchExpenses(), fetchBankCashAccounts(),
        ]);
        if (!cancelled) {
          setAgents(ag ?? []);
          setInvoiceList(inv ?? []);
          setBillList(bl ?? []);
          setExpenseList(ex ?? []);
          setBankAccounts(ba ?? []);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── GL-derived KPIs (period-filtered via entries) ──────────────────────────
  const glRevenue  = trialBalance.filter(t => t.accountType === 'Revenue').reduce((s, t) => s + t.closingBalance, 0);
  const glExpenses = trialBalance.filter(t => t.accountType === 'Expense').reduce((s, t) => s + t.closingBalance, 0);
  const glCash     = trialBalance.filter(t => ['Cash', 'Bank Account'].includes(t.accountName)).reduce((s, t) => s + t.closingBalance, 0);
  const netProfit  = glRevenue - glExpenses;
  const glAR       = trialBalance.find(t => t.accountName === 'Accounts Receivable')?.closingBalance ?? 0;
  const glAP       = trialBalance.find(t => t.accountName === 'Accounts Payable')?.closingBalance ?? 0;
  const margin     = glRevenue > 0 ? (netProfit / glRevenue) * 100 : 0;

  // ── Monthly trend (Income vs Expense LineChart) ────────────────────────────
  const chartData = useMemo(() => {
    const pm = new Map<string, { revenue: number; expenses: number }>();
    entries.filter(e => e.status === 'Posted').forEach(je => {
      const p = pm.get(je.period) || { revenue: 0, expenses: 0 };
      je.lines.forEach(l => {
        if (l.accountType === 'Revenue') p.revenue += l.credit - l.debit;
        if (l.accountType === 'Expense') p.expenses += l.debit - l.credit;
      });
      pm.set(je.period, p);
    });
    return Array.from(pm.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([per, d]) => ({
      month: new Date(per + '-01').toLocaleString('default', { month: 'short' }),
      Revenue: Math.round(d.revenue), Expenses: Math.round(d.expenses),
    }));
  }, [entries]);

  // ── Cash Flow Forecast (30/60/90 days) ─────────────────────────────────────
  const cashForecast = useMemo(() => {
    const buckets = [
      { label: '0-30 days', inflow: 0, outflow: 0 },
      { label: '31-60 days', inflow: 0, outflow: 0 },
      { label: '61-90 days', inflow: 0, outflow: 0 },
    ];
    const nowMs = today.getTime();
    invoiceList.filter(i => i.status !== 'Paid').forEach(inv => {
      const d = Math.floor((new Date(inv.dueDate).getTime() - nowMs) / 86_400_000);
      if (d < 0 || d > 90) return;
      const idx = d <= 30 ? 0 : d <= 60 ? 1 : 2;
      buckets[idx].inflow += inv.total;
    });
    billList.filter(b => !['Paid', 'Void'].includes(b.status)).forEach(bill => {
      const d = Math.floor((new Date(bill.dueDate).getTime() - nowMs) / 86_400_000);
      if (d < 0 || d > 90) return;
      const idx = d <= 30 ? 0 : d <= 60 ? 1 : 2;
      buckets[idx].outflow += (bill.total - bill.amountPaid);
    });
    return buckets;
  }, [invoiceList, billList]);

  // ── AR Aging ───────────────────────────────────────────────────────────────
  const arAging = useMemo(() => {
    const m: Record<string, number> = { Current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    invoiceList.filter(i => i.status !== 'Paid').forEach(i => { m[agingBucket(i.dueDate)] += i.total; });
    return Object.entries(m).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [invoiceList]);

  // ── AP Aging ───────────────────────────────────────────────────────────────
  const apAging = useMemo(() => {
    const m: Record<string, number> = { Current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    billList.filter(b => !['Paid', 'Void'].includes(b.status)).forEach(b => { m[agingBucket(b.dueDate)] += (b.total - b.amountPaid); });
    return Object.entries(m).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [billList]);

  // ── Top 5 Expenses by Category ─────────────────────────────────────────────
  const topExpenses = useMemo(() => {
    const m = new Map<string, number>();
    expenseList.filter(e => inPeriod(e.date, period)).forEach(e => m.set(e.category, (m.get(e.category) ?? 0) + e.amount));
    return Array.from(m.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [expenseList, period]);

  // ── Overdue Invoices ───────────────────────────────────────────────────────
  const overdueInvoices = useMemo(() =>
    invoiceList
      .filter(i => i.status === 'Overdue' || (i.status === 'Unpaid' && diffDays(i.dueDate) > 0))
      .map(i => ({ ...i, daysOverdue: diffDays(i.dueDate) }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
      .slice(0, 5),
  [invoiceList]);

  // ── Smart Insights ─────────────────────────────────────────────────────────
  const insights: { type: 'warn' | 'info' | 'ok'; title: string; body: string }[] = [];
  if (pendingCount > 0) insights.push({ type: 'warn', title: `${pendingCount} estimate${pendingCount > 1 ? 's' : ''} awaiting approval`, body: 'Go to Finance Approval Queue to review and approve bookings before invoicing.' });
  const draftCount = entries.filter(e => e.status === 'Draft').length;
  const postedCount = entries.filter(e => e.status === 'Posted').length;
  if (draftCount > 0) insights.push({ type: 'info', title: `${draftCount} journal entr${draftCount > 1 ? 'ies' : 'y'} in Draft`, body: 'Submit drafts for approval so they post to the General Ledger and appear in reports.' });
  if (glAP > 0) insights.push({ type: 'warn', title: `Supplier payables: ${fmt(glAP)}`, body: 'Outstanding payables in Accounts Payable. Reconcile with Bank & Cash before period close.' });
  if (transactionLock) insights.push({ type: 'info', title: `Transactions locked until ${transactionLock.lockDate}`, body: `Set by ${transactionLock.lockedBy}. No entries can be created or edited before this date.` });
  if (glRevenue > 0 && margin < 15) insights.push({ type: 'warn', title: `Profit margin is ${margin.toFixed(1)}% — below 15%`, body: 'Review tour package costing and supplier rates to improve margins.' });
  if (overdueInvoices.length > 0) insights.push({ type: 'warn', title: `${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? 's' : ''}`, body: `Oldest overdue: ${overdueInvoices[0].party} — ${overdueInvoices[0].daysOverdue} days past due.` });
  if (postedCount > 0 && draftCount === 0 && pendingCount === 0 && overdueInvoices.length === 0) insights.push({ type: 'ok', title: 'All entries are posted and up to date', body: 'General Ledger is clean. Reports reflect real-time financial data.' });

  const recentEstimates = estimates.slice(0, 5);
  const topAgents = agents.slice(0, 4);

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;
  if (error) return <ErrorBanner message={error} />;

  const pieLabel = ({ name, percent }: any) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : '';

  return (
    <div className="space-y-6">

      {/* ── Row 1: Period + Greeting + Lock ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Good morning, Admin</h1>
          <p className="text-slate-400 text-sm mt-0.5">{todayStr}</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={period} onChange={e => setPeriod(e.target.value as Period)} className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-200">
            {Object.entries(PERIOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {transactionLock && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold border border-amber-200">
              <AlertTriangle size={12} /> Locked until {transactionLock.lockDate}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: 6 KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard icon={TrendingUp} label="Revenue" value={fmt(glRevenue)} sub="From GL posted entries" positive={glRevenue > 0} />
        <KpiCard icon={TrendingDown} label="Expenses" value={fmt(glExpenses)} sub="From GL posted entries" />
        <KpiCard icon={Activity} label="Net Profit" value={fmt(netProfit)} sub={`${margin.toFixed(1)}% margin`} positive={netProfit >= 0} />
        <KpiCard icon={Wallet} label="Cash & Bank" value={fmt(glCash)} sub="Cash + Bank balance" positive={glCash > 0} />
        <KpiCard icon={ArrowDownCircle} label="Receivables" value={fmt(glAR)} sub={`${invoiceList.filter(i => i.status !== 'Paid').length} open invoices`} />
        <KpiCard icon={ArrowUpCircle} label="Payables" value={fmt(glAP)} sub={`${billList.filter(b => !['Paid','Void'].includes(b.status)).length} open bills`} />
      </div>

      {/* ── Row 3: Cash Flow Forecast (2/3) + Bank Balance Cards (1/3) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Cash Flow Forecast</h2>
          {cashForecast.some(b => b.inflow + b.outflow > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={cashForecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => `AED ${Number(v).toLocaleString()}`} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend />
                <Area type="monotone" dataKey="inflow" name="Inflows" stroke={EMERALD} fill={EMERALD} fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="outflow" name="Outflows" stroke={RED} fill={RED} fillOpacity={0.10} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-52 text-slate-400 text-sm">No upcoming invoices or bills to forecast</div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-1">
            <Landmark size={15} className="text-blue-500" />
            <h2 className="font-semibold text-slate-800">Bank & Cash Accounts</h2>
          </div>
          {bankAccounts.length > 0 ? bankAccounts.map(ba => (
            <div key={ba.id} className="rounded-xl border border-slate-100 p-3 hover:bg-slate-50/50 transition">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700 truncate">{ba.name}</p>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ba.type === 'Bank' ? 'bg-blue-50 text-blue-700' : ba.type === 'Cash' ? 'bg-emerald-50 text-emerald-700' : 'bg-purple-50 text-purple-700'}`}>{ba.type}</span>
              </div>
              <p className="text-lg font-bold text-slate-800 mt-1">{ba.currency} {ba.balance.toLocaleString()}</p>
              {ba.bank && <p className="text-xs text-slate-400">{ba.bank}</p>}
            </div>
          )) : (
            <div className="flex items-center justify-center h-32 text-slate-400 text-sm">No bank accounts configured</div>
          )}
        </div>
      </div>

      {/* ── Row 4: Income vs Expense Trend (2/3) + AR Aging Donut (1/3) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Income vs Expense Trend</h2>
            <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">From General Ledger</span>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => `AED ${Number(v).toLocaleString()}`} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend />
                <Line type="monotone" dataKey="Revenue" stroke={EMERALD} strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Expenses" stroke={RED} strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-52 text-slate-400 text-sm">Post journal entries to see the trend</div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-800 mb-2">AR Aging</h2>
          {arAging.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={arAging} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} label={pieLabel} labelLine={false}>
                  {arAging.map((_, i) => <Cell key={i} fill={AGING_COLORS[i % AGING_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => `AED ${Number(v).toLocaleString()}`} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">No outstanding receivables</div>
          )}
        </div>
      </div>

      {/* ── Row 5: Smart Insights (2/3) + Quick Actions (1/3) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CardShell title="Smart Insights" icon={Sparkles} badge="Auto-generated from your data" className="lg:col-span-2">
          <div className="p-4 space-y-2.5">
            {insights.length === 0 ? (
              <SmartAlert type="ok" title="Everything looks good!" body="No pending actions. Your books are balanced and all entries are posted." />
            ) : insights.map((ins, i) => <SmartAlert key={i} type={ins.type} title={ins.title} body={ins.body} />)}
          </div>
        </CardShell>

        <CardShell title="Quick Actions" icon={Zap}>
          <div className="p-4 grid grid-cols-2 gap-3">
            <QuickAction icon={BookOpen} label="New Booking" color="bg-emerald-500" />
            <QuickAction icon={CheckCircle} label="Approve Queue" color="bg-blue-500" />
            <QuickAction icon={ArrowDownCircle} label="Record Payment" color="bg-cyan-500" />
            <QuickAction icon={ShoppingBag} label="New Expense" color="bg-orange-500" />
            <QuickAction icon={CreditCard} label="New Invoice" color="bg-purple-500" />
            <QuickAction icon={Activity} label="Journal Entry" color="bg-slate-500" />
          </div>
        </CardShell>
      </div>

      {/* ── Row 6: Top Expenses (1/3) + Overdue Invoices (1/3) + AP Aging (1/3) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top 5 Expenses by Category */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-800 mb-3">Top Expenses by Category</h2>
          {topExpenses.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topExpenses} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={90} />
                <Tooltip formatter={(v: any) => `AED ${Number(v).toLocaleString()}`} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                <Bar dataKey="value" fill={PURPLE} radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">No expenses recorded</div>
          )}
        </div>

        {/* Overdue Invoices */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <AlertTriangle size={14} className="text-red-500" />
            <h2 className="font-semibold text-slate-800">Overdue Invoices</h2>
          </div>
          {overdueInvoices.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {overdueInvoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700 truncate max-w-[120px]">{inv.party}</p>
                    <p className="text-xs text-red-500 font-medium">{inv.daysOverdue} days overdue</p>
                  </div>
                  <p className="text-sm font-bold text-slate-800">{fmt(inv.total)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">No overdue invoices</div>
          )}
        </div>

        {/* AP Aging Donut */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-800 mb-2">AP Aging</h2>
          {apAging.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={apAging} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} label={pieLabel} labelLine={false}>
                  {apAging.map((_, i) => <Cell key={i} fill={AGING_COLORS[i % AGING_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => `AED ${Number(v).toLocaleString()}`} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">No outstanding payables</div>
          )}
        </div>
      </div>

      {/* ── Row 7: Recent Bookings (2/3) + Agent Balances (1/3) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CardShell title="Recent Bookings" icon={BookOpen} badge="View All" className="lg:col-span-2">
          <div className="divide-y divide-slate-50">
            {recentEstimates.length > 0 ? recentEstimates.map(b => (
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
                    b.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' :
                    b.status === 'Pending Approval' ? 'bg-amber-50 text-amber-700' :
                    b.status === 'Invoiced' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'
                  }`}>{b.status}</span>
                </div>
              </div>
            )) : (
              <div className="flex items-center justify-center h-24 text-slate-400 text-sm">No bookings yet</div>
            )}
          </div>
        </CardShell>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <Users size={14} className="text-amber-500" />
            <h2 className="font-semibold text-slate-800">Agent Balances</h2>
          </div>
          <div className="p-4 space-y-3">
            {topAgents.length > 0 ? topAgents.map(agent => {
              const pct = Math.min(100, (agent.outstanding / agent.creditLimit) * 100);
              const danger = pct > 80;
              return (
                <div key={agent.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                        {agent.name.split(' ').slice(0, 2).map((n: string) => n[0]).join('')}
                      </div>
                      <p className="text-xs font-medium text-slate-700 truncate max-w-[90px]">{agent.name}</p>
                    </div>
                    <p className={`text-xs font-bold ${danger ? 'text-red-600' : 'text-amber-600'}`}>AED {(agent.outstanding / 1000).toFixed(0)}K</p>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full transition-all ${danger ? 'bg-red-400' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 text-right">{pct.toFixed(0)}% of credit limit</p>
                </div>
              );
            }) : (
              <div className="flex items-center justify-center h-24 text-slate-400 text-sm">No agents found</div>
            )}
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
