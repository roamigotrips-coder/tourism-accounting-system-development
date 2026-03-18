import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Download, Settings, MapPin, Calendar, TrendingDown, Shield } from 'lucide-react';
import { fetchFixedAssets as fetchFixedAssetsDb, type FixedAsset } from '../lib/supabaseSync';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';

export default function FixedAssets() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);

  const [allAssets, setAllAssets] = useState<FixedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchFixedAssetsDb();
        if (!cancelled) {
          setAllAssets(data ?? []);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? 'Failed to load fixed assets');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredAssets = useMemo(() => {
    return allAssets.filter(asset => {
      const matchesSearch = 
        asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'All' || asset.category === categoryFilter;
      const matchesStatus = statusFilter === 'All' || asset.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [allAssets, searchTerm, categoryFilter, statusFilter]);

  const stats = useMemo(() => {
    return {
      totalAssets: allAssets.length,
      active: allAssets.filter(a => a.status === 'Active').length,
      disposing: allAssets.filter(a => a.status === 'Disposing').length,
      totalValue: allAssets.reduce((sum, a) => sum + a.currentValue, 0),
      accumulatedDepreciation: allAssets.reduce((sum, a) => sum + a.accumulatedDepreciation, 0),
      purchaseValue: allAssets.reduce((sum, a) => sum + a.purchasePrice, 0),
    };
  }, [allAssets]);

  const categories = [...new Set(allAssets.map(a => a.category))];

  if (loading) return <LoadingSpinner message="Loading fixed assets..." />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fixed Asset Management</h1>
          <p className="text-gray-600 mt-1">Track fixed assets, depreciation, and maintenance</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            <Download size={18} />
            Export
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={18} />
            Add Asset
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-2">
            <Settings className="text-gray-500" size={20} />
            <p className="text-sm text-gray-600">Total Assets</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalAssets}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg shadow-sm border-l-4 border-green-500">
          <p className="text-sm text-gray-600">Active</p>
          <p className="text-2xl font-bold text-green-700">{stats.active}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg shadow-sm border-l-4 border-orange-500">
          <p className="text-sm text-gray-600">Disposing</p>
          <p className="text-2xl font-bold text-orange-700">{stats.disposing}</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg shadow-sm border-l-4 border-blue-500">
          <p className="text-sm text-gray-600">Net Book Value</p>
          <p className="text-2xl font-bold text-blue-700">AED {stats.totalValue.toLocaleString()}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg shadow-sm border-l-4 border-red-500">
          <div className="flex items-center gap-2">
            <TrendingDown size={16} className="text-red-600" />
            <p className="text-sm text-gray-600">Total Depreciation</p>
          </div>
          <p className="text-2xl font-bold text-red-700">AED {stats.accumulatedDepreciation.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4 flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3 py-2 border rounded-lg">
          <option value="All">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border rounded-lg">
          <option value="All">All Status</option>
          <option value="Active">Active</option>
          <option value="Disposing">Disposing</option>
          <option value="Disposed">Disposed</option>
        </select>
      </div>

      {/* Assets Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Asset</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Category</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Location</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Purchase Price</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Depreciation</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Net Book Value</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map(asset => (
                <tr key={asset.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Settings size={20} className="text-gray-500" />
                      </div>
                      <div>
                        <p className="font-medium">{asset.name}</p>
                        <p className="text-sm text-gray-500">{asset.code}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{asset.category}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-1 text-gray-600">
                      <MapPin size={14} />
                      {asset.location}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">
                    AED {asset.purchasePrice.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-red-600">
                    AED {asset.accumulatedDepreciation.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-blue-600">
                    AED {asset.currentValue.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium
                      ${asset.status === 'Active' ? 'bg-green-100 text-green-800' :
                        asset.status === 'Disposing' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'}`}>
                      {asset.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button 
                      onClick={() => setSelectedAsset(asset)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Asset Details Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">{selectedAsset.code} - {selectedAsset.name}</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-600">Category: </span>
                  <span className="font-medium">{selectedAsset.category}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Status: </span>
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium
                    ${selectedAsset.status === 'Active' ? 'bg-green-100 text-green-800' :
                      selectedAsset.status === 'Disposing' ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-100 text-gray-800'}`}>
                    {selectedAsset.status}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <MapPin size={14} />
                    Location:
                  </div>
                  <span className="font-medium ml-6">{selectedAsset.location}</span>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <Calendar size={14} />
                    Purchase Date:
                  </div>
                  <span className="font-medium ml-6">{selectedAsset.purchaseDate}</span>
                </div>
                {selectedAsset.assignedTo && (
                  <div>
                    <span className="text-sm text-gray-600">Assigned To: </span>
                    <span className="font-medium">{selectedAsset.assignedTo}</span>
                  </div>
                )}
                {selectedAsset.warrantyExpiry && (
                  <div>
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Shield size={14} />
                      Warranty Expiry:
                    </div>
                    <span className="font-medium ml-6">{selectedAsset.warrantyExpiry}</span>
                  </div>
                )}
                {selectedAsset.maintenanceDate && (
                  <div className="col-span-2">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Settings size={14} />
                      Last Maintenance:
                    </div>
                    <span className="font-medium ml-6">{selectedAsset.maintenanceDate}</span>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-3">Financial Summary</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Purchase Price</span>
                    <p className="font-bold">AED {selectedAsset.purchasePrice.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Accumulated Depreciation</span>
                    <p className="font-bold text-red-600">AED {selectedAsset.accumulatedDepreciation.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Net Book Value</span>
                    <p className="font-bold text-blue-600">AED {selectedAsset.currentValue.toLocaleString()}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Salvage Value</span>
                    <p>AED {selectedAsset.salvageValue.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Useful Life</span>
                    <p>{selectedAsset.usefulLifeYears} years ({selectedAsset.depreciationMethod})</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setSelectedAsset(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Close</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Edit</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Add Fixed Asset</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Asset Code *</label>
                  <input type="text" className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., VEH-001" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category *</label>
                  <input type="text" className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., Vehicles" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Asset Name *</label>
                <input type="text" className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., Toyota Hiace Van" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea className="w-full px-3 py-2 border rounded-lg h-20" placeholder="Description..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Purchase Price *</label>
                  <input type="number" className="w-full px-3 py-2 border rounded-lg" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Salvage Value</label>
                  <input type="number" className="w-full px-3 py-2 border rounded-lg" placeholder="0.00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Useful Life (years) *</label>
                  <input type="number" className="w-full px-3 py-2 border rounded-lg" placeholder="5" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Depreciation Method</label>
                  <select className="w-full px-3 py-2 border rounded-lg">
                    <option>Straight Line</option>
                    <option>Declining Balance</option>
                    <option>Units of Production</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Location</label>
                <input type="text" className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., Parking Lot A" />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add Asset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}