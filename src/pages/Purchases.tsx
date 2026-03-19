import { useState, useEffect } from 'react';
import {
  ShoppingBag, Plus, Search, Filter, Download, Eye, Edit, Trash2,
  CheckCircle, Clock, XCircle, FileText, Building2, Calendar, DollarSign
} from 'lucide-react';
import { fetchPurchaseOrders, type PurchaseOrder } from '../lib/supabaseSync';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';

const supplierTypes = ['All', 'Hotel', 'Transport', 'Activity Provider', 'Tickets', 'Visa Services', 'Tour Guide'];

export default function Purchases() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [supplierTypeFilter, setSupplierTypeFilter] = useState<string>('All');
  const [showNewPO, setShowNewPO] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchPurchaseOrders();
        if (!cancelled) {
          setPurchaseOrders(data ?? []);
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message ?? 'Failed to load purchase orders');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;

  const filteredOrders = purchaseOrders.filter(po => {
    const matchesSearch = po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         po.supplier.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || po.status === statusFilter;
    const matchesType = supplierTypeFilter === 'All' || po.supplierType === supplierTypeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusBadge = (status: PurchaseOrder['status']) => {
    const styles = {
      draft: 'bg-slate-100 text-slate-600',
      pending: 'bg-amber-100 text-amber-700',
      approved: 'bg-blue-100 text-blue-700',
      received: 'bg-emerald-100 text-emerald-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    const icons = {
      draft: <FileText size={12} />,
      pending: <Clock size={12} />,
      approved: <CheckCircle size={12} />,
      received: <CheckCircle size={12} />,
      cancelled: <XCircle size={12} />,
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getPaymentBadge = (status: PurchaseOrder['paymentStatus']) => {
    const styles = {
      unpaid: 'bg-red-100 text-red-700',
      partial: 'bg-amber-100 text-amber-700',
      paid: 'bg-emerald-100 text-emerald-700',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Stats
  const totalPurchases = purchaseOrders.reduce((sum, po) => sum + po.total, 0);
  const pendingPayments = purchaseOrders.filter(po => po.paymentStatus !== 'paid').reduce((sum, po) => sum + po.total, 0);
  const draftOrders = purchaseOrders.filter(po => po.status === 'draft').length;
  const pendingApproval = purchaseOrders.filter(po => po.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Purchase Orders</h1>
          <p className="text-slate-500 text-sm mt-1">Manage supplier purchases and procurement</p>
        </div>
        <button 
          onClick={() => setShowNewPO(true)}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={18} />
          New Purchase Order
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Total Purchases</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">AED {totalPurchases.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <ShoppingBag className="text-blue-500" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Pending Payments</p>
              <p className="text-2xl font-bold text-red-600 mt-1">AED {pendingPayments.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
              <DollarSign className="text-red-500" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Draft Orders</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{draftOrders}</p>
            </div>
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
              <FileText className="text-slate-500" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Pending Approval</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{pendingApproval}</p>
            </div>
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
              <Clock className="text-amber-500" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search PO number or supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={18} className="text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              value={supplierTypeFilter}
              onChange={(e) => setSupplierTypeFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              {supplierTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Purchase Orders Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">PO Number</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Supplier</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Due Date</th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                <th className="text-center px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-center px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Payment</th>
                <th className="text-center px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.map((po) => (
                <tr key={po.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-emerald-600">{po.poNumber}</p>
                      {po.linkedBooking && (
                        <p className="text-xs text-slate-400 mt-0.5">Linked: {po.linkedBooking}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                        <Building2 size={16} className="text-slate-500" />
                      </div>
                      <span className="text-sm text-slate-700">{po.supplier}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">{po.supplierType}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar size={14} className="text-slate-400" />
                      {new Date(po.date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">
                      {new Date(po.dueDate).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-sm font-semibold text-slate-800">{po.currency} {po.total.toLocaleString()}</p>
                    <p className="text-xs text-slate-400">VAT: {po.vat.toLocaleString()}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {getStatusBadge(po.status)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {getPaymentBadge(po.paymentStatus)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-1">
                      <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View">
                        <Eye size={16} />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Edit">
                        <Edit size={16} />
                      </button>
                      {(po.status === 'approved' || po.status === 'received') && (
                        <button className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors" title="Convert to Bill">
                          <FileText size={16} />
                        </button>
                      )}
                      <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
          <p className="text-sm text-slate-500">Showing {filteredOrders.length} of {purchaseOrders.length} purchase orders</p>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 border border-slate-200 rounded text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50" disabled>
              Previous
            </button>
            <button className="px-3 py-1 bg-emerald-500 text-white rounded text-sm">1</button>
            <button className="px-3 py-1 border border-slate-200 rounded text-sm text-slate-600 hover:bg-slate-50">
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Purchase by Supplier Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Purchase by Supplier Type</h3>
          <div className="space-y-3">
            {[
              { type: 'Hotel', amount: 1995, color: 'bg-blue-500' },
              { type: 'Activity Provider', amount: 7665, color: 'bg-emerald-500' },
              { type: 'Transport', amount: 3675, color: 'bg-amber-500' },
              { type: 'Tickets', amount: 1694.7, color: 'bg-purple-500' },
              { type: 'Visa Services', amount: 1890, color: 'bg-pink-500' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                <span className="flex-1 text-sm text-slate-600">{item.type}</span>
                <span className="text-sm font-medium text-slate-800">AED {item.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Recent Purchase Activity</h3>
          <div className="space-y-4">
            {purchaseOrders.slice(0, 4).map((po) => (
              <div key={po.id} className="flex items-start gap-3 pb-3 border-b border-slate-100 last:border-0">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <ShoppingBag size={16} className="text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{po.supplier}</p>
                  <p className="text-xs text-slate-400">{po.poNumber} • {new Date(po.date).toLocaleDateString()}</p>
                </div>
                <span className="text-sm font-semibold text-slate-800">{po.currency} {po.total.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* New PO Modal */}
      {showNewPO && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Create Purchase Order</h2>
              <p className="text-sm text-slate-500 mt-1">Create a new purchase order for supplier services</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
                  <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                    <option>Select Supplier</option>
                    <option>Desert Safari Adventures</option>
                    <option>Luxury Hotels Group</option>
                    <option>Gulf Transport Co.</option>
                    <option>Emirates Tickets LLC</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Supplier Type</label>
                  <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                    {supplierTypes.slice(1).map(type => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">PO Date</label>
                  <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                  <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Linked Booking (Optional)</label>
                <input type="text" placeholder="e.g., BK-2024-0156" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
              </div>
              
              {/* Line Items */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Line Items</label>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Description</th>
                        <th className="text-center px-4 py-2 text-xs font-medium text-slate-500 w-20">Qty</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 w-28">Unit Price</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 w-28">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-4 py-2">
                          <input type="text" placeholder="Item description" className="w-full border border-slate-200 rounded px-2 py-1 text-sm" />
                        </td>
                        <td className="px-4 py-2">
                          <input type="number" placeholder="1" className="w-full border border-slate-200 rounded px-2 py-1 text-sm text-center" />
                        </td>
                        <td className="px-4 py-2">
                          <input type="number" placeholder="0.00" className="w-full border border-slate-200 rounded px-2 py-1 text-sm text-right" />
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-slate-600">AED 0.00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <button className="mt-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                  + Add Line Item
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea rows={3} placeholder="Additional notes..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"></textarea>
              </div>

              {/* Totals */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="text-slate-800">AED 0.00</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">VAT (5%)</span>
                  <span className="text-slate-800">AED 0.00</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-200">
                  <span className="text-slate-800">Total</span>
                  <span className="text-emerald-600">AED 0.00</span>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3">
              <button 
                onClick={() => setShowNewPO(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-300">
                Save as Draft
              </button>
              <button className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600">
                Create & Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
