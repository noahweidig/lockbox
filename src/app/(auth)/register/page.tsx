import Link from "next/link";
import { register } from "@/app/actions/auth";
import { ActionForm } from "@/components/ActionForm";

export const metadata = { title: "Create account" };

export default function Register() {
  return (
    <>
      <h1>Create your account</h1>
      <ActionForm action={register} submit="Create account">
        <div className="field">
          <label htmlFor="name">Name (optional)</label>
          <input id="name" name="name" autoComplete="name" maxLength={80} />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
          <p className="hint">At least 10 characters. You need it to reveal secrets later.</p>
        </div>
      </ActionForm>
      <p className="alt">Have an account? <Link href="/login">Sign in</Link></p>
    </>
  );
}
