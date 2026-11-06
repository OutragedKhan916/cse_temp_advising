/**
 * Course descriptions. One file per college in data/aus_courses/ (CAS.json, SBA.json, CEN.json, CAAD.json),
 * each keyed by course code. Every .json file in that folder is found automatically, so a new college is just a new file.
 */

/** One course. Every field is optional; anything extra you add is shown too. */
export interface CourseDoc { title?: string; credits?: number | string; description?: string; prerequisites?: string; corequisites?: string; offered?: string; [more: string]: unknown }

/* eslint-disable */
// @ts-ignore  (webpack reads every matching file in the folder at build time)
const files = require.context("../data/aus_courses", false, /^\.\/[A-Za-z]+\.json$/);
/* eslint-enable */

const norm = (code: string) => code.replace(/\s+/g, "").toUpperCase();
const index: Record<string, CourseDoc> = {};
for (const key of (files.keys() as string[]).sort()) {
  const college = key.replace(/^\.\//, "").replace(/\.json$/, "").toUpperCase(); // "./CEN.json" -> "CEN"
  const m = files(key) as any, docs = (m && m.default ? m.default : m) as Record<string, CourseDoc>;
  for (const [code, doc] of Object.entries(docs)) if (!(norm(code) in index)) index[norm(code)] = { college, ...doc };
}

/** description / information of a course by its code ("CMP120" or "CMP 120"), or undefined when it has not been added yet */
export const courseDoc = (code: string): CourseDoc | undefined => index[norm(code)];
