import type { Course, Info, Program, Sets } from "./types";

export const earned = (p: Program, done: Set<string>) =>
  p.courses.reduce((s, c) => s + (done.has(c.id) ? c.cr : 0), 0);

/** Can this course be registered right now? (ignores whether it is already selected) */
export function lockInfo(c: Course, byId: Record<string, Course>, s: Sets, cr: number): Info {
  const need = [
    ...c.pre.filter((p) => !s.done.has(p)),
    // a concurrent course counts if it is done, enrolled, or itself registrable
    ...c.co.filter((p) => !s.done.has(p) && !s.enr.has(p) && byId[p].pre.some((q) => !s.done.has(q))),
  ];
  if (need.length) return { status: "pre", why: "Locked: needs " + need.join(", ") };
  if (cr < c.minCr) return { status: "cr", why: `Locked: needs ${c.minCr} credits completed (${cr} so far)` };
  return { status: "ok", why: "Open for registration" };
}

export function infoFor(c: Course, byId: Record<string, Course>, s: Sets, cr: number): Info {
  if (s.done.has(c.id)) return { status: "done", why: "Completed" };
  if (s.enr.has(c.id)) return { status: "enr", why: "Currently enrolled" };
  return lockInfo(c, byId, s, cr);
}

/** Un-select anything that is no longer allowed (e.g. after clearing one of its prerequisites). Mutates s. */
export function normalize(p: Program, byId: Record<string, Course>, s: Sets) {
  for (let changed = true; changed; ) {
    changed = false;
    const cr = earned(p, s.done);
    for (const c of p.courses)
      if ((s.done.has(c.id) || s.enr.has(c.id)) && lockInfo(c, byId, s, cr).status !== "ok") {
        s.done.delete(c.id); s.enr.delete(c.id); changed = true;
      }
  }
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
