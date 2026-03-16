import { useState } from 'react';
import { Cloud, RefreshCw, CheckCircle, Clock, Zap, Link, Activity, Settings, ChevronDown, ChevronUp, Wifi, WifiOff, Plus, X } from 'lucide-react';

const PROVIDERS = [
  { id: 'enbd', name: 'Emirates NBD', color: 'bg-yellow-500', code: 'ENBD', realtime: true },
  { id: 'adcb', name: 'ADCB', color: 'bg-blue-600', code: 'ADCB', realtime: true },
  { id: 'fab', name: 'FAB', color: 'bg-green-600', code: 'FAB', realtime: false },
  { id: 'mashreq', name: 'Mashreq', color: 'bg-red-600', code: 'MASH', realtime: false },
  { id: 'rak', name: 'RAK Bank', color: 'bg-purple-600', code: 'RAK', realtime: false },
  { id: 'cbd', name: 'CBD', color: 'bg-orange-500', code: 'CBD', realtime: false },
];

interface Connection { id: string; provider: string; name: string; accountNo: string; balance: number; status: 'connected'|'syncing'|'error'|'disconnected'; lastSync: string; autoMatch: boolean; }
interface FeedTx { id: string; date: string; description: string; amount: number; type: 'credit'|'debit'; status: 'unmatched'|'matched'|'ignored'; provider: string; }

const MOCK_CONNECTIONS: Connection[] = [
  { id: 'C1', provider: 'Emirates NBD', name: 'Main Business Account', accountNo: '****4521', balance: 284500, status: 'connected', lastSync: '2 mins ago', autoMatch: true },
  { id: 'C2', provider: 'ADCB', name: 'Payroll Account', accountNo: '****8834', balance: 45200, status: 'connected', lastSync: '15 mins ago', autoMatch: false },
];

const MOCK_FEED_TXS: FeedTx[] = [
  { id: 'FT1', date: '2024-06-10', description: 'AGENT PAYMENT - GLOBAL TOURS UK', amount: 12500, type: 'credit', status: 'matched', provider: 'Emirates NBD' },
  { id: 'FT2', date: '2024-06-10', description: 'FUEL PAYMENT - ADNOC', amount: 850, type: 'debit', status: 'matched', provider: 'Emirates NBD' },
  { id: 'FT3', date: '2024-06-09', description: 'MARRIOTT HOTELS UAE', amount: 22000, type: 'debit', status: 'unmatched', provider: 'Emirates NBD' },
  { id: 'FT4', date: '2024-06-09', description: 'WIRE TRANSFER - EURO HOLIDAYS', amount: 8750, type: 'credit', status: 'unmatched', provider: 'ADCB' },
  { id: 'FT5', date: '2024-06-08', description: 'OFFICE RENT - AL MAKTOUM BLDG', amount: 15000, type: 'debit', status: 'ignored', provider: 'Emirates NBD' },
  { id: 'FT6', date: '2024-06-08', description: 'CUSTOMER PAYMENT - MR JAMES WILSON', amount: 5500, type: 'credit', status: 'unmatched', provider: 'ADCB' },
];

export default function BankFeeds() {
  const [tab, setTab] = useState<'overview'|'connections'|'transactions'|'rules'>('overview');
  const [connections, setConnections] = useState<Connection[]>(MOCK_CONNECTIONS);
  const [txs] = useState<FeedTx[]>(MOCK_FEED_TXS);
  const [showConnect, setShowConnect] = useState(false);
  const [syncing, setSyncing] = useState<string|null>(null);
  const [expanded, setExpanded] = useState<string|null>(null);
  const [step, setStep] = useState(1);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [newConn, setNewConn] = useState({ name: '', accountNo: '', autoMatch: true });

  const totalBalance = connections.reduce((s, c) => s + c.balance, 0);
  const unmatched = txs.filter(t => t.status === 'unmatched').length;
  const matched = txs.filter(t => t.status === 'matched').length;

  const syncNow = (id: string) => {
    setSyncing(id);
    setTimeout(() => {
      setConnections(prev => prev.map(c => c.id === id ? { ...c, lastSync: 'Just now' } : c));
      setSyncing(null);
    }, 2000);
  };

  const toggleAutoMatch = (id: string) => {
    setConnections(prev => prev.map(c => c.id === id ? { ...c, autoMatch: !c.autoMatch } : c));
  };

  const disconnect = (id: string) => {
    setConnections(prev => prev.filter(c => c.id !== id));
  };

  const connectBank = () => {
    if (!selectedProvider || !newConn.name) return;
    const conn: Connection = {
      id: `C${Date.now()}`, provider: selectedProvider, name: newConn.name,
      accountNo: `****${newConn.accountNo.slice(-4) || '0000'}`, balance: 0,
      status: 'connected', lastSync: 'Just now', autoMatch: newConn.autoMatch,
    };
    setConnections(prev => [...prev, conn]);
    setShowConnect(false); setStep(1); setSelectedProvider(''); setNewConn({ name: '', accountNo: '', autoMatch: true });
  };

  const TABS = [
    { key: 'overview', label: 'Overview', icon: <Activity size={15} /> },
    { key: 'connections', label: 'Connections', icon: <Link size={15} /> },
    { key: 'transactions', label: 'Transactions', icon: <Clock size={15} /> },
    { key: 'rules', label: 'Rules', icon: <Settings size={15} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Bank Feeds</h1>
          <p className="text-slate-500 mt-1">Automatic bank statement import · Auto-matching engine</p>
        </div>
        <button onClick={() => setShowConnect(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 text-sm font-medium">
          <Plus size={16} /> Connect Bank
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Connected Banks', value: connections.length, icon: <Wifi size={18} />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Total Balance', value: `AED ${totalBalance.toLocaleString()}`, icon: <Cloud size={18} />, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Matched Txs', value: matched, icon: <CheckCircle size={18} />, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Unmatched', value: unmatched, icon: <Zap size={18} />, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
            <div className={`w-9 h-9 ${k.bg} rounded-lg flex items-center justify-center ${k.color} mb-3`}>{k.icon}</div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Pipeline Diagram */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <h3 className="font-semibold text-slate-800 mb-4">Integration Pipeline</h3>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {['Bank Provider API', 'Feed Service', 'Transactions Table', 'Auto-Match Engine', 'Reconciliation Screen'].map((step, i, arr) => (
            <div key={step} className="flex items-center gap-2 flex-shrink-0">
              <div className={`px-3 py-2 rounded-lg text-xs font-semibold text-white ${['bg-blue-600','bg-emerald-600','bg-violet-600','bg-amber-500','bg-slate-700'][i]}`}>
                {step}
              </div>
              {i < arr.length - 1 && <div className="text-slate-300 text-lg">→</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t.key ? 'border-emerald-500 text-emerald-600 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* Overview */}
          {tab === 'overview' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-800">Connected Accounts Summary</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {connections.map(c => (
                  <div key={c.id} className="border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg ${PROVIDERS.find(p=>p.name===c.provider)?.color||'bg-slate-500'} flex items-center justify-center text-white text-xs font-bold`}>
                          {c.provider.slice(0,2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{c.provider}</p>
                          <p className="text-xs text-slate-400">{c.accountNo}</p>
                        </div>
                      </div>
                      <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${c.status==='connected'?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>
                        {c.status==='connected'?<Wifi size={10}/>:<WifiOff size={10}/>} {c.status}
                      </span>
                    </div>
                    <p className="text-lg font-bold text-slate-800">AED {c.balance.toLocaleString()}</p>
                    <p className="text-xs text-slate-400 mt-1">Last sync: {c.lastSync} · Auto-match: {c.autoMatch?'On':'Off'}</p>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-3">Recent Feed Activity</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-50 text-slate-600 text-left">
                      <th className="px-4 py-2.5 font-medium">Date</th>
                      <th className="px-4 py-2.5 font-medium">Description</th>
                      <th className="px-4 py-2.5 font-medium">Provider</th>
                      <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                      <th className="px-4 py-2.5 font-medium text-center">Status</th>
                    </tr></thead>
                    <tbody>
                      {txs.slice(0,5).map(tx => (
                        <tr key={tx.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                          <td className="px-4 py-3 text-slate-500 text-xs">{tx.date}</td>
                          <td className="px-4 py-3 font-medium text-slate-700 max-w-[220px] truncate">{tx.description}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{tx.provider}</td>
                          <td className={`px-4 py-3 text-right font-semibold text-sm ${tx.type==='credit'?'text-emerald-600':'text-red-600'}`}>
                            {tx.type==='credit'?'+':'-'} AED {tx.amount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tx.status==='matched'?'bg-emerald-100 text-emerald-700':tx.status==='unmatched'?'bg-amber-100 text-amber-700':'bg-slate-100 text-slate-500'}`}>
                              {tx.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Connections */}
          {tab === 'connections' && (
            <div className="space-y-3">
              {connections.map(c => (
                <div key={c.id} className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50" onClick={() => setExpanded(expanded===c.id?null:c.id)}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl ${PROVIDERS.find(p=>p.name===c.provider)?.color||'bg-slate-500'} flex items-center justify-center text-white font-bold`}>
                        {c.provider.slice(0,2)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{c.name}</p>
                        <p className="text-sm text-slate-500">{c.provider} · {c.accountNo}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-800">AED {c.balance.toLocaleString()}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status==='connected'?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>{c.status}</span>
                      {expanded===c.id ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
                    </div>
                  </div>
                  {expanded === c.id && (
                    <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50 space-y-3 pt-3">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                        <div><p className="text-xs text-slate-400">Last Sync</p><p className="font-medium">{c.lastSync}</p></div>
                        <div><p className="text-xs text-slate-400">Auto-Match</p>
                          <button onClick={() => toggleAutoMatch(c.id)} className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.autoMatch?'bg-emerald-100 text-emerald-700':'bg-slate-200 text-slate-500'}`}>
                            {c.autoMatch?'Enabled':'Disabled'}
                          </button>
                        </div>
                        <div><p className="text-xs text-slate-400">Status</p><p className="font-medium capitalize">{c.status}</p></div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => syncNow(c.id)} disabled={syncing===c.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                          <RefreshCw size={12} className={syncing===c.id?'animate-spin':''} />
                          {syncing===c.id?'Syncing...':'Sync Now'}
                        </button>
                        <button onClick={() => disconnect(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 border border-red-200">
                          <WifiOff size={12} /> Disconnect
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {connections.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <WifiOff size={32} className="mx-auto mb-3 text-slate-300" />
                  <p>No bank connections yet.</p>
                  <button onClick={() => setShowConnect(true)} className="mt-3 text-emerald-600 font-medium text-sm hover:underline">Connect your first bank</button>
                </div>
              )}
            </div>
          )}

          {/* Transactions */}
          {tab === 'transactions' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 text-left">
                  <th className="px-4 py-3 font-medium text-slate-600">Date</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Description</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Provider</th>
                  <th className="px-4 py-3 font-medium text-slate-600 text-right">Amount</th>
                  <th className="px-4 py-3 font-medium text-slate-600 text-center">Type</th>
                  <th className="px-4 py-3 font-medium text-slate-600 text-center">Status</th>
                </tr></thead>
                <tbody>
                  {txs.map(tx => (
                    <tr key={tx.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-slate-500 text-xs">{tx.date}</td>
                      <td className="px-4 py-3 font-medium text-slate-700 max-w-[240px] truncate">{tx.description}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{tx.provider}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${tx.type==='credit'?'text-emerald-600':'text-red-600'}`}>
                        {tx.type==='credit'?'+':'-'} AED {tx.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tx.type==='credit'?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>{tx.type}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tx.status==='matched'?'bg-emerald-100 text-emerald-700':tx.status==='unmatched'?'bg-amber-100 text-amber-700':'bg-slate-100 text-slate-500'}`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Rules */}
          {tab === 'rules' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                Bank rules are managed in <strong>Finance → Auto-Matching Rules</strong>. Rules defined there are automatically applied to all incoming feed transactions.
              </p>
              <div className="space-y-2">
                {[
                  { name: 'Agent Receipts', pattern: 'agent|receipt|tours', action: 'Create Book Transaction', dir: 'Credit' },
                  { name: 'Bank Charges', pattern: 'charge|fee|comm', action: 'Create Book Transaction', dir: 'Debit' },
                  { name: 'Supplier Payments', pattern: 'hotel|transport|safari', action: 'Create Book Transaction', dir: 'Debit' },
                  { name: 'Office Rent', pattern: 'rent|lease', action: 'Create Book Transaction', dir: 'Debit' },
                ].map((r, i) => (
                  <div key={i} className="flex items-center justify-between border border-slate-200 rounded-xl p-4">
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{r.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Pattern: <code className="bg-slate-100 px-1 rounded">{r.pattern}</code> · {r.dir} · {r.action}</p>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">Active</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Connect Bank Modal */}
      {showConnect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Connect Bank — Step {step}/3</h2>
              <button onClick={() => {setShowConnect(false);setStep(1);setSelectedProvider('');}} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              {step === 1 && (
                <div>
                  <p className="text-sm text-slate-600 mb-4">Select your bank provider:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {PROVIDERS.map(p => (
                      <button key={p.id} onClick={() => {setSelectedProvider(p.name);setStep(2);}}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-sm font-medium transition-all ${selectedProvider===p.name?'border-emerald-500 bg-emerald-50':'border-slate-200 hover:border-slate-300'}`}>
                        <div className={`w-10 h-10 ${p.color} rounded-xl flex items-center justify-center text-white font-bold`}>{p.code}</div>
                        <span className="text-slate-700">{p.name}</span>
                        {p.realtime && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Real-time</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {step === 2 && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">Configure <strong>{selectedProvider}</strong> connection:</p>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Account Nickname *</label>
                    <input value={newConn.name} onChange={e => setNewConn(p=>({...p,name:e.target.value}))} placeholder="e.g. Main Business Account" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Account Number (last 4 digits)</label>
                    <input value={newConn.accountNo} onChange={e => setNewConn(p=>({...p,accountNo:e.target.value}))} placeholder="1234" maxLength={4} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none" />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-slate-700">Enable Auto-Match</p>
                      <p className="text-xs text-slate-400">Automatically match transactions to invoices</p>
                    </div>
                    <button onClick={() => setNewConn(p=>({...p,autoMatch:!p.autoMatch}))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${newConn.autoMatch?'bg-emerald-500':'bg-slate-300'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${newConn.autoMatch?'translate-x-6':'translate-x-1'}`} />
                    </button>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setStep(1)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm">Back</button>
                    <button onClick={() => newConn.name && setStep(3)} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                      Continue to OAuth
                    </button>
                  </div>
                </div>
              )}
              {step === 3 && (
                <div className="space-y-4 text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                    <Wifi size={28} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">Authenticating with {selectedProvider}...</p>
                    <p className="text-sm text-slate-500 mt-1">Simulating OAuth consent flow</p>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="bg-emerald-500 h-2 rounded-full w-3/4 transition-all" />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setStep(2)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm">Back</button>
                    <button onClick={connectBank} className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
                      ✓ Complete Connection
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
