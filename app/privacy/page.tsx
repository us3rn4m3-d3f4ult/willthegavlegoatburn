import type { Metadata } from "next";
import { LegalShell } from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "Privacy statement",
  description: "What we store, why, for how long, and how to exercise your rights.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy statement"
      updated="30 October 2026"
      intro="What we store, why we store it, how long we keep it, and how to get it deleted. Short version: an email address and a password hash, nothing else — your positions live on the blockchain, not in our database."
    >
      <h2>Who is responsible</h2>
      <p>
        <strong>[Operator name]</strong>, [address], the Netherlands — <em>controller</em> for the
        personal data described below. Contact: <a href="mailto:contact@willthegavlegoatburn.com">contact@willthegavlegoatburn.com</a>.
      </p>

      <h2>What we store</h2>
      <ul>
        <li>
          <strong>Account data</strong> — email address, a password hash (Argon2id, never the
          password), a verification timestamp, and a generated avatar seed.
        </li>
        <li>
          <strong>Session data</strong> — a session identifier, creation time, last-seen time, IP
          address and browser user-agent, so you can see and revoke your own logins.
        </li>
        <li>
          <strong>Security logs</strong> — failed login attempts and rate-limit events, retained to
          stop credential stuffing.
        </li>
        <li>
          <strong>Public blockchain data</strong> — wallet addresses, orders and trades are public
          by design. We do not control them, and they cannot be deleted by us or by anyone else.
        </li>
      </ul>
      <p>
        We do <strong>not</strong> collect analytics profiles, we do not use advertising cookies, and
        we never ask for a seed phrase or private key — because we never hold one.
      </p>

      <h2>Why we process it (legal bases)</h2>
      <ul>
        <li>Account and session data: performance of a contract, Art. 6(1)(b) GDPR.</li>
        <li>Security logs: legitimate interest in preventing fraud and abuse, Art. 6(1)(f) GDPR.</li>
        <li>Service email (verification, password reset): contract and legal obligation.</li>
      </ul>

      <h2>Who else sees it</h2>
      <p>
        Our email delivery provider processes your email address solely to send verification and
        password-reset messages, under a data processing agreement. Our hosting provider stores the
        encrypted database in the EU (Finland). We do not sell data and we do not share it for
        marketing.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Account data is deleted when you delete your account, and inactive accounts are removed
        after 24 months. Security logs are kept for 90 days. Blockchain records are permanent and
        outside our control.
      </p>

      <h2>Your rights</h2>
      <p>
        You can access, correct, export or delete your data from the account page, or by emailing
        the address above. You may also object to processing or lodge a complaint with the Dutch
        supervisory authority, the <em>Autoriteit Persoonsgegevens</em>.
      </p>

      <h2>Security</h2>
      <p>
        Passwords are hashed with Argon2id, sessions are httpOnly and rotate, the database is not
        reachable from the internet, and access is limited to the minimum necessary. If a breach
        affects your data, we will notify you and the Autoriteit Persoonsgegevens within 72 hours
        where the law requires it.
      </p>

      <h2>Cookies</h2>
      <p>
        We set one essential cookie for your login session. No tracking, no advertising, no consent
        banner needed. See the <a href="/cookies">cookie statement</a>.
      </p>
    </LegalShell>
  );
}
