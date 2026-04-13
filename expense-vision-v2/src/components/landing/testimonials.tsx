"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const techStack = [
  {
    name: "Next.js 16",
    description: "App Router, server components, Turbopack for blazing-fast builds",
    color: "from-neutral-500 to-neutral-700",
    textColor: "text-foreground",
  },
  {
    name: "Supabase",
    description: "Auth, PostgreSQL database, storage, and row-level security policies",
    color: "from-green-500 to-emerald-600",
    textColor: "text-green-500",
  },
  {
    name: "TypeScript",
    description: "End-to-end type safety with Zod validation at every boundary",
    color: "from-blue-500 to-blue-700",
    textColor: "text-blue-500",
  },
  {
    name: "Tailwind CSS v4",
    description: "Utility-first styling with a complete dark/light design token system",
    color: "from-cyan-400 to-blue-500",
    textColor: "text-cyan-500",
  },
];

function TechCard({
  tech,
  index,
}: {
  tech: (typeof techStack)[number];
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
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "group relative flex flex-col rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm transition-all duration-500 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1",
        inView ? "animate-fade-up" : "opacity-0"
      )}
      style={{ animationDelay: `${200 + index * 150}ms` }}
    >
      {/* Gradient badge */}
      <div
        className={`mb-4 inline-flex w-fit rounded-full bg-gradient-to-r ${tech.color} px-3 py-1 text-xs font-bold text-white shadow-lg`}
      >
        {tech.name}
      </div>

      {/* Description */}
      <p className="text-sm leading-relaxed text-muted-foreground">
        {tech.description}
      </p>

      {/* Hover glow */}
      <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-500 group-hover:opacity-100">
        <div className="absolute -right-4 -bottom-4 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
      </div>
    </div>
  );
}

export function Testimonials() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-accent/5 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center animate-fade-up">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">
            Tech Stack
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Built with modern, production-grade tools
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Every layer — from the database to the UI — is designed for
            performance, security, and developer experience.
          </p>
        </div>

        {/* Grid */}
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {techStack.map((tech, index) => (
            <TechCard key={tech.name} tech={tech} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
