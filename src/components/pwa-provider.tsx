"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/telemetry";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAProvider() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

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

  // ── launchQueue consumer (file_handlers progressive enhancement) ──
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
            // Store as data URL in sessionStorage for capture page to pick up
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
                // sessionStorage quota exceeded — navigate anyway
              }
              router.push("/receipts/capture");
            };
            reader.onerror = () => {
              router.push("/receipts/capture");
            };
            reader.readAsDataURL(file);
          } catch {
            // Fallback: navigate without the file
            router.push("/receipts/capture");
          }
        }
      });
    }
  }, [router]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    await trackEvent(
      outcome === "accepted" ? "install_prompt_accepted" : "install_prompt_dismissed",
      { surface: "install_banner" }
    );
    if (outcome === "accepted") {
      setShowBanner(false);
    } else {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    void trackEvent("install_prompt_dismissed", { surface: "install_banner" });
    setShowBanner(false);
    setDeferredPrompt(null);
  }, []);

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-fade-up rounded-xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-md sm:left-auto sm:right-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Download className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">Install ExpenseVision</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Add to your home screen for quick access and an app-like experience.
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={handleInstall} className="h-7 text-xs">
              Install
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={dismiss}
              className="h-7 text-xs"
            >
              Not now
            </Button>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
