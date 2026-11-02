"use client";

const HOST = "willthegavlegoatburn.com";
const HOME = `https://${HOST}`;

/**
 * A wallet only exists in a browser that has one. Mobile Safari and Chrome do
 * not, so the page is opened inside the wallet app's own browser instead — one
 * tap, and `window.ethereum` exists on the other side. This is the same trick
 * Polymarket and most small dapps use before paying for WalletConnect.
 */
const APPS = [
  { name: "MetaMask", href: `https://metamask.app.link/dapp/${HOST}` },
  { name: "Coinbase Wallet", href: `https://go.cb-w.com/dapp?url=${encodeURIComponent(HOME)}` },
];

export function WalletDeepLinks({ note = true }: { note?: boolean }) {
  return (
    <div>
      {note ? (
        <p className="text-[12px] leading-relaxed text-muted">
          On a phone? Open this page inside a wallet app — it has a browser built in:
        </p>
      ) : null}
      <div className={`flex flex-wrap gap-2 ${note ? "mt-2" : ""}`}>
        {APPS.map((a) => (
          <a
            key={a.name}
            href={a.href}
            target="_blank"
            rel="noopener noreferrer"
            className="btn h-9 px-3 text-[12.5px]"
          >
            {a.name}
          </a>
        ))}
      </div>
    </div>
  );
}
