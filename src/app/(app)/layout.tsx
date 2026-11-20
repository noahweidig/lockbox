import Link from "next/link";
import { LogOut, Settings, Shield, Vault } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { ResendVerification } from "@/components/ResendVerification";
import { Logo } from "@/components/Logo";
import { isAdmin, requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="wrap">
      <header className="nav">
        <Logo />
        <nav>
          <Link href="/vault"><Vault size={16} style={{ verticalAlign: -3 }} /> Vault</Link>
          {isAdmin(user) && <Link href="/admin"><Shield size={16} style={{ verticalAlign: -3 }} /> Admin</Link>}
          <Link href="/settings"><Settings size={16} style={{ verticalAlign: -3 }} /> Settings</Link>
          <form action={logout}>
            <button className="link"><LogOut size={16} style={{ verticalAlign: -3 }} /> Sign out</button>
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
