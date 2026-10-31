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
    <article className="mx-auto max-w-[68ch] py-14">
      <Link href="/" className="text-[12px] text-dim transition-colors hover:text-fg">
        ← Back to the market
      </Link>

      <h1 className="mt-5 text-[26px] font-semibold tracking-[-0.02em] text-fg">{title}</h1>
      <p className="mt-2 text-[11.5px] text-dim">Last updated {updated}</p>

      {intro ? (
        <p className="mt-6 border-l border-line2 pl-4 text-[13px] leading-relaxed text-muted">
          {intro}
        </p>
      ) : null}

      <div className="legal mt-10">{children}</div>
    </article>
  );
}
