import { sql } from "./db";

/** Returns true if the action is allowed, and records it. */
export async function allow(key: string, limit: number, windowSec: number): Promise<boolean> {
  const [row] = await sql<{ n: number }>`
    SELECT count(*)::int AS n FROM rate_limits
    WHERE key = ${key} AND created_at > now() - make_interval(secs => ${windowSec})`;
  if (row.n >= limit) return false;
  await sql`INSERT INTO rate_limits (key) VALUES (${key})`;
  if (Math.random() < 0.02) await sql`DELETE FROM rate_limits WHERE created_at < now() - interval '1 day'`;
  return true;
}
