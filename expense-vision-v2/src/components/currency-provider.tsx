"use client";

import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

interface CurrencyContextValue {
  currency: string;
  format: (amount: number) => string;
}

/** Map common locale region codes to currencies */
const LOCALE_CURRENCY_MAP: Record<string, string> = {
  US: "USD", GB: "GBP", EU: "EUR", DE: "EUR", FR: "EUR", ES: "EUR",
  IT: "EUR", NL: "EUR", BE: "EUR", AT: "EUR", PT: "EUR", IE: "EUR",
  FI: "EUR", GR: "EUR", IN: "INR", JP: "JPY", AE: "AED", CA: "CAD",
  AU: "AUD", SG: "SGD", NZ: "NZD", CH: "CHF", SE: "SEK", NO: "NOK",
  DK: "DKK", KR: "KRW", CN: "CNY", HK: "HKD", TW: "TWD", MY: "MYR",
  TH: "THB", PH: "PHP", ID: "IDR", VN: "VND", BR: "BRL", MX: "MXN",
  ZA: "ZAR", NG: "NGN", EG: "EGP", SA: "SAR", QA: "QAR", KW: "KWD",
  BH: "BHD", OM: "OMR", PK: "PKR", BD: "BDT", LK: "LKR",
};

function detectCurrencyFromLocale(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const region = locale.split("-").pop()?.toUpperCase();
    if (region && LOCALE_CURRENCY_MAP[region]) return LOCALE_CURRENCY_MAP[region];

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    if (tz.startsWith("Asia/Kolkata") || tz.startsWith("Asia/Calcutta")) return "INR";
    if (tz.startsWith("Asia/Dubai") || tz.startsWith("Asia/Muscat")) return "AED";
    if (tz.startsWith("Asia/Tokyo")) return "JPY";
    if (tz.startsWith("Asia/Singapore")) return "SGD";
    if (tz.startsWith("Europe/London")) return "GBP";
    if (tz.startsWith("Europe/")) return "EUR";
    if (tz.startsWith("Australia/")) return "AUD";
    if (tz.startsWith("America/Toronto") || tz.startsWith("America/Vancouver")) return "CAD";
  } catch {
    // Fallback silently
  }
  return "USD";
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "USD",
  format: (amount) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount),
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    // Start with locale-based detection
    const detected = detectCurrencyFromLocale();
    setCurrency(detected);

    // Override with user preference if available
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("profiles")
        .select("currency")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data?.currency) setCurrency(data.currency);
        });
    });
  }, []);

  const format = useMemo(() => {
    // AED uses the new UAE Dirham symbol (custom font)
    if (currency === "AED") {
      const numberFmt = new Intl.NumberFormat("en-AE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return (amount: number) => `\u00EA\u00A0${numberFmt.format(amount)}`;
    }
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    });
    return (amount: number) => formatter.format(amount);
  }, [currency]);

  return (
    <CurrencyContext value={{ currency, format }}>
      <div data-currency={currency}>
        {children}
      </div>
    </CurrencyContext>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
