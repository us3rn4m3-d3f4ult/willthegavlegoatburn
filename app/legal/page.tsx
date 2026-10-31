import type { Metadata } from "next";
import { LegalShell } from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "Operator & contact",
  alternates: { canonical: "/legal" },
};

export default function OperatorPage() {
  return (
    <LegalShell
      title="Operator & contact"
      updated="30 October 2026"
      intro="Who runs this, how to reach them, and how to complain."
    >
      <h2>Operator</h2>
      <p>
        <strong>[Legal name]</strong>
        <br />
        [Registered address], [City], the Netherlands
        <br />
        Chamber of Commerce (KvK): [number]
        <br />
        VAT: [number]
      </p>

      <h2>Contact</h2>
      <p>
        General and legal:{" "}
        <a href="mailto:contact@willthegavlegoatburn.com">contact@willthegavlegoatburn.com</a>
        <br />
        Privacy and data requests:{" "}
        <a href="mailto:contact@willthegavlegoatburn.com">contact@willthegavlegoatburn.com</a>{" "}
        (subject: <em>privacy</em>)
      </p>
      <p>We aim to reply within five working days.</p>

      <h2 id="complaints">Complaints</h2>
      <p>
        If something has gone wrong â€” a resolution you think is wrong, a bug, an order that behaved
        unexpectedly â€” email us with the transaction hash and a description. Resolution complaints
        are published in the evidence log on the{" "}
        <a href="/#resolves">rules page</a> if they arrive before the timelock expires.
      </p>
      <p>
        For privacy complaints you may also contact the Dutch supervisory authority, the{" "}
        <em>Autoriteit Persoonsgegevens</em>.
      </p>

      <h2>Disclaimers</h2>
      <p>
        This is an unofficial fan project. It is not affiliated with, endorsed by, sponsored by or
        connected to GÃ¤vle kommun, Visit GÃ¤vle, the Southern Merchants of GÃ¤vle, or Vasaskolan. No
        official imagery, logos or photography are used. Any reference to &ldquo;GÃ¤vlebocken&rdquo;
        refers to the public artwork itself.
      </p>

      <h2>Source code</h2>
      <p>
        The smart contracts are intended to be published and verified on Basescan, with the address
        listed on the <a href="/#resolves">rules page</a> so anyone can read them before depositing a
        single USDC.
      </p>
    </LegalShell>
  );
}
