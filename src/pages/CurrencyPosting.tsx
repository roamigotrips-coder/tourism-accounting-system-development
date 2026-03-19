import { useState, useEffect } from 'react';
import { ArrowRight, DollarSign, FileText, BookOpen, Check, AlertTriangle, Play, Eye, TrendingUp, Lock } from 'lucide-react';
import { fetchCurrencyPostingDocs, upsertCurrencyPostingDoc, type CurrencyPostingDoc } from '../lib/supabaseSync';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';
import { catchAndReport } from '../lib/toast';

const PIPELINE_STEPS = [
  { step: 1, label: 'Document', desc: 'Foreign currency amount', icon: FileText, color: 'bg-blue-500' },
  { step: 2, label: 'Exchange Rate', desc: 'Lock rate at posting', icon: Lock, color: 'bg-purple-500' },
  { step: 3, label: 'Base Amount', desc: 'Convert to AED', icon: DollarSign, color: 'bg-amber-500' },
  { step: 4, label: 'General Ledger', desc: 'Post Dr/Cr entries', icon: BookOpen, color: 'bg-emerald-500' },
];

export default function CurrencyPosting() {
  const [documents, setDocuments] = useState<CurrencyPostingDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'pipeline' | 'documents' | 'rates' | 'gl'>('pipeline');
  const [selectedDoc, setSelectedDoc] = useState<CurrencyPostingDoc | null>(null);
  const [runningPipeline, setRunningPipeline] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchCurrencyPostingDocs();
        if (!cancelled && data) setDocuments(data);
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const posted = documents.filter(d => d.status === 'posted');
  const pending = documents.filter(d => d.status === 'pending');

  const runPipeline = (doc: CurrencyPostingDoc) => {
    setRunningPipeline(true);
    setPipelineStep(1);
    const advance = (step: number) => {
      setTimeout(() => {
        setPipelineStep(step);
        if (step < 4) {
          advance(step + 1);
        } else {
          setTimeout(() => {
            const updatedDoc = { ...doc, status: 'posted' as const };
            setDocuments(prev => prev.map(d => d.id === doc.id ? updatedDoc : d));
            upsertCurrencyPostingDoc(updatedDoc).catch(catchAndReport('Save currency posting'));
            setRunningPipeline(false);
            setPipelineStep(0);
          }, 800);
        }
      }, 700);
    };
    advance(2);
  };

  const typeColors: Record<string, string> = {
    invoice: 'bg-blue-100 text-blue-700',
    expense: 'bg-red-100 text-red-700',
    payment: 'bg-emerald-100 text-emerald-700',
    journal: 'bg-purple-100 text-purple-700',
  };

  const tabs = [
    { id: 'pipeline' as const, label: 'Pipeline', icon: Play },
    { id: 'documents' as const, label: 'Documents', icon: FileText },
    { id: 'rates' as const, label: 'Locked Rates', icon: Lock },
    { id: 'gl' as const, label: 'GL Impact', icon: BookOpen },
  ];

  if (loading) return <LoadingSpinner message="Loading currency posting documents..." />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Currency Posting Pipeline</h1>
          <p className="text-slate-500 mt-1">Document Currency → Exchange Rate → Base Currency → General Ledger</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Documents', value: documents.length, color: 'bg-blue-50 text-blue-700' },
          { label: 'Posted', value: posted.length, color: 'bg-emerald-50 text-emerald-700' },
          { label: 'Pending', value: pending.length, color: 'bg-amber-50 text-amber-700' },
          { label: 'Total Base (AED)', value: `AED ${posted.reduce((s, d) => s + d.baseAmount, 0).toLocaleString()}`, color: 'bg-purple-50 text-purple-700' },
        ].map((k, i) => (
          <div key={i} className={`${k.color} rounded-xl p-5`}>
            <p className="text-sm font-medium mb-1">{k.label}</p>
            <p className="text-2xl font-bold">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* Pipeline Tab */}
      {tab === 'pipeline' && (
        <div className="space-y-6">
          {/* Visual Pipeline */}
          <div className="bg-white rounded-xl border p-8">
            <h3 className="font-semibold text-slate-800 mb-6">Core Currency Model</h3>
            <div className="flex items-center justify-between max-w-4xl mx-auto">
              {PIPELINE_STEPS.map((s, i) => (
                <div key={s.step} className="flex items-center">
                  <div className={`flex flex-col items-center ${runningPipeline && pipelineStep >= s.step ? 'opacity-100' : runningPipeline ? 'opacity-30' : 'opacity-100'} transition-opacity`}>
                    <div className={`w-16 h-16 rounded-2xl ${runningPipeline && pipelineStep === s.step ? s.color + ' animate-pulse' : runningPipeline && pipelineStep > s.step ? 'bg-emerald-500' : s.color} text-white flex items-center justify-center`}>
                      {runningPipeline && pipelineStep > s.step ? <Check size={24} /> : <s.icon size={24} />}
                    </div>
                    <p className="text-sm font-semibold text-slate-800 mt-3">{s.label}</p>
                    <p className="text-xs text-slate-500 mt-1">{s.desc}</p>
                  </div>
                  {i < PIPELINE_STEPS.length - 1 && (
                    <ArrowRight size={24} className={`mx-4 mt-[-24px] ${runningPipeline && pipelineStep > s.step ? 'text-emerald-500' : 'text-slate-300'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Example */}
          <div className="bg-gradient-to-r from-blue-50 to-emerald-50 rounded-xl border p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Example: Invoice USD 1,000</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-4 border">
                <p className="text-xs text-slate-500 mb-1">1. Document</p>
                <p className="text-lg font-bold text-blue-700">USD 1,000</p>
                <p className="text-xs text-slate-500">Invoice amount</p>
              </div>
              <div className="bg-white rounded-lg p-4 border">
                <p className="text-xs text-slate-500 mb-1">2. Rate</p>
                <p className="text-lg font-bold text-purple-700">× 3.6700</p>
                <p className="text-xs text-slate-500">Locked at posting</p>
              </div>
              <div className="bg-white rounded-lg p-4 border">
                <p className="text-xs text-slate-500 mb-1">3. Base Amount</p>
                <p className="text-lg font-bold text-amber-700">AED 3,670</p>
                <p className="text-xs text-slate-500">Converted to AED</p>
              </div>
              <div className="bg-white rounded-lg p-4 border">
                <p className="text-xs text-slate-500 mb-1">4. GL Entry</p>
                <div className="text-xs space-y-1">
                  <p className="text-red-600 font-mono">Dr AR 1200 — 3,670</p>
                  <p className="text-emerald-600 font-mono">Cr Sales 4000 — 3,670</p>
                </div>
              </div>
            </div>
          </div>

          {/* Pending Documents */}
          {pending.length > 0 && (
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                Pending — Ready to Post ({pending.length})
              </h3>
              <div className="space-y-3">
                {pending.map(d => (
                  <div key={d.id} className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-center gap-4">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${typeColors[d.type]}`}>{d.type}</span>
                      <span className="font-mono text-sm font-semibold">{d.reference}</span>
                      <span className="text-sm text-slate-600">{d.party}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-semibold">{d.foreignCurrency} {d.foreignAmount.toLocaleString()}</p>
                        <p className="text-xs text-slate-500">= AED {d.baseAmount.toLocaleString()}</p>
                      </div>
                      <button onClick={() => runPipeline(d)} disabled={runningPipeline} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                        <Play size={14} /> Post
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Documents Tab */}
      {tab === 'documents' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">ID</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Reference</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Party</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Foreign</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Rate</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Base (AED)</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map(d => (
                <tr key={d.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{d.id}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${typeColors[d.type]}`}>{d.type}</span></td>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-800">{d.reference}</td>
                  <td className="px-4 py-3 text-slate-700">{d.party}</td>
                  <td className="px-4 py-3 text-right font-mono">{d.foreignCurrency} {d.foreignAmount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center font-mono text-slate-500">×{d.exchangeRate}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">AED {d.baseAmount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${d.status === 'posted' ? 'bg-emerald-100 text-emerald-700' : d.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setSelectedDoc(d)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"><Eye size={14} /></button>
                      {d.status === 'pending' && (
                        <button onClick={() => runPipeline(d)} className="p-1.5 hover:bg-emerald-50 rounded text-slate-400 hover:text-emerald-600"><Play size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Locked Rates Tab */}
      {tab === 'rates' && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Lock size={16} /> Rate Registry — Locked at Posting</h3>
          <p className="text-sm text-slate-500 mb-4">Once a rate is locked on a document, it cannot be changed. This ensures audit integrity.</p>
          <div className="space-y-3">
            {posted.map(d => (
              <div key={d.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
                <div className="flex items-center gap-4">
                  <Lock size={14} className="text-slate-400" />
                  <span className="font-mono text-sm font-semibold">{d.reference}</span>
                  <span className="text-xs text-slate-500">{d.postingDate}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-sm">1 {d.foreignCurrency} = <strong>{d.exchangeRate} AED</strong></span>
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Locked</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GL Impact Tab */}
      {tab === 'gl' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="p-4 border-b bg-slate-50">
            <h3 className="font-semibold text-slate-800">General Ledger Impact from Currency Postings</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Source</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Account</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Code</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Foreign</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Rate</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Debit (AED)</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Credit (AED)</th>
              </tr>
            </thead>
            <tbody>
              {posted.flatMap(d => d.lines.map((l, i) => (
                <tr key={`${d.id}-${i}`} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{d.reference}</td>
                  <td className="px-4 py-3 text-slate-700">{l.account}</td>
                  <td className="px-4 py-3 font-mono text-slate-500">{l.accountCode}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-400">{d.foreignCurrency} {d.foreignAmount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center font-mono text-slate-400">×{d.exchangeRate}</td>
                  <td className="px-4 py-3 text-right font-mono">{l.debitBase > 0 ? <span className="text-red-600">{l.debitBase.toLocaleString()}</span> : '—'}</td>
                  <td className="px-4 py-3 text-right font-mono">{l.creditBase > 0 ? <span className="text-emerald-600">{l.creditBase.toLocaleString()}</span> : '—'}</td>
                </tr>
              )))}
              <tr className="bg-slate-100 font-semibold">
                <td colSpan={5} className="px-4 py-3 text-right">Totals</td>
                <td className="px-4 py-3 text-right font-mono text-red-700">
                  {posted.reduce((s, d) => s + d.lines.reduce((ls, l) => ls + l.debitBase, 0), 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono text-emerald-700">
                  {posted.reduce((s, d) => s + d.lines.reduce((ls, l) => ls + l.creditBase, 0), 0).toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* View Document Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-600" />
                {selectedDoc.reference}
              </h2>
              <button onClick={() => setSelectedDoc(null)} className="p-2 hover:bg-slate-100 rounded-lg">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500">Foreign Amount</p>
                <p className="text-xl font-bold text-blue-700">{selectedDoc.foreignCurrency} {selectedDoc.foreignAmount.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500">Base Amount (AED)</p>
                <p className="text-xl font-bold text-emerald-700">AED {selectedDoc.baseAmount.toLocaleString()}</p>
              </div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg mb-6">
              <p className="text-sm text-purple-700">Exchange Rate: <strong>1 {selectedDoc.foreignCurrency} = {selectedDoc.exchangeRate} AED</strong></p>
              <p className="text-xs text-purple-600 mt-1">{selectedDoc.foreignCurrency} {selectedDoc.foreignAmount} × {selectedDoc.exchangeRate} = AED {selectedDoc.baseAmount.toLocaleString()}</p>
            </div>
            <h3 className="font-semibold text-slate-800 mb-3">Journal Entry Lines</h3>
            <div className="bg-slate-900 rounded-lg p-4 text-sm font-mono">
              {selectedDoc.lines.map((l, i) => (
                <div key={i} className="flex justify-between py-1">
                  <span className={l.debitBase > 0 ? 'text-red-400' : 'text-emerald-400'}>
                    {l.debitBase > 0 ? 'Dr' : 'Cr'}  {l.account} ({l.accountCode})
                  </span>
                  <span className="text-white">
                    AED {(l.debitBase || l.creditBase).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
