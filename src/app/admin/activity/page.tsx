import Link from "next/link";
import { sql } from "@/lib/db";
import { EVENT_LABELS } from "@/lib/events";

export default async function ActivityPage() {
  const events = await sql<{ type: string; email: string; user_id: string; meta: { by?: string } | null; created_at: string }>`
    SELECT e.type, e.user_id, u.email, e.meta, e.created_at
    FROM events e JOIN users u ON u.id = e.user_id
    ORDER BY e.created_at DESC LIMIT 150`;
  return (
    <>
      <div className="page-head"><h1>Activity</h1></div>
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table">
          <thead><tr><th>When (UTC)</th><th>User</th><th>Event</th></tr></thead>
          <tbody>
            {events.map((e, i) => (
              <tr key={i}>
                <td data-label="When" className="mono">{new Date(e.created_at).toISOString().slice(0, 16).replace("T", " ")}</td>
                <td data-label="User"><Link href={`/admin/users/${e.user_id}`}>{e.email}</Link></td>
                <td data-label="Event">
                  {EVENT_LABELS[e.type] ?? e.type}
                  {e.meta?.by && <span className="muted"> · by {e.meta.by}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
