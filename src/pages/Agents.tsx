import { useState, useEffect } from 'react';
import { Search, Plus, Eye, FileText, X, Save, DollarSign } from 'lucide-react';
import type { Agent } from '../data/mockData';
import { fetchAgents, upsertAgent } from '../lib/supabaseSync';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import RecordPaymentModal, { type RecordPaymentConfig, type PaymentRecord } from '../components/RecordPaymentModal';

const countries = ['United Kingdom', 'Germany', 'France', 'India', 'USA', 'Australia', 'UAE', 'Singapore', 'Japan', 'China'];
const paymentTermsList = ['Net 15', 'Net 30', 'Net 45', 'Net 60', 'Advance', 'On Delivery'];
const statusOptions = ['Active', 'Inactive'];

interface AgentForm {
  name: string;
  country: string;
  email: string;
  phone: string;
  creditLimit: string;
  commission: string;
  paymentTerms: string;
  status: string;
}

const emptyForm: AgentForm = {
  name: '', country: '', email: '', phone: '',
  creditLimit: '', commission: '', paymentTerms: 'Net 30', status: 'Active',
};

export default function Agents() {
  const [search, setSearch] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<AgentForm>(emptyForm);
  const [agentList, setAgentList] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<RecordPaymentConfig | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<Record<string, PaymentRecord[]>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAgents();
        if (!cancelled && data) setAgentList(data);
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = agentList.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.country.toLowerCase().includes(search.toLowerCase())
  );
  const totalOutstanding = agentList.reduce((s, a) => s + a.outstanding, 0);
  const totalBookings = agentList.reduce((s, a) => s + a.totalBookings, 0);
  const agentChartData = agentList.filter(a => a.status === 'Active').map(a => ({
    name: a.name.split(' ')[0], outstanding: a.outstanding, limit: a.creditLimit
  }));
  const selected = selectedAgent ? agentList.find(a => a.id === selectedAgent) : null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const openPaymentModal = (agent: typeof agentList[0]) => {
    setPaymentConfig({
      invoiceId: `AGENT-${agent.id}`,
      partyName: agent.name,
      partyType: 'Agent',
      totalAmount: agent.outstanding,
      paidAmount: 0,
      currency: 'AED',
      existingPayments: paymentHistory[agent.id] || [],
    });
  };

  const handlePaymentSave = (payment: PaymentRecord, newStatus: 'Paid' | 'Partial' | 'Unpaid') => {
    if (!paymentConfig) return;
    const agentId = paymentConfig.invoiceId.replace('AGENT-', '');
    setPaymentHistory(prev => ({ ...prev, [agentId]: [...(prev[agentId] || []), payment] }));
    setAgentList(prev => {
      const updated = prev.map(a =>
        a.id === agentId
          ? { ...a, outstanding: newStatus === 'Paid' ? 0 : Math.max(0, a.outstanding - payment.amount) }
          : a
      );
      const changedAgent = updated.find(a => a.id === agentId);
      if (changedAgent) upsertAgent(changedAgent).catch(() => {});
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newAgent = {
      id: `AG-${String(agentList.length + 1).padStart(3, '0')}`,
      name: form.name,
      country: form.country,
      email: form.email,
      phone: form.phone,
      creditLimit: parseFloat(form.creditLimit) || 0,
      outstanding: 0,
      commission: parseFloat(form.commission) || 0,
      paymentTerms: form.paymentTerms,
      status: form.status as 'Active' | 'Inactive',
      totalBookings: 0,
    };
    setAgentList(prev => [newAgent, ...prev]);
    upsertAgent(newAgent).catch(() => {});
    setForm(emptyForm);
    setShowModal(false);
  };

  if (loading) return <LoadingSpinner message="Loading agents..." />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Agent Management</h1>
          <p className="text-slate-500 mt-1">B2B agent relationships & tracking</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 text-sm font-medium">
          <Plus size={16} /> Add Agent
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 uppercase">Total Agents</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{agentList.length}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 uppercase">Active Agents</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{agentList.filter(a => a.status === 'Active').length}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 uppercase">Total Outstanding</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">AED {totalOutstanding.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 uppercase">Total Bookings</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{totalBookings}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="p-5 border-b border-slate-100">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search agents..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Agent</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Country</th>
                  <th className="text-right px-5 py-3 font-medium text-slate-600">Credit Limit</th>
                  <th className="text-right px-5 py-3 font-medium text-slate-600">Outstanding</th>
                  <th className="text-center px-5 py-3 font-medium text-slate-600">Commission</th>
                  <th className="text-center px-5 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-center px-5 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-800">{a.name}</div>
                      <div className="text-xs text-slate-400">{a.id}</div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{a.country}</td>
                    <td className="px-5 py-3 text-right text-slate-800">AED {a.creditLimit.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right font-medium text-amber-600">AED {a.outstanding.toLocaleString()}</td>
                    <td className="px-5 py-3 text-center text-slate-600">{a.commission}%</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${a.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{a.status}</span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button onClick={() => setSelectedAgent(a.id)} className="text-blue-500 hover:text-blue-700"><Eye size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          {selected ? (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800">Agent Details</h3>
                <button onClick={() => setSelectedAgent(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Name</span><span className="font-medium">{selected.name}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Country</span><span>{selected.country}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Email</span><span className="text-blue-600">{selected.email}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Phone</span><span>{selected.phone}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Payment Terms</span><span>{selected.paymentTerms}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Commission</span><span className="font-medium text-emerald-600">{selected.commission}%</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Total Bookings</span><span className="font-medium">{selected.totalBookings}</span></div>
                <hr className="border-slate-100" />
                <div className="flex justify-between"><span className="text-slate-500">Credit Limit</span><span className="font-bold">AED {selected.creditLimit.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Outstanding</span><span className="font-bold text-amber-600">AED {selected.outstanding.toLocaleString()}</span></div>
                <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
                  <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${Math.min((selected.outstanding / selected.creditLimit) * 100, 100)}%` }} />
                </div>
                <p className="text-xs text-slate-400">{((selected.outstanding / selected.creditLimit) * 100).toFixed(1)}% of credit limit used</p>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <button
                  onClick={() => openPaymentModal(selected)}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  <DollarSign size={15} /> Record Payment
                </button>
                <div className="flex gap-2">
                  <button className="flex-1 flex items-center justify-center gap-1 bg-blue-50 text-blue-600 py-2 rounded-lg text-xs font-medium hover:bg-blue-100"><FileText size={14} /> Statement</button>
                  <button className="flex-1 flex items-center justify-center gap-1 bg-slate-50 text-slate-600 py-2 rounded-lg text-xs font-medium hover:bg-slate-100"><FileText size={14} /> Ledger</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-800 mb-4">Outstanding by Agent</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={agentChartData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v / 1000}K`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
                  <Tooltip formatter={(v: any) => `AED ${Number(v).toLocaleString()}`} />
                  <Bar dataKey="outstanding" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Record Payment Modal */}
      {paymentConfig && (
        <RecordPaymentModal
          config={paymentConfig}
          onClose={() => setPaymentConfig(null)}
          onSave={(payment, newStatus) => {
            handlePaymentSave(payment, newStatus);
            setPaymentConfig(null);
          }}
        />
      )}

      {/* Add Agent Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Add New Agent</h2>
                <p className="text-sm text-slate-500 mt-0.5">Create a new B2B travel agent profile</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Agency / Company Name <span className="text-red-500">*</span></label>
                  <input name="name" value={form.name} onChange={handleChange} required placeholder="e.g. Global Tours Ltd"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Country <span className="text-red-500">*</span></label>
                  <select name="country" value={form.country} onChange={handleChange} required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                    <option value="">Select Country</option>
                    {countries.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input name="phone" value={form.phone} onChange={handleChange} placeholder="+44 20 1234 5678"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email <span className="text-red-500">*</span></label>
                  <input type="email" name="email" value={form.email} onChange={handleChange} required placeholder="agent@company.com"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Credit Limit (AED)</label>
                  <input type="number" name="creditLimit" value={form.creditLimit} onChange={handleChange} min="0" placeholder="50000"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Commission (%)</label>
                  <input type="number" name="commission" value={form.commission} onChange={handleChange} min="0" max="100" step="0.5" placeholder="10"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Terms</label>
                  <select name="paymentTerms" value={form.paymentTerms} onChange={handleChange}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                    {paymentTermsList.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select name="status" value={form.status} onChange={handleChange}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                    {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
                  <Save size={16} /> Add Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
