"use client";

import Link from "next/link";
import { useState } from "react";
import { setSession } from "@/components/useSession";

const MESSAGES: Record<string, string> = {
  invalid_code: "That code is not valid, or it has already been used.",
  password_too_short: "Use at least 10 characters.",
  password_too_guessable: "That password is too easy to guess.",
  password_too_long: "That password is too long.",
  rate_limited: "Too many attempts. Wait a minute.",
  accounts_unavailable: "Accounts are temporarily unavailable.",
  invalid_body: "That request was malformed.",
};

export function RecoverForm() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        // Recovery destroys every session, this one included.
        setSession(false);
        setDone(true);
        return;
      }
      setError(MESSAGES[data.error ?? ""] ?? "Something went wrong.");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-card border border-yes/30 bg-yes/[0.04] p-4">
        <p className="text-[12.5px] font-semibold text-fg">Password changed</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
          That code is now used up and every existing session was signed out. Sign in
          with your new password, and generate a fresh set of codes while you are there.
        </p>
        <Link
          href="/login"
          className="mt-3 inline-flex h-9 items-center rounded-btn bg-fg px-4 text-[12.5px] font-semibold text-black"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label htmlFor="r-email" className="block text-[11px] font-medium text-dim">
          Email
        </label>
        <input
          id="r-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 h-11 w-full rounded-btn border border-line bg-black px-3.5 text-[13.5px] text-fg outline-none focus:border-line2"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="r-code" className="block text-[11px] font-medium text-dim">
          Recovery code
        </label>
        <input
          id="r-code"
          required
          autoComplete="one-time-code"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="num mt-1.5 h-11 w-full rounded-btn border border-line bg-black px-3.5 font-mono text-[13.5px] tracking-[0.08em] text-fg outline-none focus:border-line2"
          placeholder="XXXX-XXXX-XXXX-XXXX"
        />
      </div>

      <div>
        <label htmlFor="r-pass" className="block text-[11px] font-medium text-dim">
          New password
        </label>
        <input
          id="r-pass"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="mt-1.5 h-11 w-full rounded-btn border border-line bg-black px-3.5 text-[13.5px] text-fg outline-none focus:border-line2"
          placeholder="at least 10 characters"
        />
      </div>

      <div aria-live="polite" className="min-h-[1.1rem]">
        {error ? <p className="text-[12px] text-yes">{error}</p> : null}
      </div>

      <button
        type="submit"
        disabled={busy}
        className="h-11 w-full rounded-btn bg-fg text-[13px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Working…" : "Reset password"}
      </button>

      <p className="pt-1 text-center text-[12px] text-muted">
        <Link href="/login" className="text-fg underline decoration-line2 underline-offset-2">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
