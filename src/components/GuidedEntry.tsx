"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Eye, RotateCcw, Shield } from "lucide-react";
import { createGuidedSecret } from "@/app/actions/secrets";
import { DurationField } from "@/components/SecretFields";
import { nextTask, type Task } from "@/lib/guided";

const PER_ROUND = 4;
const TOTAL = PER_ROUND * 2;
const SHOW_SECONDS = 6;
const ROUND_BREAK_TASKS = 3;

type Phase = "setup" | "task" | "show" | "hidden" | "done";

export function GuidedEntry() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [secret, setSecret] = useState<{ id: string; code: string } | null>(null);
  const [pos, setPos] = useState(0);
  const [tasksLeft, setTasksLeft] = useState(1);
  const [task, setTask] = useState<Task | null>(null);
  const [answer, setAnswer] = useState("");
  const [wrong, setWrong] = useState(false);
  const [left, setLeft] = useState(SHOW_SECONDS);
  const lastKind = useRef(-1);

  function newTask() {
    const { task: t, kind } = nextTask(lastKind.current);
    lastKind.current = kind;
    setTask(t);
    setAnswer("");
    setWrong(false);
  }

  function goTo(p: number, count: number) {
    setPos(p);
    setTasksLeft(count);
    newTask();
    setPhase("task");
  }

  useEffect(() => {
    if (phase !== "show") return;
    if (left <= 0) {
      setPhase("hidden");
      return;
    }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, left]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setErr("");
    try {
      const r = await createGuidedSecret(fd);
      if ("error" in r) return setErr(r.error);
      setSecret(r);
      goTo(0, 1);
    } catch {
      setErr("Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function submitTask(e: React.FormEvent) {
    e.preventDefault();
    if (!task) return;
    if (!task.check(answer)) return setWrong(true);
    if (tasksLeft > 1) {
      setTasksLeft(tasksLeft - 1);
      newTask();
      return;
    }
    setLeft(SHOW_SECONDS);
    setPhase("show");
  }

  function entered() {
    if (pos === TOTAL - 1) return setPhase("done");
    const next = pos + 1;
    goTo(next, next === PER_ROUND ? ROUND_BREAK_TASKS : 1);
  }

  if (phase === "setup" || !secret) {
    return (
      <div className="card">
        <form onSubmit={save} className="stack">
          <p className="hint">
            <Shield size={13} style={{ verticalAlign: -2 }} /> A random 4-digit code is generated and locked first. You
            then enter it on the iPhone twice (enter, re-enter). Each digit appears only after a number task, shows for{" "}
            {SHOW_SECONDS} seconds, then hides.
          </p>
          <div className="field">
            <label htmlFor="label">Name</label>
            <input id="label" name="label" defaultValue="iPhone Screen Time" maxLength={80} required />
          </div>
          <DurationField />
          <p className="hint">
            On the iPhone, open Screen Time and start setting or changing the passcode, then come back here. If it offers
            Apple Account recovery, skip it, since that route can reset the code. Keep this tab open until the end; the
            code can&apos;t be read back until the lock ends.
          </p>
          {err && <p className="msg msg-err" role="alert">{err}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Locking…" : "Generate, lock and start"}
          </button>
        </form>
      </div>
    );
  }

  const round = Math.floor(pos / PER_ROUND) + 1;
  const digit = pos % PER_ROUND;

  return (
    <div className="card stack">
      <div className="guided-dots" aria-hidden>
        {Array.from({ length: TOTAL }, (_, i) => (
          <i key={i} className={i < pos || phase === "done" ? "done" : i === pos ? "now" : ""} />
        ))}
      </div>

      {phase !== "done" && (
        <div>
          <h3>
            {round === 1 ? "Enter the passcode" : "Re-enter the passcode"} · digit {digit + 1} of {PER_ROUND}
          </h3>
          <p className="hint">
            {round === 1
              ? "iPhone screen: enter new passcode."
              : "iPhone screen: re-enter the passcode to confirm."}
          </p>
        </div>
      )}

      {phase === "task" && task && (
        <form onSubmit={submitTask} className="stack">
          <h3>{task.title}</h3>
          <div className="taskbox mono">
            {task.lines.map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </div>
          <div className="field">
            <label htmlFor="ans">{task.ask}</label>
            <input
              id="ans"
              value={answer}
              onChange={(e) => {
                setAnswer(e.target.value);
                setWrong(false);
              }}
              onPaste={(e) => e.preventDefault()}
              autoComplete="off"
              autoCapitalize="off"
              inputMode="text"
              className="mono"
              autoFocus
            />
          </div>
          {tasksLeft > 1 && <p className="hint">Round break: {tasksLeft} tasks left before the next digit.</p>}
          {wrong && <p className="msg msg-err" role="alert">Not right. Check and try again.</p>}
          <button type="submit" className="btn btn-primary">Check</button>
        </form>
      )}

      {phase === "show" && (
        <div className="stack">
          <div className="bigdigit mono" role="status" aria-label={`Digit ${secret.code[digit]}`}>
            {secret.code[digit]}
          </div>
          <div className="timerbar" aria-hidden>
            <i style={{ width: `${(left / SHOW_SECONDS) * 100}%` }} />
          </div>
          <p className="hint">Tap it on the iPhone now. It hides in {left}s.</p>
          <button className="btn btn-primary" onClick={entered}>Entered it</button>
        </div>
      )}

      {phase === "hidden" && (
        <div className="stack">
          <div className="bigdigit mono" aria-hidden>•</div>
          <button className="btn btn-primary" onClick={entered}>Entered it</button>
          <button className="btn btn-ghost" onClick={() => goTo(pos, 1)}>
            <Eye size={16} /> Missed it, do another task to see it again
          </button>
        </div>
      )}

      {phase === "done" && (
        <div className="stack">
          <h3>Both rounds done</h3>
          <p className="msg msg-ok" role="status">
            The iPhone should have accepted the passcode. It is locked in your vault; don&apos;t try to remember it.
          </p>
          <Link href={`/vault/${secret.id}`} className="btn btn-primary">Open the lock</Link>
          <button className="btn btn-ghost" onClick={() => goTo(0, 1)}>
            <RotateCcw size={16} /> iPhone said the codes didn&apos;t match, redo
          </button>
        </div>
      )}
    </div>
  );
}
