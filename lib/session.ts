import { hashToken, newToken, readToken } from "./auth";
import { ensureSchema, getPool } from "./db";
import { clientIp } from "./httpx";

export type SessionUser = { id: string; email: string; username: string | null; createdAt: string };

export async function createSession(userId: string, req: Request): Promise<string | null> {
  if (!(await ensureSchema())) return null;
  const pool = getPool();
  if (!pool) return null;

  const token = newToken();
  await pool.query(
    `insert into sessions (token_hash, user_id, user_agent, ip)
     values ($1, $2, $3, $4)`,
    [
      hashToken(token),
      userId,
      (req.headers.get("user-agent") ?? "").slice(0, 300),
      clientIp(req).slice(0, 64),
    ],
  );
  return token;
}

export async function sessionUser(req: Request): Promise<SessionUser | null> {
  const token = readToken(req);
  if (!token) return null;
  if (!(await ensureSchema())) return null;

  const pool = getPool();
  if (!pool) return null;

  const tokenHash = hashToken(token);
  const { rows } = await pool.query(
    `select u.id, u.email, u.username, u.created_at
       from sessions s
       join users u on u.id = s.user_id
      where s.token_hash = $1
        and s.last_seen > now() - interval '30 days'`,
    [tokenHash],
  );

  if (rows.length === 0) return null;

  // Sliding expiry; failure here must not break the request.
  pool
    .query(`update sessions set last_seen = now() where token_hash = $1`, [tokenHash])
    .catch(() => {});

  return {
    id: rows[0].id as string,
    email: rows[0].email as string,
    username: (rows[0].username as string | null) ?? null,
    createdAt: (rows[0].created_at as Date).toISOString(),
  };
}

export async function destroySession(req: Request): Promise<void> {
  const token = readToken(req);
  if (!token) return;
  const pool = getPool();
  if (!pool) return;
  await pool
    .query(`delete from sessions where token_hash = $1`, [hashToken(token)])
    .catch(() => {});
}

export async function destroyAllSessions(userId: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(`delete from sessions where user_id = $1`, [userId]).catch(() => {});
}

export async function countSessions(userId: string): Promise<number> {
  const pool = getPool();
  if (!pool) return 0;
  const { rows } = await pool
    .query(`select count(*)::int as n from sessions where user_id = $1`, [userId])
    .catch(() => ({ rows: [{ n: 0 }] }));
  return (rows[0]?.n as number) ?? 0;
}
export type SessionRow = {
  sid: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastSeen: string;
  current: boolean;
};

/** Stable public id of the session making this request. */
export async function currentSid(req: Request): Promise<string | null> {
  const token = readToken(req);
  if (!token) return null;
  const pool = getPool();
  if (!pool) return null;
  const { rows } = await pool
    .query(`select sid from sessions where token_hash = $1`, [hashToken(token)])
    .catch(() => ({ rows: [] as { sid: string }[] }));
  return (rows[0]?.sid as string) ?? null;
}

export async function listSessions(userId: string, sid: string | null): Promise<SessionRow[]> {
  const pool = getPool();
  if (!pool) return [];
  const { rows } = await pool
    .query(
      `select sid, user_agent, ip, created_at, last_seen
         from sessions where user_id = $1
        order by last_seen desc limit 25`,
      [userId],
    )
    .catch(() => ({ rows: [] as Record<string, unknown>[] }));
  return rows.map((r) => ({
    sid: String(r.sid),
    userAgent: (r.user_agent as string | null) ?? null,
    ip: (r.ip as string | null) ?? null,
    createdAt: (r.created_at as Date).toISOString(),
    lastSeen: (r.last_seen as Date).toISOString(),
    current: sid !== null && String(r.sid) === sid,
  }));
}

export async function revokeSession(userId: string, sid: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(`delete from sessions where user_id = $1 and sid = $2`, [userId, sid]).catch(() => {});
}

export async function revokeOtherSessions(userId: string, sid: string | null): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  if (sid === null) {
    await destroyAllSessions(userId);
    return;
  }
  await pool
    .query(`delete from sessions where user_id = $1 and sid <> $2`, [userId, sid])
    .catch(() => {});
}