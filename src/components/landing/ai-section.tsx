import { Brain, TrendingUp, DollarSign, Zap } from "lucide-react";

export function AISection() {
  return (
    <section id="ai" className="relative py-24 sm:py-32 overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none absolute -right-40 top-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-accent/10 blur-[120px] animate-pulse-glow" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left Content */}
          <div className="animate-slide-right">
            <p className="text-sm font-semibold uppercase tracking-widest text-accent">
              AI-Powered
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Your personal finance{" "}
              <span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                AI assistant
              </span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Generate spending analysis, actionable savings tips, and
              budget warnings on demand — AI that works with your
              actual expense and budget data.
            </p>

            <div className="mt-8 space-y-4">
              {[
                {
                  icon: TrendingUp,
                  title: "Trend Detection",
                  description:
                    "Spot increasing expenses before they become problems",
                },
                {
                  icon: DollarSign,
                  title: "Savings Opportunities",
                  description:
                    "Spot high-spending categories and potential savings",
                },
                {
                  icon: Zap,
                  title: "Instant Analysis",
                  description:
                    "One-click comprehensive report on your financial health",
                },
              ].map((item) => (
                <div key={item.title} className="group/item flex gap-4 transition-all duration-200 hover:translate-x-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 transition-colors duration-200 group-hover/item:bg-accent/20">
                    <item.icon className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right - AI Preview Card */}
          <div className="relative animate-slide-left">
            <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50 p-6 shadow-2xl shadow-accent/10 backdrop-blur-sm transition-all duration-500 hover:shadow-accent/20 hover:border-accent/30">
              {/* Header */}
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-primary">
                  <Brain className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold">AI Financial Insights</p>
                  <p className="text-xs text-muted-foreground">
                    Generated just now
                  </p>
                </div>
              </div>

              {/* AI Output */}
              <div className="space-y-4 rounded-lg border border-accent/20 bg-accent/5 p-4">
                <div>
                  <p className="text-sm font-medium">
                    📊 Monthly Summary
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    You spent <span className="font-semibold text-foreground">$2,067</span> this
                    month across 20 transactions. That&apos;s{" "}
                    <span className="text-green-500">12% less</span> than last
                    month.
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">
                    💡 Savings Tip
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Consolidating Netflix + Spotify into a family plan could save{" "}
                    <span className="font-semibold text-primary">$13/month</span>.
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">
                    ⚠️ Budget Alert
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Shopping is at{" "}
                    <span className="font-semibold text-amber-500">97%</span> of
                    your budget. Consider pausing non-essential purchases.
                  </p>
                </div>
              </div>
            </div>

            {/* Glow */}
            <div className="pointer-events-none absolute -inset-4 -z-10 rounded-2xl bg-gradient-to-r from-accent/10 via-primary/10 to-accent/10 blur-2xl animate-pulse-glow" />
          </div>
        </div>
      </div>
    </section>
  );
}
