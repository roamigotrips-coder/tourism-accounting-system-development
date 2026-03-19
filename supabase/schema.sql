-- ============================================================
-- AccountsPro — Tourism Accounting System
-- COMPREHENSIVE SCHEMA: All modules backed by Supabase
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ── Drop existing tables (order matters for foreign keys) ────
DROP TABLE IF EXISTS activity_timeline CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS delivery_challans CASCADE;
DROP TABLE IF EXISTS payroll_slips CASCADE;
DROP TABLE IF EXISTS payroll_runs CASCADE;
DROP TABLE IF EXISTS revenue_schedule_entries CASCADE;
DROP TABLE IF EXISTS revenue_schedules CASCADE;
DROP TABLE IF EXISTS expense_policies CASCADE;
DROP TABLE IF EXISTS mileage_entries CASCADE;
DROP TABLE IF EXISTS invoice_payments CASCADE;
DROP TABLE IF EXISTS email_log CASCADE;
DROP TABLE IF EXISTS email_templates CASCADE;
DROP TABLE IF EXISTS invoice_templates CASCADE;
DROP TABLE IF EXISTS composite_item_components CASCADE;
DROP TABLE IF EXISTS composite_items CASCADE;
DROP TABLE IF EXISTS price_list_items CASCADE;
DROP TABLE IF EXISTS price_lists CASCADE;
DROP TABLE IF EXISTS budget_lines CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS portal_messages CASCADE;
DROP TABLE IF EXISTS portal_users CASCADE;
DROP TABLE IF EXISTS payment_reminders CASCADE;
DROP TABLE IF EXISTS transaction_tags CASCADE;
DROP TABLE IF EXISTS report_tags CASCADE;
DROP TABLE IF EXISTS saved_reports CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS bill_items CASCADE;
DROP TABLE IF EXISTS bills CASCADE;
DROP TABLE IF EXISTS credit_note_items CASCADE;
DROP TABLE IF EXISTS credit_notes CASCADE;
DROP TABLE IF EXISTS sales_order_items CASCADE;
DROP TABLE IF EXISTS sales_orders CASCADE;
DROP TABLE IF EXISTS quote_items CASCADE;
DROP TABLE IF EXISTS quotes CASCADE;
DROP TABLE IF EXISTS supplier_pending_invoices CASCADE;
DROP TABLE IF EXISTS supplier_automation_rules CASCADE;
DROP TABLE IF EXISTS currency_posting_docs CASCADE;
DROP TABLE IF EXISTS fixed_assets CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;
DROP TABLE IF EXISTS recurring_invoices CASCADE;
DROP TABLE IF EXISTS recurring_profiles CASCADE;
DROP TABLE IF EXISTS recurring_billing CASCADE;
DROP TABLE IF EXISTS purchase_order_items CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS retainers CASCADE;
DROP TABLE IF EXISTS time_entries CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS payments_register CASCADE;
DROP TABLE IF EXISTS bank_cash_accounts CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS vat_records CASCADE;
DROP TABLE IF EXISTS tour_packages CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS agents CASCADE;
DROP TABLE IF EXISTS automation_logs CASCADE;
DROP TABLE IF EXISTS workflows CASCADE;
DROP TABLE IF EXISTS attachment_notes CASCADE;
DROP TABLE IF EXISTS attachments CASCADE;
DROP TABLE IF EXISTS email_routes CASCADE;
DROP TABLE IF EXISTS form_configurations CASCADE;
DROP TABLE IF EXISTS role_presets CASCADE;
DROP TABLE IF EXISTS currency_rates CASCADE;
DROP TABLE IF EXISTS currencies CASCADE;
DROP TABLE IF EXISTS rec_matches CASCADE;
DROP TABLE IF EXISTS book_transactions CASCADE;
DROP TABLE IF EXISTS feed_transactions CASCADE;
DROP TABLE IF EXISTS bank_connections CASCADE;
DROP TABLE IF EXISTS sync_logs CASCADE;
DROP TABLE IF EXISTS webhook_events CASCADE;
DROP TABLE IF EXISTS feed_schedules CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS approval_history CASCADE;
DROP TABLE IF EXISTS approval_items CASCADE;
DROP TABLE IF EXISTS approval_rules CASCADE;
DROP TABLE IF EXISTS journal_entry_lines CASCADE;
DROP TABLE IF EXISTS journal_entries CASCADE;
DROP TABLE IF EXISTS booking_estimates CASCADE;
DROP TABLE IF EXISTS accounting_periods CASCADE;
DROP TABLE IF EXISTS transaction_lock CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS app_settings CASCADE;

-- ══════════════════════════════════════════════════════════════
-- 1. ACCOUNTING CORE
-- ══════════════════════════════════════════════════════════════

CREATE TABLE accounts (
  id                   TEXT PRIMARY KEY,
  code                 TEXT NOT NULL,
  name                 TEXT NOT NULL,
  type                 TEXT NOT NULL CHECK (type IN ('Asset','Liability','Equity','Revenue','Expense')),
  normal_balance       TEXT NOT NULL CHECK (normal_balance IN ('Debit','Credit')),
  parent_id            TEXT,
  description          TEXT,
  status               TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  is_default           BOOLEAN NOT NULL DEFAULT false,
  opening_balance      NUMERIC NOT NULL DEFAULT 0,
  opening_balance_type TEXT NOT NULL CHECK (opening_balance_type IN ('Debit','Credit')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE journal_entries (
  id               TEXT PRIMARY KEY,
  entry_number     TEXT NOT NULL,
  date             DATE NOT NULL,
  period           TEXT NOT NULL,
  description      TEXT NOT NULL,
  reference        TEXT NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('Draft','Pending Approval','Approved','Posted','Rejected','Reversed')),
  total_debit      NUMERIC NOT NULL DEFAULT 0,
  total_credit     NUMERIC NOT NULL DEFAULT 0,
  is_balanced      BOOLEAN NOT NULL DEFAULT false,
  created_by       TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at     TIMESTAMPTZ,
  approved_by      TEXT,
  approved_at      TIMESTAMPTZ,
  posted_at        TIMESTAMPTZ,
  rejected_by      TEXT,
  rejected_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  reversal_of      TEXT,
  reversed_by      TEXT,
  source           TEXT NOT NULL DEFAULT 'Manual'
    CHECK (source IN ('Manual','Invoice','Payment','FXRevaluation','Recurring','System'))
);

CREATE TABLE journal_entry_lines (
  id                TEXT PRIMARY KEY,
  journal_entry_id  TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id        TEXT NOT NULL,
  account_code      TEXT NOT NULL,
  account_name      TEXT NOT NULL,
  account_type      TEXT NOT NULL,
  description       TEXT NOT NULL,
  debit             NUMERIC NOT NULL DEFAULT 0,
  credit            NUMERIC NOT NULL DEFAULT 0,
  reference         TEXT
);

CREATE TABLE accounting_periods (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  period     TEXT NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  status     TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Closed','Locked')),
  closed_by  TEXT,
  closed_at  TIMESTAMPTZ
);

CREATE TABLE booking_estimates (
  id               TEXT PRIMARY KEY,
  booking_ref      TEXT NOT NULL,
  agent            TEXT NOT NULL,
  customer         TEXT NOT NULL,
  service_type     TEXT NOT NULL,
  service_date     TEXT NOT NULL,
  check_in         TEXT,
  check_out        TEXT,
  selling_price    NUMERIC NOT NULL,
  vat              NUMERIC NOT NULL DEFAULT 0,
  total            NUMERIC NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'AED',
  payment_status   TEXT NOT NULL DEFAULT 'Pending',
  payment_received NUMERIC,
  payment_made     NUMERIC,
  notes            TEXT,
  submitted_at     TEXT NOT NULL,
  submitted_by     TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'Pending Approval',
  is_tour_package  BOOLEAN DEFAULT false,
  approved_by      TEXT,
  approved_at      TEXT,
  rejected_by      TEXT,
  rejected_at      TEXT,
  rejection_reason TEXT,
  invoice_id       TEXT,
  costing          JSONB
);

CREATE TABLE transaction_lock (
  id            INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  lock_date     TEXT NOT NULL,
  locked_by     TEXT NOT NULL,
  locked_at     TEXT NOT NULL,
  has_password  BOOLEAN NOT NULL DEFAULT false,
  password_hash TEXT
);

-- ══════════════════════════════════════════════════════════════
-- 2. APPROVAL WORKFLOW
-- ══════════════════════════════════════════════════════════════

CREATE TABLE approval_items (
  id                TEXT PRIMARY KEY,
  ref_number        TEXT NOT NULL,
  type              TEXT NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  amount            NUMERIC NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'AED',
  vat_amount        NUMERIC NOT NULL DEFAULT 0,
  total_amount      NUMERIC NOT NULL DEFAULT 0,
  submitted_by      TEXT NOT NULL,
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_by_dept TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'Draft',
  priority          TEXT NOT NULL DEFAULT 'Normal',
  due_date          TEXT,
  party             TEXT NOT NULL DEFAULT '',
  party_type        TEXT NOT NULL DEFAULT '',
  category          TEXT,
  notes             TEXT,
  gl_posted         BOOLEAN NOT NULL DEFAULT false,
  gl_entry_ref      TEXT,
  correction_note   TEXT,
  rejection_reason  TEXT,
  tags              JSONB NOT NULL DEFAULT '[]',
  source_data       JSONB,
  manager_role      TEXT NOT NULL DEFAULT '',
  manager_label     TEXT NOT NULL DEFAULT '',
  finance_role      TEXT NOT NULL DEFAULT '',
  finance_label     TEXT NOT NULL DEFAULT '',
  requires_cfo      BOOLEAN NOT NULL DEFAULT false,
  stage_history     JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE approval_history (
  id              TEXT PRIMARY KEY,
  item_id         TEXT NOT NULL REFERENCES approval_items(id) ON DELETE CASCADE,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action          TEXT NOT NULL,
  performed_by    TEXT NOT NULL,
  from_status     TEXT NOT NULL,
  to_status       TEXT NOT NULL,
  notes           TEXT,
  stage           TEXT
);

CREATE TABLE approval_rules (
  id                       TEXT PRIMARY KEY,
  name                     TEXT NOT NULL,
  item_type                TEXT NOT NULL DEFAULT 'All',
  amount_threshold         NUMERIC NOT NULL DEFAULT 0,
  approver                 TEXT NOT NULL,
  is_active                BOOLEAN NOT NULL DEFAULT true,
  requires_second_approval BOOLEAN NOT NULL DEFAULT false,
  second_approver          TEXT,
  created_at               TEXT NOT NULL
);

-- ══════════════════════════════════════════════════════════════
-- 3. AUDIT TRAIL
-- ══════════════════════════════════════════════════════════════

CREATE TABLE audit_logs (
  id            TEXT PRIMARY KEY,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id       TEXT NOT NULL,
  user_name     TEXT NOT NULL,
  user_role     TEXT NOT NULL DEFAULT '',
  action        TEXT NOT NULL,
  module        TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  entity_type   TEXT NOT NULL,
  entity_label  TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  old_values    JSONB,
  new_values    JSONB,
  diffs         JSONB,
  ip_address    TEXT NOT NULL DEFAULT '',
  session_id    TEXT NOT NULL DEFAULT '',
  tags          JSONB NOT NULL DEFAULT '[]',
  severity      TEXT NOT NULL DEFAULT 'info',
  is_reversible BOOLEAN NOT NULL DEFAULT false,
  metadata      JSONB
);

-- ══════════════════════════════════════════════════════════════
-- 4. BANK FEEDS & RECONCILIATION
-- ══════════════════════════════════════════════════════════════

CREATE TABLE bank_connections (
  id                TEXT PRIMARY KEY,
  provider_id       TEXT NOT NULL,
  provider_name     TEXT NOT NULL,
  account_name      TEXT NOT NULL,
  account_number    TEXT NOT NULL,
  account_type      TEXT NOT NULL DEFAULT 'current',
  currency          TEXT NOT NULL DEFAULT 'AED',
  balance           NUMERIC NOT NULL DEFAULT 0,
  available_balance NUMERIC NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'connected',
  last_sync         TIMESTAMPTZ,
  next_sync         TIMESTAMPTZ,
  sync_frequency    TEXT NOT NULL DEFAULT 'daily',
  auto_match        BOOLEAN NOT NULL DEFAULT true,
  auto_post         BOOLEAN NOT NULL DEFAULT false,
  total_imported    INTEGER NOT NULL DEFAULT 0,
  total_matched     INTEGER NOT NULL DEFAULT 0,
  connected_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consent_expiry    TIMESTAMPTZ,
  error_message     TEXT
);

CREATE TABLE feed_transactions (
  id                TEXT PRIMARY KEY,
  feed_id           TEXT,
  connection_id     TEXT NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
  provider_ref      TEXT,
  date              TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  reference         TEXT,
  debit             NUMERIC NOT NULL DEFAULT 0,
  credit            NUMERIC NOT NULL DEFAULT 0,
  balance           NUMERIC NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'Unmatched',
  matched_with      TEXT,
  source            TEXT NOT NULL DEFAULT 'Feed',
  bank              TEXT,
  raw_data          JSONB DEFAULT '{}',
  enriched          BOOLEAN DEFAULT false,
  category          TEXT,
  merchant_name     TEXT,
  merchant_category TEXT,
  pending           BOOLEAN DEFAULT false,
  reversed          BOOLEAN DEFAULT false
);

CREATE TABLE book_transactions (
  id           TEXT PRIMARY KEY,
  date         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  reference    TEXT,
  amount       NUMERIC NOT NULL DEFAULT 0,
  type         TEXT NOT NULL DEFAULT 'Debit',
  status       TEXT NOT NULL DEFAULT 'Unmatched',
  matched_with TEXT,
  source       TEXT,
  category     TEXT
);

CREATE TABLE rec_matches (
  id          TEXT PRIMARY KEY,
  bank_tx_id  TEXT NOT NULL,
  book_tx_id  TEXT NOT NULL,
  matched_by  TEXT NOT NULL DEFAULT 'Auto',
  matched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  difference  NUMERIC NOT NULL DEFAULT 0,
  method      TEXT NOT NULL DEFAULT 'Auto',
  confidence  TEXT NOT NULL DEFAULT 'Medium',
  score       INTEGER NOT NULL DEFAULT 0,
  reasons     JSONB NOT NULL DEFAULT '[]',
  note        TEXT
);

CREATE TABLE sync_logs (
  id               TEXT PRIMARY KEY,
  connection_id    TEXT NOT NULL,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'success',
  new_transactions INTEGER NOT NULL DEFAULT 0,
  auto_matched     INTEGER NOT NULL DEFAULT 0,
  errors           JSONB DEFAULT '[]',
  provider         TEXT
);

CREATE TABLE feed_schedules (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  connection_id TEXT NOT NULL UNIQUE,
  frequency     TEXT NOT NULL DEFAULT 'daily',
  last_run      TEXT,
  next_run      TEXT,
  enabled       BOOLEAN NOT NULL DEFAULT true,
  retry_count   INTEGER NOT NULL DEFAULT 0,
  max_retries   INTEGER NOT NULL DEFAULT 3
);

CREATE TABLE webhook_events (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed     BOOLEAN NOT NULL DEFAULT false
);

-- ══════════════════════════════════════════════════════════════
-- 5. MULTI-CURRENCY
-- ══════════════════════════════════════════════════════════════

CREATE TABLE currencies (
  code    TEXT PRIMARY KEY,
  symbol  TEXT NOT NULL,
  name    TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE currency_rates (
  code   TEXT PRIMARY KEY,
  rate   NUMERIC NOT NULL DEFAULT 1,
  date   TEXT NOT NULL,
  source TEXT DEFAULT 'Manual'
);

-- ══════════════════════════════════════════════════════════════
-- 6. AUTOMATION (Workflows)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE workflows (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  trigger     TEXT NOT NULL,
  conditions  JSONB NOT NULL DEFAULT '[]',
  actions     JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE automation_logs (
  id      TEXT PRIMARY KEY,
  time    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message TEXT NOT NULL DEFAULT ''
);

-- ══════════════════════════════════════════════════════════════
-- 7. ATTACHMENTS & DOCUMENTS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE attachments (
  id          TEXT PRIMARY KEY,
  file_name   TEXT NOT NULL,
  mime_type   TEXT NOT NULL,
  size        INTEGER NOT NULL DEFAULT 0,
  data_url    TEXT,
  ocr_text    TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'upload',
  module      TEXT NOT NULL,
  document_id TEXT NOT NULL,
  tags        JSONB NOT NULL DEFAULT '[]',
  version     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE attachment_notes (
  id            TEXT PRIMARY KEY,
  attachment_id TEXT NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  text          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    TEXT NOT NULL
);

CREATE TABLE email_routes (
  id        TEXT PRIMARY KEY,
  address   TEXT NOT NULL,
  name      TEXT NOT NULL,
  route_to  TEXT NOT NULL,
  auto_link BOOLEAN NOT NULL DEFAULT true,
  enabled   BOOLEAN NOT NULL DEFAULT true
);

-- ══════════════════════════════════════════════════════════════
-- 8. ROLE PRESETS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE role_presets (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  emoji       TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  color       TEXT NOT NULL DEFAULT 'slate',
  permissions JSONB NOT NULL DEFAULT '{}',
  is_system   BOOLEAN NOT NULL DEFAULT false
);

-- ══════════════════════════════════════════════════════════════
-- 9. FORM BUILDER
-- ══════════════════════════════════════════════════════════════

CREATE TABLE form_configurations (
  form_id          TEXT PRIMARY KEY,
  form_name        TEXT NOT NULL,
  form_description TEXT,
  module           TEXT NOT NULL,
  fields           JSONB NOT NULL DEFAULT '[]'
);

-- ══════════════════════════════════════════════════════════════
-- 10. APP SETTINGS (key-value store)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ══════════════════════════════════════════════════════════════
-- 11. ADDITIONAL ENTITIES (Agents, Suppliers, Invoices, etc.)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  credit_limit NUMERIC NOT NULL DEFAULT 0,
  outstanding NUMERIC NOT NULL DEFAULT 0,
  payment_terms TEXT NOT NULL DEFAULT 'Net 30',
  commission NUMERIC NOT NULL DEFAULT 0,
  total_bookings INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT ''
);

CREATE TABLE suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  total_payable NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive'))
);

CREATE TABLE expenses (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL DEFAULT '',
  supplier TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_mode TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Paid','Pending'))
);

CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'Customer' CHECK (type IN ('Agent','Customer','Supplier')),
  party TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  vat NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'AED',
  date TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (status IN ('Paid','Unpaid','Overdue'))
);

CREATE TABLE vehicles (
  id TEXT PRIMARY KEY,
  plate TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT '',
  driver TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Available','On Trip','Maintenance')),
  fuel_cost NUMERIC NOT NULL DEFAULT 0,
  trips INTEGER NOT NULL DEFAULT 0,
  revenue NUMERIC NOT NULL DEFAULT 0
);

CREATE TABLE tour_packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  price NUMERIC NOT NULL DEFAULT 0,
  hotel_cost NUMERIC NOT NULL DEFAULT 0,
  transfer_cost NUMERIC NOT NULL DEFAULT 0,
  tickets_cost NUMERIC NOT NULL DEFAULT 0,
  guide_cost NUMERIC NOT NULL DEFAULT 0,
  other_cost NUMERIC NOT NULL DEFAULT 0,
  profit NUMERIC NOT NULL DEFAULT 0,
  bookings INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE vat_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  month TEXT NOT NULL,
  output_vat NUMERIC NOT NULL DEFAULT 0,
  input_vat NUMERIC NOT NULL DEFAULT 0,
  net_vat NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Filed','Pending','Due'))
);

CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  service TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New','Contacted','Quoted','Converted','Lost')),
  value NUMERIC NOT NULL DEFAULT 0,
  date TEXT NOT NULL DEFAULT '',
  follow_up TEXT NOT NULL DEFAULT ''
);

CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  salary NUMERIC NOT NULL DEFAULT 0,
  attendance NUMERIC NOT NULL DEFAULT 0,
  join_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','On Leave','Terminated'))
);

CREATE TABLE bank_cash_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'Bank' CHECK (type IN ('Bank','Cash','Online Gateway')),
  balance NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'AED',
  bank TEXT NOT NULL DEFAULT ''
);

CREATE TABLE payments_register (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'Payment' CHECK (type IN ('Receipt','Payment','Refund')),
  party TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  reference TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Completed' CHECK (status IN ('Completed','Processing','Failed'))
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  client TEXT,
  code TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Paused','Completed')),
  hourly_rate NUMERIC NOT NULL DEFAULT 0,
  budget_hours NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE time_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  notes TEXT,
  duration_min INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE retainers (
  id TEXT PRIMARY KEY,
  customer TEXT NOT NULL DEFAULT '',
  description TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'AED',
  interval TEXT NOT NULL DEFAULT 'Monthly' CHECK (interval IN ('Monthly','Quarterly','Yearly')),
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Paused','Cancelled')),
  next_invoice_on TEXT NOT NULL DEFAULT ''
);

-- ══════════════════════════════════════════════════════════════
-- 12. PURCHASE ORDERS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE purchase_orders (
  id TEXT PRIMARY KEY,
  po_number TEXT NOT NULL DEFAULT '',
  supplier TEXT NOT NULL DEFAULT '',
  supplier_type TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL DEFAULT '',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  vat NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'AED',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','approved','received','cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid')),
  linked_booking TEXT,
  notes TEXT
);

CREATE TABLE purchase_order_items (
  id TEXT PRIMARY KEY,
  purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0
);

-- ══════════════════════════════════════════════════════════════
-- 13. RECURRING BILLING
-- ══════════════════════════════════════════════════════════════

CREATE TABLE recurring_billing (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL DEFAULT 'Monthly',
  amount NUMERIC NOT NULL DEFAULT 0,
  debit_account_id TEXT NOT NULL DEFAULT '',
  credit_account_id TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  next_run_date TEXT,
  start_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Paused','Completed')),
  last_run_date TEXT,
  run_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE recurring_profiles (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL DEFAULT '',
  plan_name TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('daily','weekly','monthly','quarterly','yearly')),
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'AED',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled','expired')),
  billing_anchor_day INTEGER NOT NULL DEFAULT 1,
  next_billing_date TEXT,
  last_billed_date TEXT,
  total_billed NUMERIC NOT NULL DEFAULT 0,
  invoice_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE recurring_invoices (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  plan_name TEXT NOT NULL DEFAULT '',
  invoice_id TEXT,
  generation_date TEXT NOT NULL DEFAULT '',
  period_start TEXT NOT NULL DEFAULT '',
  period_end TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'AED',
  is_prorated BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'generated' CHECK (status IN ('generated','sent','paid','overdue','cancelled'))
);

-- ══════════════════════════════════════════════════════════════
-- 14. INVENTORY
-- ══════════════════════════════════════════════════════════════

CREATE TABLE inventory_items (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'pcs',
  quantity NUMERIC NOT NULL DEFAULT 0,
  min_stock_level NUMERIC NOT NULL DEFAULT 0,
  max_stock_level NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  location TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'In Stock' CHECK (status IN ('In Stock','Low Stock','Out of Stock')),
  supplier TEXT NOT NULL DEFAULT '',
  last_reorder_date TEXT
);

-- ══════════════════════════════════════════════════════════════
-- 15. FIXED ASSETS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE fixed_assets (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  purchase_date TEXT NOT NULL DEFAULT '',
  purchase_price NUMERIC NOT NULL DEFAULT 0,
  salvage_value NUMERIC NOT NULL DEFAULT 0,
  useful_life_years INTEGER NOT NULL DEFAULT 5,
  depreciation_method TEXT NOT NULL DEFAULT 'Straight Line',
  accumulated_depreciation NUMERIC NOT NULL DEFAULT 0,
  current_value NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Disposing','Disposed')),
  assigned_to TEXT,
  warranty_expiry TEXT,
  maintenance_date TEXT
);

-- ══════════════════════════════════════════════════════════════
-- 16. CURRENCY POSTING DOCUMENTS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE currency_posting_docs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'invoice' CHECK (type IN ('invoice','expense','payment','journal')),
  reference TEXT NOT NULL DEFAULT '',
  party TEXT NOT NULL DEFAULT '',
  foreign_currency TEXT NOT NULL DEFAULT '',
  foreign_amount NUMERIC NOT NULL DEFAULT 0,
  exchange_rate NUMERIC NOT NULL DEFAULT 1,
  base_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','posted','failed')),
  posting_date TEXT NOT NULL DEFAULT '',
  lines JSONB NOT NULL DEFAULT '[]'
);

-- ══════════════════════════════════════════════════════════════
-- 17. SUPPLIER AUTOMATION
-- ══════════════════════════════════════════════════════════════

CREATE TABLE supplier_automation_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  supplier TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Paused')),
  last_run TEXT,
  matches INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE supplier_pending_invoices (
  id TEXT PRIMARY KEY,
  supplier TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  bookings INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pending Review',
  upload_date TEXT NOT NULL DEFAULT ''
);

-- ══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (public read/write — add auth later)
-- ══════════════════════════════════════════════════════════════

ALTER TABLE accounts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines   ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_periods    ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_estimates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_lock      ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_history      ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_rules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_connections      ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rec_matches           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_schedules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE currencies            ENABLE ROW LEVEL SECURITY;
ALTER TABLE currency_rates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows             ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachment_notes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_routes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_presets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_configurations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents                ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices              ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_packages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE vat_records           ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees             ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_cash_accounts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments_register     ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects              ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE retainers             ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON accounts              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON journal_entries       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON journal_entry_lines   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON accounting_periods    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON booking_estimates     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON transaction_lock      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON approval_items        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON approval_history      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON approval_rules        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON audit_logs            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON bank_connections      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON feed_transactions     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON book_transactions     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON rec_matches           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON sync_logs             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON feed_schedules        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON webhook_events        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON currencies            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON currency_rates        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON workflows             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON automation_logs       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON attachments           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON attachment_notes      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON email_routes          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON role_presets           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON form_configurations   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON app_settings          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON agents                FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON suppliers             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON expenses              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON invoices              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON vehicles              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON tour_packages         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON vat_records           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON leads                 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON employees             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON bank_cash_accounts    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON payments_register     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON projects              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON time_entries          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON retainers             FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE purchase_orders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_billing            ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_assets                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE currency_posting_docs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_automation_rules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_pending_invoices    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON purchase_orders           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON purchase_order_items      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON recurring_billing         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON recurring_profiles        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON recurring_invoices        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON inventory_items           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON fixed_assets              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON currency_posting_docs     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON supplier_automation_rules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON supplier_pending_invoices FOR ALL USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════
-- 14. SALES PIPELINE — Quotes, Sales Orders, Credit Notes, Bills
-- ══════════════════════════════════════════════════════════════

CREATE TABLE quotes (
  id              TEXT PRIMARY KEY,
  quote_number    TEXT NOT NULL,
  customer        TEXT NOT NULL DEFAULT '',
  agent           TEXT,
  date            TEXT NOT NULL,
  expiry_date     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'Draft'
    CHECK (status IN ('Draft','Sent','Accepted','Declined','Expired','Converted')),
  subtotal        NUMERIC NOT NULL DEFAULT 0,
  discount_pct    NUMERIC NOT NULL DEFAULT 0,
  vat             NUMERIC NOT NULL DEFAULT 0,
  total           NUMERIC NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'AED',
  notes           TEXT,
  terms           TEXT,
  converted_to_so  TEXT,
  converted_to_inv TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE quote_items (
  id            TEXT PRIMARY KEY,
  quote_id      TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description   TEXT NOT NULL DEFAULT '',
  quantity      NUMERIC NOT NULL DEFAULT 1,
  unit_price    NUMERIC NOT NULL DEFAULT 0,
  discount_pct  NUMERIC NOT NULL DEFAULT 0,
  tax_rate      NUMERIC NOT NULL DEFAULT 5,
  total         NUMERIC NOT NULL DEFAULT 0
);

CREATE TABLE sales_orders (
  id              TEXT PRIMARY KEY,
  so_number       TEXT NOT NULL,
  customer        TEXT NOT NULL DEFAULT '',
  agent           TEXT,
  date            TEXT NOT NULL,
  delivery_date   TEXT,
  status          TEXT NOT NULL DEFAULT 'Draft'
    CHECK (status IN ('Draft','Confirmed','In Progress','Delivered','Invoiced','Cancelled')),
  subtotal        NUMERIC NOT NULL DEFAULT 0,
  vat             NUMERIC NOT NULL DEFAULT 0,
  total           NUMERIC NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'AED',
  quote_id        TEXT,
  invoice_id      TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sales_order_items (
  id              TEXT PRIMARY KEY,
  sales_order_id  TEXT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  description     TEXT NOT NULL DEFAULT '',
  quantity        NUMERIC NOT NULL DEFAULT 1,
  unit_price      NUMERIC NOT NULL DEFAULT 0,
  discount_pct    NUMERIC NOT NULL DEFAULT 0,
  tax_rate        NUMERIC NOT NULL DEFAULT 5,
  total           NUMERIC NOT NULL DEFAULT 0
);

CREATE TABLE credit_notes (
  id              TEXT PRIMARY KEY,
  cn_number       TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'Credit' CHECK (type IN ('Credit','Debit')),
  invoice_id      TEXT,
  customer        TEXT NOT NULL DEFAULT '',
  date            TEXT NOT NULL,
  reason          TEXT NOT NULL DEFAULT '',
  subtotal        NUMERIC NOT NULL DEFAULT 0,
  vat             NUMERIC NOT NULL DEFAULT 0,
  total           NUMERIC NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'AED',
  status          TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Open','Applied','Void')),
  refund_status   TEXT DEFAULT 'None' CHECK (refund_status IN ('None','Partial','Full')),
  refund_amount   NUMERIC NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE credit_note_items (
  id              TEXT PRIMARY KEY,
  credit_note_id  TEXT NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  description     TEXT NOT NULL DEFAULT '',
  quantity        NUMERIC NOT NULL DEFAULT 1,
  unit_price      NUMERIC NOT NULL DEFAULT 0,
  total           NUMERIC NOT NULL DEFAULT 0
);

CREATE TABLE bills (
  id                   TEXT PRIMARY KEY,
  bill_number          TEXT NOT NULL,
  vendor               TEXT NOT NULL DEFAULT '',
  vendor_bill_ref      TEXT,
  date                 TEXT NOT NULL,
  due_date             TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'Draft'
    CHECK (status IN ('Draft','Pending Approval','Approved','Partially Paid','Paid','Overdue','Void')),
  subtotal             NUMERIC NOT NULL DEFAULT 0,
  vat                  NUMERIC NOT NULL DEFAULT 0,
  total                NUMERIC NOT NULL DEFAULT 0,
  currency             TEXT NOT NULL DEFAULT 'AED',
  amount_paid          NUMERIC NOT NULL DEFAULT 0,
  purchase_order_id    TEXT,
  recurring            BOOLEAN NOT NULL DEFAULT false,
  recurring_profile_id TEXT,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bill_items (
  id          TEXT PRIMARY KEY,
  bill_id     TEXT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  account_id  TEXT,
  quantity    NUMERIC NOT NULL DEFAULT 1,
  unit_price  NUMERIC NOT NULL DEFAULT 0,
  tax_rate    NUMERIC NOT NULL DEFAULT 5,
  total       NUMERIC NOT NULL DEFAULT 0
);

-- RLS for Sales Pipeline
ALTER TABLE quotes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_notes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_note_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills               ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items          ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON quotes              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON quote_items         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON sales_orders        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON sales_order_items   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON credit_notes        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON credit_note_items   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON bills               FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON bill_items          FOR ALL USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════
-- 15. NOTIFICATIONS, REPORTS & PAYMENT REMINDERS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL DEFAULT 'system',
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL DEFAULT '',
  module      TEXT NOT NULL DEFAULT '',
  entity_id   TEXT,
  entity_type TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  action_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE saved_reports (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  type              TEXT NOT NULL,
  config            JSONB NOT NULL DEFAULT '{}',
  schedule          TEXT,
  last_generated_at TIMESTAMPTZ,
  created_by        TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE report_tags (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  type      TEXT NOT NULL DEFAULT 'cost_center'
    CHECK (type IN ('cost_center','department','project','region','custom')),
  color     TEXT NOT NULL DEFAULT 'slate',
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE transaction_tags (
  id          TEXT PRIMARY KEY,
  tag_id      TEXT NOT NULL REFERENCES report_tags(id) ON DELETE CASCADE,
  entity_id   TEXT NOT NULL,
  entity_type TEXT NOT NULL
);

CREATE TABLE payment_reminders (
  id             TEXT PRIMARY KEY,
  invoice_id     TEXT NOT NULL,
  customer       TEXT NOT NULL DEFAULT '',
  type           TEXT NOT NULL DEFAULT 'before' CHECK (type IN ('before','on','after')),
  days_offset    INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','skipped')),
  scheduled_date TEXT NOT NULL,
  sent_at        TIMESTAMPTZ,
  template       TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 16. PORTALS, BUDGETING & PRICE LISTS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE portal_users (
  id          TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('customer','vendor','agent')),
  entity_id   TEXT NOT NULL,
  email       TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  password_hash TEXT,
  token       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  last_login  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE portal_messages (
  id             TEXT PRIMARY KEY,
  portal_user_id TEXT NOT NULL,
  direction      TEXT NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound','outbound')),
  subject        TEXT NOT NULL DEFAULT '',
  body           TEXT NOT NULL DEFAULT '',
  attachments    JSONB NOT NULL DEFAULT '[]',
  is_read        BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE budgets (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  fiscal_year TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('income','expense','combined')),
  status      TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Active','Closed')),
  period_type TEXT NOT NULL DEFAULT 'monthly' CHECK (period_type IN ('monthly','quarterly','yearly')),
  created_by  TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE budget_lines (
  id              TEXT PRIMARY KEY,
  budget_id       TEXT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  account_id      TEXT NOT NULL,
  account_name    TEXT NOT NULL DEFAULT '',
  period          TEXT NOT NULL,
  budgeted_amount NUMERIC NOT NULL DEFAULT 0,
  actual_amount   NUMERIC NOT NULL DEFAULT 0,
  variance        NUMERIC NOT NULL DEFAULT 0,
  notes           TEXT
);

CREATE TABLE price_lists (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'sales' CHECK (type IN ('sales','purchase')),
  currency    TEXT NOT NULL DEFAULT 'AED',
  markup_pct  NUMERIC NOT NULL DEFAULT 0,
  discount_pct NUMERIC NOT NULL DEFAULT 0,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  valid_from  TEXT,
  valid_to    TEXT,
  applies_to  JSONB NOT NULL DEFAULT '[]',
  status      TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE price_list_items (
  id             TEXT PRIMARY KEY,
  price_list_id  TEXT NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  item_id        TEXT,
  item_name      TEXT NOT NULL DEFAULT '',
  standard_price NUMERIC NOT NULL DEFAULT 0,
  list_price     NUMERIC NOT NULL DEFAULT 0,
  markup_pct     NUMERIC NOT NULL DEFAULT 0,
  discount_pct   NUMERIC NOT NULL DEFAULT 0
);

CREATE TABLE composite_items (
  id            TEXT PRIMARY KEY,
  code          TEXT NOT NULL DEFAULT '',
  name          TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  unit          TEXT NOT NULL DEFAULT 'kit',
  selling_price NUMERIC NOT NULL DEFAULT 0,
  cost_price    NUMERIC NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE composite_item_components (
  id                TEXT PRIMARY KEY,
  composite_item_id TEXT NOT NULL REFERENCES composite_items(id) ON DELETE CASCADE,
  inventory_item_id TEXT NOT NULL,
  item_name         TEXT NOT NULL DEFAULT '',
  quantity          NUMERIC NOT NULL DEFAULT 1,
  unit_cost         NUMERIC NOT NULL DEFAULT 0
);

-- ══════════════════════════════════════════════════════════════
-- 17. INVOICE TEMPLATES, EMAIL & EXPENSE POLICIES
-- ══════════════════════════════════════════════════════════════

CREATE TABLE invoice_templates (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  html_template TEXT NOT NULL DEFAULT '',
  logo_url      TEXT,
  primary_color TEXT NOT NULL DEFAULT '#10b981',
  footer_text   TEXT,
  is_default    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE email_templates (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'invoice'
    CHECK (type IN ('invoice','reminder','statement','receipt','welcome','custom')),
  subject    TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL DEFAULT '',
  variables  JSONB NOT NULL DEFAULT '[]',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE email_log (
  id          TEXT PRIMARY KEY,
  template_id TEXT,
  to_address  TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','bounced')),
  entity_type TEXT,
  entity_id   TEXT,
  sent_at     TIMESTAMPTZ,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE invoice_payments (
  id         TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  amount     NUMERIC NOT NULL DEFAULT 0,
  date       TEXT NOT NULL,
  method     TEXT NOT NULL DEFAULT '',
  reference  TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mileage_entries (
  id            TEXT PRIMARY KEY,
  employee_id   TEXT,
  date          TEXT NOT NULL,
  from_location TEXT NOT NULL DEFAULT '',
  to_location   TEXT NOT NULL DEFAULT '',
  distance_km   NUMERIC NOT NULL DEFAULT 0,
  rate_per_km   NUMERIC NOT NULL DEFAULT 0.5,
  amount        NUMERIC NOT NULL DEFAULT 0,
  purpose       TEXT NOT NULL DEFAULT '',
  is_billable   BOOLEAN NOT NULL DEFAULT false,
  project_id    TEXT,
  status        TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected','Reimbursed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE expense_policies (
  id                     TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  category               TEXT NOT NULL DEFAULT '',
  max_amount             NUMERIC,
  requires_receipt_above NUMERIC NOT NULL DEFAULT 0,
  requires_approval_above NUMERIC NOT NULL DEFAULT 0,
  is_active              BOOLEAN NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 18. REVENUE RECOGNITION, PAYROLL & DELIVERY
-- ══════════════════════════════════════════════════════════════

CREATE TABLE revenue_schedules (
  id                TEXT PRIMARY KEY,
  invoice_id        TEXT NOT NULL,
  customer          TEXT NOT NULL DEFAULT '',
  total_amount      NUMERIC NOT NULL DEFAULT 0,
  recognized_amount NUMERIC NOT NULL DEFAULT 0,
  deferred_amount   NUMERIC NOT NULL DEFAULT 0,
  start_date        TEXT NOT NULL,
  end_date          TEXT NOT NULL,
  method            TEXT NOT NULL DEFAULT 'straight_line'
    CHECK (method IN ('straight_line','milestone','percentage_completion')),
  status            TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Completed','Cancelled')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE revenue_schedule_entries (
  id               TEXT PRIMARY KEY,
  schedule_id      TEXT NOT NULL REFERENCES revenue_schedules(id) ON DELETE CASCADE,
  period           TEXT NOT NULL,
  amount           NUMERIC NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Recognized','Skipped')),
  journal_entry_id TEXT,
  recognized_at    TIMESTAMPTZ
);

CREATE TABLE payroll_runs (
  id               TEXT PRIMARY KEY,
  period           TEXT NOT NULL,
  run_date         TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Processing','Completed','Void')),
  total_gross      NUMERIC NOT NULL DEFAULT 0,
  total_deductions NUMERIC NOT NULL DEFAULT 0,
  total_net        NUMERIC NOT NULL DEFAULT 0,
  employee_count   INTEGER NOT NULL DEFAULT 0,
  processed_at     TIMESTAMPTZ,
  posted_at        TIMESTAMPTZ,
  journal_entry_id TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payroll_slips (
  id             TEXT PRIMARY KEY,
  run_id         TEXT NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id    TEXT NOT NULL,
  employee_name  TEXT NOT NULL DEFAULT '',
  basic_salary   NUMERIC NOT NULL DEFAULT 0,
  allowances     NUMERIC NOT NULL DEFAULT 0,
  deductions     NUMERIC NOT NULL DEFAULT 0,
  gross_pay      NUMERIC NOT NULL DEFAULT 0,
  net_pay        NUMERIC NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'Draft'
);

CREATE TABLE delivery_challans (
  id              TEXT PRIMARY KEY,
  challan_number  TEXT NOT NULL,
  sales_order_id  TEXT,
  customer        TEXT NOT NULL DEFAULT '',
  date            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'Draft'
    CHECK (status IN ('Draft','Dispatched','Delivered','Returned')),
  items           TEXT,
  notes           TEXT,
  dispatched_at   TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 19. UI/UX — User Preferences & Activity Timeline
-- ══════════════════════════════════════════════════════════════

CREATE TABLE user_preferences (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL,
  saved_filters      JSONB NOT NULL DEFAULT '{}',
  quick_actions      JSONB NOT NULL DEFAULT '[]',
  keyboard_shortcuts JSONB NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE activity_timeline (
  id          TEXT PRIMARY KEY,
  entity_id   TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  action      TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  user_name   TEXT NOT NULL DEFAULT '',
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for all new Phase 2-6 tables
ALTER TABLE notifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_reports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_tags              ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_tags         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_reminders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_lines             ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_lists              ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE composite_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE composite_item_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_log                ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE mileage_entries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_policies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_schedules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_schedule_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_slips            ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_challans        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences         ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_timeline        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON notifications           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON saved_reports            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON report_tags              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON transaction_tags         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON payment_reminders        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON portal_users             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON portal_messages          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON budgets                  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON budget_lines             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON price_lists              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON price_list_items         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON composite_items          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON composite_item_components FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON invoice_templates        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON email_templates          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON email_log                FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON invoice_payments         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON mileage_entries          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON expense_policies         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON revenue_schedules        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON revenue_schedule_entries  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON payroll_runs             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON payroll_slips            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON delivery_challans        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON user_preferences         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON activity_timeline        FOR ALL USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════

CREATE INDEX idx_accounts_code ON accounts(code);
CREATE INDEX idx_je_date ON journal_entries(date);
CREATE INDEX idx_je_status ON journal_entries(status);
CREATE INDEX idx_jel_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX idx_periods_period ON accounting_periods(period);
CREATE INDEX idx_be_status ON booking_estimates(status);
CREATE INDEX idx_ai_status ON approval_items(status);
CREATE INDEX idx_ah_item ON approval_history(item_id);
CREATE INDEX idx_al_module ON audit_logs(module);
CREATE INDEX idx_al_ts ON audit_logs(timestamp);
CREATE INDEX idx_ft_conn ON feed_transactions(connection_id);
CREATE INDEX idx_ft_status ON feed_transactions(status);
CREATE INDEX idx_att_doc ON attachments(module, document_id);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_suppliers_status ON suppliers(status);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_time_entries_project ON time_entries(project_id);
CREATE INDEX idx_retainers_status ON retainers(status);
CREATE INDEX idx_po_status ON purchase_orders(status);
CREATE INDEX idx_poi_order ON purchase_order_items(purchase_order_id);
CREATE INDEX idx_rb_status ON recurring_billing(status);
CREATE INDEX idx_rp_status ON recurring_profiles(status);
CREATE INDEX idx_ri_status ON recurring_invoices(status);
CREATE INDEX idx_ri_profile ON recurring_invoices(profile_id);
CREATE INDEX idx_inv_items_status ON inventory_items(status);
CREATE INDEX idx_fa_status ON fixed_assets(status);
CREATE INDEX idx_cpd_status ON currency_posting_docs(status);
CREATE INDEX idx_sar_status ON supplier_automation_rules(status);
CREATE INDEX idx_spi_status ON supplier_pending_invoices(status);

-- Sales Pipeline indexes
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_customer ON quotes(customer);
CREATE INDEX idx_qi_quote ON quote_items(quote_id);
CREATE INDEX idx_so_status ON sales_orders(status);
CREATE INDEX idx_so_customer ON sales_orders(customer);
CREATE INDEX idx_soi_order ON sales_order_items(sales_order_id);
CREATE INDEX idx_cn_status ON credit_notes(status);
CREATE INDEX idx_cn_customer ON credit_notes(customer);
CREATE INDEX idx_cni_note ON credit_note_items(credit_note_id);
CREATE INDEX idx_bills_status ON bills(status);
CREATE INDEX idx_bills_vendor ON bills(vendor);
CREATE INDEX idx_bi_bill ON bill_items(bill_id);

-- Phase 2-6 indexes
CREATE INDEX idx_notif_user ON notifications(user_id);
CREATE INDEX idx_notif_read ON notifications(is_read);
CREATE INDEX idx_notif_type ON notifications(type);
CREATE INDEX idx_sr_type ON saved_reports(type);
CREATE INDEX idx_tt_entity ON transaction_tags(entity_id, entity_type);
CREATE INDEX idx_tt_tag ON transaction_tags(tag_id);
CREATE INDEX idx_pr_invoice ON payment_reminders(invoice_id);
CREATE INDEX idx_pr_status ON payment_reminders(status);
CREATE INDEX idx_pu_entity ON portal_users(entity_type, entity_id);
CREATE INDEX idx_pm_user ON portal_messages(portal_user_id);
CREATE INDEX idx_budgets_year ON budgets(fiscal_year);
CREATE INDEX idx_bl_budget ON budget_lines(budget_id);
CREATE INDEX idx_pl_status ON price_lists(status);
CREATE INDEX idx_pli_list ON price_list_items(price_list_id);
CREATE INDEX idx_ci_status ON composite_items(status);
CREATE INDEX idx_cic_item ON composite_item_components(composite_item_id);
CREATE INDEX idx_el_status ON email_log(status);
CREATE INDEX idx_ip_invoice ON invoice_payments(invoice_id);
CREATE INDEX idx_me_status ON mileage_entries(status);
CREATE INDEX idx_rs_invoice ON revenue_schedules(invoice_id);
CREATE INDEX idx_rse_schedule ON revenue_schedule_entries(schedule_id);
CREATE INDEX idx_payroll_status ON payroll_runs(status);
CREATE INDEX idx_ps_run ON payroll_slips(run_id);
CREATE INDEX idx_dc_status ON delivery_challans(status);
CREATE INDEX idx_up_user ON user_preferences(user_id);
CREATE INDEX idx_at_entity ON activity_timeline(entity_id, entity_type);
