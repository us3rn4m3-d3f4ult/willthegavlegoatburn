import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

/**
 * Add-to-home-screen metadata. Icons come from `app/icon.svg`; iOS ignores SVG
 * icons and falls back to a screenshot, which is why this stays minimal until
 * there is a PNG to point at.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.title,
    short_name: "gavle goat",
    description: SITE.description,
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
