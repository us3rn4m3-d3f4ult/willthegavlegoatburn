"use client";

import { useState } from "react";

/**
 * Shown exactly once, right after codes are issued. There is no way to see them
 * again — only to replace them — so the copy has to be unambiguous.
 */
export function RecoveryCodes({
  codes,
  onDone,
  doneLabel = "I've saved them — continue",
}: {
  codes: string[];
  onDone: () => void;
  doneLabel?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div>
      <div className="rounded-card border border-line/30 bg-yes/[0.04] p-4">
        <p className="text-[12.5px] font-semibold text-fg">Save these recovery codes now</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
          They are the only way back into your account — there is no password-reset
          email. Each works once. Store them somewhere offline.
        </p>

        <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {codes.map((c) => (
            <li
              key={c}
              className="num border border-line px-2.5 py-1.5 font-mono text-[12px] tracking-[0.06em] text-fg"
            >
              {c}
            </li>
          ))}
        </ul>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyAll}
            className="h-8 rounded-btn border border-line px-3 text-[12px] text-muted transition-colors hover:border-line2 hover:text-fg"
          >
            {copied ? "Copied" : "Copy all"}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onDone}
        className="mt-3 h-10 w-full rounded-btn bg-fg text-[13px] font-semibold text-black transition-opacity hover:opacity-90"
      >
        {doneLabel}
      </button>
    </div>
  );
}
