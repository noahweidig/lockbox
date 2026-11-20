import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { createSecret } from "@/app/actions/secrets";
import { ActionForm } from "@/components/ActionForm";
import { DurationField, PasscodeField } from "@/components/SecretFields";
import { KINDS } from "@/lib/format";

export const metadata = { title: "New lock" };

export default function NewSecret() {
  return (
    <div className="narrow" style={{ width: "min(560px, 100%)" }}>
      <Link href="/vault" className="hint"><ArrowLeft size={14} style={{ verticalAlign: -2 }} /> Back to vault</Link>
      <div className="page-head"><h1>Lock a secret</h1></div>
      <div className="card">
        <ActionForm action={createSecret} submit="Lock it away">
          <div className="field">
            <label htmlFor="label">Name</label>
            <input id="label" name="label" placeholder="e.g. Alex's iPad Screen Time" maxLength={80} required />
          </div>
          <div className="field">
            <label htmlFor="kind">Type</label>
            <select id="kind" name="kind" defaultValue="screentime">
              {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <PasscodeField />
          <DurationField />
          <p className="hint">
            <Lock size={13} style={{ verticalAlign: -2 }} /> Locks can be extended but never shortened or removed.
          </p>
        </ActionForm>
      </div>
    </div>
  );
}
