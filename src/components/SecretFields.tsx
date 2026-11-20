"use client";

import { useState } from "react";
import { Dices, Eye, EyeOff } from "lucide-react";

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.?";

const GEN = {
  digits: { label: "Digits only", sets: [DIGITS], lens: [4, 6, 8], def: 6 },
  alnum: { label: "Letters + digits", sets: [LOWER, UPPER, DIGITS], lens: [12, 16, 20, 24, 32], def: 16 },
  full: { label: "Letters + digits + symbols", sets: [LOWER, UPPER, DIGITS, SYMBOLS], lens: [12, 16, 20, 24, 32], def: 16 },
};
type GenKind = keyof typeof GEN;

function randomString(sets: string[], len: number) {
  const all = sets.join("");
  const max = Math.floor(0x100000000 / all.length) * all.length;
  const buf = new Uint32Array(1);
  for (;;) {
    let out = "";
    while (out.length < len) {
      crypto.getRandomValues(buf);
      if (buf[0] < max) out += all[buf[0] % all.length];
    }
    if (sets.every((s) => [...out].some((c) => s.includes(c)))) return out;
  }
}

export function PasscodeField() {
  const [value, setValue] = useState("");
  const [shown, setShown] = useState(false);
  const [kind, setKind] = useState<GenKind>("digits");
  const [len, setLen] = useState(GEN.digits.def);

  function generate() {
    setValue(randomString(GEN[kind].sets, len));
    setShown(true);
  }

  return (
    <div className="field">
      <label htmlFor="value">Passcode or secret</label>
      <div className="row">
        <input
          id="value"
          name="value"
          type={shown ? "text" : "password"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          required
          maxLength={2000}
          className="mono"
        />
        <button type="button" className="btn btn-ghost" onClick={() => setShown((s) => !s)} aria-label={shown ? "Hide" : "Show"}>
          {shown ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      <div className="row gen">
        <select
          value={kind}
          onChange={(e) => {
            const k = e.target.value as GenKind;
            setKind(k);
            setLen(GEN[k].def);
          }}
          aria-label="Character types"
        >
          {Object.entries(GEN).map(([k, g]) => <option key={k} value={k}>{g.label}</option>)}
        </select>
        <select value={len} onChange={(e) => setLen(+e.target.value)} aria-label="Length">
          {GEN[kind].lens.map((n) => <option key={n} value={n}>{n} {kind === "digits" ? "digits" : "chars"}</option>)}
        </select>
        <button type="button" className="btn btn-ghost" onClick={generate}>
          <Dices size={18} /> Generate random
        </button>
      </div>
      <p className="hint">
        Generate one, set it in Screen Time, paste it here, then don&apos;t memorize it. You can&apos;t read it back until the lock ends.
      </p>
    </div>
  );
}

const PRESETS: [string, number][] = [
  ["1 hour", 60],
  ["6 hours", 360],
  ["1 day", 1440],
  ["3 days", 4320],
  ["1 week", 10080],
  ["2 weeks", 20160],
  ["30 days", 43200],
  ["90 days", 129600],
];

export const RETRIEVAL_PRESETS: [string, number][] = [
  ["Off", 0],
  ["5 min", 5],
  ["15 min", 15],
  ["30 min", 30],
  ["1 hour", 60],
  ["2 hours", 120],
];

export function DurationField({
  defaultMinutes = 1440,
  label = "Lock for",
  name = "minutes",
  presets = PRESETS,
  maxMinutes = 365 * 1440,
}: {
  defaultMinutes?: number;
  label?: string;
  name?: string;
  presets?: [string, number][];
  maxMinutes?: number;
}) {
  const [mins, setMins] = useState(defaultMinutes);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const rest = mins % 60;

  const set = (d: number, h: number, m: number) =>
    setMins(Math.min(maxMinutes, Math.max(0, d) * 1440 + Math.max(0, h) * 60 + Math.max(0, m)));

  return (
    <div className="field">
      <span className="label">{label}</span>
      <input type="hidden" name={name} value={mins} />
      <div className="chips">
        {presets.map(([t, m]) => (
          <button type="button" key={m} className={`chip ${mins === m ? "on" : ""}`} onClick={() => setMins(m)}>
            {t}
          </button>
        ))}
      </div>
      <div className="row dur">
        <label>
          <input type="number" min={0} max={365} value={days} onChange={(e) => set(+e.target.value, hours, rest)} />
          days
        </label>
        <label>
          <input type="number" min={0} max={23} value={hours} onChange={(e) => set(days, +e.target.value, rest)} />
          hours
        </label>
        <label>
          <input type="number" min={0} max={59} value={rest} onChange={(e) => set(days, hours, +e.target.value)} />
          min
        </label>
      </div>
    </div>
  );
}

export function RetrievalField() {
  return (
    <div className="stack">
      <DurationField
        name="retrieval"
        label="Retrieval task"
        defaultMinutes={0}
        presets={RETRIEVAL_PRESETS}
        maxMinutes={120}
      />
      <p className="hint">
        To read this later you must stay on the page this long and pass a Face ID, Touch ID or device-PIN passkey
        check-in every few minutes. Needs a passkey added in Settings. Off by default.
      </p>
    </div>
  );
}
