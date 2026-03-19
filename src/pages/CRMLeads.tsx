import { useState, useEffect } from 'react';
import { Plus, Phone, Mail, ArrowRight, Search, X, Save } from 'lucide-react';
import { fetchLeads, upsertLead } from '../lib/supabaseSync';
import type { Lead } from '../data/mockData';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';
import { catchAndReport } from '../lib/toast';

const statuses = ['All', 'New', 'Contacted', 'Quoted', 'Converted', 'Lost'];
const sources = ['Website', 'WhatsApp', 'Email', 'Walk-in', 'Travel Agent'];
const serviceTypes = ['Tour Package', 'Transfer', 'Hotel Booking', 'Visa Services', 'Tickets', 'Activities', 'Full Itinerary'];

const sourceColors: Record<string, string> = {
  Website: 'bg-blue-50 text-blue-600',
  WhatsApp: 'bg-emerald-50 text-emerald-600',
  Email: 'bg-purple-50 text-purple-600',
  'Walk-in': 'bg-amber-50 text-amber-600',
  'Travel Agent': 'bg-pink-50 text-pink-600'
};
const statusColors: Record<string, string> = {
  New: 'bg-blue-50 text-blue-700',
  Contacted: 'bg-amber-50 text-amber-700',
  Quoted: 'bg-purple-50 text-purple-700',
  Converted: 'bg-emerald-50 text-emerald-700',
  Lost: 'bg-red-50 text-red-700'
};

interface LeadForm {
  name: string;
  email: string;
  phone: string;
  source: string;
  service: string;
  value: string;
  status: string;
  followUp: string;
  notes: string;
}

const emptyForm: LeadForm = {
  name: '', email: '', phone: '', source: 'Website', service: 'Tour Package',
  value: '', status: 'New', followUp: '', notes: '',
};

export default function CRMLeads() {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<LeadForm>(emptyForm);
  const [leadList, setLeadList] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchLeads();
        if (!cancelled && data) setLeadList(data);
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = leadList.filter(l =>
    (filter === 'All' || l.status === filter) &&
    (l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.email.toLowerCase().includes(search.toLowerCase()) ||
      l.phone.toLowerCase().includes(search.toLowerCase()))
  );

  const totalValue = leadList.reduce((s, l) => s + l.value, 0);
  const convertedValue = leadList.filter(l => l.status === 'Converted').reduce((s, l) => s + l.value, 0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (evt: React.FormEvent) => {
    evt.preventDefault();
    const newLead = {
      id: `LD-${String(leadList.length + 1).padStart(3, '0')}`,
      name: form.name,
      email: form.email,
      phone: form.phone,
      source: form.source,
      service: form.service,
      value: parseFloat(form.value) || 0,
      status: form.status as 'New' | 'Contacted' | 'Quoted' | 'Converted' | 'Lost',
      followUp: form.followUp,
      date: new Date().toISOString().split('T')[0],
    };
    setLeadList(prev => [newLead, ...prev] as typeof prev);
    upsertLead(newLead).catch(catchAndReport('Save lead'));
    setForm(emptyForm);
    setShowModal(false);
  };

  const handleConvert = (id: string) => {
    setLeadList(prev => prev.map(l => {
      if (l.id === id) {
        const updated = { ...l, status: 'Converted' as const };
        upsertLead(updated).catch(catchAndReport('Convert lead'));
        return updated;
      }
      return l;
    }));
  };

  if (loading) return <LoadingSpinner message="Loading leads..." />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">CRM Leads</h1>
          <p className="text-slate-500 mt-1">Manage inquiries & convert to bookings</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 text-sm font-medium">
          <Plus size={16} /> Add Lead
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 uppercase">Total Leads</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{leadList.length}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 uppercase">Pipeline Value</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">AED {totalValue.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 uppercase">Converted</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">AED {convertedValue.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 uppercase">Conversion Rate</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{((leadList.filter(l => l.status === 'Converted').length / Math.max(leadList.length, 1)) * 100).toFixed(0)}%</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {statuses.map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === s ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
            >{s} {s !== 'All' && <span className="ml-1 opacity-60">({leadList.filter(l => l.status === s).length})</span>}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(lead => (
          <div key={lead.id} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-slate-800">{lead.name}</h3>
                <p className="text-xs text-slate-400">{lead.id}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[lead.status] || ''}`}>{lead.status}</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600"><Mail size={14} className="text-slate-400" /> {lead.email}</div>
              <div className="flex items-center gap-2 text-slate-600"><Phone size={14} className="text-slate-400" /> {lead.phone}</div>
              <div className="flex items-center justify-between">
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${sourceColors[lead.source] || 'bg-slate-50 text-slate-600'}`}>{lead.source}</span>
                <span className="text-xs text-slate-500">{lead.service}</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-slate-800">AED {lead.value.toLocaleString()}</p>
                {lead.followUp && <p className="text-xs text-slate-400">Follow-up: {lead.followUp}</p>}
              </div>
              {lead.status !== 'Converted' && lead.status !== 'Lost' && (
                <button onClick={() => handleConvert(lead.id)} className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">
                  Convert <ArrowRight size={12} />
                </button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-12 text-slate-400">
            <p className="font-medium">No leads found</p>
            <p className="text-sm mt-1">Try adjusting your filters or add a new lead</p>
          </div>
        )}
      </div>

      {/* Add Lead Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Add New Lead</h2>
                <p className="text-sm text-slate-500 mt-0.5">Capture a new sales inquiry</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                  <input name="name" value={form.name} onChange={handleChange} required placeholder="e.g. Ahmed Al Mansouri"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email <span className="text-red-500">*</span></label>
                  <input type="email" name="email" value={form.email} onChange={handleChange} required placeholder="lead@email.com"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input name="phone" value={form.phone} onChange={handleChange} placeholder="+971 50 123 4567"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Lead Source</label>
                  <select name="source" value={form.source} onChange={handleChange}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                    {sources.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Service Interest</label>
                  <select name="service" value={form.service} onChange={handleChange}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                    {serviceTypes.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Estimated Value (AED)</label>
                  <input type="number" name="value" value={form.value} onChange={handleChange} min="0" placeholder="5000"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select name="status" value={form.status} onChange={handleChange}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                    {statuses.slice(1).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Follow-up Date</label>
                  <input type="date" name="followUp" value={form.followUp} onChange={handleChange}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                  <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} placeholder="Additional notes about this lead..."
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
                  <Save size={16} /> Add Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
