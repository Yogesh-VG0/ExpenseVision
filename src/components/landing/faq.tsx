"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    question: "Is ExpenseVision really free?",
    answer:
      "Yes! The core features — expense tracking, budget management, and analytics — are completely free. AI insights and receipt scanning use a generous free tier.",
  },
  {
    question: "How does receipt scanning work?",
    answer:
      "Take a photo of any receipt and our AI-powered OCR extracts the amount, vendor, date, and suggests a category. It works best with clearly printed receipts.",
  },
  {
    question: "Is my financial data secure?",
    answer:
      "Yes. All data is encrypted in transit via TLS and at rest on Supabase's managed Postgres. Row-Level Security policies ensure only you can access your own records.",
  },
  {
    question: "Can I export my data?",
    answer:
      "Yes, you can export all your expenses and budgets to CSV at any time. You fully own your data.",
  },
  {
    question: "What does the AI insights feature do?",
    answer:
      "Click 'Generate Insights' and our AI analyzes your spending to provide personalized tips — like spotting high-spending categories, flagging budget overruns, and suggesting ways to save.",
  },
  {
    question: "Can I try it without signing up?",
    answer:
      "Yes! Click 'Try Live Demo' to explore a fully interactive demo with realistic sample data. No account needed.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center animate-fade-up">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            FAQ
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Frequently asked questions
          </h2>
        </div>

        <div className="mt-12 space-y-3">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/20 animate-fade-up"
              style={{ animationDelay: `${200 + index * 80}ms` }}
            >
              <button
                onClick={() =>
                  setOpenIndex(openIndex === index ? null : index)
                }
                className="flex w-full items-center justify-between p-5 text-left transition-colors duration-200 hover:bg-muted/10"
              >
                <span className="font-medium">{faq.question}</span>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300",
                    openIndex === index && "rotate-180 text-primary"
                  )}
                />
              </button>
              <div
                className={cn(
                  "grid transition-all duration-300",
                  openIndex === index
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                )}
              >
                <div className="overflow-hidden">
                  <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
