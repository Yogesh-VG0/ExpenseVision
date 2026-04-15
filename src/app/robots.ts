import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/app-url";

const BASE_URL = getAppUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/demo", "/demo/expenses", "/demo/budgets", "/demo/insights", "/demo/receipts", "/login", "/signup"],
        disallow: ["/api/", "/dashboard", "/expenses", "/budgets", "/receipts", "/insights", "/settings", "/imports", "/notifications", "/auth/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
