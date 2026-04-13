import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to ExpenseVision to manage your expenses, budgets, and financial insights.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
