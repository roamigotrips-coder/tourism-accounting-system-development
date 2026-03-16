import { useState } from 'react';
import { Settings, RefreshCw, Plus, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';

export default function MultiCurrency() {
  const { baseCurrency, setBaseCurrency, currencies, setCurrencies, rates, setRates, getRate } = useCurrency();
  const [showAddCurrency, setShowAddCurrency] = useState(false);
  const [showAddRate, setShowAddRate] = useState(false);
  const [revalDate, setRevalDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [revalPreview, setRevalPreview] = useState<any[]>([]);

  const addCurrency = (code: string, name: string, symbol: string) => {
    if (!code) return;
    if (currencies.find(c => c.code === code)) return;
    setCurrencies(prev => [...prev, { code: code.toUpperCase(), name, symbol, enabled: true }]);
    setShowAddCurrency(false);
  };

  const updateRate = (code: string, rate: number) => {
    setRates(prev => {
      const others = prev.filter(r => r.code !== code);
      return [...others, { code, rate, date: new Date().toISOString().slice(0, 10), source: 'Manual' }];
    });
  };

  const onRevalue = () => {
    // MVP: simulate revaluation for foreign-currency invoices (unpaid) stored in localStorage under 'invoices'
    const invoicesRaw = localStorage.getItem('invoices');
    const invoices = invoicesRaw ? JSON.parse(invoicesRaw) : [];
    const preview = invoices
      .filter((inv: any) => inv.status !== 'Paid' && inv.currency && inv.currency !== baseCurrency)
      .map((inv: any) => {
        const oldRate = inv.fxRate || getRate(inv.currency);
        const newRate = getRate(inv.currency);
        const foreign = inv.total;
        const baseOld = foreign * oldRate;
        const baseNew = foreign * newRate;
        const difference = baseNew - baseOld;
        return {
          id: inv.id,
          type: inv.type,
          party: inv.party,
          currency: inv.currency,
          foreignAmount: foreign,
          oldRate,
          newRate,
          baseOld,
          baseNew,
          difference,
        };
      });
    setRevalPreview(preview);
  };

  const postRevaluation = () => {
    if (revalPreview.length === 0) return;
    // Save a draft journal entry representing FX gain/loss
    const jeStoreKey = 'fx_revaluation_entries';
    const existing = JSON.parse(localStorage.getItem(jeStoreKey) || '[]');
    const totalDiff = revalPreview.reduce((s, r) => s + r.difference, 0);
    const isGain = totalDiff >= 0;
    const je = {
      id: `REVAL-${Date.now()}`,
      entryNumber: `REVAL-${new Date().toISOString().slice(0,10).replace(/-/g,'')}`,
      date: revalDate,
      description: 'FX Revaluation (Unrealized)',
      reference: 'FX-REVAL',
      status: 'Draft',
      createdAt: new Date().toISOString(),
      createdBy: 'system',
      totalDebit: Math.abs(totalDiff),
      totalCredit: Math.abs(totalDiff),
      lines: [
        { id: 'L1', accountId: isGain ? '9999' : '9998', accountCode: isGain ? '9999' : '9998', accountName: isGain ? 'Unrealized FX Gain' : 'Unrealized FX Loss', debit: isGain ? 0 : Math.abs(totalDiff), credit: isGain ? Math.abs(totalDiff) : 0 },
        { id: 'L2', accountId: '3100', accountCode: '3100', accountName: 'Retained Earnings', debit: isGain ? Math.abs(totalDiff) : 0, credit: isGain ? 0 : Math.abs(totalDiff) },
      ],
    };
    localStorage.setItem(jeStoreKey, JSON.stringify([je, ...existing]));
    alert('Revaluation draft created. Review in Journal Entries.');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Multi-Currency</h1>
          <p className="text-gray-600 mt-1">Manage currencies, exchange rates, and run FX revaluation with gains/losses</p>
        </div>
      </div>

      {/* Base Currency & Currencies */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border shadow-sm p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Settings size={18}/> Base Currency</h3>
          <select value={baseCurrency} onChange={e => setBaseCurrency(e.target.value)} className="w-full border rounded-lg px-3 py-2">
            {currencies.map(c => (
              <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-lg border shadow-sm p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2"><DollarSign size={18}/> Currencies</h3>
            <button onClick={() => setShowAddCurrency(true)} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg flex items-center gap-1"><Plus size={16}/> Add</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Symbol</th>
                  <th className="px-3 py-2 text-left">Enabled</th>
                </tr>
              </thead>
              <tbody>
                {currencies.map(c => (
                  <tr key={c.code} className="border-t">
                    <td className="px-3 py-2 font-mono">{c.code}</td>
                    <td className="px-3 py-2">{c.name}</td>
                    <td className="px-3 py-2">{c.symbol}</td>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={c.enabled} onChange={e => setCurrencies(prev => prev.map(x => x.code === c.code ? { ...x, enabled: e.target.checked } : x))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Rates */}
      <div className="bg-white rounded-lg border shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2"><TrendingUp size={18}/> Exchange Rates (to {baseCurrency})</h3>
          <button onClick={() => setShowAddRate(true)} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg flex items-center gap-1"><Plus size={16}/> Update Rate</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Currency</th>
                <th className="px-3 py-2 text-left">Rate</th>
                <th className="px-3 py-2 text-left">Last Updated</th>
                <th className="px-3 py-2 text-left">Source</th>
              </tr>
            </thead>
            <tbody>
              {rates.map(r => (
                <tr key={r.code} className="border-t">
                  <td className="px-3 py-2">{r.code}</td>
                  <td className="px-3 py-2">{r.rate}</td>
                  <td className="px-3 py-2">{r.date}</td>
                  <td className="px-3 py-2">{r.source || 'Manual'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revaluation */}
      <div className="bg-white rounded-lg border shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2"><RefreshCw size={18}/> FX Revaluation (Unrealized)</h3>
          <div className="flex items-center gap-2">
            <input type="date" value={revalDate} onChange={e => setRevalDate(e.target.value)} className="px-2 py-1 border rounded" />
            <button onClick={onRevalue} className="px-3 py-1.5 text-sm border rounded-lg">Preview</button>
            <button onClick={postRevaluation} className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg">Create Draft JE</button>
          </div>
        </div>
        {revalPreview.length === 0 ? (
          <div className="text-sm text-gray-500">No foreign currency invoices pending or click Preview to calculate differences.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">ID</th>
                  <th className="px-3 py-2 text-left">Party</th>
                  <th className="px-3 py-2 text-left">Currency</th>
                  <th className="px-3 py-2 text-right">Foreign Amt</th>
                  <th className="px-3 py-2 text-right">Old Rate</th>
                  <th className="px-3 py-2 text-right">New Rate</th>
                  <th className="px-3 py-2 text-right">Old (Base)</th>
                  <th className="px-3 py-2 text-right">New (Base)</th>
                  <th className="px-3 py-2 text-right">Difference</th>
                </tr>
              </thead>
              <tbody>
                {revalPreview.map(r => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">{r.id}</td>
                    <td className="px-3 py-2">{r.party}</td>
                    <td className="px-3 py-2">{r.currency}</td>
                    <td className="px-3 py-2 text-right">{r.foreignAmount.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{r.oldRate}</td>
                    <td className="px-3 py-2 text-right">{r.newRate}</td>
                    <td className="px-3 py-2 text-right">{r.baseOld.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{r.baseNew.toLocaleString()}</td>
                    <td className={`px-3 py-2 text-right font-medium ${r.difference >= 0 ? 'text-green-700' : 'text-red-700'}`}>{r.difference.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-3 flex items-center gap-2"><AlertTriangle size={14}/> This creates an unrealized revaluation draft journal. On settlement, reverse and post realized gain/loss.</div>
      </div>

      {/* Add Currency Modal */}
      {showAddCurrency && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b"><h3 className="font-semibold">Add Currency</h3></div>
            <div className="p-4 space-y-3">
              <input id="code" placeholder="Code (e.g., USD)" className="w-full border rounded px-3 py-2" />
              <input id="name" placeholder="Name (e.g., US Dollar)" className="w-full border rounded px-3 py-2" />
              <input id="symbol" placeholder="Symbol (e.g., $)" className="w-full border rounded px-3 py-2" />
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => setShowAddCurrency(false)} className="px-3 py-1.5 border rounded">Cancel</button>
              <button onClick={() => {
                const code = (document.getElementById('code') as HTMLInputElement).value.trim();
                const name = (document.getElementById('name') as HTMLInputElement).value.trim();
                const symbol = (document.getElementById('symbol') as HTMLInputElement).value.trim();
                addCurrency(code, name, symbol);
              }} className="px-3 py-1.5 bg-blue-600 text-white rounded">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Update Rate Modal */}
      {showAddRate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b"><h3 className="font-semibold">Update Exchange Rate</h3></div>
            <div className="p-4 space-y-3">
              <select id="rateCode" className="w-full border rounded px-3 py-2">
                {currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
              <input id="rateVal" placeholder="Rate to base" type="number" step="0.0001" className="w-full border rounded px-3 py-2" />
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => setShowAddRate(false)} className="px-3 py-1.5 border rounded">Cancel</button>
              <button onClick={() => {
                const code = (document.getElementById('rateCode') as HTMLSelectElement).value;
                const rate = Number((document.getElementById('rateVal') as HTMLInputElement).value || '0');
                if (rate > 0) updateRate(code, rate);
                setShowAddRate(false);
              }} className="px-3 py-1.5 bg-blue-600 text-white rounded">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
