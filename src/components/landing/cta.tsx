import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export function CTA() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />

      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8 animate-scale-in">
        <div className="overflow-hidden rounded-2xl border border-primary/20 bg-card/50 p-8 shadow-2xl shadow-primary/10 backdrop-blur-sm sm:p-12 glow-primary transition-all duration-500 hover:shadow-primary/20 hover:border-primary/30">
          <Sparkles className="mx-auto mb-6 h-12 w-12 text-primary animate-pulse-glow" />
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to take control of your finances?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Track smarter, spend less, and save more — all in one
            beautifully designed app.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              render={<Link href="/signup" />}
              className="h-12 gap-2 bg-primary px-8 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 transition-all duration-300"
            >
              Start Free Today
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              render={<Link href="/demo" />}
              className="h-12 px-8 text-base font-semibold hover:-translate-y-0.5 transition-all duration-300"
            >
              Try the Demo
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
