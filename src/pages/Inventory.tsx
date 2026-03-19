import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Download, AlertTriangle, Package } from 'lucide-react';
import { fetchInventoryItems, upsertInventoryItem, type InventoryItem } from '../lib/supabaseSync';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';
import { showToast, catchAndReport } from '../lib/toast';

export default function Inventory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [txnItemId, setTxnItemId] = useState<string | null>(null);

  const emptyItemForm = { code: '', name: '', category: '', unit: '', quantity: '0', unitCost: '0', minStockLevel: '0', maxStockLevel: '0', location: '' };
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const uf = (f: string, v: string) => setItemForm(p => ({ ...p, [f]: v }));

  const emptyTxnForm = { type: 'Stock In', quantity: '0', reference: '', notes: '' };
  const [txnForm, setTxnForm] = useState(emptyTxnForm);
  const tf = (f: string, v: string) => setTxnForm(p => ({ ...p, [f]: v }));

  const computeStatus = (qty: number, min: number): string =>
    qty <= 0 ? 'Out of Stock' : qty <= min ? 'Low Stock' : 'In Stock';

  const handleAddItem = () => {
    if (!itemForm.code || !itemForm.name) { showToast('Code and Name are required', 'error'); return; }
    const qty = parseInt(itemForm.quantity) || 0;
    const min = parseInt(itemForm.minStockLevel) || 0;
    const item: InventoryItem = {
      id: crypto.randomUUID(), code: itemForm.code, name: itemForm.name,
      category: itemForm.category || 'General', description: '', unit: itemForm.unit || 'pcs',
      quantity: qty, unitCost: parseFloat(itemForm.unitCost) || 0,
      minStockLevel: min, maxStockLevel: parseInt(itemForm.maxStockLevel) || 0,
      location: itemForm.location, status: computeStatus(qty, min), supplier: '',
    };
    setAllItems(prev => [item, ...prev]);
    setShowAddModal(false);
    setItemForm(emptyItemForm);
    showToast(`Item ${item.code} added`, 'success');
    upsertInventoryItem(item).catch(catchAndReport('Save inventory item'));
  };

  const handleTransaction = () => {
    if (!txnItemId) return;
    const adjQty = parseInt(txnForm.quantity) || 0;
    if (adjQty <= 0) { showToast('Enter a valid quantity', 'error'); return; }
    setAllItems(prev => prev.map(item => {
      if (item.id !== txnItemId) return item;
      let newQty = item.quantity;
      if (txnForm.type === 'Stock In') newQty += adjQty;
      else if (txnForm.type === 'Stock Out') newQty = Math.max(0, newQty - adjQty);
      else newQty = adjQty; // Adjustment = set to value
      const updated = { ...item, quantity: newQty, status: computeStatus(newQty, item.minStockLevel) };
      upsertInventoryItem(updated).catch(catchAndReport('Update inventory'));
      return updated;
    }));
    showToast(`${txnForm.type}: ${adjQty} units recorded`, 'success');
    setShowTransactionModal(false);
    setTxnForm(emptyTxnForm);
    setTxnItemId(null);
  };

  const [allItems, setAllItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchInventoryItems();
        if (!cancelled) {
          setAllItems(data ?? []);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? 'Failed to load inventory items');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredItems = useMemo(() => {
    return allItems.map(item => ({
      ...item,
      totalValue: item.quantity * item.unitCost
    })).filter(item => {
      const matchesSearch = 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [allItems, searchTerm, categoryFilter, statusFilter]);

  const stats = useMemo(() => {
    return {
      totalItems: allItems.length,
      inStock: allItems.filter(i => i.status === 'In Stock').length,
      lowStock: allItems.filter(i => i.status === 'Low Stock').length,
      outOfStock: allItems.filter(i => i.status === 'Out of Stock').length,
      totalValue: allItems.reduce((sum, i) => sum + (i.quantity * i.unitCost), 0),
    };
  }, [allItems]);

  const categories = [...new Set(allItems.map(i => i.category))];

  if (loading) return <LoadingSpinner message="Loading inventory items..." />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-600 mt-1">Track and manage all inventory items</p>
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
            Add Item
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <p className="text-sm text-gray-600">Total Items</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalItems}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg shadow-sm border-l-4 border-green-500">
          <p className="text-sm text-gray-600">In Stock</p>
          <p className="text-2xl font-bold text-green-700">{stats.inStock}</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg shadow-sm border-l-4 border-yellow-500">
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-600">Low Stock</p>
            {stats.lowStock > 0 && <AlertTriangle size={16} className="text-yellow-600" />}
          </div>
          <p className="text-2xl font-bold text-yellow-700">{stats.lowStock}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg shadow-sm border-l-4 border-red-500">
          <p className="text-sm text-gray-600">Out of Stock</p>
          <p className="text-2xl font-bold text-red-700">{stats.outOfStock}</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg shadow-sm border-l-4 border-blue-500">
          <p className="text-sm text-gray-600">Total Value</p>
          <p className="text-2xl font-bold text-blue-700">AED {stats.totalValue.toLocaleString()}</p>
        </div>
      </div>

      {/* Low Stock Warning */}
      {stats.lowStock > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle size={20} className="text-yellow-600" />
          <p className="text-sm text-yellow-800">
            <strong>{stats.lowStock} items</strong> are running low on stock. Review inventory levels and reorder if needed.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4 flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search items..."
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
          <option value="In Stock">In Stock</option>
          <option value="Low Stock">Low Stock</option>
          <option value="Out of Stock">Out of Stock</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Item</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Category</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Quantity</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Level</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Unit Cost</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Total Value</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Location</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Package size={20} className="text-gray-500" />
                      </div>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-500">{item.code}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.category}</td>
                  <td className="px-4 py-3 text-center font-mono font-medium">{item.quantity.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-500">
                    {item.minStockLevel} - {item.maxStockLevel}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">AED {item.unitCost.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-blue-600">AED {item.totalValue.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.location}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium
                      ${item.status === 'In Stock' ? 'bg-green-100 text-green-800' :
                        item.status === 'Low Stock' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => { setTxnItemId(item.id); setShowTransactionModal(true); }}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Adjust
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Add Inventory Item</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Item Code *</label>
                <input type="text" value={itemForm.code} onChange={e => uf('code', e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., ITM001" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Item Name *</label>
                <input type="text" value={itemForm.name} onChange={e => uf('name', e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., Tour Brochures" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Category *</label>
                  <input type="text" value={itemForm.category} onChange={e => uf('category', e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., Marketing" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Unit *</label>
                  <input type="text" value={itemForm.unit} onChange={e => uf('unit', e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., pcs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Quantity *</label>
                  <input type="number" value={itemForm.quantity} onChange={e => uf('quantity', e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Unit Cost *</label>
                  <input type="number" step="0.01" value={itemForm.unitCost} onChange={e => uf('unitCost', e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="0.00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Min Stock Level</label>
                  <input type="number" value={itemForm.minStockLevel} onChange={e => uf('minStockLevel', e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Max Stock Level</label>
                  <input type="number" value={itemForm.maxStockLevel} onChange={e => uf('maxStockLevel', e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="0" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Location</label>
                <input type="text" value={itemForm.location} onChange={e => uf('location', e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., Office - Shelf A" />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => { setShowAddModal(false); setItemForm(emptyItemForm); }} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleAddItem} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add Item</button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {showTransactionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Inventory Transaction</h2>
            </div>
            <div className="p-6 space-y-4">
              {txnItemId && <p className="text-sm text-gray-500">Item: <strong>{allItems.find(i => i.id === txnItemId)?.name}</strong></p>}
              <div>
                <label className="block text-sm font-medium mb-1">Transaction Type *</label>
                <select value={txnForm.type} onChange={e => tf('type', e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                  <option>Stock In</option>
                  <option>Stock Out</option>
                  <option>Adjustment</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Quantity *</label>
                <input type="number" value={txnForm.quantity} onChange={e => tf('quantity', e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reference</label>
                <input type="text" value={txnForm.reference} onChange={e => tf('reference', e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Optional" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea value={txnForm.notes} onChange={e => tf('notes', e.target.value)} className="w-full px-3 py-2 border rounded-lg h-20" placeholder="Notes..." />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => { setShowTransactionModal(false); setTxnForm(emptyTxnForm); setTxnItemId(null); }} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleTransaction} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Record</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}