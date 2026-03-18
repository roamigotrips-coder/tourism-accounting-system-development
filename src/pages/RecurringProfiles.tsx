import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Play, Pause, RotateCcw, DollarSign, Users, Calendar, Check, X } from 'lucide-react';
import { fetchRecurringProfiles, upsertRecurringProfile, type RecurringProfile } from '../lib/supabaseSync';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';

export default function RecurringProfiles() {
  const [profiles, setProfiles] = useState<RecurringProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form state
  // formName removed - using formCustomer + formPlan
  const [formCustomer, setFormCustomer] = useState('');
  const [formPlan, setFormPlan] = useState('');
  const [formFrequency, setFormFrequency] = useState<RecurringProfile['frequency']>('monthly');
  const [formAmount, setFormAmount] = useState('');
  const [formCurrency, setFormCurrency] = useState('AED');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formAnchor, setFormAnchor] = useState('1');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchRecurringProfiles().then(data => {
      if (cancelled) return;
      if (data) { setProfiles(data); setError(null); }
      else setError('Failed to load recurring profiles');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const activeProfiles = profiles.filter(p => p.status === 'active');
  const mrr = activeProfiles.filter(p => p.frequency === 'monthly').reduce((s, p) => s + p.amount, 0)
    + activeProfiles.filter(p => p.frequency === 'weekly').reduce((s, p) => s + p.amount * 4.33, 0)
    + activeProfiles.filter(p => p.frequency === 'quarterly').reduce((s, p) => s + p.amount / 3, 0)
    + activeProfiles.filter(p => p.frequency === 'yearly').reduce((s, p) => s + p.amount / 12, 0);

  const filtered = profiles.filter(p => {
    const matchSearch = p.customerName.toLowerCase().includes(search.toLowerCase()) || p.planName.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const resetForm = () => {
    setFormCustomer(''); setFormPlan(''); setFormFrequency('monthly');
    setFormAmount(''); setFormCurrency('AED'); setFormStart(''); setFormEnd(''); setFormAnchor('1');
    setShowAdd(false); setEditId(null);
  };

  const handleSave = () => {
    if (!formCustomer || !formPlan || !formAmount || !formStart) return;
    if (editId) {
      const updated = profiles.map(p => p.id === editId ? {
        ...p, customerName: formCustomer, planName: formPlan, frequency: formFrequency,
        amount: Number(formAmount), currency: formCurrency, startDate: formStart,
        endDate: formEnd || null, billingAnchorDay: Number(formAnchor),
      } : p);
      setProfiles(updated);
      const editedProfile = updated.find(p => p.id === editId);
      if (editedProfile) upsertRecurringProfile(editedProfile).catch(() => {});
    } else {
      const newProfile: RecurringProfile = {
        id: `RP-${String(profiles.length + 1).padStart(3, '0')}`,
        customerId: `C-${String(profiles.length + 1).padStart(3, '0')}`,
        customerName: formCustomer,
        planName: formPlan,
        frequency: formFrequency,
        startDate: formStart,
        endDate: formEnd || null,
        amount: Number(formAmount),
        currency: formCurrency,
        status: 'active',
        billingAnchorDay: Number(formAnchor),
        nextBillingDate: formStart,
        lastBilledDate: null,
        totalBilled: 0,
        invoiceCount: 0,
        createdAt: new Date().toISOString().split('T')[0],
      };
      setProfiles(prev => [...prev, newProfile]);
      upsertRecurringProfile(newProfile).catch(() => {});
    }
    resetForm();
  };

  const openEdit = (p: RecurringProfile) => {
    setEditId(p.id); setFormCustomer(p.customerName); setFormPlan(p.planName);
    setFormFrequency(p.frequency); setFormAmount(String(p.amount)); setFormCurrency(p.currency);
    setFormStart(p.startDate); setFormEnd(p.endDate || ''); setFormAnchor(String(p.billingAnchorDay));
    setShowAdd(true);
  };

  const togglePause = (id: string) => {
    setProfiles(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, status: p.status === 'active' ? 'paused' as const : 'active' as const } : p);
      const toggled = updated.find(p => p.id === id);
      if (toggled) upsertRecurringProfile(toggled).catch(() => {});
      return updated;
    });
  };

  const cancelProfile = (id: string) => {
    setProfiles(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, status: 'cancelled' as const } : p);
      const cancelled = updated.find(p => p.id === id);
      if (cancelled) upsertRecurringProfile(cancelled).catch(() => {});
      return updated;
    });
  };

  const statusColors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700',
    paused: 'bg-amber-100 text-amber-700',
    cancelled: 'bg-red-100 text-red-700',
    expired: 'bg-slate-100 text-slate-700',
  };

  const freqColors: Record<string, string> = {
    daily: 'bg-blue-100 text-blue-700',
    weekly: 'bg-purple-100 text-purple-700',
    monthly: 'bg-emerald-100 text-emerald-700',
    quarterly: 'bg-amber-100 text-amber-700',
    yearly: 'bg-red-100 text-red-700',
  };

  if (loading) return <LoadingSpinner message="Loading recurring profiles..." />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Recurring Profiles</h1>
          <p className="text-slate-500 mt-1">Database table: <code className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono">recurring_profiles</code></p>
        </div>
        <button onClick={() => { resetForm(); setShowAdd(true); }} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700">
          <Plus size={16} /> Add Profile
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Total Profiles', value: profiles.length, icon: Users, color: 'bg-blue-50 text-blue-700' },
          { label: 'Active', value: activeProfiles.length, icon: Check, color: 'bg-emerald-50 text-emerald-700' },
          { label: 'Paused', value: profiles.filter(p => p.status === 'paused').length, icon: Pause, color: 'bg-amber-50 text-amber-700' },
          { label: 'MRR (est.)', value: `AED ${Math.round(mrr).toLocaleString()}`, icon: DollarSign, color: 'bg-purple-50 text-purple-700' },
          { label: 'Total Billed', value: `AED ${profiles.reduce((s, p) => s + p.totalBilled, 0).toLocaleString()}`, icon: RotateCcw, color: 'bg-cyan-50 text-cyan-700' },
        ].map((k, i) => (
          <div key={i} className={`${k.color} rounded-xl p-4`}>
            <div className="flex items-center gap-2 mb-1"><k.icon size={14} /><span className="text-xs font-medium">{k.label}</span></div>
            <p className="text-xl font-bold">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search profiles..." className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" />
          </div>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            {['all', 'active', 'paused', 'cancelled'].map(s => (
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
                <th className="text-left px-4 py-3 font-medium text-slate-600">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Plan</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Frequency</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Amount</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Start</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Next Bill</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Invoices</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.id}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{p.customerName}</td>
                  <td className="px-4 py-3 text-slate-700">{p.planName}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${freqColors[p.frequency]}`}>{p.frequency}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">{p.currency} {p.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center text-xs text-slate-600">{p.startDate}</td>
                  <td className="px-4 py-3 text-center text-xs text-slate-600">{p.nextBillingDate || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs bg-slate-100 px-2 py-1 rounded-full">{p.invoiceCount}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[p.status]}`}>{p.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"><Edit2 size={14} /></button>
                      {p.status !== 'cancelled' && (
                        <button onClick={() => togglePause(p.id)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600">
                          {p.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                      )}
                      {p.status !== 'cancelled' && (
                        <button onClick={() => cancelProfile(p.id)} className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-600"><X size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[85vh] overflow-auto">
            <h2 className="text-lg font-bold mb-4">{editId ? 'Edit Profile' : 'New Recurring Profile'}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name *</label>
                <input value={formCustomer} onChange={e => setFormCustomer(e.target.value)} placeholder="ABC Travel LLC" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Plan Name *</label>
                <input value={formPlan} onChange={e => setFormPlan(e.target.value)} placeholder="Monthly Maintenance" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Frequency *</label>
                  <select value={formFrequency} onChange={e => setFormFrequency(e.target.value as RecurringProfile['frequency'])} className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Anchor Day (1-28)</label>
                  <input type="number" min={1} max={28} value={formAnchor} onChange={e => setFormAnchor(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount *</label>
                  <input type="number" value={formAmount} onChange={e => setFormAmount(e.target.value)} placeholder="500" className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                  <select value={formCurrency} onChange={e => setFormCurrency(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                    {['AED', 'USD', 'EUR', 'GBP', 'SAR'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date *</label>
                  <input type="date" value={formStart} onChange={e => setFormStart(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                  <input type="date" value={formEnd} onChange={e => setFormEnd(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              {formAmount && formFrequency && (
                <div className="p-3 bg-emerald-50 rounded-lg text-sm text-emerald-700">
                  <Calendar size={14} className="inline mr-1" />
                  {formCurrency} {Number(formAmount).toLocaleString()} billed {formFrequency} from {formStart || 'start date'}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={resetForm} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleSave} disabled={!formCustomer || !formPlan || !formAmount || !formStart} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50">
                {editId ? 'Update' : 'Create'} Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
