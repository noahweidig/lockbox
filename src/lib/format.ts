export function formatDuration(ms: number): string {
  if (ms <= 0) return "0m";
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${mm}m`;
  return `${Math.max(mm, 1)}m`;
}

export const KINDS: Record<string, string> = {
  screentime: "Screen Time passcode",
  password: "Password",
  pin: "PIN",
  note: "Secret note",
};
