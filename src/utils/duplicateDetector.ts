
// ============================================================
// DUPLICATE DETECTOR — Production-grade deduplication
// ============================================================
// Rules:
//   IF transaction_reference exists → ignore import (duplicate)
//   IF amount + date + direction exact → duplicate
//   IF amount + date within ±1 day → probable duplicate
// ============================================================

import type { DuplicateCheckResult, DuplicateStrategy, BankTxLike } from './matchingEngine';

export interface DuplicateReport {
  totalChecked: number;
  duplicatesFound: number;
  duplicateIds: string[];
  results: Array<{ txId: string; result: DuplicateCheckResult }>;
  durationMs: number;
}

// ── Reference index (fast O(1) lookup) ────────────────────────
let referenceIndex: Map<string, string> = new Map(); // ref → txId
let amountDateIndex: Map<string, string> = new Map(); // `amount|date|dir` → txId

/**
 * Rebuild the reference and amount-date indexes from an existing list of transactions.
 */
export function buildDuplicateIndex(existingTxs: BankTxLike[]): void {
  referenceIndex = new Map();
  amountDateIndex = new Map();

  for (const tx of existingTxs) {
    // Reference index
    if (tx.reference && tx.reference.trim()) {
      const normRef = normalizeReference(tx.reference);
      referenceIndex.set(normRef, tx.id);
    }

    // Amount + date + direction index
    const dir = tx.credit > 0 ? 'credit' : 'debit';
    const amount = tx.credit > 0 ? tx.credit : tx.debit;
    const dateKey = tx.date.substring(0, 10); // YYYY-MM-DD
    const key = `${amount.toFixed(2)}|${dateKey}|${dir}`;
    amountDateIndex.set(key, tx.id);
  }
}

/**
 * Check a single incoming transaction for duplicates.
 * Returns the first strategy that identifies it as a duplicate.
 */
export function checkDuplicate(
  incoming: BankTxLike,
  existingTxs: BankTxLike[]
): DuplicateCheckResult {

  // ── Strategy 1: Reference exact match ─────────────────────
  if (incoming.reference && incoming.reference.trim()) {
    const normRef = normalizeReference(incoming.reference);

    // Check index first (O(1))
    if (referenceIndex.has(normRef)) {
      const existingId = referenceIndex.get(normRef)!;
      const existing = existingTxs.find(t => t.id === existingId);
      return {
        isDuplicate: true,
        strategy: 'reference_exact',
        existingTxId: existingId,
        existingTxDate: existing?.date,
        confidence: 100,
        detail: `Transaction reference "${incoming.reference}" already exists (ID: ${existingId})`,
      };
    }

    // Fallback: linear search for partial reference matches
    for (const tx of existingTxs) {
      if (!tx.reference) continue;
      const normExisting = normalizeReference(tx.reference);
      if (normExisting === normRef) {
        return {
          isDuplicate: true,
          strategy: 'reference_exact',
          existingTxId: tx.id,
          existingTxDate: tx.date,
          confidence: 100,
          detail: `Reference match: "${incoming.reference}" = "${tx.reference}"`,
        };
      }
    }
  }

  // ── Strategy 2: Exact amount + exact date + direction ──────
  const incomingDir = incoming.credit > 0 ? 'credit' : 'debit';
  const incomingAmount = incoming.credit > 0 ? incoming.credit : incoming.debit;
  const incomingDateKey = incoming.date.substring(0, 10);
  const exactKey = `${incomingAmount.toFixed(2)}|${incomingDateKey}|${incomingDir}`;

  if (amountDateIndex.has(exactKey)) {
    const existingId = amountDateIndex.get(exactKey)!;
    const existing = existingTxs.find(t => t.id === existingId);
    return {
      isDuplicate: true,
      strategy: 'amount_date_exact',
      existingTxId: existingId,
      existingTxDate: existing?.date,
      confidence: 95,
      detail: `Same amount AED ${incomingAmount.toFixed(2)}, same date ${incomingDateKey}, same direction (${incomingDir})`,
    };
  }

  // ── Strategy 3: Amount + date within ±1 day ───────────────
  for (const tx of existingTxs) {
    const txDir = tx.credit > 0 ? 'credit' : 'debit';
    const txAmount = tx.credit > 0 ? tx.credit : tx.debit;

    if (txDir !== incomingDir) continue;
    if (Math.abs(txAmount - incomingAmount) > 0.01) continue;

    const incomingTime = new Date(incoming.date).getTime();
    const txTime = new Date(tx.date).getTime();
    const daysDiff = Math.abs((incomingTime - txTime) / (1000 * 60 * 60 * 24));

    if (daysDiff <= 1) {
      return {
        isDuplicate: true,
        strategy: 'amount_date_window',
        existingTxId: tx.id,
        existingTxDate: tx.date,
        confidence: 85,
        detail: `Same amount AED ${incomingAmount.toFixed(2)}, date within 1 day (${daysDiff.toFixed(1)} days apart)`,
      };
    }
  }

  // ── Strategy 4: Description fuzzy match (low confidence) ──
  for (const tx of existingTxs) {
    const txDir = tx.credit > 0 ? 'credit' : 'debit';
    const txAmount = tx.credit > 0 ? tx.credit : tx.debit;

    if (txDir !== incomingDir) continue;

    const amountRatio = Math.abs(txAmount - incomingAmount) / Math.max(txAmount, incomingAmount, 1);
    if (amountRatio > 0.01) continue; // amounts must be within 1%

    const similarity = descriptionSimilarity(incoming.description, tx.description);
    if (similarity >= 0.8) {
      const daysDiff = Math.abs(
        (new Date(incoming.date).getTime() - new Date(tx.date).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff <= 7) {
        return {
          isDuplicate: true,
          strategy: 'description_fuzzy',
          existingTxId: tx.id,
          existingTxDate: tx.date,
          confidence: Math.round(similarity * 80),
          detail: `Similar description (${Math.round(similarity * 100)}% match), same amount, within 7 days`,
        };
      }
    }
  }

  return {
    isDuplicate: false,
    strategy: 'none',
    confidence: 0,
    detail: 'No duplicate found',
  };
}

/**
 * Batch duplicate check — runs all strategies on a list of incoming txs.
 * Adds each clean tx to the index so intra-batch duplicates are also caught.
 */
export function batchDuplicateCheck(
  incoming: BankTxLike[],
  existingTxs: BankTxLike[]
): DuplicateReport {
  const start = Date.now();
  buildDuplicateIndex(existingTxs);

  const results: Array<{ txId: string; result: DuplicateCheckResult }> = [];
  const duplicateIds: string[] = [];

  // Rolling existing set so we also catch duplicates within the import batch
  const rolling = [...existingTxs];

  for (const tx of incoming) {
    const result = checkDuplicate(tx, rolling);
    results.push({ txId: tx.id, result });

    if (result.isDuplicate) {
      duplicateIds.push(tx.id);
    } else {
      // Add to rolling set and index so next tx in batch is compared against it
      rolling.push(tx);
      if (tx.reference?.trim()) {
        referenceIndex.set(normalizeReference(tx.reference), tx.id);
      }
      const dir = tx.credit > 0 ? 'credit' : 'debit';
      const amount = tx.credit > 0 ? tx.credit : tx.debit;
      const dateKey = tx.date.substring(0, 10);
      amountDateIndex.set(`${amount.toFixed(2)}|${dateKey}|${dir}`, tx.id);
    }
  }

  return {
    totalChecked: incoming.length,
    duplicatesFound: duplicateIds.length,
    duplicateIds,
    results,
    durationMs: Date.now() - start,
  };
}

// ── Helpers ────────────────────────────────────────────────────

function normalizeReference(ref: string): string {
  return ref
    .toLowerCase()
    .replace(/[\s\-_\/\\]+/g, '') // remove spaces, dashes, underscores, slashes
    .replace(/^0+/, '');          // remove leading zeros
}

/**
 * Simple token-based similarity (Jaccard index on word tokens).
 */
function descriptionSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return intersection / union;
}

function tokenize(text: string): string[] {
  const stopWords = new Set(['the', 'and', 'for', 'from', 'with', 'this', 'that', 'a', 'an', 'to', 'of', 'in', 'on']);
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter(t => t.length >= 3 && !stopWords.has(t));
}

// ── Strategy Label Helpers ─────────────────────────────────────
export function strategyLabel(strategy: DuplicateStrategy): string {
  const labels: Record<DuplicateStrategy, string> = {
    reference_exact: 'Reference Match',
    amount_date_exact: 'Amount + Date Exact',
    amount_date_window: 'Amount + Date ±1 Day',
    description_fuzzy: 'Description Similarity',
    none: 'No Duplicate',
  };
  return labels[strategy];
}

export function strategyColor(strategy: DuplicateStrategy): string {
  const colors: Record<DuplicateStrategy, string> = {
    reference_exact: 'bg-red-100 text-red-700',
    amount_date_exact: 'bg-orange-100 text-orange-700',
    amount_date_window: 'bg-yellow-100 text-yellow-700',
    description_fuzzy: 'bg-amber-100 text-amber-700',
    none: 'bg-green-100 text-green-700',
  };
  return colors[strategy];
}
