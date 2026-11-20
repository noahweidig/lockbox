import Link from "next/link";
import { login } from "@/app/actions/auth";
import { ActionForm } from "@/components/ActionForm";

export const metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const { reset } = await searchParams;
  return (
    <>
      <h1>Welcome back</h1>
      {reset && <p className="msg msg-ok" style={{ marginBottom: 16 }}>Password updated. Sign in with the new one.</p>}
      <ActionForm action={login} submit="Sign in">
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <Link href="/forgot" className="hint">Forgot password?</Link>
      </ActionForm>
      <p className="alt">New here? <Link href="/register">Create an account</Link></p>
    </>
  );
}
