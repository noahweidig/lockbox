"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, Copy, EyeOff, LockOpen } from "lucide-react";
import { revealSecret } from "@/app/actions/secrets";

const VISIBLE_SECONDS = 30;

export function RevealBox({ id }: { id: string }) {
  const [state, action, pending] = useActionState(revealSecret, undefined);
  const [value, setValue] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (state?.value) {
      setValue(state.value);
      setLeft(VISIBLE_SECONDS);
    }
  }, [state]);

  useEffect(() => {
    if (value === null) return;
    if (left <= 0) {
      setValue(null);
      return;
    }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [value, left]);

  if (value !== null) {
    return (
      <div className="stack">
        <div className="revealed mono">{value}</div>
        <div className="row">
          <button
            className="btn btn-ghost"
            onClick={async () => {
              await navigator.clipboard.writeText(value);
              setCopied(true);
            }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy"}
          </button>
          <button className="btn btn-ghost" onClick={() => setValue(null)}>
            <EyeOff size={16} /> Hide now
          </button>
          <span className="hint">Hides in {left}s</span>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="stack">
      <input type="hidden" name="id" value={id} />
      <div className="field">
        <label htmlFor="rp">Confirm your password</label>
        <input id="rp" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state?.error && <p className="msg msg-err" role="alert">{state.error}</p>}
      <button className="btn btn-primary" disabled={pending}>
        <LockOpen size={16} /> {pending ? "Unlocking…" : "Reveal secret"}
      </button>
    </form>
  );
}
