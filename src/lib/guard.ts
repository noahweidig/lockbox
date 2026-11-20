import { verifyPassword } from "./crypto";
import { allow } from "./ratelimit";

/** Returns an error message, or null when the password is right. Shares the reveal brute-force budget. */
export async function checkPassword(user: { id: string; password_hash: string }, password: string): Promise<string | null> {
  if (!password) return "Enter your password";
  if (!(await allow(`reveal:${user.id}`, 10, 900))) return "Too many attempts. Try again in 15 minutes.";
  if (!(await verifyPassword(password, user.password_hash))) return "Wrong password";
  return null;
}
