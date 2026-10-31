import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How it works",
  description: "Outcome shares, the order book, and why we never hold your funds.",
  alternates: { canonical: "/how-it-works" },
};

const STEPS = [
  {
    n: "01",
    title: "Shares are claims, not bets against us",
    body: "1 USDC splits into 1 Yes + 1 No, and merges back at any time. There is no house on the other side. Every trade is with another user, or with someone who split a pair to market-make it.",
  },
  {
    n: "02",
    title: "The order book sets the price",
    body: "You post a bid or take an ask on Yes or No shares. The headline percentage is the midpoint between the best bid and best ask. The gap is the spread.",
  },
  {
    n: "03",
    title: "Anyone can earn the spread",
    body: "Split 1 USDC into a Yes + No pair and list both sides above 1.00 combined. If both fill, you keep the difference with no directional risk. That is the only market-making revenue here — we take nothing.",
  },
  {
    n: "04",
    title: "Resolution pays 1 or 0",
    body: "When the market resolves, a winning share redeems for exactly 1 USDC and a losing share for 0. Unsold pairs still merge back to 1 USDC.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-[74ch] py-14">
      <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-fg">How it works</h1>
      <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
        Four things to understand, and you understand the whole product.
      </p>

      <ol className="mt-10 divide-y divide-line border-t border-line">
        {STEPS.map((s) => (
          <li key={s.n} className="flex gap-7 py-8">
            <span className="num w-12 shrink-0 text-[30px] font-semibold leading-none tracking-[-0.03em] text-dim">
              {s.n}
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-fg">{s.title}</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="border-t border-line pt-8">
        <h2 className="text-[15px] font-semibold text-fg">What we do not do</h2>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          Every trader needs an account. Accounts are for the leaderboard and comments, not
          for money: deposits and orders live in the contract, tied to your wallet.
        </p>
        <ul className="mt-4 divide-y divide-line text-[13px] text-muted">
          <li className="py-2.5 first:pt-0">
            We do not hold your USDC, and there is no account balance to withdraw from.
          </li>
          <li className="py-2.5">We do not charge a fee, take a cut, or subsidise liquidity.</li>
          <li className="py-2.5 last:pb-0">
            We cannot freeze, reverse or recover a transaction.
          </li>
        </ul>
      </section>

      <p className="mt-10 border-t border-line pt-6 text-[13px] text-muted">
        Read the{" "}
        <Link href="/#resolves" className="text-fg">
          resolution rules
        </Link>{" "}
        and the{" "}
        <Link href="/risk" className="text-fg">
          risk disclosure
        </Link>
        .
      </p>
    </div>
  );
}
