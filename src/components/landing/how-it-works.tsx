import { Camera, Cpu, PieChart, Lightbulb } from "lucide-react";

const steps = [
  {
    step: "01",
    icon: Camera,
    title: "Snap or Add",
    description:
      "Take a photo of your receipt or manually add an expense in seconds.",
    color: "from-primary to-amber-400",
  },
  {
    step: "02",
    icon: Cpu,
    title: "AI Extracts",
    description:
      "Our AI reads the receipt, extracts the amount, vendor, date, and suggests a category for review.",
    color: "from-accent to-violet-400",
  },
  {
    step: "03",
    icon: PieChart,
    title: "Track & Budget",
    description:
      "See dashboards, budget progress, and spending patterns at a glance.",
    color: "from-green-500 to-emerald-400",
  },
  {
    step: "04",
    icon: Lightbulb,
    title: "Get Insights",
    description:
      "Generate AI-powered tips on demand to reduce spending and optimize your budgets.",
    color: "from-blue-500 to-cyan-400",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24 sm:py-32">
      {/* Background Accent */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center animate-fade-up">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            How It Works
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            From receipt to insight in seconds
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Four simple steps to financial clarity. No learning curve.
          </p>
        </div>

        {/* Steps */}
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((item, index) => (
            <div key={item.step} className="group relative text-center animate-fade-up" style={{ animationDelay: `${300 + index * 150}ms` }}>
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="absolute top-12 left-1/2 hidden h-px w-full bg-gradient-to-r from-primary/30 via-border to-transparent lg:block" />
              )}

              {/* Icon Circle */}
              <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
                <div
                  className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${item.color} opacity-20 blur-xl transition-opacity duration-500 group-hover:opacity-40`}
                />
                <div
                  className={`relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${item.color} shadow-xl transition-transform duration-300 group-hover:scale-110`}
                >
                  <item.icon className="h-7 w-7 text-white" />
                </div>
                {/* Step Number */}
                <span className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-background text-xs font-bold text-primary shadow ring-2 ring-primary/30">
                  {item.step}
                </span>
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
