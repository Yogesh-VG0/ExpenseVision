"use client";

import { useTheme } from "@/components/theme-provider";
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!mounted) {
    return (
      <div className="flex h-9 w-[68px] shrink-0 items-center rounded-full border border-border/60 bg-muted/50 p-1" />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative flex h-9 w-[68px] shrink-0 items-center rounded-full border p-1 transition-all duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isDark
          ? "border-border/60 bg-muted/80"
          : "border-primary/20 bg-primary/10"
      )}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {/* Background icons */}
      <Sun className={cn(
        "absolute left-2 h-3.5 w-3.5 transition-opacity duration-300",
        isDark ? "opacity-30 text-muted-foreground" : "opacity-0"
      )} />
      <Moon className={cn(
        "absolute right-2 h-3.5 w-3.5 transition-opacity duration-300",
        isDark ? "opacity-0" : "opacity-30 text-muted-foreground"
      )} />

      {/* Sliding indicator */}
      <div
        className={cn(
          "relative z-10 flex h-7 w-7 items-center justify-center rounded-full shadow-md transition-all duration-300 ease-in-out",
          isDark
            ? "translate-x-[32px] bg-card border border-border/50"
            : "translate-x-0 bg-white border border-primary/20 shadow-primary/10"
        )}
      >
        {isDark ? (
          <Moon className="h-3.5 w-3.5 text-primary transition-transform duration-300" />
        ) : (
          <Sun className="h-3.5 w-3.5 text-primary transition-transform duration-300" />
        )}
      </div>
    </button>
  );
}
