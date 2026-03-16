import { useState } from 'react';
import { Lock, LockOpen, ShieldCheck, Calendar, Key, AlertTriangle, CheckCircle, Info, Trash2, History } from 'lucide-react';
import { useAccountingEngine } from '../context/AccountingEngine';

export default function TransactionLocking() {
  const { transactionLock, setTransactionLock, clearTransactionLock, isTransactionLocked, entries, globalAuditLog } = useAccountingEngine();

  // Set lock form
  const [lockDate, setLockDate]         = useState('');
  const [usePassword, setUsePassword]   = useState(false);
  const [password, setPassword]         = useState('');
  const [confirmPass, setConfirmPass]   = useState('');
  const [setError, setSetError]         = useState('');
  const [setSuccess, setSetSuccess]     = useState('');

  // Clear lock form
  const [clearPass, setClearPass]       = useState('');
  const [clearError, setClearError]     = useState('');
  const [clearSuccess, setClearSuccess] = useState('');

  const handleSetLock = () => {
    setSetError(''); setSetSuccess('');
    if (!lockDate) { setSetError('Please select a lock date.'); return; }
    if (usePassword) {
      if (password.length < 4) { setSetError('Password must be at least 4 characters.'); return; }
      if (password !== confirmPass) { setSetError('Passwords do not match.'); return; }
    }
    setTransactionLock(lockDate, 'Admin User', usePassword ? password : undefined);
    setSetSuccess(`Transactions on or before ${lockDate} are now locked.`);
    setLockDate(''); setPassword(''); setConfirmPass(''); setUsePassword(false);
  };

  const handleClearLock = () => {
    setClearError(''); setClearSuccess('');
    const ok = clearTransactionLock(transactionLock?.hasPassword ? clearPass : undefined);
    if (!ok) { setClearError('Incorrect password. Lock not removed.'); return; }
    setClearSuccess('Transaction lock has been removed.');
    setClearPass('');
  };

  // Locked transactions count
  const lockedCount = transactionLock
    ? entries.filter(e => isTransactionLocked(e.date)).length
    : 0;

  // Recent lock audit events
  const lockAudit = globalAuditLog.filter((a: any) => a.module === 'Transaction Lock').slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Lock size={22} className="text-slate-600" /> Transaction Locking
        </h1>
        <p className="text-slate-500 mt-1">
          Prevent backdating — lock all transactions on or before a date so they cannot be created, edited, or deleted.
        </p>
      </div>

      {/* Status banner */}
      {transactionLock ? (
        <div className="flex items-start gap-4 p-5 rounded-xl border-2 border-amber-200 bg-amber-50">
          <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
            <Lock size={18} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-amber-800 text-lg">Lock is Active</p>
            <p className="text-amber-700 text-sm mt-0.5">
              All transactions on or before <span className="font-bold">{transactionLock.lockDate}</span> are locked.
            </p>
            <div className="flex flex-wrap gap-4 mt-2 text-xs text-amber-700">
              <span>Locked by: <strong>{transactionLock.lockedBy}</strong></span>
              <span>Locked on: <strong>{new Date(transactionLock.lockedAt).toLocaleString()}</strong></span>
              <span>Transactions affected: <strong>{lockedCount}</strong></span>
              <span>Password protected: <strong>{transactionLock.hasPassword ? 'Yes' : 'No'}</strong></span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4 p-5 rounded-xl border border-slate-200 bg-slate-50">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <LockOpen size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-700">No Lock Active</p>
            <p className="text-slate-500 text-sm">All transactions can be freely created and edited.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Set Lock */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 p-5 border-b border-slate-100">
            <ShieldCheck size={17} className="text-emerald-600" />
            <h2 className="font-semibold text-slate-800">
              {transactionLock ? 'Update Lock Date' : 'Set Transaction Lock'}
            </h2>
          </div>
          <div className="p-5 space-y-4">
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 flex gap-2 text-sm text-blue-700">
              <Info size={15} className="shrink-0 mt-0.5" />
              <span>
                Setting a lock date prevents any transaction dated on or before that date from being created, modified, or deleted — even by administrators.
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                <Calendar size={13} className="inline mr-1" /> Lock Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={lockDate}
                onChange={e => setLockDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <p className="text-xs text-slate-400 mt-1">Transactions on or before this date will be locked.</p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="usePass"
                checked={usePassword}
                onChange={e => setUsePassword(e.target.checked)}
                className="w-4 h-4 accent-emerald-600"
              />
              <label htmlFor="usePass" className="text-sm text-slate-700 flex items-center gap-1 cursor-pointer">
                <Key size={13} /> Password-protect this lock
              </label>
            </div>

            {usePassword && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 4 characters"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPass}
                    onChange={e => setConfirmPass(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            {setError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                <AlertTriangle size={14} /> {setError}
              </div>
            )}
            {setSuccess && (
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">
                <CheckCircle size={14} /> {setSuccess}
              </div>
            )}

            <button
              onClick={handleSetLock}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors"
            >
              <Lock size={15} /> {transactionLock ? 'Update Lock' : 'Apply Lock'}
            </button>
          </div>
        </div>

        {/* Remove Lock */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 p-5 border-b border-slate-100">
            <LockOpen size={17} className="text-rose-500" />
            <h2 className="font-semibold text-slate-800">Remove Lock</h2>
          </div>
          <div className="p-5 space-y-4">
            {!transactionLock ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
                <LockOpen size={32} />
                <p className="text-sm">No active lock to remove.</p>
              </div>
            ) : (
              <>
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 flex gap-2 text-sm text-rose-700">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <span>
                    Removing the lock will allow transactions before <strong>{transactionLock.lockDate}</strong> to be edited again. This action is logged.
                  </span>
                </div>

                {transactionLock.hasPassword && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      <Key size={13} className="inline mr-1" /> Lock Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={clearPass}
                      onChange={e => setClearPass(e.target.value)}
                      placeholder="Enter the lock password"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                    />
                  </div>
                )}

                {clearError && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                    <AlertTriangle size={14} /> {clearError}
                  </div>
                )}
                {clearSuccess && (
                  <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">
                    <CheckCircle size={14} /> {clearSuccess}
                  </div>
                )}

                <button
                  onClick={handleClearLock}
                  className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors"
                >
                  <Trash2 size={15} /> Remove Lock
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Locked Transactions Preview */}
      {transactionLock && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Lock size={15} className="text-amber-500" />
              <h2 className="font-semibold text-slate-800">Locked Transactions</h2>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">{lockedCount}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            {lockedCount === 0 ? (
              <div className="flex items-center justify-center py-10 text-slate-400 text-sm">No transactions fall within the locked period.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-5 py-3 font-medium text-slate-600">Entry #</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-600">Date</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-600">Description</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-600">Reference</th>
                    <th className="text-right px-5 py-3 font-medium text-slate-600">Amount</th>
                    <th className="text-center px-5 py-3 font-medium text-slate-600">Status</th>
                    <th className="text-center px-5 py-3 font-medium text-slate-600">Lock</th>
                  </tr>
                </thead>
                <tbody>
                  {entries
                    .filter(e => isTransactionLocked(e.date))
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, 20)
                    .map(e => (
                      <tr key={e.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                        <td className="px-5 py-3 font-mono text-xs text-blue-600">{e.entryNumber}</td>
                        <td className="px-5 py-3 text-slate-600">{e.date}</td>
                        <td className="px-5 py-3 text-slate-700 max-w-xs truncate">{e.description}</td>
                        <td className="px-5 py-3 text-slate-500 text-xs">{e.reference}</td>
                        <td className="px-5 py-3 text-right font-medium text-slate-800">
                          AED {e.totalDebit.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            e.status === 'Posted'   ? 'bg-emerald-50 text-emerald-700' :
                            e.status === 'Draft'    ? 'bg-slate-100 text-slate-600'   :
                            e.status === 'Reversed' ? 'bg-purple-50 text-purple-700'  :
                            'bg-amber-50 text-amber-700'
                          }`}>{e.status}</span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <Lock size={13} className="text-amber-500 inline" />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Audit Log */}
      {lockAudit.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 p-5 border-b border-slate-100">
            <History size={15} className="text-slate-500" />
            <h2 className="font-semibold text-slate-800">Lock History</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {lockAudit.map((a: any) => (
              <div key={a.id} className="flex items-start gap-3 px-5 py-3">
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Lock size={11} className="text-slate-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-700"><span className="font-medium">{a.userName}</span> — {a.action}</p>
                  <p className="text-xs text-slate-400">{a.details} · {new Date(a.timestamp).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
