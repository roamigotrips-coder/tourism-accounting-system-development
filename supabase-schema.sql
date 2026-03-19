-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  Tourism Accounting System — Full Supabase Schema                          ║
-- ║  Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New query) ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- 1. ACCOUNTING CORE
-- ─── Accounts (Chart of Accounts) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id                  TEXT PRIMARY KEY,
  code                TEXT NOT NULL,
  name                TEXT NOT NULL,
  type                TEXT NOT NULL,
  normal_balance      TEXT NOT NULL DEFAULT 'debit',
  parent_id           TEXT,
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'active',
  is_default          BOOLEAN NOT NULL DEFAULT false,
  opening_balance     NUMERIC NOT NULL DEFAULT 0,
  opening_balance_type TEXT NOT NULL DEFAULT 'debit',
  created_at          TEXT NOT NULL DEFAULT now()::text
);

-- ─── Journal Entries ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_entries (
  id                TEXT PRIMARY KEY,
  entry_number      TEXT NOT NULL,
  date              TEXT NOT NULL,
  period            TEXT,
  description       TEXT NOT NULL,
  reference         TEXT,
  status            TEXT NOT NULL DEFAULT 'draft',
  total_debit       NUMERIC NOT NULL DEFAULT 0,
  total_credit      NUMERIC NOT NULL DEFAULT 0,
  is_balanced       BOOLEAN NOT NULL DEFAULT true,
  created_by        TEXT NOT NULL DEFAULT 'Admin',
  created_at        TEXT NOT NULL DEFAULT now()::text,
  submitted_at      TEXT,
  approved_by       TEXT,
  approved_at       TEXT,
  posted_at         TEXT,
  rejected_by       TEXT,
  rejected_at       TEXT,
  rejection_reason  TEXT,
  reversal_of       TEXT,
  reversed_by       TEXT,
  source            TEXT NOT NULL DEFAULT 'manual'
);

CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id                TEXT PRIMARY KEY,
  journal_entry_id  TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id        TEXT NOT NULL,
  account_code      TEXT NOT NULL,
  account_name      TEXT NOT NULL,
  account_type      TEXT,
  description       TEXT,
  debit             NUMERIC NOT NULL DEFAULT 0,
  credit            NUMERIC NOT NULL DEFAULT 0,
  reference         TEXT
);

-- ─── Accounting Periods ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounting_periods (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  period      TEXT NOT NULL,
  start_date  TEXT NOT NULL,
  end_date    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open',
  closed_by   TEXT,
  closed_at   TEXT
);

-- ─── Transaction Lock ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transaction_lock (
  id            INT PRIMARY KEY DEFAULT 1,
  lock_date     TEXT NOT NULL,
  locked_by     TEXT NOT NULL,
  locked_at     TEXT NOT NULL,
  has_password  BOOLEAN NOT NULL DEFAULT false,
  password_hash TEXT
);

-- 2. BOOKING ESTIMATES
CREATE TABLE IF NOT EXISTS booking_estimates (
  id                TEXT PRIMARY KEY,
  booking_ref       TEXT NOT NULL,
  agent             TEXT NOT NULL,
  customer          TEXT NOT NULL,
  service_type      TEXT NOT NULL,
  service_date      TEXT NOT NULL,
  check_in          TEXT,
  check_out         TEXT,
  selling_price     NUMERIC NOT NULL DEFAULT 0,
  vat               NUMERIC NOT NULL DEFAULT 0,
  total             NUMERIC NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'AED',
  payment_status    TEXT NOT NULL DEFAULT 'Unpaid',
  payment_received  NUMERIC,
  payment_made      NUMERIC,
  notes             TEXT DEFAULT '',
  submitted_at      TEXT NOT NULL,
  submitted_by      TEXT NOT NULL DEFAULT 'Admin',
  status            TEXT NOT NULL DEFAULT 'pending',
  is_tour_package   BOOLEAN NOT NULL DEFAULT false,
  costing           JSONB,
  approved_by       TEXT,
  approved_at       TEXT,
  rejected_by       TEXT,
  rejected_at       TEXT,
  rejection_reason  TEXT,
  invoice_id        TEXT
);

-- 3. APPROVAL WORKFLOW
CREATE TABLE IF NOT EXISTS approval_items (
  id                TEXT PRIMARY KEY,
  ref_number        TEXT NOT NULL,
  type              TEXT NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT DEFAULT '',
  amount            NUMERIC NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'AED',
  vat_amount        NUMERIC NOT NULL DEFAULT 0,
  total_amount      NUMERIC NOT NULL DEFAULT 0,
  submitted_by      TEXT NOT NULL DEFAULT 'Admin',
  submitted_at      TEXT NOT NULL,
  submitted_by_dept TEXT DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'pending',
  priority          TEXT NOT NULL DEFAULT 'normal',
  due_date          TEXT,
  party             TEXT DEFAULT '',
  party_type        TEXT DEFAULT '',
  category          TEXT,
  notes             TEXT,
  gl_posted         BOOLEAN NOT NULL DEFAULT false,
  gl_entry_ref      TEXT,
  correction_note   TEXT,
  rejection_reason  TEXT,
  tags              JSONB DEFAULT '[]',
  source_data       JSONB,
  manager_role      TEXT DEFAULT '',
  manager_label     TEXT DEFAULT '',
  finance_role      TEXT DEFAULT '',
  finance_label     TEXT DEFAULT '',
  requires_cfo      BOOLEAN NOT NULL DEFAULT false,
  stage_history     JSONB DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS approval_history (
  id            TEXT PRIMARY KEY,
  item_id       TEXT NOT NULL REFERENCES approval_items(id) ON DELETE CASCADE,
  timestamp     TEXT NOT NULL,
  action        TEXT NOT NULL,
  performed_by  TEXT NOT NULL,
  from_status   TEXT NOT NULL,
  to_status     TEXT NOT NULL,
  notes         TEXT,
  stage         TEXT
);

CREATE TABLE IF NOT EXISTS approval_rules (
  id                        TEXT PRIMARY KEY,
  name                      TEXT NOT NULL,
  item_type                 TEXT NOT NULL,
  amount_threshold          NUMERIC NOT NULL DEFAULT 0,
  approver                  TEXT NOT NULL,
  is_active                 BOOLEAN NOT NULL DEFAULT true,
  requires_second_approval  BOOLEAN NOT NULL DEFAULT false,
  second_approver           TEXT,
  created_at                TEXT NOT NULL DEFAULT now()::text
);

-- 4. AUDIT TRAIL
CREATE TABLE IF NOT EXISTS audit_logs (
  id            TEXT PRIMARY KEY,
  timestamp     TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  user_name     TEXT NOT NULL,
  user_role     TEXT DEFAULT '',
  action        TEXT NOT NULL,
  module        TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  entity_type   TEXT NOT NULL,
  entity_label  TEXT DEFAULT '',
  description   TEXT DEFAULT '',
  old_values    JSONB,
  new_values    JSONB,
  diffs         JSONB,
  ip_address    TEXT DEFAULT '',
  session_id    TEXT DEFAULT '',
  tags          JSONB DEFAULT '[]',
  severity      TEXT DEFAULT 'info',
  is_reversible BOOLEAN NOT NULL DEFAULT false,
  metadata      JSONB
);

-- 5. BANK FEEDS & RECONCILIATION
CREATE TABLE IF NOT EXISTS bank_connections (
  id                TEXT PRIMARY KEY,
  provider_id       TEXT NOT NULL,
  provider_name     TEXT NOT NULL,
  account_name      TEXT NOT NULL,
  account_number    TEXT,
  account_type      TEXT NOT NULL DEFAULT 'current',
  currency          TEXT NOT NULL DEFAULT 'AED',
  balance           NUMERIC NOT NULL DEFAULT 0,
  available_balance NUMERIC NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'connected',
  last_sync         TEXT,
  next_sync         TEXT,
  sync_frequency    TEXT NOT NULL DEFAULT 'daily',
  auto_match        BOOLEAN NOT NULL DEFAULT true,
  auto_post         BOOLEAN NOT NULL DEFAULT false,
  total_imported    INT NOT NULL DEFAULT 0,
  total_matched     INT NOT NULL DEFAULT 0,
  connected_at      TEXT NOT NULL DEFAULT now()::text,
  consent_expiry    TEXT,
  error_message     TEXT
);

CREATE TABLE IF NOT EXISTS feed_transactions (
  id                TEXT PRIMARY KEY,
  feed_id           TEXT,
  connection_id     TEXT NOT NULL,
  provider_ref      TEXT,
  date              TEXT NOT NULL,
  description       TEXT NOT NULL,
  reference         TEXT,
  debit             NUMERIC NOT NULL DEFAULT 0,
  credit            NUMERIC NOT NULL DEFAULT 0,
  balance           NUMERIC NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'unmatched',
  matched_with      TEXT,
  source            TEXT NOT NULL DEFAULT 'feed',
  bank              TEXT,
  raw_data          JSONB DEFAULT '{}',
  enriched          BOOLEAN NOT NULL DEFAULT false,
  category          TEXT,
  merchant_name     TEXT,
  merchant_category TEXT,
  pending           BOOLEAN NOT NULL DEFAULT false,
  reversed          BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS book_transactions (
  id            TEXT PRIMARY KEY,
  date          TEXT NOT NULL,
  description   TEXT NOT NULL,
  reference     TEXT,
  amount        NUMERIC NOT NULL DEFAULT 0,
  type          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'unmatched',
  matched_with  TEXT,
  source        TEXT,
  category      TEXT
);

CREATE TABLE IF NOT EXISTS rec_matches (
  id          TEXT PRIMARY KEY,
  bank_tx_id  TEXT NOT NULL,
  book_tx_id  TEXT NOT NULL,
  matched_by  TEXT NOT NULL,
  matched_at  TEXT NOT NULL,
  difference  NUMERIC NOT NULL DEFAULT 0,
  method      TEXT NOT NULL,
  confidence  TEXT NOT NULL DEFAULT 'medium',
  score       NUMERIC NOT NULL DEFAULT 0,
  reasons     JSONB DEFAULT '[]',
  note        TEXT
);

CREATE TABLE IF NOT EXISTS sync_logs (
  id                TEXT PRIMARY KEY,
  connection_id     TEXT NOT NULL,
  started_at        TEXT NOT NULL,
  completed_at      TEXT,
  status            TEXT NOT NULL,
  new_transactions  INT NOT NULL DEFAULT 0,
  auto_matched      INT NOT NULL DEFAULT 0,
  errors            JSONB DEFAULT '[]',
  provider          TEXT
);

CREATE TABLE IF NOT EXISTS feed_schedules (
  connection_id  TEXT PRIMARY KEY,
  frequency      TEXT NOT NULL DEFAULT 'daily',
  last_run       TEXT,
  next_run       TEXT,
  enabled        BOOLEAN NOT NULL DEFAULT true,
  retry_count    INT NOT NULL DEFAULT 0,
  max_retries    INT NOT NULL DEFAULT 3
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  received_at   TEXT NOT NULL,
  processed     BOOLEAN NOT NULL DEFAULT false
);

-- 6. MULTI-CURRENCY
CREATE TABLE IF NOT EXISTS currencies (
  code    TEXT PRIMARY KEY,
  symbol  TEXT NOT NULL,
  name    TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS currency_rates (
  code    TEXT PRIMARY KEY,
  rate    NUMERIC NOT NULL DEFAULT 1,
  date    TEXT NOT NULL,
  source  TEXT DEFAULT 'Manual'
);

CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 7. AUTOMATION
CREATE TABLE IF NOT EXISTS workflows (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  trigger     JSONB NOT NULL DEFAULT '{}',
  conditions  JSONB DEFAULT '[]',
  actions     JSONB DEFAULT '[]',
  created_at  TEXT NOT NULL DEFAULT now()::text
);

CREATE TABLE IF NOT EXISTS automation_logs (
  id      TEXT PRIMARY KEY,
  time    TEXT NOT NULL,
  message TEXT NOT NULL
);

-- 8. ATTACHMENTS & DOCUMENTS
CREATE TABLE IF NOT EXISTS attachments (
  id          TEXT PRIMARY KEY,
  file_name   TEXT NOT NULL,
  mime_type   TEXT NOT NULL,
  size        INT NOT NULL DEFAULT 0,
  data_url    TEXT,
  ocr_text    TEXT,
  uploaded_at TEXT NOT NULL,
  uploaded_by TEXT NOT NULL DEFAULT 'Admin',
  source      TEXT NOT NULL DEFAULT 'upload',
  module      TEXT NOT NULL,
  document_id TEXT NOT NULL,
  tags        JSONB DEFAULT '[]',
  version     INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS attachment_notes (
  id            TEXT PRIMARY KEY,
  attachment_id TEXT NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  text          TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  created_by    TEXT NOT NULL DEFAULT 'Admin'
);

CREATE TABLE IF NOT EXISTS email_routes (
  id        TEXT PRIMARY KEY,
  address   TEXT NOT NULL,
  name      TEXT NOT NULL,
  route_to  TEXT NOT NULL,
  auto_link BOOLEAN NOT NULL DEFAULT true,
  enabled   BOOLEAN NOT NULL DEFAULT true
);

-- 9. ROLE PRESETS
CREATE TABLE IF NOT EXISTS role_presets (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  emoji       TEXT,
  description TEXT,
  color       TEXT,
  permissions JSONB NOT NULL DEFAULT '{}',
  is_system   BOOLEAN NOT NULL DEFAULT false
);

-- 10. FORM BUILDER
CREATE TABLE IF NOT EXISTS form_configurations (
  form_id          TEXT PRIMARY KEY,
  form_name        TEXT NOT NULL,
  form_description TEXT,
  module           TEXT NOT NULL,
  fields           JSONB DEFAULT '[]'
);

-- 11. AGENTS
CREATE TABLE IF NOT EXISTS agents (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  country        TEXT NOT NULL DEFAULT '',
  credit_limit   NUMERIC NOT NULL DEFAULT 0,
  outstanding    NUMERIC NOT NULL DEFAULT 0,
  payment_terms  TEXT NOT NULL DEFAULT 'Net 30',
  commission     NUMERIC NOT NULL DEFAULT 0,
  total_bookings INT NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'Active',
  email          TEXT DEFAULT '',
  phone          TEXT DEFAULT ''
);

-- 12. SUPPLIERS
CREATE TABLE IF NOT EXISTS suppliers (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'General',
  contact       TEXT DEFAULT '',
  email         TEXT DEFAULT '',
  total_payable NUMERIC NOT NULL DEFAULT 0,
  paid_amount   NUMERIC NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'Active'
);

-- 13. EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
  id           TEXT PRIMARY KEY,
  category     TEXT NOT NULL,
  supplier     TEXT NOT NULL DEFAULT '',
  amount       NUMERIC NOT NULL DEFAULT 0,
  payment_mode TEXT NOT NULL DEFAULT 'Cash',
  date         TEXT NOT NULL,
  description  TEXT DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'Pending'
);

-- 14. INVOICES
CREATE TABLE IF NOT EXISTS invoices (
  id       TEXT PRIMARY KEY,
  type     TEXT NOT NULL DEFAULT 'Sales',
  party    TEXT NOT NULL,
  amount   NUMERIC NOT NULL DEFAULT 0,
  vat      NUMERIC NOT NULL DEFAULT 0,
  total    NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'AED',
  date     TEXT NOT NULL,
  due_date TEXT NOT NULL,
  status   TEXT NOT NULL DEFAULT 'Draft'
);

-- 15. VEHICLES (TRANSPORT)
CREATE TABLE IF NOT EXISTS vehicles (
  id        TEXT PRIMARY KEY,
  plate     TEXT NOT NULL,
  type      TEXT NOT NULL,
  driver    TEXT NOT NULL DEFAULT '',
  status    TEXT NOT NULL DEFAULT 'Available',
  fuel_cost NUMERIC NOT NULL DEFAULT 0,
  trips     INT NOT NULL DEFAULT 0,
  revenue   NUMERIC NOT NULL DEFAULT 0
);

-- 16. TOUR PACKAGES
CREATE TABLE IF NOT EXISTS tour_packages (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  price         NUMERIC NOT NULL DEFAULT 0,
  hotel_cost    NUMERIC NOT NULL DEFAULT 0,
  transfer_cost NUMERIC NOT NULL DEFAULT 0,
  tickets_cost  NUMERIC NOT NULL DEFAULT 0,
  guide_cost    NUMERIC NOT NULL DEFAULT 0,
  other_cost    NUMERIC NOT NULL DEFAULT 0,
  profit        NUMERIC NOT NULL DEFAULT 0,
  bookings      INT NOT NULL DEFAULT 0
);

-- 17. VAT RECORDS
CREATE TABLE IF NOT EXISTS vat_records (
  id         TEXT PRIMARY KEY,
  month      TEXT NOT NULL,
  output_vat NUMERIC NOT NULL DEFAULT 0,
  input_vat  NUMERIC NOT NULL DEFAULT 0,
  net_vat    NUMERIC NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'Pending'
);

-- 18. CRM LEADS
CREATE TABLE IF NOT EXISTS leads (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  email     TEXT DEFAULT '',
  phone     TEXT DEFAULT '',
  source    TEXT NOT NULL DEFAULT 'Website',
  service   TEXT NOT NULL DEFAULT '',
  status    TEXT NOT NULL DEFAULT 'New',
  value     NUMERIC NOT NULL DEFAULT 0,
  date      TEXT NOT NULL,
  follow_up TEXT
);

-- 19. EMPLOYEES (HR)
CREATE TABLE IF NOT EXISTS employees (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT '',
  role       TEXT NOT NULL DEFAULT '',
  salary     NUMERIC NOT NULL DEFAULT 0,
  attendance NUMERIC NOT NULL DEFAULT 0,
  join_date  TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'Active'
);

-- 20. BANK / CASH ACCOUNTS
CREATE TABLE IF NOT EXISTS bank_cash_accounts (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  type     TEXT NOT NULL DEFAULT 'Bank',
  balance  NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'AED',
  bank     TEXT DEFAULT ''
);

-- 21. PAYMENTS REGISTER
CREATE TABLE IF NOT EXISTS payments_register (
  id        TEXT PRIMARY KEY,
  type      TEXT NOT NULL DEFAULT 'Received',
  party     TEXT NOT NULL,
  amount    NUMERIC NOT NULL DEFAULT 0,
  method    TEXT NOT NULL DEFAULT 'Bank Transfer',
  date      TEXT NOT NULL,
  reference TEXT DEFAULT '',
  status    TEXT NOT NULL DEFAULT 'Completed'
);

-- 22. PROJECTS & TIME TRACKING
CREATE TABLE IF NOT EXISTS projects (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  client       TEXT,
  code         TEXT,
  status       TEXT NOT NULL DEFAULT 'Active',
  hourly_rate  NUMERIC NOT NULL DEFAULT 0,
  budget_hours NUMERIC,
  created_at   TEXT NOT NULL DEFAULT now()::text
);

CREATE TABLE IF NOT EXISTS time_entries (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_name    TEXT NOT NULL,
  date         TEXT NOT NULL,
  notes        TEXT,
  duration_min INT NOT NULL DEFAULT 0
);

-- 23. RETAINERS
CREATE TABLE IF NOT EXISTS retainers (
  id              TEXT PRIMARY KEY,
  customer        TEXT NOT NULL,
  description     TEXT,
  amount          NUMERIC NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'AED',
  "interval"      TEXT NOT NULL DEFAULT 'Monthly',
  start_date      TEXT NOT NULL,
  end_date        TEXT,
  status          TEXT NOT NULL DEFAULT 'Active',
  next_invoice_on TEXT NOT NULL
);

-- 24. PURCHASE ORDERS
CREATE TABLE IF NOT EXISTS purchase_orders (
  id              TEXT PRIMARY KEY,
  po_number       TEXT NOT NULL,
  supplier        TEXT NOT NULL,
  supplier_type   TEXT NOT NULL DEFAULT 'General',
  date            TEXT NOT NULL,
  due_date        TEXT NOT NULL,
  subtotal        NUMERIC NOT NULL DEFAULT 0,
  vat             NUMERIC NOT NULL DEFAULT 0,
  total           NUMERIC NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'AED',
  status          TEXT NOT NULL DEFAULT 'draft',
  payment_status  TEXT NOT NULL DEFAULT 'unpaid',
  linked_booking  TEXT,
  notes           TEXT
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                TEXT PRIMARY KEY,
  purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  description       TEXT NOT NULL,
  quantity          NUMERIC NOT NULL DEFAULT 1,
  unit_price        NUMERIC NOT NULL DEFAULT 0,
  total             NUMERIC NOT NULL DEFAULT 0
);

-- 25. RECURRING BILLING
CREATE TABLE IF NOT EXISTS recurring_billing (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  frequency         TEXT NOT NULL DEFAULT 'monthly',
  amount            NUMERIC NOT NULL DEFAULT 0,
  debit_account_id  TEXT,
  credit_account_id TEXT,
  description       TEXT DEFAULT '',
  next_run_date     TEXT,
  start_date        TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'active',
  last_run_date     TEXT,
  run_count         INT NOT NULL DEFAULT 0
);

-- 26. RECURRING PROFILES
CREATE TABLE IF NOT EXISTS recurring_profiles (
  id                  TEXT PRIMARY KEY,
  customer_id         TEXT NOT NULL,
  customer_name       TEXT NOT NULL,
  plan_name           TEXT NOT NULL,
  frequency           TEXT NOT NULL DEFAULT 'monthly',
  start_date          TEXT NOT NULL,
  end_date            TEXT,
  amount              NUMERIC NOT NULL DEFAULT 0,
  currency            TEXT NOT NULL DEFAULT 'AED',
  status              TEXT NOT NULL DEFAULT 'active',
  billing_anchor_day  INT NOT NULL DEFAULT 1,
  next_billing_date   TEXT,
  last_billed_date    TEXT,
  total_billed        NUMERIC NOT NULL DEFAULT 0,
  invoice_count       INT NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT now()::text
);

-- 27. RECURRING INVOICES
CREATE TABLE IF NOT EXISTS recurring_invoices (
  id               TEXT PRIMARY KEY,
  profile_id       TEXT NOT NULL,
  customer_name    TEXT NOT NULL,
  plan_name        TEXT NOT NULL,
  invoice_id       TEXT,
  generation_date  TEXT NOT NULL,
  period_start     TEXT NOT NULL,
  period_end       TEXT NOT NULL,
  amount           NUMERIC NOT NULL DEFAULT 0,
  currency         TEXT NOT NULL DEFAULT 'AED',
  is_prorated      BOOLEAN NOT NULL DEFAULT false,
  status           TEXT NOT NULL DEFAULT 'generated'
);

-- 28. INVENTORY ITEMS
CREATE TABLE IF NOT EXISTS inventory_items (
  id                TEXT PRIMARY KEY,
  code              TEXT NOT NULL,
  name              TEXT NOT NULL,
  category          TEXT NOT NULL DEFAULT '',
  description       TEXT DEFAULT '',
  unit              TEXT NOT NULL DEFAULT 'pcs',
  quantity          NUMERIC NOT NULL DEFAULT 0,
  min_stock_level   NUMERIC NOT NULL DEFAULT 0,
  max_stock_level   NUMERIC NOT NULL DEFAULT 100,
  unit_cost         NUMERIC NOT NULL DEFAULT 0,
  location          TEXT DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'Active',
  supplier          TEXT DEFAULT '',
  last_reorder_date TEXT
);

-- 29. FIXED ASSETS
CREATE TABLE IF NOT EXISTS fixed_assets (
  id                        TEXT PRIMARY KEY,
  code                      TEXT NOT NULL,
  name                      TEXT NOT NULL,
  category                  TEXT NOT NULL DEFAULT '',
  description               TEXT DEFAULT '',
  location                  TEXT DEFAULT '',
  purchase_date             TEXT NOT NULL,
  purchase_price            NUMERIC NOT NULL DEFAULT 0,
  salvage_value             NUMERIC NOT NULL DEFAULT 0,
  useful_life_years         NUMERIC NOT NULL DEFAULT 5,
  depreciation_method       TEXT NOT NULL DEFAULT 'Straight Line',
  accumulated_depreciation  NUMERIC NOT NULL DEFAULT 0,
  current_value             NUMERIC NOT NULL DEFAULT 0,
  status                    TEXT NOT NULL DEFAULT 'Active',
  assigned_to               TEXT,
  warranty_expiry           TEXT,
  maintenance_date          TEXT
);

-- 30. CURRENCY POSTING DOCS
CREATE TABLE IF NOT EXISTS currency_posting_docs (
  id               TEXT PRIMARY KEY,
  type             TEXT NOT NULL,
  reference        TEXT NOT NULL,
  party            TEXT NOT NULL,
  foreign_currency TEXT NOT NULL,
  foreign_amount   NUMERIC NOT NULL DEFAULT 0,
  exchange_rate    NUMERIC NOT NULL DEFAULT 1,
  base_amount      NUMERIC NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'pending',
  posting_date     TEXT NOT NULL,
  lines            JSONB DEFAULT '[]'
);

-- 31. SUPPLIER AUTOMATION
CREATE TABLE IF NOT EXISTS supplier_automation_rules (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  supplier TEXT NOT NULL,
  status   TEXT NOT NULL DEFAULT 'Active',
  last_run TEXT DEFAULT '',
  matches  INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS supplier_pending_invoices (
  id          TEXT PRIMARY KEY,
  supplier    TEXT NOT NULL,
  amount      NUMERIC NOT NULL DEFAULT 0,
  bookings    INT NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'Pending',
  upload_date TEXT NOT NULL
);

-- 32. QUOTES
CREATE TABLE IF NOT EXISTS quotes (
  id              TEXT PRIMARY KEY,
  quote_number    TEXT NOT NULL,
  customer        TEXT NOT NULL,
  agent           TEXT,
  date            TEXT NOT NULL,
  expiry_date     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'Draft',
  subtotal        NUMERIC NOT NULL DEFAULT 0,
  discount_pct    NUMERIC NOT NULL DEFAULT 0,
  vat             NUMERIC NOT NULL DEFAULT 0,
  total           NUMERIC NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'AED',
  notes           TEXT,
  terms           TEXT,
  converted_to_so  TEXT,
  converted_to_inv TEXT,
  created_at      TEXT NOT NULL DEFAULT now()::text
);

CREATE TABLE IF NOT EXISTS quote_items (
  id           TEXT PRIMARY KEY,
  quote_id     TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  quantity     NUMERIC NOT NULL DEFAULT 1,
  unit_price   NUMERIC NOT NULL DEFAULT 0,
  discount_pct NUMERIC NOT NULL DEFAULT 0,
  tax_rate     NUMERIC NOT NULL DEFAULT 5,
  total        NUMERIC NOT NULL DEFAULT 0
);

-- 33. SALES ORDERS
CREATE TABLE IF NOT EXISTS sales_orders (
  id            TEXT PRIMARY KEY,
  so_number     TEXT NOT NULL,
  customer      TEXT NOT NULL,
  agent         TEXT,
  date          TEXT NOT NULL,
  delivery_date TEXT,
  status        TEXT NOT NULL DEFAULT 'Draft',
  subtotal      NUMERIC NOT NULL DEFAULT 0,
  vat           NUMERIC NOT NULL DEFAULT 0,
  total         NUMERIC NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'AED',
  quote_id      TEXT,
  invoice_id    TEXT,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT now()::text
);

CREATE TABLE IF NOT EXISTS sales_order_items (
  id              TEXT PRIMARY KEY,
  sales_order_id  TEXT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  description     TEXT NOT NULL,
  quantity        NUMERIC NOT NULL DEFAULT 1,
  unit_price      NUMERIC NOT NULL DEFAULT 0,
  discount_pct    NUMERIC NOT NULL DEFAULT 0,
  tax_rate        NUMERIC NOT NULL DEFAULT 5,
  total           NUMERIC NOT NULL DEFAULT 0
);

-- 34. CREDIT NOTES
CREATE TABLE IF NOT EXISTS credit_notes (
  id            TEXT PRIMARY KEY,
  cn_number     TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'Credit',
  invoice_id    TEXT,
  customer      TEXT NOT NULL,
  date          TEXT NOT NULL,
  reason        TEXT NOT NULL DEFAULT '',
  subtotal      NUMERIC NOT NULL DEFAULT 0,
  vat           NUMERIC NOT NULL DEFAULT 0,
  total         NUMERIC NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'AED',
  status        TEXT NOT NULL DEFAULT 'Draft',
  refund_status TEXT NOT NULL DEFAULT 'None',
  refund_amount NUMERIC NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT now()::text
);

CREATE TABLE IF NOT EXISTS credit_note_items (
  id             TEXT PRIMARY KEY,
  credit_note_id TEXT NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  description    TEXT NOT NULL,
  quantity       NUMERIC NOT NULL DEFAULT 1,
  unit_price     NUMERIC NOT NULL DEFAULT 0,
  total          NUMERIC NOT NULL DEFAULT 0
);

-- 35. BILLS
CREATE TABLE IF NOT EXISTS bills (
  id                   TEXT PRIMARY KEY,
  bill_number          TEXT NOT NULL,
  vendor               TEXT NOT NULL,
  vendor_bill_ref      TEXT,
  date                 TEXT NOT NULL,
  due_date             TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'Draft',
  subtotal             NUMERIC NOT NULL DEFAULT 0,
  vat                  NUMERIC NOT NULL DEFAULT 0,
  total                NUMERIC NOT NULL DEFAULT 0,
  currency             TEXT NOT NULL DEFAULT 'AED',
  amount_paid          NUMERIC NOT NULL DEFAULT 0,
  purchase_order_id    TEXT,
  recurring            BOOLEAN NOT NULL DEFAULT false,
  recurring_profile_id TEXT,
  notes                TEXT,
  created_at           TEXT NOT NULL DEFAULT now()::text
);

CREATE TABLE IF NOT EXISTS bill_items (
  id          TEXT PRIMARY KEY,
  bill_id     TEXT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  account_id  TEXT,
  quantity    NUMERIC NOT NULL DEFAULT 1,
  unit_price  NUMERIC NOT NULL DEFAULT 0,
  tax_rate    NUMERIC NOT NULL DEFAULT 5,
  total       NUMERIC NOT NULL DEFAULT 0
);

-- 36. PAYROLL
CREATE TABLE IF NOT EXISTS payroll_runs (
  id               TEXT PRIMARY KEY,
  period           TEXT NOT NULL,
  run_date         TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'Draft',
  total_gross      NUMERIC NOT NULL DEFAULT 0,
  total_deductions NUMERIC NOT NULL DEFAULT 0,
  total_net        NUMERIC NOT NULL DEFAULT 0,
  employee_count   INT NOT NULL DEFAULT 0,
  processed_at     TEXT,
  posted_at        TEXT,
  created_at       TEXT NOT NULL DEFAULT now()::text
);

CREATE TABLE IF NOT EXISTS payroll_slips (
  id            TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id   TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  basic_salary  NUMERIC NOT NULL DEFAULT 0,
  allowances    NUMERIC NOT NULL DEFAULT 0,
  deductions    NUMERIC NOT NULL DEFAULT 0,
  gross_pay     NUMERIC NOT NULL DEFAULT 0,
  net_pay       NUMERIC NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'Draft'
);

-- 37. EMAIL TEMPLATES
CREATE TABLE IF NOT EXISTS email_templates (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  subject    TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL DEFAULT '',
  module     TEXT NOT NULL DEFAULT 'general',
  variables  JSONB DEFAULT '[]',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TEXT NOT NULL DEFAULT now()::text,
  updated_at TEXT NOT NULL DEFAULT now()::text
);

-- 38. DELIVERY CHALLANS
CREATE TABLE IF NOT EXISTS delivery_challans (
  id              TEXT PRIMARY KEY,
  challan_number  TEXT NOT NULL,
  sales_order_id  TEXT,
  customer        TEXT NOT NULL,
  date            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'Draft',
  items           JSONB DEFAULT '[]',
  notes           TEXT DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT now()::text
);

-- 39. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL DEFAULT 'info',
  title      TEXT NOT NULL,
  message    TEXT NOT NULL DEFAULT '',
  module     TEXT,
  entity_id  TEXT,
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TEXT NOT NULL DEFAULT now()::text
);

-- 40. PRICE LISTS
CREATE TABLE IF NOT EXISTS price_lists (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  currency   TEXT NOT NULL DEFAULT 'AED',
  status     TEXT NOT NULL DEFAULT 'Active',
  items      JSONB DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT now()::text
);

-- 41. BUDGETS
CREATE TABLE IF NOT EXISTS budgets (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  period     TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'Draft',
  lines      JSONB DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT now()::text
);

-- 42. REVENUE RECOGNITION
CREATE TABLE IF NOT EXISTS revenue_schedules (
  id              TEXT PRIMARY KEY,
  invoice_id      TEXT,
  customer        TEXT NOT NULL,
  total_amount    NUMERIC NOT NULL DEFAULT 0,
  recognized      NUMERIC NOT NULL DEFAULT 0,
  start_date      TEXT NOT NULL,
  end_date        TEXT NOT NULL,
  method          TEXT NOT NULL DEFAULT 'straight-line',
  status          TEXT NOT NULL DEFAULT 'active',
  entries         JSONB DEFAULT '[]',
  created_at      TEXT NOT NULL DEFAULT now()::text
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- DISABLE RLS on all tables (for development — enable per-table later)
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY;', tbl);
  END LOOP;
END $$;

-- Grant full access to anon and authenticated roles (required for Supabase JS client)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated;', tbl);
  END LOOP;
END $$;
