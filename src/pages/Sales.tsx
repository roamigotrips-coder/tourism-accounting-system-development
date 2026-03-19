import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Search, X, Upload, FileSpreadsheet, FileText,
  CheckCircle, AlertCircle, Download, Eye, Trash2, ChevronDown,
  Package, Hotel, Car, Ticket, Compass, UserCheck, TrendingUp, TrendingDown, Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Booking } from '../data/mockData';
import { upsertEstimate as upsertEstimateDb, fetchAgents } from '../lib/supabaseSync';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';
import RecordPaymentModal, { type RecordPaymentConfig, type PaymentRecord } from '../components/RecordPaymentModal';
import { useBookingEstimates, type BookingEstimate } from '../context/BookingEstimateContext';
import { useAuditTrail } from '../context/AuditTrailContext';
import { showToast, catchAndReport } from '../lib/toast';
import { useCurrency } from '../context/CurrencyContext';


const serviceTypes = ['All', 'Tour Package', 'Transfer', 'Hotel Booking', 'Visa Services', 'Tickets', 'Activities'];
const paymentStatuses = ['Pending', 'Paid', 'Partial'];
// currencies loaded from CurrencyContext inside component
// agentsList loaded from DB below

interface CostingItem {
  label: string;
  key: string;
  icon: React.ReactNode;
  placeholder: string;
  required: boolean;
}

interface PackageCosting {
  hotel: string;
  transfer: string;
  tickets: string;
  activities: string;
  guide: string;
  visa: string;
  other: string;
  costingFile: File | null;
  costingFileName: string;
  notes: string;
}

interface BookingForm {
  agent: string;
  customer: string;
  serviceType: string;
  serviceDate: string;
  checkIn: string;
  checkOut: string;
  sellingPrice: string;
  currency: string;
  paymentStatus: string;
  paymentReceived: string;
  paymentMade: string;
  notes: string;
  costing: PackageCosting;
}

interface UploadedRow {
  agent: string;
  customer: string;
  serviceType: string;
  serviceDate: string;
  sellingPrice: number;
  currency: string;
  paymentStatus: string;
  valid: boolean;
  error?: string;
}

const emptyCostingForm: PackageCosting = {
  hotel: '',
  transfer: '',
  tickets: '',
  activities: '',
  guide: '',
  visa: '',
  other: '',
  costingFile: null,
  costingFileName: '',
  notes: '',
};

const emptyForm: BookingForm = {
  agent: '',
  customer: '',
  serviceType: 'Tour Package',
  serviceDate: '',
  checkIn: '',
  checkOut: '',
  sellingPrice: '',
  currency: 'AED',
  paymentStatus: 'Pending',
  paymentReceived: '',
  paymentMade: '',
  notes: '',
  costing: emptyCostingForm,
};

const statusColor = (s: string) =>
  s === 'Paid' ? 'bg-emerald-50 text-emerald-700' :
  s === 'Pending' ? 'bg-amber-50 text-amber-700' :
  'bg-blue-50 text-blue-700';

const costingItems: CostingItem[] = [
  { label: 'Hotel Cost', key: 'hotel', icon: <Hotel size={15} />, placeholder: '0.00', required: true },
  { label: 'Transfer Cost', key: 'transfer', icon: <Car size={15} />, placeholder: '0.00', required: true },
  { label: 'Tickets / Entrance', key: 'tickets', icon: <Ticket size={15} />, placeholder: '0.00', required: false },
  { label: 'Activities', key: 'activities', icon: <Compass size={15} />, placeholder: '0.00', required: false },
  { label: 'Tour Guide', key: 'guide', icon: <UserCheck size={15} />, placeholder: '0.00', required: false },
  { label: 'Visa / Documentation', key: 'visa', icon: <FileText size={15} />, placeholder: '0.00', required: false },
  { label: 'Other Costs', key: 'other', icon: <Package size={15} />, placeholder: '0.00', required: false },
];

function calcCosting(form: BookingForm) {
  const selling = parseFloat(form.sellingPrice) || 0;
  const vat = selling * 0.05;
  const totalRevenue = selling + vat;

  const hotel = parseFloat(form.costing.hotel) || 0;
  const transfer = parseFloat(form.costing.transfer) || 0;
  const tickets = parseFloat(form.costing.tickets) || 0;
  const activities = parseFloat(form.costing.activities) || 0;
  const guide = parseFloat(form.costing.guide) || 0;
  const visa = parseFloat(form.costing.visa) || 0;
  const other = parseFloat(form.costing.other) || 0;
  const totalCost = hotel + transfer + tickets + activities + guide + visa + other;
  const profit = selling - totalCost;
  const margin = selling > 0 ? (profit / selling) * 100 : 0;

  return { selling, vat, totalRevenue, totalCost, profit, margin };
}

function isCostingValid(form: BookingForm): { valid: boolean; errors: string[] } {
  if (form.serviceType !== 'Tour Package') return { valid: true, errors: [] };
  const errors: string[] = [];
  if (!form.costing.hotel) errors.push('Hotel cost is required');
  if (!form.costing.transfer) errors.push('Transfer cost is required');
  const hasCostFile = !!form.costing.costingFileName;
  const hasAnyCost = costingItems.some(c => form.costing[c.key as keyof PackageCosting]);
  if (!hasCostFile && !hasAnyCost) {
    errors.push('Please enter costs or upload a costing file');
  }
  return { valid: errors.length === 0, errors };
}

import { useAutomation } from '../context/AutomationContext';

export default function Sales() {
  const { addEstimate, estimates, loading, error } = useBookingEstimates();
  const { publish } = useAutomation();
  const { logAction } = useAuditTrail();
  const { currencies: allCurrencies } = useCurrency();
  const currencies = allCurrencies.filter(c => c.enabled).map(c => c.code);
  const [sentToFinance, setSentToFinance] = useState(false);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'manual' | 'upload'>('manual');
  const [form, setForm] = useState<BookingForm>(emptyForm);
  const [bookingList, setBookingList] = useState<Booking[]>([]);
  const [viewBooking, setViewBooking] = useState<Booking | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<RecordPaymentConfig | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<Record<string, PaymentRecord[]>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [costingExpanded, setCostingExpanded] = useState(true);
  const [agentsList, setAgentsList] = useState<string[]>([]);

  // Load agents from DB
  useEffect(() => {
    fetchAgents()
      .then(agents => setAgentsList(agents.filter(a => a.status === 'Active').map(a => a.name)))
      .catch(catchAndReport('Load agents'));
  }, []);

  // Upload states
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedRows, setUploadedRows] = useState<UploadedRow[]>([]);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'parsing' | 'preview' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // Derive bookingList from context estimates (loaded from Supabase)
  useEffect(() => {
    if (!loading && estimates.length > 0) {
      const mapped: Booking[] = estimates.map(est => ({
        id: est.bookingRef,
        agent: est.agent,
        customer: est.customer,
        serviceType: est.serviceType,
        serviceDate: est.serviceDate,
        sellingPrice: est.sellingPrice,
        vat: est.vat,
        currency: est.currency,
        paymentStatus: (est.paymentStatus as 'Paid' | 'Pending' | 'Partial') || 'Pending',
      }));
      setBookingList(mapped);
    }
  }, [estimates, loading]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const costingFileRef = useRef<HTMLInputElement>(null);

  // Costing file drag state
  const [costingDragOver, setCostingDragOver] = useState(false);

  const filtered = bookingList.filter(b =>
    (filter === 'All' || b.serviceType === filter) &&
    (b.id.toLowerCase().includes(search.toLowerCase()) ||
      b.customer.toLowerCase().includes(search.toLowerCase()) ||
      b.agent.toLowerCase().includes(search.toLowerCase()))
  );

  const totalRevenue = filtered.reduce((s, b) => s + b.sellingPrice, 0);
  const totalVAT = filtered.reduce((s, b) => s + b.vat, 0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'serviceType') {
      setForm(prev => ({ ...prev, serviceType: value, costing: emptyCostingForm }));
      setCostingExpanded(true);
      setSubmitAttempted(false);
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCostingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, costing: { ...prev.costing, [name]: value } }));
  };

  const handleCostingFile = useCallback((file: File) => {
    const allowed = ['xlsx', 'xls', 'csv', 'pdf'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!allowed.includes(ext)) {
      alert('Please upload Excel (.xlsx, .xls, .csv) or PDF file');
      return;
    }
    setForm(prev => ({ ...prev, costing: { ...prev.costing, costingFile: file, costingFileName: file.name } }));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);

    // Validate costing for Tour Package
    const { valid } = isCostingValid(form);
    if (!valid) {
      setCostingExpanded(true);
      return;
    }

    const price = parseFloat(form.sellingPrice) || 0;
    const vat = price * 0.05;
    const total = price + vat;
    const estId = `EST-${String(Date.now()).slice(-6)}`;
    const bookingRef = `BK-2024-${String(bookingList.length + 1).padStart(4, '0')}`;

    // Build costing if tour package
    let costing: BookingEstimate['costing'] | undefined;
    if (form.serviceType === 'Tour Package') {
      const hotel = parseFloat(form.costing.hotel) || 0;
      const transfer = parseFloat(form.costing.transfer) || 0;
      const tickets = parseFloat(form.costing.tickets) || 0;
      const activities = parseFloat(form.costing.activities) || 0;
      const guide = parseFloat(form.costing.guide) || 0;
      const visa = parseFloat(form.costing.visa) || 0;
      const other = parseFloat(form.costing.other) || 0;
      const totalCost = hotel + transfer + tickets + activities + guide + visa + other;
      const profit = price - totalCost;
      const margin = price > 0 ? (profit / price) * 100 : 0;
      costing = {
        hotel, transfer, tickets, activities, guide, visa, other,
        notes: form.costing.notes,
        totalCost, profit, margin,
        costingFile: form.costing.costingFileName || undefined,
      };
    }

    // Create estimate and send to finance
    const estimate: BookingEstimate = {
      id: estId,
      bookingRef,
      agent: form.agent,
      customer: form.customer,
      serviceType: form.serviceType,
      serviceDate: form.serviceDate,
      checkIn: form.checkIn || undefined,
      checkOut: form.checkOut || undefined,
      sellingPrice: price,
      vat,
      total,
      currency: form.currency,
      paymentStatus: form.paymentStatus,
      paymentReceived: parseFloat(form.paymentReceived) || 0,
      paymentMade: parseFloat(form.paymentMade) || 0,
      notes: form.notes || '',
      submittedAt: new Date().toISOString(),
      submittedBy: 'Sales Team',
      status: 'Pending Approval',
      isTourPackage: form.serviceType === 'Tour Package',
      costing,
    };
    addEstimate(estimate);

    // Audit log
    logAction({
      action: 'SUBMIT',
      module: 'Sales & Booking Estimate',
      entityId: estId,
      entityType: 'BookingEstimate',
      entityLabel: `Booking Estimate ${estId}`,
      description: `Submitted booking estimate for ${form.customer} (${form.serviceType}) — AED ${total.toFixed(2)} to Finance for approval`,
      newValues: { id: estId, agent: form.agent, customer: form.customer, serviceType: form.serviceType, amount: total, status: 'Pending Approval' },
      tags: ['booking', 'estimate', 'finance'],
      severity: total > 10000 ? 'warning' : 'info',
    });

    // Automation: fire event for workflows
    try {
      // @ts-ignore - publish injected via provider
      publish?.({ type: 'ESTIMATE_SUBMITTED', payload: { id: estId, amount: total, serviceType: form.serviceType, agent: form.agent, customer: form.customer } });
    } catch {}

    // Also add to local booking list with Pending Approval status
    const newBooking = {
      id: bookingRef,
      agent: form.agent,
      customer: form.customer,
      serviceType: form.serviceType,
      serviceDate: form.serviceDate,
      sellingPrice: price,
      vat,
      currency: form.currency,
      paymentStatus: 'Pending' as const,
    };
    setBookingList(prev => [newBooking, ...prev] as typeof prev);

    // Show success state then close
    setSentToFinance(true);
    setTimeout(() => {
      setSentToFinance(false);
      setForm(emptyForm);
      setShowModal(false);
      setSubmitAttempted(false);
    }, 2200);
  };

  // ── File parsing ──────────────────────────────────────────────────
  const parseExcel = (file: File) => {
    setUploadStatus('parsing');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (rows.length === 0) {
          setUploadError('The file is empty or has no data rows.');
          setUploadStatus('error');
          return;
        }

        const parsed: UploadedRow[] = rows.map((row) => {
          const agent = String(row['Agent'] || row['agent'] || '').trim();
          const customer = String(row['Customer'] || row['customer'] || row['Customer Name'] || '').trim();
          const serviceType = String(row['Service Type'] || row['serviceType'] || 'Tour Package').trim();
          const serviceDate = String(row['Service Date'] || row['serviceDate'] || row['Date'] || '').trim();
          const sellingPrice = parseFloat(String(row['Selling Price'] || row['sellingPrice'] || row['Price'] || '0'));
          const currency = String(row['Currency'] || row['currency'] || 'AED').trim();
          const paymentStatus = String(row['Payment Status'] || row['paymentStatus'] || row['Status'] || 'Pending').trim();

          const errors: string[] = [];
          if (!agent) errors.push('Agent required');
          if (!customer) errors.push('Customer required');
          if (!serviceDate) errors.push('Date required');
          if (isNaN(sellingPrice) || sellingPrice <= 0) errors.push('Valid price required');

          return {
            agent, customer, serviceType, serviceDate,
            sellingPrice: isNaN(sellingPrice) ? 0 : sellingPrice,
            currency: currency || 'AED',
            paymentStatus: paymentStatus || 'Pending',
            valid: errors.length === 0,
            error: errors.join(', '),
          };
        });

        setUploadedRows(parsed);
        setSelectedRows(new Set(parsed.map((_, i) => i).filter(i => parsed[i].valid)));
        setUploadStatus('preview');
      } catch {
        setUploadError('Failed to parse the file. Please check the format.');
        setUploadStatus('error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const parsePDF = (_file: File) => {
    setUploadError('PDF import is not supported yet. Please convert the PDF to Excel (.xlsx) or CSV and try again.');
    setUploadStatus('error');
  };

  const handleFile = useCallback((file: File) => {
    setUploadedFile(file);
    setUploadError('');
    setUploadedRows([]);
    setSelectedRows(new Set());

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
      parseExcel(file);
    } else if (ext === 'pdf') {
      parsePDF(file);
    } else {
      setUploadError('Unsupported file type. Please upload Excel (.xlsx, .xls, .csv) or PDF.');
      setUploadStatus('error');
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const toggleRow = (i: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const toggleAll = () => {
    const validIndices = uploadedRows.map((_, i) => i).filter(i => uploadedRows[i].valid);
    if (selectedRows.size === validIndices.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(validIndices));
    }
  };

  const handleImport = () => {
    const toImport = uploadedRows.filter((_, i) => selectedRows.has(i));
    const newBookings: Booking[] = [];

    toImport.forEach((row, idx) => {
      const bookingRef = `BK-2024-${String(bookingList.length + idx + 1).padStart(4, '0')}`;
      const estId = `EST-IMP-${Date.now()}-${idx}`;
      const price = row.sellingPrice;
      const vat = price * 0.05;
      const total = price + vat;

      // Persist each imported booking to Supabase via context
      const estimate: BookingEstimate = {
        id: estId,
        bookingRef,
        agent: row.agent,
        customer: row.customer,
        serviceType: row.serviceType,
        serviceDate: row.serviceDate,
        sellingPrice: price,
        vat,
        total,
        currency: row.currency,
        paymentStatus: row.paymentStatus,
        paymentReceived: row.paymentStatus === 'Paid' ? total : 0,
        paymentMade: 0,
        notes: 'Imported from file',
        submittedAt: new Date().toISOString(),
        submittedBy: 'Sales Team (Import)',
        status: 'Pending Approval',
        isTourPackage: row.serviceType === 'Tour Package',
      };
      addEstimate(estimate);

      newBookings.push({
        id: bookingRef,
        agent: row.agent,
        customer: row.customer,
        serviceType: row.serviceType,
        serviceDate: row.serviceDate,
        sellingPrice: price,
        vat,
        currency: row.currency,
        paymentStatus: row.paymentStatus as 'Paid' | 'Pending' | 'Partial',
      });
    });

    setBookingList(prev => [...newBookings, ...prev] as typeof prev);
    showToast(`${newBookings.length} booking(s) imported and saved`, 'success');
    setUploadStatus('success');
    setTimeout(() => {
      setShowModal(false);
      resetUpload();
    }, 1800);
  };

  const resetUpload = () => {
    setUploadedFile(null);
    setUploadedRows([]);
    setSelectedRows(new Set());
    setUploadStatus('idle');
    setUploadError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openPaymentModal = (b: Booking) => {
    const paidAmt = b.paymentStatus === 'Paid' ? b.sellingPrice + b.vat : b.paymentStatus === 'Partial' ? (b.sellingPrice + b.vat) * 0.5 : 0;
    setPaymentConfig({
      invoiceId: b.id,
      partyName: `${b.customer} (${b.agent})`,
      partyType: 'Customer',
      totalAmount: b.sellingPrice + b.vat,
      paidAmount: paidAmt,
      currency: b.currency,
      existingPayments: paymentHistory[b.id] || [],
    });
  };

  const handlePaymentSave = (payment: PaymentRecord, newStatus: 'Paid' | 'Partial' | 'Unpaid') => {
    if (!paymentConfig) return;
    const bookingId = paymentConfig.invoiceId;
    const mappedStatus = newStatus === 'Paid' ? 'Paid' : newStatus === 'Partial' ? 'Partial' : 'Pending';

    setPaymentHistory(prev => ({ ...prev, [bookingId]: [...(prev[bookingId] || []), payment] }));
    setBookingList(prev => prev.map(b =>
      b.id === bookingId
        ? { ...b, paymentStatus: mappedStatus } as typeof b
        : b
    ));
    if (viewBooking?.id === bookingId) {
      setViewBooking(prev => prev ? { ...prev, paymentStatus: mappedStatus } as typeof prev : prev);
    }

    // Persist payment status change to Supabase
    // Find the matching estimate by bookingRef and update it
    const matchingEstimate = estimates.find(e => e.bookingRef === bookingId);
    if (matchingEstimate) {
      const totalPaid = [...(paymentHistory[bookingId] || []), payment].reduce((s, p) => s + p.amount, 0);
      const updated: BookingEstimate = {
        ...matchingEstimate,
        paymentStatus: mappedStatus,
        paymentReceived: totalPaid,
      };
      upsertEstimateDb(updated).catch(catchAndReport('Update payment status'));
    }
    showToast(`Payment of ${payment.amount.toLocaleString()} ${paymentConfig.currency} recorded`, 'success');
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Agent', 'Customer', 'Service Type', 'Service Date', 'Selling Price', 'Currency', 'Payment Status'],
      ['Global Tours UK', 'John Smith', 'Tour Package', '2024-08-15', 2500, 'AED', 'Pending'],
      ['Euro Holidays', 'Maria Garcia', 'Transfer', '2024-08-16', 800, 'AED', 'Paid'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bookings');
    XLSX.writeFile(wb, 'booking_import_template.xlsx');
  };

  const isTourPackage = form.serviceType === 'Tour Package';
  const costCalc = isTourPackage ? calcCosting(form) : null;
  const costValidation = submitAttempted ? isCostingValid(form) : { valid: true, errors: [] };

  if (loading) return <LoadingSpinner message="Loading bookings..." />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sales & Booking Estimate</h1>
          <p className="text-slate-500 mt-1">Income from tourism services</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowModal(true); setActiveTab('upload'); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Upload size={16} /> Import
          </button>
          <button
            onClick={() => { setShowModal(true); setActiveTab('manual'); }}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
          >
            <Plus size={16} /> New Booking
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Revenue</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">AED {totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total VAT (5%)</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">AED {totalVAT.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Bookings</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{filtered.length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text" placeholder="Search bookings..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {serviceTypes.map(t => (
              <button key={t} onClick={() => setFilter(t)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${filter === t ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >{t}</button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-5 py-3 font-medium text-slate-600">Booking ID</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Agent / Customer</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Service Type</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Date</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Price</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">VAT</th>
                <th className="text-center px-5 py-3 font-medium text-slate-600">Currency</th>
                <th className="text-center px-5 py-3 font-medium text-slate-600">Status</th>
                <th className="text-center px-5 py-3 font-medium text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                  <td className="px-5 py-3 font-medium text-blue-600">{b.id}</td>
                  <td className="px-5 py-3">
                    <div className="text-slate-800 font-medium">{b.customer}</div>
                    <div className="text-slate-400 text-xs">{b.agent}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${b.serviceType === 'Tour Package' ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                      {b.serviceType === 'Tour Package' && <Package size={10} className="inline mr-1" />}
                      {b.serviceType}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    <div>{b.serviceDate}</div>
                    {(b as any).checkIn && (
                      <div className="text-xs text-slate-400 mt-0.5">
                        In: {(b as any).checkIn}{(b as any).checkOut ? ` → Out: ${(b as any).checkOut}` : ''}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-slate-800">AED {b.sellingPrice.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right text-slate-600">AED {b.vat.toFixed(2)}</td>
                  <td className="px-5 py-3 text-center text-slate-600">{b.currency}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(b.paymentStatus)}`}>{b.paymentStatus}</span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setViewBooking(b)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500 transition-colors" title="View">
                        <Eye size={15} />
                      </button>
                      {b.paymentStatus !== 'Paid' && (
                        <button
                          onClick={() => openPaymentModal(b)}
                          className="flex items-center gap-1 px-2 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs font-medium transition-colors"
                          title="Record Payment"
                        >
                          <CheckCircle size={13} /> Pay
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <FileSpreadsheet size={40} className="mx-auto mb-3 opacity-30" />
              <p>No bookings found</p>
            </div>
          )}
        </div>
      </div>

      {/* ── New Booking Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[94vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10 rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-slate-800">New Booking</h2>
                <p className="text-sm text-slate-500 mt-0.5">Add manually or import from file</p>
              </div>
              <button onClick={() => { setShowModal(false); resetUpload(); setSubmitAttempted(false); }} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100">
              <button
                onClick={() => setActiveTab('manual')}
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'manual' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/40' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Plus size={15} /> Manual Entry
              </button>
              <button
                onClick={() => setActiveTab('upload')}
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'upload' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/40' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Upload size={15} /> Upload File
              </button>
            </div>

            {/* ── Manual Entry Tab ── */}
            {activeTab === 'manual' && (
              <form onSubmit={handleSubmit} className="p-6 space-y-5">

                {/* ── Section 1: Basic Info ── */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs">1</span>
                    Booking Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Agent <span className="text-red-500">*</span></label>
                      <select name="agent" value={form.agent} onChange={handleChange} required
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                        <option value="">Select Agent</option>
                        {agentsList.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name <span className="text-red-500">*</span></label>
                      <input type="text" name="customer" value={form.customer} onChange={handleChange} required placeholder="Full name"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Service Type <span className="text-red-500">*</span></label>
                      <select name="serviceType" value={form.serviceType} onChange={handleChange}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                        {serviceTypes.slice(1).map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Service Date <span className="text-red-500">*</span></label>
                      <input type="date" name="serviceDate" value={form.serviceDate} onChange={handleChange} required
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Check-in Date</label>
                      <input type="date" name="checkIn" value={form.checkIn} onChange={handleChange}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Check-out Date</label>
                      <input type="date" name="checkOut" value={form.checkOut} onChange={handleChange}
                        min={form.checkIn || undefined}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Selling Price <span className="text-red-500">*</span></label>
                      <input type="number" name="sellingPrice" value={form.sellingPrice} onChange={handleChange} required min="0" step="0.01" placeholder="0.00"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                      <select name="currency" value={form.currency} onChange={handleChange}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                        {currencies.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Payment Received</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">{form.currency}</span>
                        <input type="number" name="paymentReceived" value={form.paymentReceived} onChange={handleChange}
                          min="0" step="0.01" placeholder="0.00"
                          className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Payment Made</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">{form.currency}</span>
                        <input type="number" name="paymentMade" value={form.paymentMade} onChange={handleChange}
                          min="0" step="0.01" placeholder="0.00"
                          className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Payment Status</label>
                      <div className="flex gap-3">
                        {paymentStatuses.map(s => (
                          <button key={s} type="button" onClick={() => setForm(p => ({ ...p, paymentStatus: s }))}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.paymentStatus === s ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                      <textarea name="notes" value={form.notes} onChange={handleChange} rows={2} placeholder="Optional notes..."
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                    </div>
                  </div>
                </div>

                {/* ── Section 2: Tour Package Costing (MANDATORY) ── */}
                {isTourPackage && (
                  <div className={`border-2 rounded-xl overflow-hidden transition-colors ${submitAttempted && !costValidation.valid ? 'border-red-300' : 'border-purple-200'}`}>
                    {/* Costing Header */}
                    <button
                      type="button"
                      onClick={() => setCostingExpanded(e => !e)}
                      className={`w-full flex items-center justify-between px-5 py-4 ${submitAttempted && !costValidation.valid ? 'bg-red-50' : 'bg-purple-50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs">2</span>
                        <div className="flex items-center gap-2">
                          <Package size={16} className="text-purple-600" />
                          <span className="text-sm font-semibold text-slate-800">Tour Package Costing</span>
                          <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-bold rounded-full">MANDATORY</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {submitAttempted && !costValidation.valid && (
                          <span className="text-xs text-red-500 font-medium flex items-center gap-1">
                            <AlertCircle size={12} /> Required
                          </span>
                        )}
                        <ChevronDown size={16} className={`text-slate-400 transition-transform ${costingExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {costingExpanded && (
                      <div className="p-5 space-y-5">
                        {/* Info banner */}
                        <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                          <Info size={14} className="mt-0.5 shrink-0" />
                          <span>Enter the cost breakdown for this tour package. <strong>Hotel</strong> and <strong>Transfer</strong> costs are required. You can also upload a costing sheet (Excel/PDF).</span>
                        </div>

                        {/* Cost fields grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {costingItems.map(item => (
                            <div key={item.key}>
                              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                                <span className="text-slate-400">{item.icon}</span>
                                {item.label}
                                {item.required && <span className="text-red-500">*</span>}
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">{form.currency}</span>
                                <input
                                  type="number"
                                  name={item.key}
                                  value={form.costing[item.key as keyof PackageCosting] as string}
                                  onChange={handleCostingChange}
                                  min="0"
                                  step="0.01"
                                  placeholder={item.placeholder}
                                  className={`w-full pl-10 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 ${
                                    submitAttempted && item.required && !form.costing[item.key as keyof PackageCosting]
                                      ? 'border-red-300 bg-red-50'
                                      : 'border-slate-200'
                                  }`}
                                />
                              </div>
                              {submitAttempted && item.required && !form.costing[item.key as keyof PackageCosting] && (
                                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                  <AlertCircle size={11} /> {item.label} is required
                                </p>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Costing Notes */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Costing Notes</label>
                          <textarea
                            name="notes"
                            value={form.costing.notes}
                            onChange={handleCostingChange}
                            rows={2}
                            placeholder="Additional cost notes, supplier details..."
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                          />
                        </div>

                        {/* Upload Costing File */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
                            <Upload size={14} className="text-slate-400" />
                            Upload Costing Sheet
                            <span className="text-xs text-slate-400 font-normal">(Excel / PDF)</span>
                          </label>

                          {form.costing.costingFileName ? (
                            <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-lg px-4 py-3">
                              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                                {form.costing.costingFileName.endsWith('.pdf')
                                  ? <FileText size={16} className="text-purple-600" />
                                  : <FileSpreadsheet size={16} className="text-purple-600" />
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-700 truncate">{form.costing.costingFileName}</p>
                                <p className="text-xs text-slate-400">Costing file attached</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setForm(prev => ({ ...prev, costing: { ...prev.costing, costingFile: null, costingFileName: '' } }))}
                                className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-500 transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div
                              onDragOver={(e) => { e.preventDefault(); setCostingDragOver(true); }}
                              onDragLeave={() => setCostingDragOver(false)}
                              onDrop={(e) => {
                                e.preventDefault();
                                setCostingDragOver(false);
                                const file = e.dataTransfer.files[0];
                                if (file) handleCostingFile(file);
                              }}
                              onClick={() => costingFileRef.current?.click()}
                              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                                costingDragOver ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-purple-400 hover:bg-purple-50/30'
                              }`}
                            >
                              <div className="flex justify-center gap-2 mb-2">
                                <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center">
                                  <FileSpreadsheet size={18} className="text-emerald-600" />
                                </div>
                                <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center">
                                  <FileText size={18} className="text-red-500" />
                                </div>
                              </div>
                              <p className="text-sm text-slate-600 font-medium">Drop costing file here or <span className="text-purple-600">browse</span></p>
                              <p className="text-xs text-slate-400 mt-1">.xlsx, .xls, .csv, .pdf</p>
                              <input
                                ref={costingFileRef}
                                type="file"
                                accept=".xlsx,.xls,.csv,.pdf"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleCostingFile(file);
                                }}
                                className="hidden"
                              />
                            </div>
                          )}
                        </div>

                        {/* ── Live Profit / Loss Calculator ── */}
                        {costCalc && (
                          <div className={`rounded-xl border-2 p-4 ${costCalc.profit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-center gap-2 mb-3">
                              {costCalc.profit >= 0
                                ? <TrendingUp size={16} className="text-emerald-600" />
                                : <TrendingDown size={16} className="text-red-500" />
                              }
                              <span className="text-sm font-semibold text-slate-800">Live Profit & Loss</span>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-slate-600">Selling Price</span>
                                <span className="font-medium">{form.currency} {costCalc.selling.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600">VAT (5%)</span>
                                <span className="font-medium">{form.currency} {costCalc.vat.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between border-t border-slate-200 pt-1">
                                <span className="text-slate-600">Total Revenue</span>
                                <span className="font-semibold">{form.currency} {costCalc.totalRevenue.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600">Total Cost</span>
                                <span className="font-medium text-red-600">− {form.currency} {costCalc.totalCost.toLocaleString()}</span>
                              </div>

                              {/* Individual cost breakdown */}
                              {costingItems.map(item => {
                                const val = parseFloat(form.costing[item.key as keyof PackageCosting] as string) || 0;
                                if (!val) return null;
                                return (
                                  <div key={item.key} className="flex justify-between pl-4 text-xs text-slate-500">
                                    <span className="flex items-center gap-1">{item.icon} {item.label}</span>
                                    <span>{form.currency} {val.toLocaleString()}</span>
                                  </div>
                                );
                              })}

                              <div className={`flex justify-between border-t-2 pt-2 mt-1 ${costCalc.profit >= 0 ? 'border-emerald-300' : 'border-red-300'}`}>
                                <span className="font-bold text-slate-800">
                                  {costCalc.profit >= 0 ? '✅ Profit' : '❌ Loss'}
                                </span>
                                <div className="text-right">
                                  <span className={`font-bold text-lg ${costCalc.profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                    {costCalc.profit >= 0 ? '+' : ''}{form.currency} {Math.abs(costCalc.profit).toLocaleString()}
                                  </span>
                                  <span className={`block text-xs font-medium ${costCalc.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                    Margin: {costCalc.margin.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Validation errors */}
                        {submitAttempted && !costValidation.valid && (
                          <div className="flex flex-col gap-1 bg-red-50 border border-red-200 rounded-lg p-3">
                            {costValidation.errors.map((err, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs text-red-600">
                                <AlertCircle size={12} /> {err}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Price Summary (non-tour packages) ── */}
                {!isTourPackage && form.sellingPrice && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-slate-600">Selling Price</span><span className="font-medium">{form.currency} {parseFloat(form.sellingPrice || '0').toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">VAT (5%)</span><span className="font-medium">{form.currency} {(parseFloat(form.sellingPrice || '0') * 0.05).toFixed(2)}</span></div>
                    <div className="flex justify-between border-t border-emerald-100 pt-1 mt-1"><span className="font-semibold text-slate-800">Total</span><span className="font-bold text-emerald-700">{form.currency} {(parseFloat(form.sellingPrice || '0') * 1.05).toFixed(2)}</span></div>
                  </div>
                )}

                <div className="flex gap-3 justify-end pt-2">
                  {!sentToFinance && (
                    <button type="button" onClick={() => { setShowModal(false); resetUpload(); setSubmitAttempted(false); }} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                  )}
                  {sentToFinance ? (
                    <div className="flex items-center gap-2 px-5 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-semibold border border-emerald-200">
                      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Sent to Finance for Approval!
                    </div>
                  ) : (
                    <button type="submit" className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 font-semibold shadow-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      Send to Finance for Approval
                    </button>
                  )}
                </div>
              </form>
            )}

            {/* ── Upload Tab ── */}
            {activeTab === 'upload' && (
              <div className="p-6 space-y-5">
                {/* Template download */}
                <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <FileSpreadsheet size={16} />
                    <span>Download the Excel template for correct column format</span>
                  </div>
                  <button onClick={downloadTemplate} className="flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-800 bg-white border border-blue-200 px-3 py-1.5 rounded-lg transition-colors">
                    <Download size={13} /> Template
                  </button>
                </div>

                {/* Drop zone */}
                {uploadStatus === 'idle' || uploadStatus === 'error' ? (
                  <>
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'}`}
                    >
                      <div className="flex justify-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                          <FileSpreadsheet size={24} className="text-emerald-600" />
                        </div>
                        <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                          <FileText size={24} className="text-red-600" />
                        </div>
                      </div>
                      <p className="text-slate-700 font-medium mb-1">Drag & drop your file here</p>
                      <p className="text-slate-400 text-sm mb-3">or click to browse</p>
                      <div className="flex justify-center gap-2">
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">.xlsx</span>
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">.xls</span>
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">.csv</span>
                        <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">.pdf</span>
                      </div>
                      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.pdf" onChange={handleFileInput} className="hidden" />
                    </div>

                    {uploadStatus === 'error' && (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 rounded-lg p-3 text-sm">
                        <AlertCircle size={16} />
                        <span>{uploadError}</span>
                      </div>
                    )}
                  </>
                ) : uploadStatus === 'parsing' ? (
                  <div className="text-center py-10">
                    <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-slate-600 font-medium">Parsing file...</p>
                    <p className="text-slate-400 text-sm mt-1">{uploadedFile?.name}</p>
                  </div>
                ) : uploadStatus === 'success' ? (
                  <div className="text-center py-10">
                    <CheckCircle size={48} className="text-emerald-500 mx-auto mb-3" />
                    <p className="text-slate-800 font-semibold text-lg">Import Successful!</p>
                    <p className="text-slate-400 text-sm mt-1">{selectedRows.size} bookings added</p>
                  </div>
                ) : (
                  /* Preview table */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet size={16} className="text-blue-600" />
                        <span className="text-sm font-medium text-slate-700">{uploadedFile?.name}</span>
                        <span className="text-xs text-slate-400">({uploadedRows.length} rows found)</span>
                      </div>
                      <button onClick={resetUpload} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                        <Trash2 size={12} /> Remove
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full">
                        ✓ {uploadedRows.filter(r => r.valid).length} valid
                      </span>
                      {uploadedRows.filter(r => !r.valid).length > 0 && (
                        <span className="px-2.5 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-full">
                          ✗ {uploadedRows.filter(r => !r.valid).length} errors
                        </span>
                      )}
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                        {selectedRows.size} selected to import
                      </span>
                    </div>

                    <div className="border border-slate-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left">
                              <input type="checkbox"
                                checked={selectedRows.size === uploadedRows.filter(r => r.valid).length && uploadedRows.filter(r => r.valid).length > 0}
                                onChange={toggleAll}
                                className="rounded"
                              />
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-slate-600">Customer</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-600">Agent</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-600">Service</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-600">Date</th>
                            <th className="px-3 py-2 text-right font-medium text-slate-600">Price</th>
                            <th className="px-3 py-2 text-center font-medium text-slate-600">Status</th>
                            <th className="px-3 py-2 text-center font-medium text-slate-600">Valid</th>
                          </tr>
                        </thead>
                        <tbody>
                          {uploadedRows.map((row, i) => (
                            <tr key={i} className={`border-t border-slate-100 ${!row.valid ? 'bg-red-50' : selectedRows.has(i) ? 'bg-blue-50/30' : ''}`}>
                              <td className="px-3 py-2">
                                <input type="checkbox" checked={selectedRows.has(i)} disabled={!row.valid} onChange={() => toggleRow(i)} className="rounded" />
                              </td>
                              <td className="px-3 py-2 font-medium text-slate-700">{row.customer || <span className="text-red-400 italic">missing</span>}</td>
                              <td className="px-3 py-2 text-slate-500">{row.agent || <span className="text-red-400 italic">missing</span>}</td>
                              <td className="px-3 py-2 text-slate-500">{row.serviceType}</td>
                              <td className="px-3 py-2 text-slate-500">{row.serviceDate || <span className="text-red-400 italic">missing</span>}</td>
                              <td className="px-3 py-2 text-right font-medium">AED {row.sellingPrice.toLocaleString()}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${statusColor(row.paymentStatus)}`}>{row.paymentStatus}</span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                {row.valid
                                  ? <CheckCircle size={14} className="text-emerald-500 mx-auto" />
                                  : <span title={row.error}><AlertCircle size={14} className="text-red-500 mx-auto" /></span>
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex gap-3 justify-end pt-1">
                      <button onClick={resetUpload} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                        Back
                      </button>
                      <button
                        onClick={handleImport}
                        disabled={selectedRows.size === 0}
                        className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${selectedRows.size > 0 ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                      >
                        <Upload size={15} /> Import {selectedRows.size} Booking{selectedRows.size !== 1 ? 's' : ''}
                      </button>
                    </div>
                  </div>
                )}

                {/* Column guide */}
                {(uploadStatus === 'idle' || uploadStatus === 'error') && (
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1"><ChevronDown size={12} /> Expected column names in your file</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {['Agent', 'Customer', 'Service Type', 'Service Date', 'Selling Price', 'Currency', 'Payment Status'].map(col => (
                        <span key={col} className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-600 font-mono">{col}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── View Booking Modal ── */}
      {viewBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-800">{viewBooking.id}</h2>
                <p className="text-sm text-slate-500 mt-0.5">Booking Details</p>
              </div>
              <button onClick={() => setViewBooking(null)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-3">
              {[
                ['Customer', viewBooking.customer],
                ['Agent', viewBooking.agent],
                ['Service Type', viewBooking.serviceType],
                ['Service Date', viewBooking.serviceDate],
                ...((viewBooking as any).checkIn ? [['Check-in Date', (viewBooking as any).checkIn]] : []),
                ...((viewBooking as any).checkOut ? [['Check-out Date', (viewBooking as any).checkOut]] : []),
                ['Currency', viewBooking.currency],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between text-sm border-b border-slate-50 pb-2">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-medium text-slate-800">{val}</span>
                </div>
              ))}
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 space-y-1 text-sm mt-2">
                <div className="flex justify-between"><span className="text-slate-600">Selling Price</span><span className="font-medium">AED {viewBooking.sellingPrice.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">VAT (5%)</span><span className="font-medium">AED {viewBooking.vat.toFixed(2)}</span></div>
                <div className="flex justify-between border-t border-emerald-100 pt-1 mt-1">
                  <span className="font-semibold text-slate-800">Total</span>
                  <span className="font-bold text-emerald-700">AED {(viewBooking.sellingPrice + viewBooking.vat).toFixed(2)}</span>
                </div>
              </div>
              {((viewBooking as any).paymentReceived != null || (viewBooking as any).paymentMade != null) && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-1 text-sm">
                  {(viewBooking as any).paymentReceived != null && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Payment Received</span>
                      <span className="font-medium text-blue-700">{viewBooking.currency} {Number((viewBooking as any).paymentReceived).toLocaleString()}</span>
                    </div>
                  )}
                  {(viewBooking as any).paymentMade != null && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Payment Made</span>
                      <span className="font-medium text-slate-700">{viewBooking.currency} {Number((viewBooking as any).paymentMade).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-between items-center pt-1">
                <span className="text-sm text-slate-500">Payment Status</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(viewBooking.paymentStatus)}`}>{viewBooking.paymentStatus}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-6 border-t border-slate-100">
              {viewBooking.paymentStatus !== 'Paid' && (
                <button
                  onClick={() => { openPaymentModal(viewBooking); setViewBooking(null); }}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 font-medium"
                >
                  <CheckCircle size={15} /> Record Payment
                </button>
              )}
              <button onClick={() => setViewBooking(null)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Record Payment Modal ── */}
      {paymentConfig && (
        <RecordPaymentModal
          config={paymentConfig}
          onClose={() => setPaymentConfig(null)}
          onSave={(payment, newStatus) => {
            handlePaymentSave(payment, newStatus);
            setPaymentConfig(null);
          }}
        />
      )}
    </div>
  );
}
