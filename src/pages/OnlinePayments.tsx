import { useState, useEffect } from 'react';
import { CreditCard, Link2, CheckCircle, Clock, Send, Plus, X, Save, Copy } from 'lucide-react';
import { fetchPayments, fetchInvoices } from '../lib/supabaseSync';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';
import type { Payment, Invoice } from '../data/mockData';

const initialLinks: { id: string; invoice: string; party: string; amount: number; link: string; status: string; created: string }[] = [];

interface LinkForm {
  invoice: string;
  party: string;
  amount: string;
  method: string;
}

const emptyLinkForm: LinkForm = { invoice: '', party: '', amount: '', method: 'Card Payment' };

export default function OnlinePayments() {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<LinkForm>(emptyLinkForm);
  const [links, setLinks] = useState(initialLinks);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [paymentsData, invoicesData] = await Promise.all([fetchPayments(), fetchInvoices()]);
        if (!cancelled) {
          if (paymentsData) setPayments(paymentsData);
          if (invoicesData) setInvoices(invoicesData);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const totalReceived = payments.filter(p => p.type === 'Receipt' && p.status === 'Completed').reduce((s, p) => s + p.amount, 0);
  const processing = payments.filter(p => p.status === 'Processing').reduce((s, p) => s + p.amount, 0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleInvoiceSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const inv = invoices.find(i => i.id === e.target.value);
    if (inv) {
      setForm(prev => ({ ...prev, invoice: inv.id, party: inv.party, amount: String(inv.total) }));
    } else {
      setForm(prev => ({ ...prev, invoice: e.target.value }));
    }
  };

  const handleSubmit = (evt: React.FormEvent) => {
    evt.preventDefault();
    const newId = `PL-${String(links.length + 1).padStart(3, '0')}`;
    const newLink = {
      id: newId,
      invoice: form.invoice,
      party: form.party,
      amount: parseFloat(form.amount) || 0,
      link: `pay.touracco.com/${newId}`,
      status: 'Active',
      created: new Date().toISOString().split('T')[0],
    };
    setLinks(prev => [newLink, ...prev]);
    setForm(emptyLinkForm);
    setShowModal(false);
  };

  const handleCopy = (id: string, link: string) => {
    navigator.clipboard.writeText(link).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) return <LoadingSpinner message="Loading..." />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Online Payments</h1>
          <p className="text-slate-500 mt-1">Payment links, card payments & invoice settlements</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 text-sm font-medium">
          <Plus size={16} /> Generate Payment Link
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3"><div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center"><CheckCircle size={18} className="text-emerald-600" /></div>
          <div><p className="text-xs text-slate-500">Received</p><p className="text-xl font-bold text-emerald-600">AED {totalReceived.toLocaleString()}</p></div></div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3"><div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center"><Clock size={18} className="text-amber-600" /></div>
          <div><p className="text-xs text-slate-500">Processing</p><p className="text-xl font-bold text-amber-600">AED {processing.toLocaleString()}</p></div></div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3"><div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center"><Link2 size={18} className="text-blue-600" /></div>
          <div><p className="text-xs text-slate-500">Active Links</p><p className="text-xl font-bold text-blue-600">{links.filter(l => l.status === 'Active').length}</p></div></div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3"><div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center"><CreditCard size={18} className="text-purple-600" /></div>
          <div><p className="text-xs text-slate-500">Methods</p><p className="text-xl font-bold text-slate-800">3</p></div></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-3"><CreditCard size={24} className="text-blue-600" /></div>
          <h3 className="font-semibold text-slate-800">Card Payments</h3>
          <p className="text-xs text-slate-500 mt-1">Visa, Mastercard, Amex</p>
          <p className="text-lg font-bold text-blue-600 mt-2">Active</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-3"><Send size={24} className="text-emerald-600" /></div>
          <h3 className="font-semibold text-slate-800">Bank Transfer</h3>
          <p className="text-xs text-slate-500 mt-1">SWIFT, Local Transfer</p>
          <p className="text-lg font-bold text-emerald-600 mt-2">Active</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center mb-3"><Link2 size={24} className="text-purple-600" /></div>
          <h3 className="font-semibold text-slate-800">Payment Links</h3>
          <p className="text-xs text-slate-500 mt-1">Shareable pay links</p>
          <p className="text-lg font-bold text-purple-600 mt-2">Active</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Payment Links</h3>
          <span className="text-xs text-slate-400">{links.length} total links</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50">
              <th className="text-left px-5 py-3 font-medium text-slate-600">Link ID</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">Invoice</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">Party</th>
              <th className="text-right px-5 py-3 font-medium text-slate-600">Amount</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">Link</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">Created</th>
              <th className="text-center px-5 py-3 font-medium text-slate-600">Status</th>
              <th className="text-center px-5 py-3 font-medium text-slate-600">Action</th>
            </tr></thead>
            <tbody>
              {links.map(l => (
                <tr key={l.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                  <td className="px-5 py-3 font-medium text-slate-600">{l.id}</td>
                  <td className="px-5 py-3 text-blue-600 font-medium">{l.invoice}</td>
                  <td className="px-5 py-3 text-slate-700">{l.party}</td>
                  <td className="px-5 py-3 text-right font-medium text-slate-800">AED {l.amount.toLocaleString()}</td>
                  <td className="px-5 py-3 text-xs text-blue-600 font-mono">{l.link}</td>
                  <td className="px-5 py-3 text-slate-500 text-xs">{l.created}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${l.status === 'Paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{l.status}</span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <button onClick={() => handleCopy(l.id, l.link)}
                      className={`flex items-center gap-1 mx-auto px-2 py-1 rounded text-xs font-medium transition-colors ${copiedId === l.id ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      <Copy size={12} /> {copiedId === l.id ? 'Copied!' : 'Copy'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Payment Link Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Generate Payment Link</h2>
                <p className="text-sm text-slate-500 mt-0.5">Create a shareable payment link</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Link to Invoice</label>
                <select value={form.invoice} onChange={handleInvoiceSelect}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                  <option value="">Select Invoice (optional)</option>
                  {invoices.map(i => <option key={i.id} value={i.id}>{i.id} — {i.party} (AED {i.total.toLocaleString()})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Party / Customer Name <span className="text-red-500">*</span></label>
                <input name="party" value={form.party} onChange={handleChange} required placeholder="e.g. Global Tours UK"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (AED) <span className="text-red-500">*</span></label>
                <input type="number" name="amount" value={form.amount} onChange={handleChange} required min="0" step="0.01" placeholder="0.00"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                <select name="method" value={form.method} onChange={handleChange}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                  <option value="Card Payment">Card Payment</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Any">Any Method</option>
                </select>
              </div>
              {form.amount && (
                <div className="bg-blue-50 rounded-lg p-3 text-sm">
                  <p className="text-blue-700 font-medium">Preview Link</p>
                  <p className="text-blue-600 font-mono text-xs mt-1">pay.touracco.com/PL-{String(links.length + 1).padStart(3, '0')}</p>
                </div>
              )}
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
                  <Save size={16} /> Generate Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
