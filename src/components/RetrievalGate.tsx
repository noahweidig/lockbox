"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { Fingerprint, Hourglass, RotateCcw } from "lucide-react";
import { retrievalStatus, startRetrieval, submitCheck } from "@/app/actions/retrieval";
import { RevealBox } from "@/components/RevealBox";

type Status = Exclude<Awaited<ReturnType<typeof retrievalStatus>>, { error: string }>;
type Phase = "idle" | "running" | "done" | "failed";

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function RetrievalGate({
  secretId,
  minutes,
  initial,
}: {
  secretId: string;
  minutes: number;
  initial: { id: string; state: "active" | "done" } | null;
}) {
  const [phase, setPhase] = useState<Phase>(initial ? (initial.state === "done" ? "done" : "running") : "idle");
  const [rid, setRid] = useState<string | null>(initial?.id ?? null);
  const [status, setStatus] = useState<Status | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [now, setNow] = useState(0);
  const syncedAt = useRef(0);

  const refresh = useCallback(async () => {
    if (!rid) return;
    const s = await retrievalStatus(rid).catch(() => null);
    if (!s) return;
    if ("error" in s) {
      setErr(s.error);
      setPhase("failed");
      return;
    }
    syncedAt.current = performance.now();
    setStatus(s);
    if (s.state === "done" || s.state === "used") setPhase("done");
    else if (s.state === "failed") {
      setErr("Missed a check-in. The retrieval was reset.");
      setPhase("failed");
    }
  }, [rid]);

  useEffect(() => {
    if (phase !== "running") return;
    refresh();
    const poll = setInterval(refresh, 2500);
    const tick = setInterval(() => setNow(performance.now()), 250);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [phase, refresh]);

  const checkDue = phase === "running" && !!status?.check;
  useEffect(() => {
    if (!checkDue) return;
    const title = document.title;
    document.title = "Check-in needed";
    navigator.vibrate?.([200, 100, 200]);
    return () => {
      document.title = title;
    };
  }, [checkDue]);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await startRetrieval(secretId, password);
      if ("error" in r) return setErr(r.error);
      setPassword("");
      setStatus(null);
      setRid(r.id);
      setPhase("running");
    } catch {
      setErr("Couldn't start. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!rid || !status?.check || busy) return;
    setBusy(true);
    setErr("");
    try {
      const response = await startAuthentication({ optionsJSON: status.check.options });
      const r = await submitCheck(rid, response);
      if ("error" in r) setErr(r.error);
    } catch {
      setErr("Cancelled. Try again before the timer runs out.");
    } finally {
      setBusy(false);
      refresh();
    }
  }

  if (phase === "done") {
    return (
      <div className="stack">
        <p className="msg msg-ok" role="status">Retrieval complete. Reveal within 10 minutes.</p>
        <RevealBox id={secretId} />
      </div>
    );
  }

  if (phase === "running") {
    const since = status ? now - syncedAt.current : 0;
    const elapsed = status ? Math.min(status.requiredMs, status.elapsedMs + since) : 0;
    const left = status ? status.requiredMs - elapsed : minutes * 60000;
    const deadline = status?.check ? status.check.deadlineMs - since : 0;
    return (
      <div className="stack">
        <div className="clock" aria-live="off">
          <div><b>{mmss(left)}</b><span>left</span></div>
          <div><b>{status?.checks ?? 0}</b><span>check-ins done</span></div>
        </div>
        {status?.check ? (
          <>
            <p className="msg msg-err" role="alert">Check-in needed. Verify within {mmss(deadline)} or the retrieval resets.</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={verify} disabled={busy}>
              <Fingerprint size={18} /> {busy ? "Waiting for device…" : "Verify with passkey"}
            </button>
          </>
        ) : (
          <p className="hint">
            <Hourglass size={13} style={{ verticalAlign: -2 }} /> Keep this page open and your device nearby. A check-in
            appears at random times. Missing one resets the retrieval.
          </p>
        )}
        {err && <p className="msg msg-err" role="alert">{err}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={start} className="stack">
      {phase === "failed" && err && <p className="msg msg-err" role="alert">{err}</p>}
      <p className="hint">
        <Hourglass size={13} style={{ verticalAlign: -2 }} /> Retrieval takes {minutes} min. You stay on this page and
        pass a passkey check-in (Face ID, Touch ID or device PIN) at random times.
      </p>
      <div className="field">
        <label htmlFor="rp">Confirm your password</label>
        <input id="rp" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </div>
      {phase === "idle" && err && <p className="msg msg-err" role="alert">{err}</p>}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {phase === "failed" ? <RotateCcw size={16} /> : <Hourglass size={16} />} {busy ? "Starting…" : phase === "failed" ? "Start over" : "Start retrieval"}
      </button>
    </form>
  );
}
