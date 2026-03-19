import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText, Download, Database, Calendar, Filter, Play, Save, FolderOpen,
  TrendingUp, TrendingDown, DollarSign, BarChart3, Clock, Users, Building2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAccountingEngine } from '../context/AccountingEngine';
import type { TrialBalanceLine } from '../context/AccountingEngine';
import {
  fetchInvoices, fetchBills, fetchExpenses, fetchAgents, fetchSuppliers,
  fetchProjects, fetchTimeEntries, fetchVATRecords,
} from '../lib/supabaseSync';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';
import type { Agent, Supplier, Expense, Invoice, VATRecord } from '../data/mockData';
import type { Bill, Project, TimeEntry } from '../lib/supabaseSync';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => `AED ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10); };

type Tab = 'financial' | 'receivables' | 'payables' | 'tax' | 'project' | 'custom';
const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'financial', label: 'Financial', icon: DollarSign },
  { key: 'receivables', label: 'Receivables', icon: TrendingUp },
  { key: 'payables', label: 'Payables', icon: TrendingDown },
  { key: 'tax', label: 'Tax', icon: FileText },
  { key: 'project', label: 'Project', icon: BarChart3 },
  { key: 'custom', label: 'Custom', icon: Filter },
];

function GlBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
      <Database size={9} /> GL
    </span>
  );
}

function DateRange({ from, to, onChange }: { from: string; to: string; onChange: (f: string, t: string) => void }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Calendar size={14} className="text-slate-400" />
      <input type="date" value={from} onChange={e => onChange(e.target.value, to)}
        className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
      <span className="text-slate-400">to</span>
      <input type="date" value={to} onChange={e => onChange(from, e.target.value)}
        className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
    </div>
  );
}

function GenBtn({ onClick, label = 'Generate' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-1.5 rounded-lg hover:bg-emerald-700 text-sm font-medium">
      <Play size={13} /> {label}
    </button>
  );
}

function ExportBar({ onExcel, onPdf }: { onExcel: () => void; onPdf?: () => void }) {
  return (
    <div className="flex gap-2">
      <button onClick={onExcel} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600">
        <Download size={12} /> Excel
      </button>
      {onPdf && (
        <button onClick={onPdf} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600">
          <FileText size={12} /> PDF
        </button>
      )}
    </div>
  );
}

function exportToExcel(data: Record<string, any>[], name: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  XLSX.writeFile(wb, `${name}.xlsx`);
}

function ReportCard({ title, children, badge }: { title: string; children: React.ReactNode; badge?: boolean }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100">
      <div className="flex items-center gap-2 p-4 border-b border-slate-100">
        <h3 className="font-semibold text-slate-800">{title}</h3>
        {badge && <GlBadge />}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Aging helper ─────────────────────────────────────────────────────────────
function agingBucket(dueDate: string): string {
  const diff = Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000);
  if (diff <= 0) return 'Current';
  if (diff <= 30) return '1-30';
  if (diff <= 60) return '31-60';
  if (diff <= 90) return '61-90';
  return '90+';
}

// ══════════════════════════════════════════════════════════════════════════════
export default function Reports() {
  const { trialBalance, entries, accounts } = useAccountingEngine();
  const [tab, setTab] = useState<Tab>('financial');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Remote data
  const [invoicesData, setInvoices] = useState<Invoice[]>([]);
  const [billsData, setBills] = useState<Bill[]>([]);
  const [expensesData, setExpenses] = useState<Expense[]>([]);
  const [agentsData, setAgents] = useState<Agent[]>([]);
  const [suppliersData, setSuppliers] = useState<Supplier[]>([]);
  const [projectsData, setProjects] = useState<Project[]>([]);
  const [timeData, setTime] = useState<TimeEntry[]>([]);
  const [vatData, setVat] = useState<(VATRecord & { id?: string })[]>([]);

  // Date ranges per report
  const [finFrom, setFinFrom] = useState(monthAgo());
  const [finTo, setFinTo] = useState(today());
  const [generated, setGenerated] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const [inv, bil, exp, ag, sup, prj, te, vr] = await Promise.all([
          fetchInvoices(), fetchBills(), fetchExpenses(), fetchAgents(),
          fetchSuppliers(), fetchProjects(), fetchTimeEntries(), fetchVATRecords(),
        ]);
        if (!c) {
          if (inv) setInvoices(inv);
          if (bil) setBills(bil);
          if (exp) setExpenses(exp);
          if (ag) setAgents(ag);
          if (sup) setSuppliers(sup);
          if (prj) setProjects(prj);
          if (te) setTime(te);
          if (vr) setVat(vr);
        }
      } catch (e: any) { if (!c) setError(e.message); }
      finally { if (!c) setLoading(false); }
    })();
    return () => { c = true; };
  }, []);

  const mark = useCallback((key: string) => setGenerated(p => ({ ...p, [key]: true })), []);

  // ── P&L ────────────────────────────────────────────────────────────────────
  const revenueAccounts = useMemo(() => trialBalance.filter(t => t.accountType === 'Revenue'), [trialBalance]);
  const expenseAccounts = useMemo(() => trialBalance.filter(t => t.accountType === 'Expense'), [trialBalance]);
  const totalRevenue = revenueAccounts.reduce((s, t) => s + t.closingBalance, 0);
  const totalExpenses = expenseAccounts.reduce((s, t) => s + t.closingBalance, 0);
  const netProfit = totalRevenue - totalExpenses;

  // ── Balance Sheet ──────────────────────────────────────────────────────────
  const assetAccounts = useMemo(() => trialBalance.filter(t => t.accountType === 'Asset'), [trialBalance]);
  const liabilityAccounts = useMemo(() => trialBalance.filter(t => t.accountType === 'Liability'), [trialBalance]);
  const equityAccounts = useMemo(() => trialBalance.filter(t => t.accountType === 'Equity'), [trialBalance]);
  const totalAssets = assetAccounts.reduce((s, t) => s + t.closingBalance, 0);
  const totalLiabilities = liabilityAccounts.reduce((s, t) => s + t.closingBalance, 0);
  const totalEquity = equityAccounts.reduce((s, t) => s + t.closingBalance, 0);

  // ── Cash Flow (simplified from GL) ─────────────────────────────────────────
  const cashFlowOperating = netProfit;
  const cashFlowInvesting = assetAccounts.filter(a => a.accountName.toLowerCase().includes('equipment') || a.accountName.toLowerCase().includes('vehicle')).reduce((s, t) => s - t.closingBalance, 0);
  const cashFlowFinancing = liabilityAccounts.reduce((s, t) => s + t.closingBalance, 0) + equityAccounts.reduce((s, t) => s + t.closingBalance, 0);

  // ── AR Aging ───────────────────────────────────────────────────────────────
  const arAging = useMemo(() => {
    const buckets: Record<string, number> = { Current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    invoicesData.filter(i => i.status !== 'Paid').forEach(i => { buckets[agingBucket(i.dueDate)] += i.total; });
    return buckets;
  }, [invoicesData]);

  // ── AP Aging ───────────────────────────────────────────────────────────────
  const apAging = useMemo(() => {
    const buckets: Record<string, number> = { Current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    billsData.filter(b => b.status !== 'Paid' && b.status !== 'Void').forEach(b => { buckets[agingBucket(b.dueDate)] += (b.total - b.amountPaid); });
    return buckets;
  }, [billsData]);

  // ── Custom report state ────────────────────────────────────────────────────
  const [customCols, setCustomCols] = useState<string[]>(['accountCode', 'accountName', 'accountType', 'closingBalance']);
  const [customGroup, setCustomGroup] = useState('accountType');
  const [savedReports, setSavedReports] = useState<{ name: string; cols: string[]; group: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('saved_custom_reports') || '[]'); } catch { return []; }
  });
  const [reportName, setReportName] = useState('');

  const allCols = ['accountId', 'accountCode', 'accountName', 'accountType', 'normalBalance', 'openingBalance', 'totalDebit', 'totalCredit', 'closingBalance'];

  if (loading) return <LoadingSpinner message="Loading reports..." />;
  if (error) return <ErrorBanner message={error} />;

  // ── Grouped table renderer ─────────────────────────────────────────────────
  function GroupedTable({ rows, label }: { rows: TrialBalanceLine[]; label: string }) {
    const total = rows.reduce((s, r) => s + r.closingBalance, 0);
    return (
      <div className="mb-4">
        <div className="bg-slate-50 px-4 py-2 rounded-t-lg font-semibold text-sm text-slate-700">{label}</div>
        <table className="w-full text-sm">
          <tbody>
            {rows.map(r => (
              <tr key={r.accountId} className="border-t border-slate-50 hover:bg-slate-50/50">
                <td className="px-4 py-2 font-mono text-xs text-slate-500 w-24">{r.accountCode}</td>
                <td className="px-4 py-2 text-slate-700">{r.accountName}</td>
                <td className="px-4 py-2 text-right font-medium text-slate-800 w-40">{fmt(r.closingBalance)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-200 bg-slate-50/70">
              <td colSpan={2} className="px-4 py-2 font-semibold text-slate-700">Total {label}</td>
              <td className="px-4 py-2 text-right font-bold text-slate-900 w-40">{fmt(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // FINANCIAL TAB
  // ══════════════════════════════════════════════════════════════════════════════
  function FinancialTab() {
    return (
      <div className="space-y-6">
        {/* P&L */}
        <ReportCard title="Profit & Loss Statement" badge>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <DateRange from={finFrom} to={finTo} onChange={(f, t) => { setFinFrom(f); setFinTo(t); }} />
            <GenBtn onClick={() => mark('pnl')} />
            <ExportBar onExcel={() => exportToExcel(
              [...revenueAccounts, ...expenseAccounts].map(r => ({ Code: r.accountCode, Account: r.accountName, Type: r.accountType, Balance: r.closingBalance })),
              'Profit_Loss'
            )} />
          </div>
          {generated.pnl || trialBalance.length > 0 ? (
            <>
              <GroupedTable rows={revenueAccounts} label="Revenue" />
              <GroupedTable rows={expenseAccounts} label="Expenses" />
              <div className="border-t-2 border-emerald-300 bg-emerald-50 rounded-b-lg px-4 py-3 flex justify-between items-center">
                <span className="font-bold text-emerald-800">Net {netProfit >= 0 ? 'Profit' : 'Loss'}</span>
                <span className={`font-bold text-lg ${netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmt(netProfit)}</span>
              </div>
            </>
          ) : <p className="text-sm text-slate-400">Click Generate to build report</p>}
        </ReportCard>

        {/* Balance Sheet */}
        <ReportCard title="Balance Sheet" badge>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <DateRange from={finFrom} to={finTo} onChange={(f, t) => { setFinFrom(f); setFinTo(t); }} />
            <GenBtn onClick={() => mark('bs')} />
            <ExportBar onExcel={() => exportToExcel(
              [...assetAccounts, ...liabilityAccounts, ...equityAccounts].map(r => ({ Code: r.accountCode, Account: r.accountName, Type: r.accountType, Balance: r.closingBalance })),
              'Balance_Sheet'
            )} />
          </div>
          {generated.bs || trialBalance.length > 0 ? (
            <>
              <GroupedTable rows={assetAccounts} label="Assets" />
              <GroupedTable rows={liabilityAccounts} label="Liabilities" />
              <GroupedTable rows={equityAccounts} label="Equity" />
              <div className={`border-t-2 rounded-b-lg px-4 py-3 flex justify-between items-center ${Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01 ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
                <div>
                  <span className="font-bold text-slate-800">Assets: {fmt(totalAssets)}</span>
                  <span className="mx-3 text-slate-400">|</span>
                  <span className="font-bold text-slate-800">L + E: {fmt(totalLiabilities + totalEquity)}</span>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded ${Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01 ? 'Balanced' : 'Imbalanced'}
                </span>
              </div>
            </>
          ) : <p className="text-sm text-slate-400">Click Generate to build report</p>}
        </ReportCard>

        {/* Cash Flow */}
        <ReportCard title="Cash Flow Statement" badge>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <DateRange from={finFrom} to={finTo} onChange={(f, t) => { setFinFrom(f); setFinTo(t); }} />
            <GenBtn onClick={() => mark('cf')} />
            <ExportBar onExcel={() => exportToExcel([
              { Section: 'Operating Activities', Amount: cashFlowOperating },
              { Section: 'Investing Activities', Amount: cashFlowInvesting },
              { Section: 'Financing Activities', Amount: cashFlowFinancing },
              { Section: 'Net Cash Flow', Amount: cashFlowOperating + cashFlowInvesting + cashFlowFinancing },
            ], 'Cash_Flow')} />
          </div>
          {generated.cf || trialBalance.length > 0 ? (
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50"><th className="text-left px-4 py-2 font-medium text-slate-600">Section</th><th className="text-right px-4 py-2 font-medium text-slate-600">Amount</th></tr></thead>
              <tbody>
                <tr className="border-t border-slate-50"><td className="px-4 py-2.5 font-medium text-slate-700">Operating Activities</td><td className="px-4 py-2.5 text-right">{fmt(cashFlowOperating)}</td></tr>
                <tr className="border-t border-slate-50"><td className="px-4 py-2.5 font-medium text-slate-700">Investing Activities</td><td className="px-4 py-2.5 text-right">{fmt(cashFlowInvesting)}</td></tr>
                <tr className="border-t border-slate-50"><td className="px-4 py-2.5 font-medium text-slate-700">Financing Activities</td><td className="px-4 py-2.5 text-right">{fmt(cashFlowFinancing)}</td></tr>
                <tr className="border-t-2 border-emerald-300 bg-emerald-50">
                  <td className="px-4 py-3 font-bold text-emerald-800">Net Cash Flow</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700">{fmt(cashFlowOperating + cashFlowInvesting + cashFlowFinancing)}</td>
                </tr>
              </tbody>
            </table>
          ) : <p className="text-sm text-slate-400">Click Generate to build report</p>}
        </ReportCard>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // RECEIVABLES TAB
  // ══════════════════════════════════════════════════════════════════════════════
  function ReceivablesTab() {
    const customerBalances = useMemo(() => {
      const map = new Map<string, number>();
      invoicesData.filter(i => i.status !== 'Paid').forEach(i => map.set(i.party, (map.get(i.party) || 0) + i.total));
      return Array.from(map.entries()).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
    }, []);
    const salesByCustomer = useMemo(() => {
      const map = new Map<string, number>();
      invoicesData.forEach(i => map.set(i.party, (map.get(i.party) || 0) + i.total));
      return Array.from(map.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
    }, []);

    return (
      <div className="space-y-6">
        <ReportCard title="AR Aging Summary">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <GenBtn onClick={() => mark('arAging')} />
            <ExportBar onExcel={() => exportToExcel(Object.entries(arAging).map(([bucket, amt]) => ({ Bucket: bucket, Amount: amt })), 'AR_Aging')} />
          </div>
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50">
              {['Current', '1-30', '31-60', '61-90', '90+', 'Total'].map(h => <th key={h} className="text-right px-4 py-2 font-medium text-slate-600">{h}</th>)}
            </tr></thead>
            <tbody><tr>
              {Object.values(arAging).map((v, i) => <td key={i} className="px-4 py-2.5 text-right">{fmt(v)}</td>)}
              <td className="px-4 py-2.5 text-right font-bold text-slate-800">{fmt(Object.values(arAging).reduce((a, b) => a + b, 0))}</td>
            </tr></tbody>
          </table>
        </ReportCard>

        <ReportCard title="Customer Balances">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <ExportBar onExcel={() => exportToExcel(customerBalances.map(c => ({ Customer: c.name, Outstanding: c.amount })), 'Customer_Balances')} />
          </div>
          {customerBalances.length > 0 ? (
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50"><th className="text-left px-4 py-2 font-medium text-slate-600">Customer</th><th className="text-right px-4 py-2 font-medium text-slate-600">Outstanding</th></tr></thead>
              <tbody>
                {customerBalances.map(c => (
                  <tr key={c.name} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 text-slate-700 flex items-center gap-2"><Users size={14} className="text-slate-400" /> {c.name}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-amber-600">{fmt(c.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td className="px-4 py-2 font-semibold">Total</td>
                  <td className="px-4 py-2 text-right font-bold">{fmt(customerBalances.reduce((s, c) => s + c.amount, 0))}</td>
                </tr>
              </tbody>
            </table>
          ) : <p className="text-sm text-slate-400">No outstanding balances</p>}
        </ReportCard>

        <ReportCard title="Sales by Customer">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <ExportBar onExcel={() => exportToExcel(salesByCustomer.map(c => ({ Customer: c.name, TotalSales: c.total })), 'Sales_by_Customer')} />
          </div>
          {salesByCustomer.length > 0 ? (
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50"><th className="text-left px-4 py-2 font-medium text-slate-600">Customer</th><th className="text-right px-4 py-2 font-medium text-slate-600">Total Sales</th></tr></thead>
              <tbody>
                {salesByCustomer.map(c => (
                  <tr key={c.name} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 text-slate-700">{c.name}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-emerald-600">{fmt(c.total)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td className="px-4 py-2 font-semibold">Grand Total</td>
                  <td className="px-4 py-2 text-right font-bold">{fmt(salesByCustomer.reduce((s, c) => s + c.total, 0))}</td>
                </tr>
              </tbody>
            </table>
          ) : <p className="text-sm text-slate-400">No sales data</p>}
        </ReportCard>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PAYABLES TAB
  // ══════════════════════════════════════════════════════════════════════════════
  function PayablesTab() {
    const vendorBalances = useMemo(() => {
      const map = new Map<string, number>();
      billsData.filter(b => b.status !== 'Paid' && b.status !== 'Void').forEach(b => map.set(b.vendor, (map.get(b.vendor) || 0) + (b.total - b.amountPaid)));
      return Array.from(map.entries()).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
    }, []);
    const purchasesByVendor = useMemo(() => {
      const map = new Map<string, number>();
      billsData.forEach(b => map.set(b.vendor, (map.get(b.vendor) || 0) + b.total));
      return Array.from(map.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
    }, []);

    return (
      <div className="space-y-6">
        <ReportCard title="AP Aging Summary">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <GenBtn onClick={() => mark('apAging')} />
            <ExportBar onExcel={() => exportToExcel(Object.entries(apAging).map(([bucket, amt]) => ({ Bucket: bucket, Amount: amt })), 'AP_Aging')} />
          </div>
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50">
              {['Current', '1-30', '31-60', '61-90', '90+', 'Total'].map(h => <th key={h} className="text-right px-4 py-2 font-medium text-slate-600">{h}</th>)}
            </tr></thead>
            <tbody><tr>
              {Object.values(apAging).map((v, i) => <td key={i} className="px-4 py-2.5 text-right">{fmt(v)}</td>)}
              <td className="px-4 py-2.5 text-right font-bold text-slate-800">{fmt(Object.values(apAging).reduce((a, b) => a + b, 0))}</td>
            </tr></tbody>
          </table>
        </ReportCard>

        <ReportCard title="Vendor Balances">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <ExportBar onExcel={() => exportToExcel(vendorBalances.map(v => ({ Vendor: v.name, Outstanding: v.amount })), 'Vendor_Balances')} />
          </div>
          {vendorBalances.length > 0 ? (
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50"><th className="text-left px-4 py-2 font-medium text-slate-600">Vendor</th><th className="text-right px-4 py-2 font-medium text-slate-600">Outstanding</th></tr></thead>
              <tbody>
                {vendorBalances.map(v => (
                  <tr key={v.name} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 text-slate-700 flex items-center gap-2"><Building2 size={14} className="text-slate-400" /> {v.name}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-red-600">{fmt(v.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td className="px-4 py-2 font-semibold">Total</td>
                  <td className="px-4 py-2 text-right font-bold">{fmt(vendorBalances.reduce((s, v) => s + v.amount, 0))}</td>
                </tr>
              </tbody>
            </table>
          ) : <p className="text-sm text-slate-400">No outstanding payables</p>}
        </ReportCard>

        <ReportCard title="Purchases by Vendor">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <ExportBar onExcel={() => exportToExcel(purchasesByVendor.map(v => ({ Vendor: v.name, TotalPurchases: v.total })), 'Purchases_by_Vendor')} />
          </div>
          {purchasesByVendor.length > 0 ? (
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50"><th className="text-left px-4 py-2 font-medium text-slate-600">Vendor</th><th className="text-right px-4 py-2 font-medium text-slate-600">Total Purchases</th></tr></thead>
              <tbody>
                {purchasesByVendor.map(v => (
                  <tr key={v.name} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 text-slate-700">{v.name}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-700">{fmt(v.total)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td className="px-4 py-2 font-semibold">Grand Total</td>
                  <td className="px-4 py-2 text-right font-bold">{fmt(purchasesByVendor.reduce((s, v) => s + v.total, 0))}</td>
                </tr>
              </tbody>
            </table>
          ) : <p className="text-sm text-slate-400">No purchase data</p>}
        </ReportCard>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // TAX TAB
  // ══════════════════════════════════════════════════════════════════════════════
  function TaxTab() {
    return (
      <div className="space-y-6">
        <ReportCard title="VAT Summary">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <ExportBar onExcel={() => exportToExcel(vatData.map(v => ({ Period: v.month, OutputVAT: v.outputVAT, InputVAT: v.inputVAT, NetVAT: v.netVAT, Status: v.status })), 'VAT_Summary')} />
          </div>
          {vatData.length > 0 ? (
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50">
                <th className="text-left px-4 py-2 font-medium text-slate-600">Period</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">Output VAT</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">Input VAT</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">Net VAT</th>
                <th className="text-center px-4 py-2 font-medium text-slate-600">Status</th>
              </tr></thead>
              <tbody>
                {vatData.map((v, i) => (
                  <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 font-medium text-slate-700">{v.month}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{fmt(v.outputVAT)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{fmt(v.inputVAT)}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${v.netVAT >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmt(v.netVAT)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${v.status === 'Filed' ? 'bg-emerald-50 text-emerald-700' : v.status === 'Pending' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{v.status}</span>
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td className="px-4 py-2 font-semibold">Totals</td>
                  <td className="px-4 py-2 text-right font-bold">{fmt(vatData.reduce((s, v) => s + v.outputVAT, 0))}</td>
                  <td className="px-4 py-2 text-right font-bold">{fmt(vatData.reduce((s, v) => s + v.inputVAT, 0))}</td>
                  <td className="px-4 py-2 text-right font-bold">{fmt(vatData.reduce((s, v) => s + v.netVAT, 0))}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          ) : <p className="text-sm text-slate-400">No VAT records found</p>}
        </ReportCard>

        <ReportCard title="Tax Transactions">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <ExportBar onExcel={() => exportToExcel(
              [...invoicesData.filter(i => i.vat > 0).map(i => ({ Type: 'Output', Source: i.party, Date: i.date, Amount: i.vat })),
               ...billsData.filter(b => b.vat > 0).map(b => ({ Type: 'Input', Source: b.vendor, Date: b.date, Amount: b.vat }))],
              'Tax_Transactions'
            )} />
          </div>
          {(invoicesData.some(i => i.vat > 0) || billsData.some(b => b.vat > 0)) ? (
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50">
                <th className="text-left px-4 py-2 font-medium text-slate-600">Type</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Source</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Date</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">VAT Amount</th>
              </tr></thead>
              <tbody>
                {invoicesData.filter(i => i.vat > 0).map(i => (
                  <tr key={`inv-${i.id}`} className="border-t border-slate-50"><td className="px-4 py-2"><span className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs">Output</span></td><td className="px-4 py-2 text-slate-700">{i.party}</td><td className="px-4 py-2 text-slate-500">{i.date}</td><td className="px-4 py-2 text-right">{fmt(i.vat)}</td></tr>
                ))}
                {billsData.filter(b => b.vat > 0).map(b => (
                  <tr key={`bill-${b.id}`} className="border-t border-slate-50"><td className="px-4 py-2"><span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs">Input</span></td><td className="px-4 py-2 text-slate-700">{b.vendor}</td><td className="px-4 py-2 text-slate-500">{b.date}</td><td className="px-4 py-2 text-right">{fmt(b.vat)}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-sm text-slate-400">No tax transactions</p>}
        </ReportCard>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PROJECT TAB
  // ══════════════════════════════════════════════════════════════════════════════
  function ProjectTab() {
    const profitability = useMemo(() => {
      return projectsData.map(p => {
        const hours = timeData.filter(t => t.projectId === p.id).reduce((s, t) => s + t.durationMin, 0) / 60;
        const revenue = hours * p.hourlyRate;
        const cost = hours * (p.hourlyRate * 0.6);
        return { ...p, hours: Math.round(hours * 10) / 10, revenue, cost, profit: revenue - cost };
      });
    }, []);

    const timeSummary = useMemo(() => {
      const map = new Map<string, { user: string; totalMin: number; entries: number }>();
      timeData.forEach(t => {
        const e = map.get(t.user) || { user: t.user, totalMin: 0, entries: 0 };
        e.totalMin += t.durationMin; e.entries++; map.set(t.user, e);
      });
      return Array.from(map.values()).sort((a, b) => b.totalMin - a.totalMin);
    }, []);

    return (
      <div className="space-y-6">
        <ReportCard title="Project Profitability">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <ExportBar onExcel={() => exportToExcel(profitability.map(p => ({ Project: p.name, Client: p.client || '-', Hours: p.hours, Revenue: p.revenue, Cost: p.cost, Profit: p.profit })), 'Project_Profitability')} />
          </div>
          {profitability.length > 0 ? (
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50">
                <th className="text-left px-4 py-2 font-medium text-slate-600">Project</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Client</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">Hours</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">Revenue</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">Cost</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">Profit</th>
              </tr></thead>
              <tbody>
                {profitability.map(p => (
                  <tr key={p.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 font-medium text-slate-700">{p.name}</td>
                    <td className="px-4 py-2.5 text-slate-500">{p.client || '-'}</td>
                    <td className="px-4 py-2.5 text-right">{p.hours}h</td>
                    <td className="px-4 py-2.5 text-right text-emerald-600">{fmt(p.revenue)}</td>
                    <td className="px-4 py-2.5 text-right text-red-600">{fmt(p.cost)}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${p.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmt(p.profit)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td colSpan={2} className="px-4 py-2 font-semibold">Totals</td>
                  <td className="px-4 py-2 text-right font-bold">{profitability.reduce((s, p) => s + p.hours, 0).toFixed(1)}h</td>
                  <td className="px-4 py-2 text-right font-bold">{fmt(profitability.reduce((s, p) => s + p.revenue, 0))}</td>
                  <td className="px-4 py-2 text-right font-bold">{fmt(profitability.reduce((s, p) => s + p.cost, 0))}</td>
                  <td className="px-4 py-2 text-right font-bold">{fmt(profitability.reduce((s, p) => s + p.profit, 0))}</td>
                </tr>
              </tbody>
            </table>
          ) : <p className="text-sm text-slate-400">No projects found</p>}
        </ReportCard>

        <ReportCard title="Time Sheet Summary">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <ExportBar onExcel={() => exportToExcel(timeSummary.map(t => ({ User: t.user, TotalHours: (t.totalMin / 60).toFixed(1), Entries: t.entries })), 'Time_Summary')} />
          </div>
          {timeSummary.length > 0 ? (
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50">
                <th className="text-left px-4 py-2 font-medium text-slate-600">User</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">Total Hours</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">Entries</th>
              </tr></thead>
              <tbody>
                {timeSummary.map(t => (
                  <tr key={t.user} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 text-slate-700 flex items-center gap-2"><Clock size={14} className="text-slate-400" /> {t.user}</td>
                    <td className="px-4 py-2.5 text-right">{(t.totalMin / 60).toFixed(1)}h</td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{t.entries}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td className="px-4 py-2 font-semibold">Total</td>
                  <td className="px-4 py-2 text-right font-bold">{(timeSummary.reduce((s, t) => s + t.totalMin, 0) / 60).toFixed(1)}h</td>
                  <td className="px-4 py-2 text-right font-bold">{timeSummary.reduce((s, t) => s + t.entries, 0)}</td>
                </tr>
              </tbody>
            </table>
          ) : <p className="text-sm text-slate-400">No time entries</p>}
        </ReportCard>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // CUSTOM TAB
  // ══════════════════════════════════════════════════════════════════════════════
  function CustomTab() {
    const grouped = useMemo(() => {
      if (!customGroup) return { All: trialBalance };
      const map = new Map<string, TrialBalanceLine[]>();
      trialBalance.forEach(row => {
        const key = (row as any)[customGroup] || 'Other';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(row);
      });
      return Object.fromEntries(map);
    }, [customGroup, trialBalance]);

    const saveReport = () => {
      if (!reportName.trim()) return;
      const updated = [...savedReports, { name: reportName.trim(), cols: customCols, group: customGroup }];
      setSavedReports(updated);
      localStorage.setItem('saved_custom_reports', JSON.stringify(updated));
      setReportName('');
    };

    const loadReport = (r: { cols: string[]; group: string }) => {
      setCustomCols(r.cols);
      setCustomGroup(r.group);
    };

    const deleteReport = (idx: number) => {
      const updated = savedReports.filter((_, i) => i !== idx);
      setSavedReports(updated);
      localStorage.setItem('saved_custom_reports', JSON.stringify(updated));
    };

    return (
      <div className="space-y-6">
        <ReportCard title="Report Builder">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Select Columns</label>
              <div className="flex flex-wrap gap-2">
                {allCols.map(col => (
                  <label key={col} className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={customCols.includes(col)}
                      onChange={e => setCustomCols(e.target.checked ? [...customCols, col] : customCols.filter(c => c !== col))}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                    {col}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Group By</label>
              <select value={customGroup} onChange={e => setCustomGroup(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-full focus:ring-2 focus:ring-emerald-500">
                <option value="">No Grouping</option>
                <option value="accountType">Account Type</option>
                <option value="normalBalance">Normal Balance</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input type="text" placeholder="Report name..." value={reportName} onChange={e => setReportName(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500" />
            <button onClick={saveReport} className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
              <Save size={13} /> Save
            </button>
            <ExportBar onExcel={() => {
              const rows = trialBalance.map(r => {
                const obj: any = {};
                customCols.forEach(c => { obj[c] = (r as any)[c]; });
                return obj;
              });
              exportToExcel(rows, 'Custom_Report');
            }} />
          </div>

          {/* Saved reports */}
          {savedReports.length > 0 && (
            <div className="mb-4 p-3 bg-slate-50 rounded-lg">
              <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1"><FolderOpen size={12} /> Saved Reports</p>
              <div className="flex flex-wrap gap-2">
                {savedReports.map((r, i) => (
                  <div key={i} className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
                    <button onClick={() => loadReport(r)} className="text-emerald-700 font-medium hover:underline">{r.name}</button>
                    <button onClick={() => deleteReport(i)} className="text-red-400 hover:text-red-600 ml-1">&times;</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom table */}
          {Object.entries(grouped).map(([group, rows]) => (
            <div key={group} className="mb-4">
              {customGroup && <div className="bg-slate-100 px-4 py-2 rounded-t-lg text-sm font-semibold text-slate-700">{group}</div>}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50">
                    {customCols.map(c => <th key={c} className="text-left px-4 py-2 font-medium text-slate-600 text-xs">{c}</th>)}
                  </tr></thead>
                  <tbody>
                    {rows.map((r: any) => (
                      <tr key={r.accountId} className="border-t border-slate-50 hover:bg-slate-50/50">
                        {customCols.map(c => (
                          <td key={c} className="px-4 py-2 text-slate-700">
                            {typeof r[c] === 'number' ? r[c].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(r[c] ?? '-')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </ReportCard>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reports Center</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2 text-sm">
            Comprehensive financial & operational reporting
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
              <Database size={11} /> GL-sourced
            </span>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-1 flex flex-wrap gap-1">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
              }`}>
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {tab === 'financial' && <FinancialTab />}
      {tab === 'receivables' && <ReceivablesTab />}
      {tab === 'payables' && <PayablesTab />}
      {tab === 'tax' && <TaxTab />}
      {tab === 'project' && <ProjectTab />}
      {tab === 'custom' && <CustomTab />}
    </div>
  );
}
