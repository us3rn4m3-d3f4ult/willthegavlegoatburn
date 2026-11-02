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
      updated="2 November 2026"
      intro="What we store, why we store it, how long we keep it, and how to get it deleted. Short version: an email address, a password hash and your comments — positions live on the blockchain, not in our database."
    >
      <h2>What we store</h2>
      <ul>
        <li>
          <strong>Account data</strong> — email address, username, a password hash (scrypt, never
          the password), an optional wallet address you have proved you own, and the date the
          account was created.
        </li>
        <li>
          <strong>Session data</strong> — a token hash, creation time, last-seen time, IP address
          and browser user-agent, so you can see and revoke your own logins.
        </li>
        <li>
          <strong>Recovery codes</strong> — one-way HMAC hashes only. The codes themselves are
          shown once and never stored.
        </li>
        <li>
          <strong>Comments</strong> — the text you post, an optional GIF reference, and the account
          that wrote it. Reports of comments are stored as a pair of ids so one account cannot
          report the same comment twice.
        </li>
        <li>
          <strong>Aggregate counters</strong> — how many times a page was viewed, per day, as a
          number. No IP address, no cookie, no user or session identifier is attached, so the
          result cannot be traced back to a person.
        </li>
        <li>
          <strong>Error reports</strong> — when the site crashes in your browser, the error message
          and stack are logged so we can fix it. No IP address or account id is attached.
        </li>
        <li>
          <strong>Public blockchain data</strong> — wallet addresses, orders and trades are public
          by design. We do not control them, and they cannot be deleted by us or by anyone else.
        </li>
      </ul>
      <p>
        We do <strong>not</strong> build analytics or advertising profiles, we do not fingerprint
        browsers, and we never ask for a seed phrase or private key — because we never hold one.
      </p>

      <h2>Who else sees it</h2>
      <ul>
        <li>
          <strong>Hosting and CDN</strong> — our server (EU) and Cloudflare, which terminates TLS
          and forwards requests. Both see the request itself, as any host does.
        </li>
        <li>
          <strong>Blockchain RPC provider</strong> — the browser reads market and wallet data from
          Alchemy, so it sees your IP address and user-agent when it answers.
        </li>
        <li>
          <strong>GIPHY</strong> — if you open the GIF picker in a comment box, your browser asks
          api.giphy.com for search results (sending the search term, your IP address and
          user-agent), and comments containing a GIF load it from media.giphy.com. Nothing is sent
          unless a GIF is searched for or shown. Their terms: giphy.com/privacy.
        </li>
        <li>
          <strong>WalletConnect / Reown</strong> — only if you connect a mobile wallet that way;
          the relay forwards the connection. We never see your keys.
        </li>
      </ul>
      <p>We do not sell data and we do not share it for marketing.</p>

      <h2>Why we process it (legal bases)</h2>
      <ul>
        <li>Account, session and comment data: performance of a contract, Art. 6(1)(b) GDPR.</li>
        <li>Rate-limit counters and error reports: legitimate interest in keeping the site up and
          stopping abuse, Art. 6(1)(f) GDPR.</li>
        <li>Aggregate page counts: legitimate interest, and anonymous by construction.</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        Account data and comments are deleted when you delete your account. Sessions expire after
        30 days of inactivity. Rate-limit counters live in memory and disappear on restart. Error
        reports are kept for 90 days. Aggregate counters contain nothing personal, so there is
        nothing to expire.
      </p>

      <h2>Your rights</h2>
      <p>
        You can access, correct, export or delete your data from the account page, or by emailing{" "}
        <a href="mailto:contact@willthegavlegoatburn.com">contact@willthegavlegoatburn.com</a>. You
        may also object to processing or lodge a complaint with the Dutch supervisory authority, the{" "}
        <em>Autoriteit Persoonsgegevens</em>.
      </p>

      <h2>Security</h2>
      <p>
        Passwords are hashed with scrypt, session tokens are stored only as SHA-256 hashes and are
        sent in an httpOnly cookie, the database is not reachable from the internet, and access is
        limited to the minimum necessary. If a breach affects your data, we will notify you and the
        Autoriteit Persoonsgegevens within 72 hours where the law requires it.
      </p>

      <h2>Cookies and local storage</h2>
      <p>
        We set one essential cookie for your login session, plus a small record in your browser
        when you create a passkey. No tracking cookies, no advertising, so no consent banner. See
        the <a href="/cookies">cookie statement</a>.
      </p>
    </LegalShell>
  );
}
