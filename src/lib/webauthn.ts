import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";

export type RP = { id: string; origin: string; name: string };
export type StoredPasskey = { id: string; public_key: string; counter: number; transports: string | null };

/** Passkeys younger than this can't satisfy a check-in. */
export const PASSKEY_COOLDOWN_HOURS = 24;

export function rpFromHeaders(h: { get(name: string): string | null }): RP {
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const hostname = host.replace(/:\d+$/, "");
  const local = hostname === "localhost" || hostname === "127.0.0.1";
  const proto = h.get("x-forwarded-proto")?.split(",")[0] ?? (local ? "http" : "https");
  return { id: hostname, origin: `${proto}://${host}`, name: "LokBoks" };
}

const bytes = (b64: string) => new Uint8Array(Buffer.from(b64, "base64url"));
const transports = (p: { transports: string | null }) => (p.transports ? p.transports.split(",") : undefined);
const toCred = (p: StoredPasskey) => ({
  id: p.id,
  publicKey: bytes(p.public_key),
  counter: p.counter,
  transports: transports(p),
});

export function registrationOptions(rp: RP, user: { id: string; email: string }, existing: StoredPasskey[]) {
  return generateRegistrationOptions({
    rpName: rp.name,
    rpID: rp.id,
    userName: user.email,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({ id: p.id, transports: transports(p) })),
    authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "preferred", userVerification: "required" },
  });
}

/** Returns the new credential, or null if verification failed. User verification (biometric/PIN) is required. */
export async function verifyRegistration(rp: RP, response: RegistrationResponseJSON, expectedChallenge: string) {
  const v = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.id,
    requireUserVerification: true,
  });
  if (!v.verified) return null;
  const c = v.registrationInfo.credential;
  return {
    id: c.id,
    public_key: Buffer.from(c.publicKey).toString("base64url"),
    counter: c.counter,
    transports: c.transports?.join(",") ?? null,
  };
}

/** `challenge` is the base64url string stored server-side; the options carry exactly that value. */
export function authOptions(rp: RP, passkeys: StoredPasskey[], challenge: string) {
  return generateAuthenticationOptions({
    rpID: rp.id,
    allowCredentials: passkeys.map((p) => ({ id: p.id, transports: transports(p) })),
    userVerification: "required",
    challenge: bytes(challenge),
  });
}

/** Returns the new signature counter, or null if the assertion is invalid or lacks user verification. */
export async function verifyAuth(rp: RP, response: AuthenticationResponseJSON, challenge: string, pk: StoredPasskey) {
  const v = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.id,
    credential: toCred(pk),
    requireUserVerification: true,
  });
  return v.verified ? v.authenticationInfo.newCounter : null;
}
