import { useState, useMemo } from 'react';
import {
  Plus, Search, Download, AlertCircle, CheckCircle, Clock, XCircle,
  Eye, RotateCcw, Trash2, Send, Check, X, ChevronDown, ChevronUp,
  FileText, Shield, AlertTriangle, Info, BookOpen, Printer
} from 'lucide-react';
import { useAccountingEngine, JournalEntry, JournalLine, ValidationResult } from '../context/AccountingEngine';
import AttachmentPanel from '../components/AttachmentPanel';

const STATUS_COLORS: Record<string, string> = {
  'Draft':            'bg-gray-100 text-gray-700 border-gray-200',
  'Pending Approval': 'bg-amber-100 text-amber-700 border-amber-200',
  'Approved':         'bg-blue-100 text-blue-700 border-blue-200',
  'Posted':           'bg-green-100 text-green-700 border-green-200',
  'Rejected':         'bg-red-100 text-red-700 border-red-200',
  'Reversed':         'bg-purple-100 text-purple-700 border-purple-200',
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  'Draft':            FileText,
  'Pending Approval': Clock,
  'Approved':         CheckCircle,
  'Posted':           Check,
  'Rejected':         XCircle,
  'Reversed':         RotateCcw,
};

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  Asset:     'text-blue-600',
  Liability: 'text-purple-600',
  Equity:    'text-yellow-600',
  Revenue:   'text-green-600',
  Expense:   'text-red-600',
};

function fmt(n: number) {
  return n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── New Entry Modal ──────────────────────────────────────────────────────────

function NewEntryModal({ onClose }: { onClose: () => void }) {
  const { accounts, periods, validateEntry, saveDraft, submitForApproval, postEntry, nextEntryNumber } = useAccountingEngine();

  const activeAccounts = accounts.filter(a => a.status === 'Active').sort((a, b) => a.code.localeCompare(b.code));
  const openPeriods = periods.filter(p => p.status === 'Open');

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    reference: '',
    notes: '',
  });
  const [lines, setLines] = useState<JournalLine[]>([
    { id: 'L1', accountId: '', accountCode: '', accountName: '', accountType: 'Asset', description: '', debit: 0, credit: 0 },
    { id: 'L2', accountId: '', accountCode: '', accountName: '', accountType: 'Asset', description: '', debit: 0, credit: 0 },
  ]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitMode, setSubmitMode] = useState<'draft' | 'submit' | 'post'>('draft');
  const [success, setSuccess] = useState('');
  const [touched, setTouched] = useState(false);

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  const diff = Math.round((totalDebit - totalCredit) * 100) / 100;
  const isBalanced = diff === 0 && totalDebit > 0;

  const currentPeriod = openPeriods.find(p => p.period === form.date.substring(0, 7));
  const entryPeriod = periods.find(p => p.period === form.date.substring(0, 7));

  function updateLine(id: string, field: keyof JournalLine, value: any) {
    setLines(prev => prev.map(l => {
      if (l.id !== id) return l;
      if (field === 'accountId') {
        const acc = activeAccounts.find(a => a.id === value);
        return { ...l, accountId: value, accountCode: acc?.code || '', accountName: acc?.name || '', accountType: acc?.type || 'Asset' };
      }
      if (field === 'debit') return { ...l, debit: parseFloat(value) || 0, credit: 0 };
      if (field === 'credit') return { ...l, credit: parseFloat(value) || 0, debit: 0 };
      return { ...l, [field]: value };
    }));
  }

  function addLine() {
    setLines(prev => [...prev, { id: `L${Date.now()}`, accountId: '', accountCode: '', accountName: '', accountType: 'Asset', description: '', debit: 0, credit: 0 }]);
  }

  function removeLine(id: string) {
    if (lines.length <= 2) return;
    setLines(prev => prev.filter(l => l.id !== id));
  }

  function runValidation() {
    const result = validateEntry({ ...form, lines });
    setValidation(result);
    return result;
  }

  function autoBalance() {
    if (lines.length < 2) return;
    const lastLine = lines[lines.length - 1];
    if (totalDebit > totalCredit) {
      updateLine(lastLine.id, 'credit', totalDebit - (totalCredit - lastLine.credit));
    } else if (totalCredit > totalDebit) {
      updateLine(lastLine.id, 'debit', totalCredit - (totalDebit - lastLine.debit));
    }
  }

  async function handleSave(mode: 'draft' | 'submit' | 'post') {
    setTouched(true);
    const result = runValidation();
    if (!result.valid && mode !== 'draft') return;
    if (mode === 'draft' && result.errors.filter(e => e.code !== 'E013' && e.code !== 'E001' && e.code !== 'E002').length > 0) {
      // Allow saving draft with minor issues
    }
    setSaving(true);
    setSubmitMode(mode);
    setTimeout(() => {
      const entry = saveDraft({ ...form, lines, attachments: [] });
      if (mode === 'submit') submitForApproval(entry.id, 'Current User');
      if (mode === 'post') { submitForApproval(entry.id, 'Current User'); postEntry(entry.id, 'Current User'); }
      setSuccess(
        mode === 'draft' ? 'Draft saved successfully!' :
        mode === 'submit' ? 'Entry submitted for approval!' :
        'Entry posted to General Ledger!'
      );
      setSaving(false);
      setTimeout(() => onClose(), 1500);
    }, 600);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <BookOpen size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">New Journal Entry</h2>
              <p className="text-sm text-gray-500">{nextEntryNumber()} · Double-entry accounting</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </div>

        {success ? (
          <div className="p-16 flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle size={40} className="text-green-600" />
            </div>
            <p className="text-xl font-semibold text-gray-800">{success}</p>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Period Warning */}
            {entryPeriod && entryPeriod.status !== 'Open' && (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle size={20} className="text-red-600 shrink-0" />
                <div>
                  <p className="font-semibold text-red-800">Period Closed — {entryPeriod.name}</p>
                  <p className="text-sm text-red-600">This period is {entryPeriod.status}. You cannot post entries to a closed period. Please select a date in an open period.</p>
                </div>
              </div>
            )}
            {currentPeriod && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                <CheckCircle size={16} />
                <span>Period: <strong>{currentPeriod.name}</strong> is Open — entries can be posted.</span>
              </div>
            )}

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input type="date" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 ${touched && !form.date ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Reference <span className="text-red-500">*</span>
                </label>
                <input type="text" value={form.reference} placeholder="e.g. INV-001, BK-2024-001"
                  onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                  className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 ${touched && !form.reference ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <input type="text" value={form.description} placeholder="What is this entry for?"
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 ${touched && !form.description ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                />
              </div>
            </div>

            {/* Double Entry Info Banner */}
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <strong>Double-Entry Rule:</strong> Every transaction must have equal Debit and Credit totals. 
                Example: Selling a tour package → Debit <em>Accounts Receivable</em> (money owed to you) and Credit <em>Sales Revenue</em> (income earned).
              </div>
            </div>

            {/* Journal Lines */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <FileText size={16} />
                  Journal Lines
                </h3>
                <div className="flex items-center gap-2">
                  {!isBalanced && totalDebit > 0 && (
                    <button onClick={autoBalance} className="text-xs px-3 py-1.5 bg-amber-100 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-200 flex items-center gap-1">
                      <AlertTriangle size={12} />
                      Auto-Balance Last Line
                    </button>
                  )}
                  <button onClick={addLine} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100">
                    <Plus size={14} /> Add Line
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 w-8">#</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 min-w-[200px]">Account <span className="text-red-500">*</span></th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 min-w-[180px]">Description <span className="text-red-500">*</span></th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600 w-36">Debit (AED)</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600 w-36">Credit (AED)</th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lines.map((line, idx) => {
                      const acc = accounts.find(a => a.id === line.accountId);
                      const lineErr = validation?.errors.filter(e => e.lineId === line.id) || [];
                      return (
                        <tr key={line.id} className={lineErr.length > 0 ? 'bg-red-50' : 'hover:bg-gray-50'}>
                          <td className="px-3 py-2 text-gray-400 text-xs">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <select
                              value={line.accountId}
                              onChange={e => updateLine(line.id, 'accountId', e.target.value)}
                              className={`w-full border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 ${!line.accountId && touched ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                            >
                              <option value="">— Select Account —</option>
                              {['Asset','Liability','Equity','Revenue','Expense'].map(type => (
                                <optgroup key={type} label={`${type}s`}>
                                  {activeAccounts.filter(a => a.type === type).map(a => (
                                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                            {acc && (
                              <div className={`text-xs mt-0.5 ${ACCOUNT_TYPE_COLORS[acc.type]}`}>
                                {acc.type} · Normal: {acc.normalBalance}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <input type="text" value={line.description} placeholder="Line detail..."
                              onChange={e => updateLine(line.id, 'description', e.target.value)}
                              className={`w-full border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 ${!line.description && touched ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="0" value={line.debit || ''}
                              onChange={e => updateLine(line.id, 'debit', e.target.value)}
                              placeholder="0.00"
                              className={`w-full border rounded-lg px-2 py-1.5 text-sm text-right focus:ring-2 focus:ring-blue-500 ${line.debit > 0 ? 'border-blue-300 bg-blue-50 font-semibold' : 'border-gray-300'}`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="0" value={line.credit || ''}
                              onChange={e => updateLine(line.id, 'credit', e.target.value)}
                              placeholder="0.00"
                              className={`w-full border rounded-lg px-2 py-1.5 text-sm text-right focus:ring-2 focus:ring-blue-500 ${line.credit > 0 ? 'border-green-300 bg-green-50 font-semibold' : 'border-gray-300'}`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            {lines.length > 2 && (
                              <button onClick={() => removeLine(line.id)} className="text-red-400 hover:text-red-600">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-300 bg-gray-50">
                    <tr>
                      <td colSpan={3} className="px-3 py-3 font-bold text-gray-800 text-right">TOTALS</td>
                      <td className="px-3 py-3 text-right">
                        <span className={`font-bold text-lg ${totalDebit > 0 ? 'text-blue-700' : 'text-gray-400'}`}>
                          AED {fmt(totalDebit)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className={`font-bold text-lg ${totalCredit > 0 ? 'text-green-700' : 'text-gray-400'}`}>
                          AED {fmt(totalCredit)}
                        </span>
                      </td>
                      <td></td>
                    </tr>
                    <tr>
                      <td colSpan={6} className="px-3 pb-3">
                        <div className={`flex items-center justify-between p-3 rounded-xl border-2 ${isBalanced ? 'bg-green-50 border-green-300' : totalDebit > 0 ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200'}`}>
                          <div className="flex items-center gap-2">
                            {isBalanced ? (
                              <><CheckCircle size={20} className="text-green-600" /><span className="font-bold text-green-700">✓ BALANCED — Entry is valid for posting</span></>
                            ) : totalDebit > 0 || totalCredit > 0 ? (
                              <><AlertCircle size={20} className="text-red-600" /><span className="font-bold text-red-700">⚠ UNBALANCED — Difference: AED {fmt(Math.abs(diff))}</span></>
                            ) : (
                              <><Info size={20} className="text-gray-400" /><span className="text-gray-500">Enter amounts in the lines above</span></>
                            )}
                          </div>
                          {!isBalanced && diff !== 0 && (
                            <div className="text-sm text-red-600">
                              {diff > 0 ? `Need AED ${fmt(diff)} more in Credit` : `Need AED ${fmt(Math.abs(diff))} more in Debit`}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Validation Errors */}
            {validation && !validation.valid && touched && (
              <div className="border border-red-200 rounded-xl overflow-hidden">
                <div className="bg-red-50 px-4 py-3 flex items-center gap-2 border-b border-red-200">
                  <AlertCircle size={16} className="text-red-600" />
                  <span className="font-semibold text-red-800">Validation Errors ({validation.errors.length})</span>
                </div>
                <div className="p-4 space-y-2">
                  {validation.errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-red-700">
                      <span className="font-mono text-xs bg-red-100 px-1.5 py-0.5 rounded shrink-0">{err.code}</span>
                      <span>{err.message}</span>
                    </div>
                  ))}
                </div>
                {validation.warnings.length > 0 && (
                  <div className="p-4 pt-0 space-y-2">
                    {validation.warnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-amber-700">
                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                        <span>{w.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {!success && (
          <div className="flex items-center justify-between p-6 border-t bg-gray-50 rounded-b-2xl">
            <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800 border rounded-lg hover:bg-gray-100">
              Cancel
            </button>
            <div className="flex items-center gap-2">
              <button onClick={() => handleSave('draft')} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 border rounded-lg hover:bg-gray-200 disabled:opacity-50">
                <FileText size={16} />
                {saving && submitMode === 'draft' ? 'Saving…' : 'Save Draft'}
              </button>
              <button onClick={() => { runValidation(); setTouched(true); handleSave('submit'); }}
                disabled={saving || !isBalanced}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50">
                <Send size={16} />
                {saving && submitMode === 'submit' ? 'Submitting…' : 'Submit for Approval'}
              </button>
              <button onClick={() => { runValidation(); setTouched(true); handleSave('post'); }}
                disabled={saving || !isBalanced || (entryPeriod?.status !== 'Open' && !!entryPeriod)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                <Check size={16} />
                {saving && submitMode === 'post' ? 'Posting…' : 'Post to Ledger'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── View Entry Modal ─────────────────────────────────────────────────────────

function ViewEntryModal({ entry, onClose, onAction }: { entry: JournalEntry; onClose: () => void; onAction: (action: string) => void }) {
  const [showAudit, setShowAudit] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [reverseReason, setReverseReason] = useState('');
  const [showReverse, setShowReverse] = useState(false);

  const StatusIcon = STATUS_ICONS[entry.status] || FileText;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-slate-50 to-gray-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center">
              <BookOpen size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{entry.entryNumber}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-semibold ${STATUS_COLORS[entry.status]}`}>
                  <StatusIcon size={10} />
                  {entry.status}
                </span>
                <span className="text-sm text-gray-500">{entry.date} · {entry.source}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="p-2 text-gray-400 hover:text-gray-600 border rounded-lg"><Printer size={18} /></button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Date', value: entry.date },
              { label: 'Reference', value: entry.reference || '—' },
              { label: 'Period', value: entry.period },
              { label: 'Created By', value: entry.createdBy },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3">
                <div className="text-xs text-gray-500">{label}</div>
                <div className="font-semibold text-gray-900 mt-0.5">{value}</div>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="text-sm text-gray-600"><span className="font-semibold">Description:</span> {entry.description}</div>
          </div>

          {/* Rejection Reason */}
          {entry.status === 'Rejected' && entry.rejectionReason && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <XCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800">Rejected by {entry.rejectedBy}</p>
                <p className="text-sm text-red-600 mt-1">{entry.rejectionReason}</p>
              </div>
            </div>
          )}

          {/* Journal Lines */}
          <div className="border rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 font-semibold text-gray-800 border-b flex items-center gap-2">
              <FileText size={16} /> Journal Lines
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Account</th>
                  <th className="px-4 py-2 text-left font-semibold">Description</th>
                  <th className="px-4 py-2 text-right font-semibold">Debit (AED)</th>
                  <th className="px-4 py-2 text-right font-semibold">Credit (AED)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entry.lines.map(line => (
                  <tr key={line.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{line.accountCode} — {line.accountName}</div>
                      <div className={`text-xs ${ACCOUNT_TYPE_COLORS[line.accountType]}`}>{line.accountType}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{line.description}</td>
                    <td className="px-4 py-3 text-right font-mono">{line.debit > 0 ? <span className="text-blue-700 font-semibold">{fmt(line.debit)}</span> : <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-right font-mono">{line.credit > 0 ? <span className="text-green-700 font-semibold">{fmt(line.credit)}</span> : <span className="text-gray-300">—</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-300 bg-gray-50">
                <tr>
                  <td colSpan={2} className="px-4 py-3 font-bold text-right">TOTAL</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-700 font-mono">{fmt(entry.totalDebit)}</td>
                  <td className="px-4 py-3 text-right font-bold text-green-700 font-mono">{fmt(entry.totalCredit)}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="px-4 pb-3">
                    <div className={`flex items-center gap-2 justify-center p-2 rounded-lg ${entry.isBalanced ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {entry.isBalanced ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                      <span className="font-semibold">{entry.isBalanced ? '✓ Balanced Entry' : '✗ Unbalanced Entry'}</span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Audit Trail */}
          <div className="border rounded-xl overflow-hidden">
            <button onClick={() => setShowAudit(!showAudit)}
              className="w-full bg-gray-50 px-4 py-3 flex items-center justify-between hover:bg-gray-100">
              <div className="flex items-center gap-2 font-semibold text-gray-800">
                <Shield size={16} /> Audit Trail ({entry.auditLog.length} events)
              </div>
              {showAudit ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showAudit && (
              <div className="divide-y">
                {entry.auditLog.length === 0 && <div className="px-4 py-3 text-sm text-gray-400">No audit events yet.</div>}
                {entry.auditLog.map(ev => (
                  <div key={ev.id} className="px-4 py-3 flex items-start gap-3 text-sm">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-blue-700">{ev.userName.charAt(0)}</span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800">{ev.action}</div>
                      <div className="text-gray-500">{ev.details}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{ev.userName} · {new Date(ev.timestamp).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Attachments */}
          <AttachmentPanel
            module="journal"
            documentId={entry.id}
            title="Supporting Documents"
            allowEmailIn={true}
          />

          {/* Rejection Form */}
          {showReject && (
            <div className="border border-red-200 rounded-xl p-4 bg-red-50 space-y-3">
              <p className="font-semibold text-red-800">Reason for Rejection</p>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm" rows={2}
                placeholder="Explain why this entry is being rejected..." />
              <div className="flex gap-2">
                <button onClick={() => { onAction(`reject:${rejectReason}`); onClose(); }}
                  disabled={!rejectReason}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50">
                  Confirm Rejection
                </button>
                <button onClick={() => setShowReject(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          )}

          {/* Reverse Form */}
          {showReverse && (
            <div className="border border-purple-200 rounded-xl p-4 bg-purple-50 space-y-3">
              <p className="font-semibold text-purple-800">Reason for Reversal</p>
              <textarea value={reverseReason} onChange={e => setReverseReason(e.target.value)}
                className="w-full border border-purple-300 rounded-lg px-3 py-2 text-sm" rows={2}
                placeholder="Explain why this entry is being reversed..." />
              <div className="flex gap-2">
                <button onClick={() => { onAction(`reverse:${reverseReason}`); onClose(); }}
                  disabled={!reverseReason}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm disabled:opacity-50">
                  Create Reversal Entry
                </button>
                <button onClick={() => setShowReverse(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-100">Close</button>
          <div className="flex items-center gap-2">
            {entry.status === 'Pending Approval' && (
              <>
                <button onClick={() => setShowReject(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 border border-red-200 rounded-lg hover:bg-red-200">
                  <XCircle size={16} /> Reject
                </button>
                <button onClick={() => { onAction('approve'); onClose(); }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <CheckCircle size={16} /> Approve
                </button>
                <button onClick={() => { onAction('post'); onClose(); }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                  <Check size={16} /> Approve & Post
                </button>
              </>
            )}
            {entry.status === 'Approved' && (
              <button onClick={() => { onAction('post'); onClose(); }}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <Check size={16} /> Post to General Ledger
              </button>
            )}
            {entry.status === 'Posted' && (
              <button onClick={() => setShowReverse(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-200">
                <RotateCcw size={16} /> Create Reversal
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function JournalEntries() {
  const { entries, approveEntry, rejectEntry, postEntry, reverseEntry, deleteEntry } = useAccountingEngine();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<JournalEntry | null>(null);
  const [toast, setToast] = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function handleAction(entry: JournalEntry, action: string) {
    if (action === 'approve') { approveEntry(entry.id, 'Current User'); showToast('Entry approved!'); }
    else if (action === 'post') { approveEntry(entry.id, 'Current User'); postEntry(entry.id, 'Current User'); showToast('Entry posted to General Ledger!'); }
    else if (action.startsWith('reject:')) { rejectEntry(entry.id, 'Current User', action.slice(7)); showToast('Entry rejected.'); }
    else if (action.startsWith('reverse:')) { reverseEntry(entry.id, 'Current User', action.slice(8)); showToast('Reversal entry created and posted!'); }
    else if (action === 'delete') { if (deleteEntry(entry.id)) showToast('Entry deleted.'); else showToast('Cannot delete posted entries.'); }
  }

  const filtered = useMemo(() => entries.filter(e => {
    const q = search.toLowerCase();
    const matchQ = !q || e.description.toLowerCase().includes(q) || e.entryNumber.toLowerCase().includes(q) || (e.reference || '').toLowerCase().includes(q);
    const matchS = statusFilter === 'All' || e.status === statusFilter;
    const matchF = !dateFrom || e.date >= dateFrom;
    const matchT = !dateTo || e.date <= dateTo;
    return matchQ && matchS && matchF && matchT;
  }).sort((a, b) => b.date.localeCompare(a.date)), [entries, search, statusFilter, dateFrom, dateTo]);

  const stats = {
    total: entries.length,
    draft: entries.filter(e => e.status === 'Draft').length,
    pending: entries.filter(e => e.status === 'Pending Approval').length,
    posted: entries.filter(e => e.status === 'Posted').length,
    totalPosted: entries.filter(e => e.status === 'Posted').reduce((s, e) => s + e.totalDebit, 0),
  };

  return (
    <div className="p-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg">
          <CheckCircle size={18} /> {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <BookOpen size={32} className="text-blue-600" /> Journal Entries
          </h1>
          <p className="text-gray-500 mt-1">Strict double-entry validation · Approval workflow · Auto-posts to General Ledger & Trial Balance</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold shadow">
          <Plus size={18} /> New Entry
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Entries', value: stats.total, color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
          { label: 'Drafts', value: stats.draft, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', icon: FileText },
          { label: 'Pending Approval', value: stats.pending, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: Clock },
          { label: 'Posted', value: stats.posted, color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', icon: CheckCircle },
          { label: 'Posted Amount', value: `AED ${(stats.totalPosted / 1000).toFixed(0)}K`, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
        ].map(({ label, value, color, bg, border }) => (
          <div key={label} className={`${bg} border ${border} rounded-xl p-4`}>
            <div className="text-sm text-gray-500">{label}</div>
            <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Pending Approval Banner */}
      {stats.pending > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle size={20} className="text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-amber-800">{stats.pending} entries awaiting your approval</p>
            <p className="text-sm text-amber-600">Review and approve or reject entries before they can be posted to the General Ledger.</p>
          </div>
          <button onClick={() => setStatusFilter('Pending Approval')}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600">
            Review Now
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search entries, references…"
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-wrap gap-2">
          {['All', 'Draft', 'Pending Approval', 'Approved', 'Posted', 'Rejected', 'Reversed'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
              {s}
            </button>
          ))}
        </div>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
        <span className="text-gray-400">→</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
        <button onClick={() => { setSearch(''); setStatusFilter('All'); setDateFrom(''); setDateTo(''); }}
          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border rounded-lg hover:bg-gray-50">
          Clear
        </button>
        <button className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 border rounded-lg text-sm hover:bg-gray-200 ml-auto">
          <Download size={14} /> Export
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Entry #</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Description</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Reference</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Lines</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Debit</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Credit</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Balanced</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Source</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(entry => {
                const StatusIcon = STATUS_ICONS[entry.status] || FileText;
                return (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-blue-700 font-semibold">{entry.entryNumber}</span>
                      {entry.reversalOf && <div className="text-xs text-purple-600 mt-0.5">↩ Reversal</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{entry.date}</td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <div className="truncate text-gray-800">{entry.description}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{entry.reference || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-100 rounded-full text-xs font-bold text-gray-700">
                        {entry.lines.length}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-blue-700 font-semibold">{fmt(entry.totalDebit)}</td>
                    <td className="px-4 py-3 text-right font-mono text-green-700 font-semibold">{fmt(entry.totalCredit)}</td>
                    <td className="px-4 py-3 text-center">
                      {entry.isBalanced
                        ? <CheckCircle size={18} className="text-green-500 mx-auto" />
                        : <AlertCircle size={18} className="text-red-500 mx-auto" />
                      }
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-semibold ${STATUS_COLORS[entry.status]}`}>
                        <StatusIcon size={10} />
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{entry.source}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setSelected(entry)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="View">
                          <Eye size={15} />
                        </button>
                        {entry.status === 'Pending Approval' && (
                          <>
                            <button onClick={() => { approveEntry(entry.id, 'Current User'); postEntry(entry.id, 'Current User'); showToast('Entry approved and posted!'); }}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="Approve & Post">
                              <Check size={15} />
                            </button>
                            <button onClick={() => setSelected(entry)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Reject">
                              <X size={15} />
                            </button>
                          </>
                        )}
                        {entry.status === 'Draft' && (
                          <button onClick={() => { if (deleteEntry(entry.id)) showToast('Entry deleted.'); }}
                            className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" title="Delete">
                            <Trash2 size={15} />
                          </button>
                        )}
                        {entry.status === 'Posted' && (
                          <button onClick={() => setSelected(entry)}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg" title="Reverse">
                            <RotateCcw size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-12 text-center text-gray-400">
                  <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
                  No entries match your search.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        {filtered.length > 0 && (
          <div className="border-t bg-gray-50 px-4 py-3 flex items-center justify-between text-sm text-gray-600">
            <span>{filtered.length} entries shown</span>
            <div className="flex items-center gap-6">
              <span>Total Debit: <strong className="text-blue-700">AED {fmt(filtered.reduce((s, e) => s + e.totalDebit, 0))}</strong></span>
              <span>Total Credit: <strong className="text-green-700">AED {fmt(filtered.reduce((s, e) => s + e.totalCredit, 0))}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showNew && <NewEntryModal onClose={() => setShowNew(false)} />}
      {selected && (
        <ViewEntryModal
          entry={selected}
          onClose={() => setSelected(null)}
          onAction={(action) => handleAction(selected, action)}
        />
      )}
    </div>
  );
}
