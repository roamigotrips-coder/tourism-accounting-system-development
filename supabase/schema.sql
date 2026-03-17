-- ============================================================
-- AccountsPro — Tourism Accounting System
-- FRESH INSTALL: Drops all existing tables and recreates them
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ── Drop existing tables (order matters for foreign keys) ────
DROP TABLE IF EXISTS journal_entry_lines CASCADE;
DROP TABLE IF EXISTS journal_entries CASCADE;
DROP TABLE IF EXISTS booking_estimates CASCADE;
DROP TABLE IF EXISTS accounting_periods CASCADE;
DROP TABLE IF EXISTS transaction_lock CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;

-- ── Chart of Accounts ────────────────────────────────────────
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

-- ── Journal Entries ──────────────────────────────────────────
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

-- ── Journal Entry Lines ──────────────────────────────────────
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

-- ── Accounting Periods ───────────────────────────────────────
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

-- ── Booking Estimates ────────────────────────────────────────
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

-- ── Transaction Lock ─────────────────────────────────────────
CREATE TABLE transaction_lock (
  id            INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  lock_date     TEXT NOT NULL,
  locked_by     TEXT NOT NULL,
  locked_at     TEXT NOT NULL,
  has_password  BOOLEAN NOT NULL DEFAULT false,
  password_hash TEXT
);

-- ── Row Level Security (public read/write — add auth later) ──
ALTER TABLE accounts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines   ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_periods    ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_estimates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_lock      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_accounts"            ON accounts            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_journal_entries"     ON journal_entries     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_je_lines"            ON journal_entry_lines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_periods"             ON accounting_periods  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_booking_estimates"   ON booking_estimates   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_transaction_lock"    ON transaction_lock    FOR ALL USING (true) WITH CHECK (true);
