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
  /** Public source. The open-source claim is only checkable if this is linked. */
  repo: "https://github.com/us3rn4m3-d3f4ult/willthegavlegoatburn",
  repoLabel: "github.com/us3rn4m3-d3f4ult/willthegavlegoatburn",
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
    a: "Any fire at all. A scorched leg is enough — the goat does not have to be dismantled, destroyed or rebuilt, and the fire does not have to win. Damage without fire, such as the 2021 car or the 2025 storm, does not count. If no goat is erected at all, nothing burned, so it settles No.",
  },
  {
    q: "Who is behind this?",
    a: "An open-source community project, not a company. The market is a smart contract on Base and the whole thing is public at github.com/us3rn4m3-d3f4ult/willthegavlegoatburn, so anyone can read the rules and check that the contract does what this page says. It is not affiliated with Polymarket or any exchange — Polymarket does not currently list a Gävle goat market, which is why a group of people who follow the goat built one themselves.",
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
    sameAs: [SITE.repo],
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
