import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { StatsSection } from "@/components/landing/stats-section";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { AISection } from "@/components/landing/ai-section";
import { SecuritySection } from "@/components/landing/security-section";
import { Testimonials } from "@/components/landing/testimonials";
import { FAQ } from "@/components/landing/faq";
import { CTA } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://expensevision.tech";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "ExpenseVision",
  description:
    "Track expenses, scan receipts with AI, manage budgets, and get smart financial insights. The modern way to manage your money.",
  url: APP_URL,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "AI-powered receipt OCR",
    "Budget management with alerts",
    "CSV import from bank statements",
    "Spending insights and analytics",
    "Installable PWA with offline support",
  ],
  screenshot: `${APP_URL}/og_image.png`,
};

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />
      <main>
        <Hero />
        <StatsSection />
        <Features />
        <HowItWorks />
        <AISection />
        <SecuritySection />
        <Testimonials />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
