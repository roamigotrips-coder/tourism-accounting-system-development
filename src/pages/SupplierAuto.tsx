import { useState, useEffect } from 'react';
import { Upload, Link2, Bell, Check, AlertTriangle, RefreshCw, Settings } from 'lucide-react';
import { fetchSuppliers, fetchSupplierAutomationRules, fetchSupplierPendingInvoices, type SupplierAutomationRule, type SupplierPendingInvoice } from '../lib/supabaseSync';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';
import type { Supplier } from '../data/mockData';

export default function SupplierAuto() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [automationRules, setAutomationRules] = useState<SupplierAutomationRule[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<SupplierPendingInvoice[]>([]);
  const paymentReminders: { supplier: string; amount: number; dueDate: string; daysToDue: number; priority: string }[] = [];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [data, rules, pending] = await Promise.all([
          fetchSuppliers(),
          fetchSupplierAutomationRules(),
          fetchSupplierPendingInvoices(),
        ]);
        if (!cancelled) {
          if (data) setSuppliers(data);
          if (rules) setAutomationRules(rules);
          if (pending) setPendingInvoices(pending);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <LoadingSpinner message="Loading..." />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Supplier Automation</h1>
        <p className="text-slate-500 mt-1">Automate supplier cost allocation & invoice processing</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center"><Link2 size={18} className="text-blue-600" /></div>
            <div><p className="text-xs text-slate-500">Active Rules</p><p className="text-xl font-bold text-blue-600">{automationRules.filter(r => r.status === 'Active').length}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center"><Check size={18} className="text-emerald-600" /></div>
            <div><p className="text-xs text-slate-500">Auto-Matched</p><p className="text-xl font-bold text-emerald-600">40</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center"><Upload size={18} className="text-amber-600" /></div>
            <div><p className="text-xs text-slate-500">Pending Invoices</p><p className="text-xl font-bold text-amber-600">{pendingInvoices.length}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center"><Bell size={18} className="text-red-600" /></div>
            <div><p className="text-xs text-slate-500">Payment Due</p><p className="text-xl font-bold text-red-600">{paymentReminders.length}</p></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Automation Rules</h3>
            <button className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700">
              <Settings size={14} /> Configure
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {automationRules.map(rule => (
              <div key={rule.id} className="p-4 hover:bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">{rule.name}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        rule.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>{rule.status}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{rule.supplier}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-blue-600">{rule.matches} matches</p>
                    <p className="text-[10px] text-slate-400">{rule.lastRun}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Payment Reminders</h3>
            <span className="text-xs text-slate-400">{paymentReminders.length} upcoming</span>
          </div>
          <div className="divide-y divide-slate-50">
            {paymentReminders.map((reminder, i) => (
              <div key={i} className="p-4 hover:bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      reminder.priority === 'High' ? 'bg-red-500' :
                      reminder.priority === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`} />
                    <div>
                      <p className="font-medium text-slate-800">{reminder.supplier}</p>
                      <p className="text-xs text-slate-500">Due: {reminder.dueDate}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-800">AED {reminder.amount.toLocaleString()}</p>
                    <p className={`text-xs font-medium ${
                      reminder.daysToDue <= 3 ? 'text-red-600' : reminder.daysToDue <= 7 ? 'text-amber-600' : 'text-slate-400'
                    }`}>
                      {reminder.daysToDue} days left
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Supplier Invoice Upload</h3>
          <button className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-emerald-700">
            <Upload size={14} /> Upload Invoice
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-5 py-3 font-medium text-slate-600">Invoice ID</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Supplier</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Amount</th>
                <th className="text-center px-5 py-3 font-medium text-slate-600">Bookings</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Upload Date</th>
                <th className="text-center px-5 py-3 font-medium text-slate-600">Status</th>
                <th className="text-center px-5 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingInvoices.map(inv => (
                <tr key={inv.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                  <td className="px-5 py-3 font-medium text-slate-600">{inv.id}</td>
                  <td className="px-5 py-3 text-slate-800">{inv.supplier}</td>
                  <td className="px-5 py-3 text-right font-medium text-slate-800">AED {inv.amount.toLocaleString()}</td>
                  <td className="px-5 py-3 text-center text-blue-600">{inv.bookings}</td>
                  <td className="px-5 py-3 text-slate-600">{inv.uploadDate}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                      inv.status === 'Auto-Matched' ? 'bg-emerald-50 text-emerald-700' :
                      inv.status === 'Partial Match' ? 'bg-amber-50 text-amber-700' :
                      'bg-blue-50 text-blue-700'
                    }`}>
                      {inv.status === 'Auto-Matched' && <Check size={12} />}
                      {inv.status === 'Partial Match' && <AlertTriangle size={12} />}
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <button className="text-blue-500 hover:text-blue-700">
                      <RefreshCw size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
        <h3 className="font-semibold text-slate-800 mb-2">Cost Comparison Feature</h3>
        <p className="text-sm text-slate-600 mb-4">Compare supplier costs for similar services to optimize procurement.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {suppliers.slice(0, 3).map(s => (
            <div key={s.id} className="bg-white rounded-lg p-4 border border-slate-100">
              <p className="font-medium text-slate-800 text-sm">{s.name}</p>
              <p className="text-xs text-slate-500">{s.type}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-slate-400">Avg Cost/Booking</span>
                <span className="font-semibold text-slate-800">AED {(Math.random() * 500 + 200).toFixed(0)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
