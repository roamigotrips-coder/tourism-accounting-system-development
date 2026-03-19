import { useState } from 'react';
import {
  LayoutDashboard, ShoppingCart, Users, UserCheck, Truck, Package, Receipt,
  Building2, FileText, TrendingUp, CreditCard, Briefcase,
  BarChart3, Settings, DollarSign, Globe, ChevronLeft, ChevronRight,
  ShoppingBag, GitCompare, ChevronDown, ChevronUp, Book, FileSearch, Scale,
  RotateCcw, History, Box, Wrench, FileCheck, LayoutTemplate, Sliders, ShieldCheck, Cloud, Database, Lock,
  FileSignature, ClipboardList, CreditCard as CreditCardIcon, ReceiptText,
  Bell, UserCircle, Store, Wallet, Tag, Mail, CalendarCheck, Banknote, TruckIcon, Search
} from 'lucide-react';

export type Page =
   | 'dashboard' | 'sales' | 'purchases' | 'agents' | 'agentPortal' | 'suppliers'
   | 'supplierAuto' | 'expenses' | 'transport' | 'tourCosting' | 'vat' | 'chartOfAccounts'
   | 'generalLedger' | 'journalEntries' | 'trialBalance' | 'recurringBilling'
   | 'auditTrail' | 'inventory' | 'fixedAssets' | 'bankCash' | 'invoices'
   | 'bankReconciliation' | 'crm' | 'onlinePayments' | 'hr' | 'form-builder'
   | 'forecasting' | 'reports' | 'settings' | 'comparison' | 'multiCurrency' | 'documents'
   | 'projects' | 'retainers' | 'automation' | 'importWizard' | 'financeApprovalQueue' | 'bankFeeds'
   | 'matchingRules' | 'databaseSchema' | 'currencyRevaluation' | 'currencyTables' | 'currencyPosting'
   | 'recurringProfiles' | 'recurringInvoices' | 'approvalEngine' | 'financialReportBuilder'
   | 'transactionLocking'
   | 'quotes' | 'salesOrders' | 'creditNotes' | 'bills'
   | 'notifications' | 'customerPortal' | 'vendorPortal' | 'budgeting' | 'priceLists'
   | 'emailTemplates' | 'revenueRecognition' | 'payroll' | 'deliveryChallans' | 'globalSearch';

type MenuItem = { id: Page; label: string; icon: React.ElementType };
type Section = { label: string; accent: string; items: MenuItem[] };

const sections: Section[] = [
  {
    label: 'MAIN',
    accent: 'bg-slate-400',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'REVENUE',
    accent: 'bg-emerald-400',
    items: [
      { id: 'sales',        label: 'Sales & Booking',  icon: ShoppingCart },
      { id: 'quotes',       label: 'Quotes / Estimates', icon: FileSignature },
      { id: 'salesOrders',  label: 'Sales Orders',     icon: ClipboardList },
      { id: 'creditNotes',  label: 'Credit / Debit Notes', icon: CreditCardIcon },
      { id: 'deliveryChallans', label: 'Delivery Challans', icon: TruckIcon },
    ],
  },
  {
    label: 'OPERATIONS',
    accent: 'bg-orange-400',
    items: [
      { id: 'purchases',  label: 'Purchases',          icon: ShoppingBag },
      { id: 'bills',      label: 'Vendor Bills',       icon: ReceiptText },
      { id: 'expenses',   label: 'Expense Management', icon: DollarSign  },
    ],
  },
  {
    label: 'FINANCE',
    accent: 'bg-blue-400',
    items: [
      { id: 'financialReportBuilder', label: 'Report Builder',      icon: BarChart3   },
      { id: 'financeApprovalQueue',   label: 'Approval Queue',       icon: ShieldCheck },
      { id: 'chartOfAccounts',      label: 'Chart of Accounts',    icon: Book        },
      { id: 'generalLedger',        label: 'General Ledger',       icon: FileSearch  },
      { id: 'journalEntries',       label: 'Journal Entries',      icon: FileCheck   },
      { id: 'trialBalance',         label: 'Trial Balance',        icon: Scale       },
      { id: 'vat',                  label: 'VAT & Tax',            icon: Receipt     },
      { id: 'tourCosting',          label: 'Tour Package Costing', icon: Package     },
      { id: 'bankCash',             label: 'Bank & Cash',          icon: Building2   },
      { id: 'invoices',             label: 'Invoice System',       icon: FileText    },
      { id: 'bankReconciliation',   label: 'Bank Reconciliation',  icon: GitCompare  },
      { id: 'bankFeeds',            label: 'Bank Feeds',           icon: Cloud       },
      { id: 'matchingRules',        label: 'Auto-Matching Rules',  icon: Sliders     },
      { id: 'onlinePayments',       label: 'Online Payments',      icon: CreditCard  },
      { id: 'multiCurrency',        label: 'Multi-Currency',       icon: DollarSign  },
      { id: 'currencyRevaluation',  label: 'Currency Revaluation', icon: RotateCcw   },
      { id: 'currencyTables',       label: 'Currency Tables',      icon: Database    },
      { id: 'currencyPosting',      label: 'Currency Posting',     icon: DollarSign  },
      { id: 'approvalEngine',          label: 'Approval Engine',       icon: ShieldCheck },
      { id: 'transactionLocking',    label: 'Transaction Locking',  icon: Lock        },
      { id: 'revenueRecognition',    label: 'Revenue Recognition',  icon: CalendarCheck },
      { id: 'budgeting',            label: 'Budgeting',            icon: Wallet      },
    ],
  },
  {
    label: 'ACCOUNTING',
    accent: 'bg-cyan-400',
    items: [
      { id: 'recurringBilling',   label: 'Recurring Billing',     icon: RotateCcw },
      { id: 'recurringProfiles',  label: 'Recurring Profiles',    icon: RotateCcw },
      { id: 'recurringInvoices',  label: 'Recurring Invoices',    icon: FileText  },
      { id: 'retainers',          label: 'Retainers',             icon: Receipt   },
      { id: 'auditTrail',         label: 'Audit Trail',           icon: History   },
      { id: 'inventory',          label: 'Inventory',             icon: Box       },
      { id: 'fixedAssets',        label: 'Fixed Assets',          icon: Wrench    },
      { id: 'payroll',            label: 'Payroll',              icon: Banknote  },
      { id: 'priceLists',        label: 'Price Lists',          icon: Tag       },
    ],
  },
  {
    label: 'TOOLS',
    accent: 'bg-purple-400',
    items: [
      { id: 'agents',         label: 'Agent Management',    icon: Users          },
      { id: 'agentPortal',    label: 'Agent Portal',        icon: UserCheck      },
      { id: 'projects',       label: 'Projects & Time',     icon: Briefcase      },
      { id: 'documents',      label: 'Documents',           icon: FileText       },
      { id: 'suppliers',      label: 'Suppliers',           icon: Building2      },
      { id: 'supplierAuto',   label: 'Supplier Automation', icon: Settings       },
      { id: 'transport',      label: 'Transport',           icon: Truck          },
      { id: 'crm',            label: 'CRM Leads',           icon: Globe          },
      { id: 'hr',             label: 'HR Module',           icon: Briefcase      },
      { id: 'forecasting',    label: 'Forecasting',         icon: TrendingUp     },
      { id: 'reports',        label: 'Reports',             icon: BarChart3      },
      { id: 'settings',       label: 'Settings',            icon: Settings       },
      { id: 'form-builder',   label: 'Form Builder',        icon: LayoutTemplate },
      { id: 'comparison',     label: 'Compare & Roadmap',   icon: TrendingUp     },
      { id: 'automation',     label: 'Automation',          icon: Sliders        },
      { id: 'customerPortal',  label: 'Customer Portal',      icon: UserCircle     },
      { id: 'vendorPortal',    label: 'Vendor Portal',        icon: Store          },
      { id: 'emailTemplates',  label: 'Email Templates',      icon: Mail           },
      { id: 'notifications',   label: 'Notifications',        icon: Bell           },
      { id: 'globalSearch',    label: 'Global Search',        icon: Search         },
      { id: 'databaseSchema',  label: 'Database Schema',      icon: Database       },
    ],
  },
];

type SidebarProps = {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  collapsed: boolean;
  onToggle: () => void;
};

export default function Sidebar({ currentPage, onNavigate, collapsed, onToggle }: SidebarProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    Object.fromEntries(sections.map((s) => [s.label, true]))
  );

  const toggleSection = (label: string) => {
    if (collapsed) return;
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const handleToggle = () => {
    onToggle();
    if (collapsed) {
      setOpenSections(Object.fromEntries(sections.map((s) => [s.label, true])));
    }
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-full z-50 flex flex-col transition-all duration-300 ease-in-out select-none ${
        collapsed ? 'w-16' : 'w-60'
      }`}
      style={{
        background: 'linear-gradient(180deg, #0f172a 0%, #0d1526 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        overflowX: 'hidden',
      }}
    >
      {/* ── Logo ── */}
      <div
        className="flex items-center shrink-0 px-3 py-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', minHeight: '3.5rem' }}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 text-white"
          style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
        >
          TA
        </div>
        {!collapsed && (
          <div className="ml-2.5 overflow-hidden">
            <p className="text-sm font-bold text-white leading-tight truncate">AccountsPro</p>
            <p className="text-[10px] text-slate-500 truncate">Tourism Accounting</p>
          </div>
        )}
        <button
          onClick={handleToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`ml-auto p-1 rounded-md text-slate-500 hover:text-white hover:bg-white/10 transition-all duration-150 ${
            collapsed ? 'mx-auto' : ''
          }`}
          style={{ flexShrink: 0 }}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {/* ── Nav ── */}
      <nav
        className="flex-1 py-2 overflow-y-auto"
        style={{ overflowX: 'hidden' }}
      >
        {sections.map((section) => {
          const isOpen = openSections[section.label] ?? true;
          const hasActive = section.items.some((i) => i.id === currentPage);

          return (
            <div key={section.label} className="mb-0.5">
              {/* Section header */}
              {!collapsed ? (
                <button
                  onClick={() => toggleSection(section.label)}
                  className="w-full flex items-center justify-between px-3 pt-4 pb-1 group"
                  style={{ minHeight: 0 }}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full ${section.accent} transition-opacity ${
                        hasActive ? 'opacity-100' : 'opacity-40 group-hover:opacity-70'
                      }`}
                    />
                    <span
                      className={`text-[9.5px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                        hasActive ? 'text-slate-300' : 'text-slate-600 group-hover:text-slate-400'
                      }`}
                    >
                      {section.label}
                    </span>
                  </div>
                  {section.label !== 'MAIN' && (
                    <span className="text-slate-600 group-hover:text-slate-400 transition-colors">
                      {isOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </span>
                  )}
                </button>
              ) : (
                <div className="mx-3 mt-3 mb-1 h-px bg-white/[0.07]" />
              )}

              {/* Items */}
              {(isOpen || collapsed) && (
                <div>
                  {section.items.map((item) => {
                    const active = currentPage === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        title={collapsed ? item.label : undefined}
                        className={`w-full flex items-center text-sm transition-all duration-150 ${
                          collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2'
                        } ${
                          active
                            ? 'text-emerald-400'
                            : 'text-slate-400 hover:text-slate-100'
                        }`}
                        style={
                          active
                            ? {
                                background: 'rgba(16, 185, 129, 0.12)',
                                boxShadow: collapsed
                                  ? 'inset 2px 0 0 #10b981'
                                  : 'inset 3px 0 0 #10b981',
                              }
                            : {
                                background: 'transparent',
                              }
                        }
                        onMouseEnter={(e) => {
                          if (!active) {
                            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!active) {
                            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                          }
                        }}
                      >
                        <item.icon
                          size={15}
                          className={`shrink-0 transition-colors ${
                            active ? 'text-emerald-400' : 'text-slate-500'
                          }`}
                        />
                        {!collapsed && (
                          <span className="truncate text-[12.5px] font-medium leading-none">
                            {item.label}
                          </span>
                        )}
                        {active && !collapsed && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Footer ── */}
      {!collapsed && (
        <div
          className="shrink-0 px-3 py-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p className="text-[10px] text-slate-600 text-center">
            AccountsPro v1.0 · UAE Tourism
          </p>
        </div>
      )}
    </aside>
  );
}
