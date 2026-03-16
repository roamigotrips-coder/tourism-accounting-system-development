import { useState } from 'react';
import { Search, Plus, Upload, Bell, ArrowRight, X, Save } from 'lucide-react';
import { suppliers } from '../data/mockData';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const supplierTypes = ['Hotel', 'Transport', 'Activity Provider', 'Tour Guide', 'Tickets', 'Visa Services'];
const paymentTermsList = ['Net 15', 'Net 30', 'Net 45', 'Net 60', 'Advance'];
const statusOptions = ['Active', 'Inactive'];

interface SupplierForm {
  name: string;
  type: string;
  contact: string;
  email: string;
  phone: string;
  paymentTerms: string;
  status: string;
}

const emptyForm: SupplierForm = {
  name: '', type: 'Hotel', contact: '', email: '', phone: '', paymentTerms: 'Net 30', status: 'Active',
};

export default function Suppliers() {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [supplierList, setSupplierList] = useState(suppliers);
  const [typeFilter, setTypeFilter] = useState('All');

  const filtered = supplierList.filter(s =>
    (typeFilter === 'All' || s.type === typeFilter) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) || s.type.toLowerCase().includes(search.toLowerCase()))
  );
  const totalPayable = supplierList.reduce((s, sup) => s + (sup.totalPayable - sup.paidAmount), 0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newSupplier = {
      id: `SUP-${String(supplierList.length + 1).padStart(3, '0')}`,
      name: form.name,
      type: form.type,
      contact: form.contact,
      email: form.email,
      phone: form.phone,
      paymentTerms: form.paymentTerms,
      status: form.status as 'Active' | 'Inactive',
      totalPayable: 0,
      paidAmount: 0,
    };
    setSupplierList(prev => [newSupplier, ...prev] as typeof prev);
    setForm(emptyForm);
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Supplier Management</h1>
          <p className="text-slate-500 mt-1">Manage hotels, transport & activity providers</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 text-sm font-medium">
          <Plus size={16} /> Add Supplier
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 uppercase">Total Suppliers</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{supplierList.length}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 uppercase">Net Payable</p>
          <p className="text-2xl font-bold text-red-600 mt-1">AED {totalPayable.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 uppercase">Hotels</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{supplierList.filter(s => s.type === 'Hotel').length}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 uppercase">Activity Providers</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{supplierList.filter(s => s.type === 'Activity Provider').length}</p>
        </div>
      </div>

      {/* Type Filter */}
      <div className="flex gap-2 flex-wrap">
        {['All', ...supplierTypes].map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${typeFilter === t ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{t}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="p-5 border-b border-slate-100">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50">
                <th className="text-left px-5 py-3 font-medium text-slate-600">Supplier</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Type</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Contact</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Total Payable</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Paid</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Balance</th>
              </tr></thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-5 py-3"><div className="font-medium text-slate-800">{s.name}</div><div className="text-xs text-slate-400">{s.id}</div></td>
                    <td className="px-5 py-3"><span className="px-2 py-1 bg-slate-100 rounded text-xs font-medium text-slate-600">{s.type}</span></td>
                    <td className="px-5 py-3"><div className="text-slate-700">{s.contact}</div><div className="text-xs text-slate-400">{s.email}</div></td>
                    <td className="px-5 py-3 text-right text-slate-800">AED {s.totalPayable.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-emerald-600">AED {s.paidAmount.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right font-medium text-red-600">AED {(s.totalPayable - s.paidAmount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-800 mb-4">Supplier Automation</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                <Upload size={18} className="text-blue-600" />
                <div className="flex-1"><p className="text-sm font-medium text-slate-800">Invoice Upload</p><p className="text-xs text-slate-500">Auto-match with bookings</p></div>
                <ArrowRight size={14} className="text-slate-400" />
              </div>
              <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors">
                <Bell size={18} className="text-amber-600" />
                <div className="flex-1"><p className="text-sm font-medium text-slate-800">Payment Reminders</p><p className="text-xs text-slate-500">3 pending reminders</p></div>
                <ArrowRight size={14} className="text-slate-400" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-800 mb-4">Payable by Supplier</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={supplierList.map(s => ({ name: s.name.split(' ')[0], balance: s.totalPayable - s.paidAmount }))} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${v / 1000}K`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={55} />
                <Tooltip formatter={(v: any) => `AED ${Number(v).toLocaleString()}`} />
                <Bar dataKey="balance" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Add Supplier Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Add New Supplier</h2>
                <p className="text-sm text-slate-500 mt-0.5">Create a new supplier profile</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Supplier Name <span className="text-red-500">*</span></label>
                  <input name="name" value={form.name} onChange={handleChange} required placeholder="e.g. Desert Rose Hotel"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Supplier Type <span className="text-red-500">*</span></label>
                  <select name="type" value={form.type} onChange={handleChange} required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                    {supplierTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person</label>
                  <input name="contact" value={form.contact} onChange={handleChange} placeholder="John Manager"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email <span className="text-red-500">*</span></label>
                  <input type="email" name="email" value={form.email} onChange={handleChange} required placeholder="supplier@company.com"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input name="phone" value={form.phone} onChange={handleChange} placeholder="+971 4 123 4567"
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
                  <Save size={16} /> Add Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
