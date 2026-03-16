import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchEstimates, upsertEstimate, upsertEstimates } from '../lib/supabaseSync';

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
  const [estimates, setEstimates] = useState<BookingEstimate[]>([
    {
      id: 'EST-001',
      bookingRef: 'BK-2024-0095',
      agent: 'Global Tours UK',
      customer: 'Smith Family',
      serviceType: 'Tour Package',
      serviceDate: '2024-03-15',
      sellingPrice: 3500,
      vat: 175,
      total: 3675,
      currency: 'AED',
      paymentStatus: 'Pending',
      notes: 'Desert Safari + City Tour combo package',
      submittedAt: '2024-02-10T09:30:00Z',
      submittedBy: 'Sales Team',
      status: 'Pending Approval',
      isTourPackage: true,
      costing: {
        hotel: 1800,
        transfer: 400,
        tickets: 600,
        activities: 0,
        guide: 0,
        visa: 0,
        other: 0,
        notes: 'Hotel: Marriott Dubai, Transfer: City Transport Co',
        totalCost: 2800,
        profit: 700,
        margin: 20,
        costingFile: 'Package_Costing_EST001.xlsx',
      },
    },
    {
      id: 'EST-002',
      bookingRef: 'BK-2024-0096',
      agent: 'Euro Holidays',
      customer: 'Mr. Carlos Ruiz',
      serviceType: 'Hotel Booking',
      serviceDate: '2024-03-20',
      sellingPrice: 2200,
      vat: 110,
      total: 2310,
      currency: 'AED',
      paymentStatus: 'Pending',
      notes: 'Business trip accommodation — 4 nights',
      submittedAt: '2024-02-11T11:00:00Z',
      submittedBy: 'Sales Team',
      status: 'Pending Approval',
    },
    {
      id: 'EST-003',
      bookingRef: 'BK-2024-0090',
      agent: 'Asia Travel Co',
      customer: 'Chen Group',
      serviceType: 'Tour Package',
      serviceDate: '2024-02-28',
      sellingPrice: 6800,
      vat: 340,
      total: 7140,
      currency: 'AED',
      paymentStatus: 'Paid',
      notes: 'VIP Abu Dhabi tour',
      submittedAt: '2024-02-05T14:00:00Z',
      submittedBy: 'Sales Team',
      status: 'Approved',
      approvedBy: 'Finance Manager',
      approvedAt: '2024-02-06T10:00:00Z',
      isTourPackage: true,
      costing: {
        hotel: 3200,
        transfer: 800,
        tickets: 1200,
        activities: 400,
        guide: 300,
        visa: 0,
        other: 0,
        notes: 'Premium hotel, private transfer',
        totalCost: 5900,
        profit: 900,
        margin: 13.2,
        costingFile: 'VIP_Abu_Dhabi_Costing.pdf',
      },
    },
  ]);

  // ── Load from Supabase on mount ─────────────────────────────────────────────
  useEffect(() => {
    fetchEstimates().then(data => {
      if (data && data.length > 0) {
        setEstimates(data);
      } else if (data && data.length === 0) {
        // First run — seed Supabase with default estimates
        upsertEstimates(estimates);
      }
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
