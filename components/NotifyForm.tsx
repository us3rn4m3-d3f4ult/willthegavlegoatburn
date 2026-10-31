"use client";

import { useState } from "react";

type State = "idle" | "submitting" | "success" | "duplicate" | "error";

export function NotifyForm() {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "submitting") return;

    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value)) {
      setState("error");
      setMessage("That doesn't look like an email address.");
      return;
    }

    setState("submitting");
    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, company }),
      });
      const data = (await res.json()) as { ok?: boolean; result?: string; error?: string };

      if (res.ok && data.ok) {
        setState(data.result === "duplicate" ? "duplicate" : "success");
        setMessage(
          data.result === "duplicate"
            ? "You're already on the list — nothing else to do."
            : "You're on the list. We'll email you the moment trading opens.",
        );
        setEmail("");
      } else if (data.error === "rate_limited") {
        setState("error");
        setMessage("Too many attempts. Try again in a minute.");
      } else {
        setState("error");
        setMessage("That didn't work. Try again in a moment.");
      }
    } catch {
      setState("error");
      setMessage("Network error. Check your connection and try again.");
    }
  }

  if (state === "success" || state === "duplicate") {
    return (
      <div
        aria-live="polite"
        className="rounded-card border border-yes/30 bg-yes/5 p-4 text-[12.5px] leading-relaxed text-fg"
      >
        <span className="mr-1.5 text-yes">●</span>
        {message}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="notify-email" className="sr-only">
          Email address
        </label>
        <input
          id="notify-email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state === "error") setState("idle");
          }}
          placeholder="you@example.com"
          className="h-11 flex-1 rounded-btn border border-line bg-surface px-3.5 text-[13.5px] text-fg outline-none transition-colors placeholder:text-dim focus:border-line2"
        />

        {/* Honeypot: hidden from humans, irresistible to bots. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <input
            tabIndex={-1}
            autoComplete="off"
            name="company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={state === "submitting"}
          className="h-11 shrink-0 rounded-btn bg-fg px-5 text-[13px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {state === "submitting" ? "Adding…" : "Notify me"}
        </button>
      </div>

      <div aria-live="polite" className="min-h-[1.25rem]">
        {state === "error" && message ? (
          <p className="mt-2 text-[12px] text-yes">{message}</p>
        ) : (
          <p className="mt-2 text-[11.5px] text-dim">
            One email when trading opens. No newsletter, no partners, no spam.
          </p>
        )}
      </div>
    </form>
  );
}
