import { cache } from "react";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { newToken, sha256 } from "./crypto";
import { sql } from "./db";

const COOKIE = "lb_session";
const SESSION_DAYS = 30;

export type User = {
  id: string;
  email: string;
  name: string | null;
  email_verified_at: string | null;
  reveal_blocked_until: string | null;
  role: string;
  suspended_at: string | null;
  password_hash: string;
};

export async function createSession(userId: string) {
  const token = newToken();
  const ua = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  await sql`INSERT INTO sessions (id, user_id, expires_at, user_agent)
    VALUES (${sha256(token)}, ${userId}, now() + make_interval(days => ${SESSION_DAYS}), ${ua})`;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await sql`DELETE FROM sessions WHERE id = ${sha256(token)}`;
  jar.delete(COOKIE);
}

export const getUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const rows = await sql<User>`
    SELECT u.id, u.email, u.name, u.email_verified_at, u.reveal_blocked_until, u.role, u.suspended_at, u.password_hash
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.id = ${sha256(token)} AND s.expires_at > now() AND u.suspended_at IS NULL`;
  return rows[0] ?? null;
});

export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function logEvent(userId: string, type: string, meta?: Record<string, unknown>) {
  await sql`INSERT INTO events (user_id, type, meta) VALUES (${userId}, ${type}, ${meta ? JSON.stringify(meta) : null}::jsonb)`;
}

export function isAdmin(user: Pick<User, "role" | "email" | "email_verified_at">): boolean {
  if (user.role === "admin") return true;
  const list = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return !!user.email_verified_at && list.includes(user.email.toLowerCase());
}

/** 404s for non-admins so the admin area is not discoverable. */
export async function requireAdmin(): Promise<User> {
  const user = await getUser();
  if (!user || !isAdmin(user)) notFound();
  return user;
}
