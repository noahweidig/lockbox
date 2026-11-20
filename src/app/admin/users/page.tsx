import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { sql } from "@/lib/db";

const PAGE = 25;

type Row = {
  id: string; email: string; name: string | null; role: string; created_at: string;
  email_verified_at: string | null; suspended_at: string | null; secrets: number; locked: number;
};

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100).replace(/[%_\\]/g, (c) => `\\${c}`);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const like = `%${q}%`;

  const rows = await sql<Row>`
    SELECT u.id, u.email, u.name, u.role, u.created_at, u.email_verified_at, u.suspended_at,
      (SELECT count(*) FROM secrets s WHERE s.user_id = u.id)::int AS secrets,
      (SELECT count(*) FROM secrets s WHERE s.user_id = u.id AND s.unlock_at > now())::int AS locked
    FROM users u
    WHERE u.email ILIKE ${like} OR coalesce(u.name, '') ILIKE ${like}
    ORDER BY u.created_at DESC LIMIT ${PAGE + 1} OFFSET ${(page - 1) * PAGE}`;
  const more = rows.length > PAGE;
  const shown = rows.slice(0, PAGE);
  const href = (p: number) => `/admin/users?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(p) })}`;

  return (
    <>
      <div className="page-head">
        <h1>Users</h1>
        <form action="/admin/users" className="row search" role="search">
          <Search size={16} color="var(--muted)" />
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Search name or email" aria-label="Search users" />
        </form>
      </div>
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr><th>User</th><th>Status</th><th>Locks</th><th>Joined</th></tr>
          </thead>
          <tbody>
            {shown.map((u) => (
              <tr key={u.id}>
                <td data-label="User">
                  <Link href={`/admin/users/${u.id}`}><b>{u.email}</b></Link>
                  {u.name && <div className="muted">{u.name}</div>}
                </td>
                <td data-label="Status">
                  <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                    {u.role === "admin" && <span className="badge badge-locked">Admin</span>}
                    {u.suspended_at && <span className="badge badge-bad">Suspended</span>}
                    {!u.email_verified_at && <span className="badge badge-warn">Unconfirmed</span>}
                  </div>
                </td>
                <td data-label="Locks">{u.locked} active / {u.secrets}</td>
                <td data-label="Joined" className="mono">{new Date(u.created_at).toISOString().slice(0, 10)}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={4} className="muted" style={{ textAlign: "center", padding: 32 }}>No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ justifyContent: "center", marginTop: 16 }}>
        {page > 1 && <Link href={href(page - 1)} className="btn btn-ghost"><ChevronLeft size={16} /> Prev</Link>}
        <span className="hint">Page {page}</span>
        {more && <Link href={href(page + 1)} className="btn btn-ghost">Next <ChevronRight size={16} /></Link>}
      </div>
    </>
  );
}
