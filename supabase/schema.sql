-- ============================================================
-- AccountsPro — Tourism Accounting System
-- COMPREHENSIVE SCHEMA: All modules backed by Supabase
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ── Drop existing tables (order matters for foreign keys) ────
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
