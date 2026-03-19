import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { catchAndReport } from '../lib/toast';
import { fetchEstimates as fetchEstimatesDb, upsertEstimate as upsertEstimateDb } from '../lib/supabaseSync';

export type EstimateStatus = 'Pending Approval' | 'Approved' | 'Rejected' | 'Invoiced';

export interface BookingEstimate {
  id: string;
  bookingRef: string;
  agent: string;
  customer: string;
  serviceType: string;
  serviceDate: string;
  checkIn?: string;
  checkOut?: string;
  sellingPrice: number;
  vat: number;
  total: number;
  currency: string;
  paymentStatus: string;
  paymentReceived?: number;
  paymentMade?: number;
  notes: string;
  submittedAt: string;
  submittedBy: string;
  status: EstimateStatus;
  // Tour package costing
  isTourPackage?: boolean;
  costing?: {
    hotel: number;
    transfer: number;
    tickets: number;
    activities: number;
    guide: number;
    visa: number;
    other: number;
    notes: string;
    totalCost: number;
    profit: number;
    margin: number;
    costingFile?: string;
  };
  // Finance actions
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  invoiceId?: string;
}

interface BookingEstimateContextType {
  estimates: BookingEstimate[];
  addEstimate: (estimate: BookingEstimate) => void;
  approveEstimate: (id: string, approvedBy: string) => BookingEstimate | null;
  rejectEstimate: (id: string, rejectedBy: string, reason: string) => void;
  markInvoiced: (id: string, invoiceId: string) => void;
  pendingCount: number;
  loading: boolean;
  error: string | null;
}

const BookingEstimateContext = createContext<BookingEstimateContextType | null>(null);

export function BookingEstimateProvider({ children }: { children: ReactNode }) {
  const [estimates, setEstimates] = useState<BookingEstimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Load from Supabase on mount ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchEstimatesDb();
        if (!cancelled) {
          if (data !== null) { setEstimates(data); setError(null); }
          else setError('Failed to load booking estimates');
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load booking estimates');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const pendingCount = estimates.filter(e => e.status === 'Pending Approval').length;

  const addEstimate = (estimate: BookingEstimate) => {
    setEstimates(prev => [estimate, ...prev]);
    upsertEstimateDb(estimate).catch(catchAndReport('Add booking estimate'));
  };

  const approveEstimate = (id: string, approvedBy: string): BookingEstimate | null => {
    let approved: BookingEstimate | null = null;
    setEstimates(prev => prev.map(e => {
      if (e.id === id) {
        approved = { ...e, status: 'Approved', approvedBy, approvedAt: new Date().toISOString() };
        upsertEstimateDb(approved).catch(catchAndReport('Approve booking estimate'));
        return approved;
      }
      return e;
    }));
    return approved;
  };

  const rejectEstimate = (id: string, rejectedBy: string, reason: string) => {
    setEstimates(prev => prev.map(e => {
      if (e.id === id) {
        const updated = { ...e, status: 'Rejected' as EstimateStatus, rejectedBy, rejectedAt: new Date().toISOString(), rejectionReason: reason };
        upsertEstimateDb(updated).catch(catchAndReport('Reject booking estimate'));
        return updated;
      }
      return e;
    }));
  };

  const markInvoiced = (id: string, invoiceId: string) => {
    setEstimates(prev => prev.map(e => {
      if (e.id === id) {
        const updated = { ...e, status: 'Invoiced' as EstimateStatus, invoiceId };
        upsertEstimateDb(updated).catch(catchAndReport('Mark estimate as invoiced'));
        return updated;
      }
      return e;
    }));
  };

  return (
    <BookingEstimateContext.Provider value={{ estimates, addEstimate, approveEstimate, rejectEstimate, markInvoiced, pendingCount, loading, error }}>
      {children}
    </BookingEstimateContext.Provider>
  );
}

export function useBookingEstimates() {
  const ctx = useContext(BookingEstimateContext);
  if (!ctx) throw new Error('useBookingEstimates must be used within BookingEstimateProvider');
  return ctx;
}
