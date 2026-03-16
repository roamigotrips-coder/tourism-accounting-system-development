// Accounting Types
export interface Account {
  id: string;
  code: string;
  name: string;
  type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  parentId?: string;
  description?: string;
  status: 'Active' | 'Inactive';
  isDefault: boolean;
  balance: {
    opening: number;
    debitTotal: number;
    creditTotal: number;
    current: number;
  };
  lastTransactionDate?: string;
  createdAt: string;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  reference?: string;
  status: 'Posted' | 'Draft' | 'Reversed';
  lines: JournalEntryLine[];
  createdAt: string;
  createdBy: string;
  totalDebit: number;
  totalCredit: number;
}

export interface JournalEntryLine {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface LedgerEntry {
  id: string;
  date: string;
  entryNumber: string;
  description: string;
  reference?: string;
  debit: number;
  credit: number;
  balance: number;
  accountCode: string;
  accountName: string;
  entryType: 'Journal' | 'Invoice' | 'Payment' | 'Receipt' | 'Purchase' | 'Expense';
}

export interface TrialBalanceAccount {
  code: string;
  name: string;
  type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  debit: number;
  credit: number;
  balance: number;
}

export interface RecurringBilling {
  id: string;
  name: string;
  frequency: 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly';
  amount: number;
  debitAccountId: string;
  creditAccountId: string;
  description: string;
  nextRunDate: string;
  startDate: string;
  endDate?: string;
  status: 'Active' | 'Paused' | 'Completed';
  lastRunDate?: string;
  runCount: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  entityId?: string;
  entityType?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  category: string;
  description?: string;
  unit: string;
  quantity: number;
  minStockLevel: number;
  maxStockLevel: number;
  unitCost: number;
  totalValue: number;
  reorderPoint: number;
  location: string;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Discontinued';
  lastReorderDate?: string;
  supplier?: string;
  createdAt: string;
}

export interface InventoryTransaction {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  transactionType: 'In' | 'Out' | 'Adjustment' | 'Transfer';
  quantity: number;
  unitCost: number;
  totalCost: number;
  reference?: string;
  notes?: string;
  userId: string;
  userName: string;
  timestamp: string;
}

export interface FixedAsset {
  id: string;
  code: string;
  name: string;
  category: string;
  description?: string;
  location: string;
  purchaseDate: string;
  purchasePrice: number;
  salvageValue: number;
  usefulLifeYears: number;
  depreciationMethod: 'Straight Line' | 'Declining Balance' | 'Units of Production';
  accumulatedDepreciation: number;
  currentValue: number;
  status: 'Active' | 'Disposing' | 'Disposed';
  assignedTo?: string;
  barcode?: string;
  imageUrl?: string;
  warrantyExpiry?: string;
  maintenanceDate?: string;
  createdAt: string;
}

export interface MaintenanceRecord {
  id: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  type: 'Inspection' | 'Repair' | 'Replacement' | 'Upgrade';
  cost: number;
  performedBy: string;
  remarks?: string;
  date: string;
  attachments?: string[];
  createdAt: string;
}