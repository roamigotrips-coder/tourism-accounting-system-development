import { useState } from 'react';
import { Building2, Wallet, Globe, ArrowUpRight, ArrowDownRight, Plus, X, Save } from 'lucide-react';
import { bankAccounts, payments } from '../data/mockData';

const transactionTypes = ['Receipt', 'Payment', 'Refund'];
const paymentMethods = ['Bank Transfer', 'Card Payment', 'Cash', 'Cheque', 'Payment Link', 'Online'];
const parties = ['Global Tours UK', 'Euro Holidays', 'Asia Travel Co', 'Marriott Hotels UAE', 'Desert Safari LLC', 'City Transport Co', 'Ahmed Hassan', 'Emma Wilson'];

interface TransactionForm {
  type: string;
  party: string;
  amount: string;
  method: string;
  date: string;
  reference: string;
  account: string;
}

const emptyForm: TransactionForm = {
  type: 'Receipt', party: '', amount: '', method: 'Bank Transfer', date: '', reference: '', account: '',
};

export default function BankCash() {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<TransactionForm>(emptyForm);
  const [paymentList, setPaymentList] = useState(payments);
  const [accountList] = useState(bankAccounts);

  const totalBalance = accountList.reduce((s, a) => s + a.balance, 0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (evt: React.FormEvent) => {
    evt.preventDefault();
    const newPayment = {
      id: `PAY-${String(paymentList.length + 1).padStart(3, '0')}`,
      type: form.type as 'Receipt' | 'Payment' | 'Refund',
      party: form.party,
      amount: parseFloat(form.amount) || 0,
      method: form.method,
      date: form.date,
      reference: form.reference || `REF-${Date.now()}`,
      status: 'Completed' as const,
    };
    setPaymentList(prev => [newPayment, ...prev]);
    setForm(emptyForm);
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Bank & Cash Management</h1>
          <p className="text-slate-500 mt-1">Payment receipts, refunds & account management</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 text-sm font-medium">
          <Plus size={16} /> Add Transaction
        </button>
      </div>

      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 text-white">
        <p className="text-slate-300 text-sm">Total Balance Across All Accounts</p>
        <p className="text-3xl font-bold mt-1">AED {totalBalance.toLocaleString()}</p>
        <p className="text-slate-400 text-sm mt-1">{accountList.length} accounts active</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accountList.map(acc => (
          <div key={acc.id} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                acc.type === 'Bank' ? 'bg-blue-50' : acc.type === 'Cash' ? 'bg-emerald-50' : 'bg-purple-50'
              }`}>
                {acc.type === 'Bank' ? <Building2 size={18} className="text-blue-600" /> :
                 acc.type === 'Cash' ? <Wallet size={18} className="text-emerald-600" /> :
                 <Globe size={18} className="text-purple-600" />}
              </div>
              <div>
                <p className="font-medium text-slate-800 text-sm">{acc.name}</p>
                <p className="text-xs text-slate-400">{acc.bank}</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-800">AED {acc.balance.toLocaleString()}</p>
            <span className={`inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-medium ${
              acc.type === 'Bank' ? 'bg-blue-50 text-blue-600' : acc.type === 'Cash' ? 'bg-emerald-50 text-emerald-600' : 'bg-purple-50 text-purple-600'
            }`}>{acc.type}</span>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Recent Transactions</h3>
          <span className="text-xs text-slate-400">{paymentList.length} transactions</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50">
              <th className="text-left px-5 py-3 font-medium text-slate-600">ID</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">Type</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">Party</th>
              <th className="text-right px-5 py-3 font-medium text-slate-600">Amount</th>
              <th className="text-center px-5 py-3 font-medium text-slate-600">Method</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">Date</th>
              <th className="text-center px-5 py-3 font-medium text-slate-600">Status</th>
            </tr></thead>
            <tbody>
              {paymentList.map(p => (
                <tr key={p.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                  <td className="px-5 py-3 font-medium text-slate-600">{p.id}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                      p.type === 'Receipt' ? 'bg-emerald-50 text-emerald-700' :
                      p.type === 'Payment' ? 'bg-blue-50 text-blue-700' :
                      'bg-red-50 text-red-700'
                    }`}>
                      {p.type === 'Receipt' ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                      {p.type}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-700">{p.party}</td>
                  <td className={`px-5 py-3 text-right font-medium ${p.type === 'Receipt' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {p.type === 'Receipt' ? '+' : '-'} AED {p.amount.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-center text-slate-600 text-xs">{p.method}</td>
                  <td className="px-5 py-3 text-slate-600">{p.date}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      p.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' :
                      p.status === 'Processing' ? 'bg-amber-50 text-amber-700' :
                      'bg-red-50 text-red-700'
                    }`}>{p.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Transaction Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Add Transaction</h2>
                <p className="text-sm text-slate-500 mt-0.5">Record a new payment or receipt</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Transaction Type <span className="text-red-500">*</span></label>
                  <select name="type" value={form.type} onChange={handleChange} required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                    {transactionTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Account <span className="text-red-500">*</span></label>
                  <select name="account" value={form.account} onChange={handleChange} required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                    <option value="">Select Account</option>
                    {accountList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Party (Agent / Customer / Supplier) <span className="text-red-500">*</span></label>
                  <select name="party" value={form.party} onChange={handleChange} required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                    <option value="">Select Party</option>
                    {parties.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount (AED) <span className="text-red-500">*</span></label>
                  <input type="number" name="amount" value={form.amount} onChange={handleChange} required min="0" step="0.01" placeholder="0.00"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                  <select name="method" value={form.method} onChange={handleChange}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                    {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date <span className="text-red-500">*</span></label>
                  <input type="date" name="date" value={form.date} onChange={handleChange} required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Reference No.</label>
                  <input name="reference" value={form.reference} onChange={handleChange} placeholder="e.g. REF-2024-001"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
                  <Save size={16} /> Save Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
