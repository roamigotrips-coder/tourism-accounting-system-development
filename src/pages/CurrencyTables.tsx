import { useState } from 'react';
import { Plus, Search, Edit2, Trash2, Download, Copy, DollarSign, TrendingUp, Database, ChevronDown, ChevronUp, Check, X, Globe } from 'lucide-react';

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  decimal_places: number;
  is_base: boolean;
  status: 'active' | 'inactive';
  created_at: string;
}

interface ExchangeRate {
  id: string;
  currency_code: string;
  rate: number;
  effective_date: string;
  source: 'manual' | 'api' | 'central_bank' | 'fixed';
  base_currency: string;
  inverse_rate: number;
  created_at: string;
}

const DEFAULT_CURRENCIES: Currency[] = [
  { id: '1', code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimal_places: 2, is_base: true, status: 'active', created_at: '2024-01-01' },
  { id: '2', code: 'USD', name: 'US Dollar', symbol: '$', decimal_places: 2, is_base: false, status: 'active', created_at: '2024-01-01' },
  { id: '3', code: 'EUR', name: 'Euro', symbol: '€', decimal_places: 2, is_base: false, status: 'active', created_at: '2024-01-01' },
  { id: '4', code: 'GBP', name: 'British Pound', symbol: '£', decimal_places: 2, is_base: false, status: 'active', created_at: '2024-01-01' },
  { id: '5', code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', decimal_places: 2, is_base: false, status: 'active', created_at: '2024-01-01' },
  { id: '6', code: 'INR', name: 'Indian Rupee', symbol: '₹', decimal_places: 2, is_base: false, status: 'active', created_at: '2024-01-01' },
  { id: '7', code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك', decimal_places: 3, is_base: false, status: 'active', created_at: '2024-01-01' },
  { id: '8', code: 'QAR', name: 'Qatari Riyal', symbol: 'ر.ق', decimal_places: 2, is_base: false, status: 'active', created_at: '2024-01-01' },
  { id: '9', code: 'BHD', name: 'Bahraini Dinar', symbol: '.د.ب', decimal_places: 3, is_base: false, status: 'inactive', created_at: '2024-01-01' },
  { id: '10', code: 'OMR', name: 'Omani Rial', symbol: 'ر.ع.', decimal_places: 3, is_base: false, status: 'inactive', created_at: '2024-01-01' },
];

const DEFAULT_RATES: ExchangeRate[] = [
  { id: '1', currency_code: 'USD', rate: 3.6725, effective_date: '2024-01-15', source: 'central_bank', base_currency: 'AED', inverse_rate: 0.2723, created_at: '2024-01-15' },
  { id: '2', currency_code: 'EUR', rate: 3.9950, effective_date: '2024-01-15', source: 'central_bank', base_currency: 'AED', inverse_rate: 0.2503, created_at: '2024-01-15' },
  { id: '3', currency_code: 'GBP', rate: 4.6400, effective_date: '2024-01-15', source: 'central_bank', base_currency: 'AED', inverse_rate: 0.2155, created_at: '2024-01-15' },
  { id: '4', currency_code: 'SAR', rate: 0.9793, effective_date: '2024-01-15', source: 'fixed', base_currency: 'AED', inverse_rate: 1.0211, created_at: '2024-01-15' },
  { id: '5', currency_code: 'INR', rate: 0.0441, effective_date: '2024-01-15', source: 'api', base_currency: 'AED', inverse_rate: 22.6757, created_at: '2024-01-15' },
  { id: '6', currency_code: 'KWD', rate: 11.95, effective_date: '2024-01-15', source: 'central_bank', base_currency: 'AED', inverse_rate: 0.0837, created_at: '2024-01-15' },
  { id: '7', currency_code: 'QAR', rate: 1.0088, effective_date: '2024-01-15', source: 'fixed', base_currency: 'AED', inverse_rate: 0.9913, created_at: '2024-01-15' },
];

const DDL = `-- currencies table
CREATE TABLE currencies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_code CHAR(3) NOT NULL UNIQUE,
  currency_name VARCHAR(100) NOT NULL,
  symbol        VARCHAR(10) NOT NULL,
  decimal_places INT NOT NULL DEFAULT 2,
  is_base       BOOLEAN NOT NULL DEFAULT FALSE,
  status        VARCHAR(10) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','inactive')),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP
);

CREATE UNIQUE INDEX idx_currencies_base
  ON currencies (is_base) WHERE is_base = TRUE;

-- exchange_rates table
CREATE TABLE exchange_rates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_code  CHAR(3) NOT NULL REFERENCES currencies(currency_code),
  rate           DECIMAL(18,6) NOT NULL CHECK (rate > 0),
  effective_date DATE NOT NULL,
  source         VARCHAR(20) NOT NULL DEFAULT 'manual'
                 CHECK (source IN ('manual','api','central_bank','fixed')),
  base_currency  CHAR(3) NOT NULL DEFAULT 'AED',
  inverse_rate   DECIMAL(18,6) GENERATED ALWAYS AS (1.0 / rate) STORED,
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rates_currency   ON exchange_rates(currency_code);
CREATE INDEX idx_rates_date       ON exchange_rates(effective_date);
CREATE INDEX idx_rates_curr_date  ON exchange_rates(currency_code, effective_date DESC);`;

export default function CurrencyTables() {
  const [currencies, setCurrencies] = useState<Currency[]>(DEFAULT_CURRENCIES);
  const [rates] = useState<ExchangeRate[]>(DEFAULT_RATES);
  const [tab, setTab] = useState<'overview' | 'currencies' | 'rates' | 'sql'>('overview');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showAddRate, setShowAddRate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [expandedRate, setExpandedRate] = useState<string | null>(null);

  // New currency form
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newSymbol, setNewSymbol] = useState('');
  const [newDecimals, setNewDecimals] = useState(2);

  // New rate form
  const [rateCurrency, setRateCurrency] = useState('');
  const [rateValue, setRateValue] = useState('');
  const [rateSource, setRateSource] = useState<ExchangeRate['source']>('manual');
  const [rateDate, setRateDate] = useState(new Date().toISOString().split('T')[0]);

  const activeCurrencies = currencies.filter(c => c.status === 'active');
  const baseCurrency = currencies.find(c => c.is_base);

  const filteredCurrencies = currencies.filter(c => {
    const matchSearch = c.code.toLowerCase().includes(search.toLowerCase()) || c.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleAddCurrency = () => {
    if (!newCode || !newName || !newSymbol) return;
    const c: Currency = {
      id: Date.now().toString(),
      code: newCode.toUpperCase(),
      name: newName,
      symbol: newSymbol,
      decimal_places: newDecimals,
      is_base: false,
      status: 'active',
      created_at: new Date().toISOString().split('T')[0],
    };
    setCurrencies(prev => [...prev, c]);
    setNewCode(''); setNewName(''); setNewSymbol(''); setNewDecimals(2);
    setShowAdd(false);
  };

  const toggleStatus = (id: string) => {
    setCurrencies(prev => prev.map(c => c.id === id && !c.is_base ? { ...c, status: c.status === 'active' ? 'inactive' : 'active' } : c));
  };

  const sourceColors: Record<string, string> = {
    manual: 'bg-gray-100 text-gray-700',
    api: 'bg-blue-100 text-blue-700',
    central_bank: 'bg-emerald-100 text-emerald-700',
    fixed: 'bg-purple-100 text-purple-700',
  };

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: Globe },
    { id: 'currencies' as const, label: 'Currencies', icon: DollarSign },
    { id: 'rates' as const, label: 'Exchange Rates', icon: TrendingUp },
    { id: 'sql' as const, label: 'SQL Schema', icon: Database },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Currency Tables</h1>
          <p className="text-slate-500 mt-1">Manage currencies and exchange rates database tables</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700">
            <Plus size={16} /> Add Currency
          </button>
          <button onClick={() => setShowAddRate(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
            <Plus size={16} /> Add Rate
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total Currencies', value: currencies.length, color: 'bg-blue-50 text-blue-700', icon: Globe },
              { label: 'Active', value: activeCurrencies.length, color: 'bg-emerald-50 text-emerald-700', icon: Check },
              { label: 'Base Currency', value: baseCurrency?.code || 'AED', color: 'bg-purple-50 text-purple-700', icon: DollarSign },
              { label: 'Exchange Rates', value: rates.length, color: 'bg-amber-50 text-amber-700', icon: TrendingUp },
            ].map((k, i) => (
              <div key={i} className={`${k.color} rounded-xl p-5`}>
                <div className="flex items-center gap-2 mb-2">
                  <k.icon size={16} />
                  <span className="text-sm font-medium">{k.label}</span>
                </div>
                <p className="text-2xl font-bold">{k.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-slate-800 mb-4">Active Currencies</h3>
              <div className="space-y-3">
                {activeCurrencies.map(c => {
                  const rate = rates.find(r => r.currency_code === c.code);
                  return (
                    <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-sm">{c.symbol}</span>
                        <div>
                          <p className="font-medium text-slate-800">{c.code}</p>
                          <p className="text-xs text-slate-500">{c.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {c.is_base ? (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">Base Currency</span>
                        ) : rate ? (
                          <p className="font-semibold text-slate-800">{rate.rate.toFixed(4)}</p>
                        ) : (
                          <span className="text-xs text-slate-400">No rate</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-slate-800 mb-4">Database Structure</h3>
              <div className="space-y-4">
                {[
                  { table: 'currencies', fields: 8, desc: 'Currency definitions with code, name, symbol, status' },
                  { table: 'exchange_rates', fields: 9, desc: 'Historical and current exchange rates per currency' },
                ].map((t, i) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-lg border">
                    <div className="flex items-center gap-2 mb-1">
                      <Database size={14} className="text-blue-600" />
                      <span className="font-mono text-sm font-semibold text-blue-700">{t.table}</span>
                      <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{t.fields} fields</span>
                    </div>
                    <p className="text-xs text-slate-500">{t.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Currencies Tab */}
      {tab === 'currencies' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search currencies..." className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" />
            </div>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              {(['all', 'active', 'inactive'] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-md text-xs font-medium ${statusFilter === s ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Code</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Symbol</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">Decimals</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">Base</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCurrencies.map(c => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-bold text-slate-800">{c.code}</td>
                    <td className="px-4 py-3 text-slate-700">{c.name}</td>
                    <td className="px-4 py-3">
                      <span className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center font-bold text-sm">{c.symbol}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">{c.decimal_places}</td>
                    <td className="px-4 py-3 text-center">
                      {c.is_base && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">Base</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${c.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"><Edit2 size={14} /></button>
                        {!c.is_base && (
                          <button onClick={() => toggleStatus(c.id)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600">
                            {c.status === 'active' ? <X size={14} /> : <Check size={14} />}
                          </button>
                        )}
                        {!c.is_base && <button className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rates Tab */}
      {tab === 'rates' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Currency</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Rate (to AED)</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Inverse Rate</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">Effective Date</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">Source</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">Details</th>
                </tr>
              </thead>
              <tbody>
                {rates.map(r => {
                  const curr = currencies.find(c => c.code === r.currency_code);
                  return (
                    <>
                      <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50 cursor-pointer" onClick={() => setExpandedRate(expandedRate === r.id ? null : r.id)}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-800">{r.currency_code}</span>
                            <span className="text-slate-500 text-xs">{curr?.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">{r.rate.toFixed(4)}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-500">{r.inverse_rate.toFixed(4)}</td>
                        <td className="px-4 py-3 text-center text-slate-600">{r.effective_date}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${sourceColors[r.source]}`}>{r.source.replace('_', ' ')}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {expandedRate === r.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </td>
                      </tr>
                      {expandedRate === r.id && (
                        <tr key={`${r.id}-detail`}>
                          <td colSpan={6} className="px-4 py-4 bg-slate-50">
                            <div className="grid grid-cols-4 gap-4 text-sm">
                              <div><span className="text-slate-500">1 {r.currency_code}</span> = <span className="font-bold">{r.rate} AED</span></div>
                              <div><span className="text-slate-500">1 AED</span> = <span className="font-bold">{r.inverse_rate.toFixed(6)} {r.currency_code}</span></div>
                              <div><span className="text-slate-500">Base:</span> <span className="font-bold">{r.base_currency}</span></div>
                              <div><span className="text-slate-500">Created:</span> <span className="font-bold">{r.created_at}</span></div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SQL Schema Tab */}
      {tab === 'sql' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Database DDL</h3>
            <div className="flex gap-2">
              <button onClick={() => navigator.clipboard.writeText(DDL)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">
                <Copy size={14} /> Copy SQL
              </button>
              <button onClick={() => {
                const b = new Blob([DDL], { type: 'text/sql' });
                const u = URL.createObjectURL(b);
                const a = document.createElement('a');
                a.href = u; a.download = 'currency_tables.sql'; a.click();
              }} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                <Download size={14} /> Download .sql
              </button>
            </div>
          </div>
          <pre className="bg-slate-900 text-green-400 p-6 rounded-xl text-sm overflow-auto max-h-[600px] font-mono leading-relaxed">{DDL}</pre>
        </div>
      )}

      {/* Add Currency Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Add Currency</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Currency Code (ISO 4217) *</label>
                <input value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())} maxLength={3} placeholder="USD" className="w-full px-3 py-2 border rounded-lg text-sm font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Currency Name *</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="US Dollar" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Symbol *</label>
                <input value={newSymbol} onChange={e => setNewSymbol(e.target.value)} placeholder="$" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Decimal Places</label>
                <select value={newDecimals} onChange={e => setNewDecimals(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value={0}>0</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleAddCurrency} disabled={!newCode || !newName || !newSymbol} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50">Add Currency</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Rate Modal */}
      {showAddRate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Add Exchange Rate</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Currency *</label>
                <select value={rateCurrency} onChange={e => setRateCurrency(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">Select currency</option>
                  {activeCurrencies.filter(c => !c.is_base).map(c => (
                    <option key={c.id} value={c.code}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rate (1 {rateCurrency || 'XXX'} = ? AED) *</label>
                <input type="number" step="0.0001" value={rateValue} onChange={e => setRateValue(e.target.value)} placeholder="3.6725" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Source</label>
                <select value={rateSource} onChange={e => setRateSource(e.target.value as ExchangeRate['source'])} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="manual">Manual</option>
                  <option value="api">API</option>
                  <option value="central_bank">Central Bank</option>
                  <option value="fixed">Fixed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Effective Date *</label>
                <input type="date" value={rateDate} onChange={e => setRateDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              {rateValue && (
                <div className="p-3 bg-blue-50 rounded-lg text-sm">
                  <p className="text-blue-700">1 {rateCurrency || 'XXX'} = <strong>{Number(rateValue).toFixed(4)} AED</strong></p>
                  <p className="text-blue-600 text-xs mt-1">1 AED = {(1 / Number(rateValue)).toFixed(6)} {rateCurrency || 'XXX'}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAddRate(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={() => { setShowAddRate(false); setRateCurrency(''); setRateValue(''); }} disabled={!rateCurrency || !rateValue} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">Add Rate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
