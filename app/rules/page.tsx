import type { Metadata } from "next";
import { LegalShell } from "@/components/LegalShell";
import { MARKET } from "@/lib/market";

export const metadata: Metadata = {
  title: "Resolution rules",
  description:
    "Exactly how the 2026 Gävle goat market resolves: sources, definitions, edge cases and the refund path.",
};

export default function RulesPage() {
  return (
    <LegalShell
      title="Resolution rules — 2026"
      updated="30 October 2026"
      intro="These rules are frozen at deployment and published before any trade. They are written to be applied mechanically: if the event matches the definition, the market resolves Yes. If it does not, it resolves No. No discretion, no vote, no interpretation."
    >
      <h2>1. The question</h2>
      <p>
        <strong>Will the Gävle goat burn in 2026?</strong> Betting closes{" "}
        <strong>{MARKET.closesAtLabel}</strong>.
      </p>

      <h2>2. Yes — the exact conditions</h2>
      <p>The market resolves <strong>Yes</strong> only if all three are true:</p>
      <ul>
        <li>
          The goat erected at Slottstorget for Advent 2026 is <strong>set on fire</strong> (arson or
          accidental; intent is irrelevant).
        </li>
        <li>
          As a result of that fire, the structure must be <strong>dismantled or rebuilt</strong>{" "}
          before its scheduled removal — i.e. it cannot remain on display in its erected form.
        </li>
        <li>
          This is confirmed by <strong>at least two</strong> of the three sources listed in §4.
        </li>
      </ul>

      <h2>3. No — everything else, including these</h2>
      <p>The market resolves <strong>No</strong> if the goat survives to its scheduled removal, and in every one of these cases:</p>
      <ul>
        <li>
          <strong>Damaged by a vehicle.</strong> In 2021 the goat was hit by a car. That is not a
          fire. <span className="text-fg">No.</span>
        </li>
        <li>
          <strong>Brought down by weather.</strong> In 2025 Storm Johannes felled it on 27 December.
          That is not a fire. <span className="text-fg">No.</span>
        </li>
        <li>
          <strong>Vandalised without fire</strong> — knocked over, cut, sprayed, dismantled, stolen,
          eaten by birds. <span className="text-fg">No.</span>
        </li>
        <li>
          <strong>A small fire that does not require removal.</strong> If someone singes a leg and
          the goat stays up, that is <span className="text-fg">No</span>. The threshold is structural
          removal, not smoke.
        </li>
        <li>
          <strong>The goat is never erected</strong> — see the void rule in §5.
        </li>
      </ul>

      <h2>4. Sources (fixed, published, non-negotiable)</h2>
      <ul>
        <li>The official Visit Gävle / Gävle kommun live feed for Slottstorget.</li>
        <li>An official statement from Gävle kommun or Visit Gävle, or the goat&rsquo;s official accounts.</li>
        <li>Reporting by SVT or Aftonbladet.</li>
      </ul>
      <p>
        Two of three must agree. If the live feed fails but two text sources confirm, the market
        resolves on the text sources. Screenshots, archive links and timestamps are published in the
        evidence log before resolution finalises.
      </p>

      <h2>5. Timing, and the void path</h2>
      <ul>
        <li>
          <strong>A fire after betting closes still counts.</strong> If the goat burns in January
          before removal, the market resolves Yes. Betting closes on 1 January; the event does not.
        </li>
        <li>
          <strong>Resolution deadline: 31 January 2027.</strong>
        </li>
        <li>
          <strong>Void:</strong> if the market has not been resolved 30 days after that deadline — or
          if the goat is never erected for 2026 at all — every position can be refunded at face value
          by anyone, permissionlessly, by calling the contract&rsquo;s void function. Nobody needs
          our permission and nobody can block it.
        </li>
      </ul>

      <h2>6. How the call is made</h2>
      <p>
        Resolution is proposed on-chain with a hash of the evidence bundle. It then waits in a
        <strong> timelock</strong> during which the proposal is publicly visible on this site before
        any funds move. Anyone can check the sources in that window and object publicly. When the
        timelock expires, resolution finalises and winners redeem.
      </p>

      <h2>7. Evidence log</h2>
      <p>
        Every resolution proposal and its evidence bundle are published here with the on-chain hash,
        so the record cannot be altered after the fact. This log is empty until the market resolves.
      </p>
      <div className="mt-3 rounded-card border border-line bg-surface p-4">
        <p className="text-[12px] text-dim">No resolution proposed yet. Market is open.</p>
      </div>

      <h2>8. Known ways to lose money here</h2>
      <ul>
        <li>You can lose your entire stake — see the <a href="/risk">risk disclosure</a>.</li>
        <li>There is no market maker. If nobody bids, you cannot sell.</li>
        <li>Manipulating the real-world outcome is a crime. Wallets involved in arson would be public.</li>
      </ul>
    </LegalShell>
  );
}
