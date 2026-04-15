"use client";

import { useEffect, useRef, useState } from "react";
import { Receipt, PieChart, Brain, Shield } from "lucide-react";

const features = [
  {
    icon: Receipt,
    label: "Smart Expense Tracking",
    description: "Log expenses instantly with categories, notes, and receipt attachments",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    icon: PieChart,
    label: "Budget Management",
    description: "Set monthly budgets per category and track progress in real time",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    icon: Brain,
    label: "AI-Powered Insights",
    description: "Get smart spending analysis and actionable saving suggestions",
    color: "text-accent",
    bgColor: "bg-accent/10",
  },
  {
    icon: Shield,
    label: "Secure by Design",
    description: "Row-level security on every table — your data stays yours",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
];

function FeatureHighlight({
  feature,
  index,
}: {
  feature: (typeof features)[number];
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`group relative flex flex-col items-center gap-3 rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm transition-all duration-500 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 ${inView ? "animate-fade-up" : "opacity-0"}`}
      style={{ animationDelay: `${200 + index * 150}ms` }}
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-lg ${feature.bgColor} transition-transform duration-300 group-hover:scale-110`}
      >
        <feature.icon className={`h-6 w-6 ${feature.color}`} />
      </div>
      <div className="text-center">
        <p className="text-base font-semibold sm:text-lg">
          {feature.label}
        </p>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          {feature.description}
        </p>
      </div>
    </div>
  );
}

export function StatsSection() {
  return (
    <section className="relative -mt-10 pt-0 pb-16 sm:-mt-14 sm:pb-20">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background via-primary/[0.03] to-transparent" />

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {features.map((feature, index) => (
            <FeatureHighlight key={feature.label} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
