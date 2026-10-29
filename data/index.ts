/**
 * Data registry. Everything is found automatically from the folder names, so adding data means adding files:
 *
 *   data/ger.json                                        GER categories: the same for everyone
 *   data/catalogs/<DEPT>/<MAJOR>/mje.json                major electives of that major (all years)
 *   data/catalogs/<DEPT>/<MAJOR>/<YYYY-YYYY>/catalog.json  course chart of that major in that catalog year
 *
 * New catalog year -> add a folder like 2027-2028/ with a catalog.json. It shows up on the start screen by itself.
 * New major / department -> add the folders (with mje.json and a year). Optional: a full department name below.
 */
import type { GerData, MjeData } from "@/lib/transcript";
import type { Program } from "@/lib/types";
import ger from "./ger.json";

/** optional pretty names for department folders; an unlisted department just shows its code */
const DEPARTMENT_NAMES: Record<string, string> = { CSE: "Computer Science & Engineering" };

export interface Major { code: string; name: string; mje: MjeData[string]; years: Record<string, Program> }
export interface Department { code: string; name: string; majors: Major[] }

/** Drop prerequisites that point to a missing course or to the course itself, so a typo in a JSON file cannot crash the page. */
function clean(p: Program): Program {
  const ids = new Set(p.courses.map((c) => c.id));
  const ok = (x: string, self: string) => {
    const good = x !== self && ids.has(x);
    if (!good) console.warn(`${p.name}: ${self} has an invalid prerequisite "${x}" (ignored)`);
    return good;
  };
  return { ...p, courses: p.courses.map((c) => ({ ...c, pre: c.pre.filter((x) => ok(x, c.id)), co: c.co.filter((x) => ok(x, c.id)), any: c.any?.filter((x) => ok(x, c.id)) })) };
}

export const GER = ger as unknown as GerData;

// webpack reads every matching file in the folder at build time (this is what makes new folders appear automatically)
/* eslint-disable */
// @ts-ignore
const charts = require.context("./catalogs", true, /^\.\/[^/]+\/[^/]+\/\d{4}-\d{4}\/catalog\.json$/);
// @ts-ignore
const electives = require.context("./catalogs", true, /^\.\/[^/]+\/[^/]+\/mje\.json$/);
/* eslint-enable */
const load = (ctx: any, key: string) => { const m = ctx(key); return (m && m.default ? m.default : m) as any; };

function build(): Department[] {
  const depts = new Map<string, Map<string, Major>>();
  for (const key of charts.keys() as string[]) {
    const [, dept, major, year] = key.split("/"); // "./CSE/CMP/2026-2027/catalog.json"
    const program = clean(load(charts, key) as Program);
    const mjeKey = `./${dept}/${major}/mje.json`;
    const mje = ((electives.keys() as string[]).includes(mjeKey) ? load(electives, mjeKey) : { eligible: [], confirm: [] }) as MjeData[string];
    const majors = depts.get(dept) ?? depts.set(dept, new Map()).get(dept)!;
    const m = majors.get(major) ?? { code: major, name: program.name.split(" · ")[0].replace(/\s*\([A-Z]+\)\s*$/, ""), mje, years: {} };
    m.years[year] = program;
    majors.set(major, m);
  }
  return [...depts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([code, majors]) => ({
    code, name: DEPARTMENT_NAMES[code] ?? code, majors: [...majors.values()].sort((a, b) => a.code.localeCompare(b.code)),
  }));
}
export const DEPARTMENTS: Department[] = build();

export const yearLabel = (y: string) => y.replace("-", "–");
const allMajors = () => DEPARTMENTS.flatMap((d) => d.majors);
export const findMajor = (code: string) => allMajors().find((m) => m.code === code);
export const departmentOf = (code: string) => DEPARTMENTS.find((d) => d.majors.some((m) => m.code === code));
/** catalog years a major has, newest first */
export const yearsFor = (code: string) => Object.keys(findMajor(code)?.years ?? {}).sort().reverse();
/** where the app starts: the first major, in its newest catalog year */
export const DEFAULT_KEY = allMajors()[0].code;
export const DEFAULT_YEAR = yearsFor(DEFAULT_KEY)[0];

/** Everything the app needs for one catalog year: the charts of all majors that have it, the electives, the GER lists. */
export function getCatalog(year: string) {
  const programs: Record<string, Program> = {}, mje: MjeData = {};
  for (const m of allMajors()) if (m.years[year]) { programs[m.code] = m.years[year]; mje[m.code] = m.mje; }
  return { year, label: yearLabel(year), programs, mje, ger: GER };
}
