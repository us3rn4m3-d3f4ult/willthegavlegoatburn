import type { Metadata } from "next";
import { AbstractAvatar } from "@/components/AbstractAvatar";
import { MARKET } from "@/lib/market";
import { fmtUsd } from "@/lib/format";
import Link from "next/link";

export const metadata: Metadata = { title: "Account" };

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-line bg-surface">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-[13px] font-semibold tracking-tight text-fg">{title}</h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-[860px] py-10">
      {/* ── identity ─────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <AbstractAvatar seed="guest" size={64} />
        <div className="min-w-0">
          <h1 className="truncate text-[20px] font-semibold tracking-[-0.01em]">Not signed in</h1>
          <p className="mt-0.5 text-[12.5px] text-muted">
            Sign in with email, or just connect a wallet — trading never requires an account.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/login"
          className="inline-flex h-9 items-center rounded-btn bg-fg px-4 text-[12.5px] font-semibold text-black transition-opacity hover:opacity-90"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="inline-flex h-9 items-center rounded-btn border border-line bg-surface px-4 text-[12.5px] font-medium text-fg transition-colors hover:border-line2"
        >
          Create account
        </Link>
      </div>

      <div className="mt-8 space-y-4">
        <Panel title="Positions" action={<span className="text-[11px] text-dim">Yes · {MARKET.slug}</span>}>
          <p className="text-[12.5px] text-muted">
            No positions. Connect a wallet to see outcome shares held by that address — positions
            live on-chain, not in this account.
          </p>
        </Panel>

        <Panel title="Open orders">
          <p className="text-[12.5px] text-muted">
            No resting bids or asks. Open orders are visible publicly; cancel any of them at any time
            from the wallet that placed them.
          </p>
        </Panel>

        <Panel title="Balance">
          <dl className="grid gap-4 sm:grid-cols-3">
            {[
              ["USDC in wallet", fmtUsd(0, 2)],
              ["In open orders", fmtUsd(0, 2)],
              ["Position value", fmtUsd(0, 2)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-dim">{k}</dt>
                <dd className="num mt-1 text-[15px] font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[11.5px] leading-relaxed text-dim">
            These numbers are read from the blockchain. They are not stored by us, and they do not
            depend on this account existing.
          </p>
        </Panel>

        <Panel title="Security">
          <ul className="space-y-2 text-[12.5px] text-muted">
            <li>Email — not set</li>
            <li>Password — not set</li>
            <li>Sessions — 0 active</li>
          </ul>
          <p className="mt-3 text-[11.5px] leading-relaxed text-dim">
            An account session can never move funds: every transaction needs a signature from your
            own wallet.
          </p>
        </Panel>
      </div>
    </div>
  );
}
