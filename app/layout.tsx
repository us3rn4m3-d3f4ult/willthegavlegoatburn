import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://willthegavlegoatburn.com"),
  title: {
    default: "Will the Gävle goat burn in 2026?",
    template: "%s · willthegavlegoatburn",
  },
  description:
    "A non-custodial prediction market on whether the Gävle goat survives 2026. Trade Yes or No in USDC on Base.",
  applicationName: "willthegavlegoatburn",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "willthegavlegoatburn",
    title: "Will the Gävle goat burn in 2026?",
    description:
      "Trade Yes or No on the Gävle goat. Non-custodial, settled in USDC on Base.",
    url: "https://willthegavlegoatburn.com",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-btn focus:bg-yes focus:px-3 focus:py-2 focus:text-black"
        >
          Skip to content
        </a>
        <Header />
        <main id="main" className="mx-auto max-w-[1120px] px-6">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
