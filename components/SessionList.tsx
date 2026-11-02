"use client";

import { useCallback, useEffect, useState } from "react";

type Row = {
  sid: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastSeen: string;
  current: boolean;
};

function device(ua: string | null): string {
  if (!ua) return "Unknown device";
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "Unknown OS";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  return `${browser} · ${os}`;
}

function ago(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "active now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return `${Math.floor(hrs / 24)} d ago`;
}

/** Every device with a live session, and a way to end any of them remotely. */
export function SessionList() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/auth/sessions", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ sessions?: Row[] }>)
      .then((d) => setRows(d.sessions ?? []))
      .catch(() => setRows([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function revoke(sid: string) {
    setBusy(sid);
    try {
      await fetch(`/api/auth/sessions?sid=${sid}`, { method: "DELETE" });
      load();
    } finally {
      setBusy(null);
    }
  }

  if (rows === null) return <p className="mt-2 text-[12px] text-dim">Loading devices…</p>;
  if (rows.length === 0) return <p className="mt-2 text-[12px] text-dim">No active sessions.</p>;

  return (
    <div className="mt-3">
      <ul className="divide-y divide-line border-y border-line">
        {rows.map((r) => (
          <li key={r.sid} className="flex items-center gap-3 py-2.5 text-[12.5px]">
            <div className="min-w-0 flex-1">
              <p className="truncate text-fg">
                {device(r.userAgent)}
                {r.current ? (
                  <span className="ml-2 text-[10px] uppercase tracking-[0.08em] text-yes">
                    this device
                  </span>
                ) : null}
              </p>
              <p className="num mt-0.5 text-[11px] text-dim">
                {r.ip ?? "—"} · {ago(r.lastSeen)}
              </p>
            </div>
            {r.current ? null : (
              <button
                type="button"
                onClick={() => revoke(r.sid)}
                disabled={busy === r.sid}
                className="h-9 shrink-0 border border-line px-2.5 text-[11.5px] text-muted transition-colors hover:border-line2 hover:text-fg disabled:opacity-40 sm:h-7"
              >
                {busy === r.sid ? "…" : "Sign out"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
