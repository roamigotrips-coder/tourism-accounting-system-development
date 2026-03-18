import { useState, useMemo } from 'react';
import {
  Plus, Trash2, GripVertical, X, Download, Save,
  ChevronDown, ChevronRight, BarChart2, Calculator,
} from 'lucide-react';
import { useAccountingEngine } from '../context/AccountingEngine';
import { useCurrency } from '../context/CurrencyContext';

// ── Types ──────────────────────────────────────────────────────────────────────
type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';

interface GLAccount { id: string; code: string; name: string; type: AccountType; balance: number }

interface ReportSection {
  id: string;
  name: string;
  kind: 'group' | 'formula';
  accountIds: string[];
  signMultiplier: 1 | -1;
  formulaTerms: Array<{ sectionId: string; sign: 1 | -1 }>;
  isTotal: boolean;
  collapsed: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const S_REV   = 'sec-rev';
const S_COGS  = 'sec-cogs';
const S_GROSS = 'sec-gross';
const S_OPEX  = 'sec-opex';
const S_EBIT  = 'sec-ebitda';

const TYPE_COLOR: Record<AccountType, string> = {
  Revenue: '#10b981', Expense: '#f59e0b',
  Asset: '#3b82f6', Liability: '#ef4444', Equity: '#8b5cf6',
};

function mkId() { return Math.random().toString(36).slice(2, 8); }
function fmt(n: number, sym: string) {
  const s = Math.abs(n).toLocaleString('en-AE', { maximumFractionDigits: 0 });
  return n < 0 ? `(${sym}${s})` : `${sym}${s}`;
}

const DEFAULT: ReportSection[] = [
  { id: S_REV,   name: 'Revenue',             kind: 'group',   accountIds: ['A010','A011'], signMultiplier: -1, formulaTerms: [], isTotal: false, collapsed: false },
  { id: S_COGS,  name: 'Cost of Sales',        kind: 'group',   accountIds: ['A015'],       signMultiplier:  1, formulaTerms: [], isTotal: false, collapsed: false },
  { id: S_GROSS, name: 'Gross Profit',         kind: 'formula', accountIds: [],             signMultiplier:  1, formulaTerms: [{ sectionId: S_REV, sign: 1 }, { sectionId: S_COGS, sign: -1 }], isTotal: true,  collapsed: false },
  { id: S_OPEX,  name: 'Operating Expenses',   kind: 'group',   accountIds: ['A012','A013','A014'], signMultiplier: 1, formulaTerms: [], isTotal: false, collapsed: false },
  { id: S_EBIT,  name: 'EBITDA',               kind: 'formula', accountIds: [],             signMultiplier:  1, formulaTerms: [{ sectionId: S_GROSS, sign: 1 }, { sectionId: S_OPEX, sign: -1 }], isTotal: true,  collapsed: false },
];

// ── Component ──────────────────────────────────────────────────────────────────
export default function FinancialReportBuilder() {
  const { baseCurrency, currencies, convert } = useCurrency();
  const { accounts: rawAccounts } = useAccountingEngine();

  const allAccounts: GLAccount[] = useMemo(() =>
    rawAccounts.map((a: { id: string; code: string; name: string; type: string; openingBalance: number }) => ({
      id: a.id, code: a.code, name: a.name,
      type: a.type as AccountType, balance: a.openingBalance,
    })), [rawAccounts]);

  const accountMap = useMemo(() =>
    Object.fromEntries(allAccounts.map(a => [a.id, a])), [allAccounts]);

  const [sections, setSections]   = useState<ReportSection[]>(DEFAULT);
  const [title, setTitle]         = useState('Income Statement');
  const [dateFrom, setDateFrom]   = useState('2024-01-01');
  const [dateTo, setDateTo]       = useState('2024-03-31');
  const [currency, setCurrency]   = useState('AED');
  const [search, setSearch]       = useState('');
  const [typeFilter, setTypeFilter] = useState<AccountType | 'All'>('All');
  const [dragId, setDragId]       = useState<string | null>(null);   // account id
  const [secDragId, setSecDragId] = useState<string | null>(null);   // section id
  const [dropOver, setDropOver]   = useState<string | null>(null);
  const [saved, setSaved]         = useState(false);

  const sym = useMemo(() =>
    currencies.find(c => c.code === currency)?.symbol ?? (currency + ' '), [currencies, currency]);

  // ── Computed totals ────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const s of sections) {
      if (s.kind === 'group') {
        t[s.id] = s.accountIds.reduce((sum, id) => {
          const acc = accountMap[id];
          return acc ? sum + convert(acc.balance, baseCurrency, currency) * s.signMultiplier : sum;
        }, 0);
      }
    }
    for (const s of sections) {
      if (s.kind === 'formula') {
        t[s.id] = s.formulaTerms.reduce((sum, term) => sum + (t[term.sectionId] ?? 0) * term.sign, 0);
      }
    }
    return t;
  }, [sections, accountMap, baseCurrency, currency, convert]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const update = (id: string, patch: Partial<ReportSection>) =>
    setSections(ss => ss.map(s => s.id === id ? { ...s, ...patch } : s));

  const removeAccount = (sectionId: string, accountId: string) =>
    update(sectionId, { accountIds: sections.find(s => s.id === sectionId)!.accountIds.filter(a => a !== accountId) });

  const deleteSection = (id: string) =>
    setSections(ss => ss.filter(s => s.id !== id));

  const addGroup = () => {
    const id = mkId();
    setSections(ss => [...ss, { id, name: 'New Section', kind: 'group', accountIds: [], signMultiplier: 1, formulaTerms: [], isTotal: false, collapsed: false }]);
  };

  const addFormula = () => {
    const id = mkId();
    const groups = sections.filter(s => s.kind === 'group');
    setSections(ss => [...ss, {
      id, name: 'Subtotal', kind: 'formula', accountIds: [], signMultiplier: 1, isTotal: true, collapsed: false,
      formulaTerms: groups.slice(0, 2).map((s, i) => ({ sectionId: s.id, sign: i === 0 ? 1 : -1 } as { sectionId: string; sign: 1 | -1 })),
    }]);
  };

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  // ── Drag & Drop ────────────────────────────────────────────────────────────
  const onAccountDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = 'copy';
    setDragId(id);
  };

  const onSecDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = 'move';
    setSecDragId(id);
  };

  const onDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDropOver(null);
    if (dragId) {
      setSections(ss => ss.map(s =>
        s.id === targetId && s.kind === 'group' && !s.accountIds.includes(dragId)
          ? { ...s, accountIds: [...s.accountIds, dragId] }
          : s
      ));
      setDragId(null);
    } else if (secDragId && secDragId !== targetId) {
      setSections(ss => {
        const arr = [...ss];
        const fi = arr.findIndex(s => s.id === secDragId);
        const ti = arr.findIndex(s => s.id === targetId);
        const [moved] = arr.splice(fi, 1);
        arr.splice(ti, 0, moved);
        return arr;
      });
      setSecDragId(null);
    }
  };

  // ── Accounts list (left panel) ─────────────────────────────────────────────
  const filteredAccounts = useMemo(() => allAccounts.filter(a =>
    (typeFilter === 'All' || a.type === typeFilter) &&
    (search === '' || a.name.toLowerCase().includes(search.toLowerCase()) || a.code.includes(search))
  ), [allAccounts, typeFilter, search]);

  const groupedByType = useMemo(() => {
    const g: Partial<Record<AccountType, GLAccount[]>> = {};
    for (const a of filteredAccounts) { (g[a.type] ??= []).push(a); }
    return g;
  }, [filteredAccounts]);

  const enabledCurrencies = currencies.filter(c => c.enabled);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3" style={{ minHeight: '80vh' }}>

      {/* ── Top bar ── */}
      <div
        className="flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-xl"
        style={{ background: 'white', border: '1px solid #e2e8f0' }}
      >
        <BarChart2 size={16} className="text-emerald-500 shrink-0" />
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="text-sm font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 focus:outline-none px-1 w-44"
        />
        <div className="h-4 w-px bg-slate-200 mx-1" />
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="text-xs border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:border-emerald-500" />
        <span className="text-xs text-slate-400">→</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="text-xs border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:border-emerald-500" />
        <div className="h-4 w-px bg-slate-200 mx-1" />
        <select value={currency} onChange={e => setCurrency(e.target.value)}
          className="text-xs border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:border-emerald-500">
          {enabledCurrencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setSections(DEFAULT)}
            className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors">
            Reset
          </button>
          <button onClick={save}
            className="flex items-center gap-1.5 text-xs font-medium text-white px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: saved ? '#059669' : '#10b981' }}>
            <Save size={12} />{saved ? 'Saved!' : 'Save'}
          </button>
          <button className="flex items-center gap-1.5 text-xs font-medium text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
            <Download size={12} /> Export
          </button>
        </div>
      </div>

      {/* ── Two-panel layout ── */}
      <div className="flex gap-3 flex-1">

        {/* LEFT: Accounts */}
        <div
          className="flex flex-col rounded-xl overflow-hidden shrink-0"
          style={{ width: 220, border: '1px solid #e2e8f0', background: 'white' }}
        >
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Accounts</p>
          </div>

          {/* Search + type filter */}
          <div className="px-2 pt-2 pb-1.5 space-y-1.5">
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500"
            />
            <div className="flex flex-wrap gap-1">
              {(['All','Revenue','Expense','Asset'] as const).map(t => (
                <button key={t} onClick={() => setTypeFilter(t as typeof typeFilter)}
                  className="text-[9px] px-1.5 py-0.5 rounded font-semibold transition-colors"
                  style={{
                    background: typeFilter === t ? (t === 'All' ? '#0f172a' : TYPE_COLOR[t as AccountType]) : '#f1f5f9',
                    color: typeFilter === t ? 'white' : '#64748b',
                  }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Account list */}
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
            {(Object.keys(groupedByType) as AccountType[]).map(type => (
              <div key={type}>
                <p className="text-[9px] font-bold uppercase tracking-widest px-1 mb-0.5" style={{ color: TYPE_COLOR[type] }}>{type}</p>
                {groupedByType[type]!.map(acc => (
                  <div
                    key={acc.id}
                    draggable
                    onDragStart={e => onAccountDragStart(e, acc.id)}
                    onDragEnd={() => setDragId(null)}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-grab active:cursor-grabbing mb-0.5"
                    style={{ background: `${TYPE_COLOR[acc.type]}12` }}
                    title={`Balance: ${fmt(acc.balance, sym)}`}
                  >
                    <GripVertical size={10} className="text-slate-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-slate-700 truncate">{acc.name}</p>
                      <p className="text-[9px] text-slate-400">{acc.code}</p>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Report canvas */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">

          {sections.map(sec => {
            const total = totals[sec.id] ?? 0;
            const isOver = dropOver === sec.id;

            return (
              <div
                key={sec.id}
                className="rounded-xl overflow-hidden transition-all duration-150"
                style={{
                  border: `1.5px solid ${isOver ? '#10b981' : sec.isTotal ? '#e2e8f0' : '#e2e8f0'}`,
                  background: isOver ? 'rgba(16,185,129,0.04)' : sec.isTotal ? '#f8fafc' : 'white',
                  boxShadow: isOver ? '0 0 0 3px rgba(16,185,129,0.12)' : undefined,
                }}
                onDragOver={e => { e.preventDefault(); setDropOver(sec.id); }}
                onDragLeave={() => setDropOver(null)}
                onDrop={e => onDrop(e, sec.id)}
                onDragEnter={() => setDropOver(sec.id)}
              >
                {/* Section header */}
                <div
                  className="flex items-center gap-2 px-3 py-2"
                  style={{
                    background: sec.isTotal ? '#0f172a' : '#f8fafc',
                    borderBottom: sec.collapsed ? 'none' : '1px solid #e2e8f0',
                  }}
                >
                  <div
                    draggable
                    onDragStart={e => onSecDragStart(e, sec.id)}
                    onDragEnd={() => setSecDragId(null)}
                    className="cursor-grab text-slate-400 hover:text-slate-600 shrink-0"
                  >
                    <GripVertical size={13} />
                  </div>

                  <button onClick={() => update(sec.id, { collapsed: !sec.collapsed })}
                    className="text-slate-400 hover:text-slate-600 shrink-0">
                    {sec.collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                  </button>

                  <input
                    value={sec.name}
                    onChange={e => update(sec.id, { name: e.target.value })}
                    className="flex-1 text-sm font-semibold bg-transparent border-b border-transparent hover:border-slate-400 focus:border-emerald-400 focus:outline-none px-1 min-w-0"
                    style={{ color: sec.isTotal ? 'white' : '#1e293b' }}
                  />

                  {/* Sign toggle — only for group sections */}
                  {sec.kind === 'group' && (
                    <button
                      onClick={() => update(sec.id, { signMultiplier: sec.signMultiplier === -1 ? 1 : -1 })}
                      title={sec.signMultiplier === -1 ? 'Revenue mode (negating credit balance)' : 'Expense mode (natural balance)'}
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 transition-colors"
                      style={{
                        background: sec.signMultiplier === -1 ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)',
                        color: sec.signMultiplier === -1 ? '#10b981' : '#f59e0b',
                      }}
                    >
                      {sec.signMultiplier === -1 ? 'REV' : 'EXP'}
                    </button>
                  )}

                  {/* Formula badge */}
                  {sec.kind === 'formula' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                      style={{ background: 'rgba(59,130,246,0.2)', color: '#3b82f6' }}>
                      ƒ
                    </span>
                  )}

                  {/* Total */}
                  <span
                    className="text-sm font-bold tabular-nums shrink-0 ml-1"
                    style={{ color: sec.isTotal ? (total >= 0 ? '#10b981' : '#ef4444') : (total >= 0 ? '#334155' : '#ef4444') }}
                  >
                    {fmt(total, sym)}
                  </span>

                  <button onClick={() => deleteSection(sec.id)}
                    className="text-slate-400 hover:text-red-500 shrink-0 transition-colors ml-1">
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Section body */}
                {!sec.collapsed && (
                  <div className="px-3 py-2">

                    {/* GROUP: account rows */}
                    {sec.kind === 'group' && (
                      <div className="space-y-1">
                        {sec.accountIds.map(aid => {
                          const acc = accountMap[aid];
                          if (!acc) return null;
                          const dispVal = convert(acc.balance, baseCurrency, currency) * sec.signMultiplier;
                          return (
                            <div key={aid} className="flex items-center gap-2 py-1 border-b border-slate-50 group">
                              <span
                                className="text-[10px] font-mono font-semibold shrink-0 w-10"
                                style={{ color: TYPE_COLOR[acc.type] }}
                              >{acc.code}</span>
                              <span className="text-xs text-slate-600 flex-1 truncate">{acc.name}</span>
                              <span className="text-xs tabular-nums text-slate-500 shrink-0">{fmt(dispVal, sym)}</span>
                              <button onClick={() => removeAccount(sec.id, aid)}
                                className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                <X size={11} />
                              </button>
                            </div>
                          );
                        })}

                        {/* Drop zone */}
                        <div
                          className="flex items-center justify-center py-2 rounded-lg text-xs transition-all"
                          style={{
                            border: `1.5px dashed ${isOver ? '#10b981' : '#d1d5db'}`,
                            color: isOver ? '#10b981' : '#9ca3af',
                            background: isOver ? 'rgba(16,185,129,0.04)' : 'transparent',
                          }}
                        >
                          {isOver ? '↓ Drop here' : sec.accountIds.length === 0 ? '← Drag accounts here' : '+ Drop more'}
                        </div>
                      </div>
                    )}

                    {/* FORMULA: expression editor */}
                    {sec.kind === 'formula' && (
                      <div className="space-y-1.5">
                        {sec.formulaTerms.map((term, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                const terms = [...sec.formulaTerms];
                                terms[i] = { ...term, sign: term.sign === 1 ? -1 : 1 };
                                update(sec.id, { formulaTerms: terms });
                              }}
                              className="w-5 h-5 text-xs font-bold flex items-center justify-center rounded transition-colors shrink-0"
                              style={{
                                background: term.sign === 1 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                color: term.sign === 1 ? '#10b981' : '#ef4444',
                              }}
                            >{term.sign === 1 ? '+' : '−'}</button>

                            <select
                              value={term.sectionId}
                              onChange={e => {
                                const terms = [...sec.formulaTerms];
                                terms[i] = { ...term, sectionId: e.target.value };
                                update(sec.id, { formulaTerms: terms });
                              }}
                              className="flex-1 text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
                            >
                              {sections.filter(s => s.id !== sec.id).map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>

                            <span className="text-xs tabular-nums text-slate-500 shrink-0 w-24 text-right">
                              {fmt((totals[term.sectionId] ?? 0) * term.sign, sym)}
                            </span>

                            <button onClick={() => update(sec.id, { formulaTerms: sec.formulaTerms.filter((_, j) => j !== i) })}
                              className="text-slate-300 hover:text-red-500 shrink-0 transition-colors">
                              <X size={11} />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const first = sections.find(s => s.id !== sec.id);
                            if (!first) return;
                            update(sec.id, { formulaTerms: [...sec.formulaTerms, { sectionId: first.id, sign: 1 }] });
                          }}
                          className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 font-medium transition-colors"
                        >
                          <Plus size={10} /> Add term
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add section buttons */}
          <div className="flex gap-2">
            <button onClick={addGroup}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 border-2 border-dashed border-emerald-200 rounded-xl hover:border-emerald-400 hover:bg-emerald-50 transition-all">
              <Plus size={12} /> Account Group
            </button>
            <button onClick={addFormula}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 border-2 border-dashed border-blue-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all">
              <Calculator size={12} /> Formula Row
            </button>
          </div>

          {/* Rules notice */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 py-2 rounded-lg text-[10px] text-slate-400"
            style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <span>✓ General Ledger source</span>
            <span>✓ Closed periods read-only</span>
            <span>✓ Entries must balance</span>
            <span>✓ Multi-currency via active rates</span>
          </div>
        </div>
      </div>
    </div>
  );
}
