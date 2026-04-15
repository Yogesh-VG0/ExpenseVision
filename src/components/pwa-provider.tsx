"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
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

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
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
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    await trackEvent(
      outcome === "accepted" ? "install_prompt_accepted" : "install_prompt_dismissed",
      { surface: "nav_item" }
    );
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const canInstall = !!deferredPrompt;

  return (
    <PWAContext value={{ canInstall, install, dismiss: install }}>
      {children}
    </PWAContext>
  );
}
