
// ============================================================
// MATCHING ENGINE — Production-grade auto-reconciliation
// ============================================================
// Rules:
//   IF amount matches invoice AND date within ±3 days → auto reconcile
//   IF transaction_reference exists → ignore import (duplicate)
// ============================================================

export type MatchStatus = 'matched' | 'partial' | 'unmatched' | 'duplicate' | 'ignored';
export type MatchConfidence = 'high' | 'medium' | 'low';

export interface MatchRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;                 // lower = higher priority
  conditions: RuleCondition[];
  action: RuleAction;
  autoPost: boolean;               // auto-post to GL if matched
  requiresApproval: boolean;
  createdAt: string;
  lastTriggered?: string;
  triggerCount: number;
}

export interface RuleCondition {
  field: 'amount' | 'date' | 'reference' | 'description' | 'counterparty';
  operator:
    | 'equals'
    | 'within_days'
    | 'contains'
    | 'starts_with'
    | 'regex'
    | 'greater_than'
    | 'less_than'
    | 'between';
  value: string | number;
  value2?: string | number;        // for 'between' and 'within_days'
  caseSensitive?: boolean;
  weight: number;                  // contribution to total score (0–100)
}

export interface RuleAction {
  type: 'auto_match' | 'auto_reconcile' | 'ignore' | 'flag_review' | 'create_book_entry';
  matchTo?: 'invoice' | 'payment' | 'expense' | 'journal';
  bookEntryCategory?: string;
  bookEntryDescription?: string;
  notifyUser?: boolean;
  tagWith?: string[];
}

export interface MatchCandidate {
  bankTxId: string;
  bookTxId: string;
  score: number;                   // 0–100
  confidence: MatchConfidence;
  reasons: MatchReason[];
  difference: number;              // amount difference
  dateDiff: number;                // days difference
  ruleId?: string;                 // rule that triggered this match
  ruleName?: string;
  autoPost: boolean;
  requiresApproval: boolean;
}

export interface MatchReason {
  factor: string;
  score: number;
  detail: string;
  passed: boolean;
}

export interface MatchResult {
  candidates: MatchCandidate[];
  bestMatch: MatchCandidate | null;
  status: MatchStatus;
  processedAt: string;
  engineVersion: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  strategy: DuplicateStrategy;
  existingTxId?: string;
  existingTxDate?: string;
  confidence: number;
  detail: string;
}

export type DuplicateStrategy =
  | 'reference_exact'
  | 'amount_date_exact'
  | 'amount_date_window'
  | 'description_fuzzy'
  | 'none';

// ============================================================
// DEFAULT RULES (seeded on first load)
// ============================================================
export const DEFAULT_RULES: MatchRule[] = [
  {
    id: 'rule_001',
    name: 'Exact Amount + Invoice Reference',
    enabled: true,
    priority: 1,
    conditions: [
      {
        field: 'amount',
        operator: 'equals',
        value: 0,
        weight: 40,
      },
      {
        field: 'reference',
        operator: 'contains',
        value: '',
        weight: 35,
      },
      {
        field: 'date',
        operator: 'within_days',
        value: 3,
        weight: 25,
      },
    ],
    action: {
      type: 'auto_reconcile',
      matchTo: 'invoice',
      notifyUser: false,
      tagWith: ['auto-matched'],
    },
    autoPost: true,
    requiresApproval: false,
    createdAt: new Date().toISOString(),
    triggerCount: 0,
  },
  {
    id: 'rule_002',
    name: 'Amount Match + Date ±3 Days',
    enabled: true,
    priority: 2,
    conditions: [
      {
        field: 'amount',
        operator: 'equals',
        value: 0,
        weight: 50,
      },
      {
        field: 'date',
        operator: 'within_days',
        value: 3,
        weight: 50,
      },
    ],
    action: {
      type: 'auto_match',
      matchTo: 'payment',
      notifyUser: true,
      tagWith: ['amount-date-match'],
    },
    autoPost: false,
    requiresApproval: true,
    createdAt: new Date().toISOString(),
    triggerCount: 0,
  },
  {
    id: 'rule_003',
    name: 'Bank Charges Auto-Create',
    enabled: true,
    priority: 3,
    conditions: [
      {
        field: 'description',
        operator: 'regex',
        value: 'charge|fee|commission|levy',
        caseSensitive: false,
        weight: 70,
      },
      {
        field: 'amount',
        operator: 'less_than',
        value: 500,
        weight: 30,
      },
    ],
    action: {
      type: 'create_book_entry',
      bookEntryCategory: 'Bank Charges',
      bookEntryDescription: 'Auto: Bank charge / fee',
      notifyUser: false,
      tagWith: ['bank-charge', 'auto-created'],
    },
    autoPost: true,
    requiresApproval: false,
    createdAt: new Date().toISOString(),
    triggerCount: 0,
  },
  {
    id: 'rule_004',
    name: 'Agent Receipt Matching',
    enabled: true,
    priority: 4,
    conditions: [
      {
        field: 'description',
        operator: 'regex',
        value: 'agent|travel|tour|booking',
        caseSensitive: false,
        weight: 40,
      },
      {
        field: 'amount',
        operator: 'greater_than',
        value: 1000,
        weight: 30,
      },
      {
        field: 'date',
        operator: 'within_days',
        value: 5,
        weight: 30,
      },
    ],
    action: {
      type: 'flag_review',
      matchTo: 'invoice',
      notifyUser: true,
      tagWith: ['agent-receipt', 'review'],
    },
    autoPost: false,
    requiresApproval: true,
    createdAt: new Date().toISOString(),
    triggerCount: 0,
  },
  {
    id: 'rule_005',
    name: 'Supplier Payment',
    enabled: true,
    priority: 5,
    conditions: [
      {
        field: 'description',
        operator: 'regex',
        value: 'supplier|vendor|hotel|transfer|payment to',
        caseSensitive: false,
        weight: 45,
      },
      {
        field: 'date',
        operator: 'within_days',
        value: 7,
        weight: 30,
      },
      {
        field: 'amount',
        operator: 'greater_than',
        value: 500,
        weight: 25,
      },
    ],
    action: {
      type: 'auto_match',
      matchTo: 'expense',
      notifyUser: true,
      tagWith: ['supplier-payment'],
    },
    autoPost: false,
    requiresApproval: true,
    createdAt: new Date().toISOString(),
    triggerCount: 0,
  },
];

// ============================================================
// CORE MATCHING ENGINE
// ============================================================

export interface BankTxLike {
  id: string;
  date: string;
  description: string;
  reference?: string;
  debit: number;
  credit: number;
  balance?: number;
}

export interface BookTxLike {
  id: string;
  date: string;
  description: string;
  reference?: string;
  amount: number;
  type: 'debit' | 'credit';
}

/**
 * Score a single bank tx vs a single book tx pair.
 */
export function scorePair(
  bank: BankTxLike,
  book: BookTxLike,
  rule?: MatchRule
): MatchCandidate {
  const reasons: MatchReason[] = [];
  let totalScore = 0;

  // ── 1. AMOUNT MATCH (40 pts) ──────────────────────────────
  const bankAmount = bank.credit > 0 ? bank.credit : bank.debit;
  const bookAmount = Math.abs(book.amount);
  const amountDiff = Math.abs(bankAmount - bookAmount);
  const amountMatch = amountDiff < 0.01;
  const amountPartial = amountDiff / Math.max(bankAmount, bookAmount) < 0.05; // within 5%

  let amountScore = 0;
  if (amountMatch) {
    amountScore = 40;
    reasons.push({ factor: 'Amount', score: 40, detail: `Exact match AED ${bankAmount.toFixed(2)}`, passed: true });
  } else if (amountPartial) {
    amountScore = 25;
    reasons.push({ factor: 'Amount', score: 25, detail: `Near match (diff AED ${amountDiff.toFixed(2)})`, passed: true });
  } else {
    reasons.push({ factor: 'Amount', score: 0, detail: `Mismatch (bank AED ${bankAmount.toFixed(2)} vs book AED ${bookAmount.toFixed(2)})`, passed: false });
  }
  totalScore += amountScore;

  // ── 2. DATE MATCH within ±3 days (30 pts) ─────────────────
  const bankDate = new Date(bank.date).getTime();
  const bookDate = new Date(book.date).getTime();
  const daysDiff = Math.abs((bankDate - bookDate) / (1000 * 60 * 60 * 24));

  let dateScore = 0;
  if (daysDiff === 0) {
    dateScore = 30;
    reasons.push({ factor: 'Date', score: 30, detail: 'Same date', passed: true });
  } else if (daysDiff <= 1) {
    dateScore = 25;
    reasons.push({ factor: 'Date', score: 25, detail: `${daysDiff.toFixed(0)} day(s) apart`, passed: true });
  } else if (daysDiff <= 3) {
    dateScore = 15;
    reasons.push({ factor: 'Date', score: 15, detail: `${daysDiff.toFixed(0)} days apart (within ±3)`, passed: true });
  } else if (daysDiff <= 7) {
    dateScore = 5;
    reasons.push({ factor: 'Date', score: 5, detail: `${daysDiff.toFixed(0)} days apart (outside ±3, within 7)`, passed: false });
  } else {
    reasons.push({ factor: 'Date', score: 0, detail: `${daysDiff.toFixed(0)} days apart (too far)`, passed: false });
  }
  totalScore += dateScore;

  // ── 3. REFERENCE MATCH (20 pts) ───────────────────────────
  let refScore = 0;
  const bankRef = (bank.reference || '').toLowerCase().trim();
  const bookRef = (book.reference || '').toLowerCase().trim();

  if (bankRef && bookRef) {
    if (bankRef === bookRef) {
      refScore = 20;
      reasons.push({ factor: 'Reference', score: 20, detail: `Exact reference match: "${bank.reference}"`, passed: true });
    } else if (bankRef.includes(bookRef) || bookRef.includes(bankRef)) {
      refScore = 15;
      reasons.push({ factor: 'Reference', score: 15, detail: 'Partial reference match', passed: true });
    } else {
      reasons.push({ factor: 'Reference', score: 0, detail: 'Reference mismatch', passed: false });
    }
  } else {
    reasons.push({ factor: 'Reference', score: 0, detail: 'Reference not available', passed: false });
  }
  totalScore += refScore;

  // ── 4. DESCRIPTION KEYWORDS (10 pts) ──────────────────────
  let descScore = 0;
  const bankDesc = (bank.description || '').toLowerCase();
  const bookDesc = (book.description || '').toLowerCase();

  // Extract meaningful tokens (3+ chars, not common words)
  const stopWords = new Set(['the', 'and', 'for', 'from', 'with', 'this', 'that', 'ltd', 'llc']);
  const bankTokens = bankDesc.split(/\W+/).filter(t => t.length >= 3 && !stopWords.has(t));
  const bookTokens = bookDesc.split(/\W+/).filter(t => t.length >= 3 && !stopWords.has(t));

  const commonTokens = bankTokens.filter(t => bookTokens.some(bt => bt.includes(t) || t.includes(bt)));
  if (commonTokens.length > 0) {
    const ratio = commonTokens.length / Math.max(bankTokens.length, bookTokens.length, 1);
    descScore = Math.round(ratio * 10);
    reasons.push({ factor: 'Description', score: descScore, detail: `${commonTokens.length} keyword(s) matched: ${commonTokens.slice(0, 3).join(', ')}`, passed: true });
  } else {
    reasons.push({ factor: 'Description', score: 0, detail: 'No description keywords matched', passed: false });
  }
  totalScore += descScore;

  // ── 5. DIRECTION MISMATCH PENALTY (−20 pts) ───────────────
  const bankIsCredit = bank.credit > 0;
  const bookIsCredit = book.type === 'credit';
  if (bankIsCredit !== bookIsCredit) {
    totalScore = Math.max(0, totalScore - 20);
    reasons.push({ factor: 'Direction', score: -20, detail: 'Credit/Debit direction mismatch', passed: false });
  } else {
    reasons.push({ factor: 'Direction', score: 0, detail: 'Direction matches', passed: true });
  }

  // ── CONFIDENCE ─────────────────────────────────────────────
  const confidence: MatchConfidence =
    totalScore >= 75 ? 'high' :
    totalScore >= 45 ? 'medium' : 'low';

  return {
    bankTxId: bank.id,
    bookTxId: book.id,
    score: Math.min(100, Math.max(0, totalScore)),
    confidence,
    reasons,
    difference: amountDiff,
    dateDiff: daysDiff,
    ruleId: rule?.id,
    ruleName: rule?.name,
    autoPost: rule?.autoPost ?? false,
    requiresApproval: rule?.requiresApproval ?? true,
  };
}

/**
 * Find best book tx match for a given bank tx.
 */
export function findBestMatch(
  bank: BankTxLike,
  bookTxs: BookTxLike[],
  rules: MatchRule[],
  minScore = 45
): MatchResult {
  const enabledRules = [...rules].filter(r => r.enabled).sort((a, b) => a.priority - b.priority);
  const candidates: MatchCandidate[] = [];

  for (const book of bookTxs) {
    // Find best rule for this pair
    let bestRuleCandidate: MatchCandidate | null = null;

    for (const rule of enabledRules) {
      const c = scorePair(bank, book, rule);
      if (!bestRuleCandidate || c.score > bestRuleCandidate.score) {
        bestRuleCandidate = c;
      }
    }

    // Fallback: score without rules
    if (!bestRuleCandidate) {
      bestRuleCandidate = scorePair(bank, book);
    }

    if (bestRuleCandidate.score >= minScore) {
      candidates.push(bestRuleCandidate);
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const bestMatch = candidates[0] ?? null;

  const status: MatchStatus =
    !bestMatch ? 'unmatched' :
    bestMatch.score >= 75 && bestMatch.difference < 0.01 ? 'matched' :
    bestMatch.score >= 45 ? 'partial' : 'unmatched';

  return {
    candidates,
    bestMatch,
    status,
    processedAt: new Date().toISOString(),
    engineVersion: '2.0.0',
  };
}

/**
 * Run auto-match across all unmatched bank txs vs all unmatched book txs.
 */
export function runBatchAutoMatch(
  bankTxs: BankTxLike[],
  bookTxs: BookTxLike[],
  rules: MatchRule[],
  minScoreForAuto = 75
): {
  matches: Array<{ bankTxId: string; bookTxId: string; candidate: MatchCandidate }>;
  unmatched: string[];
  stats: AutoMatchStats;
} {
  const startTime = Date.now();
  const matches: Array<{ bankTxId: string; bookTxId: string; candidate: MatchCandidate }> = [];
  const usedBookIds = new Set<string>();
  const unmatched: string[] = [];

  // Sort bank txs by amount desc so largest are matched first
  const sortedBanks = [...bankTxs].sort((a, b) =>
    Math.max(b.credit, b.debit) - Math.max(a.credit, a.debit)
  );

  for (const bank of sortedBanks) {
    const availableBooks = bookTxs.filter(b => !usedBookIds.has(b.id));
    const result = findBestMatch(bank, availableBooks, rules, minScoreForAuto);

    if (result.bestMatch && result.bestMatch.score >= minScoreForAuto) {
      matches.push({
        bankTxId: bank.id,
        bookTxId: result.bestMatch.bookTxId,
        candidate: result.bestMatch,
      });
      usedBookIds.add(result.bestMatch.bookTxId);
    } else {
      unmatched.push(bank.id);
    }
  }

  const duration = Date.now() - startTime;
  const highConf = matches.filter(m => m.candidate.confidence === 'high').length;
  const medConf = matches.filter(m => m.candidate.confidence === 'medium').length;

  return {
    matches,
    unmatched,
    stats: {
      totalProcessed: bankTxs.length,
      matched: matches.length,
      unmatched: unmatched.length,
      highConfidence: highConf,
      mediumConfidence: medConf,
      lowConfidence: matches.length - highConf - medConf,
      durationMs: duration,
      avgScore: matches.length > 0
        ? Math.round(matches.reduce((s, m) => s + m.candidate.score, 0) / matches.length)
        : 0,
    },
  };
}

export interface AutoMatchStats {
  totalProcessed: number;
  matched: number;
  unmatched: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  durationMs: number;
  avgScore: number;
}

/**
 * Evaluate a single rule's conditions against a bank tx + book tx pair.
 */
export function evaluateRule(
  rule: MatchRule,
  bank: BankTxLike,
  book: BookTxLike
): { passed: boolean; score: number; detail: string } {
  let totalWeight = 0;
  let passedWeight = 0;
  const details: string[] = [];

  for (const cond of rule.conditions) {
    totalWeight += cond.weight;
    const bankAmount = bank.credit > 0 ? bank.credit : bank.debit;
    const bookAmount = Math.abs(book.amount);

    let passed = false;
    let detail = '';

    switch (cond.field) {
      case 'amount': {
        const val = Number(cond.value);
        const val2 = Number(cond.value2 ?? 0);
        switch (cond.operator) {
          case 'equals': passed = Math.abs(bankAmount - bookAmount) < 0.01; detail = `amount equals`; break;
          case 'greater_than': passed = bankAmount > val; detail = `amount > ${val}`; break;
          case 'less_than': passed = bankAmount < val; detail = `amount < ${val}`; break;
          case 'between': passed = bankAmount >= val && bankAmount <= val2; detail = `amount between ${val}-${val2}`; break;
          default: passed = false;
        }
        break;
      }
      case 'date': {
        const daysDiff = Math.abs(
          (new Date(bank.date).getTime() - new Date(book.date).getTime()) / (1000 * 60 * 60 * 24)
        );
        const tolerance = Number(cond.value);
        passed = daysDiff <= tolerance;
        detail = `date within ±${tolerance} days (actual: ${daysDiff.toFixed(1)})`;
        break;
      }
      case 'reference': {
        const bankRef = (bank.reference || '').toLowerCase();
        const bookRef = (book.reference || '').toLowerCase();
        const searchVal = String(cond.value).toLowerCase();
        switch (cond.operator) {
          case 'equals': passed = bankRef === bookRef; detail = `reference equals`; break;
          case 'contains': passed = bankRef.includes(searchVal) || bookRef.includes(searchVal); detail = `reference contains "${searchVal}"`; break;
          case 'starts_with': passed = bankRef.startsWith(searchVal) || bookRef.startsWith(searchVal); detail = `reference starts with "${searchVal}"`; break;
          case 'regex': {
            try { passed = new RegExp(searchVal, cond.caseSensitive ? '' : 'i').test(bankRef) || new RegExp(searchVal, 'i').test(bookRef); } catch { passed = false; }
            detail = `reference matches /${searchVal}/`;
            break;
          }
          default: passed = false;
        }
        break;
      }
      case 'description': {
        const bankDesc = (bank.description || '').toLowerCase();
        const bookDesc = (book.description || '').toLowerCase();
        const searchVal = String(cond.value);
        switch (cond.operator) {
          case 'contains': passed = bankDesc.includes(searchVal.toLowerCase()) || bookDesc.includes(searchVal.toLowerCase()); detail = `description contains "${searchVal}"`; break;
          case 'regex': {
            try { passed = new RegExp(searchVal, cond.caseSensitive ? '' : 'i').test(bankDesc); } catch { passed = false; }
            detail = `description matches /${searchVal}/`;
            break;
          }
          default: passed = false;
        }
        break;
      }
      default:
        passed = false;
    }

    if (passed) {
      passedWeight += cond.weight;
      details.push(`✓ ${detail}`);
    } else {
      details.push(`✗ ${detail}`);
    }
  }

  const score = totalWeight > 0 ? Math.round((passedWeight / totalWeight) * 100) : 0;
  return { passed: score >= 60, score, detail: details.join(' | ') };
}
