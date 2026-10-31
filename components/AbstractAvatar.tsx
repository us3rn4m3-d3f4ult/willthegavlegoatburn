/**
 * Deterministic abstract avatar — no network request, no dependency, no PII.
 * The same seed always renders the same image, so a user's avatar is stable
 * across devices and sessions.
 */

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Returns a float in [0,1) for a given channel of a seed. */
function unit(seed: number, channel: number): number {
  const x = Math.imul(seed ^ (channel * 0x9e3779b1), 0x85ebca6b) >>> 0;
  return ((x ^ (x >>> 13)) >>> 0) / 4294967296;
}

export function AbstractAvatar({
  seed,
  size = 32,
  className = "",
}: {
  seed: string;
  size?: number;
  className?: string;
}) {
  const h = fnv1a(seed || "anon");
  const id = h.toString(36);
  const baseHue = Math.floor(unit(h, 1) * 360);
  const hues = [
    baseHue,
    (baseHue + 40 + Math.floor(unit(h, 2) * 120)) % 360,
    (baseHue + 180 + Math.floor(unit(h, 3) * 90)) % 360,
  ];

  const blobs = [0, 1, 2].map((i) => ({
    cx: 8 + unit(h, 10 + i) * 48,
    cy: 8 + unit(h, 20 + i) * 48,
    r: 14 + unit(h, 30 + i) * 20,
    fill: `hsl(${hues[i]} 88% ${52 + unit(h, 40 + i) * 12}%)`,
    op: 0.55 + unit(h, 50 + i) * 0.45,
  }));

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Account avatar"
      className={className}
    >
      <defs>
        <filter id={`b-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <clipPath id={`c-${id}`}>
          <rect width="64" height="64" rx="18" />
        </clipPath>
      </defs>
      <g clipPath={`url(#c-${id})`}>
        <rect width="64" height="64" fill="#0b0b0d" />
        <g filter={`url(#b-${id})`}>
          {blobs.map((b, i) => (
            <circle
              key={i}
              cx={b.cx}
              cy={b.cy}
              r={b.r}
              fill={b.fill}
              opacity={b.op}
            />
          ))}
        </g>
        <rect
          width="64"
          height="64"
          rx="18"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />
      </g>
    </svg>
  );
}
