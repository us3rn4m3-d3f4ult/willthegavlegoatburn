import type { Metadata } from "next";
import { LegalShell } from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "Cookie statement",
  alternates: { canonical: "/cookies" },
};

const ROWS = [
  {
    name: "__Host-gsess",
    purpose: "Keeps you signed in (the name is gsess on a local dev server)",
    type: "Essential",
    life: "30 days",
  },
];

const LOCAL = [
  {
    name: "chunk-reload",
    purpose: "Marks that an automatic one-time reload after a deploy already happened, so it cannot loop.",
    life: "That tab only",
  },
];

export default function CookiesPage() {
  return (
    <LegalShell
      title="Cookie statement"
      updated="2 November 2026"
      intro="Essential cookies only. No analytics cookies, no advertising, no fingerprinting — which is why you do not see a consent banner."
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

      <h2>What we keep in your browser</h2>
      <p>
        Not cookies, but stored on your device for the same reason — to make the site work:
      </p>
      <div className="mt-3 overflow-hidden rounded-card border border-line">
        <table className="w-full text-left text-[12.5px]">
          <thead className="bg-surface2 text-[10.5px] uppercase tracking-[0.1em] text-dim">
            <tr>
              <th className="px-3 py-2 font-medium">Key</th>
              <th className="px-3 py-2 font-medium">Purpose</th>
              <th className="px-3 py-2 font-medium">Lifetime</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {LOCAL.map((r) => (
              <tr key={r.name}>
                <td className="px-3 py-2 font-mono text-[11.5px] text-fg">{r.name}</td>
                <td className="px-3 py-2">{r.purpose}</td>
                <td className="px-3 py-2">{r.life}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>What we do not set</h2>
      <p>
        No advertising cookies, no analytics cookies, no session recording, no cross-site tracking
        pixels. Your wallet talks to the blockchain directly; we do not receive your keys.
      </p>
      <p>
        Two third parties can see ordinary request data while you use the site: our RPC provider
        answers your balance reads, and GIPHY answers GIF searches in the comment box. None of them
        sets a cookie on our behalf. See the <a href="/privacy">privacy statement</a>.
      </p>

      <h2>Removing them</h2>
      <p>
        You can clear cookies and site data in your browser at any time. Removing the session
        cookie logs you out; your positions stay on-chain and are unaffected.
      </p>
    </LegalShell>
  );
}
