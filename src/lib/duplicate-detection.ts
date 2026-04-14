/**
 * Duplicate expense detection.
 *
 * Compares a candidate expense against a list of recent expenses to detect
 * potential duplicates based on normalized merchant, amount, and date proximity.
 */

import { normalizeMerchant } from "@/lib/merchant-normalize";

export interface DuplicateCandidate {
  vendor: string;
  amount: number;
  date: string; // YYYY-MM-DD
}

export interface DuplicateMatch {
  isDuplicate: boolean;
  confidence: number; // 0 to 1
  matchId?: string;
  matchDetails?: {
    vendor: string;
    amount: number;
    date: string;
  };
}

function daysBetween(d1: string, d2: string): number {
  const date1 = new Date(d1).getTime();
  const date2 = new Date(d2).getTime();
  return Math.abs(date1 - date2) / (1000 * 60 * 60 * 24);
}

export function detectDuplicate(
  candidate: DuplicateCandidate,
  recentExpenses: Array<{ id: string; vendor: string | null; amount: number; date: string }>
): DuplicateMatch {
  if (recentExpenses.length === 0) {
    return { isDuplicate: false, confidence: 0 };
  }

  const normalizedCandidate = normalizeMerchant(candidate.vendor).canonical.toLowerCase();

  let bestMatch: DuplicateMatch = { isDuplicate: false, confidence: 0 };

  for (const expense of recentExpenses) {
    let score = 0;

    // Amount match (exact)
    const amountMatch = Math.abs(expense.amount - candidate.amount) < 0.01;
    if (amountMatch) score += 0.4;

    // Vendor match (normalized)
    const normalizedExisting = normalizeMerchant(expense.vendor ?? "").canonical.toLowerCase();
    if (
      normalizedCandidate &&
      normalizedExisting &&
      normalizedCandidate === normalizedExisting
    ) {
      score += 0.35;
    }

    // Date proximity (within 1 day = strong signal, within 3 days = moderate)
    const days = daysBetween(candidate.date, expense.date);
    if (days <= 0) {
      score += 0.25;
    } else if (days <= 1) {
      score += 0.2;
    } else if (days <= 3) {
      score += 0.1;
    }

    if (score > bestMatch.confidence) {
      bestMatch = {
        isDuplicate: score >= 0.75,
        confidence: score,
        matchId: expense.id,
        matchDetails: {
          vendor: expense.vendor ?? "",
          amount: expense.amount,
          date: expense.date,
        },
      };
    }
  }

  return bestMatch;
}
