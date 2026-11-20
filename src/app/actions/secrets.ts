"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logEvent, requireUser } from "@/lib/auth";
import { decryptSecret, encryptSecret, verifyPassword } from "@/lib/crypto";
import { sql } from "@/lib/db";
import { allow } from "@/lib/ratelimit";
import type { State } from "./auth";

const MIN_MINUTES = 5;
const MAX_MINUTES = 365 * 1440;
const MAX_SECRETS = 100;
const uuid = z.string().uuid();
const minutes = z.coerce.number().int().min(MIN_MINUTES, "Lock for at least 5 minutes").max(MAX_MINUTES, "Maximum lock is 365 days");
const MAX_RETRIEVAL_MINUTES = 120;
const retrieval = z.coerce.number().int().min(0).max(MAX_RETRIEVAL_MINUTES, "Retrieval task can be at most 2 hours").default(0);

async function needsPasskey(userId: string, retrievalMinutes: number): Promise<string | null> {
  if (retrievalMinutes <= 0) return null;
  const [{ n }] = await sql<{ n: number }>`SELECT count(*)::int AS n FROM passkeys WHERE user_id = ${userId}`;
  return n ? null : "Add a passkey in Settings before using a retrieval task";
}

export async function createSecret(_: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  const parsed = z
    .object({
      label: z.string().trim().min(1, "Give it a name").max(80),
      kind: z.enum(["screentime", "password", "pin", "note"]),
      value: z.string().min(1, "Enter the secret").max(2000),
      minutes,
      retrieval,
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const [{ n }] = await sql<{ n: number }>`SELECT count(*)::int AS n FROM secrets WHERE user_id = ${user.id}`;
  if (n >= MAX_SECRETS) return { error: `Limit of ${MAX_SECRETS} secrets reached` };
  const noKey = await needsPasskey(user.id, parsed.data.retrieval);
  if (noKey) return { error: noKey };

  const id = crypto.randomUUID();
  const payload = encryptSecret(parsed.data.value, user.id, id);
  await sql`INSERT INTO secrets (id, user_id, label, kind, payload, unlock_at, retrieval_seconds)
    VALUES (${id}, ${user.id}, ${parsed.data.label}, ${parsed.data.kind}, ${payload},
      now() + make_interval(mins => ${parsed.data.minutes}), ${parsed.data.retrieval * 60})`;
  await logEvent(user.id, "secret_locked", {
    id, label: parsed.data.label, minutes: parsed.data.minutes, retrieval: parsed.data.retrieval,
  });
  redirect(`/vault/${id}`);
}

/** Generates a random 4-digit Screen Time code, locks it, and returns it once for guided entry. */
export async function createGuidedSecret(fd: FormData): Promise<{ error: string } | { id: string; code: string }> {
  const user = await requireUser();
  const parsed = z
    .object({ label: z.string().trim().min(1, "Give it a name").max(80), minutes, retrieval })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const [{ n }] = await sql<{ n: number }>`SELECT count(*)::int AS n FROM secrets WHERE user_id = ${user.id}`;
  if (n >= MAX_SECRETS) return { error: `Limit of ${MAX_SECRETS} secrets reached` };
  const noKey = await needsPasskey(user.id, parsed.data.retrieval);
  if (noKey) return { error: noKey };

  const id = crypto.randomUUID();
  const code = String(randomInt(0, 10000)).padStart(4, "0");
  const payload = encryptSecret(code, user.id, id);
  await sql`INSERT INTO secrets (id, user_id, label, kind, payload, unlock_at, retrieval_seconds)
    VALUES (${id}, ${user.id}, ${parsed.data.label}, 'screentime', ${payload},
      now() + make_interval(mins => ${parsed.data.minutes}), ${parsed.data.retrieval * 60})`;
  await logEvent(user.id, "secret_locked", {
    id, label: parsed.data.label, minutes: parsed.data.minutes, retrieval: parsed.data.retrieval, guided: true,
  });
  return { id, code };
}

/** Adds time to the lock. Time can only be added, never removed. */
export async function extendLock(_: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  const parsed = z.object({ id: uuid, minutes }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const rows = await sql`
    UPDATE secrets SET unlock_at = GREATEST(unlock_at, now()) + make_interval(mins => ${parsed.data.minutes}),
      updated_at = now()
    WHERE id = ${parsed.data.id} AND user_id = ${user.id}
      AND GREATEST(unlock_at, now()) + make_interval(mins => ${parsed.data.minutes}) <= now() + make_interval(mins => ${MAX_MINUTES})
    RETURNING id`;
  if (!rows.length) return { error: "Lock can't exceed 365 days from now" };
  await logEvent(user.id, "lock_extended", { id: parsed.data.id, minutes: parsed.data.minutes });
  revalidatePath(`/vault/${parsed.data.id}`);
  return { ok: "Lock extended." };
}

export async function renameSecret(_: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  const parsed = z.object({ id: uuid, label: z.string().trim().min(1).max(80) }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Enter a name" };
  await sql`UPDATE secrets SET label = ${parsed.data.label}, updated_at = now()
    WHERE id = ${parsed.data.id} AND user_id = ${user.id}`;
  revalidatePath(`/vault/${parsed.data.id}`);
  return { ok: "Renamed." };
}

export async function revealSecret(_: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  const parsed = z.object({ id: uuid, password: z.string().min(1).max(200) }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Enter your password" };
  if (!(await allow(`reveal:${user.id}`, 10, 900))) return { error: "Too many attempts. Try again in 15 minutes." };
  if (!(await verifyPassword(parsed.data.password, user.password_hash))) {
    await logEvent(user.id, "reveal_bad_password", { id: parsed.data.id });
    return { error: "Wrong password" };
  }
  if (user.reveal_blocked_until && new Date(user.reveal_blocked_until) > new Date())
    return {
      error: `Reveals are paused after a password change until ${new Date(user.reveal_blocked_until).toUTCString()}.`,
    };

  const [s] = await sql<{ id: string; payload: string; unlock_at: string; retrieval_seconds: number }>`
    SELECT id, payload, unlock_at, retrieval_seconds FROM secrets WHERE id = ${parsed.data.id} AND user_id = ${user.id}`;
  if (!s) return { error: "Not found" };
  if (new Date(s.unlock_at) > new Date()) return { error: "Still locked" };

  let retrievalId: string | undefined;
  if (s.retrieval_seconds > 0) {
    const [done] = await sql<{ id: string }>`
      SELECT id FROM retrievals
      WHERE secret_id = ${s.id} AND user_id = ${user.id} AND state = 'done' AND completed_at > now() - interval '10 minutes'
      ORDER BY completed_at DESC LIMIT 1`;
    if (!done) return { error: "Finish the retrieval task first" };
    retrievalId = done.id;
  }

  let value: string;
  try {
    value = decryptSecret(s.payload, user.id, s.id);
  } catch {
    return { error: "Couldn't decrypt. Check ENCRYPTION_KEY." };
  }
  if (retrievalId) await sql`UPDATE retrievals SET state = 'used' WHERE id = ${retrievalId}`;
  await sql`UPDATE secrets SET reveal_count = reveal_count + 1, last_revealed_at = now() WHERE id = ${s.id}`;
  await logEvent(user.id, "secret_revealed", { id: s.id });
  return { value };
}

export async function deleteSecret(_: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  const parsed = z.object({ id: uuid, password: z.string().min(1).max(200) }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Enter your password" };
  if (!(await allow(`reveal:${user.id}`, 10, 900))) return { error: "Too many attempts. Try again in 15 minutes." };
  if (!(await verifyPassword(parsed.data.password, user.password_hash))) return { error: "Wrong password" };
  const rows = await sql`DELETE FROM secrets
    WHERE id = ${parsed.data.id} AND user_id = ${user.id} AND unlock_at <= now() RETURNING id`;
  if (!rows.length) return { error: "Locked secrets can't be deleted until they unlock" };
  await logEvent(user.id, "secret_deleted", { id: parsed.data.id });
  redirect("/vault");
}
