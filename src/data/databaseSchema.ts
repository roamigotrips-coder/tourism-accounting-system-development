// ─── Full AccountsPro Database Schema ────────────────────────────────────────
import type { SchemaTable } from '../types/database';

export const SCHEMA_TABLES: SchemaTable[] = [

  // ══════════════════════════════════════════════════════
  // USERS & AUTH
  // ══════════════════════════════════════════════════════
  {
    name: 'users',
    label: 'Users',
    module: 'Auth',
    description: 'System users — employees, managers, admins, agents with login access.',
    color: 'slate',
    rowEstimate: '~200',
    fields: [
      { name: 'id',           type: 'UUID',      nullable: false, primaryKey: true, default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'name',         type: 'VARCHAR',   length: 255,  nullable: false, description: 'Full name' },
      { name: 'email',        type: 'VARCHAR',   length: 255,  nullable: false, unique: true, description: 'Login email (unique)' },
      { name: 'password_hash',type: 'VARCHAR',   length: 255,  nullable: false, description: 'bcrypt hashed password' },
      { name: 'role_id',      type: 'UUID',      nullable: false, foreignKey: { table: 'roles', field: 'id' }, description: 'FK → roles' },
      { name: 'employee_id',  type: 'UUID',      nullable: true,  foreignKey: { table: 'employees', field: 'id' }, description: 'FK → employees (if staff)' },
      { name: 'avatar_url',   type: 'VARCHAR',   length: 500,  nullable: true,  description: 'Profile picture URL' },
      { name: 'is_active',    type: 'BOOLEAN',   nullable: false, default: 'true', description: 'Account enabled flag' },
      { name: 'last_login_at',type: 'TIMESTAMP', nullable: true,  description: 'Last successful login' },
      { name: 'permissions',  type: 'JSONB',     nullable: true,  description: 'Module-level RBAC: {revenue, operations, finance, tools}' },
      { name: 'created_at',   type: 'TIMESTAMP', nullable: false, default: 'NOW()', description: 'Record creation timestamp' },
      { name: 'updated_at',   type: 'TIMESTAMP', nullable: false, default: 'NOW()', description: 'Last update timestamp' },
    ],
    indexes: [
      { name: 'idx_users_email', fields: ['email'], unique: true, description: 'Fast login lookup' },
      { name: 'idx_users_role',  fields: ['role_id'], description: 'Filter by role' },
    ],
  },
  {
    name: 'roles',
    label: 'Roles',
    module: 'Auth',
    description: 'RBAC role presets. Admin, Manager, Accountant, Sales Staff, Driver etc.',
    color: 'slate',
    rowEstimate: '~10',
    fields: [
      { name: 'id',          type: 'UUID',    nullable: false, primaryKey: true, default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'name',        type: 'VARCHAR', length: 100, nullable: false, unique: true, description: 'Role name e.g. Admin' },
      { name: 'emoji',       type: 'VARCHAR', length: 10,  nullable: true,  description: 'Display emoji' },
      { name: 'description', type: 'TEXT',    nullable: true,  description: 'Role description' },
      { name: 'color',       type: 'VARCHAR', length: 50,  nullable: true,  description: 'UI color class' },
      { name: 'is_system',   type: 'BOOLEAN', nullable: false, default: 'false', description: 'System roles cannot be deleted' },
      { name: 'permissions', type: 'JSONB',   nullable: false, description: 'Default permissions for this role' },
      { name: 'created_at',  type: 'TIMESTAMP', nullable: false, default: 'NOW()', description: 'Created at' },
    ],
  },

  // ══════════════════════════════════════════════════════
  // BANK FEEDS (primary requested tables)
  // ══════════════════════════════════════════════════════
  {
    name: 'bank_connections',
    label: 'Bank Connections',
    module: 'Bank Feeds',
    description: 'Stores bank provider OAuth connections per user/account. Access tokens are encrypted at rest.',
    color: 'blue',
    rowEstimate: '~50',
    fields: [
      { name: 'id',               type: 'UUID',      nullable: false, primaryKey: true, default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'user_id',          type: 'UUID',      nullable: false, foreignKey: { table: 'users', field: 'id' }, description: 'FK → users — who connected this bank' },
      { name: 'bank_account_id',  type: 'UUID',      nullable: true,  foreignKey: { table: 'bank_accounts', field: 'id' }, description: 'FK → bank_accounts (internal account)' },
      { name: 'provider',         type: 'VARCHAR',   length: 50,  nullable: false, description: 'Provider code: ENBD, ADCB, FAB, MASHREQ, RAKBANK, CBD' },
      { name: 'bank_name',        type: 'VARCHAR',   length: 255, nullable: false, description: 'Human-readable bank name e.g. Emirates NBD' },
      { name: 'account_name',     type: 'VARCHAR',   length: 255, nullable: false, description: 'Account nickname e.g. Main Operating Account' },
      { name: 'account_number',   type: 'VARCHAR',   length: 50,  nullable: true,  description: 'Masked account number e.g. ****4521' },
      { name: 'account_type',     type: 'ENUM',      nullable: false, enumValues: ['current','savings','credit','deposit'], description: 'Account type' },
      { name: 'currency',         type: 'CHAR',      length: 3,   nullable: false, default: "'AED'", description: 'ISO 4217 currency code' },
      { name: 'access_token',     type: 'TEXT',      nullable: true,  description: 'Encrypted OAuth2 access token' },
      { name: 'refresh_token',    type: 'TEXT',      nullable: true,  description: 'Encrypted OAuth2 refresh token' },
      { name: 'token_expires_at', type: 'TIMESTAMP', nullable: true,  description: 'Access token expiry — trigger refresh before this' },
      { name: 'consent_expiry',   type: 'TIMESTAMP', nullable: true,  description: 'Open Banking consent expiry date' },
      { name: 'status',           type: 'ENUM',      nullable: false, enumValues: ['connected','disconnected','error','syncing','pending_auth'], default: "'pending_auth'", description: 'Connection status' },
      { name: 'sync_frequency',   type: 'ENUM',      nullable: false, enumValues: ['realtime','hourly','daily','manual'], default: "'daily'", description: 'How often to auto-sync' },
      { name: 'auto_match',       type: 'BOOLEAN',   nullable: false, default: 'true',  description: 'Auto-run matching engine after sync' },
      { name: 'auto_post',        type: 'BOOLEAN',   nullable: false, default: 'false', description: 'Auto-post matched transactions to GL' },
      { name: 'last_sync_at',     type: 'TIMESTAMP', nullable: true,  description: 'Last successful sync timestamp' },
      { name: 'next_sync_at',     type: 'TIMESTAMP', nullable: true,  description: 'Scheduled next sync (computed from frequency)' },
      { name: 'total_imported',   type: 'INT',       nullable: false, default: '0',     description: 'Cumulative imported transaction count' },
      { name: 'total_matched',    type: 'INT',       nullable: false, default: '0',     description: 'Cumulative matched transaction count' },
      { name: 'error_message',    type: 'TEXT',      nullable: true,  description: 'Last error message if status=error' },
      { name: 'metadata',         type: 'JSONB',     nullable: true,  description: 'Provider-specific extra data' },
      { name: 'created_at',       type: 'TIMESTAMP', nullable: false, default: 'NOW()', description: 'Connection created at' },
      { name: 'updated_at',       type: 'TIMESTAMP', nullable: false, default: 'NOW()', description: 'Last updated at' },
    ],
    indexes: [
      { name: 'idx_bc_user_id',   fields: ['user_id'],  description: 'All connections for a user' },
      { name: 'idx_bc_provider',  fields: ['provider'], description: 'Filter by bank provider' },
      { name: 'idx_bc_status',    fields: ['status'],   description: 'Filter active connections' },
      { name: 'idx_bc_next_sync', fields: ['next_sync_at'], description: 'Scheduler: find connections due for sync' },
    ],
  },
  {
    name: 'bank_feed_transactions',
    label: 'Bank Feed Transactions',
    module: 'Bank Feeds',
    description: 'Raw transactions fetched from bank providers via Open Banking API. Deduplicated by provider_reference.',
    color: 'blue',
    rowEstimate: '~50K/year',
    fields: [
      { name: 'id',                  type: 'UUID',      nullable: false, primaryKey: true, default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'bank_account_id',     type: 'UUID',      nullable: false, foreignKey: { table: 'bank_connections', field: 'id' }, description: 'FK → bank_connections' },
      { name: 'transaction_date',    type: 'DATE',      nullable: false, description: 'Transaction date from bank statement' },
      { name: 'value_date',          type: 'DATE',      nullable: true,  description: 'Value/settlement date (may differ from tx date)' },
      { name: 'description',         type: 'TEXT',      nullable: false, description: 'Bank-provided transaction description / narration' },
      { name: 'reference',           type: 'VARCHAR',   length: 255, nullable: true,  description: 'Bank reference / cheque number' },
      { name: 'provider_reference',  type: 'VARCHAR',   length: 255, nullable: false, unique: true, description: 'Bank provider unique ID — used for deduplication (UNIQUE)' },
      { name: 'amount',              type: 'DECIMAL',   length: '15,4', nullable: false, description: 'Transaction amount (positive = credit, negative = debit)' },
      { name: 'debit',               type: 'DECIMAL',   length: '15,4', nullable: false, default: '0', description: 'Debit (money out) amount' },
      { name: 'credit',              type: 'DECIMAL',   length: '15,4', nullable: false, default: '0', description: 'Credit (money in) amount' },
      { name: 'balance',             type: 'DECIMAL',   length: '15,4', nullable: true,  description: 'Running balance after this transaction' },
      { name: 'currency',            type: 'CHAR',      length: 3,   nullable: false, default: "'AED'", description: 'Transaction currency (ISO 4217)' },
      { name: 'original_amount',     type: 'DECIMAL',   length: '15,4', nullable: true,  description: 'Original FX amount (if different currency)' },
      { name: 'original_currency',   type: 'CHAR',      length: 3,   nullable: true,  description: 'Original currency before FX conversion' },
      { name: 'fx_rate',             type: 'DECIMAL',   length: '15,6', nullable: true,  description: 'Exchange rate applied' },
      { name: 'status',              type: 'ENUM',      nullable: false, enumValues: ['unmatched','matched','partial','ignored','pending'], default: "'unmatched'", description: 'Reconciliation status' },
      { name: 'category',            type: 'VARCHAR',   length: 100, nullable: true,  description: 'Auto-categorized: hotel, fuel, payroll, vat, rent…' },
      { name: 'merchant_name',       type: 'VARCHAR',   length: 255, nullable: true,  description: 'Enriched merchant name' },
      { name: 'merchant_category',   type: 'VARCHAR',   length: 100, nullable: true,  description: 'MCC category' },
      { name: 'is_pending',          type: 'BOOLEAN',   nullable: false, default: 'false', description: 'Pending/uncleared transaction flag' },
      { name: 'is_reversed',         type: 'BOOLEAN',   nullable: false, default: 'false', description: 'Reversed transaction flag' },
      { name: 'raw_data',            type: 'JSONB',     nullable: true,  description: 'Original raw JSON from bank API for audit' },
      { name: 'sync_id',             type: 'UUID',      nullable: true,  foreignKey: { table: 'bank_sync_logs', field: 'id' }, description: 'FK → bank_sync_logs (which sync created this)' },
      { name: 'matched_book_tx_id',  type: 'UUID',      nullable: true,  foreignKey: { table: 'book_transactions', field: 'id' }, description: 'FK → book_transactions (when matched)' },
      { name: 'match_score',         type: 'SMALLINT',  nullable: true,  description: 'Matching confidence score 0–100' },
      { name: 'match_method',        type: 'ENUM',      nullable: true,  enumValues: ['auto','manual','rule'], description: 'How it was matched' },
      { name: 'created_at',          type: 'TIMESTAMP', nullable: false, default: 'NOW()', description: 'Record inserted at' },
      { name: 'updated_at',          type: 'TIMESTAMP', nullable: false, default: 'NOW()', description: 'Last updated at' },
    ],
    indexes: [
      { name: 'idx_bft_account_id',       fields: ['bank_account_id'],    description: 'All transactions for a connection' },
      { name: 'idx_bft_provider_ref',     fields: ['provider_reference'],  unique: true, description: 'Deduplication — UNIQUE constraint' },
      { name: 'idx_bft_status',           fields: ['status'],              description: 'Filter by reconciliation status' },
      { name: 'idx_bft_date',             fields: ['transaction_date'],    description: 'Date range queries' },
      { name: 'idx_bft_matched_book',     fields: ['matched_book_tx_id'],  description: 'Find bank tx matched to a book tx' },
    ],
  },
  {
    name: 'bank_sync_logs',
    label: 'Bank Sync Logs',
    module: 'Bank Feeds',
    description: 'Log of every sync attempt (success, partial, error). Used for audit and retry.',
    color: 'blue',
    rowEstimate: '~5K/year',
    fields: [
      { name: 'id',              type: 'UUID',      nullable: false, primaryKey: true, default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'connection_id',   type: 'UUID',      nullable: false, foreignKey: { table: 'bank_connections', field: 'id' }, description: 'FK → bank_connections' },
      { name: 'status',          type: 'ENUM',      nullable: false, enumValues: ['success','partial','error','no_new'], description: 'Sync result status' },
      { name: 'fetched',         type: 'INT',       nullable: false, default: '0', description: 'Total rows fetched from provider' },
      { name: 'new_transactions',type: 'INT',       nullable: false, default: '0', description: 'Net new transactions inserted' },
      { name: 'duplicates',      type: 'INT',       nullable: false, default: '0', description: 'Duplicates detected and skipped' },
      { name: 'auto_matched',    type: 'INT',       nullable: false, default: '0', description: 'Transactions auto-matched in this sync' },
      { name: 'errors',          type: 'JSONB',     nullable: true,  description: 'Array of error messages' },
      { name: 'duration_ms',     type: 'INT',       nullable: true,  description: 'Sync duration in milliseconds' },
      { name: 'triggered_by',    type: 'ENUM',      nullable: false, enumValues: ['scheduler','manual','webhook'], description: 'What triggered this sync' },
      { name: 'synced_at',       type: 'TIMESTAMP', nullable: false, default: 'NOW()', description: 'Sync completed at' },
    ],
  },

  // ══════════════════════════════════════════════════════
  // BOOK TRANSACTIONS & RECONCILIATION
  // ══════════════════════════════════════════════════════
  {
    name: 'book_transactions',
    label: 'Book Transactions',
    module: 'Reconciliation',
    description: 'Internal accounting records (accounts receivable/payable movements). Source of truth for reconciliation.',
    color: 'cyan',
    rowEstimate: '~30K/year',
    fields: [
      { name: 'id',            type: 'UUID',      nullable: false, primaryKey: true, default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'date',          type: 'DATE',      nullable: false, description: 'Transaction date' },
      { name: 'description',   type: 'TEXT',      nullable: false, description: 'Internal description' },
      { name: 'reference',     type: 'VARCHAR',   length: 255, nullable: true,  description: 'Invoice/PO/payment reference' },
      { name: 'amount',        type: 'DECIMAL',   length: '15,4', nullable: false, description: 'Amount (signed: positive=debit, negative=credit)' },
      { name: 'type',          type: 'ENUM',      nullable: false, enumValues: ['debit','credit'], description: 'Transaction direction' },
      { name: 'category',      type: 'VARCHAR',   length: 100, nullable: true,  description: 'Category label' },
      { name: 'account_id',    type: 'UUID',      nullable: true,  foreignKey: { table: 'accounts', field: 'id' }, description: 'FK → chart of accounts' },
      { name: 'source_type',   type: 'ENUM',      nullable: true,  enumValues: ['invoice','payment','expense','journal','manual'], description: 'Source document type' },
      { name: 'source_id',     type: 'UUID',      nullable: true,  description: 'FK to source document (polymorphic)' },
      { name: 'status',        type: 'ENUM',      nullable: false, enumValues: ['unmatched','matched','partial','ignored'], default: "'unmatched'", description: 'Reconciliation status' },
      { name: 'created_by',    type: 'UUID',      nullable: true,  foreignKey: { table: 'users', field: 'id' }, description: 'FK → users' },
      { name: 'created_at',    type: 'TIMESTAMP', nullable: false, default: 'NOW()', description: 'Created at' },
    ],
  },
  {
    name: 'reconciliation_matches',
    label: 'Reconciliation Matches',
    module: 'Reconciliation',
    description: 'Links bank feed transactions to book transactions. Stores match metadata.',
    color: 'cyan',
    rowEstimate: '~25K/year',
    fields: [
      { name: 'id',                   type: 'UUID',      nullable: false, primaryKey: true, default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'bank_transaction_id',  type: 'UUID',      nullable: false, foreignKey: { table: 'bank_feed_transactions', field: 'id' }, description: 'FK → bank_feed_transactions' },
      { name: 'book_transaction_id',  type: 'UUID',      nullable: false, foreignKey: { table: 'book_transactions', field: 'id' }, description: 'FK → book_transactions' },
      { name: 'status',               type: 'ENUM',      nullable: false, enumValues: ['matched','partial','suggested'], description: 'Match status' },
      { name: 'match_score',          type: 'SMALLINT',  nullable: true,  description: 'Score 0–100 from matching engine' },
      { name: 'match_method',         type: 'ENUM',      nullable: false, enumValues: ['auto','manual','rule'], description: 'How matched' },
      { name: 'rule_id',              type: 'UUID',      nullable: true,  foreignKey: { table: 'matching_rules', field: 'id' }, description: 'FK → matching_rules (if rule-based)' },
      { name: 'difference',           type: 'DECIMAL',   length: '15,4', nullable: false, default: '0', description: 'Amount difference (0 = exact match)' },
      { name: 'difference_account_id',type: 'UUID',      nullable: true,  foreignKey: { table: 'accounts', field: 'id' }, description: 'Account to post difference (e.g. bank charges)' },
      { name: 'note',                 type: 'TEXT',      nullable: true,  description: 'Reconciler notes' },
      { name: 'matched_by',           type: 'UUID',      nullable: false, foreignKey: { table: 'users', field: 'id' }, description: 'FK → users — who matched it' },
      { name: 'matched_at',           type: 'TIMESTAMP', nullable: false, default: 'NOW()', description: 'When matched' },
      { name: 'unmatched_by',         type: 'UUID',      nullable: true,  foreignKey: { table: 'users', field: 'id' }, description: 'FK → users — who unmatched (if reversed)' },
      { name: 'unmatched_at',         type: 'TIMESTAMP', nullable: true,  description: 'When unmatched' },
    ],
    indexes: [
      { name: 'idx_rm_bank_tx',  fields: ['bank_transaction_id'], description: 'Find match by bank tx' },
      { name: 'idx_rm_book_tx',  fields: ['book_transaction_id'], description: 'Find match by book tx' },
      { name: 'uq_rm_bank_book', fields: ['bank_transaction_id','book_transaction_id'], unique: true, description: 'Prevent duplicate matches' },
    ],
  },
  {
    name: 'matching_rules',
    label: 'Matching Rules',
    module: 'Reconciliation',
    description: 'Configurable auto-matching rules with conditions (amount, date, reference) and actions.',
    color: 'cyan',
    rowEstimate: '~50',
    fields: [
      { name: 'id',          type: 'UUID',      nullable: false, primaryKey: true, default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'name',        type: 'VARCHAR',   length: 255, nullable: false, description: 'Rule name' },
      { name: 'priority',    type: 'SMALLINT',  nullable: false, default: '10', description: 'Lower = higher priority. Rules evaluated in priority order.' },
      { name: 'is_enabled',  type: 'BOOLEAN',   nullable: false, default: 'true', description: 'Rule active flag' },
      { name: 'conditions',  type: 'JSONB',     nullable: false, description: 'Array of {field, operator, value, weight} conditions' },
      { name: 'action',      type: 'JSONB',     nullable: false, description: '{type, matchTo, category, tags, notify}' },
      { name: 'auto_post',   type: 'BOOLEAN',   nullable: false, default: 'false', description: 'Auto-post to GL when rule fires' },
      { name: 'trigger_count', type: 'INT',     nullable: false, default: '0', description: 'How many times this rule has fired' },
      { name: 'created_by',  type: 'UUID',      nullable: true,  foreignKey: { table: 'users', field: 'id' }, description: 'FK → users' },
      { name: 'created_at',  type: 'TIMESTAMP', nullable: false, default: 'NOW()', description: 'Created at' },
      { name: 'updated_at',  type: 'TIMESTAMP', nullable: false, default: 'NOW()', description: 'Last updated at' },
    ],
  },

  // ══════════════════════════════════════════════════════
  // ACCOUNTS (Chart of Accounts)
  // ══════════════════════════════════════════════════════
  {
    name: 'accounts',
    label: 'Chart of Accounts',
    module: 'Accounting',
    description: 'Double-entry chart of accounts. Supports parent-child hierarchy and all 5 account types.',
    color: 'emerald',
    rowEstimate: '~200',
    fields: [
      { name: 'id',              type: 'UUID',      nullable: false, primaryKey: true, default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'account_code',    type: 'VARCHAR',   length: 20,  nullable: false, unique: true, description: 'Unique account code e.g. 1100' },
      { name: 'account_name',    type: 'VARCHAR',   length: 255, nullable: false, description: 'Account name e.g. Bank Account' },
      { name: 'account_type',    type: 'ENUM',      nullable: false, enumValues: ['Asset','Liability','Equity','Revenue','Expense'], description: 'Double-entry account type' },
      { name: 'parent_account_id', type: 'UUID',    nullable: true,  foreignKey: { table: 'accounts', field: 'id' }, description: 'Self-referential FK for hierarchy' },
      { name: 'description',     type: 'TEXT',      nullable: true,  description: 'Account notes' },
      { name: 'status',          type: 'ENUM',      nullable: false, enumValues: ['Active','Inactive'], default: "'Active'", description: 'Active/Inactive — cannot post to Inactive' },
      { name: 'is_default',      type: 'BOOLEAN',   nullable: false, default: 'false', description: 'System default — cannot be deleted' },
      { name: 'opening_balance', type: 'DECIMAL',   length: '15,4', nullable: false, default: '0', description: 'Opening balance amount' },
      { name: 'opening_balance_type', type: 'ENUM', nullable: false, enumValues: ['debit','credit'], default: "'debit'", description: 'Opening balance side' },
      { name: 'currency',        type: 'CHAR',      length: 3,   nullable: false, default: "'AED'", description: 'Account currency' },
      { name: 'created_at',      type: 'TIMESTAMP', nullable: false, default: 'NOW()', description: 'Created at' },
      { name: 'updated_at',      type: 'TIMESTAMP', nullable: false, default: 'NOW()', description: 'Updated at' },
    ],
    indexes: [
      { name: 'idx_accounts_code',   fields: ['account_code'], unique: true, description: 'Fast code lookup' },
      { name: 'idx_accounts_type',   fields: ['account_type'],              description: 'Filter by type' },
      { name: 'idx_accounts_parent', fields: ['parent_account_id'],         description: 'Tree traversal' },
    ],
  },

  // ══════════════════════════════════════════════════════
  // JOURNAL ENTRIES
  // ══════════════════════════════════════════════════════
  {
    name: 'journal_entries',
    label: 'Journal Entries',
    module: 'Accounting',
    description: 'Double-entry journal entries. Total debit must equal total credit before posting.',
    color: 'emerald',
    rowEstimate: '~20K/year',
    fields: [
      { name: 'id',            type: 'UUID',      nullable: false, primaryKey: true, default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'entry_number',  type: 'VARCHAR',   length: 50,  nullable: false, unique: true, description: 'Auto-generated e.g. JE-2024-0001' },
      { name: 'date',          type: 'DATE',      nullable: false, description: 'Transaction date (must be in open period)' },
      { name: 'description',   type: 'TEXT',      nullable: false, description: 'Entry description (required)' },
      { name: 'reference',     type: 'VARCHAR',   length: 255, nullable: false, description: 'External reference (invoice/PO number)' },
      { name: 'status',        type: 'ENUM',      nullable: false, enumValues: ['draft','pending_approval','approved','posted','reversed'], default: "'draft'", description: 'Approval workflow status' },
      { name: 'period_id',     type: 'UUID',      nullable: true,  foreignKey: { table: 'accounting_periods', field: 'id' }, description: 'FK → accounting_periods' },
      { name: 'currency',      type: 'CHAR',      length: 3,   nullable: false, default: "'AED'", description: 'Transaction currency' },
      { name: 'fx_rate',       type: 'DECIMAL',   length: '15,6', nullable: false, default: '1', description: 'Exchange rate to base currency' },
      { name: 'total_debit',   type: 'DECIMAL',   length: '15,4', nullable: false, description: 'Sum of all debit lines (computed)' },
      { name: 'total_credit',  type: 'DECIMAL',   length: '15,4', nullable: false, description: 'Sum of all credit lines (must equal total_debit)' },
      { name: 'source_type',   type: 'VARCHAR',   length: 50,  nullable: true,  description: 'invoice | expense | payment | revaluation | manual' },
      { name: 'source_id',     type: 'UUID',      nullable: true,  description: 'FK to source document (polymorphic)' },
      { name: 'tags',          type: 'JSONB',     nullable: true,  description: 'Free-form tags array' },
      { name: 'created_by',    type: 'UUID',      nullable: false, foreignKey: { table: 'users', field: 'id' }, description: 'FK → users' },
      { name: 'approved_by',   type: 'UUID',      nullable: true,  foreignKey: { table: 'users', field: 'id' }, description: 'FK → users (approver)' },
      { name: 'approved_at',   type: 'TIMESTAMP', nullable: true,  description: 'Approval timestamp' },
      { name: 'posted_by',     type: 'UUID',      nullable: true,  foreignKey: { table: 'users', field: 'id' }, description: 'FK → users (poster)' },
      { name: 'posted_at',     type: 'TIMESTAMP', nullable: true,  description: 'Posted to GL timestamp' },
      { name: 'reversed_by',   type: 'UUID',      nullable: true,  foreignKey: { table: 'users', field: 'id' }, description: 'FK → users (reverser)' },
      { name: 'reversed_entry_id', type: 'UUID',  nullable: true,  foreignKey: { table: 'journal_entries', field: 'id' }, description: 'Self-FK to reversal entry' },
      { name: 'created_at',    type: 'TIMESTAMP', nullable: false, default: 'NOW()', description: 'Created at' },
      { name: 'updated_at',    type: 'TIMESTAMP', nullable: false, default: 'NOW()', description: 'Updated at' },
    ],
    indexes: [
      { name: 'idx_je_number',  fields: ['entry_number'], unique: true, description: 'Unique entry number' },
      { name: 'idx_je_date',    fields: ['date'],                       description: 'Date range queries' },
      { name: 'idx_je_status',  fields: ['status'],                     description: 'Filter by workflow status' },
      { name: 'idx_je_period',  fields: ['period_id'],                  description: 'Filter by accounting period' },
    ],
  },
  {
    name: 'journal_entry_lines',
    label: 'Journal Entry Lines',
    module: 'Accounting',
    description: 'Individual debit/credit lines of a journal entry. Each line must reference a valid active account.',
    color: 'emerald',
    rowEstimate: '~60K/year',
    fields: [
      { name: 'id',           type: 'UUID',    nullable: false, primaryKey: true, default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'entry_id',     type: 'UUID',    nullable: false, foreignKey: { table: 'journal_entries', field: 'id' }, description: 'FK → journal_entries' },
      { name: 'account_id',   type: 'UUID',    nullable: false, foreignKey: { table: 'accounts', field: 'id' }, description: 'FK → accounts (must be Active)' },
      { name: 'debit',        type: 'DECIMAL', length: '15,4', nullable: false, default: '0', description: 'Debit amount (0 if credit line)' },
      { name: 'credit',       type: 'DECIMAL', length: '15,4', nullable: false, default: '0', description: 'Credit amount (0 if debit line)' },
      { name: 'description',  type: 'TEXT',    nullable: false, description: 'Line description (required)' },
      { name: 'reference',    type: 'VARCHAR', length: 255, nullable: true,  description: 'Line-level reference' },
      { name: 'tax_code',     type: 'VARCHAR', length: 20,  nullable: true,  description: 'VAT/tax code if applicable' },
      { name: 'line_order',   type: 'SMALLINT',nullable: false, default: '0', description: 'Display order within entry' },
    ],
    indexes: [
      { name: 'idx_jel_entry_id',   fields: ['entry_id'],   description: 'All lines for an entry' },
      { name: 'idx_jel_account_id', fields: ['account_id'], description: 'All lines for an account (GL)' },
    ],
  },
  {
    name: 'accounting_periods',
    label: 'Accounting Periods',
    module: 'Accounting',
    description: 'Fiscal periods. Closed/Locked periods prevent new postings. Prevents backdating abuse.',
    color: 'emerald',
    rowEstimate: '~60',
    fields: [
      { name: 'id',         type: 'UUID',      nullable: false, primaryKey: true, default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'name',       type: 'VARCHAR',   length: 100, nullable: false, description: 'e.g. January 2024, Q1 2024' },
      { name: 'start_date', type: 'DATE',      nullable: false, description: 'Period start' },
      { name: 'end_date',   type: 'DATE',      nullable: false, description: 'Period end' },
      { name: 'status',     type: 'ENUM',      nullable: false, enumValues: ['open','closed','locked'], default: "'open'", description: 'open=can post, closed=pending review, locked=no changes' },
      { name: 'closed_by',  type: 'UUID',      nullable: true,  foreignKey: { table: 'users', field: 'id' }, description: 'FK → users' },
      { name: 'closed_at',  type: 'TIMESTAMP', nullable: true,  description: 'When period was closed' },
      { name: 'created_at', type: 'TIMESTAMP', nullable: false, default: 'NOW()', description: 'Created at' },
    ],
  },

  // ══════════════════════════════════════════════════════
  // INVOICES & PAYMENTS
  // ══════════════════════════════════════════════════════
  {
    name: 'invoices',
    label: 'Invoices',
    module: 'Finance',
    description: 'Agent, customer, and supplier invoices. Cannot post to GL until Finance Approval.',
    color: 'violet',
    rowEstimate: '~10K/year',
    fields: [
      { name: 'id',              type: 'UUID',      nullable: false, primaryKey: true, default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'invoice_number',  type: 'VARCHAR',   length: 50,  nullable: false, unique: true, description: 'e.g. INV-2024-0001' },
      { name: 'type',            type: 'ENUM',      nullable: false, enumValues: ['agent','customer','supplier'], description: 'Invoice type' },
      { name: 'party_id',        type: 'UUID',      nullable: false, description: 'FK to agent, customer, or supplier (polymorphic)' },
      { name: 'party_type',      type: 'ENUM',      nullable: false, enumValues: ['agent','customer','supplier'], description: 'Polymorphic reference type' },
      { name: 'booking_ref',     type: 'VARCHAR',   length: 100, nullable: true,  description: 'Linked booking reference' },
      { name: 'issue_date',      type: 'DATE',      nullable: false, description: 'Invoice date' },
      { name: 'due_date',        type: 'DATE',      nullable: false, description: 'Payment due date' },
      { name: 'currency',        type: 'CHAR',      length: 3,   nullable: false, default: "'AED'", description: 'Invoice currency' },
      { name: 'fx_rate',         type: 'DECIMAL',   length: '15,6', nullable: false, default: '1', description: 'FX rate to base currency at invoice date' },
      { name: 'subtotal',        type: 'DECIMAL',   length: '15,4', nullable: false, description: 'Before VAT' },
      { name: 'vat_amount',      type: 'DECIMAL',   length: '15,4', nullable: false, default: '0', description: '5% UAE VAT' },
      { name: 'total_amount',    type: 'DECIMAL',   length: '15,4', nullable: false, description: 'subtotal + vat_amount' },
      { name: 'paid_amount',     type: 'DECIMAL',   length: '15,4', nullable: false, default: '0', description: 'Total payments received' },
      { name: 'outstanding',     type: 'DECIMAL',   length: '15,4', nullable: false, description: 'total_amount − paid_amount (computed)' },
      { name: 'status',          type: 'ENUM',      nullable: false, enumValues: ['draft','pending_approval','approved','sent','partial','paid','overdue','cancelled'], default: "'draft'", description: 'Invoice lifecycle status' },
      { name: 'approval_status', type: 'ENUM',      nullable: true,  enumValues: ['pending','approved','rejected'], description: 'Finance team approval status' },
      { name: 'approved_by',     type: 'UUID',      nullable: true,  foreignKey: { table: 'users', field: 'id' }, description: 'Finance approver FK → users' },
      { name: 'approved_at',     type: 'TIMESTAMP', nullable: true,  description: 'Approval timestamp' },
      { name: 'journal_entry_id',type: 'UUID',      nullable: true,  foreignKey: { table: 'journal_entries', field: 'id' }, description: 'Auto-created GL entry on approval' },
      { name: 'notes',           type: 'TEXT',      nullable: true,  description: 'Internal notes' },
      { name: 'trn_number',      type: 'VARCHAR',   length: 50,  nullable: true,  description: 'UAE TRN for VAT' },
      { name: 'created_by',      type: 'UUID',      nullable: false, foreignKey: { table: 'users', field: 'id' }, description: 'FK → users' },
      { name: 'created_at',      type: 'TIMESTAMP', nullable: false, default: 'NOW()', description: 'Created at' },
      { name: 'updated_at',      type: 'TIMESTAMP', nullable: false, default: 'NOW()', description: 'Updated at' },
    ],
  },
  {
    name: 'payments',
    label: 'Payments',
    module: 'Finance',
    description: 'All payment records — receipts from agents/customers and payments to suppliers.',
    color: 'violet',
    rowEstimate: '~8K/year',
    fields: [
      { name: 'id',             type: 'UUID',      nullable: false, primaryKey: true, default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'payment_ref',    type: 'VARCHAR',   length: 100, nullable: false, unique: true, description: 'e.g. PAY-2024-0001' },
      { name: 'invoice_id',     type: 'UUID',      nullable: true,  foreignKey: { table: 'invoices', field: 'id' }, description: 'FK → invoices' },
      { name: 'amount',         type: 'DECIMAL',   length: '15,4', nullable: false, description: 'Payment amount' },
      { name: 'currency',       type: 'CHAR',      length: 3,   nullable: false, default: "'AED'", description: 'Payment currency' },
      { name: 'fx_rate',        type: 'DECIMAL',   length: '15,6', nullable: false, default: '1', description: 'FX rate to base currency' },
      { name: 'method',         type: 'ENUM',      nullable: false, enumValues: ['bank_transfer','cash','card','cheque','online'], description: 'Payment method' },
      { name: 'bank_account_id',type: 'UUID',      nullable: true,  foreignKey: { table: 'bank_accounts', field: 'id' }, description: 'FK → bank_accounts' },
      { name: 'payment_date',   type: 'DATE',      nullable: false, description: 'Payment value date' },
      { name: 'reference',      type: 'VARCHAR',   length: 255, nullable: true,  description: 'Bank reference / cheque number' },
      { name: 'notes',          type: 'TEXT',      nullable: true,  description: 'Payment notes' },
      { name: 'status',         type: 'ENUM',      nullable: false, enumValues: ['pending','confirmed','reconciled','reversed'], default: "'pending'", description: 'Payment status' },
      { name: 'journal_entry_id', type: 'UUID',    nullable: true,  foreignKey: { table: 'journal_entries', field: 'id' }, description: 'Auto-created GL entry' },
      { name: 'created_by',     type: 'UUID',      nullable: false, foreignKey: { table: 'users', field: 'id' }, description: 'FK → users' },
      { name: 'created_at',     type: 'TIMESTAMP', nullable: false, default: 'NOW()', description: 'Created at' },
    ],
  },

  // ══════════════════════════════════════════════════════
  // EXPENSES
  // ══════════════════════════════════════════════════════
  {
    name: 'expenses',
    label: 'Expenses',
    module: 'Operations',
    description: 'Operational expense records. Cannot post to GL until Finance Approval.',
    color: 'orange',
    rowEstimate: '~5K/year',
    fields: [
      { name: 'id',              type: 'UUID',      nullable: false, primaryKey: true, default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'category',        type: 'VARCHAR',   length: 100, nullable: false, description: 'Fuel, Salary, Rent, Marketing etc.' },
      { name: 'supplier_id',     type: 'UUID',      nullable: true,  foreignKey: { table: 'suppliers', field: 'id' }, description: 'FK → suppliers' },
      { name: 'description',     type: 'TEXT',      nullable: true,  description: 'Description' },
      { name: 'amount',          type: 'DECIMAL',   length: '15,4', nullable: false, description: 'Expense amount' },
      { name: 'currency',        type: 'CHAR',      length: 3,   nullable: false, default: "'AED'", description: 'Currency' },
      { name: 'payment_mode',    type: 'ENUM',      nullable: false, enumValues: ['cash','bank','card','cheque'], description: 'Payment mode' },
      { name: 'expense_date',    type: 'DATE',      nullable: false, description: 'Expense date' },
      { name: 'status',          type: 'ENUM',      nullable: false, enumValues: ['pending','approved','rejected','posted'], default: "'pending'", description: 'Approval status' },
      { name: 'account_id',      type: 'UUID',      nullable: true,  foreignKey: { table: 'accounts', field: 'id' }, description: 'FK → accounts (expense GL account)' },
      { name: 'journal_entry_id',type: 'UUID',      nullable: true,  foreignKey: { table: 'journal_entries', field: 'id' }, description: 'Auto-created GL entry on approval' },
      { name: 'created_by',      type: 'UUID',      nullable: false, foreignKey: { table: 'users', field: 'id' }, description: 'FK → users' },
      { name: 'created_at',      type: 'TIMESTAMP', nullable: false, default: 'NOW()', description: 'Created at' },
    ],
  },

  // ══════════════════════════════════════════════════════
  // AUDIT TRAIL
  // ══════════════════════════════════════════════════════
  {
    name: 'audit_logs',
    label: 'Audit Logs',
    module: 'System',
    description: 'Immutable audit trail. Every create/update/delete/approve/post is logged with old and new values.',
    color: 'rose',
    rowEstimate: '~200K/year',
    fields: [
      { name: 'id',          type: 'UUID',      nullable: false, primaryKey: true, default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'user_id',     type: 'UUID',      nullable: false, foreignKey: { table: 'users', field: 'id' }, description: 'FK → users — who performed the action' },
      { name: 'action',      type: 'ENUM',      nullable: false, enumValues: ['create','update','delete','approve','reject','post','reverse','match','import'], description: 'Action type' },
      { name: 'module',      type: 'VARCHAR',   length: 100, nullable: false, description: 'Module name e.g. invoices, journal_entries' },
      { name: 'record_id',   type: 'UUID',      nullable: false, description: 'ID of the affected record' },
      { name: 'record_ref',  type: 'VARCHAR',   length: 255, nullable: true,  description: 'Human-readable reference e.g. INV-2024-0001' },
      { name: 'old_values',  type: 'JSONB',     nullable: true,  description: 'Snapshot of record BEFORE the change' },
      { name: 'new_values',  type: 'JSONB',     nullable: true,  description: 'Snapshot of record AFTER the change' },
      { name: 'diff',        type: 'JSONB',     nullable: true,  description: 'Computed diff — only changed fields' },
      { name: 'ip_address',  type: 'VARCHAR',   length: 45,  nullable: true,  description: 'Client IP address (IPv4/IPv6)' },
      { name: 'user_agent',  type: 'TEXT',      nullable: true,  description: 'Browser/client user agent' },
      { name: 'session_id',  type: 'VARCHAR',   length: 255, nullable: true,  description: 'Session identifier' },
      { name: 'timestamp',   type: 'TIMESTAMP', nullable: false, default: 'NOW()', description: 'Exact timestamp of action' },
    ],
    indexes: [
      { name: 'idx_al_user_id',   fields: ['user_id'],   description: 'All actions by user' },
      { name: 'idx_al_module',    fields: ['module'],    description: 'All actions in a module' },
      { name: 'idx_al_record_id', fields: ['record_id'], description: 'All actions on a record' },
      { name: 'idx_al_timestamp', fields: ['timestamp'], description: 'Chronological queries' },
    ],
  },

  // ══════════════════════════════════════════════════════
  // BANK ACCOUNTS (internal)
  // ══════════════════════════════════════════════════════
  {
    name: 'bank_accounts',
    label: 'Bank Accounts (Internal)',
    module: 'Finance',
    description: 'Internal bank/cash accounts managed in the system (separate from bank_connections).',
    color: 'violet',
    rowEstimate: '~20',
    fields: [
      { name: 'id',           type: 'UUID',    nullable: false, primaryKey: true, default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'name',         type: 'VARCHAR', length: 255, nullable: false, description: 'Account name e.g. Main ENBD Account' },
      { name: 'type',         type: 'ENUM',    nullable: false, enumValues: ['bank','cash','gateway'], description: 'Account type' },
      { name: 'bank_name',    type: 'VARCHAR', length: 255, nullable: true,  description: 'Bank name' },
      { name: 'account_no',   type: 'VARCHAR', length: 100, nullable: true,  description: 'Account number' },
      { name: 'iban',         type: 'VARCHAR', length: 34,  nullable: true,  description: 'IBAN' },
      { name: 'currency',     type: 'CHAR',    length: 3,   nullable: false, default: "'AED'", description: 'Account currency' },
      { name: 'balance',      type: 'DECIMAL', length: '15,4', nullable: false, default: '0', description: 'Current balance' },
      { name: 'gl_account_id',type: 'UUID',    nullable: true,  foreignKey: { table: 'accounts', field: 'id' }, description: 'FK → accounts (linked GL account)' },
      { name: 'is_active',    type: 'BOOLEAN', nullable: false, default: 'true', description: 'Active flag' },
      { name: 'created_at',   type: 'TIMESTAMP', nullable: false, default: 'NOW()', description: 'Created at' },
    ],
  },
];

// ─── API Endpoints ─────────────────────────────────────────────────────────────
export const API_ENDPOINTS = {
  bankConnections: [
    {
      method: 'GET' as const,
      path: '/api/v1/bank/connections',
      description: 'List all bank connections for the authenticated user',
      auth: 'Bearer JWT' as const,
      statusCodes: [{ code: 200, meaning: 'OK' }, { code: 401, meaning: 'Unauthorized' }],
    },
    {
      method: 'POST' as const,
      path: '/api/v1/bank/connections',
      description: 'Create a new bank connection (initiate OAuth flow)',
      auth: 'Bearer JWT' as const,
      requestBody: {
        provider: 'string (ENBD|ADCB|FAB|MASHREQ|RAKBANK|CBD)',
        account_name: 'string',
        currency: 'string (ISO 4217)',
        sync_frequency: 'string (realtime|hourly|daily|manual)',
        auto_match: 'boolean',
        auto_post: 'boolean',
      },
      statusCodes: [{ code: 201, meaning: 'Created' }, { code: 400, meaning: 'Validation Error' }, { code: 409, meaning: 'Already connected' }],
    },
    {
      method: 'POST' as const,
      path: '/api/v1/bank/connections/:id/sync',
      description: 'Trigger manual sync for a connection. Returns SyncResult.',
      auth: 'Bearer JWT' as const,
      statusCodes: [{ code: 200, meaning: 'Sync complete' }, { code: 404, meaning: 'Connection not found' }, { code: 422, meaning: 'Token expired' }],
    },
    {
      method: 'DELETE' as const,
      path: '/api/v1/bank/connections/:id',
      description: 'Disconnect bank (revoke consent, delete tokens)',
      auth: 'Bearer JWT' as const,
      statusCodes: [{ code: 204, meaning: 'Disconnected' }, { code: 404, meaning: 'Not found' }],
    },
    {
      method: 'POST' as const,
      path: '/api/v1/bank/connections/sync-all',
      description: 'Trigger sync for all active connections',
      auth: 'Bearer JWT' as const,
      statusCodes: [{ code: 200, meaning: 'All synced' }],
    },
  ],
  bankFeedTransactions: [
    {
      method: 'GET' as const,
      path: '/api/v1/bank/feed-transactions',
      description: 'List feed transactions with filters (status, date range, connection_id)',
      auth: 'Bearer JWT' as const,
      statusCodes: [{ code: 200, meaning: 'OK — paginated list' }],
    },
    {
      method: 'POST' as const,
      path: '/api/v1/bank/feed-transactions/import',
      description: 'Import transactions from CSV/Excel file. Runs deduplication and returns preview.',
      auth: 'Bearer JWT' as const,
      requestBody: { file: 'multipart/form-data (CSV|XLSX)', connection_id: 'UUID', preset_id: 'UUID (optional)' },
      statusCodes: [{ code: 200, meaning: 'Preview returned' }, { code: 422, meaning: 'Parse error' }],
    },
    {
      method: 'POST' as const,
      path: '/api/v1/bank/feed-transactions/import/confirm',
      description: 'Confirm import after preview. Inserts non-duplicate transactions.',
      auth: 'Bearer JWT' as const,
      requestBody: { import_id: 'string', selected_rows: 'UUID[]' },
      statusCodes: [{ code: 200, meaning: 'Imported' }, { code: 409, meaning: 'Duplicate detected' }],
    },
    {
      method: 'POST' as const,
      path: '/api/v1/bank/feed-transactions/auto-match',
      description: 'Run auto-matching engine on unmatched transactions. Returns match results.',
      auth: 'Bearer JWT' as const,
      requestBody: { connection_id: 'UUID (optional — all if omitted)' },
      statusCodes: [{ code: 200, meaning: 'Match results returned' }],
    },
    {
      method: 'PATCH' as const,
      path: '/api/v1/bank/feed-transactions/:id/status',
      description: 'Update transaction status (ignore, unmatch)',
      auth: 'Bearer JWT' as const,
      requestBody: { status: 'unmatched|ignored' },
      statusCodes: [{ code: 200, meaning: 'Updated' }],
    },
  ],
  reconciliationMatches: [
    {
      method: 'GET' as const,
      path: '/api/v1/reconciliation/matches',
      description: 'List all reconciliation matches with bank and book transaction details',
      auth: 'Bearer JWT' as const,
      statusCodes: [{ code: 200, meaning: 'OK' }],
    },
    {
      method: 'POST' as const,
      path: '/api/v1/reconciliation/matches',
      description: 'Manually match a bank transaction to a book transaction',
      auth: 'Bearer JWT' as const,
      requestBody: {
        bank_transaction_id: 'UUID',
        book_transaction_id: 'UUID',
        note: 'string (optional)',
        difference_account_id: 'UUID (optional — for partial matches)',
      },
      statusCodes: [{ code: 201, meaning: 'Matched' }, { code: 409, meaning: 'Already matched' }, { code: 422, meaning: 'Validation error' }],
    },
    {
      method: 'DELETE' as const,
      path: '/api/v1/reconciliation/matches/:id',
      description: 'Unmatch — restores both transactions to Unmatched status',
      auth: 'Bearer JWT' as const,
      statusCodes: [{ code: 204, meaning: 'Unmatched' }],
    },
    {
      method: 'POST' as const,
      path: '/api/v1/reconciliation/rules/:id/test',
      description: 'Test a matching rule against a pair of transactions',
      auth: 'Bearer JWT' as const,
      requestBody: { bank_tx_id: 'UUID', book_tx_id: 'UUID' },
      statusCodes: [{ code: 200, meaning: 'Test result with score breakdown' }],
    },
  ],
  journalEntries: [
    {
      method: 'GET' as const,
      path: '/api/v1/accounting/journal-entries',
      description: 'List journal entries with filters (status, date, period)',
      auth: 'Bearer JWT' as const,
      statusCodes: [{ code: 200, meaning: 'OK — paginated' }],
    },
    {
      method: 'POST' as const,
      path: '/api/v1/accounting/journal-entries',
      description: 'Create a new journal entry (draft). Validates: date, description, reference required. Lines validated. Dr = Cr required for posting.',
      auth: 'Bearer JWT' as const,
      requestBody: {
        date: 'DATE (YYYY-MM-DD)',
        description: 'string (required)',
        reference: 'string (required)',
        currency: 'string',
        lines: 'JournalLine[] — [{account_id, debit, credit, description}]',
      },
      statusCodes: [{ code: 201, meaning: 'Draft created' }, { code: 422, meaning: 'Validation error (unbalanced, inactive account, closed period)' }],
    },
    {
      method: 'POST' as const,
      path: '/api/v1/accounting/journal-entries/:id/post',
      description: 'Post entry to General Ledger. Validates period is open, Dr=Cr, all accounts active.',
      auth: 'Bearer JWT' as const,
      statusCodes: [{ code: 200, meaning: 'Posted' }, { code: 422, meaning: 'Unbalanced | Closed period | Inactive account' }],
    },
    {
      method: 'POST' as const,
      path: '/api/v1/accounting/journal-entries/:id/reverse',
      description: 'Create mirror reversal entry. Swaps all Dr/Cr lines.',
      auth: 'Bearer JWT' as const,
      statusCodes: [{ code: 201, meaning: 'Reversal entry created' }],
    },
  ],
};

// ─── SQL DDL Generator ────────────────────────────────────────────────────────
export function generateDDL(table: SchemaTable): string {
  const lines: string[] = [];
  lines.push(`-- ─── ${table.label} ───────────────────────────────────────`);
  lines.push(`CREATE TABLE ${table.name} (`);

  const fieldLines = table.fields.map((f) => {
    let def = `  ${f.name.padEnd(28)} `;
    if (f.type === 'ENUM' && f.enumValues) {
      def += `VARCHAR(50) CHECK (${f.name} IN (${f.enumValues.map((v) => `'${v}'`).join(', ')}))`;
    } else if (f.length) {
      def += `${f.type}(${f.length})`;
    } else {
      def += f.type;
    }
    if (!f.nullable) def += ' NOT NULL';
    if (f.default)   def += ` DEFAULT ${f.default}`;
    if (f.unique && !f.primaryKey) def += ' UNIQUE';
    return def;
  });

  const pks = table.fields.filter((f) => f.primaryKey);
  if (pks.length) fieldLines.push(`  PRIMARY KEY (${pks.map((f) => f.name).join(', ')})`);

  const fks = table.fields.filter((f) => f.foreignKey);
  fks.forEach((f) => {
    fieldLines.push(
      `  FOREIGN KEY (${f.name}) REFERENCES ${f.foreignKey!.table}(${f.foreignKey!.field}) ON DELETE SET NULL`
    );
  });

  lines.push(fieldLines.join(',\n'));
  lines.push(');');
  lines.push('');

  if (table.indexes?.length) {
    table.indexes.forEach((idx) => {
      lines.push(`CREATE ${idx.unique ? 'UNIQUE ' : ''}INDEX ${idx.name}`);
      lines.push(`  ON ${table.name} (${idx.fields.join(', ')});`);
    });
    lines.push('');
  }

  return lines.join('\n');
}
