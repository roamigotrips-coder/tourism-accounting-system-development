import { useState } from 'react';
import { Shield, Search, Download, Eye, Clock, Filter } from 'lucide-react';
import { useAuditTrail } from '../context/AuditTrailContext';

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-emerald-100 text-emerald-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  APPROVE: 'bg-violet-100 text-violet-700',
  REJECT: 'bg-orange-100 text-orange-700',
  POST: 'bg-indigo-100 text-indigo-700',
  LOGIN: 'bg-slate-100 text-slate-600',
  EXPORT: 'bg-teal-100 text-teal-700',
  SUBMIT: 'bg-blue-100 text-blue-700',
  PAYMENT: 'bg-amber-100 text-amber-700',
};

export default function AuditTrail() {
  const { logs, exportCSV } = useAuditTrail();
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');
  const [selected, setSelected] = useState<string | null>(null);

  const modules = ['All', ...Array.from(new Set(logs.map(l => l.module as string)))];
  const actions = ['All', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'POST', 'SUBMIT', 'PAYMENT'];

  const filtered = logs.filter(l =>
    (moduleFilter === 'All' || (l.module as string) === moduleFilter) &&
    (actionFilter === 'All' || l.action === actionFilter) &&
    (l.description?.toLowerCase().includes(search.toLowerCase()) ||
      l.userName?.toLowerCase().includes(search.toLowerCase()) ||
      l.entityId?.toLowerCase().includes(search.toLowerCase()) ||
      l.entityLabel?.toLowerCase().includes(search.toLowerCase()))
  );

  const selectedLog = logs.find(l => l.id === selected);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Audit Trail</h1>
          <p className="text-slate-500 mt-1">Complete system activity log · All changes tracked with diff view</p>
        </div>
        <button onClick={() => exportCSV(filtered)} className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50">
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: logs.length, color: 'text-slate-800' },
          { label: 'Today', value: logs.filter(l => new Date(l.timestamp).toDateString() === new Date().toDateString()).length, color: 'text-blue-600' },
          { label: 'Critical', value: logs.filter(l => l.severity === 'critical').length, color: 'text-red-600' },
          { label: 'Unique Users', value: new Set(logs.map(l => l.userName)).size, color: 'text-violet-600' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
            <p className="text-xs text-slate-500 uppercase tracking-wide">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by user, record, description..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-slate-400" />
          <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
            {modules.map(m => <option key={m}>{m}</option>)}
          </select>
          <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
            {actions.map(a => <option key={a}>{a}</option>)}
          </select>
        </div>
        <span className="self-center text-sm text-slate-400">{filtered.length} results</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-3 font-medium text-slate-600">Timestamp</th>
                <th className="px-4 py-3 font-medium text-slate-600">User</th>
                <th className="px-4 py-3 font-medium text-slate-600">Module</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-center">Action</th>
                <th className="px-4 py-3 font-medium text-slate-600">Record</th>
                <th className="px-4 py-3 font-medium text-slate-600">Description</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-center">Severity</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-center">Diff</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">No audit events found.</td></tr>
              )}
              {filtered.slice(0, 100).map(log => (
                <tr key={log.id} className={`border-t border-slate-50 hover:bg-slate-50/50 ${log.severity === 'critical' ? 'bg-red-50/20' : ''}`}>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    <div className="flex items-center gap-1"><Clock size={11} />{new Date(log.timestamp).toLocaleString()}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                        {(log.userName || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-slate-700 text-xs font-medium">{log.userName || 'System'}</p>
                        <p className="text-slate-400 text-[10px]">{log.userRole}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-medium">{log.module}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-600'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    <p className="font-mono">{log.entityId || '—'}</p>
                    <p className="text-slate-400">{log.entityLabel}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs max-w-[200px] truncate">{log.description || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${log.severity === 'critical' ? 'bg-red-100 text-red-700' : log.severity === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                      {log.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {(log.oldValues || log.newValues || (log.diffs && log.diffs.length > 0)) && (
                      <button onClick={() => setSelected(log.id)}
                        className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg">
                        <Eye size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Diff Modal */}
      {selected && selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-800 rounded-t-2xl">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Shield size={18} /> Change Diff — {selectedLog.entityLabel}
              </h2>
              <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-white/20 rounded-lg text-white">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                {[
                  { label: 'Timestamp', value: new Date(selectedLog.timestamp).toLocaleString() },
                  { label: 'User', value: `${selectedLog.userName} (${selectedLog.userRole})` },
                  { label: 'Action', value: selectedLog.action },
                  { label: 'Module', value: selectedLog.module as string },
                  { label: 'Entity ID', value: selectedLog.entityId || '—' },
                  { label: 'Severity', value: selectedLog.severity },
                ].map(f => (
                  <div key={f.label} className="bg-slate-50 rounded-lg p-2.5">
                    <p className="text-xs text-slate-400">{f.label}</p>
                    <p className="font-medium text-slate-700 text-xs mt-0.5">{f.value}</p>
                  </div>
                ))}
              </div>

              {/* Field Diffs */}
              {selectedLog.diffs && selectedLog.diffs.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Field Changes</p>
                  <div className="space-y-2">
                    {selectedLog.diffs.map((diff, i) => (
                      <div key={i} className="flex items-start gap-3 text-xs border border-slate-100 rounded-lg p-3">
                        <span className="font-semibold text-slate-600 w-32 flex-shrink-0">{diff.label}</span>
                        <span className="line-through text-red-500 flex-1">{String(diff.oldValue ?? '—')}</span>
                        <span className="text-slate-400">→</span>
                        <span className="text-emerald-600 flex-1">{String(diff.newValue ?? '—')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw old/new values */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-red-500 uppercase mb-2">Before</p>
                  <pre className="bg-red-50 border border-red-100 text-red-800 p-3 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                    {selectedLog.oldValues ? JSON.stringify(selectedLog.oldValues, null, 2) : 'No previous value'}
                  </pre>
                </div>
                <div>
                  <p className="text-xs font-semibold text-emerald-600 uppercase mb-2">After</p>
                  <pre className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-3 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                    {selectedLog.newValues ? JSON.stringify(selectedLog.newValues, null, 2) : 'No new value'}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
