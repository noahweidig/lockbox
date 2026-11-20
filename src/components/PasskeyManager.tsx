"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint } from "lucide-react";
import { startRegistration } from "@simplewebauthn/browser";
import { passkeyRegisterOptions, passkeyRegisterVerify } from "@/app/actions/passkeys";

export function AddPasskey() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg({});
    try {
      const o = await passkeyRegisterOptions(password);
      if ("error" in o) return setMsg({ err: o.error });
      const response = await startRegistration({ optionsJSON: o.options });
      const r = await passkeyRegisterVerify(response, label.trim() || "Passkey");
      if ("error" in r) return setMsg({ err: r.error });
      setPassword("");
      setLabel("");
      setMsg({ ok: "Passkey added. It can answer check-ins after 24 hours." });
      router.refresh();
    } catch {
      setMsg({ err: "Cancelled or not supported on this device." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={add} className="stack">
      <div className="field">
        <label htmlFor="pkl">Name</label>
        <input id="pkl" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. My iPhone" maxLength={40} />
      </div>
      <div className="field">
        <label htmlFor="pkp">Confirm your password</label>
        <input id="pkp" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </div>
      {msg.err && <p className="msg msg-err" role="alert">{msg.err}</p>}
      {msg.ok && <p className="msg msg-ok" role="status">{msg.ok}</p>}
      <button type="submit" className="btn" disabled={busy}>
        <Fingerprint size={16} /> {busy ? "Waiting for device…" : "Add a passkey"}
      </button>
    </form>
  );
}
