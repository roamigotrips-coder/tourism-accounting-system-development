import { useState, useEffect } from 'react';
import { Download, FileText, CreditCard, BarChart3, Eye, Printer, X } from 'lucide-react';
import { fetchEstimates, fetchInvoices } from '../lib/supabaseSync';
import { LoadingSpinner, ErrorBanner } from '../components/LoadingState';
import type { Invoice } from '../data/mockData';

type Booking = {
  id: string;
  agent: string;
  serviceType: string;
  serviceDate: string;
  sellingPrice: number;
  vat: number;
  currency: string;
  paymentStatus: 'Paid' | 'Pending' | 'Partial';
  customer: string;
};

const COMPANY = {
  name: 'Arabian Horizon Tourism LLC',
  address: 'Office 1204, Deira Tower, Baniyas Road, Deira, Dubai, UAE',
  phone: '+971 4 234 5678',
  email: 'accounts@arabianhorizon.ae',
  trn: 'TRN 100234567800003',
  logo: '🌴',
};

type InvType = Invoice;

function InvoicePreviewModal({ inv, onClose }: { inv: InvType; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #agent-printable, #agent-printable * { visibility: visible !important; }
          #agent-printable { position: fixed !important; inset: 0 !important; width: 100% !important; background: white !important; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-4">
        {/* Toolbar */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Eye size={18} className="text-emerald-600" />
            <span className="font-semibold text-slate-700">Invoice — {inv.id}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 font-medium"
            >
              <Printer size={15} /> Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-2 bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm hover:bg-slate-300 font-medium"
            >
              <X size={15} /> Close
            </button>
          </div>
        </div>

        {/* Invoice */}
        <div id="agent-printable" className="p-10 font-sans text-slate-800">
          <div className="flex justify-between items-start mb-8">
            <div>
              <div className="text-4xl mb-1">{COMPANY.logo}</div>
              <h1 className="text-xl font-bold text-emerald-700">{COMPANY.name}</h1>
              <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">{COMPANY.address}</p>
              <p className="text-xs text-slate-500">{COMPANY.phone} · {COMPANY.email}</p>
              <p className="text-xs font-semibold text-slate-600 mt-1">{COMPANY.trn}</p>
            </div>
            <div className="text-right">
              <span className="inline-block px-4 py-1 rounded-full text-sm font-bold mb-2 bg-blue-100 text-blue-700">AGENT INVOICE</span>
              <h2 className="text-3xl font-extrabold text-slate-800">{inv.id}</h2>
              <p className="text-sm text-slate-500 mt-1">Date: <span className="font-medium text-slate-700">{inv.date}</span></p>
              <p className="text-sm text-slate-500">Due: <span className="font-medium text-red-600">{inv.dueDate}</span></p>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${
                inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' :
                inv.status === 'Overdue' ? 'bg-red-100 text-red-700' :
                'bg-amber-100 text-amber-700'
              }`}>{inv.status.toUpperCase()}</span>
            </div>
          </div>

          <div className="mb-8 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Bill To</p>
            <p className="text-lg font-bold text-slate-800">{inv.party}</p>
            <p className="text-sm text-slate-500">Agent Account</p>
          </div>

          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="bg-emerald-600 text-white">
                <th className="text-left px-4 py-3 rounded-tl-lg">#</th>
                <th className="text-left px-4 py-3">Description</th>
                <th className="text-right px-4 py-3">Qty</th>
                <th className="text-right px-4 py-3">Unit Price</th>
                <th className="text-right px-4 py-3 rounded-tr-lg">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white">
                <td className="px-4 py-3 text-slate-400">1</td>
                <td className="px-4 py-3 font-medium text-slate-700">Tourism Services</td>
                <td className="px-4 py-3 text-right text-slate-600">1</td>
                <td className="px-4 py-3 text-right text-slate-600">{inv.currency} {inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-800">{inv.currency} {inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>

          <div className="flex justify-end mb-6">
            <div className="w-72 space-y-2">
              <div className="flex justify-between text-sm text-slate-600 py-1 border-b border-slate-100">
                <span>Subtotal</span><span>{inv.currency} {inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-600 py-1 border-b border-slate-100">
                <span>VAT (5%)</span><span>{inv.currency} {inv.vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between font-bold text-base py-2 bg-emerald-50 px-3 rounded-lg">
                <span className="text-emerald-800">Total Due</span>
                <span className="text-emerald-700">{inv.currency} {inv.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mb-6">
            <p className="text-xs font-bold text-slate-400 uppercase mb-2">Payment Instructions</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-slate-500">Bank:</span> <span className="font-medium">Emirates NBD</span></div>
              <div><span className="text-slate-500">Account:</span> <span className="font-medium">1234567890</span></div>
              <div><span className="text-slate-500">IBAN:</span> <span className="font-medium">AE070331234567890123456</span></div>
              <div><span className="text-slate-500">Swift:</span> <span className="font-medium">EBILAEAD</span></div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
            <p>Thank you for your business! · {COMPANY.name} · {COMPANY.email}</p>
            <p className="mt-1">This is a computer-generated invoice and is valid without a signature.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AgentPortal() {
  const [viewInv, setViewInv] = useState<InvType | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [estData, invData] = await Promise.all([fetchEstimates(), fetchInvoices()]);
        if (!cancelled) {
          if (estData) {
            setBookings(estData.map(e => ({
              id: e.id,
              agent: e.agent || '',
              serviceType: e.serviceType,
              serviceDate: e.serviceDate,
              sellingPrice: e.total,
              vat: e.vat,
              currency: e.currency,
              paymentStatus: 'Pending' as const,
              customer: e.customer,
            })));
          }
          if (invData) setInvoices(invData);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <LoadingSpinner message="Loading..." />;
  if (error) return <ErrorBanner message={error} />;

  const agentBookings = bookings.filter(b => b.agent === 'Global Tours UK');
  const agentInvoices = invoices.filter(i => i.party === 'Global Tours UK');
  const outstanding = agentInvoices.filter(i => i.status !== 'Paid').reduce((s, i) => s + i.total, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Agent Portal</h1>
        <p className="text-slate-500 mt-1">Self-service portal — view bookings, download invoices & make payments</p>
      </div>

      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-emerald-100 text-sm">Welcome back</p>
            <h2 className="text-2xl font-bold mt-1">Global Tours UK</h2>
            <p className="text-emerald-100 text-sm mt-1">Agent ID: AG-001 | Credit: Net 30 | Outstanding: AED {outstanding.toLocaleString()}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => agentInvoices[0] && setViewInv(agentInvoices[0])}
              className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <Download size={14} /> Download Statement
            </button>
            <button className="bg-white text-emerald-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
              <CreditCard size={14} /> Make Payment
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center"><BarChart3 size={20} className="text-blue-600" /></div>
            <div>
              <p className="text-xs text-slate-500 uppercase">Total Bookings</p>
              <p className="text-2xl font-bold text-slate-800">156</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center"><CreditCard size={20} className="text-amber-600" /></div>
            <div>
              <p className="text-xs text-slate-500 uppercase">Outstanding</p>
              <p className="text-2xl font-bold text-amber-600">AED {outstanding.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center"><FileText size={20} className="text-emerald-600" /></div>
            <div>
              <p className="text-xs text-slate-500 uppercase">Recent Invoices</p>
              <p className="text-2xl font-bold text-slate-800">{agentInvoices.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bookings */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">My Bookings</h3>
            <span className="text-xs text-slate-400">{agentBookings.length} bookings</span>
          </div>
          <div className="divide-y divide-slate-50">
            {agentBookings.map(b => (
              <div key={b.id} className="p-4 hover:bg-slate-50/50 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-blue-600 text-sm">{b.id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      b.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>{b.paymentStatus}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-0.5">{b.customer} — {b.serviceType}</p>
                  <p className="text-xs text-slate-400">{b.serviceDate}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-800">AED {b.sellingPrice.toLocaleString()}</p>
                  <button className="text-xs text-blue-600 hover:underline mt-1">View Details</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Invoices */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Invoices</h3>
            <span className="text-xs text-slate-400">{agentInvoices.length} invoices</span>
          </div>
          <div className="divide-y divide-slate-50">
            {agentInvoices.map(inv => (
              <div key={inv.id} className="p-4 hover:bg-slate-50/50 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800 text-sm">{inv.id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      inv.status === 'Paid' ? 'bg-emerald-50 text-emerald-700' :
                      inv.status === 'Overdue' ? 'bg-red-50 text-red-700' :
                      'bg-amber-50 text-amber-700'
                    }`}>{inv.status}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Due: {inv.dueDate}</p>
                </div>
                <div className="text-right flex items-center gap-2">
                  <div>
                    <p className="font-semibold text-slate-800">AED {inv.total.toLocaleString()}</p>
                    <p className="text-xs text-slate-400">VAT: AED {inv.vat}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => setViewInv(inv)}
                      title="View Invoice"
                      className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-medium"
                    >
                      <Eye size={12} /> View
                    </button>
                    <button
                      onClick={() => setViewInv(inv)}
                      title="Download PDF"
                      className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-medium"
                    >
                      <Download size={12} /> PDF
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-slate-100">
            <button className="w-full text-center text-sm text-blue-600 hover:underline font-medium">View All Invoices</button>
          </div>
        </div>
      </div>

      {/* Invoice Preview Modal */}
      {viewInv && <InvoicePreviewModal inv={viewInv} onClose={() => setViewInv(null)} />}
    </div>
  );
}
