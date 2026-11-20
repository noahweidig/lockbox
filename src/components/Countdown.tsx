"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/format";

export function Countdown({ until, full }: { until: string; full?: boolean }) {
  const target = new Date(until).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return <span className="mono">…</span>;
  const left = target - now;
  if (left <= 0) return <span className="mono">Unlocked</span>;
  if (!full) return <span className="mono">{formatDuration(left)}</span>;
  const s = Math.floor(left / 1000);
  const d = Math.floor(s / 86400);
  const parts = [d, Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60];
  const labels = ["days", "hrs", "min", "sec"];
  return (
    <div className="clock" aria-live="off">
      {parts.map((p, i) => (
        <div key={i}>
          <b>{String(p).padStart(2, "0")}</b>
          <span>{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}
