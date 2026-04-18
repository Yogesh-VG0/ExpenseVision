"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  detectCurrencyFromLocale,
  formatCurrencyAmount,
  isSupportedCurrency,
  persistCurrencyPreference,
  readStoredCurrencyPreference,
} from "@/lib/currency";

interface CurrencyContextValue {
  currency: string;
  format: (amount: number) => string;
  setCurrency: (currency: string) => void;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "USD",
  format: (amount) => formatCurrencyAmount(amount, "USD"),
  setCurrency: () => undefined,
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState("USD");

  const applyCurrency = useCallback((nextCurrency: string, persist = false) => {
    if (!isSupportedCurrency(nextCurrency)) return;

    setCurrency(nextCurrency);
    if (persist) {
      persistCurrencyPreference(nextCurrency, true);
    }
  }, []);

  useEffect(() => {
    const storedCurrency = readStoredCurrencyPreference();
    const nextCurrency = storedCurrency?.currency ?? detectCurrencyFromLocale();
    const frame = window.requestAnimationFrame(() => applyCurrency(nextCurrency));

    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        return;
      }

      supabase
        .from("profiles")
        .select("currency")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          const nextCurrency = isSupportedCurrency(data?.currency)
            ? data.currency
            : storedCurrency?.currency ?? detectCurrencyFromLocale();

          applyCurrency(nextCurrency);
        });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [applyCurrency]);

  const format = useMemo(() => {
    return (amount: number) => formatCurrencyAmount(amount, currency);
  }, [currency]);

  return (
    <CurrencyContext value={{ currency, format, setCurrency: (nextCurrency) => applyCurrency(nextCurrency, true) }}>
      <div data-currency={currency} suppressHydrationWarning>
        {children}
      </div>
    </CurrencyContext>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
