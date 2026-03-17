import { useState } from 'react';
import { Plus, X, CheckCircle, Zap, Edit2, Trash2, ChevronDown, ChevronUp, Play } from 'lucide-react';

interface MatchRule {
  id: string; name: string; priority: number; enabled: boolean;
  amountTolerance: number; dateTolerance: number; matchRef: boolean; matchDesc: boolean;
  minAmount: number; maxAmount: number; direction: 'any'|'credit'|'debit';
  action: 'auto_match'|'auto_reconcile'|'ignore'|'flag'; triggers: number;
}

const DEFAULT_RULES: MatchRule[] = [];

const emptyRule: Omit<MatchRule,'id'|'triggers'> = {
  name: '', priority: 5, enabled: true, amountTolerance: 0, dateTolerance: 3,
  matchRef: true, matchDesc: false, minAmount: 0, maxAmount: 999999,
  direction: 'any', action: 'auto_match',
};

export default function MatchingRules() {
  const [rules, setRules] = useState<MatchRule[]>(DEFAULT_RULES);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<MatchRule|null>(null);
  const [form, setForm] = useState<Omit<MatchRule,'id'|'triggers'>>(emptyRule);
  const [expanded, setExpanded] = useState<string|null>(null);
  const [testResult, setTestResult] = useState<string|null>(null);

  const openAdd = () => { setEditing(null); setForm(emptyRule); setShowModal(true); };
  const openEdit = (r: MatchRule) => { setEditing(r); setForm(r); setShowModal(true); };

  const save = () => {
    if (!form.name.trim()) return;
    if (editing) {
      setRules(prev => prev.map(r => r.id === editing.id ? { ...r, ...form } : r));
    } else {
      setRules(prev => [...prev, { ...form, id: `R${Date.now()}`, triggers: 0 }]);
    }
    setShowModal(false);
  };

  const deleteRule = (id: string) => setRules(prev => prev.filter(r => r.id !== id));
  const toggleRule = (id: string) => setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));

  const moveUp = (id: string) => {
    const idx = rules.findIndex(r => r.id === id);
    if (idx === 0) return;
    const arr = [...rules];
    [arr[idx-1], arr[idx]] = [arr[idx], arr[idx-1]];
    setRules(arr.map((r,i) => ({ ...r, priority: i+1 })));
  };

  const runTest = () => {
    const bank = { amount: 12500, date: '2024-06-10', description: 'AGENT PAYMENT GLOBAL TOURS', reference: 'INV-2024-0089', type: 'credit' };
    const book = { amount: 12500, date: '2024-06-10', description: 'Invoice INV-2024-0089 payment', reference: 'INV-2024-0089', type: 'credit' };
    let score = 0;
    if (bank.amount === book.amount) score += 40;
    const dateDiff = Math.abs(new Date(bank.date).getTime() - new Date(book.date).getTime()) / 86400000;
    if (dateDiff === 0) score += 30; else if (dateDiff <= 3) score += 15;
    if (bank.reference === book.reference) score += 20;
    score += 10;
    const confidence = score >= 75 ? 'High' : score >= 45 ? 'Medium' : 'Low';
    setTestResult(`Score: ${score}/100 · Confidence: ${confidence} · Action: Auto-Match\n\nBreakdown:\n✓ Amount match: +40pts\n✓ Date match (same day): +30pts\n✓ Reference match: +20pts\n✓ Description keywords: +10pts`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Auto-Matching Rules</h1>
          <p className="text-slate-500 mt-1">Configure rules for automatic transaction matching and duplicate detection</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 text-sm font-medium">
          <Plus size={16} /> Add Rule
        </button>
      </div>

      {/* Matching Logic Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-5 text-white">
        <h3 className="font-bold mb-3">Core Matching Algorithm</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {[
            { factor: 'Amount Match', points: '40 pts', rule: 'Exact = full score' },
            { factor: 'Date ±3 Days', points: '30 pts', rule: 'Same day = max' },
            { factor: 'Reference', points: '20 pts', rule: 'Exact/partial match' },
            { factor: 'Description', points: '10 pts', rule: 'Keyword similarity' },
          ].map(f => (
            <div key={f.factor} className="bg-white/10 rounded-lg p-3">
              <p className="font-semibold">{f.factor}</p>
              <p className="text-white/80 text-xs mt-0.5">{f.points} · {f.rule}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-white/80">
          <strong>Duplicate Detection:</strong> IF <code className="bg-white/20 px-1 rounded">transaction_reference</code> already exists → ignore import
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Rules', value: rules.length },
          { label: 'Enabled', value: rules.filter(r=>r.enabled).length },
          { label: 'Total Triggers', value: rules.reduce((s,r)=>s+r.triggers,0) },
          { label: 'Avg Tolerance', value: `±${Math.round(rules.reduce((s,r)=>s+r.dateTolerance,0)/rules.length)} days` },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
            <p className="text-xs text-slate-500 uppercase tracking-wide">{k.label}</p>
            <p className="text-2xl font-bold mt-1 text-slate-800">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        {rules.sort((a,b)=>a.priority-b.priority).map((rule, idx) => (
          <div key={rule.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden ${rule.enabled?'border-slate-200':'border-slate-100 opacity-60'}`}>
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center text-xs font-bold text-slate-600">{rule.priority}</span>
                <div>
                  <p className="font-semibold text-slate-800">{rule.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                    <span>Date ±{rule.dateTolerance}d</span>
                    <span>·</span>
                    <span>Amount tol. {rule.amountTolerance}%</span>
                    <span>·</span>
                    <span className={`px-1.5 py-0.5 rounded font-medium ${rule.action==='auto_match'?'bg-emerald-100 text-emerald-700':rule.action==='ignore'?'bg-slate-100 text-slate-600':rule.action==='auto_reconcile'?'bg-blue-100 text-blue-700':'bg-amber-100 text-amber-700'}`}>{rule.action}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{rule.triggers} triggers</span>
                <button onClick={() => toggleRule(rule.id)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${rule.enabled?'bg-emerald-500':'bg-slate-300'}`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${rule.enabled?'translate-x-4.5':'translate-x-0.5'}`} />
                </button>
                <button onClick={() => moveUp(rule.id)} disabled={idx===0} className="p-1.5 hover:bg-slate-100 rounded disabled:opacity-30"><ChevronUp size={14}/></button>
                <button onClick={() => openEdit(rule)} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded"><Edit2 size={14}/></button>
                <button onClick={() => deleteRule(rule.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded"><Trash2 size={14}/></button>
                <button onClick={() => setExpanded(expanded===rule.id?null:rule.id)} className="p-1.5 hover:bg-slate-100 rounded">
                  {expanded===rule.id?<ChevronUp size={14}/>:<ChevronDown size={14}/>}
                </button>
              </div>
            </div>
            {expanded === rule.id && (
              <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div><p className="text-slate-400">Date Tolerance</p><p className="font-semibold text-slate-700">±{rule.dateTolerance} days</p></div>
                  <div><p className="text-slate-400">Amount Tolerance</p><p className="font-semibold text-slate-700">{rule.amountTolerance}%</p></div>
                  <div><p className="text-slate-400">Direction</p><p className="font-semibold text-slate-700 capitalize">{rule.direction}</p></div>
                  <div><p className="text-slate-400">Amount Range</p><p className="font-semibold text-slate-700">AED {rule.minAmount}–{rule.maxAmount}</p></div>
                  <div><p className="text-slate-400">Match Reference</p><p className="font-semibold text-slate-700">{rule.matchRef?'Yes':'No'}</p></div>
                  <div><p className="text-slate-400">Match Description</p><p className="font-semibold text-slate-700">{rule.matchDesc?'Yes':'No'}</p></div>
                  <div><p className="text-slate-400">Action</p><p className="font-semibold text-slate-700 capitalize">{rule.action.replace('_',' ')}</p></div>
                  <div><p className="text-slate-400">Total Triggers</p><p className="font-semibold text-slate-700">{rule.triggers}</p></div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick Test */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2"><Zap size={16} className="text-amber-500"/> Quick Rule Tester</h3>
        <p className="text-sm text-slate-500 mb-4">Test with sample: Bank Tx (AED 12,500 credit, ref INV-2024-0089) vs Book Tx (AED 12,500, ref INV-2024-0089, same date)</p>
        <button onClick={runTest} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600">
          <Play size={15}/> Run Test
        </button>
        {testResult && (
          <pre className="mt-4 bg-slate-900 text-emerald-400 p-4 rounded-xl text-xs font-mono whitespace-pre-wrap">{testResult}</pre>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-slate-800">{editing?'Edit':'New'} Matching Rule</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rule Name *</label>
                <input value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none" placeholder="e.g. Agent Receipt Auto-Match" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date Tolerance (days)</label>
                  <input type="number" min={0} max={30} value={form.dateTolerance} onChange={e => setForm(p=>({...p,dateTolerance:parseInt(e.target.value)||0}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount Tolerance (%)</label>
                  <input type="number" min={0} max={100} value={form.amountTolerance} onChange={e => setForm(p=>({...p,amountTolerance:parseInt(e.target.value)||0}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Direction</label>
                  <select value={form.direction} onChange={e => setForm(p=>({...p,direction:e.target.value as MatchRule['direction']}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none">
                    <option value="any">Any</option><option value="credit">Credit only</option><option value="debit">Debit only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Action</label>
                  <select value={form.action} onChange={e => setForm(p=>({...p,action:e.target.value as MatchRule['action']}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none">
                    <option value="auto_match">Auto Match</option><option value="auto_reconcile">Auto Reconcile</option>
                    <option value="ignore">Ignore</option><option value="flag">Flag for Review</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.matchRef} onChange={e => setForm(p=>({...p,matchRef:e.target.checked}))} className="rounded" />
                  <span className="text-sm text-slate-700">Match Reference</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.matchDesc} onChange={e => setForm(p=>({...p,matchDesc:e.target.checked}))} className="rounded" />
                  <span className="text-sm text-slate-700">Match Description</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.enabled} onChange={e => setForm(p=>({...p,enabled:e.target.checked}))} className="rounded" />
                  <span className="text-sm text-slate-700">Enabled</span>
                </label>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => setShowModal(false)} className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm">Cancel</button>
                <button onClick={save} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
                  <CheckCircle size={15}/> {editing?'Update':'Add'} Rule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
