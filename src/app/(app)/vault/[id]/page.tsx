import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Lock, LockOpen, Pencil, Trash2 } from "lucide-react";
import { deleteSecret, extendLock, renameSecret } from "@/app/actions/secrets";
import { ActionForm } from "@/components/ActionForm";
import { Countdown } from "@/components/Countdown";
import { RetrievalGate } from "@/components/RetrievalGate";
import { RevealBox } from "@/components/RevealBox";
import { DurationField } from "@/components/SecretFields";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { KINDS } from "@/lib/format";

type Row = {
  id: string; label: string; kind: string; unlock_at: string; locked: boolean;
  reveal_count: number; last_revealed_at: string | null; created_at: string; retrieval_seconds: number;
};

export default async function SecretPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [s] = await sql<Row>`
    SELECT id, label, kind, unlock_at, unlock_at > now() AS locked, reveal_count, last_revealed_at, created_at, retrieval_seconds
    FROM secrets WHERE id = ${id} AND user_id = ${user.id}`;
  if (!s) notFound();

  const [open] = s.retrieval_seconds > 0 && !s.locked
    ? await sql<{ id: string; state: "active" | "done" }>`
        SELECT id, state FROM retrievals
        WHERE secret_id = ${s.id} AND user_id = ${user.id}
          AND (state = 'active' OR (state = 'done' AND completed_at > now() - interval '10 minutes'))
        ORDER BY created_at DESC LIMIT 1`
    : [];

  const blocked = user.reveal_blocked_until && new Date(user.reveal_blocked_until) > new Date();
  const fmt = (d: string) => new Date(d).toUTCString();

  return (
    <div className="stack col">
      <Link href="/vault" className="back"><ArrowLeft size={16} /> Back to vault</Link>
      <div className="page-head" style={{ margin: 0 }}>
        <div>
          <h1>{s.label}</h1>
          <span className="muted">
            {KINDS[s.kind] ?? s.kind}
            {s.retrieval_seconds > 0 ? ` · ${Math.round(s.retrieval_seconds / 60)} min retrieval task` : ""}
          </span>
        </div>
        {s.locked ? (
          <span className="badge badge-locked"><Lock size={14} /> Locked</span>
        ) : (
          <span className="badge badge-open"><LockOpen size={14} /> Unlocked</span>
        )}
      </div>

      {s.locked ? (
        <div className="card stack">
          <h3><Clock size={16} style={{ verticalAlign: -3 }} /> Time remaining</h3>
          <Countdown until={s.unlock_at} full />
          <p className="hint">Unlocks {fmt(s.unlock_at)}. The server won&apos;t release it before then.</p>
        </div>
      ) : (
        <div className="card stack">
          <h3><LockOpen size={16} style={{ verticalAlign: -3 }} /> Reveal</h3>
          {blocked ? (
            <p className="msg msg-err">
              Reveals are paused until {fmt(user.reveal_blocked_until!)} because your password changed recently.
            </p>
          ) : s.retrieval_seconds > 0 ? (
            <RetrievalGate secretId={s.id} minutes={Math.round(s.retrieval_seconds / 60)} initial={open ?? null} />
          ) : (
            <RevealBox id={s.id} />
          )}
        </div>
      )}

      <div className="card stack">
        <h3>{s.locked ? "Add more time" : "Lock again"}</h3>
        <ActionForm action={extendLock} submit={s.locked ? "Extend lock" : "Re-lock"}>
          <input type="hidden" name="id" value={s.id} />
          <DurationField defaultMinutes={1440} label="Add" />
        </ActionForm>
      </div>

      <div className="card stack">
        <h3><Pencil size={16} style={{ verticalAlign: -3 }} /> Rename</h3>
        <ActionForm action={renameSecret} submit="Save name" buttonClass="btn">
          <input type="hidden" name="id" value={s.id} />
          <div className="field">
            <input name="label" defaultValue={s.label} maxLength={80} required aria-label="Name" />
          </div>
        </ActionForm>
        <p className="hint">
          Created {fmt(s.created_at)} · revealed {s.reveal_count}×{s.last_revealed_at ? ` · last ${fmt(s.last_revealed_at)}` : ""}
        </p>
      </div>

      <div className="card stack danger">
        <h3><Trash2 size={16} style={{ verticalAlign: -3 }} /> Delete</h3>
        <p className="hint">
          {s.locked
            ? "Destroys the secret now, before the lock ends. It can't be recovered, and nothing changes on the device it was set on."
            : "Permanent. The secret can't be recovered."}
        </p>
        <ActionForm action={deleteSecret} submit="Delete secret" buttonClass="btn btn-danger">
          <input type="hidden" name="id" value={s.id} />
          <div className="field">
            <label htmlFor="dp">Confirm your password</label>
            <input id="dp" name="password" type="password" autoComplete="current-password" required />
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
