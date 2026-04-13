import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://expensevision.tech";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/demo", "/demo/expenses", "/demo/budgets", "/demo/insights", "/demo/receipts", "/login", "/signup"],
        disallow: ["/api/", "/dashboard", "/expenses", "/budgets", "/receipts", "/insights", "/settings", "/auth/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
