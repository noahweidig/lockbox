import Link from "next/link";
import { Activity, LayoutDashboard, LogOut, Users, Vault } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const icon = { size: 16, style: { verticalAlign: -3 } } as const;
  return (
    <div className="wrap">
      <header className="nav">
        <div className="row">
          <Logo />
          <span className="badge badge-locked">Admin</span>
        </div>
        <nav>
          <Link href="/admin"><LayoutDashboard {...icon} /> Overview</Link>
          <Link href="/admin/users"><Users {...icon} /> Users</Link>
          <Link href="/admin/activity"><Activity {...icon} /> Activity</Link>
          <Link href="/vault"><Vault {...icon} /> My vault</Link>
          <form action={logout}>
            <button className="link"><LogOut {...icon} /> Sign out</button>
          </form>
        </nav>
      </header>
      <main>{children}</main>
      <div className="sp" />
    </div>
  );
}
