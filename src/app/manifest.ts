import type { MetadataRoute } from "next";
import { RECEIPT_SHARE_FORM_FIELD_NAME } from "@/lib/receipt-share";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ExpenseVision — AI-Powered Expense Tracking",
    short_name: "ExpenseVision",
    description:
      "Track expenses, scan receipts with AI, manage budgets, and get smart financial insights.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    orientation: "portrait-primary",
    categories: ["finance", "productivity"],
    share_target: {
      action: "/receipts/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        files: {
          name: RECEIPT_SHARE_FORM_FIELD_NAME,
          accept: ["image/*", "application/pdf"],
        },
      },
    },
    file_handlers: [
      {
        action: "/receipts/capture",
        accept: {
          "image/*": [".jpg", ".jpeg", ".png", ".webp", ".gif"],
          "application/pdf": [".pdf"],
        },
      },
    ],
    handle_links: "preferred",
    icons: [
      {
        src: "/minimal_optimized_for_favicon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/minimal_optimized_for_favicon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Scan Receipt",
        short_name: "Scan",
        url: "/receipts/capture",
        description: "Open the mobile-first receipt capture flow",
      },
      {
        name: "Add Expense",
        short_name: "Add",
        url: "/expenses",
        description: "Manually add a new expense",
      },
      {
        name: "Import Expenses",
        short_name: "Import",
        url: "/imports",
        description: "Import expenses from a CSV file",
      },
      {
        name: "AI Insights",
        short_name: "Insights",
        url: "/insights",
        description: "View AI-powered spending insights",
      },
      {
        name: "Budgets",
        short_name: "Budgets",
        url: "/budgets",
        description: "Check your budget progress",
      },
    ],
  } as ReturnType<typeof manifest>;
}
