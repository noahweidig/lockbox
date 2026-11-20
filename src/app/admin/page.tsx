import Link from "next/link";
import { Eye, Lock, ShieldOff, UserPlus, Users } from "lucide-react";
import { sql } from "@/lib/db";
import { EVENT_LABELS } from "@/lib/events";

type Stats = { users: number; new7: number; secrets: number; locked: number; reveals7: number; suspended: number };

export default async function AdminHome() {
  const [s] = await sql<Stats>`
    SELECT
      (SELECT count(*) FROM users)::int AS users,
      (SELECT count(*) FROM users WHERE created_at > now() - interval '7 days')::int AS new7,
      (SELECT count(*) FROM secrets)::int AS secrets,
      (SELECT count(*) FROM secrets WHERE unlock_at > now())::int AS locked,
      (SELECT count(*) FROM events WHERE type = 'secret_revealed' AND created_at > now() - interval '7 days')::int AS reveals7,
      (SELECT count(*) FROM users WHERE suspended_at IS NOT NULL)::int AS suspended`;
  const recent = await sql<{ id: string; email: string; created_at: string }>`
    SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT 6`;
  const events = await sql<{ type: string; email: string; user_id: string; created_at: string }>`
    SELECT e.type, e.user_id, u.email, e.created_at FROM events e JOIN users u ON u.id = e.user_id
    WHERE e.type <> 'login' ORDER BY e.created_at DESC LIMIT 8`;

  const stats = [
    [Users, "Users", s.users],
    [UserPlus, "New this week", s.new7],
    [Lock, "Active locks", s.locked],
    [Lock, "Total secrets", s.secrets],
    [Eye, "Reveals this week", s.reveals7],
    [ShieldOff, "Suspended", s.suspended],
  ] as const;

  return (
    <>
      <div className="page-head"><h1>Overview</h1></div>
      <div className="stats">
        {stats.map(([Icon, label, n]) => (
          <div key={label} className="card stat">
            <Icon size={18} color="var(--accent-2)" />
            <b>{n}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="cols" style={{ marginTop: 20 }}>
        <div className="card stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>Newest users</h3>
            <Link href="/admin/users" className="hint">View all</Link>
          </div>
          <ul className="log">
            {recent.map((u) => (
              <li key={u.id}>
                <Link href={`/admin/users/${u.id}`}>{u.email}</Link>
                <span className="mono">{new Date(u.created_at).toISOString().slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>Latest activity</h3>
            <Link href="/admin/activity" className="hint">View all</Link>
          </div>
          <ul className="log">
            {events.map((e, i) => (
              <li key={i}>
                <span><Link href={`/admin/users/${e.user_id}`}>{e.email}</Link> · {EVENT_LABELS[e.type] ?? e.type}</span>
                <span className="mono">{new Date(e.created_at).toISOString().slice(5, 16).replace("T", " ")}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
