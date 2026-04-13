import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create a free ExpenseVision account to start tracking expenses and managing budgets with AI.",
};

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
