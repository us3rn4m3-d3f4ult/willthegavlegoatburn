import type { Metadata } from "next";
import { LegalShell } from "@/components/LegalShell";

export const metadata: Metadata = { title: "Cookie statement" };

const ROWS = [
  {
    name: "__Host-session",
    purpose: "Keeps you logged in",
    type: "Essential",
    life: "30 days",
  },
  {
    name: "csrf",
    purpose: "Blocks cross-site request forgery",
    type: "Essential",
    life: "Session",
  },
];

export default function CookiesPage() {
  return (
    <LegalShell
      title="Cookie statement"
      updated="30 October 2026"
      intro="Essential cookies only. No analytics, no advertising, no fingerprinting — which is why you do not see a consent banner."
    >
      <h2>What we set</h2>
      <div className="mt-4 overflow-hidden rounded-card border border-line">
        <table className="w-full text-left text-[12.5px]">
          <thead className="bg-surface2 text-[10.5px] uppercase tracking-[0.1em] text-dim">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Purpose</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Lifetime</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ROWS.map((r) => (
              <tr key={r.name}>
                <td className="px-3 py-2 font-mono text-[11.5px] text-fg">{r.name}</td>
                <td className="px-3 py-2">{r.purpose}</td>
                <td className="px-3 py-2">{r.type}</td>
                <td className="px-3 py-2">{r.life}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>What we do not set</h2>
      <p>
        No advertising cookies, no third-party analytics, no session recording, no cross-site
        tracking pixels. Wallet connections happen directly between your wallet and the blockchain;
        we do not receive your keys.
      </p>

      <h2>Removing them</h2>
      <p>
        You can clear cookies in your browser at any time. Removing the session cookie logs you out;
        your positions stay on-chain and are unaffected.
      </p>
    </LegalShell>
  );
}
