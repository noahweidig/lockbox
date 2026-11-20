import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getUser } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getUser().catch(() => null)) redirect("/vault");
  return (
    <div className="wrap">
      <header className="nav"><Logo /><nav><ThemeToggle /></nav></header>
      <main className="narrow auth">
        <div className="card">{children}</div>
      </main>
    </div>
  );
}
