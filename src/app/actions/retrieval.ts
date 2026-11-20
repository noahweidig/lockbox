"use server";

import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import type { AuthenticationResponseJSON, PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/server";
import { z } from "zod";
import { logEvent, requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { checkPassword } from "@/lib/guard";
import { allow } from "@/lib/ratelimit";
import { authOptions, PASSKEY_COOLDOWN_HOURS, rpFromHeaders, verifyAuth, type StoredPasskey } from "@/lib/webauthn";

const CHECK_WINDOW_SECONDS = 45;
const nextDelaySeconds = () => randomInt(90, 241);
const uuid = z.string().uuid();

type Row = {
  id: string;
  state: "active" | "done" | "failed" | "used";
  required_seconds: number;
  checks_passed: number;
  challenge: string | null;
  elapsed_ms: number;
  deadline_ms: number | null;
  time_up: boolean;
  check_due: boolean;
  check_expired: boolean;
};

export type RetrievalStatus =
  | { error: string }
  | {
      state: Row["state"];
      elapsedMs: number;
      requiredMs: number;
      checks: number;
      check?: { options: PublicKeyCredentialRequestOptionsJSON; deadlineMs: number };
    };

const load = async (userId: string, id: string) =>
  (
    await sql<Row>`
      SELECT id, state, required_seconds, checks_passed, challenge,
        least(extract(epoch FROM now() - started_at) * 1000, 86400000)::int AS elapsed_ms,
        (extract(epoch FROM challenge_deadline - now()) * 1000)::int AS deadline_ms,
        now() >= started_at + make_interval(secs => required_seconds) AS time_up,
        now() >= next_check_at AS check_due,
        challenge_deadline IS NOT NULL AND challenge_deadline < now() AS check_expired
      FROM retrievals WHERE id = ${id} AND user_id = ${userId}`
  )[0];

const activePasskeys = (userId: string) =>
  sql<StoredPasskey>`
    SELECT id, public_key, counter, transports FROM passkeys
    WHERE user_id = ${userId} AND created_at <= now() - make_interval(hours => ${PASSKEY_COOLDOWN_HOURS})`;

async function failMissed(userId: string, id: string) {
  const rows = await sql`UPDATE retrievals SET state = 'failed'
    WHERE id = ${id} AND state = 'active' AND challenge IS NOT NULL AND challenge_deadline < now() RETURNING id`;
  if (rows.length) await logEvent(userId, "retrieval_failed", { id, reason: "missed_check_in" });
}

export async function startRetrieval(secretId: string, password: string): Promise<{ error: string } | { id: string }> {
  const user = await requireUser();
  if (!uuid.safeParse(secretId).success) return { error: "Not found" };
  const bad = await checkPassword(user, password);
  if (bad) return { error: bad };
  if (user.reveal_blocked_until && new Date(user.reveal_blocked_until) > new Date())
    return { error: `Reveals are paused after a password change until ${new Date(user.reveal_blocked_until).toUTCString()}.` };

  const [s] = await sql<{ retrieval_seconds: number; open: boolean }>`
    SELECT retrieval_seconds, unlock_at <= now() AS open FROM secrets WHERE id = ${secretId} AND user_id = ${user.id}`;
  if (!s) return { error: "Not found" };
  if (!s.open) return { error: "Still locked" };
  if (s.retrieval_seconds <= 0) return { error: "This lock has no retrieval task" };

  const keys = await activePasskeys(user.id);
  if (!keys.length) {
    const [first] = await sql<{ at: string }>`
      SELECT min(created_at) + make_interval(hours => ${PASSKEY_COOLDOWN_HOURS}) AS at FROM passkeys WHERE user_id = ${user.id}`;
    return {
      error: first?.at
        ? `Your passkey can answer check-ins from ${new Date(first.at).toUTCString()}.`
        : "Add a passkey in Settings first.",
    };
  }

  const [open] = await sql<{ id: string }>`
    SELECT id FROM retrievals WHERE secret_id = ${secretId} AND user_id = ${user.id} AND state = 'active' LIMIT 1`;
  if (open) return { id: open.id };

  const id = randomUUID();
  await sql`INSERT INTO retrievals (id, secret_id, user_id, required_seconds, next_check_at)
    VALUES (${id}, ${secretId}, ${user.id}, ${s.retrieval_seconds}, now() + make_interval(secs => ${nextDelaySeconds()}))`;
  await logEvent(user.id, "retrieval_started", { id, secret: secretId, seconds: s.retrieval_seconds });
  return { id };
}

export async function retrievalStatus(id: string): Promise<RetrievalStatus> {
  const user = await requireUser();
  if (!uuid.safeParse(id).success) return { error: "Not found" };
  let r = await load(user.id, id);
  if (!r) return { error: "Not found" };

  if (r.state === "active") {
    if (r.challenge && r.check_expired) {
      await failMissed(user.id, id);
      r = (await load(user.id, id))!;
    } else if (!r.challenge && (r.check_due || r.time_up)) {
      await sql`UPDATE retrievals
        SET challenge = ${randomBytes(32).toString("base64url")}, challenge_deadline = now() + make_interval(secs => ${CHECK_WINDOW_SECONDS})
        WHERE id = ${id} AND state = 'active' AND challenge IS NULL`;
      r = (await load(user.id, id))!;
    }
  }

  const base = {
    state: r.state,
    elapsedMs: r.state === "done" || r.state === "used" ? r.required_seconds * 1000 : r.elapsed_ms,
    requiredMs: r.required_seconds * 1000,
    checks: r.checks_passed,
  };
  if (r.state !== "active" || !r.challenge) return base;
  const options = await authOptions(rpFromHeaders(await headers()), await activePasskeys(user.id), r.challenge);
  return { ...base, check: { options, deadlineMs: Math.max(0, r.deadline_ms ?? 0) } };
}

export async function submitCheck(
  id: string,
  response: AuthenticationResponseJSON,
): Promise<{ error: string } | { state: Row["state"] }> {
  const user = await requireUser();
  if (!uuid.safeParse(id).success) return { error: "Not found" };
  if (!(await allow(`check:${id}`, 30, 900))) return { error: "Too many attempts. Try again later." };
  const r = await load(user.id, id);
  if (!r || r.state !== "active" || !r.challenge) return { error: "No check-in is pending" };
  if (r.check_expired) {
    await failMissed(user.id, id);
    return { error: "Missed the check-in window. Retrieval reset." };
  }

  const [pk] = await sql<StoredPasskey>`
    SELECT id, public_key, counter, transports FROM passkeys
    WHERE id = ${String(response?.id ?? "")} AND user_id = ${user.id}
      AND created_at <= now() - make_interval(hours => ${PASSKEY_COOLDOWN_HOURS})`;
  if (!pk) return { error: "Use a passkey that has been registered for 24 hours" };

  let counter: number | null;
  try {
    counter = await verifyAuth(rpFromHeaders(await headers()), response, r.challenge, pk);
  } catch {
    return { error: "Check-in failed. Try again." };
  }
  if (counter === null) return { error: "Check-in failed. Try again." };

  const [u] = await sql<{ state: Row["state"] }>`
    UPDATE retrievals SET challenge = NULL, challenge_deadline = NULL, checks_passed = checks_passed + 1,
      next_check_at = now() + make_interval(secs => ${nextDelaySeconds()}),
      state = CASE WHEN now() >= started_at + make_interval(secs => required_seconds) THEN 'done' ELSE 'active' END,
      completed_at = CASE WHEN now() >= started_at + make_interval(secs => required_seconds) THEN now() END
    WHERE id = ${id} AND state = 'active' AND challenge = ${r.challenge} AND challenge_deadline >= now()
    RETURNING state`;
  if (!u) return { error: "That check-in expired. Retrieval reset." };
  await sql`UPDATE passkeys SET counter = ${counter}, last_used_at = now() WHERE id = ${pk.id}`;
  if (u.state === "done") await logEvent(user.id, "retrieval_completed", { id });
  return { state: u.state };
}
