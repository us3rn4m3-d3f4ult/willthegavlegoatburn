import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Status",
  alternates: { canonical: "/status" },
};


const SERVICES = [
  { name: "Website", state: "Operational" },
  { name: "Market contract (Base)", state: "Not deployed" },
  { name: "Order indexer", state: "Not deployed" },
  { name: "Email delivery", state: "Not configured" },
];

export default function StatusPage() {
  return (
    <div className="mx-auto max-w-[640px] py-12">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Status</h1>
      <p className="mt-2 text-[13px] text-muted">
        The blockchain is the source of truth. Even if this site is down, the contract keeps running
        and your positions stay claimable.
      </p>

      <ul className="mt-6 overflow-hidden rounded-card border border-line bg-surface">
        {SERVICES.map((s) => (
          <li
            key={s.name}
            className="flex items-center justify-between border-b border-line px-4 py-3 text-[12.5px] last:border-0"
          >
            <span className="text-fg">{s.name}</span>
            <span className="flex items-center gap-2 text-muted">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  s.state === "Operational" ? "bg-emerald-400" : "bg-dim"
                }`}
              />
              {s.state}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
