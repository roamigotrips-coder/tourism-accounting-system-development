import { useState } from 'react';
import { Search, FileText, DollarSign, AlertTriangle, Check, Clock, Download, Copy, Database, Eye, CheckCircle } from 'lucide-react';

interface RecurringInvoice {
  id: string;
  profile_id: string;
  customer_name: string;
  plan_name: string;
  invoice_id: string | null;
  generation_date: string;
  period_start: string;
  period_end: string;
  amount: number;
  currency: string;
  is_prorated: boolean;
  status: 'generated' | 'sent' | 'paid' | 'overdue' | 'cancelled';
}

const SAMPLE_INVOICES: RecurringInvoice[] = [
  { id: 'RI-001', profile_id: 'RP-001', customer_name: 'ABC Travel LLC', plan_name: 'Monthly Maintenance', invoice_id: 'INV-2024-0101', generation_date: '2024-01-01', period_start: '2024-01-01', period_end: '2024-01-31', amount: 500, currency: 'AED', is_prorated: false, status: 'paid' },
  { id: 'RI-002', profile_id: 'RP-001', customer_name: 'ABC Travel LLC', plan_name: 'Monthly Maintenance', invoice_id: 'INV-2024-0132', generation_date: '2024-02-01', period_start: '2024-02-01', period_end: '2024-02-29', amount: 500, currency: 'AED', is_prorated: false, status: 'sent' },
  { id: 'RI-003', profile_id: 'RP-002', customer_name: 'XYZ Tours', plan_name: 'SaaS Annual', invoice_id: 'INV-2024-0088', generation_date: '2024-01-15', period_start: '2024-01-15', period_end: '2025-01-14', amount: 12000, currency: 'USD', is_prorated: false, status: 'paid' },
  { id: 'RI-004', profile_id: 'RP-003', customer_name: 'Gulf Adventures', plan_name: 'Weekly Transfers', invoice_id: null, generation_date: '2024-01-22', period_start: '2024-01-22', period_end: '2024-01-28', amount: 200, currency: 'AED', is_prorated: false, status: 'overdue' },
  { id: 'RI-005', profile_id: 'RP-004', customer_name: 'Desert Safaris Inc', plan_name: 'Quarterly Service', invoice_id: 'INV-2024-0145', generation_date: '2024-01-01', period_start: '2024-01-01', period_end: '2024-03-31', amount: 3000, currency: 'AED', is_prorated: false, status: 'paid' },
  { id: 'RI-006', profile_id: 'RP-001', customer_name: 'ABC Travel LLC', plan_name: 'Monthly Maintenance', invoice_id: null, generation_date: '2024-03-01', period_start: '2024-03-01', period_end: '2024-03-31', amount: 500, currency: 'AED', is_prorated: false, status: 'generated' },
];

const DDL = `-- recurring_invoices table
CREATE TABLE recurring_invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL REFERENCES recurring_profiles(id),
  invoice_id      UUID REFERENCES invoices(id),
  generation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status          VARCHAR(20) NOT NULL DEFAULT 'generated'
                  CHECK (status IN ('generated','sent','paid','overdue','cancelled','failed')),
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  amount          DECIMAL(15,4) NOT NULL CHECK (amount > 0),
  currency        CHAR(3) NOT NULL DEFAULT 'AED',
  is_prorated     BOOLEAN NOT NULL DEFAULT FALSE,
  proration_days  INT,
  tax_amount      DECIMAL(15,4) DEFAULT 0,
  total_amount    DECIMAL(15,4),
  sent_at         TIMESTAMP,
  paid_at         TIMESTAMP,
  notes           TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ri_profile    ON recurring_invoices(profile_id);
CREATE INDEX idx_ri_invoice    ON recurring_invoices(invoice_id);
CREATE INDEX idx_ri_status     ON recurring_invoices(status);
CREATE INDEX idx_ri_gen_date   ON recurring_invoices(generation_date);`;

export default function RecurringInvoices() {
  const [invoices, setInvoices] = useState<RecurringInvoice[]>(SAMPLE_INVOICES);
  const [tab, setTab] = useState<'invoices' | 'sql'>('invoices');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedInv, setSelectedInv] = useState<RecurringInvoice | null>(null);

  const paid = invoices.filter(i => i.status === 'paid');
  const overdue = invoices.filter(i => i.status === 'overdue');
  const outstanding = invoices.filter(i => ['generated', 'sent', 'overdue'].includes(i.status));

  const filtered = invoices.filter(i => {
    const matchSearch = i.customer_name.toLowerCase().includes(search.toLowerCase()) || i.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || i.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const markPaid = (id: string) => {
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'paid' as const } : i));
  };

  const statusColors: Record<string, string> = {
    generated: 'bg-blue-100 text-blue-700',
    sent: 'bg-purple-100 text-purple-700',
    paid: 'bg-emerald-100 text-emerald-700',
    overdue: 'bg-red-100 text-red-700',
    cancelled: 'bg-slate-100 text-slate-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Recurring Invoices</h1>
          <p className="text-slate-500 mt-1">Database table: <code className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono">recurring_invoices</code></p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Total Generated', value: invoices.length, icon: FileText, color: 'bg-blue-50 text-blue-700' },
          { label: 'Paid', value: paid.length, icon: Check, color: 'bg-emerald-50 text-emerald-700' },
          { label: 'Outstanding', value: `AED ${outstanding.reduce((s, i) => s + i.amount, 0).toLocaleString()}`, icon: DollarSign, color: 'bg-amber-50 text-amber-700' },
          { label: 'Overdue', value: overdue.length, icon: AlertTriangle, color: 'bg-red-50 text-red-700' },
          { label: 'Collection Rate', value: `${invoices.length > 0 ? Math.round(paid.length / invoices.length * 100) : 0}%`, icon: CheckCircle, color: 'bg-purple-50 text-purple-700' },
        ].map((k, i) => (
          <div key={i} className={`${k.color} rounded-xl p-4`}>
            <div className="flex items-center gap-2 mb-1"><k.icon size={14} /><span className="text-xs font-medium">{k.label}</span></div>
            <p className="text-xl font-bold">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {[
          { id: 'invoices' as const, label: 'Invoices', icon: FileText },
          { id: 'sql' as const, label: 'SQL Schema', icon: Database },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium ${tab === t.id ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'invoices' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices..." className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" />
            </div>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              {['all', 'generated', 'sent', 'paid', 'overdue'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-md text-xs font-medium ${statusFilter === s ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">ID</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Profile</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Customer</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Invoice #</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">Generated</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">Period</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Amount</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => (
                  <tr key={inv.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{inv.id}</td>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600">{inv.profile_id}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{inv.customer_name}</p>
                      <p className="text-xs text-slate-500">{inv.plan_name}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{inv.invoice_id || <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-3 text-center text-xs text-slate-600">{inv.generation_date}</td>
                    <td className="px-4 py-3 text-center text-xs text-slate-600">{inv.period_start} → {inv.period_end}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{inv.currency} {inv.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[inv.status]}`}>{inv.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setSelectedInv(inv)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"><Eye size={14} /></button>
                        {['generated', 'sent', 'overdue'].includes(inv.status) && (
                          <button onClick={() => markPaid(inv.id)} className="p-1.5 hover:bg-emerald-50 rounded text-slate-400 hover:text-emerald-600"><CheckCircle size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {overdue.length > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center gap-2 text-red-700 font-medium mb-2"><AlertTriangle size={16} /> {overdue.length} Overdue Invoice(s)</div>
              <div className="space-y-2">
                {overdue.map(o => (
                  <div key={o.id} className="flex items-center justify-between text-sm">
                    <span className="text-red-600">{o.customer_name} — {o.plan_name}</span>
                    <span className="font-mono font-semibold text-red-700">{o.currency} {o.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'sql' && (
        <div className="space-y-4">
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => navigator.clipboard.writeText(DDL)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-sm"><Copy size={14} /> Copy</button>
            <button onClick={() => {
              const b = new Blob([DDL], { type: 'text/sql' });
              const u = URL.createObjectURL(b);
              const a = document.createElement('a');
              a.href = u; a.download = 'recurring_invoices.sql'; a.click();
            }} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm"><Download size={14} /> Download .sql</button>
          </div>
          <pre className="bg-slate-900 text-green-400 p-6 rounded-xl text-sm overflow-auto max-h-[600px] font-mono leading-relaxed">{DDL}</pre>
        </div>
      )}

      {/* View Modal */}
      {selectedInv && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{selectedInv.id}</h2>
              <button onClick={() => setSelectedInv(null)} className="p-2 hover:bg-slate-100 rounded-lg">✕</button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Customer</p>
                  <p className="font-medium">{selectedInv.customer_name}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Plan</p>
                  <p className="font-medium">{selectedInv.plan_name}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Amount</p>
                  <p className="font-bold text-lg">{selectedInv.currency} {selectedInv.amount.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Status</p>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[selectedInv.status]}`}>{selectedInv.status}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Period</p>
                  <p className="text-sm">{selectedInv.period_start} → {selectedInv.period_end}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Profile</p>
                  <p className="font-mono text-sm text-blue-600">{selectedInv.profile_id}</p>
                </div>
              </div>
              {selectedInv.is_prorated && (
                <div className="p-3 bg-amber-50 rounded-lg text-sm text-amber-700">
                  <Clock size={14} className="inline mr-1" /> This invoice was prorated for a partial period
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
