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

-- Added after the first release: accounts now have a public username. Kept as a
-- separate ALTER so existing rows survive.
alter table users add column if not exists username text;
create unique index if not exists users_username_lower_idx on users (lower(username));

-- Positions are mirrored from the chain by the indexer. Until that exists every
-- row here is zero, which is the truthful answer: nobody holds shares yet.
create table if not exists positions (
  user_id    uuid primary key references users(id) on delete cascade,
  yes_shares numeric not null default 0,
  no_shares  numeric not null default 0,
  updated_at timestamptz not null default now()
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

-- Public comments. Cascade on user delete: the privacy statement promises that
-- deleting an account removes its data, so comments must go with it.
create table if not exists comments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  body       text not null,
  hidden     boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists comments_created_at_idx on comments (created_at desc);

-- Real price history. Written by /api/market at most once a minute; the chart
-- reads straight from this, so it is measured rather than invented.
create table if not exists price_points (
  id    bigserial primary key,
  price numeric not null,
  at    timestamptz not null default now()
);

create index if not exists price_points_at_idx on price_points (at desc);

-- One row per OrderFilled event, so the site can show real trades instead of
-- scanning logs on every page load (Alchemy's free tier allows only 10 blocks
-- per eth_getLogs call, which is why this is filled in by the incremental scan).
create table if not exists fills (
  id          int primary key default 1 check (id = 1),
  last_block  bigint not null default 0,
  updated_at  timestamptz not null default now()
);

create table if not exists trades (
  block       bigint not null,
  log_index   int not null,
  order_id    bigint not null,
  taker       text not null,
  shares      numeric not null,
  usdc        numeric not null,
  at          timestamptz not null default now(),
  primary key (block, log_index)
);

create index if not exists trades_block_idx on trades (block desc);

-- Anyone who has ever placed an order or filled one. Counts a maker as a trader,
-- which the OrderFilled-only count missed entirely.
create table if not exists participants (
  address    text primary key,
  first_seen timestamptz not null default now()
);
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
