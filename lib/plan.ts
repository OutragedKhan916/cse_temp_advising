import type { Course, Info, Program, Term } from "./types";

export const kindOf = (c: Course) => (/^GER/.test(c.id) ? "GER" : /^MJE/.test(c.id) ? "MJE" : /^FRE/.test(c.id) ? "FRE" : "core");

/**
 * Priority 0-10 (10 = most important). A course can set its own `priority` in the JSON;
 * otherwise core courses score by how many later courses depend on them (3 to 10), and electives get a low fixed score.
 */
export function basePriorities(p: Program): Record<string, number> {
  const rev: Record<string, string[]> = {};
  for (const c of p.courses) for (const d of [...c.pre, ...(c.any || []), ...c.co]) (rev[d] ||= []).push(c.id);
  const count = (id: string) => {
    const seen = new Set<string>(), st = [id];
    while (st.length) for (const n of rev[st.pop()!] || []) if (!seen.has(n)) { seen.add(n); st.push(n); }
    return seen.size;
  };
  const cnt = Object.fromEntries(p.courses.map((c) => [c.id, count(c.id)]));
  const max = Math.max(1, ...Object.values(cnt));
  const out: Record<string, number> = {};
  for (const c of p.courses) {
    const k = kindOf(c);
    const auto = k === "core" ? 3 + Math.round((7 * cnt[c.id]) / max)
      : k === "GER" ? (c.id === "GERSEL" ? 2 : c.id.startsWith("GERSCI") ? 4 : 3) : k === "MJE" ? 2 : 1;
    out[c.id] = Math.max(0, Math.min(10, c.priority ?? auto));
  }
  return out;
}

/** 0-3: which year of the plan the student has reached, from completed credits */
export function yearLevel(p: Program, doneCr: number) {
  let sum = 0, level = 0;
  for (const y of p.years) { sum += Number(y.match(/(\d+)\s*cr/)?.[1] ?? 0); if (doneCr >= sum) level++; }
  return Math.min(3, level);
}

export const offered = (c: Course, t: Term) => (c.terms ? c.terms.includes(t) : c.row === 7 ? t === "summer" : t !== "summer");

/** Open courses for the chosen semester, best first. The top 3 are "highly recommended", the rest are "free to choose". */
export function recommend(p: Program, info: Record<string, Info>, doneCr: number, term: Term) {
  const base = basePriorities(p), level = yearLevel(p, doneCr);
  const score = (c: Course) => {
    const year = c.row === 7 ? 3 : c.col >> 1;
    return Math.max(0, Math.min(10, base[c.id] + (year < level ? 2 : year === level ? 1 : -1)));
  };
  const list = p.courses.filter((c) => info[c.id].status === "ok" && offered(c, term))
    .map((c) => ({ c, score: score(c) })).sort((a, b) => b.score - a.score || a.c.col - b.c.col || a.c.row - b.c.row);
  return { recommended: list.slice(0, 3), others: list.slice(3) };
}
