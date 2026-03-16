// ============ DASHBOARD DATA ============
export const dashboardStats = {
  totalSales: 1245000,
  totalExpenses: 876000,
  profitLoss: 369000,
  agentOutstanding: 234500,
  supplierPayables: 189000,
  todaysRevenue: 42500,
  pendingPayments: 67800,
  newLeads: 24,
  vehicleUtilization: 78,
  paymentReceived: 312400,
  paymentMade: 198700,
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

export const bookings: Booking[] = [
  { id: 'BK-001', agent: 'Global Tours UK', customer: 'John Smith', serviceType: 'Tour Package', serviceDate: '2024-03-15', sellingPrice: 3500, vat: 175, currency: 'AED', paymentStatus: 'Paid' },
  { id: 'BK-002', agent: 'Asia Travel Co', customer: 'Li Wei', serviceType: 'Hotel Booking', serviceDate: '2024-03-16', sellingPrice: 2200, vat: 110, currency: 'AED', paymentStatus: 'Pending' },
  { id: 'BK-003', agent: 'Euro Holidays', customer: 'Maria Garcia', serviceType: 'Transfer', serviceDate: '2024-03-16', sellingPrice: 450, vat: 22.5, currency: 'AED', paymentStatus: 'Paid' },
  { id: 'BK-004', agent: 'Direct Customer', customer: 'Ahmed Hassan', serviceType: 'Visa Services', serviceDate: '2024-03-17', sellingPrice: 800, vat: 40, currency: 'AED', paymentStatus: 'Partial' },
  { id: 'BK-005', agent: 'US Travels Inc', customer: 'Sarah Johnson', serviceType: 'Activities', serviceDate: '2024-03-17', sellingPrice: 1200, vat: 60, currency: 'AED', paymentStatus: 'Paid' },
  { id: 'BK-006', agent: 'Global Tours UK', customer: 'James Brown', serviceType: 'Tour Package', serviceDate: '2024-03-18', sellingPrice: 5200, vat: 260, currency: 'AED', paymentStatus: 'Pending' },
  { id: 'BK-007', agent: 'Asia Travel Co', customer: 'Yuki Tanaka', serviceType: 'Tickets', serviceDate: '2024-03-18', sellingPrice: 950, vat: 47.5, currency: 'AED', paymentStatus: 'Paid' },
  { id: 'BK-008', agent: 'Euro Holidays', customer: 'Pierre Dupont', serviceType: 'Hotel Booking', serviceDate: '2024-03-19', sellingPrice: 4100, vat: 205, currency: 'AED', paymentStatus: 'Paid' },
  { id: 'BK-009', agent: 'Direct Customer', customer: 'Fatima Al-Said', serviceType: 'Tour Package', serviceDate: '2024-03-19', sellingPrice: 2800, vat: 140, currency: 'AED', paymentStatus: 'Pending' },
  { id: 'BK-010', agent: 'US Travels Inc', customer: 'Mike Williams', serviceType: 'Transfer', serviceDate: '2024-03-20', sellingPrice: 600, vat: 30, currency: 'AED', paymentStatus: 'Paid' },
];

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

export const agents: Agent[] = [
  { id: 'AG-001', name: 'Global Tours UK', country: 'United Kingdom', creditLimit: 100000, outstanding: 45000, paymentTerms: 'Net 30', commission: 12, totalBookings: 156, status: 'Active', email: 'info@globaltours.uk', phone: '+44 20 1234 5678' },
  { id: 'AG-002', name: 'Asia Travel Co', country: 'Singapore', creditLimit: 75000, outstanding: 32000, paymentTerms: 'Net 15', commission: 10, totalBookings: 98, status: 'Active', email: 'booking@asiatravel.sg', phone: '+65 6789 0123' },
  { id: 'AG-003', name: 'Euro Holidays', country: 'Germany', creditLimit: 120000, outstanding: 67500, paymentTerms: 'Net 30', commission: 15, totalBookings: 234, status: 'Active', email: 'sales@euroholidays.de', phone: '+49 30 5678 9012' },
  { id: 'AG-004', name: 'US Travels Inc', country: 'United States', creditLimit: 90000, outstanding: 28000, paymentTerms: 'Net 45', commission: 11, totalBookings: 87, status: 'Active', email: 'ops@ustravels.com', phone: '+1 212 345 6789' },
  { id: 'AG-005', name: 'India Voyages', country: 'India', creditLimit: 50000, outstanding: 15000, paymentTerms: 'Prepaid', commission: 8, totalBookings: 45, status: 'Active', email: 'contact@indiavoyages.in', phone: '+91 11 2345 6789' },
  { id: 'AG-006', name: 'China Explorer', country: 'China', creditLimit: 60000, outstanding: 0, paymentTerms: 'Net 15', commission: 9, totalBookings: 23, status: 'Inactive', email: 'info@chinaexplorer.cn', phone: '+86 10 8765 4321' },
];

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

export const suppliers: Supplier[] = [
  { id: 'SP-001', name: 'Marriott Hotels UAE', type: 'Hotel', contact: 'Ali Mansoor', email: 'accounts@marriott-uae.com', totalPayable: 85000, paidAmount: 62000, status: 'Active' },
  { id: 'SP-002', name: 'Desert Safari LLC', type: 'Activity Provider', contact: 'Khalid Ahmed', email: 'info@desertsafari.ae', totalPayable: 34000, paidAmount: 34000, status: 'Active' },
  { id: 'SP-003', name: 'City Transport Co', type: 'Transport', contact: 'Rajan Kumar', email: 'fleet@citytransport.ae', totalPayable: 45000, paidAmount: 30000, status: 'Active' },
  { id: 'SP-004', name: 'Dubai Attractions', type: 'Activity Provider', contact: 'Sara Khan', email: 'tickets@dubaiattr.ae', totalPayable: 28000, paidAmount: 20000, status: 'Active' },
  { id: 'SP-005', name: 'Premium Stays', type: 'Hotel', contact: 'Mohammed Rafi', email: 'reservations@premiumstays.ae', totalPayable: 56000, paidAmount: 45000, status: 'Active' },
  { id: 'SP-006', name: 'Guide Masters', type: 'Tour Guide', contact: 'Priya Sharma', email: 'team@guidemasters.ae', totalPayable: 12000, paidAmount: 8000, status: 'Active' },
];

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

export const expenses: Expense[] = [
  { id: 'EX-001', category: 'Fuel', supplier: 'ADNOC Station', amount: 2500, paymentMode: 'Cash', date: '2024-03-15', description: 'Fleet fuel - Week 11', status: 'Paid' },
  { id: 'EX-002', category: 'Driver Salary', supplier: 'Internal', amount: 15000, paymentMode: 'Bank Transfer', date: '2024-03-01', description: 'March driver salaries', status: 'Paid' },
  { id: 'EX-003', category: 'Hotel Payment', supplier: 'Marriott Hotels UAE', amount: 32000, paymentMode: 'Bank Transfer', date: '2024-03-10', description: 'Feb hotel settlements', status: 'Paid' },
  { id: 'EX-004', category: 'Activity Tickets', supplier: 'Dubai Attractions', amount: 8500, paymentMode: 'Bank Transfer', date: '2024-03-12', description: 'Burj Khalifa tickets batch', status: 'Pending' },
  { id: 'EX-005', category: 'Office Rent', supplier: 'Dubai Properties', amount: 18000, paymentMode: 'Bank Transfer', date: '2024-03-01', description: 'March office rent', status: 'Paid' },
  { id: 'EX-006', category: 'Marketing', supplier: 'Digital Agency', amount: 5000, paymentMode: 'Online', date: '2024-03-05', description: 'Google Ads March', status: 'Paid' },
  { id: 'EX-007', category: 'Fuel', supplier: 'ADNOC Station', amount: 2200, paymentMode: 'Cash', date: '2024-03-08', description: 'Fleet fuel - Week 10', status: 'Paid' },
  { id: 'EX-008', category: 'Hotel Payment', supplier: 'Premium Stays', amount: 25000, paymentMode: 'Bank Transfer', date: '2024-03-14', description: 'Feb hotel settlements', status: 'Pending' },
];

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

export const vehicles: Vehicle[] = [
  { id: 'VH-001', plate: 'DXB-A-12345', type: 'Sedan', driver: 'Rajan Kumar', status: 'Available', fuelCost: 800, trips: 45, revenue: 13500 },
  { id: 'VH-002', plate: 'DXB-B-67890', type: 'SUV', driver: 'Ahmed Ali', status: 'On Trip', fuelCost: 1200, trips: 38, revenue: 15200 },
  { id: 'VH-003', plate: 'DXB-C-11223', type: 'Van (14-seater)', driver: 'John Mathew', status: 'Available', fuelCost: 1500, trips: 28, revenue: 19600 },
  { id: 'VH-004', plate: 'DXB-D-44556', type: 'Bus (35-seater)', driver: 'Suresh Nair', status: 'On Trip', fuelCost: 2200, trips: 15, revenue: 22500 },
  { id: 'VH-005', plate: 'DXB-E-77889', type: 'Sedan', driver: 'Karim Hassan', status: 'Maintenance', fuelCost: 600, trips: 42, revenue: 12600 },
  { id: 'VH-006', plate: 'DXB-F-99001', type: 'Luxury SUV', driver: 'David Lee', status: 'Available', fuelCost: 1400, trips: 22, revenue: 17600 },
];

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

export const tourPackages: TourPackage[] = [
  { id: 'TP-001', name: 'Dubai City Tour - 3N/4D', price: 3500, hotelCost: 1800, transferCost: 400, ticketsCost: 600, guideCost: 200, otherCost: 0, profit: 500, bookings: 45 },
  { id: 'TP-002', name: 'Abu Dhabi Explorer - 2N/3D', price: 2800, hotelCost: 1400, transferCost: 350, ticketsCost: 450, guideCost: 150, otherCost: 0, profit: 450, bookings: 32 },
  { id: 'TP-003', name: 'UAE Grand Tour - 5N/6D', price: 6500, hotelCost: 3200, transferCost: 800, ticketsCost: 1100, guideCost: 400, otherCost: 200, profit: 800, bookings: 18 },
  { id: 'TP-004', name: 'Desert Safari Premium', price: 850, hotelCost: 0, transferCost: 200, ticketsCost: 350, guideCost: 100, otherCost: 50, profit: 150, bookings: 120 },
  { id: 'TP-005', name: 'Dubai Shopping Festival', price: 4200, hotelCost: 2100, transferCost: 500, ticketsCost: 800, guideCost: 250, otherCost: 100, profit: 450, bookings: 28 },
];

// ============ VAT DATA ============
export type VATRecord = {
  month: string;
  outputVAT: number;
  inputVAT: number;
  netVAT: number;
  status: 'Filed' | 'Pending' | 'Due';
};

export const vatRecords: VATRecord[] = [
  { month: 'January 2024', outputVAT: 28500, inputVAT: 19200, netVAT: 9300, status: 'Filed' },
  { month: 'February 2024', outputVAT: 32100, inputVAT: 21500, netVAT: 10600, status: 'Filed' },
  { month: 'March 2024', outputVAT: 35800, inputVAT: 24100, netVAT: 11700, status: 'Pending' },
];

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

export const invoices: Invoice[] = [
  { id: 'INV-001', type: 'Agent', party: 'Global Tours UK', amount: 15000, vat: 750, total: 15750, currency: 'AED', date: '2024-03-01', dueDate: '2024-03-31', status: 'Unpaid' },
  { id: 'INV-002', type: 'Customer', party: 'Ahmed Hassan', amount: 3500, vat: 175, total: 3675, currency: 'AED', date: '2024-03-05', dueDate: '2024-03-20', status: 'Paid' },
  { id: 'INV-003', type: 'Supplier', party: 'Marriott Hotels UAE', amount: 32000, vat: 1600, total: 33600, currency: 'AED', date: '2024-03-10', dueDate: '2024-04-10', status: 'Unpaid' },
  { id: 'INV-004', type: 'Agent', party: 'Euro Holidays', amount: 22000, vat: 1100, total: 23100, currency: 'AED', date: '2024-03-08', dueDate: '2024-04-07', status: 'Overdue' },
  { id: 'INV-005', type: 'Customer', party: 'Sarah Johnson', amount: 1200, vat: 60, total: 1260, currency: 'AED', date: '2024-03-12', dueDate: '2024-03-27', status: 'Paid' },
  { id: 'INV-006', type: 'Supplier', party: 'Desert Safari LLC', amount: 18000, vat: 900, total: 18900, currency: 'AED', date: '2024-03-14', dueDate: '2024-04-14', status: 'Paid' },
  { id: 'INV-007', type: 'Agent', party: 'Asia Travel Co', amount: 8500, vat: 425, total: 8925, currency: 'AED', date: '2024-03-15', dueDate: '2024-03-30', status: 'Unpaid' },
];

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

export const leads: Lead[] = [
  { id: 'LD-001', name: 'Robert Chen', email: 'robert@email.com', phone: '+86 139 1234 5678', source: 'Website', service: 'Tour Package', status: 'New', value: 5200, date: '2024-03-18', followUp: '2024-03-20' },
  { id: 'LD-002', name: 'Emma Wilson', email: 'emma@email.com', phone: '+44 7911 123456', source: 'WhatsApp', service: 'Hotel Booking', status: 'Contacted', value: 3800, date: '2024-03-17', followUp: '2024-03-19' },
  { id: 'LD-003', name: 'Carlos Rodriguez', email: 'carlos@email.com', phone: '+34 612 345 678', source: 'Email', service: 'Tour Package', status: 'Quoted', value: 8500, date: '2024-03-15', followUp: '2024-03-18' },
  { id: 'LD-004', name: 'Aisha Malik', email: 'aisha@email.com', phone: '+971 50 123 4567', source: 'Walk-in', service: 'Visa Services', status: 'Converted', value: 2400, date: '2024-03-14', followUp: '' },
  { id: 'LD-005', name: 'Tom Anderson', email: 'tom@email.com', phone: '+1 415 555 0123', source: 'Travel Agent', service: 'Activities', status: 'New', value: 1800, date: '2024-03-18', followUp: '2024-03-21' },
  { id: 'LD-006', name: 'Yuki Sato', email: 'yuki@email.com', phone: '+81 90 1234 5678', source: 'Website', service: 'Tour Package', status: 'Contacted', value: 6200, date: '2024-03-16', followUp: '2024-03-19' },
];

// ============ EMPLOYEES DATA ============
export type Employee = {
  id: string;
  name: string;
  department: string;
  role: string;
  salary: number;
  attendance: number;
  joinDate: string;
  status: 'Active' | 'On Leave';
};

export const employees: Employee[] = [
  { id: 'EMP-001', name: 'Rajan Kumar', department: 'Transport', role: 'Driver', salary: 4500, attendance: 26, joinDate: '2022-01-15', status: 'Active' },
  { id: 'EMP-002', name: 'Ahmed Ali', department: 'Transport', role: 'Driver', salary: 4500, attendance: 24, joinDate: '2022-03-01', status: 'Active' },
  { id: 'EMP-003', name: 'Sara Khan', department: 'Sales', role: 'Sales Manager', salary: 12000, attendance: 22, joinDate: '2021-06-15', status: 'Active' },
  { id: 'EMP-004', name: 'John Mathew', department: 'Transport', role: 'Senior Driver', salary: 5500, attendance: 25, joinDate: '2020-09-01', status: 'Active' },
  { id: 'EMP-005', name: 'Priya Sharma', department: 'Operations', role: 'Operations Coordinator', salary: 8000, attendance: 23, joinDate: '2023-02-01', status: 'Active' },
  { id: 'EMP-006', name: 'Mohammed Rafi', department: 'Accounts', role: 'Accountant', salary: 10000, attendance: 22, joinDate: '2021-11-01', status: 'On Leave' },
  { id: 'EMP-007', name: 'Suresh Nair', department: 'Transport', role: 'Driver', salary: 4500, attendance: 27, joinDate: '2023-05-15', status: 'Active' },
  { id: 'EMP-008', name: 'Fatima Al-Said', department: 'Sales', role: 'Sales Executive', salary: 7500, attendance: 21, joinDate: '2023-08-01', status: 'Active' },
];

// ============ BANK ACCOUNTS ============
export type BankAccount = {
  id: string;
  name: string;
  type: 'Bank' | 'Cash' | 'Online Gateway';
  balance: number;
  currency: string;
  bank: string;
};

export const bankAccounts: BankAccount[] = [
  { id: 'BA-001', name: 'Main Operating Account', type: 'Bank', balance: 456000, currency: 'AED', bank: 'Emirates NBD' },
  { id: 'BA-002', name: 'Savings Account', type: 'Bank', balance: 230000, currency: 'AED', bank: 'ADCB' },
  { id: 'BA-003', name: 'Petty Cash', type: 'Cash', balance: 15000, currency: 'AED', bank: 'Office' },
  { id: 'BA-004', name: 'Stripe Gateway', type: 'Online Gateway', balance: 34500, currency: 'AED', bank: 'Stripe' },
  { id: 'BA-005', name: 'PayPal Business', type: 'Online Gateway', balance: 12800, currency: 'AED', bank: 'PayPal' },
];

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

export const payments: Payment[] = [
  { id: 'PAY-001', type: 'Receipt', party: 'Global Tours UK', amount: 15000, method: 'Bank Transfer', date: '2024-03-15', reference: 'REF-2024-001', status: 'Completed' },
  { id: 'PAY-002', type: 'Payment', party: 'Marriott Hotels UAE', amount: 32000, method: 'Bank Transfer', date: '2024-03-10', reference: 'REF-2024-002', status: 'Completed' },
  { id: 'PAY-003', type: 'Receipt', party: 'Ahmed Hassan', amount: 3675, method: 'Card Payment', date: '2024-03-12', reference: 'REF-2024-003', status: 'Completed' },
  { id: 'PAY-004', type: 'Refund', party: 'Emma Wilson', amount: 1200, method: 'Bank Transfer', date: '2024-03-14', reference: 'REF-2024-004', status: 'Processing' },
  { id: 'PAY-005', type: 'Payment', party: 'Desert Safari LLC', amount: 18000, method: 'Bank Transfer', date: '2024-03-16', reference: 'REF-2024-005', status: 'Completed' },
  { id: 'PAY-006', type: 'Receipt', party: 'Euro Holidays', amount: 8500, method: 'Payment Link', date: '2024-03-17', reference: 'REF-2024-006', status: 'Processing' },
];

// ============ CHART DATA ============
export const monthlyRevenue = [
  { month: 'Oct', revenue: 185000, expenses: 132000, profit: 53000 },
  { month: 'Nov', revenue: 210000, expenses: 148000, profit: 62000 },
  { month: 'Dec', revenue: 265000, expenses: 178000, profit: 87000 },
  { month: 'Jan', revenue: 195000, expenses: 140000, profit: 55000 },
  { month: 'Feb', revenue: 230000, expenses: 156000, profit: 74000 },
  { month: 'Mar', revenue: 248000, expenses: 165000, profit: 83000 },
];

export const serviceRevenue = [
  { name: 'Tour Packages', value: 485000, color: '#3b82f6' },
  { name: 'Hotel Bookings', value: 312000, color: '#10b981' },
  { name: 'Transfers', value: 156000, color: '#f59e0b' },
  { name: 'Activities', value: 134000, color: '#8b5cf6' },
  { name: 'Visa Services', value: 98000, color: '#ef4444' },
  { name: 'Tickets', value: 60000, color: '#06b6d4' },
];

export const forecastData = [
  { month: 'Apr', actual: 0, projected: 275000, expenses: 185000 },
  { month: 'May', actual: 0, projected: 310000, expenses: 205000 },
  { month: 'Jun', actual: 0, projected: 290000, expenses: 195000 },
  { month: 'Jul', actual: 0, projected: 340000, expenses: 225000 },
  { month: 'Aug', actual: 0, projected: 320000, expenses: 215000 },
  { month: 'Sep', actual: 0, projected: 355000, expenses: 235000 },
];
