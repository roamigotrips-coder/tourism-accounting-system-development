import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingBag, Plus, Search, Filter, Download, Eye, Edit, Trash2,
  CheckCircle, Clock, XCircle, FileText, Building2, Calendar, DollarSign, X, Save
} from 'lucide-react';
import { fetchPurchaseOrders, upsertPurchaseOrder, deletePurchaseOrderDb, fetchSuppliers, type PurchaseOrder, type PurchaseOrderItem } from '../lib/supabaseSync';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';
import { showToast, catchAndReport } from '../lib/toast';
import type { Supplier } from '../data/mockData';

const supplierTypes = ['All', 'Hotel', 'Transport', 'Activity Provider', 'Tickets', 'Visa Services', 'Tour Guide'];
const VAT_RATE = 0.05;

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

const emptyLine = (): LineItem => ({
  id: `li-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  description: '',
  quantity: 1,
  unitPrice: 0,
});

export default function Purchases() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [supplierList, setSupplierList] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [supplierTypeFilter, setSupplierTypeFilter] = useState<string>('All');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [viewPO, setViewPO] = useState<PurchaseOrder | null>(null);

  // Form state
  const [formSupplier, setFormSupplier] = useState('');
  const [formSupplierType, setFormSupplierType] = useState('Hotel');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formDueDate, setFormDueDate] = useState('');
  const [formLinkedBooking, setFormLinkedBooking] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formCurrency, setFormCurrency] = useState('AED');
  const [formLines, setFormLines] = useState<LineItem[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [poData, supData] = await Promise.all([fetchPurchaseOrders(), fetchSuppliers()]);
        if (!cancelled) {
          setPurchaseOrders(poData ?? []);
          setSupplierList(supData ?? []);
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

  const resetForm = useCallback(() => {
    setFormSupplier('');
    setFormSupplierType('Hotel');
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormDueDate('');
    setFormLinkedBooking('');
    setFormNotes('');
    setFormCurrency('AED');
    setFormLines([emptyLine()]);
    setEditingPO(null);
  }, []);

  const openNew = () => { resetForm(); setShowModal(true); };

  const openEdit = (po: PurchaseOrder) => {
    setEditingPO(po);
    setFormSupplier(po.supplier);
    setFormSupplierType(po.supplierType);
    setFormDate(po.date);
    setFormDueDate(po.dueDate);
    setFormLinkedBooking(po.linkedBooking ?? '');
    setFormNotes(po.notes ?? '');
    setFormCurrency(po.currency);
    setFormLines(po.items.length > 0 ? po.items.map(i => ({
      id: i.id, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice,
    })) : [emptyLine()]);
    setShowModal(true);
  };

  // Computed totals
  const subtotal = formLines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const vat = subtotal * VAT_RATE;
  const total = subtotal + vat;

  const updateLine = (idx: number, field: keyof LineItem, value: string | number) => {
    setFormLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const removeLine = (idx: number) => {
    if (formLines.length <= 1) return;
    setFormLines(prev => prev.filter((_, i) => i !== idx));
  };

  const nextPONumber = () => {
    const nums = purchaseOrders.map(po => {
      const m = po.poNumber.match(/\d+$/);
      return m ? parseInt(m[0], 10) : 0;
    });
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `PO-${String(max + 1).padStart(4, '0')}`;
  };

  const handleSave = async (submitStatus: 'draft' | 'pending') => {
    if (!formSupplier.trim()) { showToast('Supplier is required', 'error'); return; }
    if (!formDate || !formDueDate) { showToast('Date and due date are required', 'error'); return; }
    if (formLines.every(l => !l.description.trim())) { showToast('Add at least one line item', 'error'); return; }

    setSaving(true);
    try {
      const id = editingPO?.id ?? `po-${Date.now()}`;
      const poNumber = editingPO?.poNumber ?? nextPONumber();
      const items: PurchaseOrderItem[] = formLines
        .filter(l => l.description.trim())
        .map(l => ({
          id: l.id,
          purchaseOrderId: id,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          total: l.quantity * l.unitPrice,
        }));

      const po: PurchaseOrder = {
        id,
        poNumber,
        supplier: formSupplier,
        supplierType: formSupplierType,
        date: formDate,
        dueDate: formDueDate,
        items,
        subtotal,
        vat,
        total,
        currency: formCurrency,
        status: submitStatus,
        paymentStatus: editingPO?.paymentStatus ?? 'unpaid',
        linkedBooking: formLinkedBooking || undefined,
        notes: formNotes || undefined,
      };

      await upsertPurchaseOrder(po);
      setPurchaseOrders(prev => {
        const others = prev.filter(p => p.id !== id);
        return [po, ...others];
      });
      showToast(`Purchase order ${poNumber} ${editingPO ? 'updated' : 'created'}`, 'success');
      setShowModal(false);
      resetForm();
    } catch (err: any) {
      showToast(`Save failed: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (po: PurchaseOrder) => {
    if (!confirm(`Delete ${po.poNumber}?`)) return;
    try {
      await deletePurchaseOrderDb(po.id);
      setPurchaseOrders(prev => prev.filter(p => p.id !== po.id));
      showToast(`${po.poNumber} deleted`, 'success');
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  };

  const handleStatusChange = async (po: PurchaseOrder, newStatus: PurchaseOrder['status']) => {
    const updated = { ...po, status: newStatus };
    setPurchaseOrders(prev => prev.map(p => p.id === po.id ? updated : p));
    upsertPurchaseOrder(updated).catch(catchAndReport('Update PO status'));
    showToast(`${po.poNumber} → ${newStatus}`, 'success');
  };

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

  // Stats computed from data
  const totalPurchases = purchaseOrders.reduce((sum, po) => sum + po.total, 0);
  const pendingPayments = purchaseOrders.filter(po => po.paymentStatus !== 'paid').reduce((sum, po) => sum + po.total, 0);
  const draftOrders = purchaseOrders.filter(po => po.status === 'draft').length;
  const pendingApproval = purchaseOrders.filter(po => po.status === 'pending').length;

  // Dynamic supplier type breakdown
  const supplierTypeStats = supplierTypes.slice(1).map(type => ({
    type,
    amount: purchaseOrders.filter(po => po.supplierType === type).reduce((s, po) => s + po.total, 0),
  })).filter(s => s.amount > 0);

  const typeColors: Record<string, string> = {
    Hotel: 'bg-blue-500', Transport: 'bg-amber-500', 'Activity Provider': 'bg-emerald-500',
    Tickets: 'bg-purple-500', 'Visa Services': 'bg-pink-500', 'Tour Guide': 'bg-teal-500',
  };

  const exportCSV = () => {
    const headers = ['PO Number', 'Supplier', 'Type', 'Date', 'Due Date', 'Total', 'Currency', 'Status', 'Payment'];
    const rows = filteredOrders.map(po => [po.poNumber, po.supplier, po.supplierType, po.date, po.dueDate, po.total, po.currency, po.status, po.paymentStatus]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'purchase-orders.csv'; a.click();
    URL.revokeObjectURL(url);
    showToast('Exported to CSV', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Purchase Orders</h1>
          <p className="text-slate-500 text-sm mt-1">Manage supplier purchases and procurement</p>
        </div>
        <button
          onClick={openNew}
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
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select value={supplierTypeFilter} onChange={(e) => setSupplierTypeFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
              {supplierTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
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
              {filteredOrders.length === 0 && (
                <tr><td colSpan={9} className="px-6 py-12 text-center text-slate-400 text-sm">No purchase orders found. Click "New Purchase Order" to create one.</td></tr>
              )}
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
                  <td className="px-6 py-4"><span className="text-sm text-slate-600">{po.supplierType}</span></td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar size={14} className="text-slate-400" />
                      {po.date}
                    </div>
                  </td>
                  <td className="px-6 py-4"><span className="text-sm text-slate-600">{po.dueDate}</span></td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-sm font-semibold text-slate-800">{po.currency} {po.total.toLocaleString()}</p>
                    <p className="text-xs text-slate-400">VAT: {po.vat.toLocaleString()}</p>
                  </td>
                  <td className="px-6 py-4 text-center">{getStatusBadge(po.status)}</td>
                  <td className="px-6 py-4 text-center">{getPaymentBadge(po.paymentStatus)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setViewPO(po)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View">
                        <Eye size={16} />
                      </button>
                      <button onClick={() => openEdit(po)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Edit">
                        <Edit size={16} />
                      </button>
                      {po.status === 'draft' && (
                        <button onClick={() => handleStatusChange(po, 'pending')} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Submit for Approval">
                          <Clock size={16} />
                        </button>
                      )}
                      {po.status === 'pending' && (
                        <button onClick={() => handleStatusChange(po, 'approved')} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Approve">
                          <CheckCircle size={16} />
                        </button>
                      )}
                      {po.status === 'approved' && (
                        <button onClick={() => handleStatusChange(po, 'received')} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Mark Received">
                          <CheckCircle size={16} />
                        </button>
                      )}
                      <button onClick={() => handleDelete(po)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
          <p className="text-sm text-slate-500">Showing {filteredOrders.length} of {purchaseOrders.length} purchase orders</p>
        </div>
      </div>

      {/* Purchase by Supplier Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Purchase by Supplier Type</h3>
          <div className="space-y-3">
            {supplierTypeStats.length === 0 && <p className="text-sm text-slate-400">No data yet</p>}
            {supplierTypeStats.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${typeColors[item.type] || 'bg-slate-400'}`}></div>
                <span className="flex-1 text-sm text-slate-600">{item.type}</span>
                <span className="text-sm font-medium text-slate-800">AED {item.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Recent Purchase Activity</h3>
          <div className="space-y-4">
            {purchaseOrders.length === 0 && <p className="text-sm text-slate-400">No purchase orders yet</p>}
            {purchaseOrders.slice(0, 4).map((po) => (
              <div key={po.id} className="flex items-start gap-3 pb-3 border-b border-slate-100 last:border-0">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <ShoppingBag size={16} className="text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{po.supplier}</p>
                  <p className="text-xs text-slate-400">{po.poNumber} &bull; {po.date}</p>
                </div>
                <span className="text-sm font-semibold text-slate-800">{po.currency} {po.total.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── View PO Modal ── */}
      {viewPO && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewPO(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">{viewPO.poNumber}</h2>
                <p className="text-sm text-slate-500 mt-1">{viewPO.supplier} &bull; {viewPO.supplierType}</p>
              </div>
              <button onClick={() => setViewPO(null)} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-slate-500">Date:</span> <span className="ml-2 font-medium">{viewPO.date}</span></div>
                <div><span className="text-slate-500">Due:</span> <span className="ml-2 font-medium">{viewPO.dueDate}</span></div>
                <div><span className="text-slate-500">Status:</span> <span className="ml-2">{getStatusBadge(viewPO.status)}</span></div>
                <div><span className="text-slate-500">Payment:</span> <span className="ml-2">{getPaymentBadge(viewPO.paymentStatus)}</span></div>
                {viewPO.linkedBooking && <div className="col-span-2"><span className="text-slate-500">Linked Booking:</span> <span className="ml-2 font-medium">{viewPO.linkedBooking}</span></div>}
              </div>
              {viewPO.items.length > 0 && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Description</th>
                        <th className="text-center px-4 py-2 text-xs font-medium text-slate-500 w-16">Qty</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 w-28">Unit Price</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 w-28">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewPO.items.map(item => (
                        <tr key={item.id}>
                          <td className="px-4 py-2 text-slate-700">{item.description}</td>
                          <td className="px-4 py-2 text-center text-slate-600">{item.quantity}</td>
                          <td className="px-4 py-2 text-right text-slate-600">{item.unitPrice.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right font-medium">{item.total.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-600">Subtotal</span><span>{viewPO.currency} {viewPO.subtotal.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">VAT (5%)</span><span>{viewPO.currency} {viewPO.vat.toLocaleString()}</span></div>
                <div className="flex justify-between font-bold pt-2 border-t border-slate-200"><span>Total</span><span className="text-emerald-600">{viewPO.currency} {viewPO.total.toLocaleString()}</span></div>
              </div>
              {viewPO.notes && <div className="text-sm"><span className="text-slate-500">Notes:</span> <span className="text-slate-700 ml-1">{viewPO.notes}</span></div>}
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit PO Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">{editingPO ? `Edit ${editingPO.poNumber}` : 'Create Purchase Order'}</h2>
                <p className="text-sm text-slate-500 mt-1">{editingPO ? 'Update purchase order details' : 'Create a new purchase order for supplier services'}</p>
              </div>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Supplier *</label>
                  {supplierList.length > 0 ? (
                    <select value={formSupplier} onChange={e => setFormSupplier(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                      <option value="">Select Supplier</option>
                      {supplierList.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  ) : (
                    <input type="text" placeholder="Supplier name" value={formSupplier} onChange={e => setFormSupplier(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Supplier Type</label>
                  <select value={formSupplierType} onChange={e => setFormSupplierType(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                    {supplierTypes.slice(1).map(type => <option key={type}>{type}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">PO Date *</label>
                  <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Due Date *</label>
                  <input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Linked Booking (Optional)</label>
                <input type="text" placeholder="e.g., BK-2024-0156" value={formLinkedBooking} onChange={e => setFormLinkedBooking(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
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
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formLines.map((line, idx) => (
                        <tr key={line.id} className="border-t border-slate-100">
                          <td className="px-4 py-2">
                            <input type="text" placeholder="Item description" value={line.description}
                              onChange={e => updateLine(idx, 'description', e.target.value)}
                              className="w-full border border-slate-200 rounded px-2 py-1 text-sm" />
                          </td>
                          <td className="px-4 py-2">
                            <input type="number" min={1} value={line.quantity}
                              onChange={e => updateLine(idx, 'quantity', Math.max(1, Number(e.target.value)))}
                              className="w-full border border-slate-200 rounded px-2 py-1 text-sm text-center" />
                          </td>
                          <td className="px-4 py-2">
                            <input type="number" min={0} step={0.01} value={line.unitPrice || ''}
                              onChange={e => updateLine(idx, 'unitPrice', Number(e.target.value))}
                              placeholder="0.00"
                              className="w-full border border-slate-200 rounded px-2 py-1 text-sm text-right" />
                          </td>
                          <td className="px-4 py-2 text-right text-sm text-slate-600 font-medium">
                            {formCurrency} {(line.quantity * line.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-2 py-2">
                            {formLines.length > 1 && (
                              <button onClick={() => removeLine(idx)} className="p-1 text-slate-400 hover:text-red-500 rounded"><Trash2 size={14} /></button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={() => setFormLines(prev => [...prev, emptyLine()])}
                  className="mt-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                  + Add Line Item
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea rows={3} placeholder="Additional notes..." value={formNotes} onChange={e => setFormNotes(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
              </div>

              {/* Totals */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="text-slate-800">{formCurrency} {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">VAT (5%)</span>
                  <span className="text-slate-800">{formCurrency} {vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-200">
                  <span className="text-slate-800">Total</span>
                  <span className="text-emerald-600">{formCurrency} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3">
              <button onClick={() => { setShowModal(false); resetForm(); }}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={() => handleSave('draft')} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-300 disabled:opacity-50">
                <Save size={14} /> Save as Draft
              </button>
              <button onClick={() => handleSave('pending')} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600 disabled:opacity-50">
                <CheckCircle size={14} /> {editingPO ? 'Update & Submit' : 'Create & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
