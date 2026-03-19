import { useState, useEffect } from 'react';
import { CalendarCheck, Plus, X, Save, Play, CheckCircle, Clock, BarChart3, DollarSign, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface RevSchedule { id: string; invoiceId: string; customer: string; totalAmount: number; recognizedAmount: number; deferredAmount: number; startDate: string; endDate: string; method: string; status: string; entries: RevEntry[]; }
interface RevEntry { id: string; scheduleId: string; period: string; amount: number; status: string; journalEntryId: string | null; recognizedAt: string | null; }

export default function RevenueRecognition() {
  const [schedules, setSchedules] = useState<RevSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<RevSchedule | null>(null);
  const [form, setForm] = useState({ invoiceId: '', customer: '', totalAmount: 0, startDate: '', endDate: '', method: 'straight_line' });

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from('revenue_schedules').select('*').order('created_at', { ascending: false });
      const { data: e } = await supabase.from('revenue_schedule_entries').select('*').order('period');
      const entries = (e ?? []).map((r: any) => ({ id: r.id, scheduleId: r.schedule_id, period: r.period, amount: Number(r.amount), status: r.status, journalEntryId: r.journal_entry_id, recognizedAt: r.recognized_at }));
      setSchedules((s ?? []).map((r: any) => ({ id: r.id, invoiceId: r.invoice_id, customer: r.customer, totalAmount: Number(r.total_amount), recognizedAmount: Number(r.recognized_amount), deferredAmount: Number(r.deferred_amount), startDate: r.start_date, endDate: r.end_date, method: r.method, status: r.status, entries: entries.filter(en => en.scheduleId === r.id) })));
      setLoading(false);
    })();
  }, []);

  const totalDeferred = schedules.filter(s => s.status === 'Active').reduce((sum, s) => sum + s.deferredAmount, 0);
  const totalRecognized = schedules.reduce((sum, s) => sum + s.recognizedAmount, 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const recognizedThisMonth = schedules.flatMap(s => s.entries).filter(e => e.period === thisMonth && e.status === 'Recognized').reduce((sum, e) => sum + e.amount, 0);

  const createSchedule = async () => {
    if (!form.customer || !form.totalAmount || !form.startDate || !form.endDate) return;
    const id = crypto.randomUUID();
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    const months: string[] = [];
    const cur = new Date(start);
    while (cur <= end) { months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`); cur.setMonth(cur.getMonth() + 1); }
    const perPeriod = months.length > 0 ? Math.round((form.totalAmount / months.length) * 100) / 100 : form.totalAmount;

    await supabase.from('revenue_schedules').upsert({ id, invoice_id: form.invoiceId, customer: form.customer, total_amount: form.totalAmount, recognized_amount: 0, deferred_amount: form.totalAmount, start_date: form.startDate, end_date: form.endDate, method: form.method, status: 'Active' }, { onConflict: 'id' });

    const newEntries: RevEntry[] = months.map((p, i) => {
      const amt = i === months.length - 1 ? form.totalAmount - perPeriod * (months.length - 1) : perPeriod;
      return { id: crypto.randomUUID(), scheduleId: id, period: p, amount: Math.round(amt * 100) / 100, status: 'Pending', journalEntryId: null, recognizedAt: null };
    });
    if (newEntries.length > 0) {
      await supabase.from('revenue_schedule_entries').upsert(newEntries.map(e => ({ id: e.id, schedule_id: e.scheduleId, period: e.period, amount: e.amount, status: e.status })), { onConflict: 'id' });
    }

    const newS: RevSchedule = { id, invoiceId: form.invoiceId, customer: form.customer, totalAmount: form.totalAmount, recognizedAmount: 0, deferredAmount: form.totalAmount, startDate: form.startDate, endDate: form.endDate, method: form.method, status: 'Active', entries: newEntries };
    setSchedules(prev => [newS, ...prev]);
    setShowModal(false);
  };

  const recognizeEntry = async (schedule: RevSchedule, entry: RevEntry) => {
    const now = new Date().toISOString();
    await supabase.from('revenue_schedule_entries').update({ status: 'Recognized', recognized_at: now }).eq('id', entry.id);
    const newRecognized = schedule.recognizedAmount + entry.amount;
    const newDeferred = schedule.totalAmount - newRecognized;
    const allRecognized = schedule.entries.every(e => e.id === entry.id || e.status === 'Recognized');
    await supabase.from('revenue_schedules').update({ recognized_amount: newRecognized, deferred_amount: newDeferred, status: allRecognized ? 'Completed' : 'Active' }).eq('id', schedule.id);
    setSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, recognizedAmount: newRecognized, deferredAmount: newDeferred, status: allRecognized ? 'Completed' : 'Active', entries: s.entries.map(e => e.id === entry.id ? { ...e, status: 'Recognized', recognizedAt: now } : e) } : s));
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><CalendarCheck className="text-emerald-600" size={24} /> Revenue Recognition</h1>
          <p className="text-slate-500 mt-1">Manage deferred revenue and recognition schedules</p>
        </div>
        <button onClick={() => { setForm({ invoiceId: '', customer: '', totalAmount: 0, startDate: '', endDate: '', method: 'straight_line' }); setShowModal(true); }} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 text-sm font-medium">
          <Plus size={16} /> New Schedule
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"><p className="text-xs font-semibold text-slate-400 uppercase">Total Deferred</p><p className="text-2xl font-bold text-amber-600">AED {totalDeferred.toLocaleString()}</p></div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"><p className="text-xs font-semibold text-slate-400 uppercase">Recognized This Month</p><p className="text-2xl font-bold text-emerald-600">AED {recognizedThisMonth.toLocaleString()}</p></div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"><p className="text-xs font-semibold text-slate-400 uppercase">Total Recognized</p><p className="text-2xl font-bold text-blue-600">AED {totalRecognized.toLocaleString()}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-800">Schedules</h3>
          {schedules.map(s => (
            <div key={s.id} onClick={() => setSelectedSchedule(s)} className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${selectedSchedule?.id === s.id ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-100'}`}>
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-semibold text-slate-700 text-sm">{s.customer}</h4>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : s.status === 'Completed' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{s.status}</span>
              </div>
              <p className="text-xs text-slate-400">{s.method.replace('_', ' ')} &middot; {s.startDate} to {s.endDate}</p>
              <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5">
                <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${s.totalAmount > 0 ? (s.recognizedAmount / s.totalAmount) * 100 : 0}%` }} />
              </div>
              <p className="text-xs text-slate-500 mt-1">AED {s.recognizedAmount.toLocaleString()} / {s.totalAmount.toLocaleString()}</p>
            </div>
          ))}
          {schedules.length === 0 && <div className="text-center py-8 text-slate-400 text-sm">No schedules yet</div>}
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 font-semibold text-slate-800">
            {selectedSchedule ? `Schedule: ${selectedSchedule.customer}` : 'Select a schedule'}
          </div>
          {selectedSchedule ? (
            <div className="p-5">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-400 uppercase font-semibold">Total</p><p className="text-lg font-bold text-slate-800">AED {selectedSchedule.totalAmount.toLocaleString()}</p></div>
                <div className="bg-emerald-50 rounded-xl p-3"><p className="text-xs text-emerald-600 uppercase font-semibold">Recognized</p><p className="text-lg font-bold text-emerald-700">AED {selectedSchedule.recognizedAmount.toLocaleString()}</p></div>
                <div className="bg-amber-50 rounded-xl p-3"><p className="text-xs text-amber-600 uppercase font-semibold">Deferred</p><p className="text-lg font-bold text-amber-700">AED {selectedSchedule.deferredAmount.toLocaleString()}</p></div>
              </div>
              <h4 className="text-sm font-semibold text-slate-600 mb-3">Period Entries</h4>
              <div className="space-y-2">
                {selectedSchedule.entries.map(e => (
                  <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      {e.status === 'Recognized' ? <CheckCircle size={16} className="text-emerald-500" /> : <Clock size={16} className="text-slate-400" />}
                      <div>
                        <p className="text-sm font-medium text-slate-700">{e.period}</p>
                        <p className="text-xs text-slate-400">{e.status === 'Recognized' && e.recognizedAt ? `Recognized ${new Date(e.recognizedAt).toLocaleDateString()}` : 'Pending'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-700">AED {e.amount.toLocaleString()}</span>
                      {e.status === 'Pending' && (
                        <button onClick={() => recognizeEntry(selectedSchedule, e)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 flex items-center gap-1">
                          <Play size={11} /> Recognize
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400">Click a schedule to view its recognition timeline</div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-slate-800">New Revenue Schedule</h3><button onClick={() => setShowModal(false)}><X size={20} className="text-slate-400" /></button></div>
            <div className="space-y-4">
              <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Customer *</label><input value={form.customer} onChange={e => setForm(p => ({ ...p, customer: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" /></div>
              <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Invoice ID</label><input value={form.invoiceId} onChange={e => setForm(p => ({ ...p, invoiceId: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" placeholder="Optional" /></div>
              <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Total Amount *</label><input type="number" value={form.totalAmount || ''} onChange={e => setForm(p => ({ ...p, totalAmount: Number(e.target.value) }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Start Date *</label><input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" /></div>
                <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">End Date *</label><input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" /></div>
              </div>
              <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Method</label><select value={form.method} onChange={e => setForm(p => ({ ...p, method: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm"><option value="straight_line">Straight Line</option><option value="milestone">Milestone</option><option value="percentage_completion">% Completion</option></select></div>
              <button onClick={createSchedule} className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 flex items-center justify-center gap-2"><Save size={16} /> Create Schedule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
