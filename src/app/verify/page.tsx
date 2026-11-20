import Link from "next/link";
import { verifyEmail } from "@/app/actions/auth";
import { ActionForm } from "@/components/ActionForm";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata = { title: "Confirm email" };

export default async function Verify({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="wrap">
      <header className="nav"><Logo /><nav><ThemeToggle /></nav></header>
      <main className="narrow auth">
        <div className="card">
          <h1>Confirm your email</h1>
          {token ? (
            <ActionForm action={verifyEmail} submit="Confirm email">
              <input type="hidden" name="token" value={token} />
            </ActionForm>
          ) : (
            <p className="muted">Open the link from your email.</p>
          )}
          <p className="alt"><Link href="/vault">Go to vault</Link></p>
        </div>
      </main>
    </div>
  );
}
