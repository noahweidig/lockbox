"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { PublicKeyCredentialCreationOptionsJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { z } from "zod";
import { logEvent, requireUser } from "@/lib/auth";
import { checkPassword } from "@/lib/guard";
import { sql } from "@/lib/db";
import { appUrl, passkeyMail, sendMail } from "@/lib/mail";
import { registrationOptions, rpFromHeaders, verifyRegistration, type StoredPasskey } from "@/lib/webauthn";
import type { State } from "./auth";

const MAX_PASSKEYS = 5;

/** Step 1 of adding a passkey: needs the password, returns WebAuthn options. */
export async function passkeyRegisterOptions(
  password: string,
): Promise<{ error: string } | { options: PublicKeyCredentialCreationOptionsJSON }> {
  const user = await requireUser();
  const bad = await checkPassword(user, password);
  if (bad) return { error: bad };
  const existing = await sql<StoredPasskey>`SELECT id, public_key, counter, transports FROM passkeys WHERE user_id = ${user.id}`;
  if (existing.length >= MAX_PASSKEYS) return { error: `Limit of ${MAX_PASSKEYS} passkeys reached` };
  const options = await registrationOptions(rpFromHeaders(await headers()), user, existing);
  await sql`INSERT INTO passkey_challenges (user_id, challenge, expires_at)
    VALUES (${user.id}, ${options.challenge}, now() + interval '5 minutes')
    ON CONFLICT (user_id) DO UPDATE SET challenge = EXCLUDED.challenge, expires_at = EXCLUDED.expires_at`;
  return { options };
}

/** Step 2: verify the browser's response and store the passkey. */
export async function passkeyRegisterVerify(
  response: RegistrationResponseJSON,
  label: string,
): Promise<{ error: string } | { ok: true }> {
  const user = await requireUser();
  const name = z.string().trim().min(1).max(40).safeParse(label || "Passkey");
  if (!name.success) return { error: "Name it up to 40 characters" };
  const [c] = await sql<{ challenge: string }>`
    DELETE FROM passkey_challenges WHERE user_id = ${user.id} AND expires_at > now() RETURNING challenge`;
  if (!c) return { error: "That request expired. Start again." };
  let cred;
  try {
    cred = await verifyRegistration(rpFromHeaders(await headers()), response, c.challenge);
  } catch {
    return { error: "Couldn't verify the passkey" };
  }
  if (!cred) return { error: "Couldn't verify the passkey" };
  const rows = await sql`INSERT INTO passkeys (id, user_id, public_key, counter, transports, label)
    VALUES (${cred.id}, ${user.id}, ${cred.public_key}, ${cred.counter}, ${cred.transports}, ${name.data})
    ON CONFLICT (id) DO NOTHING RETURNING id`;
  if (!rows.length) return { error: "That passkey is already registered" };
  await logEvent(user.id, "passkey_added", { label: name.data });
  try {
    await sendMail(passkeyMail(user.email, `${appUrl()}/settings`));
  } catch {
    // The passkey is saved; a failed notification email must not undo it.
  }
  revalidatePath("/settings");
  return { ok: true };
}

export async function deletePasskey(_: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  const parsed = z.object({ id: z.string().min(1).max(1024), password: z.string().min(1).max(200) }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Enter your password" };
  const bad = await checkPassword(user, parsed.data.password);
  if (bad) return { error: bad };
  await sql`UPDATE retrievals SET state = 'failed' WHERE user_id = ${user.id} AND state = 'active'`;
  const [gone] = await sql<{ label: string }>`DELETE FROM passkeys WHERE id = ${parsed.data.id} AND user_id = ${user.id} RETURNING label`;
  if (gone) await logEvent(user.id, "passkey_removed", { label: gone.label });
  revalidatePath("/settings");
  return { ok: "Passkey removed." };
}
