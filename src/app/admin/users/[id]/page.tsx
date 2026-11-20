import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, LockOpen } from "lucide-react";
import {
  adminDeleteSecret, adminDeleteUser, adminRenameSecret, adminReplaceSecret,
  adminSendReset, adminSetLock, adminToggle, adminUpdateUser,
} from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { Countdown } from "@/components/Countdown";
import { DurationField } from "@/components/SecretFields";
import { requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { EVENT_LABELS } from "@/lib/events";
import { KINDS } from "@/lib/format";

type U = {
  id: string; email: string; name: string | null; role: string; created_at: string;
  email_verified_at: string | null; suspended_at: string | null; reveal_blocked_until: string | null;
  sessions: number;
};
type S = { id: string; label: string; kind: string; unlock_at: string; locked: boolean; reveal_count: number };

function Quick({ id, action, label, danger }: { id: string; action: string; label: string; danger?: boolean }) {
  return (
    <ActionForm action={adminToggle} submit={label} buttonClass={danger ? "btn btn-danger" : "btn"} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
    </ActionForm>
  );
}

export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [u] = await sql<U>`
    SELECT id, email, name, role, created_at, email_verified_at, suspended_at, reveal_blocked_until,
      (SELECT count(*) FROM sessions WHERE user_id = users.id AND expires_at > now())::int AS sessions
    FROM users WHERE id = ${id}`;
  if (!u) notFound();
  const secrets = await sql<S>`
    SELECT id, label, kind, unlock_at, unlock_at > now() AS locked, reveal_count
    FROM secrets WHERE user_id = ${id} ORDER BY created_at DESC`;
  const events = await sql<{ type: string; created_at: string; meta: { by?: string } | null }>`
    SELECT type, created_at, meta FROM events WHERE user_id = ${id} ORDER BY created_at DESC LIMIT 12`;
  const self = u.id === me.id;
  const cooldown = u.reveal_blocked_until && new Date(u.reveal_blocked_until) > new Date();

  return (
    <div className="stack">
      <Link href="/admin/users" className="hint"><ArrowLeft size={14} style={{ verticalAlign: -2 }} /> All users</Link>
      <div className="page-head" style={{ margin: 0 }}>
        <div>
          <h1>{u.name || u.email}</h1>
          <span className="muted">{u.email} · joined {new Date(u.created_at).toISOString().slice(0, 10)} · {u.sessions} active session{u.sessions === 1 ? "" : "s"}</span>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {u.role === "admin" && <span className="badge badge-locked">Admin</span>}
          {u.suspended_at && <span className="badge badge-bad">Suspended</span>}
          {u.email_verified_at ? <span className="badge badge-open">Confirmed</span> : <span className="badge badge-warn">Unconfirmed</span>}
          {cooldown && <span className="badge badge-warn">Reveals paused</span>}
        </div>
      </div>

      <div className="cols">
        <div className="card stack">
          <h3>Profile</h3>
          <ActionForm action={adminUpdateUser} submit="Save profile">
            <input type="hidden" name="id" value={u.id} />
            <div className="field"><label htmlFor="name">Name</label><input id="name" name="name" defaultValue={u.name ?? ""} maxLength={80} /></div>
            <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" defaultValue={u.email} required /></div>
          </ActionForm>
        </div>

        <div className="card stack">
          <h3>Quick actions</h3>
          <div className="actions">
            <ActionForm action={adminSendReset} submit="Send password reset" buttonClass="btn" className="inline">
              <input type="hidden" name="id" value={u.id} />
            </ActionForm>
            <Quick id={u.id} action={u.email_verified_at ? "unverify" : "verify"} label={u.email_verified_at ? "Mark email unconfirmed" : "Confirm email"} />
            <Quick id={u.id} action="sign_out" label="Sign out everywhere" />
            {cooldown && <Quick id={u.id} action="clear_cooldown" label="Clear reveal pause" />}
            {!self && <Quick id={u.id} action={u.role === "admin" ? "demote" : "promote"} label={u.role === "admin" ? "Remove admin" : "Make admin"} />}
            {!self && <Quick id={u.id} action={u.suspended_at ? "unsuspend" : "suspend"} label={u.suspended_at ? "Restore account" : "Suspend account"} danger={!u.suspended_at} />}
          </div>
        </div>
      </div>

      <div className="card stack">
        <h3>Secrets ({secrets.length})</h3>
        <p className="hint">Values stay hidden from admins. You can rename, re-time, replace, or delete.</p>
        {secrets.length === 0 && <p className="muted">None yet.</p>}
        {secrets.map((s) => (
          <details key={s.id} className="sub">
            <summary>
              <span><b>{s.label}</b> <span className="muted">· {KINDS[s.kind] ?? s.kind} · revealed {s.reveal_count}×</span></span>
              {s.locked
                ? <span className="badge badge-locked"><Lock size={14} /> <Countdown until={s.unlock_at} /></span>
                : <span className="badge badge-open"><LockOpen size={14} /> Unlocked</span>}
            </summary>
            <div className="cols" style={{ marginTop: 14 }}>
              <div className="stack">
                <ActionForm action={adminSetLock} submit="Set lock from now">
                  <input type="hidden" name="id" value={s.id} />
                  <DurationField defaultMinutes={0} label="Locked for (0 = unlock now)" />
                </ActionForm>
              </div>
              <div className="stack">
                <ActionForm action={adminRenameSecret} submit="Rename" buttonClass="btn">
                  <input type="hidden" name="id" value={s.id} />
                  <div className="field"><label>Name</label><input name="label" defaultValue={s.label} maxLength={80} required /></div>
                </ActionForm>
                <ActionForm action={adminReplaceSecret} submit="Replace value" buttonClass="btn" resetOnOk>
                  <input type="hidden" name="id" value={s.id} />
                  <div className="field"><label>New value</label><input name="value" type="password" autoComplete="off" maxLength={2000} required /></div>
                </ActionForm>
                <ActionForm action={adminDeleteSecret} submit="Delete secret" buttonClass="btn btn-danger">
                  <input type="hidden" name="id" value={s.id} />
                </ActionForm>
              </div>
            </div>
          </details>
        ))}
      </div>

      <div className="card stack">
        <h3>Recent activity</h3>
        <ul className="log">
          {events.map((e, i) => (
            <li key={i}>
              <span>{EVENT_LABELS[e.type] ?? e.type}{e.meta?.by && <span className="muted"> · by {e.meta.by}</span>}</span>
              <span className="mono">{new Date(e.created_at).toISOString().slice(0, 16).replace("T", " ")}</span>
            </li>
          ))}
        </ul>
      </div>

      {!self && (
        <div className="card stack danger">
          <h3>Delete user</h3>
          <p className="hint">Removes the account and all its secrets permanently.</p>
          <ActionForm action={adminDeleteUser} submit="Delete user" buttonClass="btn btn-danger">
            <input type="hidden" name="id" value={u.id} />
            <div className="field"><label htmlFor="confirm">Type {u.email} to confirm</label><input id="confirm" name="confirm" autoComplete="off" required /></div>
          </ActionForm>
        </div>
      )}
    </div>
  );
}
