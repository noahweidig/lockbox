import { BadgeCheck, MailWarning } from "lucide-react";
import { changePassword, deleteAccount, signOutEverywhere } from "@/app/actions/auth";
import { ActionForm } from "@/components/ActionForm";
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
};

export default async function SettingsPage() {
  const user = await requireUser();
  const events = await sql<{ type: string; created_at: string }>`
    SELECT type, created_at FROM events WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 15`;

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
