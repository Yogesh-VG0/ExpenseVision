"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/telemetry";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PWAContextValue {
  canInstall: boolean;
  install: () => Promise<void>;
  dismiss: () => void;
}

const PWAContext = createContext<PWAContextValue>({
  canInstall: false,
  install: async () => {},
  dismiss: () => {},
});

export function usePWAInstall() {
  return useContext(PWAContext);
}

export function PWAProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const pathname = usePathname();
  const isLandingPage = pathname === "/";

  useEffect(() => {
    let timeoutId: number | null = null;
    let visibilityHandler: (() => void) | null = null;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => {
          registration.update().catch(() => undefined);
          visibilityHandler = () => {
            if (document.visibilityState === "visible") {
              registration.update().catch(() => undefined);
            }
          };
          document.addEventListener("visibilitychange", visibilityHandler);
        })
        .catch((err) => console.error("SW registration failed:", err));
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      timeoutId = window.setTimeout(() => setShowBanner(true), 30000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      if (visibilityHandler) {
        document.removeEventListener("visibilitychange", visibilityHandler);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  const router = useRouter();
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "launchQueue" in window &&
      typeof (window as Record<string, unknown>).launchQueue === "object"
    ) {
      const lq = (window as unknown as { launchQueue: { setConsumer(cb: (params: { files: Array<{ getFile(): Promise<File> }> }) => void): void } }).launchQueue;
      lq.setConsumer(async (launchParams) => {
        if (launchParams.files?.length > 0) {
          try {
            const fileHandle = launchParams.files[0];
            const file = await fileHandle.getFile();
            const reader = new FileReader();
            reader.onload = () => {
              try {
                sessionStorage.setItem(
                  "ev_launch_file",
                  JSON.stringify({
                    name: file.name,
                    type: file.type,
                    dataUrl: reader.result,
                    timestamp: Date.now(),
                  })
                );
              } catch {
                // sessionStorage quota exceeded
              }
              router.push("/receipts/capture");
            };
            reader.onerror = () => {
              router.push("/receipts/capture");
            };
            reader.readAsDataURL(file);
          } catch {
            router.push("/receipts/capture");
          }
        }
      });
    }
  }, [router]);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    await trackEvent(
      outcome === "accepted" ? "install_prompt_accepted" : "install_prompt_dismissed",
      { surface: "install_banner" }
    );
    setShowBanner(false);
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    void trackEvent("install_prompt_dismissed", { surface: "install_banner" });
    setShowBanner(false);
    setDeferredPrompt(null);
  }, []);

  const canInstall = showBanner && !!deferredPrompt;

  return (
    <PWAContext value={{ canInstall, install, dismiss }}>
      {children}
      {/* Only show floating banner on landing page where there's no sidebar */}
      {isLandingPage && canInstall && (
        <div className="fixed bottom-4 right-4 z-50 w-72 animate-fade-up rounded-xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 shrink-0 text-primary" />
            <p className="flex-1 text-xs font-medium">Install as app</p>
            <Button size="sm" onClick={install} className="h-6 px-2 text-[10px]">
              Install
            </Button>
            <button
              onClick={dismiss}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </PWAContext>
  );
}
