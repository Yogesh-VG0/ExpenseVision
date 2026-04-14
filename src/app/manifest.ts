import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ExpenseVision — AI-Powered Expense Tracking",
    short_name: "ExpenseVision",
    description:
      "Track expenses, scan receipts with AI, manage budgets, and get smart financial insights.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    icons: [
      {
        src: "/minimal_optimized_for_favicon.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/minimal_optimized_for_favicon.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
  };
}
