import { Pool } from "pg";

/**
 * Postgres access.
 *
 * Deliberately lazy: if DATABASE_URL is missing or the database is unreachable,
 * every auth route degrades to 503 instead of taking the whole site down. The
 * public market pages must never depend on this working.
 */

let pool: Pool | null = null;
let initPromise: Promise<boolean> | null = null;

const SCHEMA = `
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

create table if not exists sessions (
  token_hash text primary key,
  user_id    uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  user_agent text,
  ip         text
);

create index if not exists sessions_user_id_idx on sessions (user_id);

-- One-time recovery codes. Password-equivalent, so they are stored as an
-- HMAC over a server-side pepper: a database dump alone is not enough to use them.
create table if not exists recovery_codes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  code_hash  text not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists recovery_codes_user_id_idx on recovery_codes (user_id);
`;

export function getPool(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;

  if (!pool) {
    pool = new Pool({
      connectionString: url,
      max: 5,
      connectionTimeoutMillis: 4000,
      idleTimeoutMillis: 30_000,
    });
    // An idle client error must never crash the Next server.
    pool.on("error", () => {});
  }
  return pool;
}

/** Creates tables on first successful connection. Safe to call on every request. */
export async function ensureSchema(): Promise<boolean> {
  if (!initPromise) {
    initPromise = (async () => {
      const p = getPool();
      if (!p) return false;
      try {
        await p.query(SCHEMA);
        return true;
      } catch {
        initPromise = null; // allow a retry on the next request
        return false;
      }
    })();
  }
  return initPromise;
}

export async function dbReady(): Promise<boolean> {
  return ensureSchema();
}
