import Link from "next/link";

export function LegalShell({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-[70ch] py-12">
      <Link
        href="/"
        className="text-[12px] text-dim transition-colors hover:text-muted"
      >
        ← Back to the market
      </Link>

      <h1 className="mt-4 text-[24px] font-semibold tracking-[-0.02em] text-fg">{title}</h1>
      <p className="mt-2 text-[12px] text-dim">Last updated {updated}</p>

      {intro ? (
        <p className="mt-5 rounded-card border border-line bg-surface p-4 text-[12.5px] leading-relaxed text-muted">
          {intro}
        </p>
      ) : null}

      <div className="legal mt-8">{children}</div>
    </article>
  );
}
