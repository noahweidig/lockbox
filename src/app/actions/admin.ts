"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logEvent, requireAdmin } from "@/lib/auth";
import { encryptSecret, newToken, sha256 } from "@/lib/crypto";
import { sql } from "@/lib/db";
import { appUrl, resetMail, sendMail } from "@/lib/mail";
import type { State } from "./auth";

const uuid = z.string().uuid();
const MAX_MINUTES = 365 * 1440;
const err = (e: z.ZodError) => ({ error: e.issues[0]?.message ?? "Invalid input" });

async function audit(adminEmail: string, userId: string, type: string, meta: Record<string, unknown> = {}) {
  await logEvent(userId, type, { by: adminEmail, ...meta });
}

function refresh(userId: string) {
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

export async function adminUpdateUser(_: State, fd: FormData): Promise<State> {
  const admin = await requireAdmin();
  const p = z
    .object({
      id: uuid,
      name: z.string().trim().max(80),
      email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return err(p.error);
  const clash = await sql`SELECT 1 FROM users WHERE email = ${p.data.email} AND id <> ${p.data.id}`;
  if (clash.length) return { error: "Another account uses that email" };
  await sql`UPDATE users SET name = ${p.data.name || null}, email = ${p.data.email} WHERE id = ${p.data.id}`;
  await audit(admin.email, p.data.id, "admin_profile_updated");
  refresh(p.data.id);
  return { ok: "Saved." };
}

export async function adminToggle(_: State, fd: FormData): Promise<State> {
  const admin = await requireAdmin();
  const p = z
    .object({ id: uuid, action: z.enum(["verify", "unverify", "suspend", "unsuspend", "promote", "demote", "clear_cooldown", "sign_out"]) })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return err(p.error);
  const { id, action } = p.data;
  const self = id === admin.id;
  if (self && ["suspend", "demote"].includes(action)) return { error: "You can't do that to your own account" };

  switch (action) {
    case "verify": await sql`UPDATE users SET email_verified_at = now() WHERE id = ${id}`; break;
    case "unverify": await sql`UPDATE users SET email_verified_at = NULL WHERE id = ${id}`; break;
    case "suspend":
      await sql`UPDATE users SET suspended_at = now() WHERE id = ${id}`;
      await sql`DELETE FROM sessions WHERE user_id = ${id}`;
      break;
    case "unsuspend": await sql`UPDATE users SET suspended_at = NULL WHERE id = ${id}`; break;
    case "promote": await sql`UPDATE users SET role = 'admin' WHERE id = ${id}`; break;
    case "demote": await sql`UPDATE users SET role = 'user' WHERE id = ${id}`; break;
    case "clear_cooldown": await sql`UPDATE users SET reveal_blocked_until = NULL WHERE id = ${id}`; break;
    case "sign_out": await sql`DELETE FROM sessions WHERE user_id = ${id}`; break;
  }
  await audit(admin.email, id, `admin_${action}`);
  refresh(id);
  return { ok: "Done." };
}

export async function adminSendReset(_: State, fd: FormData): Promise<State> {
  const admin = await requireAdmin();
  const p = z.object({ id: uuid }).safeParse(Object.fromEntries(fd));
  if (!p.success) return err(p.error);
  const [u] = await sql<{ email: string }>`SELECT email FROM users WHERE id = ${p.data.id}`;
  if (!u) return { error: "User not found" };
  const token = newToken();
  await sql`DELETE FROM auth_tokens WHERE user_id = ${p.data.id} AND kind = 'reset'`;
  await sql`INSERT INTO auth_tokens (token_hash, user_id, kind, expires_at)
    VALUES (${sha256(token)}, ${p.data.id}, 'reset', now() + interval '1 hour')`;
  try {
    await sendMail(resetMail(u.email, `${appUrl()}/reset?token=${token}`));
  } catch {
    return { error: "Email failed to send. Check RESEND_API_KEY." };
  }
  await audit(admin.email, p.data.id, "admin_reset_sent");
  return { ok: `Reset email sent to ${u.email}.` };
}

export async function adminDeleteUser(_: State, fd: FormData): Promise<State> {
  const admin = await requireAdmin();
  const p = z.object({ id: uuid, confirm: z.string() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return err(p.error);
  if (p.data.id === admin.id) return { error: "You can't delete your own account here" };
  const [u] = await sql<{ email: string }>`SELECT email FROM users WHERE id = ${p.data.id}`;
  if (!u) return { error: "User not found" };
  if (p.data.confirm.trim().toLowerCase() !== u.email) return { error: "Type the user's email to confirm" };
  await sql`DELETE FROM users WHERE id = ${p.data.id}`;
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

/** Sets a secret's lock to N minutes from now. 0 unlocks immediately. Admin may shorten. */
export async function adminSetLock(_: State, fd: FormData): Promise<State> {
  const admin = await requireAdmin();
  const p = z
    .object({ id: uuid, minutes: z.coerce.number().int().min(0).max(MAX_MINUTES, "Maximum is 365 days") })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return err(p.error);
  const [s] = await sql<{ user_id: string }>`
    UPDATE secrets SET unlock_at = now() + make_interval(mins => ${p.data.minutes}), updated_at = now()
    WHERE id = ${p.data.id} RETURNING user_id`;
  if (!s) return { error: "Secret not found" };
  await audit(admin.email, s.user_id, "admin_lock_set", { id: p.data.id, minutes: p.data.minutes });
  refresh(s.user_id);
  return { ok: p.data.minutes === 0 ? "Unlocked." : "Lock updated." };
}

export async function adminRenameSecret(_: State, fd: FormData): Promise<State> {
  const admin = await requireAdmin();
  const p = z.object({ id: uuid, label: z.string().trim().min(1).max(80) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Enter a name" };
  const [s] = await sql<{ user_id: string }>`
    UPDATE secrets SET label = ${p.data.label}, updated_at = now() WHERE id = ${p.data.id} RETURNING user_id`;
  if (!s) return { error: "Secret not found" };
  await audit(admin.email, s.user_id, "admin_secret_renamed", { id: p.data.id });
  refresh(s.user_id);
  return { ok: "Renamed." };
}

export async function adminDeleteSecret(_: State, fd: FormData): Promise<State> {
  const admin = await requireAdmin();
  const p = z.object({ id: uuid }).safeParse(Object.fromEntries(fd));
  if (!p.success) return err(p.error);
  const [s] = await sql<{ user_id: string }>`DELETE FROM secrets WHERE id = ${p.data.id} RETURNING user_id`;
  if (!s) return { error: "Secret not found" };
  await audit(admin.email, s.user_id, "admin_secret_deleted", { id: p.data.id });
  refresh(s.user_id);
  return { ok: "Deleted." };
}

/** Replaces a secret's value. The admin never reads the old value. */
export async function adminReplaceSecret(_: State, fd: FormData): Promise<State> {
  const admin = await requireAdmin();
  const p = z.object({ id: uuid, value: z.string().min(1).max(2000) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Enter a new value" };
  const [s] = await sql<{ user_id: string }>`SELECT user_id FROM secrets WHERE id = ${p.data.id}`;
  if (!s) return { error: "Secret not found" };
  const payload = encryptSecret(p.data.value, s.user_id, p.data.id);
  await sql`UPDATE secrets SET payload = ${payload}, updated_at = now() WHERE id = ${p.data.id}`;
  await audit(admin.email, s.user_id, "admin_secret_replaced", { id: p.data.id });
  refresh(s.user_id);
  return { ok: "Value replaced." };
}
