# SEO — what's done, what you must do, what nobody can promise

**Nothing can guarantee the #1 result.** Google ranks on relevance, authority, freshness and user
behaviour. What you *can* do is make the site trivially easy to rank: technically flawless, faster
than competitors, and containing information nobody else has. That's what's built below.

---

## 1. Already shipped (technical, done)

| Item | Where |
|---|---|
| Server-rendered HTML for every page (no JS needed to read it) | Next.js static prerender |
| Unique `<title>` + `<meta description>` per page | each `page.tsx` |
| Self-referencing `<link rel="canonical">` on every page | each `page.tsx` |
| `sitemap.xml` with priorities | `app/sitemap.ts` → `/sitemap.xml` |
| `robots.txt` that blocks `/account`, `/login`, `/register` | `app/robots.ts` → `/robots.txt` |
| JSON-LD: `WebSite`, `Organization` (site-wide) | `app/layout.tsx` |
| JSON-LD: `FAQPage` + a real, visible FAQ section | `app/page.tsx`, `lib/seo.ts` |
| 1200×630 Open Graph image, generated at build time | `app/opengraph-image.tsx` |
| Semantic headings (`h1` → `h2`), internal links, descriptive anchors | all pages |
| HSTS, HTTPS, 103 kB JS, no blocking third-party scripts | verified live |
| Exact-match domain for the query people actually type | `willthegavlegoatburn.com` |

Check live: `https://willthegavlegoatburn.com/robots.txt` and `/sitemap.xml`.

> Note: Google restricted **FAQ rich snippets** to government and health sites in 2023. The
> `FAQPage` markup won't produce a dropdown in the SERP — it still helps Google understand the page,
> and the visible FAQ section is genuinely useful. Don't expect the snippet.

---

## 2. You must do this — 20 minutes, free, and it is not optional

1. **Google Search Console** → <https://search.google.com/search-console>
   - Add property → **Domain** → `willthegavlegoatburn.com`
   - Verify by DNS TXT record (Cloudflare → DNS → add the TXT record it gives you, 1 minute)
   - **Sitemaps → submit** `sitemap.xml`
   - **URL Inspection** → paste the homepage → **Request indexing**
2. **Bing Webmaster Tools** → <https://www.bing.com/webmasters> — import from Search Console in
   one click. Bing also feeds DuckDuckGo.
3. Come back in 48 hours and check **Indexing → Pages**. If the homepage isn't indexed, that's the
   only thing worth fixing.

Until you do this, the site is invisible to Google no matter how good the markup is.

---

## 3. The content that will actually rank

Brand queries ("willthegavlegoatburn") rank automatically. The traffic is in these:

| Query | Page | Why it can win |
|---|---|---|
| `will the gävle goat burn` | `/` | Exact match to the domain + the question, low competition |
| `gävle goat 2026` | `/` + a dated 2026 page | News-driven; nobody owns it yet in October |
| `gävle goat history` / `how many times has the gävle goat burned` | `/goat-history` | **The highest-value page.** Expand it to a full year-by-year table with the cause of destruction. Wikipedia has prose; a scannable table is what people want and what gets linked |
| `gävlebocken brinner` (Swedish) | a `/sv` page | Swedish search volume is small but converts hard, and there is almost no competition |
| `gavle goat webcam` | `/` with a link to Visit Gävle's feed | High volume, no cost — **link out, don't embed** |

**Timing beats effort.** Publish/refresh 10–14 days before Advent (29 Nov). The goat is a
once-a-year news event: a Reddit post in r/sweden on the day it goes up is worth more than six
months of optimisation.

---

## 4. Backlinks — the part that actually moves rankings

Free, legitimate, in rough order of value:

1. A real post in **r/sweden** and **r/gavle** when the goat goes up — not a spam drop, an actual
   "I built a market on this, here's how it resolves" post.
2. **Hacker News** ("Show HN") and **Product Hunt** — works best with a technical angle: "on-chain
   order book, no fees, no custody".
3. **X/Twitter thread** with the odds chart screenshot, tagging accounts that cover the goat each year.
4. Local press: **Arbetarbladet**, **Gefle Dagblad**, **SVT Gävleborg**. A "the internet is betting
   on the goat" story writes itself. Email `contact@` with the angle.
5. A link from any prediction-market directory or newsletter that accepts submissions.

**Do not** buy links, use link farms, cloak, or spin up doorway pages. For a gambling-adjacent site
that is the fastest route to a manual action.

---

## 5. What will hold you back (be realistic)

- **New domain, no history.** Expect 4–12 weeks before non-brand impressions appear at all.
- **YMYL.** Money-adjacent content is held to a higher standard (E-E-A-T). Having a real operator
  identity, a contact address and a published methodology on `/rules` helps — keep them accurate.
- **Gambling classification.** Google may apply restricted handling to betting content in some
  regions and will not show it to users under 18 signals. Not fixable; work around it.
- **Your competitors are Wikipedia and news sites** for the head term `gävle goat`. You will not
  outrank Wikipedia. You can own the *question* and the *long tail*, which is where the traffic is.

---

## 6. Weekly checklist

- [ ] Search Console → any coverage errors?
- [ ] `/goat-history` refreshed with the prior year's outcome
- [ ] One new backlink attempt
- [ ] `curl -s https://willthegavlegoatburn.com/sitemap.xml` still says 200
