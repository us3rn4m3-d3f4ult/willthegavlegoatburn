import type { Metadata } from "next";
import { LegalShell } from "@/components/LegalShell";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <LegalShell
      title="Terms of use"
      updated="30 October 2026"
      intro="DRAFT — to be reviewed by Dutch counsel before launch. These terms describe a non-custodial product: we never hold your funds, and we cannot reverse a transaction."
    >
      <h2>1. Eligibility</h2>
      <p>
        You must be at least 18 years old and legally able to enter into a contract. You must not be
        resident in, or accessing the service from, a jurisdiction where trading event contracts is
        unlawful. You are responsible for knowing your own local law.
      </p>

      <h2>2. What this service is</h2>
      <p>
        We publish a website and smart contracts that let you trade outcome shares with other users.
        We are not a broker, exchange, bookmaker, custodian, or investment adviser. We do not hold
        your USDC at any point, we do not execute trades on your behalf, and we cannot move, freeze
        or return your funds.
      </p>

      <h2>3. No custody, no recovery</h2>
      <p>
        Your position is held by a smart contract and is controlled only by the wallet that signed
        the transaction. If you lose access to that wallet, nobody — including us — can recover your
        position. If you send funds to the wrong address or the wrong contract, the transfer is
        final.
      </p>

      <h2>4. Resolution</h2>
      <p>
        Markets resolve according to the published <a href="/rules">resolution rules</a>, from the
        listed public sources. Resolution is proposed on-chain and finalises after a timelock, during
        which the proposal is publicly visible. If a market cannot be resolved by its deadline, every
        position can be refunded by anyone calling the void function.
      </p>

      <h2>5. Fees</h2>
      <p>
        We charge no protocol fee and take no cut of any trade or payout. You pay network gas fees
        directly to the blockchain, and nothing else.
      </p>

      <h2>6. Prohibited conduct</h2>
      <ul>
        <li>Using the service from a restricted jurisdiction, or on behalf of someone who is.</li>
        <li>Manipulating a market, including wash trading or spoofing orders.</li>
        <li>Attempting to influence the real-world outcome of a market, including by damaging property.</li>
        <li>Automated scraping or load that degrades the service for others.</li>
      </ul>

      <h2>7. No warranty</h2>
      <p>
        The service and the contracts are provided &ldquo;as is&rdquo;. Smart contracts may contain
        defects. Front-ends may be unavailable. Blockchain networks may congest or reorganise. We do
        not warrant uninterrupted availability or that any market will attract liquidity.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, we are not liable for trading losses, lost profits,
        loss of access to a wallet, gas costs, or losses caused by third parties, contract defects,
        or your own error. Nothing in these terms limits liability that cannot be limited under
        Dutch law.
      </p>

      <h2>9. Intellectual property</h2>
      <p>
        The name, design and copy of this site are ours. The smart contracts are intended to be
        open-source. We are not affiliated with Gävle kommun, Visit Gävle, the Southern Merchants or
        any official body, and no official imagery is used.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update these terms; the &ldquo;last updated&rdquo; date will change. Continued use
        after an update means you accept it.
      </p>

      <h2>11. Governing law</h2>
      <p>
        These terms are governed by the laws of the Netherlands. Disputes go to the competent court
        in the Netherlands, unless mandatory consumer law gives you a different forum.
      </p>
    </LegalShell>
  );
}
