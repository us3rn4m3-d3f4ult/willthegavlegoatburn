"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RecoveryCodes } from "@/components/RecoveryCodes";

const MESSAGES: Record<string, string> = {
  invalid_email: "That doesn't look like a valid email address.",
  password_too_short: "Use at least 10 characters.",
  password_too_long: "That password is too long.",
  password_too_guessable: "That password is too easy to guess.",
  email_taken: "An account with that email already exists.",
  invalid_credentials: "Wrong email or password.",
  rate_limited: "Too many attempts. Wait a minute and try again.",
  accounts_unavailable: "Accounts are temporarily unavailable. Try again shortly.",
  db_error: "Something went wrong on our side. Try again.",
  invalid_body: "That request was malformed.",
  bad_origin: "Request blocked.",
};

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [codes, setCodes] = useState<string[]>([]);

  const isRegister = mode === "register";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");

    try {
      const res = await fetch(`/api/auth/${isRegister ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        recoveryCodes?: string[];
      };

      if (res.ok && data.ok) {
        if (Array.isArray(data.recoveryCodes) && data.recoveryCodes.length > 0) {
          setCodes(data.recoveryCodes);
          return;
        }
        router.push("/account");
        router.refresh();
        return;
      }
      setError(MESSAGES[data.error ?? ""] ?? "Something went wrong. Try again.");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (codes.length > 0) {
    return (
      <RecoveryCodes
        codes={codes}
        onDone={() => {
          router.push("/account");
          router.refresh();
        }}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label htmlFor="email" className="block text-[11px] font-medium text-dim">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 h-11 w-full rounded-btn border border-line bg-black px-3.5 text-[13.5px] text-fg outline-none transition-colors placeholder:text-dim focus:border-line2"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-[11px] font-medium text-dim">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete={isRegister ? "new-password" : "current-password"}
          required
          minLength={isRegister ? 10 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5 h-11 w-full rounded-btn border border-line bg-black px-3.5 text-[13.5px] text-fg outline-none transition-colors placeholder:text-dim focus:border-line2"
          placeholder={isRegister ? "at least 10 characters" : "••••••••••"}
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
        {busy ? "Working…" : isRegister ? "Create account" : "Sign in"}
      </button>

      <p className="pt-1 text-center text-[12px] text-muted">
        {isRegister ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-fg underline decoration-line2 underline-offset-2">
              Sign in
            </Link>
          </>
        ) : (
          <>
            No account yet?{" "}
            <Link href="/register" className="text-fg underline decoration-line2 underline-offset-2">
              Create one
            </Link>
          </>
        )}
      </p>

      <p className="pt-2 text-center text-[11px] leading-relaxed text-dim">
        An account is a profile, not a wallet. It can never move funds — every trade
        needs a signature from your own wallet.
      </p>
    </form>
  );
}
