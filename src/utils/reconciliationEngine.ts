// ─── Reconciliation Engine ─────────────────────────────────────────────────────
// Production-grade double-entry bank reconciliation algorithm
// Implements: amount match, date tolerance ±3 days, reference match, description scoring

export type RecStatus = 'Matched' | 'Partial' | 'Unmatched';
export type TxDirection = 'Debit' | 'Credit';
export type MatchMethod = 'Auto' | 'Manual' | 'Rule' | 'Reference' | 'Amount' | 'Fuzzy';
export type MatchConfidence = 'High' | 'Medium' | 'Low';

export interface BankTx {
  id: string;
  date: string;           // ISO YYYY-MM-DD
  description: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  status: RecStatus;
  matchedWith?: string;
  source?: 'Import' | 'Feed' | 'Manual';
  bank?: string;
  raw?: Record<string, string>; // original parsed row
}

export interface BookTx {
  id: string;
  date: string;
  description: string;
  reference: string;
  amount: number;
  type: TxDirection;
  status: RecStatus;
  matchedWith?: string;
  source?: 'Invoice' | 'Payment' | 'Manual' | 'Import' | 'Journal';
  category?: string;
  invoiceRef?: string;
}

export interface RecMatch {
  id: string;
  bankTxId: string;
  bookTxId: string;
  matchedBy: string;
  matchedAt: string;
  difference: number;
  method: MatchMethod;
  confidence: MatchConfidence;
  score: number;
  reasons: string[];
  note?: string;
  adjustmentPosted?: boolean;
}

export interface MatchScore {
  score: number;
  confidence: MatchConfidence;
  reasons: string[];
  difference: number;
  method: MatchMethod;
}

export interface ReconciliationSummary {
  openingBalance: number;
  closingBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  matchedCount: number;
  partialCount: number;
  unmatchedBankCount: number;
  unmatchedBookCount: number;
  totalDifference: number;
  reconciled: boolean;
  matchedAmount: number;
  unmatchedBankAmount: number;
  unmatchedBookAmount: number;
}

// ─── Scoring Constants ────────────────────────────────────────────────────────
const SCORE = {
  AMOUNT_EXACT: 40,
  AMOUNT_NEAR: 35,       // diff < AED 1
  AMOUNT_SMALL: 20,      // diff < 5%
  AMOUNT_MODERATE: 10,   // diff < 15%
  DATE_SAME: 30,
  DATE_1DAY: 25,
  DATE_2DAY: 20,
  DATE_3DAY: 15,
  DATE_7DAY: 5,
  REF_EXACT: 20,
  REF_CONTAINS: 12,
  REF_PARTIAL: 6,
  DESC_KEYWORD: 3,       // per keyword hit, max 10
  DIRECTION_MISMATCH: -30,
  THRESHOLD_HIGH: 75,
  THRESHOLD_MEDIUM: 45,
};

// ─── Core Scoring Algorithm ───────────────────────────────────────────────────
export function scoreMatch(bank: BankTx, book: BookTx): MatchScore {
  const reasons: string[] = [];
  let score = 0;

  const bankAmt = bank.credit > 0 ? bank.credit : bank.debit;
  const bookAmt = book.amount;
  const diff = Math.abs(bankAmt - bookAmt);
  const pctDiff = bankAmt > 0 ? diff / bankAmt : 1;

  // ── Amount matching (max 40 pts) ──────────────────────────────────────────
  if (diff === 0) {
    score += SCORE.AMOUNT_EXACT;
    reasons.push('✓ Exact amount match');
  } else if (diff < 1) {
    score += SCORE.AMOUNT_NEAR;
    reasons.push(`✓ Near-exact amount (diff < AED 1)`);
  } else if (pctDiff < 0.05) {
    score += SCORE.AMOUNT_SMALL;
    reasons.push(`~ Amount within 5% (diff AED ${diff.toFixed(2)})`);
  } else if (pctDiff < 0.15) {
    score += SCORE.AMOUNT_MODERATE;
    reasons.push(`~ Amount within 15% (diff AED ${diff.toFixed(2)})`);
  } else {
    reasons.push(`✗ Large amount difference (AED ${diff.toFixed(2)})`);
  }

  // ── Date matching ±3 days (max 30 pts) ───────────────────────────────────
  const bankDate = new Date(bank.date).getTime();
  const bookDate = new Date(book.date).getTime();
  const dayDiff = Math.abs(bankDate - bookDate) / 86_400_000;

  if (dayDiff === 0) {
    score += SCORE.DATE_SAME;
    reasons.push('✓ Same date');
  } else if (dayDiff <= 1) {
    score += SCORE.DATE_1DAY;
    reasons.push('✓ 1 day apart');
  } else if (dayDiff <= 2) {
    score += SCORE.DATE_2DAY;
    reasons.push('✓ 2 days apart (within ±3 tolerance)');
  } else if (dayDiff <= 3) {
    score += SCORE.DATE_3DAY;
    reasons.push('✓ 3 days apart (within ±3 tolerance)');
  } else if (dayDiff <= 7) {
    score += SCORE.DATE_7DAY;
    reasons.push(`~ ${dayDiff} days apart (outside ±3, within ±7)`);
  } else {
    reasons.push(`✗ ${dayDiff} days apart (outside tolerance)`);
  }

  // ── Reference matching (max 20 pts) ──────────────────────────────────────
  const bankRef = bank.reference.toLowerCase().trim();
  const bookRef = book.reference.toLowerCase().trim();
  const bookInv = (book.invoiceRef || '').toLowerCase().trim();

  if (bankRef && bookRef) {
    if (bankRef === bookRef) {
      score += SCORE.REF_EXACT;
      reasons.push('✓ Reference exact match');
    } else if (bankRef.includes(bookRef) || bookRef.includes(bankRef)) {
      score += SCORE.REF_CONTAINS;
      reasons.push('✓ Reference contains match');
    } else if (bookInv && (bankRef.includes(bookInv) || bookInv.includes(bankRef))) {
      score += SCORE.REF_CONTAINS;
      reasons.push('✓ Invoice reference match');
    } else {
      // Partial — check if any 4+ char segment matches
      const segments = bookRef.split(/[-/\s]/).filter(s => s.length >= 4);
      const hit = segments.some(s => bankRef.includes(s));
      if (hit) {
        score += SCORE.REF_PARTIAL;
        reasons.push('~ Partial reference match');
      }
    }
  }

  // ── Description keyword matching (max 10 pts) ─────────────────────────────
  const bankDesc = bank.description.toLowerCase();
  const bookDesc = book.description.toLowerCase();
  const keywords = bookDesc.split(/\s+/).filter(w => w.length > 4);
  const hits = keywords.filter(w => bankDesc.includes(w));
  if (hits.length > 0) {
    const pts = Math.min(10, hits.length * SCORE.DESC_KEYWORD);
    score += pts;
    reasons.push(`✓ ${hits.length} description keyword(s) match: "${hits.slice(0, 2).join('", "')}"`);
  }

  // ── Direction check ───────────────────────────────────────────────────────
  const bankIsCredit = bank.credit > 0;
  const bookIsCredit = book.type === 'Credit';
  if (bankIsCredit !== bookIsCredit) {
    score = Math.max(0, score + SCORE.DIRECTION_MISMATCH);
    reasons.push('⚠ Direction mismatch (one Debit, one Credit)');
  }

  const confidence: MatchConfidence =
    score >= SCORE.THRESHOLD_HIGH ? 'High' :
    score >= SCORE.THRESHOLD_MEDIUM ? 'Medium' : 'Low';

  const method: MatchMethod =
    score >= 80 && diff === 0 ? 'Reference' :
    score >= 60 ? 'Amount' : 'Fuzzy';

  return { score, confidence, reasons, difference: diff, method };
}

// ─── Auto-Match Engine ────────────────────────────────────────────────────────
export interface AutoMatchResult {
  matches: RecMatch[];
  updatedBankTxs: BankTx[];
  updatedBookTxs: BookTx[];
  stats: {
    totalProcessed: number;
    newMatches: number;
    newPartials: number;
    skipped: number;
    duration: number;
  };
}

export function runAutoMatch(
  bankTxs: BankTx[],
  bookTxs: BookTx[],
  existingMatches: RecMatch[],
  options: { minScore?: number; allowPartial?: boolean } = {}
): AutoMatchResult {
  const startTime = Date.now();
  const { minScore = 45, allowPartial = true } = options;

  const newMatches: RecMatch[] = [];
  const updatedBank = bankTxs.map(b => ({ ...b }));
  const updatedBook = bookTxs.map(b => ({ ...b }));
  let skipped = 0;

  // Build sets of already-matched IDs
  const matchedBankIds = new Set(existingMatches.map(m => m.bankTxId));
  const matchedBookIds = new Set(existingMatches.map(m => m.bookTxId));

  // Candidate bank txs (unmatched only)
  const candidateBank = updatedBank.filter(
    b => b.status === 'Unmatched' && !matchedBankIds.has(b.id)
  );
  const candidateBook = updatedBook.filter(
    b => b.status === 'Unmatched' && !matchedBookIds.has(b.id)
  );

  // For each unmatched bank tx, find best scoring book tx
  for (const bankTx of candidateBank) {
    let bestScore = -1;
    let bestBook: BookTx | null = null;
    let bestResult: MatchScore | null = null;

    for (const bookTx of candidateBook) {
      // Skip already matched in this run
      if (matchedBookIds.has(bookTx.id)) continue;

      const result = scoreMatch(bankTx, bookTx);
      if (result.score > bestScore && result.score >= minScore) {
        bestScore = result.score;
        bestBook = bookTx;
        bestResult = result;
      }
    }

    if (bestBook && bestResult) {
      const isExact = bestResult.difference < 1;
      const isPartial = !isExact && allowPartial && bestResult.difference > 0;

      if (isExact || isPartial) {
        const newStatus: RecStatus = isExact ? 'Matched' : 'Partial';
        const matchId = `REC-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

        newMatches.push({
          id: matchId,
          bankTxId: bankTx.id,
          bookTxId: bestBook.id,
          matchedBy: 'Auto-Match Engine',
          matchedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
          difference: bestResult.difference,
          method: bestResult.method,
          confidence: bestResult.confidence,
          score: bestResult.score,
          reasons: bestResult.reasons,
        });

        // Update statuses
        const bIdx = updatedBank.findIndex(b => b.id === bankTx.id);
        const btIdx = updatedBook.findIndex(b => b.id === bestBook!.id);
        if (bIdx >= 0) {
          updatedBank[bIdx].status = newStatus;
          updatedBank[bIdx].matchedWith = bestBook.id;
        }
        if (btIdx >= 0) {
          updatedBook[btIdx].status = newStatus;
          updatedBook[btIdx].matchedWith = bankTx.id;
        }

        matchedBankIds.add(bankTx.id);
        matchedBookIds.add(bestBook.id);
      } else {
        skipped++;
      }
    } else {
      skipped++;
    }
  }

  const newMatched = newMatches.filter(m => m.difference < 1).length;
  const newPartials = newMatches.filter(m => m.difference >= 1).length;

  return {
    matches: newMatches,
    updatedBankTxs: updatedBank,
    updatedBookTxs: updatedBook,
    stats: {
      totalProcessed: candidateBank.length,
      newMatches: newMatched,
      newPartials,
      skipped,
      duration: Date.now() - startTime,
    },
  };
}

// ─── Reconciliation Summary Calculator ───────────────────────────────────────
export function calcSummary(
  bankTxs: BankTx[],
  bookTxs: BookTx[],
  matches: RecMatch[]
): ReconciliationSummary {
  const totalDeposits = bankTxs.reduce((s, t) => s + t.credit, 0);
  const totalWithdrawals = bankTxs.reduce((s, t) => s + t.debit, 0);
  const openingBalance = bankTxs.length > 0 ? (bankTxs[0].balance - bankTxs[0].credit + bankTxs[0].debit) : 0;
  const closingBalance = bankTxs.length > 0 ? bankTxs[bankTxs.length - 1].balance : 0;

  const matchedBank = bankTxs.filter(t => t.status === 'Matched');
  const partialBank = bankTxs.filter(t => t.status === 'Partial');
  const unmatchedBank = bankTxs.filter(t => t.status === 'Unmatched');
  const unmatchedBook = bookTxs.filter(t => t.status === 'Unmatched');

  const matchedAmount = matchedBank.reduce((s, t) => s + Math.max(t.credit, t.debit), 0);
  const unmatchedBankAmount = unmatchedBank.reduce((s, t) => s + Math.max(t.credit, t.debit), 0);
  const unmatchedBookAmount = unmatchedBook.reduce((s, t) => s + t.amount, 0);
  const totalDifference = matches.reduce((s, m) => s + m.difference, 0);

  return {
    openingBalance,
    closingBalance,
    totalDeposits,
    totalWithdrawals,
    matchedCount: matchedBank.length,
    partialCount: partialBank.length,
    unmatchedBankCount: unmatchedBank.length,
    unmatchedBookCount: unmatchedBook.length,
    totalDifference,
    reconciled: unmatchedBank.length === 0 && unmatchedBook.length === 0 && totalDifference < 1,
    matchedAmount,
    unmatchedBankAmount,
    unmatchedBookAmount,
  };
}

// ─── Suggestion Generator ─────────────────────────────────────────────────────
export interface Suggestion {
  bankTxId: string;
  bookTxId: string;
  score: number;
  confidence: MatchConfidence;
  reasons: string[];
  difference: number;
  method: MatchMethod;
}

export function generateSuggestions(
  bankTxs: BankTx[],
  bookTxs: BookTx[],
  existingMatches: RecMatch[],
  limit = 20
): Suggestion[] {
  const matchedBankIds = new Set(existingMatches.map(m => m.bankTxId));
  const matchedBookIds = new Set(existingMatches.map(m => m.bookTxId));

  const unBank = bankTxs.filter(b => b.status === 'Unmatched' && !matchedBankIds.has(b.id));
  const unBook = bookTxs.filter(b => b.status === 'Unmatched' && !matchedBookIds.has(b.id));

  const suggestions: Suggestion[] = [];

  for (const bank of unBank) {
    for (const book of unBook) {
      const result = scoreMatch(bank, book);
      if (result.score >= 30) {
        suggestions.push({
          bankTxId: bank.id,
          bookTxId: book.id,
          ...result,
        });
      }
    }
  }

  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
