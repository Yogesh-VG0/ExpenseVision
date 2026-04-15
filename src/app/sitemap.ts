import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/app-url";

const BASE_URL = getAppUrl();

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  // Public / indexable pages
  const publicRoutes = [
    { path: "/", priority: 1.0, changeFrequency: "weekly" as const },
    { path: "/login", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/signup", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/forgot-password", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/demo", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/demo/expenses", priority: 0.6, changeFrequency: "weekly" as const },
    { path: "/demo/budgets", priority: 0.6, changeFrequency: "weekly" as const },
    { path: "/demo/insights", priority: 0.6, changeFrequency: "weekly" as const },
    { path: "/demo/receipts", priority: 0.6, changeFrequency: "weekly" as const },
  ];

  return publicRoutes.map((route) => ({
    url: `${BASE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
