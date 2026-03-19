import { useState, useEffect } from 'react';
import { Truck, Fuel, DollarSign, User, Plus, X, Save } from 'lucide-react';
import type { Vehicle } from '../data/mockData';
import { fetchVehicles, upsertVehicle, fetchEmployees } from '../lib/supabaseSync';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';
import { catchAndReport } from '../lib/toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const vehicleTypes = ['Sedan', 'SUV', 'Luxury SUV', 'Van (14-seater)', 'Van (7-seater)', 'Bus (35-seater)', 'Bus (50-seater)', 'Coaster'];
const statusOptions = ['Available', 'On Trip', 'Maintenance'];
// driverOptions loaded from DB inside component

interface VehicleForm {
  plate: string;
  type: string;
  driver: string;
  status: string;
}

const emptyForm: VehicleForm = { plate: '', type: 'Sedan', driver: '', status: 'Available' };

export default function Transport() {
  const [driverOptions, setDriverOptions] = useState<string[]>([]);
  useEffect(() => {
    fetchEmployees().then(data => setDriverOptions(data.filter(e => e.status === 'Active').map(e => e.name))).catch(catchAndReport('Load drivers'));
  }, []);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<VehicleForm>(emptyForm);
  const [vehicleList, setVehicleList] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchVehicles();
        if (!cancelled && data) setVehicleList(data);
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const totalRevenue = vehicleList.reduce((s, v) => s + v.revenue, 0);
  const totalFuel = vehicleList.reduce((s, v) => s + v.fuelCost, 0);
  const totalTrips = vehicleList.reduce((s, v) => s + v.trips, 0);
  const profit = totalRevenue - totalFuel;

  const filtered = vehicleList.filter(v => statusFilter === 'All' || v.status === statusFilter);

  const chartData = vehicleList.map(v => ({
    name: v.plate.split('-')[2],
    revenue: v.revenue,
    fuel: v.fuelCost,
    profit: v.revenue - v.fuelCost,
  }));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (evt: React.FormEvent) => {
    evt.preventDefault();
    const newVehicle = {
      id: `VH-${String(vehicleList.length + 1).padStart(3, '0')}`,
      plate: form.plate.toUpperCase(),
      type: form.type,
      driver: form.driver,
      status: form.status as 'Available' | 'On Trip' | 'Maintenance',
      fuelCost: 0,
      trips: 0,
      revenue: 0,
    };
    setVehicleList(prev => [newVehicle, ...prev]);
    upsertVehicle(newVehicle).catch(catchAndReport('Save vehicle'));
    setForm(emptyForm);
    setShowModal(false);
  };

  if (loading) return <LoadingSpinner message="Loading vehicles..." />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Transport Accounting</h1>
          <p className="text-slate-500 mt-1">Vehicle management, driver payments & fuel tracking</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 text-sm font-medium">
          <Plus size={16} /> Add Vehicle
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3"><div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center"><Truck size={18} className="text-blue-600" /></div>
          <div><p className="text-xs text-slate-500">Vehicles</p><p className="text-xl font-bold text-slate-800">{vehicleList.length}</p></div></div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3"><div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center"><DollarSign size={18} className="text-emerald-600" /></div>
          <div><p className="text-xs text-slate-500">Revenue</p><p className="text-xl font-bold text-emerald-600">AED {totalRevenue.toLocaleString()}</p></div></div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3"><div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center"><Fuel size={18} className="text-red-600" /></div>
          <div><p className="text-xs text-slate-500">Fuel Cost</p><p className="text-xl font-bold text-red-600">AED {totalFuel.toLocaleString()}</p></div></div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3"><div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center"><DollarSign size={18} className="text-purple-600" /></div>
          <div><p className="text-xs text-slate-500">Profit</p><p className="text-xl font-bold text-purple-600">AED {profit.toLocaleString()}</p></div></div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3"><div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center"><User size={18} className="text-amber-600" /></div>
          <div><p className="text-xs text-slate-500">Total Trips</p><p className="text-xl font-bold text-slate-800">{totalTrips}</p></div></div>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2">
        {['All', 'Available', 'On Trip', 'Maintenance'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{s}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Vehicle Fleet</h3>
            <span className="text-xs text-slate-400">{filtered.length} vehicles</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50">
                <th className="text-left px-5 py-3 font-medium text-slate-600">Vehicle</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Type</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Driver</th>
                <th className="text-center px-5 py-3 font-medium text-slate-600">Status</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Trips</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Revenue</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Fuel</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Profit</th>
              </tr></thead>
              <tbody>
                {filtered.map(v => (
                  <tr key={v.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-5 py-3"><div className="font-medium text-slate-800">{v.plate}</div><div className="text-xs text-slate-400">{v.id}</div></td>
                    <td className="px-5 py-3 text-slate-600">{v.type}</td>
                    <td className="px-5 py-3 text-slate-700">{v.driver}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        v.status === 'Available' ? 'bg-emerald-50 text-emerald-700' :
                        v.status === 'On Trip' ? 'bg-blue-50 text-blue-700' :
                        'bg-red-50 text-red-700'
                      }`}>{v.status}</span>
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600">{v.trips}</td>
                    <td className="px-5 py-3 text-right text-emerald-600">AED {v.revenue.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-red-600">AED {v.fuelCost.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right font-medium text-slate-800">AED {(v.revenue - v.fuelCost).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-800 mb-4">Revenue vs Fuel by Vehicle</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v / 1000}K`} />
              <Tooltip formatter={(v: any) => `AED ${Number(v).toLocaleString()}`} />
              <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} name="Revenue" />
              <Bar dataKey="fuel" fill="#ef4444" radius={[4, 4, 0, 0]} name="Fuel" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Add Vehicle Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Add Vehicle</h2>
                <p className="text-sm text-slate-500 mt-0.5">Register a new fleet vehicle</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">License Plate <span className="text-red-500">*</span></label>
                <input name="plate" value={form.plate} onChange={handleChange} required placeholder="e.g. DXB-A-12345"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle Type <span className="text-red-500">*</span></label>
                <select name="type" value={form.type} onChange={handleChange} required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                  {vehicleTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Driver</label>
                <select name="driver" value={form.driver} onChange={handleChange}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                  <option value="">Unassigned</option>
                  {driverOptions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select name="status" value={form.status} onChange={handleChange}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                  {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
                  <Save size={16} /> Add Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
