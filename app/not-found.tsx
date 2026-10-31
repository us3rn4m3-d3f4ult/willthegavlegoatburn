import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-[560px] flex-col items-start py-24">
      <p className="num text-[11px] font-semibold uppercase tracking-[0.16em] text-yes">404</p>
      <h1 className="mt-3 text-[24px] font-semibold tracking-[-0.02em]">
        This one never got built.
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        The page you asked for does not exist. The goat, however, is still standing — for now.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-9 items-center rounded-btn bg-fg px-4 text-[12.5px] font-semibold text-black transition-opacity hover:opacity-90"
      >
        Back to the market
      </Link>
    </div>
  );
}
