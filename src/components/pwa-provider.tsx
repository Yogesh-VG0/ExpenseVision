"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/lib/telemetry";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PWAContextValue {
  canInstallNatively: boolean;
  isInstalled: boolean;
  install: () => Promise<void>;
}

const PWAContext = createContext<PWAContextValue>({
  canInstallNatively: false,
  isInstalled: false,
  install: async () => {},
});

export function usePWAInstall() {
  return useContext(PWAContext);
}

export function PWAProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    const iosStandalone = "standalone" in navigator && (navigator as Record<string, unknown>).standalone === true;
    return standalone || iosStandalone;
  });

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const handler = (e: MediaQueryListEvent) => setIsInstalled(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
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

    const promptHandler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", promptHandler);

    const installedHandler = () => setIsInstalled(true);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", promptHandler);
      window.removeEventListener("appinstalled", installedHandler);
      if (visibilityHandler) {
        document.removeEventListener("visibilitychange", visibilityHandler);
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
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      await trackEvent(
        outcome === "accepted" ? "install_prompt_accepted" : "install_prompt_dismissed",
        { surface: "nav_item" }
      );
      setDeferredPrompt(null);
      return;
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isFirefox = /firefox/i.test(navigator.userAgent);

    if (isIOS || isSafari) {
      toast("Install ExpenseVision", {
        description: "Tap the Share button in Safari, then \"Add to Home Screen\".",
        duration: 8000,
      });
    } else if (isFirefox) {
      toast("Install ExpenseVision", {
        description: "Open the browser menu (\u22EE) and look for \"Install\" or \"Add to Home Screen\".",
        duration: 8000,
      });
    } else {
      toast("Install ExpenseVision", {
        description: "Open the browser menu (\u22EE) and select \"Install app\" or \"Add to Home Screen\".",
        duration: 8000,
      });
    }
    await trackEvent("install_manual_instructions_shown", { surface: "nav_item" });
  }, [deferredPrompt]);

  return (
    <PWAContext value={{ canInstallNatively: !!deferredPrompt, isInstalled, install }}>
      {children}
    </PWAContext>
  );
}
