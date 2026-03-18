import { TrendingUp, DollarSign, Target } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';

const forecastData: { month: string; actual: number; projected: number; expenses: number }[] = [];
const monthlyRevenue: { month: string; revenue: number; expenses: number; profit: number }[] = [];

export default function Forecasting() {
  const projectedRevenue = forecastData.reduce((s, f) => s + f.projected, 0);
  const projectedExpenses = forecastData.reduce((s, f) => s + f.expenses, 0);
  const projectedProfit = projectedRevenue - projectedExpenses;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Financial Forecasting</h1>
        <p className="text-slate-500 mt-1">Revenue predictions & profit forecasts</p>
      </div>

      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          <div>
            <p className="text-indigo-100 text-sm">Expected Bookings (Next Month)</p>
            <p className="text-3xl font-bold mt-1">120</p>
          </div>
          <div>
            <p className="text-indigo-100 text-sm">Avg Booking Value</p>
            <p className="text-3xl font-bold mt-1">AED 2,500</p>
          </div>
          <div>
            <p className="text-indigo-100 text-sm">Projected Revenue</p>
            <p className="text-3xl font-bold mt-1">AED 300K</p>
          </div>
          <div>
            <p className="text-indigo-100 text-sm">Confidence Level</p>
            <p className="text-3xl font-bold mt-1">85%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center"><TrendingUp size={20} className="text-blue-600" /></div>
          <div><p className="text-xs text-slate-500 uppercase">6-Month Projected Revenue</p><p className="text-2xl font-bold text-blue-600">AED {(projectedRevenue / 1000).toFixed(0)}K</p></div></div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3"><div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center"><DollarSign size={20} className="text-red-600" /></div>
          <div><p className="text-xs text-slate-500 uppercase">Projected Expenses</p><p className="text-2xl font-bold text-red-600">AED {(projectedExpenses / 1000).toFixed(0)}K</p></div></div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3"><div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center"><Target size={20} className="text-emerald-600" /></div>
          <div><p className="text-xs text-slate-500 uppercase">Projected Profit</p><p className="text-2xl font-bold text-emerald-600">AED {(projectedProfit / 1000).toFixed(0)}K</p></div></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-800 mb-4">Revenue Forecast (Next 6 Months)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={forecastData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v / 1000}K`} />
              <Tooltip formatter={(v: any) => `AED ${Number(v).toLocaleString()}`} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line type="monotone" dataKey="projected" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name="Revenue" />
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} name="Expenses" strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-800 mb-4">Historical Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v / 1000}K`} />
              <Tooltip formatter={(v: any) => `AED ${Number(v).toLocaleString()}`} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Revenue" />
              <Bar dataKey="profit" fill="#10b981" radius={[4, 4, 0, 0]} name="Profit" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <h3 className="font-semibold text-slate-800 mb-4">Monthly Forecast Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50">
              <th className="text-left px-5 py-3 font-medium text-slate-600">Month</th>
              <th className="text-right px-5 py-3 font-medium text-slate-600">Projected Revenue</th>
              <th className="text-right px-5 py-3 font-medium text-slate-600">Projected Expenses</th>
              <th className="text-right px-5 py-3 font-medium text-slate-600">Projected Profit</th>
              <th className="text-right px-5 py-3 font-medium text-slate-600">Margin</th>
            </tr></thead>
            <tbody>
              {forecastData.map(f => (
                <tr key={f.month} className="border-t border-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-800">{f.month} 2024</td>
                  <td className="px-5 py-3 text-right text-blue-600">AED {f.projected.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right text-red-600">AED {f.expenses.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right font-medium text-emerald-600">AED {(f.projected - f.expenses).toLocaleString()}</td>
                  <td className="px-5 py-3 text-right text-slate-600">{(((f.projected - f.expenses) / f.projected) * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
