/**
 * Category suggestion engine for OCR, CSV import, and manual flows.
 *
 * - Merchant substring match (longest keys first to avoid "uber" vs "uber eats").
 * - OCR / description text: weighted keyword scores across all 10 categories.
 * - Import labels: `normalizeImportCategoryLabel()` maps bank/spreadsheet names to canonical categories.
 */

import type { Category } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";

const MAX_MERCHANT_CHARS = 500;
const MAX_TEXT_CHARS = 12_000;

/** Bank / app export labels (lowercase keys) → canonical category */
const IMPORT_LABEL_ALIASES: Record<string, Category> = {
  // Food & Dining
  "food & dining": "Food & Dining",
  "food and dining": "Food & Dining",
  "food & drink": "Food & Dining",
  "food and drink": "Food & Dining",
  "food/drink": "Food & Dining",
  "food / drink": "Food & Dining",
  "dining": "Food & Dining",
  "restaurants": "Food & Dining",
  "restaurant": "Food & Dining",
  "fast food": "Food & Dining",
  "coffee": "Food & Dining",
  "cafe": "Food & Dining",
  "takeout": "Food & Dining",
  "delivery food": "Food & Dining",
  "meals": "Food & Dining",
  "lunch": "Food & Dining",
  "bars & alcohol": "Food & Dining",

  // Groceries
  groceries: "Groceries",
  grocery: "Groceries",
  supermarket: "Groceries",
  "super market": "Groceries",
  hypermarket: "Groceries",
  "food & groceries": "Groceries",
  "food and groceries": "Groceries",

  // Transportation
  transportation: "Transportation",
  transport: "Transportation",
  "auto & transport": "Transportation",
  "auto and transport": "Transportation",
  automotive: "Transportation",
  "gas & fuel": "Transportation",
  "gas and fuel": "Transportation",
  gas: "Transportation",
  fuel: "Transportation",
  parking: "Transportation",
  tolls: "Transportation",
  transit: "Transportation",
  "public transit": "Transportation",
  rideshare: "Transportation",
  taxi: "Transportation",

  // Shopping
  shopping: "Shopping",
  retail: "Shopping",
  "general merchandise": "Shopping",
  merchandise: "Shopping",
  apparel: "Shopping",
  clothing: "Shopping",
  electronics: "Shopping",
  "home improvement": "Shopping",

  // Entertainment
  entertainment: "Entertainment",
  streaming: "Entertainment",
  subscription: "Entertainment",
  subscriptions: "Entertainment",
  movies: "Entertainment",
  games: "Entertainment",
  hobbies: "Entertainment",
  sports: "Entertainment",

  // Bills & Utilities
  "bills & utilities": "Bills & Utilities",
  "bills and utilities": "Bills & Utilities",
  utilities: "Bills & Utilities",
  utility: "Bills & Utilities",
  bills: "Bills & Utilities",
  "phone & internet": "Bills & Utilities",
  telecom: "Bills & Utilities",
  internet: "Bills & Utilities",
  electricity: "Bills & Utilities",
  water: "Bills & Utilities",
  rent: "Bills & Utilities",
  insurance: "Bills & Utilities",

  // Healthcare
  healthcare: "Healthcare",
  health: "Healthcare",
  medical: "Healthcare",
  pharmacy: "Healthcare",
  fitness: "Healthcare",
  wellness: "Healthcare",
  dental: "Healthcare",
  vision: "Healthcare",

  // Education
  education: "Education",
  tuition: "Education",
  books: "Education",
  school: "Education",

  // Travel
  travel: "Travel",
  vacation: "Travel",
  flights: "Travel",
  hotels: "Travel",
  lodging: "Travel",

  // Income / transfers (bank exports — not expense types; map to Other)
  income: "Other",
  salary: "Other",
  transfer: "Other",
  transfers: "Other",
  deposit: "Other",
  "credit card payment": "Other",
  payment: "Other",
};

/** Lowercase merchant substring → category (longest match wins via sort) */
const MERCHANT_CATEGORY_MAP: Record<string, Category> = {
  // Food & Dining — chains & patterns
  "uber eats": "Food & Dining",
  "door dash": "Food & Dining",
  "panda express": "Food & Dining",
  "burger king": "Food & Dining",
  "taco bell": "Food & Dining",
  "chick-fil-a": "Food & Dining",
  "five guys": "Food & Dining",
  "shake shack": "Food & Dining",
  "pizza hut": "Food & Dining",
  "dunkin": "Food & Dining",
  "tim hortons": "Food & Dining",
  "chipotle": "Food & Dining",
  "subway": "Food & Dining",
  "wendy's": "Food & Dining",
  wendys: "Food & Dining",
  "mcdonald's": "Food & Dining",
  mcdonalds: "Food & Dining",
  starbucks: "Food & Dining",
  peets: "Food & Dining",
  "coffee bean": "Food & Dining",
  dominos: "Food & Dining",
  kfc: "Food & Dining",
  popeyes: "Food & Dining",
  ihop: "Food & Dining",
  denny: "Food & Dining",
  olivegarden: "Food & Dining",
  "red lobster": "Food & Dining",
  "outback": "Food & Dining",
  "buffalo wild": "Food & Dining",
  panera: "Food & Dining",
  "jersey mike": "Food & Dining",
  "firehouse subs": "Food & Dining",
  "qdoba": "Food & Dining",
  cava: "Food & Dining",
  sweetgreen: "Food & Dining",
  "grubhub": "Food & Dining",
  doordash: "Food & Dining",
  seamless: "Food & Dining",
  "food court": "Food & Dining",
  restaurant: "Food & Dining",
  cafe: "Food & Dining",
  bakery: "Food & Dining",
  deli: "Food & Dining",
  cafeteria: "Food & Dining",
  catering: "Food & Dining",

  // Groceries
  "whole foods": "Groceries",
  "trader joe": "Groceries",
  "h-e-b": "Groceries",
  "stop & shop": "Groceries",
  "stop and shop": "Groceries",
  "food lion": "Groceries",
  "giant food": "Groceries",
  wegmans: "Groceries",
  meijer: "Groceries",
  "fred meyer": "Groceries",
  "winndixie": "Groceries",
  "publix": "Groceries",
  kroger: "Groceries",
  safeway: "Groceries",
  albertsons: "Groceries",
  aldi: "Groceries",
  lidl: "Groceries",
  costco: "Groceries",
  samsclub: "Groceries",
  "sam's club": "Groceries",
  bjs: "Groceries",
  walmart: "Groceries",
  target: "Shopping",
  "fresh market": "Groceries",
  "farmers market": "Groceries",
  "grocery": "Groceries",
  "supermarket": "Groceries",
  hypermarket: "Groceries",
  minimart: "Groceries",
  "food mart": "Groceries",
  "carrefour": "Groceries",
  "lulu hypermarket": "Groceries",
  "spinneys": "Groceries",
  "choithrams": "Groceries",
  "madina supermarket": "Groceries",
  "al madina": "Groceries",

  // Transportation
  "uber trip": "Transportation",
  "uber *": "Transportation",
  lyft: "Transportation",
  bolt: "Transportation",
  grab: "Transportation",
  careem: "Transportation",
  shell: "Transportation",
  chevron: "Transportation",
  exxon: "Transportation",
  exxonmobil: "Transportation",
  mobil: "Transportation",
  bp: "Transportation",
  aramco: "Transportation",
  enoc: "Transportation",
  adnoc: "Transportation",
  "speedway": "Transportation",
  "circle k": "Transportation",
  "7-eleven": "Transportation",
  wawa: "Transportation",
  "parking": "Transportation",
  "toll ": "Transportation",
  "ez pass": "Transportation",
  sunpass: "Transportation",
  mta: "Transportation",
  "metro ": "Transportation",
  amtrak: "Transportation",
  greyhound: "Transportation",
  "car rental": "Transportation",
  hertz: "Transportation",
  avis: "Transportation",
  budget: "Transportation",
  enterprise: "Transportation",
  "oil change": "Transportation",
  autozone: "Transportation",
  oreilly: "Transportation",
  "advance auto": "Transportation",
  "firestone": "Transportation",
  "jiffy lube": "Transportation",

  // Shopping (non-grocery retail)
  amazon: "Shopping",
  "best buy": "Shopping",
  "home depot": "Shopping",
  "lowe's": "Shopping",
  lowes: "Shopping",
  ikea: "Shopping",
  wayfair: "Shopping",
  "tj maxx": "Shopping",
  marshalls: "Shopping",
  ross: "Shopping",
  nordstrom: "Shopping",
  macys: "Shopping",
  "old navy": "Shopping",
  gap: "Shopping",
  zara: "Shopping",
  hm: "Shopping",
  uniqlo: "Shopping",
  shein: "Shopping",
  "foot locker": "Shopping",
  nike: "Shopping",
  adidas: "Shopping",
  "apple store": "Shopping",
  "microsoft store": "Shopping",
  "department store": "Shopping",
  "shopping mall": "Shopping",

  // Healthcare
  cvs: "Healthcare",
  walgreens: "Healthcare",
  "rite aid": "Healthcare",
  pharmacy: "Healthcare",
  "cvs pharmacy": "Healthcare",
  "rite-aid": "Healthcare",
  minuteclinic: "Healthcare",
  optometrist: "Healthcare",
  lenscrafters: "Healthcare",
  "warby parker": "Healthcare",
  hospital: "Healthcare",
  clinic: "Healthcare",
  urgent: "Healthcare",
  "minute clinic": "Healthcare",
  quest: "Healthcare",
  labcorp: "Healthcare",
  cigna: "Healthcare",
  aetna: "Healthcare",
  unitedhealth: "Healthcare",
  anthem: "Healthcare",

  // Bills & Utilities
  "at&t": "Bills & Utilities",
  att: "Bills & Utilities",
  verizon: "Bills & Utilities",
  "t-mobile": "Bills & Utilities",
  tmobile: "Bills & Utilities",
  sprint: "Bills & Utilities",
  comcast: "Bills & Utilities",
  xfinity: "Bills & Utilities",
  spectrum: "Bills & Utilities",
  "cox ": "Bills & Utilities",
  "pg&e": "Bills & Utilities",
  dukeenergy: "Bills & Utilities",
  "electric": "Bills & Utilities",
  "water bill": "Bills & Utilities",
  "water utility": "Bills & Utilities",
  seward: "Bills & Utilities",
  "internet": "Bills & Utilities",
  "cable": "Bills & Utilities",
  "fiber": "Bills & Utilities",
  aws: "Bills & Utilities",
  "google one": "Bills & Utilities",
  icloud: "Bills & Utilities",
  dropbox: "Bills & Utilities",
  "adobe": "Bills & Utilities",
  "microsoft 365": "Bills & Utilities",
  "rent payment": "Bills & Utilities",
  landlord: "Bills & Utilities",

  // Entertainment
  netflix: "Entertainment",
  spotify: "Entertainment",
  hulu: "Entertainment",
  "disney+": "Entertainment",
  "disney plus": "Entertainment",
  "hbo max": "Entertainment",
  "apple tv": "Entertainment",
  "youtube premium": "Entertainment",
  twitch: "Entertainment",
  steam: "Entertainment",
  playstation: "Entertainment",
  xbox: "Entertainment",
  nintendo: "Entertainment",
  amc: "Entertainment",
  regal: "Entertainment",
  cinemark: "Entertainment",
  "movie": "Entertainment",
  "cinema": "Entertainment",
  "theater": "Entertainment",
  ticketmaster: "Entertainment",
  stubhub: "Entertainment",
  "bowling": "Entertainment",

  // Education
  university: "Education",
  college: "Education",
  udemy: "Education",
  coursera: "Education",
  linkedinlearning: "Education",
  pluralsight: "Education",
  skillshare: "Education",
  "barnes & noble": "Education",
  textbook: "Education",
  pearson: "Education",
  chegg: "Education",
  "student loan": "Education",

  // Travel
  airbnb: "Travel",
  booking: "Travel",
  "booking.com": "Travel",
  expedia: "Travel",
  hotels: "Travel",
  "marriott": "Travel",
  hilton: "Travel",
  hyatt: "Travel",
  holidayinn: "Travel",
  ihg: "Travel",
  southwest: "Travel",
  delta: "Travel",
  united: "Travel",
  american: "Travel",
  jetblue: "Travel",
  frontier: "Travel",
  spirit: "Travel",
  emirates: "Travel",
  etihad: "Travel",
  "airline": "Travel",
  "resort": "Travel",
  "cruise": "Travel",
  uber: "Transportation",
};

/** Weighted keywords for OCR / memo text (scores summed per category) */
const TEXT_KEYWORD_WEIGHTS: Array<{ category: Category; term: string; weight: number }> = [
  // Groceries (specific product words)
  { category: "Groceries", term: "grocery", weight: 3 },
  { category: "Groceries", term: "groceries", weight: 3 },
  { category: "Groceries", term: "supermarket", weight: 3 },
  { category: "Groceries", term: "hypermarket", weight: 3 },
  { category: "Groceries", term: "produce", weight: 2 },
  { category: "Groceries", term: "organic", weight: 1 },
  { category: "Groceries", term: "frozen food", weight: 2 },
  { category: "Groceries", term: "dairy", weight: 2 },
  { category: "Groceries", term: "bakery", weight: 2 },
  { category: "Groceries", term: "deli", weight: 2 },
  { category: "Groceries", term: "meat dept", weight: 2 },
  { category: "Groceries", term: "fish counter", weight: 2 },

  // Food & Dining
  { category: "Food & Dining", term: "restaurant", weight: 3 },
  { category: "Food & Dining", term: "cafe", weight: 2 },
  { category: "Food & Dining", term: "coffee", weight: 2 },
  { category: "Food & Dining", term: "tip", weight: 2 },
  { category: "Food & Dining", term: "gratuity", weight: 2 },
  { category: "Food & Dining", term: "waiter", weight: 2 },
  { category: "Food & Dining", term: "menu", weight: 2 },
  { category: "Food & Dining", term: "appetizer", weight: 2 },
  { category: "Food & Dining", term: "server", weight: 1 },
  { category: "Food & Dining", term: "dine in", weight: 2 },

  // Shopping (retail — when not grocery)
  { category: "Shopping", term: "department store", weight: 4 },
  { category: "Shopping", term: "shopping mall", weight: 3 },
  { category: "Shopping", term: "apparel", weight: 2 },
  { category: "Shopping", term: "clothing", weight: 2 },
  { category: "Shopping", term: "electronics", weight: 2 },
  { category: "Shopping", term: "fashion", weight: 2 },

  // Transportation
  { category: "Transportation", term: "gas station", weight: 4 },
  { category: "Transportation", term: "fuel", weight: 2 },
  { category: "Transportation", term: "unleaded", weight: 3 },
  { category: "Transportation", term: "diesel", weight: 3 },
  { category: "Transportation", term: "gallons", weight: 2 },
  { category: "Transportation", term: "pump", weight: 2 },
  { category: "Transportation", term: "parking", weight: 2 },
  { category: "Transportation", term: "toll", weight: 2 },
  { category: "Transportation", term: "metro", weight: 2 },
  { category: "Transportation", term: "transit", weight: 2 },

  // Healthcare
  { category: "Healthcare", term: "pharmacy", weight: 3 },
  { category: "Healthcare", term: "prescription", weight: 3 },
  { category: "Healthcare", term: "rx", weight: 2 },
  { category: "Healthcare", term: "copay", weight: 2 },
  { category: "Healthcare", term: "clinic", weight: 2 },
  { category: "Healthcare", term: "hospital", weight: 2 },
  { category: "Healthcare", term: "dental", weight: 2 },
  { category: "Healthcare", term: "physician", weight: 2 },

  // Bills & Utilities
  { category: "Bills & Utilities", term: "electric bill", weight: 3 },
  { category: "Bills & Utilities", term: "utility", weight: 2 },
  { category: "Bills & Utilities", term: "water bill", weight: 3 },
  { category: "Bills & Utilities", term: "internet", weight: 2 },
  { category: "Bills & Utilities", term: "cable bill", weight: 2 },
  { category: "Bills & Utilities", term: "sewer", weight: 2 },

  // Travel
  { category: "Travel", term: "flight", weight: 3 },
  { category: "Travel", term: "boarding pass", weight: 4 },
  { category: "Travel", term: "airline", weight: 3 },
  { category: "Travel", term: "hotel", weight: 3 },
  { category: "Travel", term: "resort", weight: 2 },
  { category: "Travel", term: "check-in", weight: 2 },
  { category: "Travel", term: "baggage", weight: 2 },

  // Education
  { category: "Education", term: "tuition", weight: 3 },
  { category: "Education", term: "textbook", weight: 3 },
  { category: "Education", term: "enrollment", weight: 2 },
  { category: "Education", term: "campus", weight: 2 },
  { category: "Education", term: "course fee", weight: 2 },

  // Entertainment
  { category: "Entertainment", term: "cinema", weight: 3 },
  { category: "Entertainment", term: "theater", weight: 2 },
  { category: "Entertainment", term: "concert", weight: 3 },
  { category: "Entertainment", term: "arcade", weight: 2 },
  { category: "Entertainment", term: "amusement", weight: 2 },
  { category: "Entertainment", term: "streaming", weight: 2 },
];

const MERCHANT_SORTED_KEYS: Array<[string, Category]> = Object.entries(MERCHANT_CATEGORY_MAP).sort(
  (a, b) => b[0].length - a[0].length
);

const MIN_TEXT_SCORE = 2;

export interface CategorySuggestion {
  category: Category;
  confidence: number;
  source: "merchant" | "text_keyword" | "fallback";
}

/**
 * Maps a category column value from CSV/bank exports onto the 10 canonical names.
 * Safe for untrusted strings: length-bounded, no HTML interpretation.
 */
export function normalizeImportCategoryLabel(raw: string): Category {
  const lower = raw
    .trim()
    .toLowerCase()
    .slice(0, 200)
    .replace(/\s+/g, " ");

  if (!lower) return "Other";

  const direct = IMPORT_LABEL_ALIASES[lower];
  if (direct) return direct;

  const exact = CATEGORIES.find((c) => c.name.toLowerCase() === lower);
  if (exact) return exact.name;

  const partial = CATEGORIES.find(
    (c) => lower.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(lower)
  );
  if (partial) return partial.name;

  const fuzzy = Object.entries(IMPORT_LABEL_ALIASES).find(
    ([key]) => lower.includes(key) || key.includes(lower)
  );
  if (fuzzy) return fuzzy[1];

  return "Other";
}

function scoreTextForCategories(textLower: string): { category: Category; score: number } | null {
  const totals: Partial<Record<Category, number>> = {};

  for (const { category, term, weight } of TEXT_KEYWORD_WEIGHTS) {
    if (textLower.includes(term)) {
      totals[category] = (totals[category] ?? 0) + weight;
    }
  }

  let best: Category | null = null;
  let bestScore = 0;
  for (const c of CATEGORIES) {
    const s = totals[c.name] ?? 0;
    if (s > bestScore) {
      bestScore = s;
      best = c.name;
    }
  }

  if (best && bestScore >= MIN_TEXT_SCORE) {
    return { category: best, score: bestScore };
  }
  return null;
}

export function suggestCategory(
  merchant: string,
  ocrText?: string
): CategorySuggestion {
  const merchantLower = merchant
    .trim()
    .toLowerCase()
    .slice(0, MAX_MERCHANT_CHARS);

  for (const [key, category] of MERCHANT_SORTED_KEYS) {
    if (merchantLower.includes(key)) {
      return { category, confidence: 0.88, source: "merchant" };
    }
  }

  if (ocrText) {
    const textLower = ocrText.trim().toLowerCase().slice(0, MAX_TEXT_CHARS);
    const scored = scoreTextForCategories(textLower);
    if (scored) {
      const conf = Math.min(0.82, 0.45 + scored.score * 0.06);
      return { category: scored.category, confidence: conf, source: "text_keyword" };
    }
  }

  return { category: "Other", confidence: 0.1, source: "fallback" };
}
