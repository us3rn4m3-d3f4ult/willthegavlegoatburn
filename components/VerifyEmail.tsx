"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Verification banner for /account.
 *
 * Shown only when the server has a mail provider configured and this account's
 * address is unconfirmed. Without a provider there is nothing to click, so it
 * renders nothing at all rather than a dead button.
 */
export function VerifyEmail() {
  const [state, setState] = useState<{
    verified: boolean;
    signedIn: boolean;
    mailConfigured: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(
        (r) =>
          r.json() as Promise<{
            user?: unknown;
            emailVerified?: boolean;
            mailConfigured?: boolean;
          }>,
      )
      .then((d) => {
        if (!alive) return;
        setState({
          verified: Boolean(d.emailVerified),
          signedIn: Boolean(d.user),
          mailConfigured: Boolean(d.mailConfigured),
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // The link lands back here with ?verified=1|0; say what happened, then clean the
  // query string so a refresh does not repeat it.
  useEffect(() => {
    const flag = params.get("verified");
    if (!flag) return;
    setNote(flag === "1" ? "Email confirmed. Thank you." : "That link was already used or expired.");
    router.replace(pathname);
  }, [params, pathname, router]);

  // Nothing to do: signed out, already confirmed, or no mail provider.
  if (!state || !state.signedIn || state.verified || !state.mailConfigured) {
    return note ? <p className="text-[12px] text-yes">{note}</p> : null;
  }

  async function resend() {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/auth/verify/resend", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string; already?: boolean };
      if (data.already) {
        setState((prev) => (prev ? { ...prev, verified: true } : prev));
        setNote("Already confirmed.");
      } else if (res.ok && data.ok) {
        setNote("Sent. Check your inbox (and the spam folder).");
      } else if (data.error === "mail_not_configured") {
        setState((prev) => (prev ? { ...prev, mailConfigured: false } : prev));
      } else {
        setNote("Could not send it. Try again in a minute.");
      }
    } catch {
      setNote("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel p-5">
      <h2 className="text-[13px] font-semibold text-fg">Confirm your email</h2>
      <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
        Your address is not confirmed yet. Confirmed accounts can post in the discussion; an
        unconfirmed one can trade and comment as soon as you click the link.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={resend}
          disabled={busy}
          className="h-10 rounded-btn bg-fg px-3.5 text-[12.5px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40 sm:h-9"
        >
          {busy ? "Sending…" : "Send the link again"}
        </button>
        {note ? <span className="text-[11.5px] text-muted">{note}</span> : null}
      </div>
    </section>
  );
}
