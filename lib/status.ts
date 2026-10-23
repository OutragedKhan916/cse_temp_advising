import type { Course, Info, Program } from "./types";

export const earned = (p: Program, done: Set<string>) =>
  p.courses.reduce((s, c) => s + (done.has(c.id) ? c.cr : 0), 0);

export function infoFor(c: Course, byId: Record<string, Course>, done: Set<string>, cr: number): Info {
  if (done.has(c.id)) return { status: "done", why: "Completed" };
  const miss = c.pre.filter((p) => !done.has(p));
  const coMiss = c.co.filter((p) => !done.has(p) && byId[p].pre.some((q) => !done.has(q)));
  const need = [...miss, ...coMiss];
  if (need.length) return { status: "pre", why: "Needs " + need.join(", ") };
  if (cr < c.minCr) return { status: "cr", why: `Needs ${c.minCr} credits completed (${cr} so far)` };
  const conc = c.co.filter((p) => !done.has(p));
  return { status: "ok", why: "Available now" + (conc.length ? ", together with " + conc.join(", ") : "") };
}

/** every course this one depends on, directly or indirectly */
export function chain(id: string, byId: Record<string, Course>): Set<string> {
  const seen = new Set([id]), stack = [id];
  while (stack.length) {
    const c = byId[stack.pop()!];
    for (const p of [...c.pre, ...c.co]) if (!seen.has(p)) { seen.add(p); stack.push(p); }
  }
  return seen;
}

export function code(c: Course) {
  if (c.id.startsWith("GERSCI")) return "GER-SCI";
  if (/^(MJE|FRE)\d$/.test(c.id)) return c.id.slice(0, 3);
  if (c.id.startsWith("GER")) return "GER-Core";
  return c.id;
}
export const title = (c: Course) => c.name.replace(/^GER-(Core|SCI) /, "");
