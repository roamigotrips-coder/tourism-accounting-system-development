import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload, CheckCircle, XCircle, AlertCircle, FileText,
  Download, Search, Link2, Plus, X, Printer,
  History, FileSpreadsheet, Zap, Cloud, RefreshCcw,
  SlidersHorizontal, Eye, Settings, Save, Trash2, Copy,
  AlertTriangle, Check, GitMerge, ChevronDown, ChevronRight,
  Info, ArrowRight, BarChart3, BookOpen, Banknote,
  ShieldCheck, Lightbulb, Target, Activity,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  runAutoMatch, calcSummary, generateSuggestions, scoreMatch,
  type BankTx, type BookTx, type RecMatch, type MatchConfidence, type RecStatus,
} from '../utils/reconciliationEngine';
import {
  parseFile, parsedRowToBankTx, generateTemplate, exportReconciliation,
  BUILT_IN_PRESETS, type MappingPreset, type ParsedRow,
} from '../utils/importParser';

// ─── Types ─────────────────────────────────────────────────────────────────────
type TabId = 'overview' | 'import' | 'presets' | 'book' | 'reconcile' | 'suggestions' | 'rules' | 'feeds' | 'report' | 'audit';

interface AuditEntry {
  id: string; action: string; user: string; timestamp: string; details: string;
  type: 'match' | 'unmatch' | 'import' | 'rule' | 'manual' | 'system' | 'feed';
}

interface BankRule {
  id: string; name: string; enabled: boolean; contains: string;
  tx: 'Any' | 'Debit' | 'Credit'; amountMin?: number; amountMax?: number;
  action: 'CreateBookTx' | 'Ignore' | 'AutoMatch'; category: string; priority: number;
}

interface FeedLog {
  id: string; ts: string; added: number; created: number; status: 'Success' | 'Warning' | 'Error'; bank: string;
}

// ─── Mock Initial Data ─────────────────────────────────────────────────────────
const initBankTx: BankTx[] = [
  { id: 'BNK-001', date: '2024-03-01', description: 'Transfer from Global Tours UK', reference: 'REF-2024-001', debit: 0, credit: 15000, balance: 471000, status: 'Matched', matchedWith: 'BOOK-001', source: 'Import', bank: 'Emirates NBD' },
  { id: 'BNK-002', date: '2024-03-03', description: 'Payment to Marriott Hotels UAE', reference: 'REF-2024-002', debit: 32000, credit: 0, balance: 439000, status: 'Matched', matchedWith: 'BOOK-002', source: 'Import', bank: 'Emirates NBD' },
  { id: 'BNK-003', date: '2024-03-05', description: 'Card payment - Ahmed Hassan', reference: 'REF-2024-003', debit: 0, credit: 3675, balance: 442675, status: 'Matched', matchedWith: 'BOOK-003', source: 'Feed', bank: 'Emirates NBD' },
  { id: 'BNK-004', date: '2024-03-08', description: 'Bank charges & fees', reference: 'REF-2024-004', debit: 250, credit: 0, balance: 442425, status: 'Unmatched', source: 'Feed', bank: 'Emirates NBD' },
  { id: 'BNK-005', date: '2024-03-10', description: 'Transfer from Euro Holidays Ltd', reference: 'REF-2024-005', debit: 0, credit: 22000, balance: 464425, status: 'Partial', matchedWith: 'BOOK-004', source: 'Import', bank: 'Emirates NBD' },
  { id: 'BNK-006', date: '2024-03-12', description: 'Office rent payment Mar 2024', reference: 'REF-2024-006', debit: 18000, credit: 0, balance: 446425, status: 'Matched', matchedWith: 'BOOK-005', source: 'Import', bank: 'ADCB' },
  { id: 'BNK-007', date: '2024-03-14', description: 'Receipt from Asia Travel Co', reference: 'REF-2024-007', debit: 0, credit: 8500, balance: 454925, status: 'Unmatched', source: 'Feed', bank: 'ADCB' },
  { id: 'BNK-008', date: '2024-03-15', description: 'Salary payment - Drivers March', reference: 'REF-2024-008', debit: 15000, credit: 0, balance: 439925, status: 'Matched', matchedWith: 'BOOK-006', source: 'Feed', bank: 'Emirates NBD' },
  { id: 'BNK-009', date: '2024-03-17', description: 'Marketing expenses Google Ads', reference: 'REF-2024-009', debit: 5000, credit: 0, balance: 434925, status: 'Unmatched', source: 'Manual', bank: 'Emirates NBD' },
  { id: 'BNK-010', date: '2024-03-19', description: 'Desert Safari LLC payment', reference: 'REF-2024-010', debit: 18000, credit: 0, balance: 416925, status: 'Matched', matchedWith: 'BOOK-007', source: 'Import', bank: 'FAB' },
  { id: 'BNK-011', date: '2024-03-21', description: 'VAT payment FTA', reference: 'VAT-Q1-2024', debit: 12500, credit: 0, balance: 404425, status: 'Partial', matchedWith: 'BOOK-010', source: 'Manual', bank: 'Emirates NBD' },
  { id: 'BNK-012', date: '2024-03-23', description: 'Customer refund - Cancelled tour', reference: 'REF-2024-012', debit: 2100, credit: 0, balance: 402325, status: 'Unmatched', source: 'Feed', bank: 'Emirates NBD' },
];

const initBookTx: BookTx[] = [
  { id: 'BOOK-001', date: '2024-03-01', description: 'Receipt - Global Tours UK INV-001', reference: 'INV-001', amount: 15000, type: 'Credit', status: 'Matched', matchedWith: 'BNK-001', source: 'Invoice', category: 'Agent Receipt' },
  { id: 'BOOK-002', date: '2024-03-03', description: 'Supplier Payment - Marriott Hotels', reference: 'PO-2024-001', amount: 32000, type: 'Debit', status: 'Matched', matchedWith: 'BNK-002', source: 'Payment', category: 'Supplier Payment' },
  { id: 'BOOK-003', date: '2024-03-05', description: 'Customer Payment - Ahmed Hassan', reference: 'BK-004', amount: 3675, type: 'Credit', status: 'Matched', matchedWith: 'BNK-003', source: 'Payment', category: 'Customer Receipt' },
  { id: 'BOOK-004', date: '2024-03-10', description: 'Agent Receipt - Euro Holidays', reference: 'INV-004', amount: 23100, type: 'Credit', status: 'Partial', matchedWith: 'BNK-005', source: 'Invoice', category: 'Agent Receipt' },
  { id: 'BOOK-005', date: '2024-03-12', description: 'Expense - Office Rent Mar 2024', reference: 'EX-005', amount: 18000, type: 'Debit', status: 'Matched', matchedWith: 'BNK-006', source: 'Manual', category: 'Rent' },
  { id: 'BOOK-006', date: '2024-03-15', description: 'Payroll - Driver Salaries March', reference: 'PAY-2024-003', amount: 15000, type: 'Debit', status: 'Matched', matchedWith: 'BNK-008', source: 'Payment', category: 'Payroll' },
  { id: 'BOOK-007', date: '2024-03-19', description: 'Supplier Payment - Desert Safari LLC', reference: 'INV-006', amount: 18000, type: 'Debit', status: 'Matched', matchedWith: 'BNK-010', source: 'Payment', category: 'Supplier Payment' },
  { id: 'BOOK-008', date: '2024-03-20', description: 'Customer Booking Payment - US Travels', reference: 'BK-010', amount: 8500, type: 'Credit', status: 'Unmatched', source: 'Invoice', category: 'Customer Receipt' },
  { id: 'BOOK-009', date: '2024-03-21', description: 'Expense - Fuel Fleet Week 11', reference: 'EX-001', amount: 2500, type: 'Debit', status: 'Unmatched', source: 'Manual', category: 'Fuel' },
  { id: 'BOOK-010', date: '2024-03-21', description: 'VAT Return Q1 2024 - FTA', reference: 'VAT-Q1-2024', amount: 12500, type: 'Debit', status: 'Partial', matchedWith: 'BNK-011', source: 'Manual', category: 'VAT' },
];

const initMatches: RecMatch[] = [
  { id: 'REC-001', bankTxId: 'BNK-001', bookTxId: 'BOOK-001', matchedBy: 'System', matchedAt: '2024-03-01 09:05', difference: 0, method: 'Auto', confidence: 'High', score: 90, reasons: ['Exact amount match', 'Same date', 'Reference exact match'] },
  { id: 'REC-002', bankTxId: 'BNK-002', bookTxId: 'BOOK-002', matchedBy: 'System', matchedAt: '2024-03-03 10:12', difference: 0, method: 'Auto', confidence: 'High', score: 85, reasons: ['Exact amount match', '1 day apart', 'Reference contains match'] },
  { id: 'REC-003', bankTxId: 'BNK-003', bookTxId: 'BOOK-003', matchedBy: 'System', matchedAt: '2024-03-05 11:30', difference: 0, method: 'Auto', confidence: 'High', score: 100, reasons: ['Exact amount match', 'Same date', 'Reference exact match', '3 description keywords match'] },
  { id: 'REC-004', bankTxId: 'BNK-005', bookTxId: 'BOOK-004', matchedBy: 'Admin User', matchedAt: '2024-03-10 14:20', difference: 1100, method: 'Manual', confidence: 'Medium', score: 62, reasons: ['Amount within 5%', 'Same date', 'Partial reference match'], note: 'Partial payment accepted — balance pending next month' },
  { id: 'REC-005', bankTxId: 'BNK-006', bookTxId: 'BOOK-005', matchedBy: 'System', matchedAt: '2024-03-12 09:45', difference: 0, method: 'Auto', confidence: 'High', score: 88, reasons: ['Exact amount match', 'Same date', 'Description keyword match'] },
  { id: 'REC-006', bankTxId: 'BNK-008', bookTxId: 'BOOK-006', matchedBy: 'System', matchedAt: '2024-03-15 08:00', difference: 0, method: 'Auto', confidence: 'High', score: 95, reasons: ['Exact amount match', 'Same date', 'Reference exact match'] },
  { id: 'REC-007', bankTxId: 'BNK-010', bookTxId: 'BOOK-007', matchedBy: 'System', matchedAt: '2024-03-19 16:10', difference: 0, method: 'Auto', confidence: 'High', score: 92, reasons: ['Exact amount match', 'Same date', 'Reference match'] },
  { id: 'REC-008', bankTxId: 'BNK-011', bookTxId: 'BOOK-010', matchedBy: 'System', matchedAt: '2024-03-21 09:00', difference: 0, method: 'Reference', confidence: 'High', score: 98, reasons: ['Exact amount match', 'Same date', 'Reference exact match: VAT-Q1-2024'] },
];

const initAudit: AuditEntry[] = [
  { id: 'A-001', action: 'Auto Match', user: 'System', timestamp: '2024-03-01 09:05', details: 'BNK-001 ↔ BOOK-001 · AED 15,000 · Exact match · Score: 90 · High confidence', type: 'match' },
  { id: 'A-002', action: 'Auto Match', user: 'System', timestamp: '2024-03-03 10:12', details: 'BNK-002 ↔ BOOK-002 · AED 32,000 · Amount + date · Score: 85 · High confidence', type: 'match' },
  { id: 'A-003', action: 'Auto Match', user: 'System', timestamp: '2024-03-05 11:30', details: 'BNK-003 ↔ BOOK-003 · AED 3,675 · Perfect match · Score: 100 · High confidence', type: 'match' },
  { id: 'A-004', action: 'Manual Match', user: 'Admin User', timestamp: '2024-03-10 14:20', details: 'BNK-005 ↔ BOOK-004 · Diff: AED 1,100 · Partial accepted · Score: 62 · Medium', type: 'manual' },
  { id: 'A-005', action: 'Bank Statement Imported', user: 'Admin User', timestamp: '2024-03-20 08:30', details: 'Emirates NBD: 12 transactions from BankStatement_Mar24.xlsx · Preset: Emirates NBD Standard', type: 'import' },
  { id: 'A-006', action: 'Auto-Match Engine Run', user: 'System', timestamp: '2024-03-20 08:31', details: '6 Matched · 2 Partial · 4 Unmatched from 12 bank transactions · Duration: 142ms', type: 'system' },
];

const defaultRules: BankRule[] = [
  { id: 'R-001', name: 'Bank Charges & Fees', enabled: true, contains: 'charge|fee|commission', tx: 'Debit', amountMax: 2000, action: 'CreateBookTx', category: 'Bank Charges', priority: 1 },
  { id: 'R-002', name: 'Agent Receipts', enabled: true, contains: 'agent|receipt|tours|travel', tx: 'Credit', action: 'CreateBookTx', category: 'Agent Receipt', priority: 2 },
  { id: 'R-003', name: 'Salary & Payroll', enabled: true, contains: 'salary|payroll|driver', tx: 'Debit', action: 'CreateBookTx', category: 'Payroll', priority: 3 },
  { id: 'R-004', name: 'VAT Payments FTA', enabled: true, contains: 'vat|fta|tax', tx: 'Debit', action: 'CreateBookTx', category: 'VAT Payment', priority: 4 },
  { id: 'R-005', name: 'Hotel Supplier Payments', enabled: true, contains: 'hotel|marriott|hilton|hyatt', tx: 'Debit', action: 'CreateBookTx', category: 'Supplier Payment', priority: 5 },
];

const initFeeds: FeedLog[] = [
  { id: 'F-001', ts: '2024-03-20 08:30', added: 4, created: 2, status: 'Success', bank: 'Emirates NBD' },
  { id: 'F-002', ts: '2024-03-19 08:00', added: 3, created: 1, status: 'Success', bank: 'Emirates NBD' },
  { id: 'F-003', ts: '2024-03-18 08:00', added: 5, created: 3, status: 'Warning', bank: 'ADCB' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => `AED ${n.toLocaleString('en-AE', { minimumFractionDigits: 2 })}`;
const now = () => new Date().toISOString().replace('T', ' ').slice(0, 16);

function StatusBadge({ status }: { status: RecStatus }) {
  const cfg = {
    Matched: { cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <CheckCircle size={11} /> },
    Partial: { cls: 'bg-amber-100 text-amber-700 border-amber-200', icon: <AlertCircle size={11} /> },
    Unmatched: { cls: 'bg-red-100 text-red-700 border-red-200', icon: <XCircle size={11} /> },
  }[status];
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.cls}`}>{cfg.icon}{status}</span>;
}

function ConfBadge({ c }: { c: MatchConfidence }) {
  const cls = { High: 'bg-emerald-100 text-emerald-700', Medium: 'bg-amber-100 text-amber-700', Low: 'bg-red-100 text-red-700' }[c];
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>{c}</span>;
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-emerald-500' : score >= 45 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, score)}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-600">{score}</span>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function BankReconciliation() {
  const [tab, setTab] = useState<TabId>('overview');
  const [bankTxs, setBankTxs] = useState<BankTx[]>(initBankTx);
  const [bookTxs, setBookTxs] = useState<BookTx[]>(initBookTx);
  const [matches, setMatches] = useState<RecMatch[]>(initMatches);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(initAudit);
  const [presets, setPresets] = useState<MappingPreset[]>(BUILT_IN_PRESETS);
  const [rules, setRules] = useState<BankRule[]>(defaultRules);
  const [feedLogs, setFeedLogs] = useState<FeedLog[]>(initFeeds);

  // Import state
  const [dragging, setDragging] = useState(false);
  const [parseResult, setParseResult] = useState<{ rows: ParsedRow[]; headers: string[]; filename: string; validRows: number; invalidRows: number; detectedPreset?: string } | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState('PRESET-001');
  const [importBankName, setImportBankName] = useState('Emirates NBD');
  const [importMode, setImportMode] = useState<'bank' | 'book'>('bank');
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Reconcile state
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [matchNote, setMatchNote] = useState('');
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [bankFilter, setBankFilter] = useState<RecStatus | 'All'>('All');
  const [bookFilter, setBookFilter] = useState<RecStatus | 'All'>('Unmatched');
  const [bankSearch, setBankSearch] = useState('');
  const [bookSearch, setBookSearch] = useState('');

  // Auto-match state
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoStats, setAutoStats] = useState<{ newMatches: number; newPartials: number; skipped: number; duration: number } | null>(null);

  // Suggestion state
  const [suggestions, setSuggestions] = useState(() => generateSuggestions(initBankTx, initBookTx, initMatches));
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());

  // Rule modal
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editRule, setEditRule] = useState<BankRule | null>(null);
  const [ruleForm, setRuleForm] = useState<Partial<BankRule>>({});

  // Preset modal
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [editPreset, setEditPreset] = useState<MappingPreset | null>(null);
  const [presetForm, setPresetForm] = useState<Partial<MappingPreset>>({});

  // Book entry modal
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookForm, setBookForm] = useState({ date: '', description: '', reference: '', amount: '', type: 'Credit' as 'Credit' | 'Debit', category: '' });

  // Feed state
  const [feedConnected, setFeedConnected] = useState(false);
  const [feedSyncing, setFeedSyncing] = useState(false);

  // View match modal
  const [viewMatch, setViewMatch] = useState<RecMatch | null>(null);

  // Report expanded
  const [reportExpanded, setReportExpanded] = useState<Set<string>>(new Set(['matched', 'unmatched']));

  const summary = calcSummary(bankTxs, bookTxs, matches);

  // Recompute suggestions when data changes
  useEffect(() => {
    setSuggestions(generateSuggestions(bankTxs, bookTxs, matches));
  }, [bankTxs, bookTxs, matches]);

  // ── Audit log helper ───────────────────────────────────────────────────────
  const addAudit = useCallback((action: string, details: string, type: AuditEntry['type'], user = 'Admin User') => {
    setAuditLog(prev => [{
      id: `A-${Date.now()}`, action, user, timestamp: now(), details, type,
    }, ...prev]);
  }, []);

  // ── File upload ────────────────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    try {
      const preset = presets.find(p => p.id === selectedPresetId);
      const result = await parseFile(file, preset);
      setParseResult(result);
      if (result.detectedPreset) setSelectedPresetId(result.detectedPreset);
      addAudit('File Parsed', `${file.name}: ${result.totalRows} rows found · ${result.validRows} valid · ${result.invalidRows} invalid`, 'import');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to parse file');
    }
  }, [presets, selectedPresetId, addAudit]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const confirmImport = useCallback(() => {
    if (!parseResult) return;
    setImporting(true);
    const validRows = parseResult.rows.filter(r => r.valid);

    setTimeout(() => {
      if (importMode === 'bank') {
        const newTxs = validRows.map(r => parsedRowToBankTx(r, importBankName));
        // Apply rules
        const ruleTxs: BookTx[] = [];
        for (const tx of newTxs) {
          for (const rule of rules.filter(r => r.enabled).sort((a, b) => a.priority - b.priority)) {
            const regex = new RegExp(rule.contains, 'i');
            if (!regex.test(tx.description + ' ' + tx.reference)) continue;
            if (rule.tx !== 'Any') {
              if (rule.tx === 'Credit' && tx.credit === 0) continue;
              if (rule.tx === 'Debit' && tx.debit === 0) continue;
            }
            const amt = Math.max(tx.credit, tx.debit);
            if (rule.amountMin && amt < rule.amountMin) continue;
            if (rule.amountMax && amt > rule.amountMax) continue;
            if (rule.action === 'CreateBookTx') {
              ruleTxs.push({
                id: `BOOK-RULE-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                date: tx.date, description: tx.description, reference: tx.reference,
                amount: amt, type: tx.debit > 0 ? 'Debit' : 'Credit',
                status: 'Unmatched', source: 'Manual', category: rule.category,
              });
            }
            break;
          }
        }
        setBankTxs(prev => [...prev, ...newTxs]);
        if (ruleTxs.length > 0) setBookTxs(prev => [...prev, ...ruleTxs]);
        addAudit('Bank Statement Imported', `${parseResult.filename}: ${validRows.length} transactions imported to ${importBankName} · ${ruleTxs.length} book entries auto-created from rules`, 'import');
        setImportSuccess(`✓ ${validRows.length} bank transactions imported · ${ruleTxs.length} book entries created by rules`);
      } else {
        const newTxs: BookTx[] = validRows.map(r => ({
          id: `BOOK-IMP-${Date.now()}-${r.rowIndex}`,
          date: r.date, description: r.description, reference: r.reference,
          amount: r.debit > 0 ? r.debit : r.credit,
          type: r.debit > 0 ? 'Debit' : 'Credit',
          status: 'Unmatched', source: 'Import', category: 'Imported',
        }));
        setBookTxs(prev => [...prev, ...newTxs]);
        addAudit('Book Transactions Imported', `${parseResult.filename}: ${validRows.length} entries imported`, 'import');
        setImportSuccess(`✓ ${validRows.length} book transactions imported`);
      }
      setParseResult(null);
      setImporting(false);
      setTimeout(() => setImportSuccess(''), 4000);
    }, 800);
  }, [parseResult, importMode, importBankName, rules, addAudit]);

  // ── Auto-match ─────────────────────────────────────────────────────────────
  const runAuto = useCallback(() => {
    setAutoRunning(true);
    setAutoStats(null);
    setTimeout(() => {
      const result = runAutoMatch(bankTxs, bookTxs, matches, { minScore: 45, allowPartial: true });
      setBankTxs(result.updatedBankTxs);
      setBookTxs(result.updatedBookTxs);
      setMatches(prev => [...prev, ...result.matches]);
      setAutoStats(result.stats);
      const s = result.stats;
      addAudit('Auto-Match Engine Run', `Processed ${s.totalProcessed} candidates · ${s.newMatches} matched · ${s.newPartials} partial · ${s.skipped} skipped · ${s.duration}ms`, 'system');
      setAutoRunning(false);
    }, 1200);
  }, [bankTxs, bookTxs, matches, addAudit]);

  // ── Manual match ───────────────────────────────────────────────────────────
  const confirmManualMatch = useCallback(() => {
    if (!selectedBank || !selectedBook) return;
    const bank = bankTxs.find(b => b.id === selectedBank)!;
    const book = bookTxs.find(b => b.id === selectedBook)!;
    const result = scoreMatch(bank, book);
    const isExact = result.difference < 1;
    const newStatus: RecStatus = isExact ? 'Matched' : 'Partial';
    const matchId = `REC-MAN-${Date.now()}`;

    setMatches(prev => [...prev, {
      id: matchId, bankTxId: selectedBank, bookTxId: selectedBook,
      matchedBy: 'Admin User', matchedAt: now(),
      difference: result.difference, method: 'Manual',
      confidence: result.confidence, score: result.score,
      reasons: result.reasons, note: matchNote || undefined,
    }]);
    setBankTxs(prev => prev.map(b => b.id === selectedBank ? { ...b, status: newStatus, matchedWith: selectedBook } : b));
    setBookTxs(prev => prev.map(b => b.id === selectedBook ? { ...b, status: newStatus, matchedWith: selectedBank } : b));
    addAudit('Manual Match', `${selectedBank} ↔ ${selectedBook} · ${fmt(Math.max(bank.credit, bank.debit))} · Diff: ${fmt(result.difference)} · Score: ${result.score} · ${result.confidence}${matchNote ? ` · Note: ${matchNote}` : ''}`, 'manual');
    setSelectedBank(null); setSelectedBook(null); setMatchNote(''); setShowMatchModal(false);
  }, [selectedBank, selectedBook, matchNote, bankTxs, bookTxs, addAudit]);

  const unmatch = useCallback((matchId: string) => {
    const m = matches.find(x => x.id === matchId);
    if (!m) return;
    setMatches(prev => prev.filter(x => x.id !== matchId));
    setBankTxs(prev => prev.map(b => b.id === m.bankTxId ? { ...b, status: 'Unmatched', matchedWith: undefined } : b));
    setBookTxs(prev => prev.map(b => b.id === m.bookTxId ? { ...b, status: 'Unmatched', matchedWith: undefined } : b));
    addAudit('Unmatched', `${m.bankTxId} ↔ ${m.bookTxId} unmatched`, 'unmatch');
  }, [matches, addAudit]);

  // ── Accept suggestion ──────────────────────────────────────────────────────
  const acceptSuggestion = useCallback((s: typeof suggestions[0]) => {
    setSelectedBank(s.bankTxId);
    setSelectedBook(s.bookTxId);
    setTab('reconcile');
    setShowMatchModal(true);
  }, []);

  // ── Feed sync ──────────────────────────────────────────────────────────────
  const syncFeed = useCallback(() => {
    setFeedSyncing(true);
    setTimeout(() => {
      const newTxs: BankTx[] = [
        { id: `BNK-FEED-${Date.now()}`, date: new Date().toISOString().slice(0, 10), description: 'Card payment online gateway', reference: `FEED-${Date.now()}`, debit: 0, credit: 4200, balance: 406525, status: 'Unmatched', source: 'Feed', bank: 'Emirates NBD' },
        { id: `BNK-FEED-${Date.now() + 1}`, date: new Date().toISOString().slice(0, 10), description: 'Bank service charge monthly', reference: `FEE-${Date.now()}`, debit: 125, credit: 0, balance: 406400, status: 'Unmatched', source: 'Feed', bank: 'Emirates NBD' },
      ];
      setBankTxs(prev => [...prev, ...newTxs]);
      const log: FeedLog = { id: `F-${Date.now()}`, ts: now(), added: newTxs.length, created: 1, status: 'Success', bank: 'Emirates NBD' };
      setFeedLogs(prev => [log, ...prev]);
      addAudit('Bank Feed Sync', `Emirates NBD: ${newTxs.length} new transactions fetched · 1 rule-created book entry`, 'feed');
      setFeedSyncing(false);
    }, 1500);
  }, [addAudit]);

  // ── Filtered data ──────────────────────────────────────────────────────────
  const filteredBank = bankTxs.filter(b =>
    (bankFilter === 'All' || b.status === bankFilter) &&
    (b.description.toLowerCase().includes(bankSearch.toLowerCase()) || b.reference.toLowerCase().includes(bankSearch.toLowerCase()))
  );
  const filteredBook = bookTxs.filter(b =>
    (bookFilter === 'All' || b.status === bookFilter) &&
    (b.description.toLowerCase().includes(bookSearch.toLowerCase()) || b.reference.toLowerCase().includes(bookSearch.toLowerCase()))
  );

  const tabs: { id: TabId; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 size={14} /> },
    { id: 'import', label: 'Import Statement', icon: <Upload size={14} /> },
    { id: 'presets', label: 'Mapping Presets', icon: <SlidersHorizontal size={14} /> },
    { id: 'book', label: 'Book Transactions', icon: <BookOpen size={14} /> },
    { id: 'reconcile', label: 'Reconcile', icon: <Link2 size={14} />, badge: bankTxs.filter(b => b.status === 'Unmatched').length },
    { id: 'suggestions', label: 'Smart Suggestions', icon: <Lightbulb size={14} />, badge: suggestions.filter(s => !dismissedSuggestions.has(`${s.bankTxId}-${s.bookTxId}`)).length },
    { id: 'rules', label: 'Bank Rules', icon: <Target size={14} /> },
    { id: 'feeds', label: 'Bank Feeds', icon: <Cloud size={14} /> },
    { id: 'report', label: 'Report', icon: <FileText size={14} /> },
    { id: 'audit', label: 'Audit Log', icon: <History size={14} /> },
  ];

  return (
    <div className="p-6 space-y-4 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <GitMerge size={24} className="text-blue-600" /> Bank Reconciliation
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Match bank statements with book transactions · Double-entry validated</p>
        </div>
        <div className="flex gap-2">
          <button onClick={runAuto} disabled={autoRunning}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors">
            {autoRunning ? <RefreshCcw size={14} className="animate-spin" /> : <Zap size={14} />}
            {autoRunning ? 'Running...' : 'Run Auto-Match'}
          </button>
          <button onClick={() => exportReconciliation(bankTxs, bookTxs, matches)}
            className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm hover:bg-slate-50">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* Auto-match result banner */}
      {autoStats && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-800 text-sm">
            <CheckCircle size={16} className="text-emerald-600" />
            <span>Auto-Match complete: <strong>{autoStats.newMatches}</strong> matched · <strong>{autoStats.newPartials}</strong> partial · <strong>{autoStats.skipped}</strong> unmatched · <strong>{autoStats.duration}ms</strong></span>
          </div>
          <button onClick={() => setAutoStats(null)} className="text-emerald-600 hover:text-emerald-800"><X size={14} /></button>
        </div>
      )}

      {/* Import success */}
      {importSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2 text-emerald-800 text-sm">
          <CheckCircle size={16} className="text-emerald-600" /> {importSuccess}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Bank Txs', value: bankTxs.length, icon: <Banknote size={16} />, color: 'bg-blue-100 text-blue-600' },
          { label: 'Matched', value: bankTxs.filter(b => b.status === 'Matched').length, icon: <CheckCircle size={16} />, color: 'bg-emerald-100 text-emerald-600' },
          { label: 'Partial', value: bankTxs.filter(b => b.status === 'Partial').length, icon: <AlertCircle size={16} />, color: 'bg-amber-100 text-amber-600' },
          { label: 'Unmatched', value: bankTxs.filter(b => b.status === 'Unmatched').length, icon: <XCircle size={16} />, color: 'bg-red-100 text-red-600' },
          { label: 'Match Rate', value: `${bankTxs.length ? Math.round((bankTxs.filter(b => b.status === 'Matched').length / bankTxs.length) * 100) : 0}%`, icon: <Activity size={16} />, color: 'bg-purple-100 text-purple-600' },
          { label: 'Suggestions', value: suggestions.filter(s => !dismissedSuggestions.has(`${s.bankTxId}-${s.bookTxId}`)).length, icon: <Lightbulb size={16} />, color: 'bg-orange-100 text-orange-600' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-slate-100 p-3 flex items-center gap-3 shadow-sm">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.color}`}>{c.icon}</div>
            <div>
              <p className="text-xs text-slate-500">{c.label}</p>
              <p className="text-lg font-bold text-slate-800">{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex overflow-x-auto border-b border-slate-200">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors relative ${tab === t.id ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
              {t.icon} {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* ── OVERVIEW ───────────────────────────────────────────────────── */}
          {tab === 'overview' && (
            <div className="space-y-5">
              {/* Summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                  <p className="text-xs text-blue-600 font-medium mb-1">Opening Balance</p>
                  <p className="text-2xl font-bold text-blue-800">{fmt(summary.openingBalance)}</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200">
                  <p className="text-xs text-emerald-600 font-medium mb-1">Closing Balance</p>
                  <p className="text-2xl font-bold text-emerald-800">{fmt(summary.closingBalance)}</p>
                </div>
                <div className={`rounded-xl p-4 border ${summary.reconciled ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-200' : 'bg-gradient-to-br from-red-50 to-red-100 border-red-200'}`}>
                  <p className={`text-xs font-medium mb-1 ${summary.reconciled ? 'text-green-600' : 'text-red-600'}`}>Reconciliation Status</p>
                  <p className={`text-xl font-bold ${summary.reconciled ? 'text-green-800' : 'text-red-800'}`}>
                    {summary.reconciled ? '✓ Fully Reconciled' : `⚠ Difference: ${fmt(summary.totalDifference)}`}
                  </p>
                </div>
              </div>

              {/* Progress */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700">Reconciliation Progress</h3>
                  <span className="text-sm font-bold text-blue-600">{bankTxs.length ? Math.round((bankTxs.filter(b => b.status === 'Matched').length / bankTxs.length) * 100) : 0}% Complete</span>
                </div>
                <div className="h-4 bg-slate-200 rounded-full overflow-hidden flex">
                  <div className="bg-emerald-500 h-full transition-all" style={{ width: `${bankTxs.length ? (bankTxs.filter(b => b.status === 'Matched').length / bankTxs.length) * 100 : 0}%` }} />
                  <div className="bg-amber-400 h-full transition-all" style={{ width: `${bankTxs.length ? (bankTxs.filter(b => b.status === 'Partial').length / bankTxs.length) * 100 : 0}%` }} />
                </div>
                <div className="flex gap-4 mt-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Matched ({bankTxs.filter(b => b.status === 'Matched').length})</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Partial ({bankTxs.filter(b => b.status === 'Partial').length})</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300 inline-block" /> Unmatched ({bankTxs.filter(b => b.status === 'Unmatched').length})</span>
                </div>
              </div>

              {/* Matched pairs table */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><Link2 size={14} /> Matched Pairs ({matches.length})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {['Match ID', 'Bank Transaction', 'Book Transaction', 'Amount', 'Difference', 'Score', 'Confidence', 'Method', 'Matched By', 'Actions'].map(h => (
                          <th key={h} className="text-left px-3 py-2 text-slate-500 font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {matches.map(m => {
                        const bank = bankTxs.find(b => b.id === m.bankTxId);
                        const book = bookTxs.find(b => b.id === m.bookTxId);
                        return (
                          <tr key={m.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-mono text-blue-600">{m.id}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-slate-700">{m.bankTxId}</div>
                              <div className="text-slate-400 truncate max-w-[140px]">{bank?.description}</div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-slate-700">{m.bookTxId}</div>
                              <div className="text-slate-400 truncate max-w-[140px]">{book?.description}</div>
                            </td>
                            <td className="px-3 py-2 font-medium">{bank ? fmt(Math.max(bank.credit, bank.debit)) : '-'}</td>
                            <td className="px-3 py-2">
                              {m.difference < 1 ? <span className="text-emerald-600 font-medium">None</span> :
                                <span className="text-amber-600 font-medium">{fmt(m.difference)}</span>}
                            </td>
                            <td className="px-3 py-2"><ScoreBar score={m.score} /></td>
                            <td className="px-3 py-2"><ConfBadge c={m.confidence} /></td>
                            <td className="px-3 py-2"><span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600">{m.method}</span></td>
                            <td className="px-3 py-2 text-slate-500">{m.matchedBy}</td>
                            <td className="px-3 py-2">
                              <div className="flex gap-1">
                                <button onClick={() => setViewMatch(m)} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Eye size={13} /></button>
                                <button onClick={() => unmatch(m.id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><X size={13} /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── IMPORT ─────────────────────────────────────────────────────── */}
          {tab === 'import' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left controls */}
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Import As</label>
                    <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                      {(['bank', 'book'] as const).map(m => (
                        <button key={m} onClick={() => setImportMode(m)}
                          className={`flex-1 py-2 text-sm font-medium transition-colors ${importMode === m ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                          {m === 'bank' ? '🏦 Bank Statement' : '📒 Book Transactions'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Mapping Preset</label>
                    <select value={selectedPresetId} onChange={e => setSelectedPresetId(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>

                  {importMode === 'bank' && (
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Bank Name</label>
                      <input value={importBankName} onChange={e => setImportBankName(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Emirates NBD" />
                    </div>
                  )}

                  <button onClick={() => generateTemplate(importBankName)}
                    className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-700 px-4 py-2.5 rounded-lg text-sm hover:bg-slate-200">
                    <Download size={14} /> Download Template (.xlsx)
                  </button>

                  {/* Column guide */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1"><Info size={12} /> Expected Columns</p>
                    {['Date', 'Description', 'Reference', 'Debit', 'Credit', 'Balance'].map(col => (
                      <div key={col} className="flex items-center gap-2 text-xs text-blue-600 mb-1">
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" /> {col}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Drop zone */}
                <div className="lg:col-span-2">
                  <div
                    onDrop={onDrop}
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onClick={() => fileRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}>
                    <input ref={fileRef} type="file" className="hidden" accept=".csv,.xlsx,.xls"
                      onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
                    <Upload size={32} className={`mx-auto mb-3 ${dragging ? 'text-blue-500' : 'text-slate-400'}`} />
                    <p className="text-sm font-medium text-slate-700">Drop your bank statement here</p>
                    <p className="text-xs text-slate-400 mt-1">Supports CSV, Excel (.xlsx, .xls)</p>
                    <div className="mt-4 flex justify-center gap-2">
                      {['CSV', 'XLSX', 'XLS'].map(t => (
                        <span key={t} className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded">{t}</span>
                      ))}
                    </div>
                  </div>

                  {/* Parse preview */}
                  {parseResult && (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-2">
                        <div className="flex items-center gap-3 text-sm">
                          <FileSpreadsheet size={16} className="text-blue-500" />
                          <span className="font-medium text-slate-700">{parseResult.filename}</span>
                          <span className="text-slate-400">|</span>
                          <span className="text-emerald-600">{parseResult.validRows} valid</span>
                          {parseResult.invalidRows > 0 && <span className="text-red-500">{parseResult.invalidRows} invalid</span>}
                          {parseResult.detectedPreset && <span className="text-blue-600 text-xs bg-blue-50 px-2 py-0.5 rounded">Auto-detected: {presets.find(p => p.id === parseResult.detectedPreset)?.name}</span>}
                        </div>
                        <button onClick={() => setParseResult(null)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                      </div>

                      <div className="overflow-x-auto max-h-64 border border-slate-200 rounded-lg">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50 sticky top-0">
                            <tr>
                              {['#', 'Date', 'Description', 'Reference', 'Debit', 'Credit', 'Balance', 'Status'].map(h => (
                                <th key={h} className="text-left px-2 py-2 text-slate-500 font-medium">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {parseResult.rows.map((row, i) => (
                              <tr key={i} className={`${row.valid ? 'hover:bg-slate-50' : 'bg-red-50'}`}>
                                <td className="px-2 py-1.5 text-slate-400">{i + 1}</td>
                                <td className="px-2 py-1.5">{row.date || <span className="text-red-500">—</span>}</td>
                                <td className="px-2 py-1.5 truncate max-w-[180px]">{row.description}</td>
                                <td className="px-2 py-1.5">{row.reference}</td>
                                <td className="px-2 py-1.5 text-red-600">{row.debit > 0 ? row.debit.toFixed(2) : ''}</td>
                                <td className="px-2 py-1.5 text-emerald-600">{row.credit > 0 ? row.credit.toFixed(2) : ''}</td>
                                <td className="px-2 py-1.5">{row.balance > 0 ? row.balance.toFixed(2) : ''}</td>
                                <td className="px-2 py-1.5">
                                  {row.valid
                                    ? <span className="text-emerald-600 flex items-center gap-1"><CheckCircle size={11} /> Valid</span>
                                    : <span className="text-red-500 flex items-center gap-1" title={row.errors.join(', ')}><XCircle size={11} /> {row.errors[0]}</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <button onClick={confirmImport} disabled={importing || parseResult.validRows === 0}
                        className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                        {importing ? <RefreshCcw size={14} className="animate-spin" /> : <Upload size={14} />}
                        {importing ? 'Importing...' : `Import ${parseResult.validRows} Valid Rows`}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── PRESETS ────────────────────────────────────────────────────── */}
          {tab === 'presets' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">{presets.length} presets · Column mapping configurations per bank</p>
                <button onClick={() => { setEditPreset(null); setPresetForm({ delimiter: ',', dateFormat: 'DD/MM/YYYY', skipRows: 0, columns: { date: 'Date', description: 'Description', reference: 'Reference', debit: 'Debit', credit: 'Credit', balance: 'Balance' } }); setShowPresetModal(true); }}
                  className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700">
                  <Plus size={14} /> New Preset
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {presets.map(p => (
                  <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-slate-800 text-sm">{p.name}</h3>
                        <p className="text-xs text-slate-400">{p.bank}</p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => { setEditPreset(p); setPresetForm({ ...p }); setShowPresetModal(true); }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Settings size={13} /></button>
                        <button onClick={() => { const clone: MappingPreset = { ...p, id: `PRESET-${Date.now()}`, name: `${p.name} (Copy)`, createdAt: new Date().toISOString().slice(0, 10) }; setPresets(prev => [...prev, clone]); }} className="p-1.5 text-slate-400 hover:bg-slate-50 rounded"><Copy size={13} /></button>
                        <button onClick={() => setPresets(prev => prev.filter(x => x.id !== p.id))} className="p-1.5 text-red-400 hover:bg-red-50 rounded"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <div className="space-y-1 text-xs">
                      {Object.entries(p.columns).map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="text-slate-400 capitalize">{k}</span>
                          <span className="text-slate-600 font-mono bg-slate-50 px-1 rounded">{v}</span>
                        </div>
                      ))}
                      <div className="flex justify-between pt-1 border-t border-slate-100 mt-2">
                        <span className="text-slate-400">Delimiter</span>
                        <span className="text-slate-600 font-mono bg-slate-50 px-1 rounded">{p.delimiter === '\t' ? 'TAB' : p.delimiter}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Date Format</span>
                        <span className="text-slate-600 font-mono bg-slate-50 px-1 rounded">{p.dateFormat}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Skip Rows</span>
                        <span className="text-slate-600">{p.skipRows}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── BOOK TRANSACTIONS ──────────────────────────────────────────── */}
          {tab === 'book' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1 max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={bookSearch} onChange={e => setBookSearch(e.target.value)} placeholder="Search book transactions..." className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <select value={bookFilter} onChange={e => setBookFilter(e.target.value as RecStatus | 'All')}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="All">All Status</option>
                    <option value="Matched">Matched</option>
                    <option value="Partial">Partial</option>
                    <option value="Unmatched">Unmatched</option>
                  </select>
                </div>
                <button onClick={() => setShowBookModal(true)}
                  className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700">
                  <Plus size={14} /> Add Entry
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {['ID', 'Date', 'Description', 'Reference', 'Amount', 'Type', 'Category', 'Source', 'Status'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-slate-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredBook.map(b => (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-blue-600">{b.id}</td>
                        <td className="px-3 py-2">{b.date}</td>
                        <td className="px-3 py-2 max-w-[200px] truncate">{b.description}</td>
                        <td className="px-3 py-2 font-mono text-slate-500">{b.reference}</td>
                        <td className={`px-3 py-2 font-semibold ${b.type === 'Credit' ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(b.amount)}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${b.type === 'Credit' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{b.type}</span>
                        </td>
                        <td className="px-3 py-2 text-slate-500">{b.category}</td>
                        <td className="px-3 py-2"><span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px]">{b.source}</span></td>
                        <td className="px-3 py-2"><StatusBadge status={b.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── RECONCILE ──────────────────────────────────────────────────── */}
          {tab === 'reconcile' && (
            <div className="space-y-4">
              {/* Algorithm explanation */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2"><Info size={14} />Matching Algorithm</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-blue-700">
                  <div className="bg-white rounded-lg p-2 border border-blue-100">
                    <div className="font-bold text-blue-800 mb-1">Amount Match (40pts)</div>
                    Exact=40 · &lt;1=35 · &lt;5%=20 · &lt;15%=10
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-blue-100">
                    <div className="font-bold text-blue-800 mb-1">Date Tolerance (30pts)</div>
                    Same=30 · 1d=25 · 2d=20 · 3d=15 · 7d=5
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-blue-100">
                    <div className="font-bold text-blue-800 mb-1">Reference Match (20pts)</div>
                    Exact=20 · Contains=12 · Partial=6
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-blue-100">
                    <div className="font-bold text-blue-800 mb-1">Keywords (10pts)</div>
                    3pts per keyword hit · Max 10pts
                  </div>
                </div>
                <p className="text-xs text-blue-600 mt-2">High ≥75 · Medium ≥45 · Low &lt;45 · Direction mismatch: −30pts</p>
              </div>

              {/* Side-by-side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Bank side */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Banknote size={14} className="text-blue-500" />Bank Transactions</h3>
                    <div className="flex gap-2">
                      <div className="relative">
                        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input value={bankSearch} onChange={e => setBankSearch(e.target.value)} placeholder="Search..." className="pl-7 pr-2 py-1.5 border border-slate-200 rounded text-xs w-36" />
                      </div>
                      <select value={bankFilter} onChange={e => setBankFilter(e.target.value as RecStatus | 'All')} className="border border-slate-200 rounded text-xs px-2 py-1.5">
                        <option value="All">All</option>
                        <option value="Unmatched">Unmatched</option>
                        <option value="Partial">Partial</option>
                        <option value="Matched">Matched</option>
                      </select>
                    </div>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[480px] overflow-y-auto">
                    {filteredBank.map(b => {
                      const isSelected = selectedBank === b.id;
                      const amt = Math.max(b.credit, b.debit);
                      return (
                        <div key={b.id} onClick={() => b.status === 'Unmatched' || b.status === 'Partial' ? setSelectedBank(isSelected ? null : b.id) : null}
                          className={`p-3 border-b border-slate-100 last:border-0 transition-all ${isSelected ? 'bg-blue-50 border-blue-200' : b.status === 'Matched' ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50 cursor-pointer'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 flex-1">
                              {isSelected && <Check size={14} className="text-blue-600 mt-0.5 shrink-0" />}
                              <div className="flex-1">
                                <p className="text-xs font-medium text-slate-800 truncate">{b.description}</p>
                                <p className="text-[11px] text-slate-400">{b.date} · {b.reference} · {b.bank}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-sm font-bold ${b.credit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {b.credit > 0 ? '+' : '-'}{fmt(amt)}
                              </p>
                              <StatusBadge status={b.status} />
                            </div>
                          </div>
                          {isSelected && selectedBook && (() => {
                            const book = bookTxs.find(bk => bk.id === selectedBook);
                            if (!book) return null;
                            const s = scoreMatch(b, book);
                            return (
                              <div className="mt-2 pt-2 border-t border-blue-200">
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="text-blue-600 font-medium">Live Score vs selected book tx:</span>
                                  <div className="flex items-center gap-2"><ScoreBar score={s.score} /><ConfBadge c={s.confidence} /></div>
                                </div>
                                <div className="flex flex-wrap gap-1">{s.reasons.map((r, i) => <span key={i} className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{r}</span>)}</div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Book side */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2"><BookOpen size={14} className="text-purple-500" />Book Transactions</h3>
                    <div className="flex gap-2">
                      <div className="relative">
                        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input value={bookSearch} onChange={e => setBookSearch(e.target.value)} placeholder="Search..." className="pl-7 pr-2 py-1.5 border border-slate-200 rounded text-xs w-36" />
                      </div>
                      <select value={bookFilter} onChange={e => setBookFilter(e.target.value as RecStatus | 'All')} className="border border-slate-200 rounded text-xs px-2 py-1.5">
                        <option value="All">All</option>
                        <option value="Unmatched">Unmatched</option>
                        <option value="Partial">Partial</option>
                        <option value="Matched">Matched</option>
                      </select>
                    </div>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[480px] overflow-y-auto">
                    {filteredBook.map(b => {
                      const isSelected = selectedBook === b.id;
                      return (
                        <div key={b.id} onClick={() => b.status === 'Unmatched' || b.status === 'Partial' ? setSelectedBook(isSelected ? null : b.id) : null}
                          className={`p-3 border-b border-slate-100 last:border-0 transition-all ${isSelected ? 'bg-purple-50 border-purple-200' : b.status === 'Matched' ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50 cursor-pointer'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 flex-1">
                              {isSelected && <Check size={14} className="text-purple-600 mt-0.5 shrink-0" />}
                              <div className="flex-1">
                                <p className="text-xs font-medium text-slate-800 truncate">{b.description}</p>
                                <p className="text-[11px] text-slate-400">{b.date} · {b.reference} · {b.category}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-sm font-bold ${b.type === 'Credit' ? 'text-emerald-600' : 'text-red-600'}`}>
                                {b.type === 'Credit' ? '+' : '-'}{fmt(b.amount)}
                              </p>
                              <StatusBadge status={b.status} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Match button */}
              {selectedBank && selectedBook && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-sm">
                      <span className="font-medium text-blue-700">{selectedBank}</span>
                      <ArrowRight size={14} className="inline mx-2 text-slate-400" />
                      <span className="font-medium text-purple-700">{selectedBook}</span>
                    </div>
                    {(() => {
                      const bank = bankTxs.find(b => b.id === selectedBank);
                      const book = bookTxs.find(b => b.id === selectedBook);
                      if (!bank || !book) return null;
                      const s = scoreMatch(bank, book);
                      return <div className="flex items-center gap-2"><ScoreBar score={s.score} /><ConfBadge c={s.confidence} /></div>;
                    })()}
                  </div>
                  <button onClick={() => setShowMatchModal(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                    <Link2 size={14} /> Match Selected
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── SUGGESTIONS ────────────────────────────────────────────────── */}
          {tab === 'suggestions' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">AI-scored match suggestions ranked by confidence score</p>
                <button onClick={runAuto} className="flex items-center gap-1.5 text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100">
                  <RefreshCcw size={13} /> Refresh
                </button>
              </div>
              {suggestions.filter(s => !dismissedSuggestions.has(`${s.bankTxId}-${s.bookTxId}`)).length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <ShieldCheck size={40} className="mx-auto mb-3 text-emerald-400" />
                  <p className="font-medium text-slate-600">No pending suggestions</p>
                  <p className="text-sm">All transactions have been matched or dismissed</p>
                </div>
              ) : suggestions.filter(s => !dismissedSuggestions.has(`${s.bankTxId}-${s.bookTxId}`)).map(s => {
                const bank = bankTxs.find(b => b.id === s.bankTxId);
                const book = bookTxs.find(b => b.id === s.bookTxId);
                if (!bank || !book) return null;
                const key = `${s.bankTxId}-${s.bookTxId}`;
                return (
                  <div key={key} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                          <p className="text-[10px] text-blue-500 font-medium uppercase mb-1">Bank Transaction</p>
                          <p className="text-sm font-medium text-slate-800 truncate">{bank.description}</p>
                          <p className="text-xs text-slate-400">{bank.date} · {bank.reference}</p>
                          <p className={`text-sm font-bold mt-1 ${bank.credit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(Math.max(bank.credit, bank.debit))}</p>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                          <p className="text-[10px] text-purple-500 font-medium uppercase mb-1">Book Transaction</p>
                          <p className="text-sm font-medium text-slate-800 truncate">{book.description}</p>
                          <p className="text-xs text-slate-400">{book.date} · {book.reference}</p>
                          <p className={`text-sm font-bold mt-1 ${book.type === 'Credit' ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(book.amount)}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="flex items-center gap-2">
                          <ScoreBar score={s.score} />
                          <ConfBadge c={s.confidence} />
                        </div>
                        {s.difference > 0 && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Diff: {fmt(s.difference)}</span>}
                        <div className="flex gap-2 mt-1">
                          <button onClick={() => acceptSuggestion(s)} className="flex items-center gap-1 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-emerald-700"><Check size={12} /> Accept</button>
                          <button onClick={() => setDismissedSuggestions(prev => new Set([...prev, key]))} className="flex items-center gap-1 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs hover:bg-slate-200"><X size={12} /> Dismiss</button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {s.reasons.map((r, i) => <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{r}</span>)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── RULES ──────────────────────────────────────────────────────── */}
          {tab === 'rules' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">{rules.length} rules · Applied automatically on import and feed sync</p>
                <button onClick={() => { setEditRule(null); setRuleForm({ enabled: true, tx: 'Any', action: 'CreateBookTx', priority: rules.length + 1 }); setShowRuleModal(true); }}
                  className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700">
                  <Plus size={14} /> Add Rule
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {['Priority', 'Name', 'Pattern', 'Direction', 'Amount Range', 'Action', 'Category', 'Status', 'Actions'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-slate-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rules.sort((a, b) => a.priority - b.priority).map(r => (
                      <tr key={r.id} className={`hover:bg-slate-50 ${!r.enabled ? 'opacity-50' : ''}`}>
                        <td className="px-3 py-2"><span className="w-6 h-6 bg-slate-200 text-slate-700 rounded-full flex items-center justify-center font-bold">{r.priority}</span></td>
                        <td className="px-3 py-2 font-medium text-slate-800">{r.name}</td>
                        <td className="px-3 py-2 font-mono bg-slate-50 rounded">{r.contains}</td>
                        <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-[11px] font-medium ${r.tx === 'Credit' ? 'bg-emerald-100 text-emerald-700' : r.tx === 'Debit' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{r.tx}</span></td>
                        <td className="px-3 py-2 text-slate-500">
                          {r.amountMin || r.amountMax ? `${r.amountMin ? `≥${r.amountMin}` : ''} ${r.amountMax ? `≤${r.amountMax}` : ''}` : 'Any'}
                        </td>
                        <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-[11px] font-medium ${r.action === 'CreateBookTx' ? 'bg-blue-100 text-blue-700' : r.action === 'Ignore' ? 'bg-slate-100 text-slate-600' : 'bg-purple-100 text-purple-700'}`}>{r.action}</span></td>
                        <td className="px-3 py-2 text-slate-500">{r.category}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => setRules(prev => prev.map(x => x.id === r.id ? { ...x, enabled: !x.enabled } : x))}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${r.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${r.enabled ? 'translate-x-5' : 'translate-x-1'}`} />
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <button onClick={() => { setEditRule(r); setRuleForm({ ...r }); setShowRuleModal(true); }} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Settings size={13} /></button>
                            <button onClick={() => setRules(prev => prev.filter(x => x.id !== r.id))} className="p-1 text-red-400 hover:bg-red-50 rounded"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Rule engine docs */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2"><Info size={14} /> How Rules Work</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-amber-700">
                  <div><span className="font-semibold">Pattern</span> — Regex applied to description + reference (e.g. <code className="bg-amber-100 px-1 rounded">charge|fee|commission</code>)</div>
                  <div><span className="font-semibold">Direction</span> — Filter by Debit, Credit, or Any transaction direction</div>
                  <div><span className="font-semibold">Actions</span> — CreateBookTx: auto-create book entry · Ignore: skip · AutoMatch: auto-reconcile</div>
                </div>
                <p className="text-xs text-amber-600 mt-2">Rules run in priority order (1=highest). First matching rule wins and processing stops.</p>
              </div>
            </div>
          )}

          {/* ── FEEDS ──────────────────────────────────────────────────────── */}
          {tab === 'feeds' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`rounded-xl p-4 border-2 ${feedConnected ? 'border-emerald-300 bg-emerald-50' : 'border-dashed border-slate-300 bg-slate-50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-700 flex items-center gap-2"><Cloud size={16} /> Emirates NBD</h3>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${feedConnected ? 'bg-emerald-200 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{feedConnected ? 'Connected' : 'Not Connected'}</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">Automatic bank statement import via Open Banking API simulation</p>
                  <div className="flex gap-2">
                    <button onClick={() => setFeedConnected(!feedConnected)}
                      className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors ${feedConnected ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                      {feedConnected ? 'Disconnect' : 'Connect Bank'}
                    </button>
                    {feedConnected && (
                      <button onClick={syncFeed} disabled={feedSyncing}
                        className="flex items-center gap-1 text-xs bg-emerald-600 text-white px-3 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-60">
                        {feedSyncing ? <RefreshCcw size={12} className="animate-spin" /> : <RefreshCcw size={12} />} Sync
                      </button>
                    )}
                  </div>
                </div>
                {['ADCB', 'FAB'].map(bank => (
                  <div key={bank} className="rounded-xl p-4 border-2 border-dashed border-slate-300 bg-slate-50">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-slate-700 flex items-center gap-2"><Cloud size={16} /> {bank}</h3>
                      <span className="text-xs px-2 py-1 rounded-full font-medium bg-slate-200 text-slate-600">Not Connected</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">Connect your {bank} account for automatic feed</p>
                    <button className="w-full text-xs py-2 rounded-lg font-medium bg-slate-200 text-slate-600 cursor-not-allowed">Coming Soon</button>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Feed History</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {['Time', 'Bank', 'Transactions Added', 'Book Entries Created', 'Status'].map(h => (
                          <th key={h} className="text-left px-3 py-2 text-slate-500 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {feedLogs.map(f => (
                        <tr key={f.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono text-slate-500">{f.ts}</td>
                          <td className="px-3 py-2 font-medium">{f.bank}</td>
                          <td className="px-3 py-2">{f.added}</td>
                          <td className="px-3 py-2">{f.created}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${f.status === 'Success' ? 'bg-emerald-100 text-emerald-700' : f.status === 'Warning' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{f.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── REPORT ─────────────────────────────────────────────────────── */}
          {tab === 'report' && (
            <div className="space-y-5 max-w-3xl mx-auto">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800">Bank Reconciliation Statement</h2>
                <div className="flex gap-2">
                  <button onClick={() => window.print()} className="flex items-center gap-1.5 text-sm bg-slate-100 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-200"><Printer size={14} /> Print</button>
                  <button onClick={() => exportReconciliation(bankTxs, bookTxs, matches)} className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700"><Download size={14} /> Export</button>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                {/* Statement header */}
                <div className="bg-slate-800 text-white p-5">
                  <h2 className="text-lg font-bold">AccountsPro</h2>
                  <p className="text-sm text-slate-300">Bank Reconciliation Statement</p>
                  <p className="text-xs text-slate-400 mt-1">Period: March 2024 · Generated: {new Date().toLocaleDateString()}</p>
                </div>

                {/* Status banner */}
                <div className={`p-4 border-b ${summary.reconciled ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="flex items-center gap-2">
                    {summary.reconciled ? <CheckCircle size={18} className="text-emerald-600" /> : <AlertTriangle size={18} className="text-amber-600" />}
                    <span className={`font-semibold ${summary.reconciled ? 'text-emerald-800' : 'text-amber-800'}`}>
                      {summary.reconciled ? 'Fully Reconciled — No differences found' : `Reconciliation difference: ${fmt(summary.totalDifference)}`}
                    </span>
                  </div>
                </div>

                {/* Summary table */}
                <div className="p-5 space-y-4">
                  {[
                    { label: 'Opening Balance', value: summary.openingBalance, bold: false },
                    { label: 'Add: Total Deposits (Credits)', value: summary.totalDeposits, bold: false, color: 'text-emerald-600' },
                    { label: 'Less: Total Withdrawals (Debits)', value: -summary.totalWithdrawals, bold: false, color: 'text-red-600' },
                    { label: 'Closing Balance per Bank Statement', value: summary.closingBalance, bold: true },
                  ].map((row, i) => (
                    <div key={i} className={`flex justify-between items-center py-2 ${row.bold ? 'font-bold border-t-2 border-slate-800 text-slate-800 text-base' : 'text-slate-600 border-b border-slate-100'}`}>
                      <span>{row.label}</span>
                      <span className={row.color || ''}>{row.value < 0 ? `-${fmt(-row.value)}` : fmt(row.value)}</span>
                    </div>
                  ))}
                </div>

                {/* Breakdown */}
                {[
                  {
                    key: 'matched', title: `Matched Transactions (${summary.matchedCount})`, color: 'emerald',
                    items: matches.filter(m => m.difference < 1).map(m => {
                      const bank = bankTxs.find(b => b.id === m.bankTxId);
                      return { desc: `${m.bankTxId} ↔ ${m.bookTxId} · ${bank?.description}`, amount: bank ? Math.max(bank.credit, bank.debit) : 0 };
                    }),
                  },
                  {
                    key: 'partial', title: `Partial Matches (${summary.partialCount})`, color: 'amber',
                    items: matches.filter(m => m.difference >= 1).map(m => {
                      const bank = bankTxs.find(b => b.id === m.bankTxId);
                      return { desc: `${m.bankTxId} ↔ ${m.bookTxId} · Diff: ${fmt(m.difference)} · ${bank?.description}`, amount: bank ? Math.max(bank.credit, bank.debit) : 0 };
                    }),
                  },
                  {
                    key: 'unmatched', title: `Unmatched Bank Transactions (${summary.unmatchedBankCount})`, color: 'red',
                    items: bankTxs.filter(b => b.status === 'Unmatched').map(b => ({ desc: `${b.id} · ${b.date} · ${b.description}`, amount: Math.max(b.credit, b.debit) })),
                  },
                ].map(section => (
                  <div key={section.key} className="border-t border-slate-200">
                    <button onClick={() => setReportExpanded(prev => { const n = new Set(prev); n.has(section.key) ? n.delete(section.key) : n.add(section.key); return n; })}
                      className="w-full flex items-center justify-between p-4 hover:bg-slate-50 text-sm font-semibold text-slate-700">
                      <span>{section.title}</span>
                      {reportExpanded.has(section.key) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    {reportExpanded.has(section.key) && section.items.length > 0 && (
                      <div className="px-4 pb-4 space-y-1">
                        {section.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-xs text-slate-600 py-1 border-b border-slate-50">
                            <span className="flex-1 truncate">{item.desc}</span>
                            <span className="ml-4 font-medium">{fmt(item.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── AUDIT ──────────────────────────────────────────────────────── */}
          {tab === 'audit' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">{auditLog.length} audit entries · All reconciliation actions tracked</p>
                <button onClick={() => {
                  const wb = XLSX.utils.book_new();
                  const data = [['ID', 'Action', 'User', 'Timestamp', 'Details', 'Type'], ...auditLog.map(a => [a.id, a.action, a.user, a.timestamp, a.details, a.type])];
                  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Audit Log');
                  XLSX.writeFile(wb, `audit_log_${new Date().toISOString().slice(0, 10)}.xlsx`);
                }} className="flex items-center gap-1.5 text-sm bg-slate-100 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-200">
                  <Download size={14} /> Export Audit
                </button>
              </div>
              <div className="space-y-2">
                {auditLog.map(a => {
                  const cfg = {
                    match: { icon: <Link2 size={13} />, cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
                    unmatch: { icon: <X size={13} />, cls: 'bg-red-100 text-red-700 border-red-200' },
                    import: { icon: <Upload size={13} />, cls: 'bg-blue-100 text-blue-700 border-blue-200' },
                    rule: { icon: <Target size={13} />, cls: 'bg-purple-100 text-purple-700 border-purple-200' },
                    manual: { icon: <Check size={13} />, cls: 'bg-amber-100 text-amber-700 border-amber-200' },
                    system: { icon: <Zap size={13} />, cls: 'bg-slate-100 text-slate-700 border-slate-200' },
                    feed: { icon: <Cloud size={13} />, cls: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
                  }[a.type];
                  return (
                    <div key={a.id} className="flex items-start gap-3 bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border shrink-0 mt-0.5 ${cfg.cls}`}>{cfg.icon}{a.action}</span>
                      <div className="flex-1">
                        <p className="text-xs text-slate-700">{a.details}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{a.user} · {a.timestamp}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MATCH CONFIRM MODAL ────────────────────────────────────────────── */}
      {showMatchModal && selectedBank && selectedBook && (() => {
        const bank = bankTxs.find(b => b.id === selectedBank);
        const book = bookTxs.find(b => b.id === selectedBook);
        if (!bank || !book) return null;
        const s = scoreMatch(bank, book);
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
              <div className="flex items-center justify-between p-5 border-b border-slate-200">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Link2 size={18} className="text-blue-600" /> Confirm Match</h2>
                <button onClick={() => setShowMatchModal(false)}><X size={18} className="text-slate-400" /></button>
              </div>
              <div className="p-5 space-y-4">
                {/* Score summary */}
                <div className={`rounded-xl p-4 border ${s.confidence === 'High' ? 'bg-emerald-50 border-emerald-200' : s.confidence === 'Medium' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-700">Match Quality</span>
                    <div className="flex items-center gap-2"><ScoreBar score={s.score} /><ConfBadge c={s.confidence} /></div>
                  </div>
                  <div className="flex flex-wrap gap-1">{s.reasons.map((r, i) => <span key={i} className="text-[10px] bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{r}</span>)}</div>
                </div>

                {/* Transaction pair */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                    <p className="text-[10px] text-blue-500 font-bold uppercase mb-1">Bank</p>
                    <p className="text-xs font-medium text-slate-700 truncate">{bank.description}</p>
                    <p className="text-xs text-slate-400">{bank.date} · {bank.reference}</p>
                    <p className="text-sm font-bold text-slate-800 mt-1">{fmt(Math.max(bank.credit, bank.debit))}</p>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
                    <p className="text-[10px] text-purple-500 font-bold uppercase mb-1">Book</p>
                    <p className="text-xs font-medium text-slate-700 truncate">{book.description}</p>
                    <p className="text-xs text-slate-400">{book.date} · {book.reference}</p>
                    <p className="text-sm font-bold text-slate-800 mt-1">{fmt(book.amount)}</p>
                  </div>
                </div>

                {s.difference >= 1 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                    <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-amber-800">Partial Match — Difference: {fmt(s.difference)}</p>
                      <p className="text-xs text-amber-600 mt-0.5">This will be recorded as a Partial match. Consider creating an adjustment journal entry for the difference.</p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Match Note (optional)</label>
                  <input value={matchNote} onChange={e => setMatchNote(e.target.value)} placeholder="e.g. Partial payment accepted, balance on next statement"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-2 p-5 border-t border-slate-200">
                <button onClick={() => setShowMatchModal(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                <button onClick={confirmManualMatch} className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
                  <Link2 size={14} /> Confirm Match
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── VIEW MATCH MODAL ───────────────────────────────────────────────── */}
      {viewMatch && (() => {
        const bank = bankTxs.find(b => b.id === viewMatch.bankTxId);
        const book = bookTxs.find(b => b.id === viewMatch.bookTxId);
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
              <div className="flex items-center justify-between p-5 border-b border-slate-200">
                <h2 className="text-lg font-bold text-slate-800">Match Details — {viewMatch.id}</h2>
                <button onClick={() => setViewMatch(null)}><X size={18} className="text-slate-400" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                    <p className="text-[10px] text-blue-500 font-bold uppercase mb-1">Bank Transaction</p>
                    <p className="text-xs font-medium text-slate-700">{bank?.description}</p>
                    <p className="text-xs text-slate-400">{bank?.date} · {bank?.reference}</p>
                    <p className="text-sm font-bold text-slate-800 mt-1">{bank ? fmt(Math.max(bank.credit, bank.debit)) : '-'}</p>
                    <p className="text-xs text-slate-400 mt-1">{bank?.bank}</p>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
                    <p className="text-[10px] text-purple-500 font-bold uppercase mb-1">Book Transaction</p>
                    <p className="text-xs font-medium text-slate-700">{book?.description}</p>
                    <p className="text-xs text-slate-400">{book?.date} · {book?.reference}</p>
                    <p className="text-sm font-bold text-slate-800 mt-1">{book ? fmt(book.amount) : '-'}</p>
                    <p className="text-xs text-slate-400 mt-1">{book?.category}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-slate-400 mb-1">Score</p>
                    <ScoreBar score={viewMatch.score} />
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-slate-400 mb-1">Confidence</p>
                    <ConfBadge c={viewMatch.confidence} />
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-slate-400 mb-1">Difference</p>
                    <p className="text-sm font-bold text-slate-700">{viewMatch.difference < 1 ? 'None' : fmt(viewMatch.difference)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-2">Match Reasons</p>
                  <div className="flex flex-wrap gap-1">{viewMatch.reasons.map((r, i) => <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{r}</span>)}</div>
                </div>
                {viewMatch.note && <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700"><span className="font-semibold">Note: </span>{viewMatch.note}</div>}
                <div className="text-xs text-slate-400">Matched by <span className="font-medium text-slate-600">{viewMatch.matchedBy}</span> on {viewMatch.matchedAt} via {viewMatch.method}</div>
              </div>
              <div className="flex justify-between p-5 border-t border-slate-200">
                <button onClick={() => { unmatch(viewMatch.id); setViewMatch(null); }} className="flex items-center gap-1.5 text-sm text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50"><X size={14} /> Unmatch</button>
                <button onClick={() => setViewMatch(null)} className="px-5 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700">Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── RULE MODAL ─────────────────────────────────────────────────────── */}
      {showRuleModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">{editRule ? 'Edit Rule' : 'New Bank Rule'}</h2>
              <button onClick={() => setShowRuleModal(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              {[['Rule Name', 'name', 'text', 'e.g. Bank Charges & Fees'], ['Pattern (regex)', 'contains', 'text', 'e.g. charge|fee|commission'], ['Category', 'category', 'text', 'e.g. Bank Charges']].map(([label, key, type, ph]) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">{label}</label>
                  <input type={type} value={(ruleForm as Record<string, unknown>)[key] as string || ''} onChange={e => setRuleForm(p => ({ ...p, [key]: e.target.value }))} placeholder={ph}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Direction</label>
                  <select value={ruleForm.tx || 'Any'} onChange={e => setRuleForm(p => ({ ...p, tx: e.target.value as BankRule['tx'] }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="Any">Any</option>
                    <option value="Debit">Debit</option>
                    <option value="Credit">Credit</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Action</label>
                  <select value={ruleForm.action || 'CreateBookTx'} onChange={e => setRuleForm(p => ({ ...p, action: e.target.value as BankRule['action'] }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="CreateBookTx">Create Book Transaction</option>
                    <option value="Ignore">Ignore</option>
                    <option value="AutoMatch">Auto Match</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Min Amount</label>
                  <input type="number" value={ruleForm.amountMin || ''} onChange={e => setRuleForm(p => ({ ...p, amountMin: +e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="0" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Max Amount</label>
                  <input type="number" value={ruleForm.amountMax || ''} onChange={e => setRuleForm(p => ({ ...p, amountMax: +e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Any" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Priority</label>
                  <input type="number" value={ruleForm.priority || rules.length + 1} onChange={e => setRuleForm(p => ({ ...p, priority: +e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-slate-200">
              <button onClick={() => setShowRuleModal(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg">Cancel</button>
              <button onClick={() => {
                if (!ruleForm.name || !ruleForm.contains) return;
                if (editRule) {
                  setRules(prev => prev.map(r => r.id === editRule.id ? { ...r, ...ruleForm } as BankRule : r));
                } else {
                  setRules(prev => [...prev, { id: `R-${Date.now()}`, enabled: true, ...ruleForm } as BankRule]);
                }
                setShowRuleModal(false);
              }} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
                <Save size={14} className="inline mr-1" /> {editRule ? 'Save Changes' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BOOK ENTRY MODAL ───────────────────────────────────────────────── */}
      {showBookModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">Add Book Entry</h2>
              <button onClick={() => setShowBookModal(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              {[['Date', 'date', 'date'], ['Description', 'description', 'text'], ['Reference', 'reference', 'text'], ['Amount', 'amount', 'number'], ['Category', 'category', 'text']].map(([label, key, type]) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">{label}</label>
                  <input type={type} value={(bookForm as Record<string, unknown>)[key] as string || ''} onChange={e => setBookForm(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Type</label>
                <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                  {(['Credit', 'Debit'] as const).map(t => (
                    <button key={t} onClick={() => setBookForm(p => ({ ...p, type: t }))}
                      className={`flex-1 py-2 text-sm font-medium ${bookForm.type === t ? (t === 'Credit' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white') : 'bg-white text-slate-600'}`}>{t}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-slate-200">
              <button onClick={() => setShowBookModal(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg">Cancel</button>
              <button onClick={() => {
                if (!bookForm.date || !bookForm.description || !bookForm.amount) return;
                const newTx: BookTx = {
                  id: `BOOK-MAN-${Date.now()}`, date: bookForm.date, description: bookForm.description,
                  reference: bookForm.reference, amount: parseFloat(bookForm.amount), type: bookForm.type,
                  status: 'Unmatched', source: 'Manual', category: bookForm.category,
                };
                setBookTxs(prev => [...prev, newTx]);
                addAudit('Manual Book Entry', `Added ${newTx.id}: ${newTx.description} · ${fmt(newTx.amount)} · ${newTx.type}`, 'manual');
                setBookForm({ date: '', description: '', reference: '', amount: '', type: 'Credit', category: '' });
                setShowBookModal(false);
              }} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
                <Save size={14} className="inline mr-1" /> Add Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRESET MODAL ───────────────────────────────────────────────────── */}
      {showPresetModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">{editPreset ? 'Edit Preset' : 'New Mapping Preset'}</h2>
              <button onClick={() => setShowPresetModal(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Preset Name</label>
                  <input value={presetForm.name || ''} onChange={e => setPresetForm(p => ({ ...p, name: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Bank Name</label>
                  <input value={presetForm.bank || ''} onChange={e => setPresetForm(p => ({ ...p, bank: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Delimiter</label>
                  <select value={presetForm.delimiter || ','} onChange={e => setPresetForm(p => ({ ...p, delimiter: e.target.value as MappingPreset['delimiter'] }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value=",">Comma (,)</option>
                    <option value=";">Semicolon (;)</option>
                    <option value="\t">Tab</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Date Format</label>
                  <select value={presetForm.dateFormat || 'DD/MM/YYYY'} onChange={e => setPresetForm(p => ({ ...p, dateFormat: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option>DD/MM/YYYY</option>
                    <option>MM/DD/YYYY</option>
                    <option>YYYY-MM-DD</option>
                    <option>DD-MM-YYYY</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Skip Rows</label>
                  <input type="number" value={presetForm.skipRows ?? 0} onChange={e => setPresetForm(p => ({ ...p, skipRows: +e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <p className="text-xs font-semibold text-slate-600 mb-3">Column Mapping — enter exact column header names from your file</p>
                <div className="grid grid-cols-2 gap-3">
                  {(['date', 'description', 'reference', 'debit', 'credit', 'balance'] as const).map(col => (
                    <div key={col}>
                      <label className="text-xs text-slate-500 block mb-1 capitalize">{col} column</label>
                      <input value={presetForm.columns?.[col] || ''} onChange={e => setPresetForm(p => ({ ...p, columns: { ...(p.columns || {}), [col]: e.target.value } as MappingPreset['columns'] }))}
                        className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs" placeholder={col.charAt(0).toUpperCase() + col.slice(1)} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-slate-200">
              <button onClick={() => setShowPresetModal(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg">Cancel</button>
              <button onClick={() => {
                if (!presetForm.name || !presetForm.bank) return;
                if (editPreset) {
                  setPresets(prev => prev.map(p => p.id === editPreset.id ? { ...p, ...presetForm } as MappingPreset : p));
                } else {
                  setPresets(prev => [...prev, { id: `PRESET-${Date.now()}`, createdAt: new Date().toISOString().slice(0, 10), ...presetForm } as MappingPreset]);
                }
                setShowPresetModal(false);
              }} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
                <Save size={14} className="inline mr-1" /> {editPreset ? 'Save Changes' : 'Create Preset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
