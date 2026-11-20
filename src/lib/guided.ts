export type Task = {
  title: string;
  lines: string[];
  ask: string;
  check: (answer: string) => boolean;
};

const rnd = (n: number) => {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return b[0] % n;
};
const int = (lo: number, hi: number) => lo + rnd(hi - lo + 1);
const digits = (n: number) => Array.from({ length: n }, () => rnd(10)).join("");
const group = (s: string, n: number) => s.match(new RegExp(`.{1,${n}}`, "g"))!.join(" ");
const nums = (s: string) => s.match(/\d+/g) ?? [];

const MAKERS: (() => Task)[] = [
  () => {
    const d = digits(20);
    return { title: "Type this number", lines: [group(d, 4)], ask: "Number", check: (v) => v.replace(/\D/g, "") === d };
  },
  () => {
    const a = Array.from({ length: 7 }, () => int(10, 99));
    const sum = a.reduce((x, y) => x + y, 0);
    return { title: "Add these up", lines: [a.join(" + ")], ask: "Total", check: (v) => v.trim() === String(sum) };
  },
  () => {
    const d = digits(36);
    const t = String(rnd(10));
    const c = [...d].filter((x) => x === t).length;
    return { title: "Count the digit", lines: [group(d, 6)], ask: `How many ${t}s?`, check: (v) => v.trim() === String(c) };
  },
  () => {
    const set = new Set<number>();
    while (set.size < 6) set.add(int(100, 999));
    const a = [...set];
    const sorted = [...a].sort((x, y) => x - y).join(" ");
    return {
      title: "Sort smallest to largest",
      lines: [a.join("   ")],
      ask: "Sorted, spaces between",
      check: (v) => nums(v).map(Number).join(" ") === sorted,
    };
  },
  () => {
    const d = digits(10);
    const rev = [...d].reverse().join("");
    return { title: "Type it backwards", lines: [group(d, 5)], ask: "Reversed", check: (v) => v.replace(/\D/g, "") === rev };
  },
  () => {
    let cur = int(100, 999);
    const start = cur;
    const ops: string[] = [];
    for (let i = 0; i < 5; i++) {
      const n = int(10, 99);
      if (rnd(2) && cur >= n) {
        cur -= n;
        ops.push(`− ${n}`);
      } else {
        cur += n;
        ops.push(`+ ${n}`);
      }
    }
    return {
      title: "Start, then apply each step",
      lines: [String(start), ops.join("   ")],
      ask: "Result",
      check: (v) => v.trim() === String(cur),
    };
  },
];

/** Picks a random task type different from `prev`. */
export function nextTask(prev: number): { task: Task; kind: number } {
  let kind = rnd(MAKERS.length);
  if (kind === prev) kind = (kind + 1 + rnd(MAKERS.length - 1)) % MAKERS.length;
  return { task: MAKERS[kind](), kind };
}
