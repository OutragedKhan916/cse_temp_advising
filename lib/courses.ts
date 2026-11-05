import all from "@/data/aus_courses.json";

/** One course in data/aus_courses.json. Every field is optional; anything extra you add is shown too. */
export interface CourseDoc { title?: string; credits?: number | string; description?: string; prerequisites?: string; corequisites?: string; offered?: string; [more: string]: unknown }

const DOCS = all as unknown as Record<string, CourseDoc>;
const norm = (code: string) => code.replace(/\s+/g, "").toUpperCase();
const index: Record<string, CourseDoc> = Object.fromEntries(Object.entries(DOCS).map(([k, v]) => [norm(k), v]));

/** description / information of a course by its code ("CMP120" or "CMP 120"), or undefined when it has not been added yet */
export const courseDoc = (code: string): CourseDoc | undefined => index[norm(code)];
