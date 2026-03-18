import { useState, useCallback } from 'react';
import {
  RefreshCw, TrendingUp, TrendingDown, CheckCircle,
  ChevronDown, ChevronRight, Download, Eye, RotateCcw, BookOpen,
  Calculator, FileText, Info, ArrowRight, DollarSign, Zap, Clock,
  Check, X
} from 'lucide-react';
import {
  runRevaluation, generateRevalJE, generateReversalJE,
  getSampleOpenDocuments, getRecentPeriods,
  formatAED, formatForeign,
  RevalRun, RevalLine, RevalJournalEntry, OpenDocument,
  REVAL_ACCOUNTS,
} from '../utils/revaluationEngine';
import { useCurrency } from '../context/CurrencyContext';

// Rate map — populated from Supabase via CurrencyContext; no hardcoded demo rates
const DEMO_RATES: Record<string, Record<string, number>> = {};

function StatusBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    Gain: 'bg-green-100 text-green-800 border border-green-200',
    Loss: 'bg-red-100 text-red-800 border border-red-200',
    None: 'bg-gray-100 text-gray-600 border border-gray-200',
    Posted: 'bg-blue-100 text-blue-800 border border-blue-200',
    Draft: 'bg-amber-100 text-amber-800 border border-amber-200',
    Reversed: 'bg-purple-100 text-purple-800 border border-purple-200',
    Calculated: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
    Pending: 'bg-gray-100 text-gray-600',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[type] ?? 'bg-gray-100 text-gray-600'}`}>{type}</span>;
}

function RevalLineRow({ line, expanded, onToggle }: { line: RevalLine; expanded: boolean; onToggle: () => void }) {
  const isGain = line.gainLossType === 'Gain';
  const isLoss = line.gainLossType === 'Loss';
  const hasImpact = line.gainLossType !== 'None';

  return (
    <>
      <tr className={`border-t hover:bg-gray-50 cursor-pointer ${hasImpact ? '' : 'opacity-60'}`} onClick={onToggle}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <div>
              <div className="font-medium text-sm">{line.docNumber}</div>
              <div className="text-xs text-gray-500">{line.docType}</div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-sm">{line.party}</td>
        <td className="px-4 py-3">
          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-mono text-xs">{line.currency}</span>
        </td>
        <td className="px-4 py-3 text-sm text-right font-mono">{formatForeign(line.foreignAmount, line.currency)}</td>
        <td className="px-4 py-3 text-sm text-right font-mono text-gray-600">{line.bookedRate.toFixed(4)}</td>
        <td className="px-4 py-3 text-sm text-right font-mono">{line.newRate.toFixed(4)}</td>
        <td className="px-4 py-3 text-sm text-right font-mono text-gray-600">{formatAED(line.bookedBase)}</td>
        <td className="px-4 py-3 text-sm text-right font-mono">{formatAED(line.newBase)}</td>
        <td className="px-4 py-3 text-right">
          <span className={`font-mono font-bold text-sm ${isGain ? 'text-green-700' : isLoss ? 'text-red-700' : 'text-gray-500'}`}>
            {isGain ? '+' : isLoss ? '−' : ''}{formatAED(Math.abs(line.difference))}
          </span>
        </td>
        <td className="px-4 py-3 text-center"><StatusBadge type={line.gainLossType} /></td>
      </tr>
      {expanded && line.jeLines.length > 0 && (
        <tr>
          <td colSpan={10} className="px-4 py-0 bg-gray-50 border-b border-gray-200">
            <div className="py-3 px-6">
              <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1"><BookOpen size={12} /> Generated Journal Entry Lines</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500">
                    <th className="text-left py-1 w-12">#</th>
                    <th className="text-left py-1">Account</th>
                    <th className="text-left py-1">Description</th>
                    <th className="text-right py-1 w-28">Debit (AED)</th>
                    <th className="text-right py-1 w-28">Credit (AED)</th>
                  </tr>
                </thead>
                <tbody>
                  {line.jeLines.map(jl => (
                    <tr key={jl.lineNo} className={`border-t border-gray-200 ${jl.debit > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                      <td className="py-1.5 font-mono">{jl.lineNo}</td>
                      <td className="py-1.5 font-mono font-semibold">{jl.accountCode} — {jl.accountName}</td>
                      <td className="py-1.5 text-gray-600 truncate max-w-xs">{jl.description}</td>
                      <td className={`py-1.5 text-right font-mono ${jl.debit > 0 ? 'text-red-700 font-bold' : 'text-gray-400'}`}>
                        {jl.debit > 0 ? `AED ${jl.debit.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className={`py-1.5 text-right font-mono ${jl.credit > 0 ? 'text-green-700 font-bold' : 'text-gray-400'}`}>
                        {jl.credit > 0 ? `AED ${jl.credit.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function JEPreviewModal({ je, onClose, onPost }: { je: RevalJournalEntry; onClose: () => void; onPost: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className={`p-5 border-b rounded-t-2xl ${je.isReversal ? 'bg-purple-50' : 'bg-blue-50'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BookOpen size={18} className={je.isReversal ? 'text-purple-600' : 'text-blue-600'} />
                <span className="font-bold text-lg">{je.isReversal ? 'Reversal Journal Entry' : 'Revaluation Journal Entry'}</span>
                <StatusBadge type={je.status} />
                {je.isBalanced ? (
                  <span className="flex items-center gap-1 text-green-700 text-xs font-semibold"><Check size={12} /> Balanced</span>
                ) : (
                  <span className="flex items-center gap-1 text-red-700 text-xs font-semibold"><X size={12} /> Unbalanced</span>
                )}
              </div>
              <p className="text-sm text-gray-600">{je.description}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/60 rounded-lg"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-4 gap-3 mt-3 text-sm">
            <div><span className="text-gray-500">Entry No</span><div className="font-mono font-bold">{je.entryNumber}</div></div>
            <div><span className="text-gray-500">Date</span><div className="font-semibold">{je.date}</div></div>
            <div><span className="text-gray-500">Period</span><div className="font-semibold">{je.period}</div></div>
            <div><span className="text-gray-500">Reference</span><div className="font-mono">{je.reference}</div></div>
          </div>
        </div>

        {/* Lines */}
        <div className="flex-1 overflow-auto p-5">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex gap-2 items-start text-sm text-amber-800">
            <Info size={16} className="mt-0.5 flex-shrink-0" />
            <div>
              {je.isReversal
                ? 'This reversal entry cancels the unrealized FX revaluation. It will be posted at the start of the next accounting period.'
                : 'This entry records unrealized FX gains/losses on open foreign-currency monetary items. It will be reversed at the start of next period.'}
            </div>
          </div>

          <table className="w-full text-sm border rounded-lg overflow-hidden">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">#</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Account</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Description</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Debit (AED)</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Credit (AED)</th>
              </tr>
            </thead>
            <tbody>
              {je.lines.map(line => (
                <tr key={line.lineNo} className="border-t">
                  <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{line.lineNo}</td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono font-semibold text-gray-800">{line.accountCode}</span>
                    <span className="text-gray-600 ml-2 text-xs">{line.accountName}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 max-w-xs truncate">{line.description}</td>
                  <td className={`px-4 py-2.5 text-right font-mono font-bold ${line.debit > 0 ? 'text-red-700' : 'text-gray-300'}`}>
                    {line.debit > 0 ? `${line.debit.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono font-bold ${line.credit > 0 ? 'text-green-700' : 'text-gray-300'}`}>
                    {line.credit > 0 ? `${line.credit.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-300">
              <tr>
                <td colSpan={3} className="px-4 py-2.5 font-bold text-sm text-right">Totals</td>
                <td className="px-4 py-2.5 text-right font-bold text-red-700 font-mono">
                  {je.totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-2.5 text-right font-bold text-green-700 font-mono">
                  {je.totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 rounded-b-2xl flex items-center justify-between">
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <Clock size={12} /> Created {new Date(je.createdAt).toLocaleString()} by {je.createdBy}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-white">Close</button>
            <button
              onClick={onPost}
              disabled={!je.isBalanced}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${je.isBalanced ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
            >
              <BookOpen size={15} /> Post to General Ledger
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CurrencyRevaluation() {
  const { rates, baseCurrency } = useCurrency();
  const periods = getRecentPeriods(12);

  const [selectedPeriod, setSelectedPeriod] = useState(periods[0].value);
  const [activeTab, setActiveTab] = useState<'how'|'run'|'history'|'accounts'>('how');
  const [revalRun, setRevalRun]   = useState<RevalRun | null>(null);
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());
  const [je, setJe]               = useState<RevalJournalEntry | null>(null);
  const [reversalJe, setReversalJe] = useState<RevalJournalEntry | null>(null);
  const [showJeModal, setShowJeModal]   = useState(false);
  const [showRevModal, setShowRevModal] = useState(false);
  const [postedRuns, setPostedRuns]     = useState<string[]>([]);
  const [reversedRuns, setReversedRuns] = useState<string[]>([]);
  const [toast, setToast]               = useState<string | null>(null);
  const [customRates, setCustomRates]   = useState<Record<string, number>>({});
  const [openDocs]                      = useState<OpenDocument[]>(getSampleOpenDocuments());

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4000); };

  // Build rate map: use custom rates if entered, else demo rates for period, else live rates
  const buildRateMap = useCallback(() => {
    const demoMap = DEMO_RATES[selectedPeriod] ?? {};
    const liveMap: Record<string, number> = {};
    rates.forEach((r: { code: string; rate: number }) => { liveMap[r.code] = r.rate; });
    return { ...liveMap, ...demoMap, ...customRates };
  }, [selectedPeriod, rates, customRates]);

  const handleRunRevaluation = () => {
    const rateMap = buildRateMap();
    const period  = periods.find(p => p.value === selectedPeriod)!;
    const run     = runRevaluation(
      `RUN-${Date.now()}`,
      selectedPeriod,
      period.label,
      openDocs,
      rateMap,
      baseCurrency
    );
    setRevalRun(run);
    setJe(null);
    setReversalJe(null);
    setExpandedLines(new Set());
    setActiveTab('run');
    showToast(`✅ Revaluation calculated for ${period.label} — ${run.lines.length} documents processed`);
  };

  const handleGenerateJE = () => {
    if (!revalRun) return;
    const newJe = generateRevalJE(revalRun, `JE-REVAL-${Date.now()}`);
    setJe(newJe);
    setShowJeModal(true);
  };

  const handlePostJE = () => {
    if (!je || !revalRun) return;
    const updated = { ...je, status: 'Posted' as const };
    setJe(updated);
    setPostedRuns(p => [...p, revalRun.id]);
    setRevalRun(r => r ? { ...r, status: 'Posted', journalEntryId: je.id } : r);
    setShowJeModal(false);
    showToast('✅ Revaluation Journal Entry posted to General Ledger');
  };

  const handleGenerateReversal = () => {
    if (!revalRun || !je) return;
    const revDate = new Date();
    revDate.setMonth(revDate.getMonth() + 1);
    revDate.setDate(1);
    const revJe = generateReversalJE(revalRun, je.id, `JE-REV-${Date.now()}`, revDate.toISOString().slice(0, 10));
    setReversalJe(revJe);
    setShowRevModal(true);
  };

  const handlePostReversal = () => {
    if (!reversalJe || !revalRun) return;
    setReversedRuns(r => [...r, revalRun.id]);
    setRevalRun(r => r ? { ...r, status: 'Reversed', reversalEntryId: reversalJe.id } : r);
    setShowRevModal(false);
    showToast('✅ Reversal Entry posted — revaluation cleared for next period');
  };

  const toggleLine = (id: string) => setExpandedLines(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const period = periods.find(p => p.value === selectedPeriod);

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm">
          <CheckCircle size={16} className="text-green-400" />{toast}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <RefreshCw size={28} className="text-purple-600" /> Currency Revaluation
          </h1>
          <p className="text-gray-600 mt-1">Month-end FX revaluation — unrealized gains/losses on open foreign-currency monetary items</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedPeriod}
            onChange={e => { setSelectedPeriod(e.target.value); setRevalRun(null); setJe(null); }}
            className="border rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-purple-300"
          >
            {periods.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <button
            onClick={handleRunRevaluation}
            className="flex items-center gap-2 px-5 py-2 bg-purple-600 text-white rounded-lg font-semibold text-sm hover:bg-purple-700 shadow"
          >
            <Calculator size={16} /> Run Revaluation
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-xs text-gray-500 mb-1">Open Documents</div>
          <div className="text-2xl font-bold text-gray-900">{openDocs.filter(d => d.currency !== baseCurrency).length}</div>
          <div className="text-xs text-gray-400 mt-1">Foreign currency items</div>
        </div>
        <div className={`border rounded-xl p-4 shadow-sm ${revalRun && revalRun.totalGain > 0 ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
          <div className="text-xs text-gray-500 mb-1">Total Unrealized Gain</div>
          <div className="text-2xl font-bold text-green-700">{formatAED(revalRun?.totalGain ?? 0)}</div>
          <div className="text-xs text-gray-400 mt-1">If rates moved favourably</div>
        </div>
        <div className={`border rounded-xl p-4 shadow-sm ${revalRun && revalRun.totalLoss > 0 ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
          <div className="text-xs text-gray-500 mb-1">Total Unrealized Loss</div>
          <div className="text-2xl font-bold text-red-700">{formatAED(revalRun?.totalLoss ?? 0)}</div>
          <div className="text-xs text-gray-400 mt-1">If rates moved unfavourably</div>
        </div>
        <div className={`border rounded-xl p-4 shadow-sm ${
          revalRun ? (revalRun.netGainLoss >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200') : 'bg-white'
        }`}>
          <div className="text-xs text-gray-500 mb-1">Net FX Impact</div>
          <div className={`text-2xl font-bold ${revalRun ? (revalRun.netGainLoss >= 0 ? 'text-green-700' : 'text-red-700') : 'text-gray-900'}`}>
            {revalRun ? (revalRun.netGainLoss >= 0 ? '+' : '−') + formatAED(Math.abs(revalRun.netGainLoss)) : 'AED 0.00'}
          </div>
          <div className="text-xs text-gray-400 mt-1">{revalRun ? `${revalRun.netType} — ${period?.label}` : 'Run revaluation first'}</div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b">
        {[
          { id: 'how',      label: 'How It Works',      icon: <Info size={15} /> },
          { id: 'run',      label: revalRun ? `Results (${revalRun.lines.length})` : 'Results', icon: <Calculator size={15} /> },
          { id: 'accounts', label: 'GL Accounts Used',  icon: <BookOpen size={15} /> },
          { id: 'history',  label: 'Rates Used',        icon: <DollarSign size={15} /> },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as typeof activeTab)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.id ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >{t.icon}{t.label}</button>
        ))}
      </div>

      {/* ── HOW IT WORKS ── */}
      {activeTab === 'how' && (
        <div className="space-y-6">
          {/* Step-by-step example */}
          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Zap size={18} className="text-purple-600" /> Exact Worked Example</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Scenario */}
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">Step 1 — Invoice Recorded</div>
                  <table className="text-sm w-full">
                    <tbody>
                      <tr><td className="text-gray-600 py-0.5 w-40">Invoice Amount</td><td className="font-mono font-bold">USD 1,000</td></tr>
                      <tr><td className="text-gray-600 py-0.5">Booking Rate</td><td className="font-mono">1 USD = AED 3.67</td></tr>
                      <tr><td className="text-gray-600 py-0.5">Base Amount</td><td className="font-mono font-bold text-blue-700">AED 3,670.00</td></tr>
                      <tr><td className="text-gray-600 py-0.5">GL Entry</td><td className="text-xs">Dr AR 3,670 / Cr Revenue 3,670</td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-2 text-gray-400 px-4"><ArrowRight size={16} /><span className="text-sm">Month-end arrives…</span></div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wide">Step 2 — Rate Changes</div>
                  <table className="text-sm w-full">
                    <tbody>
                      <tr><td className="text-gray-600 py-0.5 w-40">New Rate</td><td className="font-mono">1 USD = AED 3.70</td></tr>
                      <tr><td className="text-gray-600 py-0.5">New Base Value</td><td className="font-mono font-bold">USD 1,000 × 3.70 = <span className="text-amber-700">AED 3,700.00</span></td></tr>
                      <tr><td className="text-gray-600 py-0.5">Old Base Value</td><td className="font-mono text-gray-500">AED 3,670.00</td></tr>
                      <tr><td className="text-gray-600 py-0.5">Difference</td><td className="font-mono font-bold text-red-700">AED 30.00 (LOSS)</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right: Journal Entry */}
              <div className="bg-gray-900 rounded-xl p-5 text-sm font-mono">
                <div className="text-gray-400 text-xs mb-3 uppercase tracking-wide">✦ Auto-Generated Journal Entry</div>
                <div className="text-white mb-2 font-semibold">REVAL-2024-01 | {new Date().toLocaleDateString()}</div>
                <div className="text-gray-400 text-xs mb-4">FX Revaluation (Unrealized) — January 2024</div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center bg-red-900/40 rounded px-3 py-2">
                    <div>
                      <span className="text-red-400 text-xs">Dr</span>
                      <span className="text-white ml-2">5997 — Unrealized FX Loss</span>
                    </div>
                    <span className="text-red-300 font-bold">AED 30.00</span>
                  </div>
                  <div className="flex justify-between items-center bg-green-900/30 rounded px-3 py-2">
                    <div>
                      <span className="text-green-400 text-xs">Cr</span>
                      <span className="text-white ml-2">1200 — Accounts Receivable</span>
                    </div>
                    <span className="text-green-300 font-bold">AED 30.00</span>
                  </div>
                  <div className="border-t border-gray-700 mt-3 pt-2 flex justify-between text-xs text-gray-400">
                    <span>Total Dr = Total Cr</span>
                    <span className="text-green-400">✓ Balanced</span>
                  </div>
                </div>
                <div className="mt-4 text-xs text-gray-500 border-t border-gray-700 pt-3">
                  ⟳ This entry is REVERSED at start of next period (unrealized = temporary)
                </div>
              </div>
            </div>
          </div>

          {/* All 4 scenarios */}
          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><FileText size={18} className="text-blue-600" /> All 4 Scenarios</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  title: 'AR — Rate Increases (GAIN)', color: 'green',
                  scenario: 'Invoice USD 1,000 @ 3.67 → new rate 3.70',
                  dr: { code: '1200', name: 'Accounts Receivable', amt: 30 },
                  cr: { code: '4998', name: 'Unrealized FX Gain', amt: 30 },
                  note: 'Receivable is worth MORE — record a gain',
                },
                {
                  title: 'AR — Rate Decreases (LOSS)', color: 'red',
                  scenario: 'Invoice USD 1,000 @ 3.70 → new rate 3.67',
                  dr: { code: '5997', name: 'Unrealized FX Loss', amt: 30 },
                  cr: { code: '1200', name: 'Accounts Receivable', amt: 30 },
                  note: 'Receivable is worth LESS — record a loss',
                },
                {
                  title: 'AP — Rate Increases (LOSS)', color: 'red',
                  scenario: 'Bill USD 800 @ 3.67 → new rate 3.70',
                  dr: { code: '5997', name: 'Unrealized FX Loss', amt: 24 },
                  cr: { code: '2000', name: 'Accounts Payable', amt: 24 },
                  note: 'We OWE more — record a loss',
                },
                {
                  title: 'AP — Rate Decreases (GAIN)', color: 'green',
                  scenario: 'Bill USD 800 @ 3.70 → new rate 3.67',
                  dr: { code: '2000', name: 'Accounts Payable', amt: 24 },
                  cr: { code: '4998', name: 'Unrealized FX Gain', amt: 24 },
                  note: 'We OWE less — record a gain',
                },
              ].map(s => (
                <div key={s.title} className={`border rounded-xl p-4 ${s.color === 'green' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                  <div className={`font-semibold text-sm mb-2 ${s.color === 'green' ? 'text-green-800' : 'text-red-800'}`}>{s.title}</div>
                  <div className="text-xs text-gray-600 mb-3 italic">{s.scenario}</div>
                  <div className="bg-white rounded-lg p-3 font-mono text-xs space-y-1.5 border">
                    <div className="flex justify-between">
                      <span><span className="text-red-600 font-bold">Dr </span>{s.dr.code} {s.dr.name}</span>
                      <span className="font-bold">{s.dr.amt}</span>
                    </div>
                    <div className="flex justify-between">
                      <span><span className="text-green-600 font-bold">Cr </span>{s.cr.code} {s.cr.name}</span>
                      <span className="font-bold">{s.cr.amt}</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 mt-2 flex items-center gap-1"><Info size={11} />{s.note}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Workflow */}
          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-lg mb-4">Month-End Workflow</h3>
            <div className="flex flex-wrap gap-0 items-start">
              {[
                { step: '1', label: 'Select Period', desc: 'Choose the month-end period to revalue', color: 'bg-blue-600' },
                { step: '2', label: 'Update Rates', desc: 'Enter period-end exchange rates', color: 'bg-indigo-600' },
                { step: '3', label: 'Run Revaluation', desc: 'System calculates gain/loss per document', color: 'bg-purple-600' },
                { step: '4', label: 'Review Lines', desc: 'Check per-document JE lines', color: 'bg-violet-600' },
                { step: '5', label: 'Generate JE', desc: 'Auto-create balanced journal entry', color: 'bg-fuchsia-600' },
                { step: '6', label: 'Post to GL', desc: 'Update General Ledger balances', color: 'bg-pink-600' },
                { step: '7', label: 'Next Period', desc: 'Auto-reverse at period start', color: 'bg-rose-600' },
              ].map((s, i, arr) => (
                <div key={s.step} className="flex items-center">
                  <div className="text-center w-28">
                    <div className={`w-10 h-10 ${s.color} rounded-full flex items-center justify-center text-white font-bold mx-auto mb-1`}>{s.step}</div>
                    <div className="text-xs font-semibold text-gray-800">{s.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
                  </div>
                  {i < arr.length - 1 && <ArrowRight size={16} className="text-gray-300 mx-1 mb-6" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── RESULTS ── */}
      {activeTab === 'run' && (
        <div className="space-y-4">
          {!revalRun ? (
            <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
              <Calculator size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No revaluation run yet</p>
              <p className="text-gray-400 text-sm mt-1">Select a period and click "Run Revaluation"</p>
              <button onClick={handleRunRevaluation} className="mt-4 px-6 py-2.5 bg-purple-600 text-white rounded-lg font-semibold text-sm hover:bg-purple-700">
                Run Now for {period?.label}
              </button>
            </div>
          ) : (
            <>
              {/* Summary Banner */}
              <div className={`rounded-xl p-5 border-2 ${revalRun.netType === 'Gain' ? 'bg-green-50 border-green-300' : revalRun.netType === 'Loss' ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-300'}`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {revalRun.netType === 'Gain' ? <TrendingUp size={20} className="text-green-600" /> : revalRun.netType === 'Loss' ? <TrendingDown size={20} className="text-red-600" /> : <RefreshCw size={20} className="text-gray-500" />}
                      <span className="font-bold text-lg">{revalRun.periodName} — Revaluation {revalRun.status}</span>
                      <StatusBadge type={revalRun.status} />
                    </div>
                    <div className="text-sm text-gray-600">
                      {revalRun.lines.filter(l => l.gainLossType !== 'None').length} documents with FX impact ·
                      Gain: <span className="text-green-700 font-semibold">{formatAED(revalRun.totalGain)}</span> ·
                      Loss: <span className="text-red-700 font-semibold">{formatAED(revalRun.totalLoss)}</span> ·
                      Net: <span className={`font-bold ${revalRun.netType === 'Gain' ? 'text-green-700' : 'text-red-700'}`}>
                        {revalRun.netGainLoss >= 0 ? '+' : '−'}{formatAED(Math.abs(revalRun.netGainLoss))}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={handleGenerateJE}
                      disabled={postedRuns.includes(revalRun.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <BookOpen size={15} /> {postedRuns.includes(revalRun.id) ? 'JE Posted' : 'Generate JE'}
                    </button>
                    {postedRuns.includes(revalRun.id) && !reversedRuns.includes(revalRun.id) && (
                      <button
                        onClick={handleGenerateReversal}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700"
                      >
                        <RotateCcw size={15} /> Generate Reversal
                      </button>
                    )}
                    {reversedRuns.includes(revalRun.id) && (
                      <span className="flex items-center gap-1 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm">
                        <CheckCircle size={15} className="text-green-500" /> Reversed
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Lines Table */}
              <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
                  <h3 className="font-semibold text-sm flex items-center gap-2"><FileText size={15} /> Per-Document Revaluation Lines</h3>
                  <button className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium">
                    <Download size={13} /> Export CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-max">
                    <thead className="bg-gray-50 text-xs text-gray-600">
                      <tr>
                        <th className="px-4 py-2.5 text-left">Document</th>
                        <th className="px-4 py-2.5 text-left">Party</th>
                        <th className="px-4 py-2.5 text-left">Currency</th>
                        <th className="px-4 py-2.5 text-right">Foreign Amt</th>
                        <th className="px-4 py-2.5 text-right">Booked Rate</th>
                        <th className="px-4 py-2.5 text-right">New Rate</th>
                        <th className="px-4 py-2.5 text-right">Booked (AED)</th>
                        <th className="px-4 py-2.5 text-right">New (AED)</th>
                        <th className="px-4 py-2.5 text-right">Difference</th>
                        <th className="px-4 py-2.5 text-center">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revalRun.lines.map(line => (
                        <RevalLineRow
                          key={line.docId}
                          line={line}
                          expanded={expandedLines.has(line.docId)}
                          onToggle={() => toggleLine(line.docId)}
                        />
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 border-gray-300 font-semibold">
                      <tr>
                        <td colSpan={8} className="px-4 py-2.5 text-right text-sm">Net FX Impact</td>
                        <td className={`px-4 py-2.5 text-right font-bold font-mono ${revalRun.netGainLoss >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {revalRun.netGainLoss >= 0 ? '+' : '−'}{formatAED(Math.abs(revalRun.netGainLoss))}
                        </td>
                        <td className="px-4 py-2.5 text-center"><StatusBadge type={revalRun.netType} /></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Expand all hint */}
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <Info size={12} /> Click any row to expand and view the per-document journal entry lines (Dr/Cr)
              </div>
            </>
          )}
        </div>
      )}

      {/* ── GL ACCOUNTS ── */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><BookOpen size={18} className="text-blue-600" /> GL Accounts Used in Revaluation</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Account Code</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Account Name</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Type</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Normal Balance</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Used When</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    { code: REVAL_ACCOUNTS.FX_GAIN_UNREALIZED.code, name: REVAL_ACCOUNTS.FX_GAIN_UNREALIZED.name, type: 'Revenue', nb: 'Credit', when: 'Unrealized FX Gain (month-end revaluation) — reversed next period' },
                    { code: REVAL_ACCOUNTS.FX_LOSS_UNREALIZED.code, name: REVAL_ACCOUNTS.FX_LOSS_UNREALIZED.name, type: 'Expense', nb: 'Debit', when: 'Unrealized FX Loss (month-end revaluation) — reversed next period' },
                    { code: REVAL_ACCOUNTS.FX_GAIN_REALIZED.code, name: REVAL_ACCOUNTS.FX_GAIN_REALIZED.name, type: 'Revenue', nb: 'Credit', when: 'Realized FX Gain on settlement (payment vs invoice rate)' },
                    { code: REVAL_ACCOUNTS.FX_LOSS_REALIZED.code, name: REVAL_ACCOUNTS.FX_LOSS_REALIZED.name, type: 'Expense', nb: 'Debit', when: 'Realized FX Loss on settlement (payment vs invoice rate)' },
                    { code: REVAL_ACCOUNTS.AR.code, name: REVAL_ACCOUNTS.AR.name, type: 'Asset', nb: 'Debit', when: 'Customer invoices in foreign currency' },
                    { code: REVAL_ACCOUNTS.AP.code, name: REVAL_ACCOUNTS.AP.name, type: 'Liability', nb: 'Credit', when: 'Supplier bills in foreign currency' },
                  ].map(a => (
                    <tr key={a.code} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-bold text-purple-700">{a.code}</td>
                      <td className="px-4 py-3 font-medium">{a.name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          a.type === 'Revenue' ? 'bg-green-100 text-green-700' :
                          a.type === 'Expense' ? 'bg-red-100 text-red-700' :
                          a.type === 'Asset' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>{a.type}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{a.nb}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{a.when}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* DDL */}
          <div className="bg-gray-900 rounded-xl p-5 font-mono text-sm">
            <div className="text-gray-400 text-xs mb-3 uppercase tracking-wide">SQL — Revaluation Tables</div>
            <pre className="text-green-300 text-xs whitespace-pre overflow-x-auto">{`-- Revaluation Runs
CREATE TABLE reval_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period          CHAR(7)       NOT NULL,   -- e.g. '2024-01'
  period_name     VARCHAR(50)   NOT NULL,
  run_date        DATE          NOT NULL,
  base_currency   CHAR(3)       NOT NULL DEFAULT 'AED',
  status          VARCHAR(20)   NOT NULL DEFAULT 'Calculated',
  total_gain      DECIMAL(18,4) NOT NULL DEFAULT 0,
  total_loss      DECIMAL(18,4) NOT NULL DEFAULT 0,
  net_gain_loss   DECIMAL(18,4) NOT NULL DEFAULT 0,
  net_type        VARCHAR(10),             -- 'Gain' | 'Loss' | 'None'
  journal_entry_id UUID REFERENCES journal_entries(id),
  reversal_entry_id UUID REFERENCES journal_entries(id),
  posted_by       UUID REFERENCES users(id),
  posted_at       TIMESTAMPTZ,
  reversed_by     UUID REFERENCES users(id),
  reversed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Per-document revaluation lines
CREATE TABLE reval_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID NOT NULL REFERENCES reval_runs(id) ON DELETE CASCADE,
  doc_id          VARCHAR(100)  NOT NULL,
  doc_number      VARCHAR(100)  NOT NULL,
  doc_type        VARCHAR(50)   NOT NULL,
  party           VARCHAR(200)  NOT NULL,
  currency        CHAR(3)       NOT NULL,
  foreign_amount  DECIMAL(18,4) NOT NULL,
  booked_rate     DECIMAL(18,6) NOT NULL,
  booked_base     DECIMAL(18,4) NOT NULL,
  new_rate        DECIMAL(18,6) NOT NULL,
  new_base        DECIMAL(18,4) NOT NULL,
  difference      DECIMAL(18,4) NOT NULL,
  gain_loss_type  VARCHAR(10)   NOT NULL,   -- 'Gain' | 'Loss' | 'None'
  gl_account      VARCHAR(20)   NOT NULL,
  gl_account_name VARCHAR(100)  NOT NULL
);

-- Journal entries extended for FX source
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS
  source VARCHAR(30) DEFAULT 'Manual';     -- 'FXRevaluation' | 'Manual' | ...
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS
  reval_run_id UUID REFERENCES reval_runs(id);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS
  is_reversal BOOLEAN DEFAULT FALSE;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS
  reversal_of UUID REFERENCES journal_entries(id);`}</pre>
          </div>
        </div>
      )}

      {/* ── RATES USED ── */}
      {activeTab === 'history' && (
        <div className="bg-white border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2"><DollarSign size={18} className="text-green-600" /> Exchange Rates for {period?.label}</h3>
            <div className="text-xs text-gray-500 flex items-center gap-1"><Info size={12} /> Override rates for this revaluation run</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {openDocs
              .filter(d => d.currency !== baseCurrency)
              .map(d => d.currency)
              .filter((c, i, arr) => arr.indexOf(c) === i)
              .map(curr => {
                const demo   = DEMO_RATES[selectedPeriod]?.[curr];
                const live   = rates.find((r: { code: string }) => r.code === curr)?.rate;
                const custom = customRates[curr];
                const active = custom ?? demo ?? live ?? 0;
                return (
                  <div key={curr} className="border rounded-xl p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono font-bold text-lg text-blue-700">{curr} / {baseCurrency}</span>
                      <span className="text-xs text-gray-500">Period-end rate</span>
                    </div>
                    <div className="space-y-1.5 text-xs text-gray-600 mb-3">
                      <div className="flex justify-between"><span>Demo rate:</span><span className="font-mono">{demo ?? '—'}</span></div>
                      <div className="flex justify-between"><span>Live rate:</span><span className="font-mono">{live?.toFixed(4) ?? '—'}</span></div>
                      <div className="flex justify-between font-semibold text-gray-800"><span>Active rate:</span><span className="font-mono text-purple-700">{active.toFixed(4)}</span></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.0001"
                        placeholder="Override rate..."
                        value={customRates[curr] ?? ''}
                        onChange={e => {
                          const val = parseFloat(e.target.value);
                          setCustomRates(prev => ({ ...prev, [curr]: isNaN(val) ? 0 : val }));
                        }}
                        className="flex-1 border rounded px-2 py-1.5 text-xs font-mono focus:ring-1 focus:ring-purple-300"
                      />
                      {customRates[curr] && (
                        <button onClick={() => setCustomRates(p => { const n = { ...p }; delete n[curr]; return n; })} className="p-1.5 text-gray-400 hover:text-red-500"><X size={13} /></button>
                      )}
                    </div>
                    <div className="mt-2">
                      <div className="text-xs text-gray-500 flex justify-between">
                        <span>Diff from demo:</span>
                        <span className={`font-mono ${custom && demo ? (custom > demo ? 'text-green-600' : 'text-red-600') : 'text-gray-400'}`}>
                          {custom && demo ? `${custom > demo ? '+' : ''}${(custom - demo).toFixed(4)}` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleRunRevaluation}
              className="flex items-center gap-2 px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700"
            >
              <RefreshCw size={15} /> Re-run with Updated Rates
            </button>
            <button
              onClick={() => setCustomRates({})}
              className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
            >
              Clear Overrides
            </button>
          </div>
        </div>
      )}

      {/* ── JE Preview Modal ── */}
      {showJeModal && je && (
        <JEPreviewModal je={je} onClose={() => setShowJeModal(false)} onPost={handlePostJE} />
      )}

      {/* ── Reversal Modal ── */}
      {showRevModal && reversalJe && (
        <JEPreviewModal je={reversalJe} onClose={() => setShowRevModal(false)} onPost={handlePostReversal} />
      )}

      {/* ── Open Documents Info ── */}
      <div className="bg-white border rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2"><Eye size={16} className="text-gray-500" /> Open Foreign-Currency Monetary Items</h3>
          <span className="text-xs text-gray-400">{openDocs.filter(d => d.currency !== baseCurrency).length} items</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-600">
              <tr>
                <th className="px-4 py-2.5 text-left">Document</th>
                <th className="px-4 py-2.5 text-left">Type</th>
                <th className="px-4 py-2.5 text-left">Party</th>
                <th className="px-4 py-2.5 text-left">Currency</th>
                <th className="px-4 py-2.5 text-right">Foreign Amount</th>
                <th className="px-4 py-2.5 text-right">Booked Rate</th>
                <th className="px-4 py-2.5 text-right">Booked Base (AED)</th>
                <th className="px-4 py-2.5 text-left">Doc Date</th>
                <th className="px-4 py-2.5 text-left">GL Account</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {openDocs.filter(d => d.currency !== baseCurrency).map(doc => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono font-semibold text-blue-700">{doc.docNumber}</td>
                  <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${doc.docType === 'Invoice' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{doc.docType}</span></td>
                  <td className="px-4 py-2.5">{doc.party}</td>
                  <td className="px-4 py-2.5"><span className="font-mono bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-xs">{doc.currency}</span></td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatForeign(doc.foreignAmount, doc.currency)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{doc.bookedRate.toFixed(4)}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatAED(doc.bookedBase)}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">{doc.docDate}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{doc.glAccount} — {doc.glAccountName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
