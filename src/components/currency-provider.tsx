"use client";

import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

interface CurrencyContextValue {
  currency: string;
  format: (amount: number) => string;
}

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
  if (typeof window === "undefined") return "USD";
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

const DIRHAM = "\u20C3";

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "USD",
  format: (amount) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount),
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  // Always start with "USD" for SSR; locale detection runs client-side in useEffect
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    let resolved = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        if (!resolved) setCurrency(detectCurrencyFromLocale());
        return;
      }
      supabase
        .from("profiles")
        .select("currency")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          resolved = true;
          setCurrency(data?.currency || detectCurrencyFromLocale());
        });
    });
  }, []);

  const format = useMemo(() => {
    if (currency === "AED") {
      const numberFmt = new Intl.NumberFormat("en-AE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return (amount: number) => `${DIRHAM}\u00A0${numberFmt.format(amount)}`;
    }

    const localeMap: Record<string, string> = {
      INR: "en-IN",
      GBP: "en-GB",
      EUR: "de-DE",
      JPY: "ja-JP",
      AUD: "en-AU",
      CAD: "en-CA",
      SGD: "en-SG",
    };
    const locale = localeMap[currency] ?? "en-US";
    const formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    });
    return (amount: number) => formatter.format(amount);
  }, [currency]);

  return (
    <CurrencyContext value={{ currency, format }}>
      <div data-currency={currency} suppressHydrationWarning>
        {children}
      </div>
    </CurrencyContext>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
