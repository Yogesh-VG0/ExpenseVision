import {
  Camera,
  PieChart,
  Wallet,
  Brain,
  Bell,
  Tag,
  TrendingDown,
  Receipt,
} from "lucide-react";

const features = [
  {
    icon: Camera,
    title: "Receipt Scanning",
    description:
      "Snap a photo of any receipt. Our AI extracts amount, vendor, date, and category automatically.",
    color: "from-primary to-amber-400",
  },
  {
    icon: PieChart,
    title: "Smart Analytics",
    description:
      "Beautiful charts and breakdowns by category, merchant, and time period. See exactly where your money goes.",
    color: "from-accent to-violet-400",
  },
  {
    icon: Wallet,
    title: "Budget Tracking",
    description:
      "Set monthly budgets per category with real-time progress bars. Get alerts before you overspend.",
    color: "from-green-500 to-emerald-400",
  },
  {
    icon: Brain,
    title: "AI Insights",
    description:
      "Get personalized spending analysis, savings tips, and trend predictions powered by AI.",
    color: "from-blue-500 to-cyan-400",
  },
  {
    icon: Bell,
    title: "Budget Alerts",
    description:
      "Real-time notifications when you approach or exceed budget limits. Stay on track effortlessly.",
    color: "from-red-500 to-rose-400",
  },
  {
    icon: Tag,
    title: "Auto-Categorize",
    description:
      "Machine learning classifies expenses into categories based on description and vendor patterns.",
    color: "from-pink-500 to-fuchsia-400",
  },
  {
    icon: TrendingDown,
    title: "Savings Goals",
    description:
      "Track progress toward financial goals. Discover spending patterns and cut waste automatically.",
    color: "from-teal-500 to-cyan-400",
  },
  {
    icon: Receipt,
    title: "Expense History",
    description:
      "Full searchable history with filters, tags, and sorting. Export to CSV anytime.",
    color: "from-orange-500 to-amber-400",
  },
];

export function Features() {
  return (
    <section id="features" className="relative py-24 sm:py-32">
      {/* Subtle background pattern */}
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center animate-fade-up">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            Features
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to master your finances
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            From receipt scanning to AI insights, ExpenseVision gives you
            complete visibility and control over your spending.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 animate-fade-up"
              style={{ animationDelay: `${200 + index * 100}ms` }}
            >
              {/* Icon */}
              <div
                className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${feature.color} shadow-lg transition-transform duration-300 group-hover:scale-110`}
              >
                <feature.icon className="h-6 w-6 text-white" />
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>

              {/* Hover glow */}
              <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                <div
                  className={`absolute -right-4 -bottom-4 h-32 w-32 rounded-full bg-gradient-to-br ${feature.color} opacity-15 blur-2xl`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
