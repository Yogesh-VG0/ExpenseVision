"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Sparkles, Loader2 } from "lucide-react";

/**
 * Handles Supabase email confirmation redirects.
 * Supabase sends users to /auth/confirm#access_token=...&type=signup
 * Hash fragments are invisible to server-side route handlers,
 * so this client component reads the hash and exchanges tokens.
 */
export default function AuthConfirmPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    async function handleConfirmation() {
      const hash = window.location.hash;

      // Check for error in hash
      if (hash.includes("error=")) {
        const params = new URLSearchParams(hash.substring(1));
        const errorDesc = params.get("error_description") || "Authentication failed";
        setStatus("error");
        setMessage(errorDesc.replace(/\+/g, " "));
        setTimeout(() => router.push("/login?error=expired"), 3000);
        return;
      }

      // Check for access token (email confirmation success)
      if (hash.includes("access_token=")) {
        try {
          const supabase = createClient();
          // Supabase client automatically picks up the hash fragment
          const { data, error } = await supabase.auth.getSession();

          if (error || !data.session) {
            setStatus("error");
            setMessage("Unable to verify session. Please try logging in.");
            setTimeout(() => router.push("/login"), 3000);
            return;
          }

          setStatus("success");
          setMessage("Email verified! Redirecting to dashboard...");
          setTimeout(() => router.push("/dashboard"), 1500);
          return;
        } catch {
          setStatus("error");
          setMessage("An unexpected error occurred.");
          setTimeout(() => router.push("/login"), 3000);
          return;
        }
      }

      // Check for code in URL search params (PKCE flow)
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (code) {
        try {
          const supabase = createClient();
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setStatus("error");
            setMessage("Verification link expired. Please request a new one.");
            setTimeout(() => router.push("/login?error=expired"), 3000);
            return;
          }
          setStatus("success");
          setMessage("Email verified! Redirecting to dashboard...");
          setTimeout(() => router.push("/dashboard"), 1500);
          return;
        } catch {
          setStatus("error");
          setMessage("An unexpected error occurred.");
          setTimeout(() => router.push("/login"), 3000);
          return;
        }
      }

      // No token or code found
      setStatus("error");
      setMessage("Invalid confirmation link.");
      setTimeout(() => router.push("/login"), 3000);
    }

    handleConfirmation();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      {/* Background Effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
      </div>

      <div className="relative flex flex-col items-center gap-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>

        {status === "loading" && (
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        )}

        {status === "success" && (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
            <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        {status === "error" && (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
            <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )}

        <div>
          <h1 className="text-2xl font-bold">
            {status === "loading" && "Verifying..."}
            {status === "success" && "Email Verified!"}
            {status === "error" && "Verification Failed"}
          </h1>
          <p className="mt-2 text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  );
}
