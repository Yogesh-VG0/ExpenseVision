export const DIRHAM_SYMBOL = "\u20C3";

export const SUPPORTED_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "INR",
  "JPY",
  "AED",
  "CAD",
  "AUD",
  "SGD",
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_STORAGE_KEY = "expensevision.currency";

interface StoredCurrencyPreference {
  currency: SupportedCurrency;
  explicit: boolean;
}

const SUPPORTED_CURRENCY_SET = new Set<string>(SUPPORTED_CURRENCIES);

const LOCALE_CURRENCY_MAP: Record<string, SupportedCurrency> = {
  US: "USD",
  GB: "GBP",
  EU: "EUR",
  DE: "EUR",
  FR: "EUR",
  ES: "EUR",
  IT: "EUR",
  NL: "EUR",
  BE: "EUR",
  AT: "EUR",
  PT: "EUR",
  IE: "EUR",
  FI: "EUR",
  GR: "EUR",
  IN: "INR",
  JP: "JPY",
  AE: "AED",
  CA: "CAD",
  AU: "AUD",
  SG: "SGD",
  NZ: "AUD",
  CH: "EUR",
};

const CURRENCY_LOCALE_MAP: Record<SupportedCurrency, string> = {
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  INR: "en-IN",
  JPY: "ja-JP",
  AED: "en-AE",
  CAD: "en-CA",
  AUD: "en-AU",
  SGD: "en-SG",
};

export function isSupportedCurrency(value: unknown): value is SupportedCurrency {
  return typeof value === "string" && SUPPORTED_CURRENCY_SET.has(value);
}

export function detectCurrencyFromLocale(): SupportedCurrency {
  if (typeof window === "undefined") return "USD";

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    if (tz.startsWith("Asia/Kolkata") || tz.startsWith("Asia/Calcutta")) return "INR";
    if (tz.startsWith("Asia/Dubai") || tz.startsWith("Asia/Muscat")) return "AED";
    if (tz.startsWith("Asia/Tokyo")) return "JPY";
    if (tz.startsWith("Asia/Singapore")) return "SGD";
    if (tz.startsWith("Europe/London")) return "GBP";
    if (tz.startsWith("Europe/")) return "EUR";
    if (tz.startsWith("Australia/")) return "AUD";
    if (tz.startsWith("America/Toronto") || tz.startsWith("America/Vancouver")) return "CAD";

    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const region = locale.split("-").pop()?.toUpperCase();

    if (region && LOCALE_CURRENCY_MAP[region]) {
      return LOCALE_CURRENCY_MAP[region];
    }
  } catch {
    // Fall through to USD.
  }

  return "USD";
}

export function readStoredCurrencyPreference(): StoredCurrencyPreference | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as Partial<StoredCurrencyPreference>;

    if (!isSupportedCurrency(parsed.currency) || typeof parsed.explicit !== "boolean") {
      return null;
    }

    return { currency: parsed.currency, explicit: parsed.explicit };
  } catch {
    return null;
  }
}

export function persistCurrencyPreference(currency: string, explicit = true) {
  if (typeof window === "undefined" || !isSupportedCurrency(currency)) return;

  try {
    const payload: StoredCurrencyPreference = {
      currency,
      explicit,
    };

    window.localStorage.setItem(CURRENCY_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures.
  }
}

export function formatCurrencyAmount(amount: number, currency: string): string {
  const resolvedCurrency = isSupportedCurrency(currency) ? currency : "USD";

  if (resolvedCurrency === "AED") {
    const formatter = new Intl.NumberFormat("en-AE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return `${DIRHAM_SYMBOL}\u00A0${formatter.format(amount)}`;
  }

  return new Intl.NumberFormat(CURRENCY_LOCALE_MAP[resolvedCurrency], {
    style: "currency",
    currency: resolvedCurrency,
  }).format(amount);
}