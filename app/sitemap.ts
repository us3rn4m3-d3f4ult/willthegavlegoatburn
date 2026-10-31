import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

const ROUTES: { path: string; priority: number; freq: "daily" | "weekly" | "monthly" | "yearly" }[] = [
  { path: "/", priority: 1.0, freq: "daily" },
  { path: "/goat-history", priority: 0.9, freq: "monthly" },
  { path: "/how-it-works", priority: 0.7, freq: "monthly" },
  { path: "/activity", priority: 0.6, freq: "daily" },
  { path: "/privacy", priority: 0.2, freq: "yearly" },
  { path: "/terms", priority: 0.2, freq: "yearly" },
  { path: "/risk", priority: 0.2, freq: "yearly" },
  { path: "/cookies", priority: 0.1, freq: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ROUTES.map((r) => ({
    url: `${SITE.url}${r.path}`,
    lastModified: now,
    changeFrequency: r.freq,
    priority: r.priority,
  }));
}
