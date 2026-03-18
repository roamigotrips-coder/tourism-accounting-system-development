import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Calendar, Clock, PauseCircle, PlayCircle, Info } from 'lucide-react';
import { fetchRecurringBilling, type RecurringBillingEntry } from '../lib/supabaseSync';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';

export default function RecurringBilling() {
  // List filters and state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);

  const [allBilling, setAllBilling] = useState<RecurringBillingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchRecurringBilling();
        if (!cancelled && data) setAllBilling(data);
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredBilling = useMemo(() => {
    return allBilling.filter((billing) => {
      const matchesSearch =
        billing.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        billing.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || billing.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [allBilling, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: allBilling.length,
      active: allBilling.filter((b) => b.status === 'Active').length,
      paused: allBilling.filter((b) => b.status === 'Paused').length,
      completed: allBilling.filter((b) => b.status === 'Completed').length,
      monthlyValue: allBilling
        .filter((b) => b.status === 'Active' && b.frequency === 'Monthly')
        .reduce((sum, b) => sum + b.amount, 0),
    };
  }, [allBilling]);

  // Advanced recurring billing fields (schedules + proration)
  const [entryName, setEntryName] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [frequency, setFrequency] = useState<'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly'>('Monthly');
  const [intervalEvery, setIntervalEvery] = useState<number>(1); // every N periods
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [trialDays, setTrialDays] = useState<number>(0);
  const [anchorDay, setAnchorDay] = useState<number>(0); // 0 means align to start date; otherwise day of month 1-31
  const [enableProration, setEnableProration] = useState<boolean>(true);
  const [description, setDescription] = useState('');

  const baseAmount = useMemo(() => Math.max(0, (quantity || 0) * (unitPrice || 0)), [quantity, unitPrice]);

  function addPeriod(date: Date, freq: typeof frequency, interval: number) {
    const d = new Date(date);
    if (freq === 'Daily') d.setDate(d.getDate() + 1 * interval);
    if (freq === 'Weekly') d.setDate(d.getDate() + 7 * interval);
    if (freq === 'Monthly') d.setMonth(d.getMonth() + 1 * interval);
    if (freq === 'Quarterly') d.setMonth(d.getMonth() + 3 * interval);
    if (freq === 'Yearly') d.setFullYear(d.getFullYear() + 1 * interval);
    return d;
  }

  function getDaysBetween(a: Date, b: Date) {
    const ms = b.getTime() - a.getTime();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  function getAnchorDateForMonth(base: Date, desiredDay: number) {
    if (desiredDay <= 0) return new Date(base); // anchor to start date
    const d = new Date(base);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const day = Math.min(desiredDay, lastDay);
    return new Date(d.getFullYear(), d.getMonth(), day);
  }

  const proration = useMemo(() => {
    if (!startDate) return null as null | {
      start: Date; periodStart: Date; periodEnd: Date; totalDays: number; proratedDays: number; ratio: number; baseAmount: number; firstInvoiceAmount: number;
    };
    const start = new Date(startDate + 'T00:00:00');

    // Determine the first period start based on frequency/anchor
    let periodStart = new Date(start);
    if (frequency === 'Monthly' || frequency === 'Quarterly' || frequency === 'Yearly') {
      const anchor = getAnchorDateForMonth(start, anchorDay);
      let firstAnchor = anchor;
      if (start > anchor) {
        firstAnchor = addPeriod(anchor, frequency, intervalEvery);
      }
      periodStart = new Date(firstAnchor);
    }

    const periodEnd = addPeriod(periodStart, frequency, intervalEvery);
    const totalDays = Math.max(1, getDaysBetween(periodStart, periodEnd));

    let proratedDays = 0;
    if (start < periodStart) {
      proratedDays = getDaysBetween(start, periodStart);
    }

    const ratio = totalDays > 0 ? Math.min(1, proratedDays / totalDays) : 0;
    const proratedAmount = enableProration ? Math.round(baseAmount * ratio * 100) / 100 : baseAmount;

    return {
      start,
      periodStart,
      periodEnd,
      totalDays,
      proratedDays,
      ratio,
      baseAmount,
      firstInvoiceAmount: proratedAmount,
    };
  }, [startDate, frequency, intervalEvery, anchorDay, enableProration, baseAmount]);

  const schedule = useMemo(() => {
    if (!startDate) return [] as { date: string; amount: number; label: string }[];
    const out: { date: string; amount: number; label: string }[] = [];
    const start = new Date(startDate + 'T00:00:00');

    // First invoice: prorated (if any)
    if (proration && proration.firstInvoiceAmount > 0 && proration.proratedDays > 0) {
      out.push({ date: start.toISOString().slice(0, 10), amount: proration.firstInvoiceAmount, label: 'Prorated First Invoice' });
    }

    // Next cycles
    let cycleStart = proration ? proration.periodStart : start;
    for (let i = 0; i < 12; i++) {
      out.push({ date: cycleStart.toISOString().slice(0, 10), amount: baseAmount, label: 'Recurring Invoice' });
      cycleStart = addPeriod(cycleStart, frequency, intervalEvery);
      if (endDate) {
        const e = new Date(endDate + 'T00:00:00');
        if (cycleStart > e) break;
      }
    }

    return out;
  }, [startDate, endDate, proration, baseAmount, frequency, intervalEvery]);

  const canCreate = entryName.trim().length > 0 && baseAmount > 0 && startDate !== '';

  if (loading) return <LoadingSpinner message="Loading recurring billing..." />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recurring Billing</h1>
          <p className="text-gray-600 mt-1">Automate recurring schedules with proration and previews</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={18} />
          New Recurring Entry
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <p className="text-sm text-gray-600">Total Entries</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg shadow-sm border-l-4 border-green-500">
          <p className="text-sm text-gray-600">Active</p>
          <p className="text-2xl font-bold text-green-700">{stats.active}</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg shadow-sm border-l-4 border-yellow-500">
          <p className="text-sm text-gray-600">Paused</p>
          <p className="text-2xl font-bold text-yellow-700">{stats.paused}</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg shadow-sm border-l-4 border-blue-500">
          <p className="text-sm text-gray-600">Monthly Value</p>
          <p className="text-2xl font-bold text-blue-700">AED {stats.monthlyValue.toLocaleString()}</p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
        <Clock size={20} className="text-blue-600" />
        <p className="text-sm text-blue-800">
          Recurring entries are automatically processed on their scheduled dates. Entries with status
          <strong> Active</strong> will create journal entries automatically.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4 flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search recurring entries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="All">All Status</option>
          <option value="Active">Active</option>
          <option value="Paused">Paused</option>
          <option value="Completed">Completed</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Entry Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Amount</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Frequency</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Next Run</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Runs</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBilling.map((billing) => (
              <tr key={billing.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium">{billing.name}</p>
                    <p className="text-sm text-gray-600">{billing.description}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-mono font-medium text-blue-600">AED {billing.amount.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm">
                  <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-800 text-xs">{billing.frequency}</span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-gray-400" />
                    <span className="text-gray-600">{billing.nextRunDate}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{billing.runCount}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium
                    ${billing.status === 'Active' ? 'bg-green-100 text-green-800' : billing.status === 'Paused' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}
                  >
                    {billing.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {billing.status === 'Active' && (
                      <button className="text-yellow-600 hover:text-yellow-800" title="Pause">
                        <PauseCircle size={18} />
                      </button>
                    )}
                    {billing.status === 'Paused' && (
                      <button className="text-green-600 hover:text-green-800" title="Resume">
                        <PlayCircle size={18} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredBilling.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Clock size={48} className="mx-auto mb-4 opacity-50" />
          <p>No recurring entries found</p>
        </div>
      )}

      {/* Add Recurring Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">New Recurring Entry</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Entry Name *</label>
                  <input
                    type="text"
                    value={entryName}
                    onChange={(e) => setEntryName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="e.g., Monthly Rent"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Quantity *</label>
                    <input
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Unit Price *</label>
                    <input
                      type="number"
                      min={0}
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Subtotal</label>
                    <div className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-700">AED {baseAmount.toLocaleString()}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">Frequency *</label>
                    <div className="flex items-center gap-2">
                      <span>Every</span>
                      <input
                        type="number"
                        min={1}
                        value={intervalEvery}
                        onChange={(e) => setIntervalEvery(parseInt(e.target.value || '1', 10))}
                        className="w-20 px-3 py-2 border rounded-lg"
                      />
                      <select
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value as any)}
                        className="px-3 py-2 border rounded-lg flex-1"
                      >
                        <option>Daily</option>
                        <option>Weekly</option>
                        <option>Monthly</option>
                        <option>Quarterly</option>
                        <option>Yearly</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Anchor Day</label>
                    <input
                      type="number"
                      min={0}
                      max={31}
                      value={anchorDay}
                      onChange={(e) => setAnchorDay(parseInt(e.target.value || '0', 10))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">0 = align to start date; otherwise day of month</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Start Date *</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">End Date (Optional)</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Trial Days</label>
                    <input type="number" min={0} value={trialDays} onChange={(e) => setTrialDays(parseInt(e.target.value || '0', 10))} className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input id="prorate" type="checkbox" checked={enableProration} onChange={(e) => setEnableProration(e.target.checked)} />
                  <label htmlFor="prorate" className="text-sm">Prorate the first invoice if start date is mid-cycle</label>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg h-20"
                    placeholder="Description..."
                  />
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm flex items-start gap-2">
                  <Info size={16} className="text-yellow-600 mt-0.5" />
                  <p className="text-yellow-800">Proration uses calendar days between the start date and the first full cycle anchor date. Anchor Day applies to Monthly/Quarterly/Yearly frequencies.</p>
                </div>
              </div>

              {/* Right: Live Preview */}
              <div className="space-y-4">
                <div className="bg-gray-50 border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">First Invoice Preview</h3>
                  {!startDate ? (
                    <p className="text-gray-500 text-sm">Set a Start Date to see the proration preview.</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Base Amount</span>
                        <span className="font-mono">AED {baseAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Prorated Amount</span>
                        <span className="font-mono">AED {(proration?.firstInvoiceAmount ?? 0).toLocaleString()}</span>
                      </div>
                      {proration && (
                        <p className="text-xs text-gray-600">
                          From {proration.start.toISOString().slice(0, 10)} to first cycle {proration.periodStart.toISOString().slice(0, 10)} · {proration.proratedDays} of {proration.totalDays} days
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-white border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Schedule Preview (next 12)</h3>
                  {schedule.length === 0 ? (
                    <p className="text-gray-500 text-sm">Set Start Date and Frequency to see the upcoming schedule.</p>
                  ) : (
                    <div className="max-h-56 overflow-auto border rounded">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left">Date</th>
                            <th className="px-3 py-2 text-left">Label</th>
                            <th className="px-3 py-2 text-left">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {schedule.map((s, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="px-3 py-2 font-mono">{s.date}</td>
                              <td className="px-3 py-2">{s.label}</td>
                              <td className="px-3 py-2 font-mono">AED {s.amount.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t flex justify-between items-center gap-3">
              <div className="text-xs text-gray-500">Entries will post to ledger on their scheduled dates. You can edit, pause, or cancel any recurring entry later.</div>
              <div className="flex gap-2">
                <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button disabled={!canCreate} className={`px-4 py-2 rounded-lg text-white ${canCreate ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}>
                  Create Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
