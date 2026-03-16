import { useState } from 'react';
import { Database, Copy, Download, ChevronDown, ChevronUp, Table2 } from 'lucide-react';

const TABLES = [
  { name: 'users', module: 'Auth', color: 'bg-slate-600', fields: [
    { name: 'id', type: 'UUID', pk: true }, { name: 'name', type: 'VARCHAR(100)' }, { name: 'email', type: 'VARCHAR(200)', unique: true },
    { name: 'role', type: 'VARCHAR(50)' }, { name: 'password_hash', type: 'TEXT' }, { name: 'created_at', type: 'TIMESTAMP' },
  ]},
  { name: 'bank_connections', module: 'Bank Feeds', color: 'bg-blue-600', fields: [
    { name: 'id', type: 'UUID', pk: true }, { name: 'user_id', type: 'UUID', fk: 'users' }, { name: 'provider', type: 'VARCHAR(50)' },
    { name: 'bank_name', type: 'VARCHAR(100)' }, { name: 'access_token', type: 'TEXT' }, { name: 'refresh_token', type: 'TEXT' },
    { name: 'account_number', type: 'VARCHAR(50)' }, { name: 'currency', type: 'CHAR(3)' }, { name: 'status', type: 'ENUM' },
    { name: 'auto_match', type: 'BOOLEAN' }, { name: 'last_sync_at', type: 'TIMESTAMP' }, { name: 'created_at', type: 'TIMESTAMP' },
  ]},
  { name: 'bank_feed_transactions', module: 'Bank Feeds', color: 'bg-blue-600', fields: [
    { name: 'id', type: 'UUID', pk: true }, { name: 'bank_account_id', type: 'UUID', fk: 'bank_connections' },
    { name: 'transaction_date', type: 'DATE' }, { name: 'description', type: 'TEXT' }, { name: 'amount', type: 'DECIMAL(15,4)' },
    { name: 'currency', type: 'CHAR(3)' }, { name: 'provider_reference', type: 'VARCHAR(200)', unique: true },
    { name: 'debit', type: 'DECIMAL(15,4)' }, { name: 'credit', type: 'DECIMAL(15,4)' }, { name: 'balance', type: 'DECIMAL(15,4)' },
    { name: 'status', type: 'ENUM' }, { name: 'created_at', type: 'TIMESTAMP' },
  ]},
  { name: 'currencies', module: 'Multi-Currency', color: 'bg-emerald-600', fields: [
    { name: 'id', type: 'UUID', pk: true }, { name: 'currency_code', type: 'CHAR(3)', unique: true }, { name: 'currency_name', type: 'VARCHAR(100)' },
    { name: 'symbol', type: 'VARCHAR(10)' }, { name: 'status', type: 'ENUM active/inactive' }, { name: 'is_base', type: 'BOOLEAN' },
    { name: 'decimal_places', type: 'INT' }, { name: 'created_at', type: 'TIMESTAMP' }, { name: 'updated_at', type: 'TIMESTAMP' },
  ]},
  { name: 'exchange_rates', module: 'Multi-Currency', color: 'bg-emerald-600', fields: [
    { name: 'id', type: 'UUID', pk: true }, { name: 'currency_code', type: 'CHAR(3)', fk: 'currencies' },
    { name: 'rate', type: 'DECIMAL(18,6)' }, { name: 'effective_date', type: 'DATE' }, { name: 'source', type: 'ENUM' },
    { name: 'base_currency', type: 'CHAR(3)' }, { name: 'inverse_rate', type: 'DECIMAL(18,6)' }, { name: 'created_by', type: 'UUID', fk: 'users' },
    { name: 'created_at', type: 'TIMESTAMP' },
  ]},
  { name: 'accounts', module: 'Chart of Accounts', color: 'bg-violet-600', fields: [
    { name: 'id', type: 'UUID', pk: true }, { name: 'account_code', type: 'VARCHAR(20)', unique: true }, { name: 'account_name', type: 'VARCHAR(200)' },
    { name: 'account_type', type: 'ENUM' }, { name: 'parent_id', type: 'UUID', fk: 'accounts' }, { name: 'description', type: 'TEXT' },
    { name: 'status', type: 'ENUM active/inactive' }, { name: 'is_default', type: 'BOOLEAN' }, { name: 'created_at', type: 'TIMESTAMP' },
  ]},
  { name: 'journal_entries', module: 'Accounting', color: 'bg-indigo-600', fields: [
    { name: 'id', type: 'UUID', pk: true }, { name: 'entry_date', type: 'DATE' }, { name: 'reference', type: 'VARCHAR(100)' },
    { name: 'description', type: 'TEXT' }, { name: 'status', type: 'ENUM' }, { name: 'created_by', type: 'UUID', fk: 'users' },
    { name: 'posted_by', type: 'UUID', fk: 'users' }, { name: 'posted_at', type: 'TIMESTAMP' }, { name: 'period', type: 'VARCHAR(7)' },
  ]},
  { name: 'journal_entry_lines', module: 'Accounting', color: 'bg-indigo-600', fields: [
    { name: 'id', type: 'UUID', pk: true }, { name: 'journal_entry_id', type: 'UUID', fk: 'journal_entries' },
    { name: 'account_id', type: 'UUID', fk: 'accounts' }, { name: 'debit_currency', type: 'DECIMAL(18,4)' },
    { name: 'credit_currency', type: 'DECIMAL(18,4)' }, { name: 'debit_base', type: 'DECIMAL(18,4)' },
    { name: 'credit_base', type: 'DECIMAL(18,4)' }, { name: 'exchange_rate', type: 'DECIMAL(18,6)' },
    { name: 'currency_code', type: 'CHAR(3)', fk: 'currencies' }, { name: 'description', type: 'TEXT' },
  ]},
  { name: 'invoices', module: 'Finance', color: 'bg-amber-600', fields: [
    { name: 'id', type: 'UUID', pk: true }, { name: 'invoice_number', type: 'VARCHAR(50)', unique: true }, { name: 'type', type: 'ENUM' },
    { name: 'party', type: 'VARCHAR(200)' }, { name: 'amount', type: 'DECIMAL(15,4)' }, { name: 'vat', type: 'DECIMAL(15,4)' },
    { name: 'total', type: 'DECIMAL(15,4)' }, { name: 'currency', type: 'CHAR(3)' }, { name: 'status', type: 'ENUM' },
    { name: 'date', type: 'DATE' }, { name: 'due_date', type: 'DATE' }, { name: 'created_at', type: 'TIMESTAMP' },
  ]},
  { name: 'approval_workflows', module: 'Approvals', color: 'bg-rose-600', fields: [
    { name: 'id', type: 'UUID', pk: true }, { name: 'module', type: 'VARCHAR(50)' }, { name: 'threshold_amount', type: 'DECIMAL(15,2)' },
    { name: 'approver_role', type: 'VARCHAR(100)' }, { name: 'sequence', type: 'INT' }, { name: 'is_active', type: 'BOOLEAN' }, { name: 'created_at', type: 'TIMESTAMP' },
  ]},
  { name: 'approval_requests', module: 'Approvals', color: 'bg-rose-600', fields: [
    { name: 'id', type: 'UUID', pk: true }, { name: 'module', type: 'VARCHAR(50)' }, { name: 'record_id', type: 'VARCHAR(100)' },
    { name: 'requested_by', type: 'UUID', fk: 'users' }, { name: 'status', type: 'ENUM' }, { name: 'amount', type: 'DECIMAL(15,2)' },
    { name: 'currency', type: 'CHAR(3)' }, { name: 'created_at', type: 'TIMESTAMP' },
  ]},
  { name: 'approval_actions', module: 'Approvals', color: 'bg-rose-600', fields: [
    { name: 'id', type: 'UUID', pk: true }, { name: 'request_id', type: 'UUID', fk: 'approval_requests' },
    { name: 'user_id', type: 'UUID', fk: 'users' }, { name: 'action', type: 'VARCHAR(50)' }, { name: 'comments', type: 'TEXT' },
    { name: 'timestamp', type: 'TIMESTAMP' },
  ]},
  { name: 'recurring_profiles', module: 'Recurring Billing', color: 'bg-teal-600', fields: [
    { name: 'id', type: 'UUID', pk: true }, { name: 'customer_id', type: 'UUID' }, { name: 'plan_name', type: 'VARCHAR(200)' },
    { name: 'frequency', type: 'ENUM' }, { name: 'start_date', type: 'DATE' }, { name: 'end_date', type: 'DATE' },
    { name: 'amount', type: 'DECIMAL(15,4)' }, { name: 'currency', type: 'CHAR(3)' }, { name: 'status', type: 'ENUM' },
    { name: 'next_billing_date', type: 'DATE' }, { name: 'created_at', type: 'TIMESTAMP' },
  ]},
  { name: 'recurring_invoices', module: 'Recurring Billing', color: 'bg-teal-600', fields: [
    { name: 'id', type: 'UUID', pk: true }, { name: 'profile_id', type: 'UUID', fk: 'recurring_profiles' },
    { name: 'invoice_id', type: 'UUID', fk: 'invoices' }, { name: 'generation_date', type: 'DATE' },
    { name: 'status', type: 'ENUM' }, { name: 'amount', type: 'DECIMAL(15,4)' }, { name: 'is_prorated', type: 'BOOLEAN' },
  ]},
  { name: 'audit_logs', module: 'System', color: 'bg-slate-700', fields: [
    { name: 'id', type: 'UUID', pk: true }, { name: 'user_id', type: 'UUID', fk: 'users' }, { name: 'module', type: 'VARCHAR(50)' },
    { name: 'action', type: 'ENUM' }, { name: 'record_id', type: 'VARCHAR(100)' }, { name: 'old_value', type: 'JSONB' },
    { name: 'new_value', type: 'JSONB' }, { name: 'ip_address', type: 'INET' }, { name: 'timestamp', type: 'TIMESTAMP' },
  ]},
];

function generateDDL(table: typeof TABLES[0]) {
  const lines = table.fields.map(f => {
    let line = `  ${f.name.padEnd(25)} ${f.type}`;
    if (f.pk) line += ' PRIMARY KEY DEFAULT gen_random_uuid()';
    if (f.unique) line += ' UNIQUE NOT NULL';
    if (f.fk) line += ` REFERENCES ${f.fk}(id)`;
    return line;
  });
  return `CREATE TABLE ${table.name} (\n${lines.join(',\n')}\n);`;
}

export default function DatabaseSchema() {
  const [expanded, setExpanded] = useState<string|null>('bank_connections');
  const [selectedDDL, setSelectedDDL] = useState<string|null>(null);
  const [copied, setCopied] = useState(false);
  const [moduleFilter, setModuleFilter] = useState('All');

  const modules = ['All', ...Array.from(new Set(TABLES.map(t => t.module)))];
  const filtered = moduleFilter === 'All' ? TABLES : TABLES.filter(t => t.module === moduleFilter);

  const copyAll = () => {
    const all = TABLES.map(generateDDL).join('\n\n');
    navigator.clipboard.writeText(all);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const downloadSQL = () => {
    const all = TABLES.map(generateDDL).join('\n\n');
    const blob = new Blob([all], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'accountspro_schema.sql'; a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Database Schema</h1>
          <p className="text-slate-500 mt-1">{TABLES.length} tables · Double-entry accounting standard</p>
        </div>
        <div className="flex gap-2">
          <button onClick={copyAll} className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50">
            <Copy size={15} /> {copied ? 'Copied!' : 'Copy All SQL'}
          </button>
          <button onClick={downloadSQL} className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900">
            <Download size={15} /> Download .sql
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Tables', value: TABLES.length },
          { label: 'Total Fields', value: TABLES.reduce((s,t)=>s+t.fields.length,0) },
          { label: 'Modules', value: modules.length - 1 },
          { label: 'FK Relations', value: TABLES.reduce((s,t)=>s+t.fields.filter(f=>f.fk).length,0) },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
            <p className="text-xs text-slate-500 uppercase tracking-wide">{k.label}</p>
            <p className="text-2xl font-bold mt-1 text-slate-800">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Module Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {modules.map(m => (
          <button key={m} onClick={() => setModuleFilter(m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${moduleFilter===m?'bg-slate-800 text-white':'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {m}
          </button>
        ))}
      </div>

      {/* Tables */}
      <div className="space-y-3">
        {filtered.map(table => (
          <div key={table.name} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50"
              onClick={() => setExpanded(expanded===table.name?null:table.name)}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 ${table.color} rounded-lg flex items-center justify-center`}>
                  <Table2 size={14} className="text-white" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 font-mono">{table.name}</p>
                  <p className="text-xs text-slate-400">{table.module} · {table.fields.length} fields</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={e => { e.stopPropagation(); setSelectedDDL(generateDDL(table)); }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs font-medium text-slate-600">SQL</button>
                {expanded===table.name ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
              </div>
            </div>
            {expanded === table.name && (
              <div className="border-t border-slate-100 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-50 text-left">
                    <th className="px-4 py-2.5 font-medium text-slate-600">Field Name</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600">Type</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600">Constraints</th>
                  </tr></thead>
                  <tbody>
                    {table.fields.map(f => (
                      <tr key={f.name} className="border-t border-slate-50">
                        <td className="px-4 py-2.5 font-mono font-semibold text-slate-700">{f.name}</td>
                        <td className="px-4 py-2.5 text-blue-600 font-mono">{f.type}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1 flex-wrap">
                            {f.pk && <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded font-medium">PK</span>}
                            {f.unique && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">UNIQUE</span>}
                            {f.fk && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">FK→{f.fk}</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* DDL Modal */}
      {selectedDDL && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-800 flex items-center gap-2"><Database size={18}/> SQL DDL</h2>
              <button onClick={() => setSelectedDDL(null)} className="p-2 hover:bg-slate-100 rounded-lg">✕</button>
            </div>
            <div className="p-5">
              <pre className="bg-slate-900 text-emerald-400 p-4 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">{selectedDDL}</pre>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => { navigator.clipboard.writeText(selectedDDL); setCopied(true); setTimeout(()=>setCopied(false),2000); }}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">
                  <Copy size={14}/> {copied?'Copied!':'Copy'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
