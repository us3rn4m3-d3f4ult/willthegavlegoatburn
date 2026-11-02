/**
 * GIPHY search for comment GIFs.
 *
 * Two constraints shape this file:
 *
 *  - GIPHY requires the *search* call to be made from the client, so the key is
 *    a public client key (`NEXT_PUBLIC_GIPHY_API_KEY`), the same kind their web
 *    SDK ships. It is not a server secret and is not proxied by us.
 *  - Nothing from that response is trusted when the comment is submitted: the
 *    server re-validates the URL and the dimensions (`gifProblem`) before it is
 *    stored, so a crafted request cannot point a comment at an arbitrary image.
 *
 * Sizing: everything uses the `fixed_width` rendition — 200 px wide, height by
 * aspect ratio. `original` is routinely 480 px+ and several MB, which is what
 * makes a GIF picker feel broken; `fixed_width_small` (100 px) is too small to
 * read at the size a comment renders.
 *
 * The free beta key is rate limited (about 42 requests/hour), so searches are
 * debounced in the picker and cached here for five minutes.
 */

export type Gif = {
  /** media.giphy.com URL of the 200 px-wide rendition. Canonical, no query. */
  url: string;
  /** Natural size of that rendition, used for width/height attributes. */
  width: number;
  height: number;
  /** GIPHY's own title, for alt text. */
  alt: string;
};

const SEARCH_URL = "https://api.giphy.com/v1/gifs/search";
const RENDITION = "fixed_width";
const LIMIT = 24;
const CACHE_MS = 5 * 60_000;

/** Ceilings for a stored GIF. `fixed_width` is 200 px; tall ones reach ~500. */
const MAX_WIDTH = 400;
const MAX_HEIGHT = 600;
const MIN_SIDE = 16;

const API_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY ?? "";

/** False when no key is configured — the composer hides the GIF button. */
export const GIFS_CONFIGURED = API_KEY.length > 0;

/** GIPHY ids are short alphanumerics (older ones contain `-` or `_`). */
const GIF_ID = "[A-Za-z0-9_-]{5,40}";
/** media.giphy.com, media0-5.giphy.com and i.giphy.com serve the renditions. */
const GIF_HOST = /^(media\d?|i)\.giphy\.com$/;
/**
 * GIPHY serves renditions from two path shapes:
 *
 *   /media/<id>/200w.gif                 older
 *   /media/v1.<token>/<id>/200w.gif      current — the token is a per-request
 *                                        tracking blob, not a secret
 *
 * Both are accepted; anything else is not storable.
 */
const GIF_PATH = new RegExp(
  `^/media/(?:v1\\.[A-Za-z0-9_=-]+/)?${GIF_ID}/[A-Za-z0-9_.-]+\\.(gif|webp)$`,
);

type GiphyImage = { url?: string; width?: string; height?: string };
type GiphyItem = { id?: string; title?: string; images?: Record<string, GiphyImage> };

/** Strips a GIPHY media URL down to origin + path, so the stored form is exact. */
function canonical(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    if (!GIF_HOST.test(parsed.hostname) || !GIF_PATH.test(parsed.pathname)) return null;
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return null;
  }
}

/** Maps one GIPHY item to the rendition we render, or null if it has none. */
export function fromGiphy(item: GiphyItem): Gif | null {
  const images = item.images ?? {};
  const image = images[RENDITION] ?? images.downsized ?? images.original;
  if (!image?.url) return null;

  const url = canonical(image.url);
  if (!url) return null;

  const width = Number.parseInt(image.width ?? "", 10);
  const height = Number.parseInt(image.height ?? "", 10);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;

  const gif: Gif = {
    url,
    width,
    height,
    alt: String(item.title ?? "").trim().slice(0, 120) || "GIF",
  };
  return gifProblem(gif) === null ? gif : null;
}

/**
 * The gate for anything the client claims is a GIF. Returns a reason string, or
 * null when it is storable. The URL must be a GIPHY CDN rendition and nothing
 * else — that is what stops a comment pointing at an arbitrary image host.
 */
export function gifProblem(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return "bad_gif";
  const gif = value as Partial<Gif>;

  if (typeof gif.url !== "string" || canonical(gif.url) !== gif.url) return "bad_gif";

  const width = Number(gif.width);
  const height = Number(gif.height);
  if (!Number.isInteger(width) || !Number.isInteger(height)) return "bad_gif";
  if (width < MIN_SIDE || width > MAX_WIDTH) return "bad_gif";
  if (height < MIN_SIDE || height > MAX_HEIGHT) return "bad_gif";

  return null;
}

/** Validated, trimmed copy of whatever was submitted. Null when not storable. */
export function normalizeGif(value: unknown): Gif | null {
  if (gifProblem(value) !== null) return null;
  const gif = value as Gif;
  return {
    url: gif.url,
    width: Math.round(gif.width),
    height: Math.round(gif.height),
    alt: String(gif.alt ?? "").trim().slice(0, 120) || "GIF",
  };
}

const cache = new Map<string, { at: number; gifs: Gif[] }>();

/** Search GIPHY from the browser. Throws on a network or API error. */
export async function searchGifs(query: string, signal?: AbortSignal): Promise<Gif[]> {
  if (!GIFS_CONFIGURED) throw new Error("GIFs are not configured.");

  const term = query.trim().slice(0, 50).toLowerCase();
  if (term.length < 2) return [];

  const hit = cache.get(term);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.gifs;

  const params = new URLSearchParams({
    api_key: API_KEY,
    q: term,
    limit: String(LIMIT),
    // Anyone can read a comment: keep it PG-13 and drop the low-contrast noise
    // GIPHY would otherwise pad the grid with.
    rating: "pg-13",
    lang: "en",
    remove_low_contrast: "true",
  });

  const res = await fetch(`${SEARCH_URL}?${params.toString()}`, { signal, cache: "no-store" });
  if (!res.ok) throw new Error(`giphy ${res.status}`);

  const data = (await res.json()) as { data?: GiphyItem[] };
  const gifs = (data.data ?? []).map(fromGiphy).filter((gif): gif is Gif => gif !== null);

  if (cache.size > 40) cache.clear();
  cache.set(term, { at: Date.now(), gifs });
  return gifs;
}
