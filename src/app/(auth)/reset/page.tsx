import Link from "next/link";
import { resetPassword } from "@/app/actions/auth";
import { ActionForm } from "@/components/ActionForm";

export const metadata = { title: "Choose a new password" };

export default async function Reset({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <>
        <h1>Link missing</h1>
        <p className="muted">Open the link from your email, or <Link href="/forgot">request a new one</Link>.</p>
      </>
    );
  }
  return (
    <>
      <h1>Choose a new password</h1>
      <ActionForm action={resetPassword} submit="Update password">
        <input type="hidden" name="token" value={token} />
        <div className="field">
          <label htmlFor="password">New password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
        </div>
        <div className="field">
          <label htmlFor="confirm">Confirm password</label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
        </div>
      </ActionForm>
    </>
  );
}
