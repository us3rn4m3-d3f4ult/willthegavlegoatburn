import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How it works",
  description: "Connect a wallet, buy Yes or No, and read the order book. The whole product in five short steps.",
  alternates: { canonical: "/how-it-works" },
};

const STEPS = [
  {
    n: "01",
    title: "Get a wallet",
    body: "Install MetaMask or Coinbase Wallet. You need USDC on Base — that is the money you trade with — and a few cents of ETH on Base for the transaction fee.",
  },
  {
    n: "02",
    title: "Create an account, connect the wallet",
    body: "An email and password, then press Connect wallet in the top right. The account is only a profile: your money stays in the market contract, tied to your wallet, never with us.",
  },
  {
    n: "03",
    title: "Pick a side and an amount",
    body: "Yes means the goat catches fire during 2026. No means it does not. Choose a side, type how much USDC you want to spend, and press the button — funding, approvals and the order all happen in one go.",
  },
  {
    n: "04",
    title: "Market or limit",
    body: "Market buys right now from whoever is selling; it only works if there is an offer to take. Limit lets you name your own price and waits for someone to accept it — cheaper, but it may never fill.",
  },
  {
    n: "05",
    title: "Get your money out",
    body: "Sell your shares back at any time, or hold to the end: a winning share pays exactly $1.00, a losing share pays nothing. Free USDC can be withdrawn to your wallet from your account page whenever you like.",
  },
];

const GLOSSARY = [
  { term: "One share", meaning: "Costs the price shown and pays $1.00 if you are right, $0 if you are wrong." },
  { term: "Big percentage", meaning: "The market's current guess at the chance of Yes. A 12¢ Yes share reads as 12%." },
  { term: "Yes and No", meaning: "Two prices for the same event. They always add up to about 100%." },
  { term: "Order book", meaning: "Offers to sell on top, offers to buy underneath. Click any price to load it into the trade panel." },
  { term: "Spread", meaning: "The gap between the best buy and best sell price. A wide gap means few people are trading." },
  { term: "Liquidity", meaning: "Money sitting in open orders right now." },
  { term: "Volume", meaning: "Total USDC that has actually changed hands." },
  { term: "Traders", meaning: "How many different wallets have traded." },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-[74ch] py-14">
      <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-fg">How it works</h1>
      <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
        Five steps, then you know the whole product.
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
        <h2 className="text-[15px] font-semibold text-fg">Reading the numbers</h2>
        <dl className="mt-4 divide-y divide-line">
          {GLOSSARY.map((g) => (
            <div key={g.term} className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-6">
              <dt className="w-32 shrink-0 text-[12.5px] font-medium text-fg">{g.term}</dt>
              <dd className="text-[13px] leading-relaxed text-muted">{g.meaning}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10 border-t border-line pt-8">
        <h2 className="text-[15px] font-semibold text-fg">The honest version</h2>
        <ul className="mt-4 space-y-2 text-[13px] leading-relaxed text-muted">
          <li>You can lose everything you put in.</li>
          <li>
            If nobody is selling, you cannot buy instantly — post a limit order and wait instead.
          </li>
          <li>
            The money sits in a public contract, not with us, so nobody can freeze, reverse or
            refund a trade.
          </li>
          <li>Nothing here is investment advice, and it is 18+.</li>
        </ul>
      </section>

      <p className="mt-10 border-t border-line pt-6 text-[13px] text-muted">
        Exact definitions live in the{" "}
        <Link href="/#resolves" className="text-fg">
          resolution rules
        </Link>
        . If you plan to trade, read the{" "}
        <Link href="/risk" className="text-fg">
          risk disclosure
        </Link>{" "}
        too.
      </p>
    </div>
  );
}
