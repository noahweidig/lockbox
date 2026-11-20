"use client";

import { useState } from "react";
import { Dices, Eye, EyeOff } from "lucide-react";

export function PasscodeField() {
  const [value, setValue] = useState("");
  const [shown, setShown] = useState(false);
  const [len, setLen] = useState(6);

  function generate() {
    const buf = new Uint32Array(len);
    crypto.getRandomValues(buf);
    setValue(Array.from(buf, (n) => n % 10).join(""));
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
        <select value={len} onChange={(e) => setLen(+e.target.value)} aria-label="Digits">
          <option value={4}>4 digits</option>
          <option value={6}>6 digits</option>
          <option value={8}>8 digits</option>
        </select>
        <button type="button" className="btn btn-ghost" onClick={generate}>
          <Dices size={18} /> Generate random passcode
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

export function DurationField({ defaultMinutes = 1440, label = "Lock for" }: { defaultMinutes?: number; label?: string }) {
  const [mins, setMins] = useState(defaultMinutes);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const rest = mins % 60;

  const set = (d: number, h: number, m: number) => setMins(Math.max(0, d) * 1440 + Math.max(0, h) * 60 + Math.max(0, m));

  return (
    <div className="field">
      <span className="label">{label}</span>
      <input type="hidden" name="minutes" value={mins} />
      <div className="chips">
        {PRESETS.map(([t, m]) => (
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
