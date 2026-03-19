import { ChevronRight, Home } from 'lucide-react';
import { Page } from './Sidebar';

const PAGE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard', sales: 'Sales', purchases: 'Purchases', agents: 'Agents',
  agentPortal: 'Agent Portal', suppliers: 'Suppliers', supplierAuto: 'Supplier Auto',
  expenses: 'Expenses', transport: 'Transport', tourCosting: 'Tour Costing',
  vat: 'VAT & Tax', chartOfAccounts: 'Chart of Accounts', generalLedger: 'General Ledger',
  journalEntries: 'Journal Entries', trialBalance: 'Trial Balance', bankCash: 'Bank & Cash',
  invoices: 'Invoices', bankReconciliation: 'Bank Reconciliation', crm: 'CRM & Leads',
  onlinePayments: 'Online Payments', hr: 'HR Module', forecasting: 'Forecasting',
  reports: 'Reports', settings: 'Settings', 'form-builder': 'Form Builder',
  recurringBilling: 'Recurring Billing', auditTrail: 'Audit Trail', inventory: 'Inventory',
  fixedAssets: 'Fixed Assets', comparison: 'Comparison', multiCurrency: 'Multi-Currency',
  currencyRevaluation: 'Currency Revaluation', documents: 'Documents', projects: 'Projects',
  retainers: 'Retainers', automation: 'Automation', importWizard: 'Import Wizard',
  financeApprovalQueue: 'Approval Queue', bankFeeds: 'Bank Feeds', matchingRules: 'Matching Rules',
  databaseSchema: 'Database Schema', currencyTables: 'Currency Tables', currencyPosting: 'Currency Posting',
  recurringProfiles: 'Recurring Profiles', recurringInvoices: 'Recurring Invoices',
  approvalEngine: 'Approval Engine', financialReportBuilder: 'Report Builder',
  transactionLocking: 'Transaction Locking', quotes: 'Quotes', salesOrders: 'Sales Orders',
  creditNotes: 'Credit Notes', bills: 'Bills', notifications: 'Notifications',
  customerPortal: 'Customer Portal', vendorPortal: 'Vendor Portal', budgeting: 'Budgeting',
  priceLists: 'Price Lists', emailTemplates: 'Email Templates',
  revenueRecognition: 'Revenue Recognition', payroll: 'Payroll',
  deliveryChallans: 'Delivery Challans', globalSearch: 'Global Search',
};

const PAGE_SECTIONS: Record<string, string> = {
  sales: 'Revenue', invoices: 'Revenue', quotes: 'Revenue', salesOrders: 'Revenue',
  creditNotes: 'Revenue', deliveryChallans: 'Revenue', onlinePayments: 'Revenue',
  recurringBilling: 'Revenue', recurringInvoices: 'Revenue', recurringProfiles: 'Revenue',
  purchases: 'Operations', suppliers: 'Operations', supplierAuto: 'Operations',
  expenses: 'Operations', bills: 'Operations', transport: 'Operations', tourCosting: 'Operations',
  agents: 'Operations', agentPortal: 'Operations', inventory: 'Operations',
  chartOfAccounts: 'Accounting', generalLedger: 'Accounting', journalEntries: 'Accounting',
  trialBalance: 'Accounting', bankCash: 'Accounting', bankReconciliation: 'Accounting',
  bankFeeds: 'Accounting', matchingRules: 'Accounting', fixedAssets: 'Accounting',
  multiCurrency: 'Accounting', currencyRevaluation: 'Accounting', currencyTables: 'Accounting',
  currencyPosting: 'Accounting', payroll: 'Accounting', priceLists: 'Accounting',
  vat: 'Finance', budgeting: 'Finance', revenueRecognition: 'Finance',
  forecasting: 'Finance', retainers: 'Finance', projects: 'Finance',
  transactionLocking: 'Finance', financeApprovalQueue: 'Finance', approvalEngine: 'Finance',
  reports: 'Reports', financialReportBuilder: 'Reports', comparison: 'Reports',
  crm: 'Tools', hr: 'Tools', automation: 'Tools', documents: 'Tools',
  importWizard: 'Tools', 'form-builder': 'Tools', auditTrail: 'Tools',
  customerPortal: 'Tools', vendorPortal: 'Tools', emailTemplates: 'Tools',
  notifications: 'Tools', globalSearch: 'Tools', settings: 'Tools', databaseSchema: 'Tools',
};

interface BreadcrumbsProps { currentPage: Page; onNavigate: (page: Page) => void; }

export default function Breadcrumbs({ currentPage, onNavigate }: BreadcrumbsProps) {
  if (currentPage === 'dashboard') return null;

  const section = PAGE_SECTIONS[currentPage] || 'Other';
  const label = PAGE_LABELS[currentPage] || currentPage;

  return (
    <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-4">
      <button onClick={() => onNavigate('dashboard')} className="flex items-center gap-1 hover:text-emerald-600 transition-colors">
        <Home size={12} /> Dashboard
      </button>
      <ChevronRight size={11} className="text-slate-300" />
      <span className="text-slate-400">{section}</span>
      <ChevronRight size={11} className="text-slate-300" />
      <span className="text-slate-600 font-medium">{label}</span>
    </nav>
  );
}
