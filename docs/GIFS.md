# GIFs in comments

Comments can carry one GIPHY GIF, picked from a search inside the composer.

## Provider

**GIPHY** — Tenor stopped accepting new API clients in January 2026, so it is no
longer an option for a new integration.

- Key: `NEXT_PUBLIC_GIPHY_API_KEY`, free from developers.giphy.com.
- It is a **public** key on purpose. GIPHY's API terms require the search call to
  be made from the client, so there is no server proxy and no server secret. It is
  the same kind of key their own web SDK ships in the bundle.
- A blank key sets `GIFS_CONFIGURED = false` and the GIF button does not render.
- The free key is rate limited (roughly 42 requests/hour), so searches are
  debounced 350 ms, need at least two characters, and are cached for five minutes
  per term in `lib/gifs.ts`. "Powered by GIPHY" attribution sits in the picker,
  as their terms require.

## What is stored

`comments.gif_url`, `gif_width`, `gif_height`, `gif_alt` — nullable, added with
`alter table ... add column if not exists` in `lib/db.ts` so existing rows survive.

The client submits `{ url, width, height, alt }` straight from the GIPHY response;
the server re-validates it (`lib/gifs.ts` → `gifProblem`) and nothing else is kept:

- `https://` only; host must be `media.giphy.com`, `media0-5.giphy.com` or
  `i.giphy.com`;
- path must be `/media/<id>/<variant>.gif|.webp`, or the current
  `/media/v1.<token>/<id>/<variant>.gif|.webp` (the token is GIPHY's per-request
  tracking blob, not a secret);
- no query string or fragment — the stored URL is canonical;
- integer dimensions, 16–400 wide and 16–600 tall.

A comment may be a GIF on its own. Moderation still runs on any text that is
present (links, slurs, shouting); `too_short` is the only rule a GIF-only comment
may skip, in `app/api/comments/route.ts`.

## Size

Posts use GIPHY's `fixed_width` rendition: 200 px wide, height by aspect ratio.
It renders at its natural width with `max-height: 240px`, so a tall GIF shrinks
instead of taking over the thread, and `original` (480 px+, often several MB) is
never loaded. Intrinsic `width`/`height` attributes reserve the box before the
bytes land, so the thread does not jump. Picker previews are the same rendition,
square-cropped in a three-column grid.

## CSP

`middleware.ts` allows `https://api.giphy.com` in `connect-src` for the search.
The images themselves are already covered by `img-src ... https:`.
