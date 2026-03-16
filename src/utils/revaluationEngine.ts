// ─── Currency Revaluation Engine ─────────────────────────────────────────────
// Implements month-end FX revaluation per double-entry accounting standards.
//
// EXAMPLE (as specified):
//   Invoice recorded:   USD 1,000 @ 3.67 = AED 3,670
//   New rate:           3.70
//   New value:          USD 1,000 @ 3.70 = AED 3,700
//   Difference:         AED 30 (LOSS on payable, GAIN on receivable)
//
//   Journal Entry Generated:
//     Dr  Exchange Loss (5998)          AED 30
//     Cr  Accounts Receivable (1200)   AED 30
// ─────────────────────────────────────────────────────────────────────────────

export type DocumentType = 'Invoice' | 'Bill' | 'Payment' | 'Advance' | 'Deposit';
export type RevalStatus  = 'Pending' | 'Calculated' | 'Posted' | 'Reversed';
export type GainLossType = 'Gain' | 'Loss' | 'None';

// ─── Open Document (foreign-currency monetary item) ──────────────────────────
export interface OpenDocument {
  id: string;
  docNumber: string;
  docType: DocumentType;
  party: string;
  partyType: 'Customer' | 'Supplier' | 'Agent';
  currency: string;           // e.g. "USD"
  foreignAmount: number;      // original amount in foreign currency
  bookedRate: number;         // exchange rate when document was recorded
  bookedBase: number;         // foreignAmount × bookedRate (in AED)
  docDate: string;            // ISO date
  dueDate?: string;
  glAccount: string;          // account code (e.g. "1200" for AR, "2000" for AP)
  glAccountName: string;
}

// ─── Revaluation Line (one per open document) ────────────────────────────────
export interface RevalLine {
  docId: string;
  docNumber: string;
  docType: DocumentType;
  party: string;
  currency: string;
  foreignAmount: number;
  bookedRate: number;
  bookedBase: number;          // AED at booking rate
  newRate: number;             // current / period-end rate
  newBase: number;             // foreignAmount × newRate
  difference: number;          // newBase − bookedBase (positive = gain, negative = loss)
  gainLossType: GainLossType;
  glAccount: string;
  glAccountName: string;
  // Generated JE lines
  jeLines: RevalJELine[];
}

// ─── Journal Entry Line for Revaluation ──────────────────────────────────────
export interface RevalJELine {
  lineNo: number;
  accountCode: string;
  accountName: string;
  description: string;
  debit: number;
  credit: number;
  currency: string;            // always base (AED)
}

// ─── Revaluation Run ─────────────────────────────────────────────────────────
export interface RevalRun {
  id: string;
  period: string;              // e.g. "2024-01"
  periodName: string;          // e.g. "January 2024"
  runDate: string;
  baseCurrency: string;
  status: RevalStatus;
  lines: RevalLine[];
  totalGain: number;
  totalLoss: number;
  netGainLoss: number;
  netType: GainLossType;
  journalEntryId?: string;     // linked JE after posting
  reversalEntryId?: string;    // linked reversal JE
  postedBy?: string;
  postedAt?: string;
  reversedBy?: string;
  reversedAt?: string;
  notes?: string;
}

// ─── Generated Journal Entry ──────────────────────────────────────────────────
export interface RevalJournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  period: string;
  description: string;
  reference: string;
  source: 'FXRevaluation';
  isReversal: boolean;
  reversalOf?: string;
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  status: 'Draft' | 'Posted';
  lines: RevalJELine[];
  revalRunId: string;
  createdAt: string;
  createdBy: string;
}

// ─── GL Account Mapping ────────────────────────────────────────────────────────
export const REVAL_ACCOUNTS = {
  FX_GAIN_REALIZED:   { code: '4999', name: 'Realized FX Gain' },
  FX_LOSS_REALIZED:   { code: '5998', name: 'Realized FX Loss' },
  FX_GAIN_UNREALIZED: { code: '4998', name: 'Unrealized FX Gain' },
  FX_LOSS_UNREALIZED: { code: '5997', name: 'Unrealized FX Loss' },
  AR:                 { code: '1200', name: 'Accounts Receivable' },
  AP:                 { code: '2000', name: 'Accounts Payable' },
} as const;

// ─── CORE: Compute Revaluation Lines ─────────────────────────────────────────
//
// For each open foreign-currency document:
//   bookedBase  = foreignAmount × bookedRate
//   newBase     = foreignAmount × newRate
//   difference  = newBase − bookedBase
//
// If AR (asset) and newBase > bookedBase → GAIN (value of receivable increased)
//   Dr  Accounts Receivable (1200)     AED |diff|
//   Cr  Unrealized FX Gain  (4998)     AED |diff|
//
// If AR (asset) and newBase < bookedBase → LOSS (value of receivable decreased)
//   Dr  Unrealized FX Loss  (5997)     AED |diff|
//   Cr  Accounts Receivable (1200)     AED |diff|
//
// If AP (liability) and newBase > bookedBase → LOSS (we owe more)
//   Dr  Unrealized FX Loss  (5997)     AED |diff|
//   Cr  Accounts Payable    (2000)     AED |diff|
//
// If AP (liability) and newBase < bookedBase → GAIN (we owe less)
//   Dr  Accounts Payable    (2000)     AED |diff|
//   Cr  Unrealized FX Gain  (4998)     AED |diff|
// ─────────────────────────────────────────────────────────────────────────────

export function computeRevalLine(
  doc: OpenDocument,
  newRate: number,
  baseCurrency = 'AED'
): RevalLine {
  const newBase    = round4(doc.foreignAmount * newRate);
  const difference = round4(newBase - doc.bookedBase);
  const absDiff    = Math.abs(difference);

  let gainLossType: GainLossType = 'None';
  let jeLines: RevalJELine[] = [];

  if (absDiff < 0.005) {
    // No meaningful difference
    gainLossType = 'None';
    jeLines = [];
  } else {
    const isAsset    = doc.glAccount === REVAL_ACCOUNTS.AR.code || doc.partyType === 'Customer';
    const isGain     = isAsset ? difference > 0 : difference < 0;
    gainLossType     = isGain ? 'Gain' : 'Loss';

    const gainAcc    = REVAL_ACCOUNTS.FX_GAIN_UNREALIZED;
    const lossAcc    = REVAL_ACCOUNTS.FX_LOSS_UNREALIZED;
    const monetaryAcc = { code: doc.glAccount, name: doc.glAccountName };
    const desc       = `FX Reval ${doc.docNumber} | ${doc.currency} ${doc.foreignAmount.toLocaleString()} @ ${newRate} vs ${doc.bookedRate}`;

    if (isAsset && isGain) {
      // Dr AR / Cr FX Gain
      jeLines = [
        { lineNo: 1, accountCode: monetaryAcc.code, accountName: monetaryAcc.name, description: desc, debit: absDiff, credit: 0,      currency: baseCurrency },
        { lineNo: 2, accountCode: gainAcc.code,      accountName: gainAcc.name,      description: desc, debit: 0,      credit: absDiff, currency: baseCurrency },
      ];
    } else if (isAsset && !isGain) {
      // Dr FX Loss / Cr AR  ← THE SPECIFIED EXAMPLE
      jeLines = [
        { lineNo: 1, accountCode: lossAcc.code,      accountName: lossAcc.name,      description: desc, debit: absDiff, credit: 0,      currency: baseCurrency },
        { lineNo: 2, accountCode: monetaryAcc.code,  accountName: monetaryAcc.name,  description: desc, debit: 0,      credit: absDiff, currency: baseCurrency },
      ];
    } else if (!isAsset && isGain) {
      // Dr AP / Cr FX Gain
      jeLines = [
        { lineNo: 1, accountCode: monetaryAcc.code, accountName: monetaryAcc.name, description: desc, debit: absDiff, credit: 0,      currency: baseCurrency },
        { lineNo: 2, accountCode: gainAcc.code,      accountName: gainAcc.name,      description: desc, debit: 0,      credit: absDiff, currency: baseCurrency },
      ];
    } else {
      // Dr FX Loss / Cr AP
      jeLines = [
        { lineNo: 1, accountCode: lossAcc.code,      accountName: lossAcc.name,      description: desc, debit: absDiff, credit: 0,      currency: baseCurrency },
        { lineNo: 2, accountCode: monetaryAcc.code,  accountName: monetaryAcc.name,  description: desc, debit: 0,      credit: absDiff, currency: baseCurrency },
      ];
    }
  }

  return {
    docId: doc.id,
    docNumber: doc.docNumber,
    docType: doc.docType,
    party: doc.party,
    currency: doc.currency,
    foreignAmount: doc.foreignAmount,
    bookedRate: doc.bookedRate,
    bookedBase: doc.bookedBase,
    newRate,
    newBase,
    difference,
    gainLossType,
    glAccount: doc.glAccount,
    glAccountName: doc.glAccountName,
    jeLines,
  };
}

// ─── Run Full Revaluation for a Period ───────────────────────────────────────
export function runRevaluation(
  runId: string,
  period: string,
  periodName: string,
  openDocuments: OpenDocument[],
  rateMap: Record<string, number>,   // { USD: 3.70, EUR: 4.01, ... }
  baseCurrency = 'AED'
): RevalRun {
  const lines: RevalLine[] = openDocuments
    .filter(d => d.currency !== baseCurrency)
    .map(d => {
      const newRate = rateMap[d.currency] ?? d.bookedRate;
      return computeRevalLine(d, newRate, baseCurrency);
    });

  const totalGain = lines.filter(l => l.gainLossType === 'Gain').reduce((s, l) =>  s + Math.abs(l.difference), 0);
  const totalLoss = lines.filter(l => l.gainLossType === 'Loss').reduce((s, l) =>  s + Math.abs(l.difference), 0);
  const netGainLoss = round4(totalGain - totalLoss);

  return {
    id: runId,
    period,
    periodName,
    runDate: new Date().toISOString().slice(0, 10),
    baseCurrency,
    status: 'Calculated',
    lines,
    totalGain: round4(totalGain),
    totalLoss: round4(totalLoss),
    netGainLoss,
    netType: netGainLoss > 0.005 ? 'Gain' : netGainLoss < -0.005 ? 'Loss' : 'None',
  };
}

// ─── Generate Consolidated Journal Entry from a RevalRun ─────────────────────
// Consolidates all per-document JE lines into one balanced journal entry.
// Every monetary account gets its own consolidated Dr/Cr line.
export function generateRevalJE(
  run: RevalRun,
  jeId: string,
  isReversal = false,
  reversalOf?: string
): RevalJournalEntry {
  // Aggregate lines by account
  const agg: Record<string, { name: string; debit: number; credit: number }> = {};

  for (const line of run.lines) {
    if (line.jeLines.length === 0) continue;
    for (const jl of line.jeLines) {
      if (!agg[jl.accountCode]) agg[jl.accountCode] = { name: jl.accountName, debit: 0, credit: 0 };
      if (isReversal) {
        agg[jl.accountCode].debit  += jl.credit;   // swap for reversal
        agg[jl.accountCode].credit += jl.debit;
      } else {
        agg[jl.accountCode].debit  += jl.debit;
        agg[jl.accountCode].credit += jl.credit;
      }
    }
  }

  const consolidated: RevalJELine[] = Object.entries(agg).map(([code, v], i) => ({
    lineNo: i + 1,
    accountCode: code,
    accountName: v.name,
    description: isReversal ? `Reversal: FX Revaluation ${run.period}` : `FX Revaluation ${run.period}`,
    debit: round4(v.debit),
    credit: round4(v.credit),
    currency: run.baseCurrency,
  }));

  const totalDebit  = round4(consolidated.reduce((s, l) => s + l.debit,  0));
  const totalCredit = round4(consolidated.reduce((s, l) => s + l.credit, 0));
  const num = isReversal ? `REV-REVAL-${run.period}` : `REVAL-${run.period}`;

  return {
    id: jeId,
    entryNumber: num,
    date: run.runDate,
    period: run.period,
    description: isReversal
      ? `Reversal of FX Revaluation — ${run.periodName}`
      : `FX Revaluation (Unrealized) — ${run.periodName}`,
    reference: num,
    source: 'FXRevaluation',
    isReversal,
    reversalOf,
    totalDebit,
    totalCredit,
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
    status: 'Draft',
    lines: consolidated,
    revalRunId: run.id,
    createdAt: new Date().toISOString(),
    createdBy: 'Current User',
  };
}

// ─── Generate Reversal JE ─────────────────────────────────────────────────────
// At the start of next period, reverse the unrealized revaluation.
// This is standard practice — unrealized entries are temporary.
export function generateReversalJE(
  run: RevalRun,
  originalJeId: string,
  reversalJeId: string,
  reversalDate: string
): RevalJournalEntry {
  const reversal = generateRevalJE(run, reversalJeId, true, originalJeId);
  reversal.date = reversalDate;
  reversal.period = reversalDate.slice(0, 7);
  return reversal;
}

// ─── Sample Open Documents (for demo) ─────────────────────────────────────────
export function getSampleOpenDocuments(): OpenDocument[] {
  return [
    {
      id: 'INV-001',
      docNumber: 'INV-2024-001',
      docType: 'Invoice',
      party: 'Global Tours LLC',
      partyType: 'Customer',
      currency: 'USD',
      foreignAmount: 1000,
      bookedRate: 3.67,
      bookedBase: 3670,
      docDate: '2024-01-15',
      dueDate: '2024-02-15',
      glAccount: '1200',
      glAccountName: 'Accounts Receivable',
    },
    {
      id: 'INV-002',
      docNumber: 'INV-2024-002',
      docType: 'Invoice',
      party: 'European Travel Co',
      partyType: 'Customer',
      currency: 'EUR',
      foreignAmount: 2500,
      bookedRate: 4.01,
      bookedBase: 10025,
      docDate: '2024-01-18',
      dueDate: '2024-02-18',
      glAccount: '1200',
      glAccountName: 'Accounts Receivable',
    },
    {
      id: 'BILL-001',
      docNumber: 'BILL-2024-001',
      docType: 'Bill',
      party: 'InterHotel Group',
      partyType: 'Supplier',
      currency: 'USD',
      foreignAmount: 800,
      bookedRate: 3.67,
      bookedBase: 2936,
      docDate: '2024-01-10',
      dueDate: '2024-02-10',
      glAccount: '2000',
      glAccountName: 'Accounts Payable',
    },
    {
      id: 'INV-003',
      docNumber: 'INV-2024-003',
      docType: 'Invoice',
      party: 'UK Adventures Ltd',
      partyType: 'Customer',
      currency: 'GBP',
      foreignAmount: 1500,
      bookedRate: 4.65,
      bookedBase: 6975,
      docDate: '2024-01-20',
      dueDate: '2024-02-20',
      glAccount: '1200',
      glAccountName: 'Accounts Receivable',
    },
    {
      id: 'BILL-002',
      docNumber: 'BILL-2024-002',
      docType: 'Bill',
      party: 'Euro Bus Services',
      partyType: 'Supplier',
      currency: 'EUR',
      foreignAmount: 1200,
      bookedRate: 4.01,
      bookedBase: 4812,
      docDate: '2024-01-12',
      dueDate: '2024-02-12',
      glAccount: '2000',
      glAccountName: 'Accounts Payable',
    },
  ];
}

// ─── Accounting Periods ───────────────────────────────────────────────────────
export interface RevalPeriod {
  value: string;   // "2024-01"
  label: string;   // "January 2024"
  runDate: string; // last day of month
}

export function getRecentPeriods(count = 12): RevalPeriod[] {
  const periods: RevalPeriod[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const value = `${year}-${String(month + 1).padStart(2, '0')}`;
    const lastDay = new Date(year, month + 1, 0);
    periods.push({
      value,
      label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      runDate: lastDay.toISOString().slice(0, 10),
    });
  }
  return periods;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function formatAED(n: number): string {
  return `AED ${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatForeign(n: number, currency: string): string {
  return `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
