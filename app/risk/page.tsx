import type { Metadata } from "next";
import { LegalShell } from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "Risk disclosure",
  description:
    "You can lose your entire stake. Resolution, contract, liquidity, wallet and tax risks explained before you trade.",
  alternates: { canonical: "/risk" },
};


export default function RiskPage() {
  return (
    <LegalShell
      title="Risk disclosure"
      updated="30 October 2026"
      intro="Read this before you trade. The realistic downside is that you lose everything you stake, and that no one can get it back for you."
    >
      <h2>You can lose your entire stake</h2>
      <p>
        Outcome shares are all-or-nothing. A Yes share is worth 1 USDC if the market resolves Yes and
        0 USDC if it resolves No. There is no partial payout and no compensation fund.
      </p>

      <h2>Resolution risk</h2>
      <p>
        &ldquo;Did the goat burn?&rdquo; is a real-world fact judged by published sources, not by an
        API. A market can resolve in a way you disagree with. The rules are written narrowly on
        purpose — fire only, requiring the structure to come down — and the evidence is published
        before resolution finalises. Read them and decide whether you accept that reading.
      </p>

      <h2>Smart-contract risk</h2>
      <p>
        The contracts are new. They may contain defects despite testing. A defect could result in
        loss of funds held in the contract. Nobody insures this.
      </p>

      <h2>Liquidity risk</h2>
      <p>
        There is no market maker and no subsidy. If nobody has posted a bid, you cannot sell. You may
        be unable to exit a position at any price before resolution, even if the odds have moved in
        your favour.
      </p>

      <h2>Wallet risk</h2>
      <p>
        Whoever controls the wallet controls the position. Lost keys, a compromised device, or a
        signature given to a malicious site means permanent loss. No transaction can be reversed.
      </p>

      <h2>Regulatory risk</h2>
      <p>
        The legal treatment of event contracts differs by country and is changing. Access may be
        restricted or blocked, and the service may stop being available without notice.
      </p>

      <h2>Tax — read this if you are in the Netherlands</h2>
      <p>
        Under the Wet op de kansspelbelasting, winnings above <strong>€449</strong> from an operator
        that does not withhold Dutch gambling tax are, in principle, taxable in your own hands at the
        rate in force (37.8% in 2026). Because no operator withholds this for you, you may have to
        declare winnings yourself. This is general information, not tax advice — check with a
        professional.
      </p>

      <h2>Network fees</h2>
      <p>
        We charge nothing — no protocol fee, no rake, no cut of any payout. But every transaction you
        sign costs a small network fee on Base, paid by you directly to the blockchain. Network fees
        are never refunded, including for transactions that revert or positions that lose.
      </p>

      <h2>Not investment advice</h2>
      <p>
        Prices on this site are the aggregation of other users&rsquo; orders. They are not forecasts,
        ratings, or recommendations.
      </p>
    </LegalShell>
  );
}
