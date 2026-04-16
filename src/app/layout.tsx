import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { PWAProvider } from "@/components/pwa-provider";
import { getAppUrlObject } from "@/lib/app-url";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: getAppUrlObject(),
  title: {
    default: "ExpenseVision — AI-Powered Expense Tracking",
    template: "%s | ExpenseVision",
  },
  description:
    "Track expenses, scan receipts with AI, manage budgets, and get smart financial insights. The modern way to manage your money.",
  keywords: [
    "expense tracker",
    "budget manager",
    "receipt scanner",
    "AI finance",
    "personal finance",
    "money management",
  ],
  icons: {
    icon: [
      { url: "/minimal_optimized_for_favicon.png", type: "image/png" },
    ],
    apple: [
      { url: "/minimal_optimized_for_favicon.png", type: "image/png" },
    ],
  },
  openGraph: {
    title: "ExpenseVision — AI-Powered Expense Tracking",
    description:
      "Track expenses, scan receipts with AI, manage budgets, and get smart financial insights.",
    type: "website",
    siteName: "ExpenseVision",
    url: "/",
    images: [
      {
        url: "/og_image.png",
        width: 1200,
        height: 630,
        alt: "ExpenseVision — AI-Powered Expense Tracking",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ExpenseVision — AI-Powered Expense Tracking",
    description:
      "Track expenses, scan receipts with AI, manage budgets, and get smart financial insights.",
    images: [
      {
        url: "/og_image.png",
        width: 1200,
        height: 630,
        alt: "ExpenseVision — AI-Powered Expense Tracking",
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
  },
  formatDetection: {
    telephone: false,
    email: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`dark ${dmSans.variable} ${jetBrainsMono.variable} h-full antialiased overflow-x-hidden`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden">
        <ThemeProvider defaultTheme="dark">
          <PWAProvider>
            {children}
          </PWAProvider>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
