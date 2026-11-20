import Link from "next/link";
import { forgotPassword } from "@/app/actions/auth";
import { ActionForm } from "@/components/ActionForm";

export const metadata = { title: "Reset password" };

export default function Forgot() {
  return (
    <>
      <h1>Reset your password</h1>
      <p className="muted">We&apos;ll email you a link valid for 1 hour. Reveals pause for 24 hours after a reset.</p>
      <ActionForm action={forgotPassword} submit="Send reset link">
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
      </ActionForm>
      <p className="alt"><Link href="/login">Back to sign in</Link></p>
    </>
  );
}
