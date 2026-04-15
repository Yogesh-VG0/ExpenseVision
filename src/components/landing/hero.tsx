"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Play,
  Sparkles,
  TrendingUp,
  Shield,
  LayoutDashboard,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function Hero() {
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsSignedIn(!!user);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <section className="relative overflow-hidden pt-32 pb-16 sm:pt-40 sm:pb-20">
      {/* Animated Background Effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/15 blur-[100px] animate-float" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-accent/15 blur-[100px] animate-float" style={{ animationDelay: "3s" }} />
        <div className="absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[120px] animate-pulse-glow" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="animate-fade-down" style={{ animationDelay: "100ms" }}>
            <Badge
              variant="outline"
              className="mb-6 border-primary/30 bg-primary/10 px-4 py-1.5 text-primary transition-all duration-300 hover:bg-primary/20 hover:scale-105"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5 animate-pulse-glow" />
              AI-Powered Finance — Try it free
            </Badge>
          </div>

          {/* Heading */}
          <h1 className="animate-fade-up text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl" style={{ animationDelay: "200ms" }}>
            See where your money goes.{" "}
            <span className="text-gradient">
              Act on it.
            </span>
          </h1>

          {/* Subheading */}
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl animate-fade-up" style={{ animationDelay: "400ms" }}>
            Snap a receipt, track expenses, manage budgets, and get AI-powered
            insights — all in one beautiful app. No spreadsheets. No stress.
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row animate-fade-up" style={{ animationDelay: "600ms" }}>
            {isSignedIn ? (
              <>
                <Button
                  size="lg"
                  render={<Link href="/dashboard" />}
                  className="h-12 gap-2 bg-primary px-8 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 transition-all duration-300"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Go to Dashboard
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  render={<Link href="/demo" />}
                  className="h-12 gap-2 px-8 text-base font-semibold hover:-translate-y-0.5 transition-all duration-300"
                >
                  <Play className="h-4 w-4" />
                  Try Live Demo
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="lg"
                  render={<Link href="/signup" />}
                  className="h-12 gap-2 bg-primary px-8 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 transition-all duration-300"
                >
                  Get Started Free
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  render={<Link href="/demo" />}
                  className="h-12 gap-2 px-8 text-base font-semibold hover:-translate-y-0.5 transition-all duration-300"
                >
                  <Play className="h-4 w-4" />
                  Try Live Demo
                </Button>
              </>
            )}
          </div>

          {/* Social Proof */}
          <div className="mt-12 flex items-center justify-center gap-8 text-sm text-muted-foreground animate-fade-up" style={{ animationDelay: "800ms" }}>
            <div className="flex items-center gap-2 transition-colors duration-200 hover:text-foreground">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span>Track unlimited expenses</span>
            </div>
            <div className="hidden items-center gap-2 sm:flex transition-colors duration-200 hover:text-foreground">
              <Sparkles className="h-4 w-4 text-accent" />
              <span>AI receipt scanning</span>
            </div>
            <div className="hidden items-center gap-2 md:flex transition-colors duration-200 hover:text-foreground">
              <Shield className="h-4 w-4 text-green-500" />
              <span>Secure by design</span>
            </div>
          </div>
        </div>

        {/* Dashboard Preview Card */}
        <div className="relative mx-auto mt-16 max-w-5xl animate-fade-up" style={{ animationDelay: "1000ms" }}>
          <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50 shadow-2xl shadow-primary/10 backdrop-blur-sm transition-all duration-500 hover:shadow-primary/20 glow-primary">
            {/* Browser Chrome */}
            <div className="flex h-10 items-center gap-2 border-b border-border/50 bg-muted/50 px-4">
              <div className="h-3 w-3 rounded-full bg-red-500/60 transition-colors hover:bg-red-500" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/60 transition-colors hover:bg-yellow-500" />
              <div className="h-3 w-3 rounded-full bg-green-500/60 transition-colors hover:bg-green-500" />
              <div className="mx-auto rounded-md bg-background/50 px-4 py-1 text-xs text-muted-foreground">
                expensevision.tech/dashboard
              </div>
            </div>
            {/* Dashboard Preview — reflects real features */}
            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3 sm:p-6">
              {/* Feature Cards */}
              <div className="rounded-lg border border-border/50 bg-background/50 p-4 transition-all duration-300 hover:bg-background/70">
                <p className="text-xs text-muted-foreground">Monthly Spending</p>
                <p className="mt-1 text-2xl font-bold text-primary">
                  At a glance
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Track every expense in real time</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-background/50 p-4 transition-all duration-300 hover:bg-background/70">
                <p className="text-xs text-muted-foreground">Budget Progress</p>
                <div className="mt-2 space-y-2">
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-700" />
                  </div>
                  <p className="text-xs text-muted-foreground">Set & monitor category budgets</p>
                </div>
              </div>
              <div className="rounded-lg border border-border/50 bg-background/50 p-4 transition-all duration-300 hover:bg-background/70">
                <p className="text-xs text-muted-foreground">AI Insights</p>
                <p className="mt-1 text-sm font-medium text-accent">
                  Smart spending analysis
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Powered by machine learning</p>
              </div>
              {/* Chart Area */}
              <div className="col-span-1 flex h-40 items-end gap-1 rounded-lg border border-border/50 bg-background/50 p-4 sm:col-span-2">
                {[40, 65, 45, 80, 55, 70, 90, 60, 75, 50, 85, 95].map(
                  (h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-gradient-to-t from-primary/80 to-primary/30 transition-all duration-500 hover:from-primary hover:to-primary/50"
                      style={{ height: `${h}%`, animationDelay: `${i * 50}ms` }}
                    />
                  )
                )}
              </div>
              <div className="flex h-40 flex-col gap-2 rounded-lg border border-border/50 bg-background/50 p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Category Breakdown
                </p>
                {[
                  { label: "Food & Dining", pct: 35, color: "bg-primary" },
                  { label: "Transport", pct: 25, color: "bg-accent" },
                  { label: "Shopping", pct: 20, color: "bg-pink-500" },
                ].map((c) => (
                  <div key={c.label} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>{c.label}</span>
                      <span className="text-muted-foreground">{c.pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${c.color}`}
                        style={{ width: `${c.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Glow effect behind card */}
          <div className="pointer-events-none absolute -inset-4 -z-10 rounded-2xl bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 blur-2xl" />
        </div>
      </div>
    </section>
  );
}
