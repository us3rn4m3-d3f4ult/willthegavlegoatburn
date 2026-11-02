import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ChunkGuard } from "@/components/ChunkGuard";
import { ClientErrorReporter } from "@/components/ClientErrorReporter";
import { PageViews } from "@/components/PageViews";
import { WalletProvider } from "@/components/WalletProvider";
import { SITE, orgJsonLd, websiteJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: SITE.title,
    template: "%s · willthegavlegoatburn",
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [
    "gävle goat",
    "gavle goat",
    "gävlebocken",
    "will the gavle goat burn",
    "gavle goat 2026",
    "prediction market",
    "gavlebocken brinner",
  ],
  authors: [{ name: SITE.name, url: SITE.url }],
  creator: SITE.name,
  publisher: SITE.name,
  category: "finance",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: SITE.locale,
  },
  twitter: {
    card: "summary_large_image",
  },
  // Paste the token from Google Search Console → Settings → Ownership verification
  // → HTML tag here, then deploy. Without it you cannot submit the sitemap.
  // verification: { google: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" },
};

export const viewport: Viewport = {
  themeColor: SITE.themeColor,
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd()) }}
        />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-btn focus:bg-yes focus:px-3 focus:py-2 focus:text-black"
        >
          Skip to content
        </a>
        <ChunkGuard />
        <ClientErrorReporter />
        <PageViews />
        <WalletProvider>
          <Header />
          <main id="main" className="mx-auto max-w-[1200px] px-4 sm:px-8">
            {children}
          </main>
          <Footer />
        </WalletProvider>
      </body>
    </html>
  );
}
