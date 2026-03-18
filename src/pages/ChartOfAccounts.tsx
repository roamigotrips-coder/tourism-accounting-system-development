import { useState, useMemo } from 'react';
import { Book, Plus, Search, Download, AlertCircle } from 'lucide-react';
import { useAccountingEngine } from '../context/AccountingEngine';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';

export default function ChartOfAccounts() {
  const { accounts: rawAccounts, loading, error } = useAccountingEngine();

  const accounts = useMemo(() => rawAccounts.map(a => ({
    id: a.id, code: a.code, name: a.name, type: a.type,
    status: a.status, isDefault: a.isDefault, parentId: a.parentId,
    balance: { opening: a.openingBalance, debitTotal: 0, creditTotal: 0, current: a.openingBalance },
    lastTransactionDate: '',
  })), [rawAccounts]);
  
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showOpeningBalanceModal, setShowOpeningBalanceModal] = useState(false);
 
  const filteredAccounts = useMemo(() => {
    return accounts.filter(account => {
      const matchesSearch = 
        account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'All' || account.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [accounts, searchTerm, typeFilter]);

  const stats = useMemo(() => {
    const accountsByType = accounts.reduce((acc, a) => {
      acc[a.type as 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'] = (acc[a.type as 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'] || 0) + 1;
      return acc;
    }, {} as Record<'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense', number>);

    return {
      total: accounts.length,
      active: accounts.filter(a => a.status === 'Active').length,
      defaults: accounts.filter(a => a.isDefault).length,
      byType: accountsByType,
    };
  }, [accounts]);

  const accountTypes = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as const;

  if (loading) return <LoadingSpinner message="Loading accounts..." />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Chart of Accounts</h1>
          <p className="text-gray-600 mt-1">Manage your accounts following double-entry accounting standards</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            <Download size={18} />
            Export
          </button>
          <button 
            onClick={() => setShowOpeningBalanceModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Book size={18} />
            Opening Balance
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={18} />
            Add Account
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-6">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-1 font-medium ${activeTab === 'overview' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          >
            Overview
          </button>
          <button 
            onClick={() => setActiveTab('all')}
            className={`pb-3 px-1 font-medium ${activeTab === 'all' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          >
            All Accounts
          </button>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <p className="text-sm text-gray-600">Total Accounts</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg shadow-sm border-l-4 border-green-500">
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-2xl font-bold text-green-700">{stats.active}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg shadow-sm border-l-4 border-purple-500">
              <div className="flex items-center gap-2">
                <Book size={16} className="text-purple-600" />
                <p className="text-sm text-gray-600">Default</p>
              </div>
              <p className="text-2xl font-bold text-purple-700">{stats.defaults}</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg shadow-sm border-l-4 border-blue-500">
              <p className="text-sm text-gray-600">Assets</p>
              <p className="text-2xl font-bold text-blue-700">{stats.byType.Asset || 0}</p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg shadow-sm border-l-4 border-orange-500">
              <p className="text-sm text-gray-600">Liabilities</p>
              <p className="text-2xl font-bold text-orange-700">{stats.byType.Liability || 0}</p>
            </div>
          </div>

          {/* Account Types by Category */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Book size={20} className="text-blue-600" />
              Account Categories
            </h3>
            <div className="grid grid-cols-5 gap-4">
              {accountTypes.map(type => {
                const count = stats.byType[type] || 0;
                const colors = {
                  Asset: 'bg-blue-50 border-blue-200',
                  Liability: 'bg-orange-50 border-orange-200',
                  Equity: 'bg-yellow-50 border-yellow-200',
                  Revenue: 'bg-green-50 border-green-200',
                  Expense: 'bg-red-50 border-red-200',
                } as const;
                return (
                  <div key={type} className={`p-4 rounded-lg border ${colors[type]}`}>
                    <p className="text-sm text-gray-600">{type}</p>
                    <p className="text-3xl font-bold mt-1">{count}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Getting Started */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Book size={24} className="text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-blue-900">Getting Started with Chart of Accounts</h3>
                <p className="text-sm text-blue-700 mt-1">Add custom accounts or load the default chart of accounts for tourism DMC operations</p>
              </div>
            </div>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Load Default Chart
            </button>
          </div>
        </>
      )}

      {/* All Accounts Tab */}
      {activeTab === 'all' && (
        <>
          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm border p-4 flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select 
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="All">All Types</option>
              <option value="Asset">Asset</option>
              <option value="Liability">Liability</option>
              <option value="Equity">Equity</option>
              <option value="Revenue">Revenue</option>
              <option value="Expense">Expense</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Code</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">Opening</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">Debits</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">Credits</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">Balance</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map(account => (
                    <tr key={account.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono text-gray-500">{account.code}</td>
                      <td className="px-4 py-3 text-sm font-medium">{account.name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium
                          ${account.type === 'Asset' ? 'bg-blue-100 text-blue-800' :
                            account.type === 'Liability' ? 'bg-orange-100 text-orange-800' :
                            account.type === 'Equity' ? 'bg-yellow-100 text-yellow-800' :
                            account.type === 'Revenue' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'}`}>
                          {account.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {account.status === 'Active' ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs">Active</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-800 text-xs">Inactive</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-mono">
                        {account.balance.opening > 0 ? `AED ${account.balance.opening.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-mono text-green-600">
                        {account.balance.debitTotal > 0 ? `AED ${account.balance.debitTotal.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-mono text-red-600">
                        {account.balance.creditTotal > 0 ? `AED ${account.balance.creditTotal.toLocaleString()}` : '-'}
                      </td>
                      <td className={`px-4 py-3 text-right text-sm font-mono font-medium ${account.balance.current >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                         AED {Math.abs(account.balance.current).toLocaleString()} {account.balance.current < 0 ? '(Cr)' : '(Dr)'}
                      </td>
                      <td className="px-4 py-3 flex gap-2">
                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">Edit</button>
                        {!account.isDefault && <button className="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Add Account</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Account Code *</label>
                  <input type="text" className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., 6000" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Parent Account</label>
                  <select className="w-full px-3 py-2 border rounded-lg">
                    <option value="">No Parent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Account Name *</label>
                <input type="text" className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., Consulting Income" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Account Type *</label>
                <select className="w-full px-3 py-2 border rounded-lg">
                  <option>Asset</option>
                  <option>Liability</option>
                  <option>Equity</option>
                  <option>Revenue</option>
                  <option>Expense</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea className="w-full px-3 py-2 border rounded-lg h-20" placeholder="Description..." />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="default" className="rounded" />
                <label htmlFor="default" className="text-sm">Make this a default account (cannot be deleted)</label>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Account</button>
            </div>
          </div>
        </div>
      )}

      {/* Opening Balance Modal */}
      {showOpeningBalanceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Opening Balance Entry</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded p-3 flex items-center gap-2">
                <AlertCircle size={20} className="text-amber-600" />
                <p className="text-sm text-amber-800">
                  Opening balance entry required before recording transactions. Set initial balances for your asset and liability accounts.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Account</label>
                <select className="w-full px-3 py-2 border rounded-lg">
                  {accounts.filter(a => ['Asset', 'Liability'].includes(a.type)).map(a => (
                    <option key={a.id} value={a.code}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Date *</label>
                  <input type="date" className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Balance Type</label>
                  <select className="w-full px-3 py-2 border rounded-lg">
                    <option>Debit</option>
                    <option>Credit</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Amount</label>
                <input type="number" step="0.01" className="w-full px-3 py-2 border rounded-lg" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea className="w-full px-3 py-2 border rounded-lg h-20" placeholder="Notes..." />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowOpeningBalanceModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">Record Balance</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}