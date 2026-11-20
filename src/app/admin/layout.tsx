import Link from "next/link";
import { Activity, LayoutDashboard, LogOut, Users, Vault } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="wrap">
      <header className="nav">
        <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
          <Logo />
          <span className="badge badge-locked">Admin</span>
        </div>
        <nav>
          <Link href="/admin" aria-label="Overview"><LayoutDashboard size={18} /><span className="lbl">Overview</span></Link>
          <Link href="/admin/users" aria-label="Users"><Users size={18} /><span className="lbl">Users</span></Link>
          <Link href="/admin/activity" aria-label="Activity"><Activity size={18} /><span className="lbl">Activity</span></Link>
          <Link href="/vault" aria-label="My vault"><Vault size={18} /><span className="lbl">My vault</span></Link>
          <ThemeToggle />
          <form action={logout}>
            <button className="link" aria-label="Sign out"><LogOut size={18} /><span className="lbl">Sign out</span></button>
          </form>
        </nav>
      </header>
      <main>{children}</main>
      <div className="sp" />
    </div>
  );
}
