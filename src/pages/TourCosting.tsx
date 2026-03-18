import { useState, useEffect } from 'react';
import { fetchTourPackages, upsertTourPackage } from '../lib/supabaseSync';
import type { TourPackage } from '../data/mockData';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Package, TrendingUp, DollarSign, Plus, X, Save } from 'lucide-react';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';

interface PackageForm {
  name: string;
  price: string;
  hotelCost: string;
  transferCost: string;
  ticketsCost: string;
  guideCost: string;
  otherCost: string;
}

const emptyForm: PackageForm = {
  name: '', price: '', hotelCost: '', transferCost: '', ticketsCost: '', guideCost: '', otherCost: '',
};

export default function TourCosting() {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<PackageForm>(emptyForm);
  const [packageList, setPackageList] = useState<TourPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchTourPackages();
        if (!cancelled && data) setPackageList(data);
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const totalRevenue = packageList.reduce((s, p) => s + p.price * p.bookings, 0);
  const totalProfit = packageList.reduce((s, p) => s + p.profit * p.bookings, 0);
  const avgMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0';

  const chartData = packageList.map(p => ({
    name: p.name.split(' - ')[0].substring(0, 12),
    hotel: p.hotelCost,
    transfer: p.transferCost,
    tickets: p.ticketsCost,
    guide: p.guideCost,
    profit: p.profit,
  }));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const getFormProfit = () => {
    const p = parseFloat(form.price) || 0;
    const h = parseFloat(form.hotelCost) || 0;
    const t = parseFloat(form.transferCost) || 0;
    const tk = parseFloat(form.ticketsCost) || 0;
    const g = parseFloat(form.guideCost) || 0;
    const o = parseFloat(form.otherCost) || 0;
    return p - h - t - tk - g - o;
  };

  const handleSubmit = (evt: React.FormEvent) => {
    evt.preventDefault();
    const profit = getFormProfit();
    const newPackage = {
      id: `TP-${String(packageList.length + 1).padStart(3, '0')}`,
      name: form.name,
      price: parseFloat(form.price) || 0,
      hotelCost: parseFloat(form.hotelCost) || 0,
      transferCost: parseFloat(form.transferCost) || 0,
      ticketsCost: parseFloat(form.ticketsCost) || 0,
      guideCost: parseFloat(form.guideCost) || 0,
      otherCost: parseFloat(form.otherCost) || 0,
      profit,
      bookings: 0,
    };
    setPackageList(prev => [newPackage, ...prev]);
    upsertTourPackage(newPackage).catch(() => {});
    setForm(emptyForm);
    setShowModal(false);
  };

  if (loading) return <LoadingSpinner message="Loading tour packages..." />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tour Package Costing</h1>
          <p className="text-slate-500 mt-1">Automatic profit per booking calculation</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 text-sm font-medium">
          <Plus size={16} /> Add Package
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center"><Package size={20} className="text-blue-600" /></div>
            <div><p className="text-xs text-slate-500 uppercase">Total Revenue</p><p className="text-2xl font-bold text-slate-800">AED {totalRevenue.toLocaleString()}</p></div></div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3"><div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center"><DollarSign size={20} className="text-emerald-600" /></div>
            <div><p className="text-xs text-slate-500 uppercase">Total Profit</p><p className="text-2xl font-bold text-emerald-600">AED {totalProfit.toLocaleString()}</p></div></div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3"><div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center"><TrendingUp size={20} className="text-purple-600" /></div>
            <div><p className="text-xs text-slate-500 uppercase">Avg Margin</p><p className="text-2xl font-bold text-purple-600">{avgMargin}%</p></div></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {packageList.map(p => {
          const totalCost = p.hotelCost + p.transferCost + p.ticketsCost + p.guideCost + p.otherCost;
          const margin = p.price > 0 ? ((p.profit / p.price) * 100).toFixed(1) : '0';
          return (
            <div key={p.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800">{p.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{p.id} · {p.bookings} bookings</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-slate-800">AED {p.price.toLocaleString()}</p>
                  <p className="text-xs text-emerald-600 font-medium">{margin}% margin</p>
                </div>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between bg-slate-50 rounded-lg px-3 py-2">
                    <span className="text-slate-500">🏨 Hotel</span>
                    <span className="font-medium text-slate-800">AED {p.hotelCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between bg-slate-50 rounded-lg px-3 py-2">
                    <span className="text-slate-500">🚗 Transfer</span>
                    <span className="font-medium text-slate-800">AED {p.transferCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between bg-slate-50 rounded-lg px-3 py-2">
                    <span className="text-slate-500">🎟️ Tickets</span>
                    <span className="font-medium text-slate-800">AED {p.ticketsCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between bg-slate-50 rounded-lg px-3 py-2">
                    <span className="text-slate-500">👤 Guide</span>
                    <span className="font-medium text-slate-800">AED {p.guideCost.toLocaleString()}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
                  <div className="text-sm"><span className="text-slate-500">Total Cost: </span><span className="font-medium">AED {totalCost.toLocaleString()}</span></div>
                  <div className="text-sm"><span className="text-slate-500">Profit: </span><span className={`font-bold ${p.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>AED {p.profit.toLocaleString()}</span></div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 mt-3">
                  <div className={`h-2 rounded-full ${p.profit >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${Math.min(Math.max((p.profit / p.price) * 100, 0), 100)}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <h3 className="font-semibold text-slate-800 mb-4">Cost Breakdown Comparison</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: any) => `AED ${Number(v).toLocaleString()}`} />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Bar dataKey="hotel" stackId="a" fill="#3b82f6" name="Hotel" />
            <Bar dataKey="transfer" stackId="a" fill="#f59e0b" name="Transfer" />
            <Bar dataKey="tickets" stackId="a" fill="#8b5cf6" name="Tickets" />
            <Bar dataKey="guide" stackId="a" fill="#06b6d4" name="Guide" />
            <Bar dataKey="profit" stackId="a" fill="#10b981" name="Profit" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Add Package Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Add Tour Package</h2>
                <p className="text-sm text-slate-500 mt-0.5">Create a new package with cost breakdown</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Package Name <span className="text-red-500">*</span></label>
                <input name="name" value={form.name} onChange={handleChange} required placeholder="e.g. Dubai City Tour - 3N/4D"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Selling Price (AED) <span className="text-red-500">*</span></label>
                <input type="number" name="price" value={form.price} onChange={handleChange} required min="0" step="0.01" placeholder="3500"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
              </div>
              <div className="border-t border-slate-100 pt-4">
                <p className="text-sm font-semibold text-slate-700 mb-3">Cost Breakdown</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: '🏨 Hotel Cost', name: 'hotelCost', placeholder: '1800' },
                    { label: '🚗 Transfer Cost', name: 'transferCost', placeholder: '400' },
                    { label: '🎟️ Tickets Cost', name: 'ticketsCost', placeholder: '600' },
                    { label: '👤 Guide Cost', name: 'guideCost', placeholder: '200' },
                    { label: '📦 Other Cost', name: 'otherCost', placeholder: '0' },
                  ].map(field => (
                    <div key={field.name}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{field.label}</label>
                      <input type="number" name={field.name} value={form[field.name as keyof PackageForm]} onChange={handleChange}
                        min="0" step="0.01" placeholder={field.placeholder}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                    </div>
                  ))}
                </div>
              </div>

              {form.price && (
                <>
                  <div className={`rounded-lg border p-4 space-y-2 text-sm mt-2 ${getFormProfit() >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-200/50">
                      <TrendingUp className={getFormProfit() >= 0 ? 'text-emerald-600' : 'text-red-600'} size={18} />
                      <span className={`font-semibold ${getFormProfit() >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>Live Profit & Loss</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-slate-400">Selling Price</div>
                        <div className="font-semibold text-slate-700">AED {parseFloat(form.price || '0').toLocaleString()}</div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-slate-400">Total Cost</div>
                        <div className="font-semibold text-slate-700">AED {((parseFloat(form.hotelCost || '0') + parseFloat(form.transferCost || '0') + parseFloat(form.ticketsCost || '0') + parseFloat(form.guideCost || '0') + parseFloat(form.otherCost || '0'))).toFixed(2)}</div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {parseFloat(form.hotelCost || '0') > 0 && (
                        <div className="flex justify-between text-slate-600 text-xs">
                          <span>🏨 Hotel</span><span>AED {parseFloat(form.hotelCost || '0').toLocaleString()}</span>
                        </div>
                      )}
                      {parseFloat(form.transferCost || '0') > 0 && (
                        <div className="flex justify-between text-slate-600 text-xs">
                          <span>🚗 Transfer</span><span>AED {parseFloat(form.transferCost || '0').toLocaleString()}</span>
                        </div>
                      )}
                      {parseFloat(form.ticketsCost || '0') > 0 && (
                        <div className="flex justify-between text-slate-600 text-xs">
                          <span>🎟️ Tickets</span><span>AED {parseFloat(form.ticketsCost || '0').toLocaleString()}</span>
                        </div>
                      )}
                      {parseFloat(form.guideCost || '0') > 0 && (
                        <div className="flex justify-between text-slate-600 text-xs">
                          <span>👤 Guide</span><span>AED {parseFloat(form.guideCost || '0').toLocaleString()}</span>
                        </div>
                      )}
                      {parseFloat(form.otherCost || '0') > 0 && (
                        <div className="flex justify-between text-slate-600 text-xs">
                          <span>📦 Other</span><span>AED {parseFloat(form.otherCost || '0').toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    <div className={`flex justify-between font-bold text-base pt-2 border-t ${getFormProfit() >= 0 ? 'text-emerald-700 border-emerald-200' : 'text-red-700 border-red-200'}`}>
                      <span>Profit / Loss</span><span>AED {getFormProfit().toFixed(2)}</span>
                    </div>

                    {parseFloat(form.price || '0') > 0 && (
                      <div className="flex justify-between text-xs pt-1">
                        <span className="text-slate-500">Margin</span>
                        <span className={`font-semibold ${getFormProfit() >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {parseFloat(form.price || '0') > 0 ? ((getFormProfit() / parseFloat(form.price || '0')) * 100).toFixed(1) : '0'}%
                        </span>
                      </div>
                    )}

                    <div className={`mt-2 text-xs px-2 py-1 rounded-full text-center ${getFormProfit() >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {getFormProfit() > 0 ? '✓ Profitable Package' : getFormProfit() < 0 ? '✗ Loss-making Package' : '✓ Break-even'}
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
                  <Save size={16} /> Add Package
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}