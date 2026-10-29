import type { Course, Program, Sets } from "./types";
import { standing } from "./status";

export const PER_SEM = 17; // normal credit load per semester

export interface Crit {
  remaining: Set<string>;                 // courses not completed and not enrolled
  L: Record<string, number>;              // earliest semester (1 = next semester)
  slack: Record<string, number>;          // semesters a course can slip without delaying graduation
  critical: Set<string>;                  // slack 0
  pickAny: Record<string, string>;        // alternative used for "any one of" prerequisites
  chain: string[];                        // one longest critical chain, in order
  gated: Set<string>;                     // courses held back by a credit-standing rule rather than prerequisites
  finish: number;                         // semesters needed because of prerequisites
  creditBound: number;                    // semesters needed because of credit load
  grad: number;                           // expected semesters to graduate = max of both
  remainingCr: number;
  needed: (id: string) => Set<string>;    // remaining courses required before `id` (transitive)
}

/** Critical path method. Completed AND enrolled courses count as done; every other course takes one semester (the summer course none). */
export function analyze(p: Program, byId: Record<string, Course>, s: Sets): Crit {
  const have = (id: string) => s.done.has(id) || s.enr.has(id);
  const remaining = new Set(p.courses.filter((c) => !have(c.id)).map((c) => c.id));
  const st = standing(p, s);
  const summer = (c: Course) => c.row === 7;
  const bump = (c: Course) => (summer(c) ? 0 : 1); // a prerequisite must finish a semester earlier, except before the summer course
  const gated = new Set<string>(), L: Record<string, number> = {}, busy = new Set<string>(), pickAny: Record<string, string> = {};

  const lv = (id: string): number => {
    if (!remaining.has(id)) return 0;
    if (L[id] != null) return L[id];
    if (busy.has(id)) return 1; // mutual concurrent courses (e.g. a course and its lab)
    busy.add(id);
    const c = byId[id];
    let v = 1;
    for (const q of c.pre) if (remaining.has(q)) v = Math.max(v, lv(q) + bump(c));
    for (const q of c.co) if (remaining.has(q)) v = Math.max(v, lv(q));
    if (c.any?.length && !c.any.some(have)) {
      let best = c.any[0], bv = Infinity;
      for (const q of c.any) { const x = lv(q) + bump(c); if (x < bv) { bv = x; best = q; } }
      pickAny[id] = best; v = Math.max(v, bv);
    }
    if (c.minCr > st) { // credit standing needs earlier semesters
      const g = Math.ceil((c.minCr - st) / PER_SEM) + bump(c);
      if (g > v) gated.add(id);
      v = Math.max(v, g);
    }
    busy.delete(id);
    return (L[id] = v);
  };
  remaining.forEach(lv);

  const remainingCr = p.courses.reduce((t, c) => t + (remaining.has(c.id) ? c.cr : 0), 0);
  const finish = Math.max(0, ...[...remaining].map((id) => L[id]));
  const creditBound = Math.ceil(remainingCr / PER_SEM);
  const grad = remaining.size ? Math.max(finish, creditBound) : 0;

  // dependencies of each remaining course (only the chosen alternative for "any one of")
  const deps = (id: string): { q: string; w: number }[] => {
    const c = byId[id], out: { q: string; w: number }[] = [];
    if (!c) return out;
    for (const q of c.pre) if (remaining.has(q)) out.push({ q, w: bump(c) });
    for (const q of c.co) if (remaining.has(q)) out.push({ q, w: 0 });
    if (pickAny[id] && remaining.has(pickAny[id])) out.push({ q: pickAny[id], w: bump(c) });
    return out;
  };
  const succ: Record<string, { s: string; w: number }[]> = {};
  remaining.forEach((id) => deps(id).forEach(({ q, w }) => (succ[q] ||= []).push({ s: id, w })));
  const LS: Record<string, number> = {}, busy2 = new Set<string>();
  const ls = (id: string): number => {
    if (LS[id] != null) return LS[id];
    if (busy2.has(id)) return grad;
    busy2.add(id);
    let v = grad;
    for (const { s: x, w } of succ[id] || []) v = Math.min(v, ls(x) - w);
    busy2.delete(id);
    return (LS[id] = v);
  };
  const slack: Record<string, number> = {};
  remaining.forEach((id) => (slack[id] = Math.max(0, ls(id) - L[id])));
  const critical = new Set([...remaining].filter((id) => slack[id] === 0));

  // one longest critical chain, walked backwards from the latest critical course
  const chain: string[] = [];
  let cur = [...critical].sort((a, b) => L[b] - L[a])[0];
  while (cur) {
    chain.unshift(cur);
    cur = deps(cur).filter(({ q, w }) => critical.has(q) && L[q] + w === L[cur] && !chain.includes(q)).map((d) => d.q)[0];
  }

  const needed = (id: string) => {
    const seen = new Set<string>(), st2 = [id];
    while (st2.length) for (const { q } of deps(st2.pop()!)) if (!seen.has(q)) { seen.add(q); st2.push(q); }
    return seen;
  };
  return { remaining, L, slack, critical, pickAny, chain, gated, finish, creditBound, grad, remainingCr, needed };
}

/** "Spring 2027" etc. for semester n (1 = the next regular term). Summers are skipped. */
export function termLabel(n: number, now = new Date()) {
  const m = now.getMonth() + 1;
  let fall = m < 8, year = m >= 8 ? now.getFullYear() + 1 : now.getFullYear(); // Aug-Dec: next is Spring; otherwise next is Fall
  if (m >= 8) fall = false;
  for (let i = 1; i < n; i++) { if (fall) { fall = false; year++; } else fall = true; }
  return `${fall ? "Fall" : "Spring"} ${year}`;
}
