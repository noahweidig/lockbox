import Link from "next/link";
import { ChevronRight, Lock, LockOpen, Plus } from "lucide-react";
import { Countdown } from "@/components/Countdown";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { KINDS } from "@/lib/format";

export const metadata = { title: "Vault" };

type Row = { id: string; label: string; kind: string; unlock_at: string; locked: boolean };

export default async function VaultPage() {
  const user = await requireUser();
  const rows = await sql<Row>`
    SELECT id, label, kind, unlock_at, unlock_at > now() AS locked
    FROM secrets WHERE user_id = ${user.id} ORDER BY created_at DESC`;

  return (
    <>
      <div className="page-head">
        <h1>Your vault</h1>
        <Link href="/vault/new" className="btn btn-primary"><Plus size={18} /> New lock</Link>
      </div>

      {rows.length === 0 ? (
        <div className="card empty">
          <Lock size={36} color="var(--accent)" style={{ marginBottom: 12 }} />
          <h2>Nothing locked yet</h2>
          <p>Lock a Screen Time passcode, a password, or any secret behind a timer.</p>
          <Link href="/vault/new" className="btn btn-primary"><Plus size={18} /> Lock your first secret</Link>
        </div>
      ) : (
        <div className="stack">
          {rows.map((r) => (
            <Link key={r.id} href={`/vault/${r.id}`} className="card secret">
              <div>
                <h3>{r.label}</h3>
                <span className="muted">{KINDS[r.kind] ?? r.kind}</span>
              </div>
              <div className="row">
                {r.locked ? (
                  <span className="badge badge-locked"><Lock size={14} /> <Countdown until={r.unlock_at} /></span>
                ) : (
                  <span className="badge badge-open"><LockOpen size={14} /> Unlocked</span>
                )}
                <ChevronRight size={18} color="var(--muted)" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
