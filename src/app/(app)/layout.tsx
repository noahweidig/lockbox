import Link from "next/link";
import { LogOut, Settings, Shield, Vault } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";
import { ResendVerification } from "@/components/ResendVerification";
import { ThemeToggle } from "@/components/ThemeToggle";
import { isAdmin, requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="wrap">
      <header className="nav">
        <Logo />
        <nav>
          <Link href="/vault" aria-label="Vault"><Vault size={18} /><span className="lbl">Vault</span></Link>
          {isAdmin(user) && <Link href="/admin" aria-label="Admin"><Shield size={18} /><span className="lbl">Admin</span></Link>}
          <Link href="/settings" aria-label="Settings"><Settings size={18} /><span className="lbl">Settings</span></Link>
          <ThemeToggle />
          <form action={logout}>
            <button className="link" aria-label="Sign out"><LogOut size={18} /><span className="lbl">Sign out</span></button>
          </form>
        </nav>
      </header>
      {!user.email_verified_at && (
        <div className="banner">
          <ResendVerification email={user.email} />
        </div>
      )}
      <main>{children}</main>
      <div className="sp" />
    </div>
  );
}
