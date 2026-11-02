"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RecoveryCodes } from "@/components/RecoveryCodes";
import { setSession } from "@/components/useSession";

const MESSAGES: Record<string, string> = {
  invalid_email: "That doesn't look like a valid email address.",
  password_too_short: "Use at least 10 characters.",
  password_too_long: "That password is too long.",
  password_too_guessable: "That password is too easy to guess.",
  email_taken: "An account with that email already exists.",
  username_invalidChanged: "",
  username_invalid: "3–20 characters: letters, numbers, underscore, starting with a letter.",
  username_taken: "That username is already taken.",
  username_reserved: "That username is reserved.",
  username_language: "Pick a different username.",
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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const isRegister = mode === "register";

  // Slow the form down after a 429 instead of letting people hammer it.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || cooldown > 0) return;
    // A typo here is unrecoverable: there is no reset email, only recovery codes.
    if (isRegister && password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");

    try {
      const res = await fetch(`/api/auth/${isRegister ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, ...(isRegister ? { username } : {}) }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        pending?: boolean;
        error?: string;
        recoveryCodes?: string[];
      };

      if (res.status === 429) {
        const retry = Number(res.headers.get("retry-after") ?? 60);
        setCooldown(Number.isFinite(retry) && retry > 0 ? Math.min(300, retry) : 60);
        setError("Too many attempts. The button unlocks when you can try again.");
        return;
      }

      // A neutral answer: the address may already have an account. The owner got
      // an email; the person typing learns nothing either way.
      if (res.ok && data.ok && data.pending) {
        setError("");
        setNotice("If that address already has an account, we've emailed it — sign in instead.");
        return;
      }

      if (res.ok && data.ok) {
        setSession(true);
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
      {isRegister ? (
        <div>
          <label htmlFor="username" className="block text-[11px] font-medium text-dim">
            Username
          </label>
          <input
            id="username"
            name="username"
            required
            minLength={3}
            maxLength={20}
            autoComplete="username"
            pattern="[a-zA-Z][a-zA-Z0-9_]{2,19}"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""));
              if (error) setError("");
            }}
            className="mt-1.5 h-11 w-full rounded-btn border border-line bg-black px-3.5 text-[13.5px] text-fg outline-none transition-colors placeholder:text-dim focus:border-line2"
            placeholder="shown publicly next to your comments"
          />
        </div>
      ) : null}

      <div>
        <label htmlFor="email" className="block text-[11px] font-medium text-dim">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
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
        <div className="relative mt-1.5">
          <input
            id="password"
            type={show ? "text" : "password"}
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
            minLength={isRegister ? 10 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyUp={(e) => setCapsLock(e.getModifierState?.("CapsLock") ?? false)}
            className="h-11 w-full rounded-btn border border-line bg-black px-3.5 pr-16 text-[13.5px] text-fg outline-none transition-colors placeholder:text-dim focus:border-line2"
            placeholder={isRegister ? "at least 10 characters" : "••••••••••"}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-pressed={show}
            className="absolute inset-y-0 right-0 px-3 text-[11px] font-medium text-muted transition-colors hover:text-fg"
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>
        {capsLock ? <p className="mt-1 text-[11px] text-ember">Caps lock is on.</p> : null}
      </div>

      {isRegister ? (
        <div>
          <label htmlFor="confirm" className="block text-[11px] font-medium text-dim">
            Confirm password
          </label>
          <input
            id="confirm"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={10}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-btn border border-line bg-black px-3.5 text-[13.5px] text-fg outline-none transition-colors placeholder:text-dim focus:border-line2"
            placeholder="type it again"
          />
          {confirm.length > 0 && confirm !== password ? (
            <p className="mt-1 text-[11px] text-no">Those two do not match.</p>
          ) : null}
        </div>
      ) : null}

      <div aria-live="polite" className="min-h-[1.1rem]">
        {error ? <p className="text-[12px] text-yes">{error}</p> : null}
        {notice ? <p className="text-[12px] text-muted">{notice}</p> : null}
      </div>

      <button
        type="submit"
        disabled={busy || cooldown > 0}
        className="h-11 w-full rounded-btn bg-fg text-[13px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {busy
          ? "Working…"
          : cooldown > 0
            ? `Try again in ${cooldown}s`
            : isRegister
              ? "Create account"
              : "Sign in"}
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
