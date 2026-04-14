/**
 * Merchant name normalization.
 *
 * Maps common OCR variants and abbreviations to canonical merchant names.
 * Falls through to basic sanitization for unknown merchants.
 */

const KNOWN_VARIANTS: Record<string, string> = {
  // Coffee
  "starbucks coffee": "Starbucks",
  starbucks: "Starbucks",
  "sbux": "Starbucks",
  dunkin: "Dunkin' Donuts",
  "dunkin donuts": "Dunkin' Donuts",
  "dunkin'": "Dunkin' Donuts",

  // Fast food
  mcdonalds: "McDonald's",
  "mcdonald's": "McDonald's",
  "mc donalds": "McDonald's",
  "burger king": "Burger King",
  "chick-fil-a": "Chick-fil-A",
  "chick fil a": "Chick-fil-A",
  "taco bell": "Taco Bell",
  wendys: "Wendy's",
  "wendy's": "Wendy's",
  "subway": "Subway",
  chipotle: "Chipotle",

  // Grocery
  walmart: "Walmart",
  "wal-mart": "Walmart",
  "wal mart": "Walmart",
  target: "Target",
  costco: "Costco",
  "costco wholesale": "Costco",
  kroger: "Kroger",
  "whole foods": "Whole Foods",
  "whole foods market": "Whole Foods",
  "trader joes": "Trader Joe's",
  "trader joe's": "Trader Joe's",
  aldi: "ALDI",
  "aldi store": "ALDI",
  safeway: "Safeway",

  // Gas
  shell: "Shell",
  "shell oil": "Shell",
  "bp": "BP",
  "chevron": "Chevron",
  exxon: "Exxon",
  "exxon mobil": "ExxonMobil",
  exxonmobil: "ExxonMobil",

  // Retail
  amazon: "Amazon",
  "amazon.com": "Amazon",
  "amzn": "Amazon",
  bestbuy: "Best Buy",
  "best buy": "Best Buy",
  "home depot": "Home Depot",
  "the home depot": "Home Depot",
  lowes: "Lowe's",
  "lowe's": "Lowe's",
  ikea: "IKEA",

  // Transport
  uber: "Uber",
  "uber trip": "Uber",
  "uber eats": "Uber Eats",
  lyft: "Lyft",
  "lyft ride": "Lyft",

  // Pharmacy
  cvs: "CVS",
  "cvs pharmacy": "CVS",
  walgreens: "Walgreens",

  // Streaming / subscriptions
  netflix: "Netflix",
  spotify: "Spotify",
  "apple.com/bill": "Apple",
  "apple.com": "Apple",
  "google *": "Google",
};

// Suffixes commonly appended by POS systems
const NOISE_SUFFIXES = [
  /\s*#\d+$/i,
  /\s*store\s*#?\d*$/i,
  /\s*\d{4,}$/,
  /\s*-\s*\d+$/,
  /\s+\d{1,2}\/\d{1,2}(\/\d{2,4})?$/,
  /\s+\d{5}$/,
];

function sanitize(raw: string): string {
  let cleaned = raw.trim();
  for (const re of NOISE_SUFFIXES) {
    cleaned = cleaned.replace(re, "");
  }
  return cleaned.trim();
}

export interface NormalizationResult {
  canonical: string;
  raw: string;
  matched: boolean;
}

export function normalizeMerchant(raw: string): NormalizationResult {
  if (!raw || raw.trim().length === 0) {
    return { canonical: "", raw, matched: false };
  }

  const cleaned = sanitize(raw);
  const key = cleaned.toLowerCase();

  const match = KNOWN_VARIANTS[key];
  if (match) {
    return { canonical: match, raw, matched: true };
  }

  // Try prefix match for patterns like "STARBUCKS #12345"
  for (const [variant, canonical] of Object.entries(KNOWN_VARIANTS)) {
    if (key.startsWith(variant)) {
      return { canonical, raw, matched: true };
    }
  }

  // Title-case fallback for unrecognized merchants
  const titleCased = cleaned
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());

  return { canonical: titleCased, raw, matched: false };
}
