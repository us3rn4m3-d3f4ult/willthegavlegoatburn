/**
 * Single source of truth for anything a crawler reads.
 * Keep titles under ~60 chars and descriptions under ~155 so Google doesn't
 * rewrite them in the SERP.
 */

export const SITE = {
  url: "https://willthegavlegoatburn.com",
  name: "willthegavlegoatburn",
  title: "Will the Gävle goat burn in 2026?",
  shortTitle: "willthegavlegoatburn",
  description:
    "The Gävle goat has burned 30+ times since 1966. Trade Yes or No on 2026 in USDC on Base — non-custodial, no fees, no house.",
  locale: "en_GB",
  themeColor: "#000000",
} as const;

export type FaqItem = { q: string; a: string };

export const FAQ: FaqItem[] = [
  {
    q: "Will the Gävle goat burn in 2026?",
    a: "Nobody knows — that is the point. This market aggregates what traders are willing to pay for Yes and No shares. It is not a forecast and it is not a prediction from the operators.",
  },
  {
    q: "When does the 2026 Gävle goat go up?",
    a: "The goat is traditionally erected on the first day of Advent, which falls on 29 November 2026, at Slottstorget in Gävle, Sweden.",
  },
  {
    q: "What counts as the goat burning?",
    a: "Only fire that forces the structure to be dismantled or rebuilt before its scheduled removal. Damage by a car (2021) or a storm (2025) does not count. The full rules and source list are published before trading opens.",
  },
  {
    q: "Is this custodial? Does it hold my funds?",
    a: "No. Your USDC sits in a smart contract on Base and only your wallet can move it. There is no account balance to withdraw from and no operator key that can touch your position.",
  },
  {
    q: "What fees are there?",
    a: "No protocol fee, no rake, no cut of any payout. You pay only the network fee for your own transactions on Base, directly to the blockchain.",
  },
];

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE.url}/#website`,
    url: SITE.url,
    name: SITE.name,
    description: SITE.description,
    inLanguage: "en",
    publisher: { "@id": `${SITE.url}/#org` },
  };
}

export function orgJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE.url}/#org`,
    name: SITE.name,
    url: SITE.url,
    email: "contact@willthegavlegoatburn.com",
    description:
      "Unofficial, non-custodial prediction market on whether the Gävle goat burns. Not affiliated with Gävle kommun.",
  };
}

export function faqJsonLd(items: FaqItem[] = FAQ) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a },
    })),
  };
}

export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.name,
      item: `${SITE.url}${t.path}`,
    })),
  };
}

export function articleJsonLd(opts: {
  headline: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.headline,
    description: opts.description,
    mainEntityOfPage: `${SITE.url}${opts.path}`,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified,
    author: { "@id": `${SITE.url}/#org` },
    publisher: { "@id": `${SITE.url}/#org` },
  };
}
