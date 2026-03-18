// ============ DASHBOARD DATA ============
export const dashboardStats = {
  totalSales: 0,
  totalExpenses: 0,
  profitLoss: 0,
  agentOutstanding: 0,
  supplierPayables: 0,
  todaysRevenue: 0,
  pendingPayments: 0,
  newLeads: 0,
  vehicleUtilization: 0,
  paymentReceived: 0,
  paymentMade: 0,
};

// ============ BOOKINGS DATA ============
export type Booking = {
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
export const bookings: Booking[] = [];

// ============ AGENTS DATA ============
export type Agent = {
  id: string;
  name: string;
  country: string;
  creditLimit: number;
  outstanding: number;
  paymentTerms: string;
  commission: number;
  totalBookings: number;
  status: 'Active' | 'Inactive';
  email: string;
  phone: string;
};
export const agents: Agent[] = [];

// ============ SUPPLIERS DATA ============
export type Supplier = {
  id: string;
  name: string;
  type: string;
  contact: string;
  email: string;
  totalPayable: number;
  paidAmount: number;
  status: 'Active' | 'Inactive';
};
export const suppliers: Supplier[] = [];

// ============ EXPENSES DATA ============
export type Expense = {
  id: string;
  category: string;
  supplier: string;
  amount: number;
  paymentMode: string;
  date: string;
  description: string;
  status: 'Paid' | 'Pending';
};
export const expenses: Expense[] = [];

// ============ VEHICLES DATA ============
export type Vehicle = {
  id: string;
  plate: string;
  type: string;
  driver: string;
  status: 'Available' | 'On Trip' | 'Maintenance';
  fuelCost: number;
  trips: number;
  revenue: number;
};
export const vehicles: Vehicle[] = [];

// ============ TOUR PACKAGES ============
export type TourPackage = {
  id: string;
  name: string;
  price: number;
  hotelCost: number;
  transferCost: number;
  ticketsCost: number;
  guideCost: number;
  otherCost: number;
  profit: number;
  bookings: number;
};
export const tourPackages: TourPackage[] = [];

// ============ VAT DATA ============
export type VATRecord = {
  month: string;
  outputVAT: number;
  inputVAT: number;
  netVAT: number;
  status: 'Filed' | 'Pending' | 'Due';
};
export const vatRecords: VATRecord[] = [];

// ============ INVOICES DATA ============
export type Invoice = {
  id: string;
  type: 'Agent' | 'Customer' | 'Supplier';
  party: string;
  amount: number;
  vat: number;
  total: number;
  currency: string;
  date: string;
  dueDate: string;
  status: 'Paid' | 'Unpaid' | 'Overdue';
};
export const invoices: Invoice[] = [];

// ============ LEADS DATA ============
export type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  service: string;
  status: 'New' | 'Contacted' | 'Quoted' | 'Converted' | 'Lost';
  value: number;
  date: string;
  followUp: string;
};
export const leads: Lead[] = [];

// ============ EMPLOYEES DATA ============
export type Employee = {
  id: string;
  name: string;
  department: string;
  role: string;
  salary: number;
  attendance: number;
  joinDate: string;
  status: 'Active' | 'On Leave' | 'Terminated';
};
export const employees: Employee[] = [];

// ============ BANK ACCOUNTS ============
export type BankAccount = {
  id: string;
  name: string;
  type: 'Bank' | 'Cash' | 'Online Gateway';
  balance: number;
  currency: string;
  bank: string;
};
export const bankAccounts: BankAccount[] = [];

// ============ PAYMENTS DATA ============
export type Payment = {
  id: string;
  type: 'Receipt' | 'Payment' | 'Refund';
  party: string;
  amount: number;
  method: string;
  date: string;
  reference: string;
  status: 'Completed' | 'Processing' | 'Failed';
};
export const payments: Payment[] = [];

// ============ CHART DATA ============
export const monthlyRevenue: { month: string; revenue: number; expenses: number; profit: number }[] = [];
export const serviceRevenue: { name: string; value: number; color: string }[] = [];
export const forecastData: { month: string; actual: number; projected: number; expenses: number }[] = [];
