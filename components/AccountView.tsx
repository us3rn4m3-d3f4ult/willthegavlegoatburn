"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AbstractAvatar } from "@/components/AbstractAvatar";
import { RecoveryCodes } from "@/components/RecoveryCodes";

type Me = {
  user: { id: string; email: string; createdAt: string } | null;
  sessions: number;
  recoveryRemaining?: number;
};

const MESSAGES: Record<string, string> = {
  wrong_password: "That password is incorrect.",
  password_too_short: "Use at least 10 characters.",
  password_too_guessable: "That password is too easy to guess.",
  same_password: "That's already your password.",
  confirm_required: "Type DELETE to confirm.",
  password_required: "Enter your password to continue.",
  rate_limited: "Too many attempts. Wait a minute.",
  accounts_unavailable: "Accounts are temporarily unavailable.",
  not_signed_in: "Your session expired. Sign in again.",
};

export function AccountView() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [codes, setCodes] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json() as Promise<Me>)
      .then((d) => {
        if (alive) setMe(d);
      })
      .catch(() => {
        if (alive) setError("Could not reach the accounts service.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function call(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/auth/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) return true;
      setError(MESSAGES[data.error ?? ""] ?? "Something went wrong.");
      if (data.error === "not_signed_in") router.refresh();
      return false;
    } catch {
      setError("Network error.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onChangePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const ok = await call({ action: "password", currentPassword, newPassword });
    if (ok) {
      setCurrentPassword("");
      setNewPassword("");
      setNotice("Password changed. Every other session was signed out.");
    }
  }

  async function onDelete(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const ok = await call({ action: "delete", currentPassword, confirm: confirmText.trim() });
    if (ok) {
      router.push("/");
      router.refresh();
    }
  }

  async function onRegenerate() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/auth/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recovery", currentPassword }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        recoveryCodes?: string[];
      };
      if (res.ok && data.ok && Array.isArray(data.recoveryCodes)) {
        setCodes(data.recoveryCodes);
        setCurrentPassword("");
        return;
      }
      setError(MESSAGES[data.error ?? ""] ?? "Could not generate codes.");
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function onSignOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setMe({ user: null, sessions: 0 });
    router.refresh();
  }

  if (loading) {
    return <p className="text-[12.5px] text-dim">Loading your account…</p>;
  }

  if (!me?.user) {
    return (
      <div className="panel p-5">
        <p className="text-[12.5px] text-muted">
          You are not signed in. You need an account to trade. It holds no funds: your USDC
          stays in the contract and only your wallet can move it.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-btn bg-fg px-4 text-[12.5px] font-semibold text-black transition-opacity hover:opacity-90"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="inline-flex h-9 items-center rounded-btn border border-line px-4 text-[12.5px] font-medium text-fg transition-colors hover:border-line2"
          >
            Create account
          </Link>
        </div>
        {error ? <p className="mt-3 text-[12px] text-yes">{error}</p> : null}
      </div>
    );
  }

  if (codes.length > 0) {
    return (
      <RecoveryCodes
        codes={codes}
        doneLabel="I've saved them"
        onDone={() => {
          setCodes([]);
          setNotice("New recovery codes generated. The old ones no longer work.");
          fetch("/api/auth/me", { cache: "no-store" })
            .then((r) => r.json() as Promise<Me>)
            .then(setMe)
            .catch(() => {});
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 panel p-5">
        <AbstractAvatar seed={me.user.email} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-fg">{me.user.email}</p>
          <p className="mt-0.5 text-[11.5px] text-dim">
            Joined{" "}
            {new Date(me.user.createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}{" "}
            · {me.sessions} active session{me.sessions === 1 ? "" : "s"}
          </p>
        </div>
        <button
          onClick={onSignOut}
          className="h-8 shrink-0 rounded-btn border border-line px-3 text-[12px] text-muted transition-colors hover:border-line2 hover:text-fg"
        >
          Sign out
        </button>
      </div>

      <section className="panel p-5">
        <h2 className="text-[13px] font-semibold text-fg">Change password</h2>
        <form onSubmit={onChangePassword} className="mt-3 space-y-2.5">
          <input
            type="password"
            autoComplete="current-password"
            required
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="h-10 w-full rounded-btn border border-line bg-black px-3 text-[13px] text-fg outline-none focus:border-line2"
          />
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            placeholder="New password (10+ characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="h-10 w-full rounded-btn border border-line bg-black px-3 text-[13px] text-fg outline-none focus:border-line2"
          />
          <button
            type="submit"
            disabled={busy}
            className="h-9 rounded-btn bg-fg px-4 text-[12.5px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            Update password
          </button>
        </form>
      </section>

      {error ? <p className="text-[12px] text-yes">{error}</p> : null}
      {notice ? <p className="text-[12px] text-no">{notice}</p> : null}

      <section className="panel p-5">
        <h2 className="text-[13px] font-semibold text-fg">Recovery codes</h2>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
          <span className="num font-medium text-fg">{me.recoveryRemaining ?? 0}</span> of 10
          unused. These are the only way back in if you forget your password — there is no
          password-reset email. Generating a new set invalidates every old code.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="h-9 w-52 rounded-btn border border-line bg-black px-3 text-[12.5px] text-fg outline-none focus:border-line2"
          />
          <button
            onClick={onRegenerate}
            disabled={busy || currentPassword.length === 0}
            className="h-9 rounded-btn border border-line px-4 text-[12.5px] text-muted transition-colors hover:border-line2 hover:text-fg disabled:opacity-40"
          >
            Generate new codes
          </button>
        </div>
      </section>

      <section className="panel border-no/25 p-5">
        <h2 className="text-[13px] font-semibold text-fg">Delete account</h2>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
          Removes your email, password hash and every session, permanently. No undo, no
          soft delete. Blockchain positions are unaffected — those live in your wallet,
          not in this account.
        </p>

        {deleting ? (
          <form onSubmit={onDelete} className="mt-3 space-y-2.5">
            <input
              type="password"
              required
              placeholder="Your password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="h-10 w-full rounded-btn border border-line bg-black px-3 text-[13px] text-fg outline-none focus:border-line2"
            />
            <input
              required
              placeholder="Type DELETE to confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="h-10 w-full rounded-btn border border-line bg-black px-3 text-[13px] text-fg outline-none focus:border-line2"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy || confirmText.trim() !== "DELETE"}
                className="h-9 rounded-btn bg-no px-4 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                Delete permanently
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleting(false);
                  setConfirmText("");
                }}
                className="h-9 rounded-btn border border-line px-4 text-[12.5px] text-muted hover:border-line2 hover:text-fg"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setDeleting(true)}
            className="mt-3 h-9 rounded-btn border border-yes/40 px-4 text-[12.5px] font-medium text-yes transition-colors hover:bg-yes/10"
          >
            Delete my account
          </button>
        )}
      </section>
    </div>
  );
}
