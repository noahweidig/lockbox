import { BadgeCheck, Fingerprint, MailWarning } from "lucide-react";
import { changePassword, deleteAccount, signOutEverywhere } from "@/app/actions/auth";
import { deletePasskey } from "@/app/actions/passkeys";
import { ActionForm } from "@/components/ActionForm";
import { AddPasskey } from "@/components/PasskeyManager";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const metadata = { title: "Settings" };

const LABELS: Record<string, string> = {
  account_created: "Account created",
  login: "Signed in",
  login_failed: "Failed sign-in",
  reset_requested: "Password reset requested",
  password_reset: "Password reset",
  password_changed: "Password changed",
  email_verified: "Email confirmed",
  secret_locked: "Secret locked",
  lock_extended: "Lock extended",
  secret_revealed: "Secret revealed",
  reveal_bad_password: "Reveal attempt, wrong password",
  secret_deleted: "Secret deleted",
  signed_out_everywhere: "Signed out everywhere",
  passkey_added: "Passkey added",
  passkey_removed: "Passkey removed",
  retrieval_started: "Retrieval started",
  retrieval_failed: "Retrieval failed",
  retrieval_completed: "Retrieval completed",
};

export default async function SettingsPage() {
  const user = await requireUser();
  const events = await sql<{ type: string; created_at: string }>`
    SELECT type, created_at FROM events WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 15`;

  const keys = await sql<{ id: string; label: string; created_at: string; active: boolean; last_used_at: string | null }>`
    SELECT id, label, created_at, last_used_at, created_at <= now() - interval '24 hours' AS active
    FROM passkeys WHERE user_id = ${user.id} ORDER BY created_at`;

  return (
    <div className="stack col">
      <div className="page-head" style={{ margin: 0 }}><h1>Settings</h1></div>

      <div className="card stack">
        <h3>Account</h3>
        <p style={{ margin: 0 }}>
          {user.name ? <>{user.name} · </> : null}{user.email}{" "}
          {user.email_verified_at ? (
            <span className="badge badge-open"><BadgeCheck size={14} /> Confirmed</span>
          ) : (
            <span className="badge badge-locked"><MailWarning size={14} /> Unconfirmed</span>
          )}
        </p>
      </div>

      <div className="card stack">
        <h3><Fingerprint size={16} style={{ verticalAlign: -3 }} /> Passkeys</h3>
        <p className="hint">
          Passkeys answer the check-ins during a retrieval task. Use Face ID, Touch ID or a device PIN. A new passkey
          works for check-ins after 24 hours.
        </p>
        {keys.map((k) => (
          <details key={k.id} className="sub">
            <summary>
              <span>{k.label}</span>
              <span className={`badge ${k.active ? "badge-open" : "badge-locked"}`}>
                {k.active ? "Active" : `Active ${new Date(new Date(k.created_at).getTime() + 864e5).toUTCString().slice(5, 22)} UTC`}
              </span>
            </summary>
            <div className="sp" />
            <ActionForm action={deletePasskey} submit="Remove passkey" buttonClass="btn btn-danger">
              <input type="hidden" name="id" value={k.id} />
              <div className="field">
                <label htmlFor={`rm-${k.id}`}>Password</label>
                <input id={`rm-${k.id}`} name="password" type="password" autoComplete="current-password" required />
              </div>
              <p className="hint">Removing a passkey resets any retrieval in progress.</p>
            </ActionForm>
          </details>
        ))}
        <AddPasskey />
      </div>

      <div className="card stack">
        <h3>Change password</h3>
        <ActionForm action={changePassword} submit="Update password" resetOnOk>
          <div className="field">
            <label htmlFor="current">Current password</label>
            <input id="current" name="current" type="password" autoComplete="current-password" required />
          </div>
          <div className="field">
            <label htmlFor="password">New password</label>
            <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
          </div>
          <div className="field">
            <label htmlFor="confirm">Confirm new password</label>
            <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
          </div>
          <p className="hint">Changing your password pauses secret reveals for 24 hours.</p>
        </ActionForm>
      </div>

      <div className="card stack">
        <h3>Recent activity</h3>
        <ul className="log">
          {events.map((e, i) => (
            <li key={i}>
              <span>{LABELS[e.type] ?? e.type}</span>
              <span className="mono">{new Date(e.created_at).toUTCString().slice(5, 22)} UTC</span>
            </li>
          ))}
        </ul>
        <form action={signOutEverywhere}>
          <button className="btn">Sign out of all devices</button>
        </form>
      </div>

      <div className="card stack danger">
        <h3>Delete account</h3>
        <p className="hint">Permanent. Blocked while any secret is still locked.</p>
        <ActionForm action={deleteAccount} submit="Delete my account" buttonClass="btn btn-danger">
          <div className="field">
            <label htmlFor="dpw">Password</label>
            <input id="dpw" name="password" type="password" autoComplete="current-password" required />
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
