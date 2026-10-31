import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Notification signups.
 *
 * Deliberately boring: append-only JSONL on a mounted volume, so it survives
 * container restarts and can be copied off the box with `scp`.
 *
 * When the Postgres service is added, swap the implementation here — the route
 * handler does not need to change.
 */

const STORE =
  process.env.NOTIFY_STORE_PATH ?? path.join(process.cwd(), "data", "notify.jsonl");

export type AddResult = "added" | "duplicate";

export async function addSubscriber(email: string): Promise<AddResult> {
  await mkdir(path.dirname(STORE), { recursive: true });

  const existing = await readFile(STORE, "utf8").catch(() => "");
  // Crude but adequate at this scale: exact match on the quoted value.
  if (existing.includes(`"${email}"`)) return "duplicate";

  const line = JSON.stringify({ email, at: new Date().toISOString() }) + "\n";
  await appendFile(STORE, line, "utf8");
  return "added";
}

export async function subscriberCount(): Promise<number> {
  const raw = await readFile(STORE, "utf8").catch(() => "");
  return raw.split("\n").filter(Boolean).length;
}
