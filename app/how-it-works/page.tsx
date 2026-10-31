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
    <div className="mx-auto max-w-[70ch] py-12">
      <h1 className="text-[24px] font-semibold tracking-[-0.02em]">How it works</h1>
      <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
        Four things to understand, and then you understand the whole product.
      </p>

      <ol className="mt-8 space-y-3">
        {STEPS.map((s) => (
          <li key={s.n} className="panel p-5">
            <div className="flex items-baseline gap-3">
              <span className="num text-[11px] font-semibold text-yes">{s.n}</span>
              <h2 className="text-[13.5px] font-semibold text-fg">{s.title}</h2>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{s.body}</p>
          </li>
        ))}
      </ol>

      <h2 className="mt-10 text-[13px] font-semibold text-fg">What we do not do</h2>
      <p className="mt-3 text-[12.5px] text-muted">
        Every trader needs an account. Accounts are for the leaderboard and comments, not
        for money: deposits and orders live in the contract, tied to your wallet.
      </p>
      <ul className="mt-3 space-y-1.5 text-[12.5px] text-muted">
        <li>We do not hold your USDC, and there is no account balance to withdraw from.</li>
        <li>We do not charge a fee, take a cut, or subsidise liquidity.</li>
        <li>We cannot freeze, reverse or recover a transaction.</li>
      </ul>

      <p className="mt-8 text-[12.5px] text-muted">
        Read the <Link href="/#resolves" className="text-fg underline decoration-line2 underline-offset-2">resolution rules</Link>{" "}
        and the <Link href="/risk" className="text-fg underline decoration-line2 underline-offset-2">risk disclosure</Link>.
      </p>
    </div>
  );
}
