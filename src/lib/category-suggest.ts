/**
 * Category suggestion engine.
 *
 * Suggests an expense category based on either the merchant name or
 * keywords found in the OCR text. Falls back to "Other" when no match.
 */

import type { Category } from "@/lib/types";

/** Map of lowercase merchant keywords to their most likely category. */
const MERCHANT_CATEGORY_MAP: Record<string, Category> = {
  // Food & Dining
  starbucks: "Food & Dining",
  mcdonalds: "Food & Dining",
  "mcdonald's": "Food & Dining",
  "burger king": "Food & Dining",
  chipotle: "Food & Dining",
  "chick-fil-a": "Food & Dining",
  subway: "Food & Dining",
  "taco bell": "Food & Dining",
  "wendy's": "Food & Dining",
  wendys: "Food & Dining",
  "dunkin": "Food & Dining",
  "pizza hut": "Food & Dining",
  dominos: "Food & Dining",
  "panda express": "Food & Dining",
  "uber eats": "Food & Dining",
  doordash: "Food & Dining",
  grubhub: "Food & Dining",

  // Groceries
  walmart: "Groceries",
  "whole foods": "Groceries",
  kroger: "Groceries",
  "trader joe": "Groceries",
  aldi: "Groceries",
  safeway: "Groceries",
  costco: "Groceries",
  publix: "Groceries",
  "h-e-b": "Groceries",

  // Transportation
  uber: "Transportation",
  lyft: "Transportation",
  shell: "Transportation",
  bp: "Transportation",
  chevron: "Transportation",
  exxon: "Transportation",
  exxonmobil: "Transportation",
  "parking": "Transportation",

  // Shopping (retail, supermarkets, general merchandise)
  amazon: "Shopping",
  target: "Shopping",
  supermarket: "Shopping",
  hypermarket: "Shopping",
  "super store": "Shopping",
  "department store": "Shopping",
  "best buy": "Shopping",
  "home depot": "Shopping",
  "lowe's": "Shopping",
  lowes: "Shopping",
  ikea: "Shopping",
  "tj maxx": "Shopping",
  marshalls: "Shopping",
  nordstrom: "Shopping",
  "old navy": "Shopping",
  gap: "Shopping",
  zara: "Shopping",

  // Healthcare
  cvs: "Healthcare",
  walgreens: "Healthcare",
  "rite aid": "Healthcare",
  pharmacy: "Healthcare",

  // Bills & Utilities
  "at&t": "Bills & Utilities",
  verizon: "Bills & Utilities",
  "t-mobile": "Bills & Utilities",
  comcast: "Bills & Utilities",
  "pg&e": "Bills & Utilities",
  "electric": "Bills & Utilities",
  "water bill": "Bills & Utilities",
  "internet": "Bills & Utilities",

  // Entertainment
  netflix: "Entertainment",
  spotify: "Entertainment",
  hulu: "Entertainment",
  "disney+": "Entertainment",
  "apple tv": "Entertainment",
  amc: "Entertainment",
  regal: "Entertainment",
  "movie": "Entertainment",
  "cinema": "Entertainment",

  // Education
  university: "Education",
  college: "Education",
  udemy: "Education",
  coursera: "Education",
  textbook: "Education",
  "barnes & noble": "Education",

  // Travel
  airbnb: "Travel",
  booking: "Travel",
  hotel: "Travel",
  marriott: "Travel",
  hilton: "Travel",
  airline: "Travel",
  delta: "Travel",
  united: "Travel",
  american: "Travel",
  southwest: "Travel",
};

/** OCR text keywords mapped to categories. */
const TEXT_KEYWORDS: Array<{ keywords: string[]; category: Category }> = [
  { keywords: ["restaurant", "dine", "menu", "appetizer", "tip", "waiter", "server"], category: "Food & Dining" },
  {
    keywords: ["supermarket", "hypermarket", "minimart", "department store", "shopping mall", "retail"],
    category: "Shopping",
  },
  { keywords: ["grocery", "produce", "dairy", "bakery", "deli", "meat"], category: "Groceries" },
  { keywords: ["gas station", "fuel", "unleaded", "diesel", "gallons", "pump"], category: "Transportation" },
  { keywords: ["pharmacy", "prescription", "rx", "copay", "clinic", "doctor", "dentist"], category: "Healthcare" },
  { keywords: ["electric", "utility", "water bill", "sewer", "internet", "cable"], category: "Bills & Utilities" },
  { keywords: ["flight", "boarding pass", "airline", "hotel", "resort", "check-in"], category: "Travel" },
  { keywords: ["tuition", "textbook", "enrollment", "campus", "course"], category: "Education" },
  { keywords: ["cinema", "theater", "concert", "arcade", "amusement"], category: "Entertainment" },
];

export interface CategorySuggestion {
  category: Category;
  confidence: number; // 0 to 1
  source: "merchant" | "text_keyword" | "fallback";
}

export function suggestCategory(
  merchant: string,
  ocrText?: string
): CategorySuggestion {
  // 1. Try merchant name match
  const merchantLower = merchant.toLowerCase().trim();
  for (const [key, category] of Object.entries(MERCHANT_CATEGORY_MAP)) {
    if (merchantLower.includes(key)) {
      return { category, confidence: 0.85, source: "merchant" };
    }
  }

  // 2. Try OCR text keywords
  if (ocrText) {
    const textLower = ocrText.toLowerCase();
    for (const { keywords, category } of TEXT_KEYWORDS) {
      const matchCount = keywords.filter((kw) => textLower.includes(kw)).length;
      if (matchCount >= 2) {
        return { category, confidence: 0.7, source: "text_keyword" };
      }
      if (matchCount === 1) {
        return { category, confidence: 0.5, source: "text_keyword" };
      }
    }
  }

  // 3. Fallback
  return { category: "Other", confidence: 0.1, source: "fallback" };
}
