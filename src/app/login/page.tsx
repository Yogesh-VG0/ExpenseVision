"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { signInSchema, type SignInFormData } from "@/lib/validations";
import {
  OAuthProviderButtons,
  type OAuthProvider,
} from "@/components/auth/oauth-provider-buttons";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<SignInFormData>({
    email: "",
    password: "",
  });

  const handleOAuth = async (provider: OAuthProvider) => {
    setOauthLoading(provider);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}`,
        },
      });
      if (error) toast.error(error.message);
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setOauthLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = signInSchema.safeParse(formData);
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Welcome back!");
      router.push(redirect);
      router.refresh();
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      {/* Background Effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/15 blur-[100px] animate-float" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-accent/15 blur-[100px] animate-float" style={{ animationDelay: "3s" }} />
        <div className="absolute inset-0 bg-grid-pattern [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black_40%,transparent_100%)]" />
      </div>

      {/* Back to Home */}
      <Link href="/" className="fixed top-6 left-6 z-10 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Home
      </Link>

      <Card className="relative w-full max-w-md border-border/50 bg-card/50 backdrop-blur-xl animate-scale-in shadow-2xl shadow-primary/5">
        <CardHeader className="space-y-3 text-center">
          <Link
            href="/"
            className="group mx-auto flex items-center gap-2 text-lg font-bold"
          >
            <Image
              src="/minimal_optimized_for_favicon.png"
              alt="ExpenseVision logo"
              width={50}
              height={50}
              className="transition-transform duration-300 group-hover:scale-110"
            />
            <span>ExpenseVision</span>
          </Link>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>
            Log in to your account to continue
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <OAuthProviderButtons
            loadingProvider={oauthLoading}
            onSelect={(provider) => void handleOAuth(provider)}
          />

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase text-muted-foreground">or continue with email</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Log In
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <div className="w-full rounded-lg border border-border/50 bg-muted/30 p-3 text-center">
            <p className="text-sm text-muted-foreground">New to ExpenseVision?</p>
            <Button
              variant="link"
              className="mt-0.5 h-auto p-0 text-sm font-semibold text-primary"
              render={<Link href="/signup" />}
            >
              Create a free account
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
