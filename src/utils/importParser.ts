// ─── Import Parser ─────────────────────────────────────────────────────────────
// Handles CSV, Excel (.xlsx/.xls) bank statement parsing with column mapping presets

import * as XLSX from 'xlsx';
import type { BankTx, BookTx } from './reconciliationEngine';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ColumnMapping {
  date: string;
  description: string;
  reference: string;
  debit: string;
  credit: string;
  balance: string;
}

export interface MappingPreset {
  id: string;
  name: string;
  bank: string;
  delimiter: ',' | ';' | '\t';
  dateFormat: string; // 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
  columns: ColumnMapping;
  skipRows: number;
  createdAt: string;
}

export interface ParsedRow {
  raw: Record<string, string>;
  date: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  valid: boolean;
  errors: string[];
  rowIndex: number;
}

export interface ParseResult {
  rows: ParsedRow[];
  headers: string[];
  filename: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  detectedPreset?: string;
  rawData: Record<string, string>[][];
}

// ─── Built-in Presets ─────────────────────────────────────────────────────────
export const BUILT_IN_PRESETS: MappingPreset[] = [
  {
    id: 'PRESET-001',
    name: 'Emirates NBD Standard',
    bank: 'Emirates NBD',
    delimiter: ',',
    dateFormat: 'DD/MM/YYYY',
    columns: { date: 'Date', description: 'Description', reference: 'Reference', debit: 'Debit', credit: 'Credit', balance: 'Balance' },
    skipRows: 0,
    createdAt: '2024-01-15',
  },
  {
    id: 'PRESET-002',
    name: 'ADCB Export',
    bank: 'ADCB',
    delimiter: ',',
    dateFormat: 'MM/DD/YYYY',
    columns: { date: 'Transaction Date', description: 'Narration', reference: 'Ref No', debit: 'Withdrawals', credit: 'Deposits', balance: 'Running Balance' },
    skipRows: 1,
    createdAt: '2024-02-01',
  },
  {
    id: 'PRESET-003',
    name: 'FAB Statement',
    bank: 'FAB',
    delimiter: ';',
    dateFormat: 'YYYY-MM-DD',
    columns: { date: 'VALUE DATE', description: 'DESCRIPTION', reference: 'REFERENCE', debit: 'DEBIT', credit: 'CREDIT', balance: 'BALANCE' },
    skipRows: 2,
    createdAt: '2024-02-10',
  },
  {
    id: 'PRESET-004',
    name: 'Mashreq Bank',
    bank: 'Mashreq',
    delimiter: ',',
    dateFormat: 'DD/MM/YYYY',
    columns: { date: 'Trans Date', description: 'Trans Particulars', reference: 'Cheque No', debit: 'Debit Amount', credit: 'Credit Amount', balance: 'Balance' },
    skipRows: 0,
    createdAt: '2024-03-01',
  },
  {
    id: 'PRESET-005',
    name: 'RAK Bank CSV',
    bank: 'RAK Bank',
    delimiter: ',',
    dateFormat: 'DD-MM-YYYY',
    columns: { date: 'Date', description: 'Remarks', reference: 'Reference', debit: 'Withdrawal', credit: 'Deposit', balance: 'Balance' },
    skipRows: 0,
    createdAt: '2024-03-05',
  },
];

// ─── Date Parsers ─────────────────────────────────────────────────────────────
function parseDate(raw: string, format: string): string {
  if (!raw) return '';
  const s = raw.trim().replace(/\./g, '/');

  try {
    let day = '', month = '', year = '';

    if (format === 'DD/MM/YYYY') {
      const parts = s.split(/[\/\-]/);
      if (parts.length >= 3) { [day, month, year] = parts; }
    } else if (format === 'MM/DD/YYYY') {
      const parts = s.split(/[\/\-]/);
      if (parts.length >= 3) { [month, day, year] = parts; }
    } else if (format === 'YYYY-MM-DD') {
      const parts = s.split(/[\/\-]/);
      if (parts.length >= 3) { [year, month, day] = parts; }
    } else if (format === 'DD-MM-YYYY') {
      const parts = s.split(/[\/\-]/);
      if (parts.length >= 3) { [day, month, year] = parts; }
    } else {
      // Try to auto-detect
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
      }
      return '';
    }

    if (year && year.length === 2) year = `20${year}`;
    const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return iso;
  } catch {
    return '';
  }
}

// ─── Number Parser ────────────────────────────────────────────────────────────
function parseAmount(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^0-9.\-]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : Math.abs(val);
}

// ─── Column Auto-Detect ───────────────────────────────────────────────────────
function autoDetectMapping(headers: string[]): { mapping: Partial<ColumnMapping>; presetId?: string } {
  const lower = headers.map(h => h.toLowerCase().trim());

  // Try built-in presets first
  for (const preset of BUILT_IN_PRESETS) {
    const cols = Object.values(preset.columns).map(c => c.toLowerCase());
    const matches = cols.filter(c => lower.includes(c));
    if (matches.length >= 4) {
      return { mapping: preset.columns, presetId: preset.id };
    }
  }

  // Auto-detect common patterns
  const mapping: Partial<ColumnMapping> = {};

  for (const h of headers) {
    const hl = h.toLowerCase().trim();
    if (!mapping.date && /date|dt|trans.?date|value.?date/.test(hl)) mapping.date = h;
    if (!mapping.description && /desc|narr|particular|remarks|detail/.test(hl)) mapping.description = h;
    if (!mapping.reference && /ref|chq|cheque|voucher|doc/.test(hl)) mapping.reference = h;
    if (!mapping.debit && /debit|dr|withdraw|paid.?out/.test(hl)) mapping.debit = h;
    if (!mapping.credit && /credit|cr|deposit|paid.?in/.test(hl)) mapping.credit = h;
    if (!mapping.balance && /balance|bal|running/.test(hl)) mapping.balance = h;
  }

  return { mapping };
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────
function parseCSV(content: string, delimiter: string, skipRows: number): { headers: string[]; rows: Record<string, string>[] } {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  const dataLines = lines.slice(skipRows);

  if (dataLines.length === 0) return { headers: [], rows: [] };

  const split = (line: string) => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        inQuotes = !inQuotes;
      } else if (line[i] === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += line[i];
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = split(dataLines[0]).map(h => h.replace(/^["']|["']$/g, '').trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < dataLines.length; i++) {
    const values = split(dataLines[i]);
    if (values.length < 2) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    rows.push(row);
  }

  return { headers, rows };
}

// ─── Excel Parser ─────────────────────────────────────────────────────────────
function parseExcel(buffer: ArrayBuffer, skipRows: number): { headers: string[]; rows: Record<string, string>[] } {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][];

  const dataRows = raw.slice(skipRows);
  if (dataRows.length === 0) return { headers: [], rows: [] };

  const headers = dataRows[0].map(h => String(h).trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row || row.every(c => !c)) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = String(row[idx] || '').trim(); });
    rows.push(obj);
  }

  return { headers, rows };
}

// ─── Row → ParsedRow ─────────────────────────────────────────────────────────
function mapRow(
  raw: Record<string, string>,
  mapping: ColumnMapping,
  dateFormat: string,
  idx: number
): ParsedRow {
  const errors: string[] = [];

  const dateRaw = raw[mapping.date] || '';
  const date = parseDate(dateRaw, dateFormat);
  if (!date) errors.push(`Cannot parse date: "${dateRaw}"`);

  const description = raw[mapping.description] || '';
  if (!description) errors.push('Missing description');

  const reference = raw[mapping.reference] || '';
  const debit = parseAmount(raw[mapping.debit] || '');
  const credit = parseAmount(raw[mapping.credit] || '');
  const balance = parseAmount(raw[mapping.balance] || '');

  if (debit === 0 && credit === 0) errors.push('Both debit and credit are zero');

  return {
    raw,
    date,
    description,
    reference,
    debit,
    credit,
    balance,
    valid: errors.length === 0,
    errors,
    rowIndex: idx,
  };
}

// ─── Main Parse Function ──────────────────────────────────────────────────────
export async function parseFile(
  file: File,
  preset?: MappingPreset
): Promise<ParseResult> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  let headers: string[] = [];
  let rawRows: Record<string, string>[] = [];

  const skipRows = preset?.skipRows ?? 0;
  const delimiter = preset?.delimiter ?? ',';

  if (ext === 'csv' || ext === 'txt') {
    const text = await file.text();
    const parsed = parseCSV(text, delimiter, skipRows);
    headers = parsed.headers;
    rawRows = parsed.rows;
  } else if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer();
    const parsed = parseExcel(buffer, skipRows);
    headers = parsed.headers;
    rawRows = parsed.rows;
  } else {
    throw new Error(`Unsupported file type: .${ext}. Please upload CSV or Excel files.`);
  }

  // Auto-detect or use preset mapping
  let mapping: ColumnMapping;
  let detectedPreset: string | undefined;

  if (preset) {
    mapping = preset.columns;
  } else {
    const detected = autoDetectMapping(headers);
    mapping = {
      date: detected.mapping.date || headers[0] || '',
      description: detected.mapping.description || headers[1] || '',
      reference: detected.mapping.reference || headers[2] || '',
      debit: detected.mapping.debit || headers[3] || '',
      credit: detected.mapping.credit || headers[4] || '',
      balance: detected.mapping.balance || headers[5] || '',
    };
    detectedPreset = detected.presetId;
  }

  const dateFormat = preset?.dateFormat ?? 'DD/MM/YYYY';
  const rows = rawRows.map((r, i) => mapRow(r, mapping, dateFormat, i));
  const validRows = rows.filter(r => r.valid).length;

  return {
    rows,
    headers,
    filename: file.name,
    totalRows: rows.length,
    validRows,
    invalidRows: rows.length - validRows,
    detectedPreset,
    rawData: rawRows.map(r => [r]),
  };
}

// ─── Convert ParsedRow → BankTx ───────────────────────────────────────────────
export function parsedRowToBankTx(row: ParsedRow, bank: string, prefix = 'IMP'): BankTx {
  return {
    id: `${prefix}-${Date.now()}-${row.rowIndex}`,
    date: row.date,
    description: row.description,
    reference: row.reference,
    debit: row.debit,
    credit: row.credit,
    balance: row.balance,
    status: 'Unmatched',
    source: 'Import',
    bank,
    raw: row.raw,
  };
}

// ─── Convert ParsedRow → BookTx ──────────────────────────────────────────────
export function parsedRowToBookTx(row: ParsedRow, category = 'Imported'): BookTx {
  const isDebit = row.debit > 0;
  return {
    id: `BOOK-IMP-${Date.now()}-${row.rowIndex}`,
    date: row.date,
    description: row.description,
    reference: row.reference,
    amount: isDebit ? row.debit : row.credit,
    type: isDebit ? 'Debit' : 'Credit',
    status: 'Unmatched',
    source: 'Import',
    category,
  };
}

// ─── Template Generator ───────────────────────────────────────────────────────
export function generateTemplate(bank = 'Your Bank'): void {
  const wb = XLSX.utils.book_new();
  const data = [
    ['Date', 'Description', 'Reference', 'Debit', 'Credit', 'Balance'],
    ['01/03/2024', 'Opening balance', 'OB-001', '', '', '500000.00'],
    ['02/03/2024', 'Transfer from Agent XYZ', 'REF-001', '', '15000.00', '515000.00'],
    ['03/03/2024', 'Supplier payment - Hotel ABC', 'PO-001', '32000.00', '', '483000.00'],
    ['05/03/2024', 'Bank charges', 'FEE-001', '250.00', '', '482750.00'],
    ['07/03/2024', 'Customer payment - John Doe', 'INV-001', '', '3675.00', '486425.00'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 14 }, { wch: 40 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, bank);
  XLSX.writeFile(wb, `bank_statement_template_${bank.replace(/\s+/g, '_')}.xlsx`);
}

// ─── Export Matched Pairs ─────────────────────────────────────────────────────
export function exportReconciliation(
  bankTxs: BankTx[],
  bookTxs: BookTx[],
  matches: Array<{ id: string; bankTxId: string; bookTxId: string; difference: number; confidence: string; method: string; matchedAt: string }>
): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Matched pairs
  const matchData = [
    ['Match ID', 'Bank Tx ID', 'Bank Date', 'Bank Description', 'Bank Amount', 'Book Tx ID', 'Book Date', 'Book Description', 'Book Amount', 'Difference', 'Confidence', 'Method', 'Matched At'],
    ...matches.map(m => {
      const bank = bankTxs.find(b => b.id === m.bankTxId);
      const book = bookTxs.find(b => b.id === m.bookTxId);
      return [
        m.id,
        m.bankTxId, bank?.date, bank?.description, bank ? Math.max(bank.credit, bank.debit) : '',
        m.bookTxId, book?.date, book?.description, book?.amount,
        m.difference, m.confidence, m.method, m.matchedAt,
      ];
    }),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(matchData), 'Matched Pairs');

  // Sheet 2: Unmatched bank
  const unmatchedBank = bankTxs.filter(b => b.status === 'Unmatched');
  const ubData = [
    ['ID', 'Date', 'Description', 'Reference', 'Debit', 'Credit', 'Balance', 'Bank'],
    ...unmatchedBank.map(b => [b.id, b.date, b.description, b.reference, b.debit, b.credit, b.balance, b.bank]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ubData), 'Unmatched Bank');

  // Sheet 3: Unmatched book
  const unmatchedBook = bookTxs.filter(b => b.status === 'Unmatched');
  const ubkData = [
    ['ID', 'Date', 'Description', 'Reference', 'Amount', 'Type', 'Category'],
    ...unmatchedBook.map(b => [b.id, b.date, b.description, b.reference, b.amount, b.type, b.category]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ubkData), 'Unmatched Book');

  XLSX.writeFile(wb, `reconciliation_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
