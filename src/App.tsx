import { useState, lazy, Suspense } from 'react';
import Sidebar, { Page } from './components/Sidebar';
import { PresetsProvider } from './context/PresetsContext';
import { BookingEstimateProvider } from './context/BookingEstimateContext';
import { AttachmentsProvider } from './context/AttachmentsContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { AutomationProvider } from './context/AutomationContext';
import { AccountingEngineProvider } from './context/AccountingEngine';
import { ApprovalProvider } from './context/ApprovalContext';
import { AuditTrailProvider } from './context/AuditTrailContext';
import { BankFeedProvider } from './context/BankFeedContext';

// ── Lazy-loaded pages (each becomes its own chunk) ────────────────────────────
const Dashboard          = lazy(() => import('./pages/Dashboard'));
const Sales              = lazy(() => import('./pages/Sales'));
const Purchases          = lazy(() => import('./pages/Purchases'));
const Agents             = lazy(() => import('./pages/Agents'));
const AgentPortal        = lazy(() => import('./pages/AgentPortal'));
const Suppliers          = lazy(() => import('./pages/Suppliers'));
const SupplierAuto       = lazy(() => import('./pages/SupplierAuto'));
const Expenses           = lazy(() => import('./pages/Expenses'));
const Transport          = lazy(() => import('./pages/Transport'));
const TourCosting        = lazy(() => import('./pages/TourCosting'));
const VATTax             = lazy(() => import('./pages/VATTax'));
const BankCash           = lazy(() => import('./pages/BankCash'));
const Invoices           = lazy(() => import('./pages/Invoices'));
const BankReconciliation = lazy(() => import('./pages/BankReconciliation'));
const CRMLeads           = lazy(() => import('./pages/CRMLeads'));
const OnlinePayments     = lazy(() => import('./pages/OnlinePayments'));
const HRModule           = lazy(() => import('./pages/HRModule'));
const Forecasting        = lazy(() => import('./pages/Forecasting'));
const Reports            = lazy(() => import('./pages/Reports'));
const Settings           = lazy(() => import('./pages/Settings'));
const FormBuilder        = lazy(() => import('./pages/FormBuilder'));
const ChartOfAccounts    = lazy(() => import('./pages/ChartOfAccounts'));
const GeneralLedger      = lazy(() => import('./pages/GeneralLedger'));
const JournalEntries     = lazy(() => import('./pages/JournalEntries'));
const TrialBalance       = lazy(() => import('./pages/TrialBalance'));
const RecurringBilling   = lazy(() => import('./pages/RecurringBilling'));
const AuditTrail         = lazy(() => import('./pages/AuditTrail'));
const Inventory          = lazy(() => import('./pages/Inventory'));
const FixedAssets        = lazy(() => import('./pages/FixedAssets'));
const Comparison         = lazy(() => import('./pages/Comparison'));
const MultiCurrency      = lazy(() => import('./pages/MultiCurrency'));
const CurrencyRevaluation= lazy(() => import('./pages/CurrencyRevaluation'));
const Documents          = lazy(() => import('./pages/Documents'));
const Projects           = lazy(() => import('./pages/Projects'));
const Retainers          = lazy(() => import('./pages/Retainers'));
const Automation         = lazy(() => import('./pages/Automation'));
const ImportWizard       = lazy(() => import('./pages/ImportWizard'));
const FinanceApprovalQueue = lazy(() => import('./pages/FinanceApprovalQueue'));
const BankFeeds          = lazy(() => import('./pages/BankFeeds'));
const MatchingRules      = lazy(() => import('./pages/MatchingRules'));
const DatabaseSchema     = lazy(() => import('./pages/DatabaseSchema'));
const CurrencyTables     = lazy(() => import('./pages/CurrencyTables'));
const CurrencyPosting    = lazy(() => import('./pages/CurrencyPosting'));
const RecurringProfiles  = lazy(() => import('./pages/RecurringProfiles'));
const RecurringInvoices  = lazy(() => import('./pages/RecurringInvoices'));
const ApprovalEngine            = lazy(() => import('./pages/ApprovalEngine'));
const FinancialReportBuilder    = lazy(() => import('./pages/FinancialReportBuilder'));
const TransactionLocking        = lazy(() => import('./pages/TransactionLocking'));

// ── Page loader fallback ───────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400 font-medium">Loading...</p>
      </div>
    </div>
  );
}

export function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':            return <Dashboard />;
      case 'sales':                return <Sales />;
      case 'purchases':            return <Purchases />;
      case 'agents':               return <Agents />;
      case 'agentPortal':          return <AgentPortal />;
      case 'suppliers':            return <Suppliers />;
      case 'supplierAuto':         return <SupplierAuto />;
      case 'expenses':             return <Expenses />;
      case 'transport':            return <Transport />;
      case 'tourCosting':          return <TourCosting />;
      case 'vat':                  return <VATTax />;
      case 'chartOfAccounts':      return <ChartOfAccounts />;
      case 'generalLedger':        return <GeneralLedger />;
      case 'journalEntries':       return <JournalEntries />;
      case 'trialBalance':         return <TrialBalance />;
      case 'bankCash':             return <BankCash />;
      case 'invoices':             return <Invoices />;
      case 'bankReconciliation':   return <BankReconciliation />;
      case 'crm':                  return <CRMLeads />;
      case 'onlinePayments':       return <OnlinePayments />;
      case 'hr':                   return <HRModule />;
      case 'forecasting':          return <Forecasting />;
      case 'reports':              return <Reports />;
      case 'settings':             return <Settings />;
      case 'form-builder':         return <FormBuilder />;
      case 'recurringBilling':     return <RecurringBilling />;
      case 'auditTrail':           return <AuditTrail />;
      case 'inventory':            return <Inventory />;
      case 'fixedAssets':          return <FixedAssets />;
      case 'comparison':           return <Comparison />;
      case 'multiCurrency':        return <MultiCurrency />;
      case 'currencyRevaluation':  return <CurrencyRevaluation />;
      case 'documents':            return <Documents />;
      case 'projects':             return <Projects />;
      case 'retainers':            return <Retainers />;
      case 'automation':           return <Automation />;
      case 'importWizard':         return <ImportWizard />;
      case 'financeApprovalQueue': return <FinanceApprovalQueue />;
      case 'bankFeeds':            return <BankFeeds />;
      case 'matchingRules':        return <MatchingRules />;
      case 'databaseSchema':       return <DatabaseSchema />;
      case 'currencyTables':       return <CurrencyTables />;
      case 'currencyPosting':      return <CurrencyPosting />;
      case 'recurringProfiles':    return <RecurringProfiles />;
      case 'recurringInvoices':    return <RecurringInvoices />;
      case 'approvalEngine':          return <ApprovalEngine />;
      case 'financialReportBuilder':  return <FinancialReportBuilder />;
      case 'transactionLocking':      return <TransactionLocking />;
      default:                        return <Dashboard />;
    }
  };

  return (
    <AuditTrailProvider>
    <BankFeedProvider>
    <AccountingEngineProvider>
    <ApprovalProvider>
    <PresetsProvider>
    <BookingEstimateProvider>
    <CurrencyProvider>
    <AutomationProvider>
    <AttachmentsProvider>
      <div className="min-h-screen" style={{ background: '#f1f5f9' }}>
        <Sidebar
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <main
          className="transition-all duration-300 ease-in-out min-h-screen"
          style={{ marginLeft: sidebarCollapsed ? '4rem' : '15rem' }}
        >
          {/* ── Top Header ── */}
          <header
            className="sticky top-0 z-40 flex items-center px-5 gap-4"
            style={{
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderBottom: '1px solid rgba(226,232,240,0.8)',
              height: '3.5rem',
              boxShadow: '0 1px 0 0 rgba(0,0,0,0.04)',
            }}
          >
            {/* Page context */}
            <div className="flex items-center gap-2 mr-auto">
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
              >
                TA
              </div>
              <span className="hidden sm:block text-[11px] font-medium text-slate-400 uppercase tracking-widest">
                Tourism Accounting
              </span>
            </div>

            {/* Search */}
            <div className="relative hidden md:flex items-center">
              <svg
                className="absolute left-3 w-3.5 h-3.5 text-slate-400 pointer-events-none"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search..."
                className="pl-8 pr-10 py-1.5 text-sm text-slate-700 placeholder-slate-400 rounded-lg border"
                style={{
                  width: '13rem',
                  background: '#f8fafc',
                  borderColor: '#e2e8f0',
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#10b981';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.12)';
                  e.currentTarget.style.width = '17rem';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.width = '13rem';
                }}
              />
              <span
                className="absolute right-2.5 text-[10px] font-medium text-slate-400 px-1 py-0.5 rounded"
                style={{ background: '#f1f5f9', border: '1px solid #e2e8f0' }}
              >
                ⌘K
              </span>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-1.5">
              {/* Notifications */}
              <button
                aria-label="Notifications"
                className="relative flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all duration-150"
              >
                <svg className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span
                  className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500"
                  style={{ boxShadow: '0 0 0 2px white' }}
                />
              </button>

              {/* Divider */}
              <div className="w-px h-5 bg-slate-200 mx-1" />

              {/* User */}
              <button
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-slate-100 transition-all duration-150"
                aria-label="User menu"
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[11px] shrink-0"
                  style={{ background: 'linear-gradient(135deg, #10b981, #0d9488)' }}
                >
                  AD
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-slate-700 leading-tight">Admin User</p>
                  <p className="text-[10px] text-slate-400">admin@accountspro.ae</p>
                </div>
              </button>
            </div>
          </header>

          {/* ── Page Content ── */}
          <div className="p-6 animate-fade-in">
            <Suspense fallback={<PageLoader />}>
              {renderPage()}
            </Suspense>
          </div>
        </main>
      </div>
    </AttachmentsProvider>
    </AutomationProvider>
    </CurrencyProvider>
    </BookingEstimateProvider>
    </PresetsProvider>
    </ApprovalProvider>
    </AccountingEngineProvider>
    </BankFeedProvider>
    </AuditTrailProvider>
  );
}
