"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Mode = "system" | "light" | "dark";
const ORDER: Mode[] = ["system", "light", "dark"];

function apply(mode: Mode) {
  const root = document.documentElement;
  if (mode === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("lb-theme") as Mode | null;
      if (saved && ORDER.includes(saved)) setMode(saved);
    } catch {}
  }, []);

  function next() {
    const m = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
    setMode(m);
    apply(m);
    try {
      if (m === "system") localStorage.removeItem("lb-theme");
      else localStorage.setItem("lb-theme", m);
    } catch {}
  }

  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;
  return (
    <button type="button" className="theme-btn" onClick={next} aria-label={`Theme: ${mode}. Click to change`} title={`Theme: ${mode}`}>
      <Icon size={18} />
    </button>
  );
}
