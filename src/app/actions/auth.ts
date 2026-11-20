"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  clientIp,
  createSession,
  destroySession,
  getUser,
  logEvent,
  requireUser,
} from "@/lib/auth";
import { fakeVerify, hashPassword, newToken, sha256, verifyPassword } from "@/lib/crypto";
import { sql } from "@/lib/db";
import { appUrl, resetMail, sendMail, verifyMail } from "@/lib/mail";
import { allow } from "@/lib/ratelimit";

export type State = { error?: string; ok?: string; value?: string } | undefined;

const email = z.string().trim().toLowerCase().email("Enter a valid email").max(254);
const password = z.string().min(10, "Use at least 10 characters").max(200);
const COOLDOWN_HOURS = 24;

const first = (e: z.ZodError) => e.issues[0]?.message ?? "Invalid input";

async function sendVerification(userId: string, to: string) {
  const token = newToken();
  await sql`DELETE FROM auth_tokens WHERE user_id = ${userId} AND kind = 'verify'`;
  await sql`INSERT INTO auth_tokens (token_hash, user_id, kind, expires_at)
    VALUES (${sha256(token)}, ${userId}, 'verify', now() + interval '2 days')`;
  await sendMail(verifyMail(to, `${appUrl()}/verify?token=${token}`));
}

export async function register(_: State, fd: FormData): Promise<State> {
  const parsed = z
    .object({ email, password, name: z.string().trim().max(80).optional() })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: first(parsed.error) };
  if (!(await allow(`register:${await clientIp()}`, 5, 3600))) return { error: "Too many attempts. Try later." };

  const { email: addr, password: pw, name } = parsed.data;
  const exists = await sql`SELECT 1 FROM users WHERE email = ${addr}`;
  if (exists.length) return { error: "An account with that email already exists" };

  const [user] = await sql<{ id: string }>`
    INSERT INTO users (email, name, password_hash)
    VALUES (${addr}, ${name || null}, ${await hashPassword(pw)}) RETURNING id`;
  await logEvent(user.id, "account_created");
  await createSession(user.id);
  try {
    await sendVerification(user.id, addr);
  } catch (e) {
    console.error(e);
  }
  redirect("/vault");
}

export async function login(_: State, fd: FormData): Promise<State> {
  const parsed = z.object({ email, password: z.string().min(1).max(200) }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Enter your email and password" };
  const { email: addr, password: pw } = parsed.data;

  const ip = await clientIp();
  if (!(await allow(`login:ip:${ip}`, 30, 900)) || !(await allow(`login:email:${addr}`, 10, 900)))
    return { error: "Too many attempts. Try again in 15 minutes." };

  const [user] = await sql<{ id: string; password_hash: string; suspended_at: string | null }>`
    SELECT id, password_hash, suspended_at FROM users WHERE email = ${addr}`;
  if (!user) {
    await fakeVerify(pw);
    return { error: "Wrong email or password" };
  }
  if (!(await verifyPassword(pw, user.password_hash))) {
    await logEvent(user.id, "login_failed");
    return { error: "Wrong email or password" };
  }
  if (user.suspended_at) return { error: "This account is suspended. Contact the administrator." };
  await createSession(user.id);
  await logEvent(user.id, "login");
  redirect("/vault");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

export async function forgotPassword(_: State, fd: FormData): Promise<State> {
  const parsed = z.object({ email }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: first(parsed.error) };
  const addr = parsed.data.email;
  const msg = { ok: "If that account exists, a reset link is on its way." };
  if (!(await allow(`forgot:ip:${await clientIp()}`, 10, 3600)) || !(await allow(`forgot:email:${addr}`, 3, 3600)))
    return msg;

  const [user] = await sql<{ id: string }>`SELECT id FROM users WHERE email = ${addr}`;
  if (user) {
    const token = newToken();
    await sql`DELETE FROM auth_tokens WHERE user_id = ${user.id} AND kind = 'reset'`;
    await sql`INSERT INTO auth_tokens (token_hash, user_id, kind, expires_at)
      VALUES (${sha256(token)}, ${user.id}, 'reset', now() + interval '1 hour')`;
    try {
      await sendMail(resetMail(addr, `${appUrl()}/reset?token=${token}`));
    } catch (e) {
      console.error(e);
    }
    await logEvent(user.id, "reset_requested");
  }
  return msg;
}

export async function resetPassword(_: State, fd: FormData): Promise<State> {
  const parsed = z
    .object({ token: z.string().min(10).max(100), password, confirm: z.string() })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: first(parsed.error) };
  if (parsed.data.password !== parsed.data.confirm) return { error: "Passwords don't match" };
  if (!(await allow(`reset:ip:${await clientIp()}`, 10, 3600))) return { error: "Too many attempts. Try later." };

  const hash = sha256(parsed.data.token);
  const [t] = await sql<{ user_id: string }>`
    UPDATE auth_tokens SET used_at = now()
    WHERE token_hash = ${hash} AND kind = 'reset' AND used_at IS NULL AND expires_at > now()
    RETURNING user_id`;
  if (!t) return { error: "This link is invalid or expired. Request a new one." };

  await sql`UPDATE users SET password_hash = ${await hashPassword(parsed.data.password)},
    reveal_blocked_until = now() + make_interval(hours => ${COOLDOWN_HOURS})
    WHERE id = ${t.user_id}`;
  await sql`DELETE FROM sessions WHERE user_id = ${t.user_id}`;
  await logEvent(t.user_id, "password_reset");
  redirect("/login?reset=1");
}

export async function verifyEmail(_: State, fd: FormData): Promise<State> {
  const token = String(fd.get("token") ?? "");
  const [t] = await sql<{ user_id: string }>`
    UPDATE auth_tokens SET used_at = now()
    WHERE token_hash = ${sha256(token)} AND kind = 'verify' AND used_at IS NULL AND expires_at > now()
    RETURNING user_id`;
  if (!t) return { error: "This link is invalid or expired." };
  await sql`UPDATE users SET email_verified_at = now() WHERE id = ${t.user_id}`;
  await logEvent(t.user_id, "email_verified");
  return { ok: "Email confirmed." };
}

export async function resendVerification(): Promise<State> {
  const user = await requireUser();
  if (user.email_verified_at) return { ok: "Already confirmed." };
  if (!(await allow(`verify:${user.id}`, 3, 3600))) return { error: "Try again later." };
  await sendVerification(user.id, user.email);
  return { ok: "Confirmation email sent." };
}

export async function changePassword(_: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  const parsed = z
    .object({ current: z.string().min(1), password, confirm: z.string() })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: first(parsed.error) };
  if (parsed.data.password !== parsed.data.confirm) return { error: "Passwords don't match" };
  if (!(await allow(`pwchange:${user.id}`, 5, 900))) return { error: "Too many attempts. Try later." };
  if (!(await verifyPassword(parsed.data.current, user.password_hash))) return { error: "Current password is wrong" };

  await sql`UPDATE users SET password_hash = ${await hashPassword(parsed.data.password)},
    reveal_blocked_until = now() + make_interval(hours => ${COOLDOWN_HOURS}) WHERE id = ${user.id}`;
  await logEvent(user.id, "password_changed");
  return { ok: `Password changed. Secret reveals are paused for ${COOLDOWN_HOURS} hours.` };
}

export async function signOutEverywhere(): Promise<void> {
  const user = await requireUser();
  await sql`DELETE FROM sessions WHERE user_id = ${user.id}`;
  await logEvent(user.id, "signed_out_everywhere");
  redirect("/login");
}

export async function deleteAccount(_: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!(await allow(`delete:${user.id}`, 5, 900))) return { error: "Too many attempts. Try later." };
  if (!(await verifyPassword(String(fd.get("password") ?? ""), user.password_hash)))
    return { error: "Password is wrong" };
  const [locked] = await sql<{ n: number }>`
    SELECT count(*)::int AS n FROM secrets WHERE user_id = ${user.id} AND unlock_at > now()`;
  if (locked.n > 0) return { error: "Locked secrets exist. Wait for every lock to expire before deleting your account." };
  await sql`DELETE FROM users WHERE id = ${user.id}`;
  await destroySession();
  redirect("/");
}

export async function currentUserOrNull() {
  return getUser();
}
