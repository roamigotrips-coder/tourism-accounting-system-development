import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchEstimates, upsertEstimate } from '../lib/supabaseSync';

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
}

const BookingEstimateContext = createContext<BookingEstimateContextType | null>(null);

export function BookingEstimateProvider({ children }: { children: ReactNode }) {
  const [estimates, setEstimates] = useState<BookingEstimate[]>([]);

  // ── Load from Supabase on mount ─────────────────────────────────────────────
  useEffect(() => {
    fetchEstimates().then(data => {
      if (data) setEstimates(data);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pendingCount = estimates.filter(e => e.status === 'Pending Approval').length;

  const addEstimate = (estimate: BookingEstimate) => {
    setEstimates(prev => [estimate, ...prev]);
    upsertEstimate(estimate);
  };

  const approveEstimate = (id: string, approvedBy: string): BookingEstimate | null => {
    let approved: BookingEstimate | null = null;
    setEstimates(prev => prev.map(e => {
      if (e.id === id) {
        approved = { ...e, status: 'Approved', approvedBy, approvedAt: new Date().toISOString() };
        return approved;
      }
      return e;
    }));
    if (approved) upsertEstimate(approved);
    return approved;
  };

  const rejectEstimate = (id: string, rejectedBy: string, reason: string) => {
    setEstimates(prev => prev.map(e => {
      if (e.id === id) {
        const updated = { ...e, status: 'Rejected' as EstimateStatus, rejectedBy, rejectedAt: new Date().toISOString(), rejectionReason: reason };
        upsertEstimate(updated);
        return updated;
      }
      return e;
    }));
  };

  const markInvoiced = (id: string, invoiceId: string) => {
    setEstimates(prev => prev.map(e => {
      if (e.id === id) {
        const updated = { ...e, status: 'Invoiced' as EstimateStatus, invoiceId };
        upsertEstimate(updated);
        return updated;
      }
      return e;
    }));
  };

  return (
    <BookingEstimateContext.Provider value={{ estimates, addEstimate, approveEstimate, rejectEstimate, markInvoiced, pendingCount }}>
      {children}
    </BookingEstimateContext.Provider>
  );
}

export function useBookingEstimates() {
  const ctx = useContext(BookingEstimateContext);
  if (!ctx) throw new Error('useBookingEstimates must be used within BookingEstimateProvider');
  return ctx;
}
