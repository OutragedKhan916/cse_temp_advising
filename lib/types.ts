export type Cat = "H" | "S" | "N" | "M" | "C" | "W" | "G";
export type Status = "done" | "enr" | "plan" | "ok" | "pre" | "cr";
export type Sets = { done: Set<string>; enr: Set<string>; plan: Set<string> }; // plan = green picks: never unlock anything
export interface Course {
  id: string; name: string; cr: number; cat: Cat;
  col: number; row: number; pre: string[]; co: string[]; minCr: number; any?: string[]; priority?: number; terms?: Term[]; /* any = at least one of these (OR) */
}
export interface Program { name: string; total: number; years: string[]; courses: Course[]; }
export interface Info { status: Status; why: string; }

export type Term = "fall" | "spring" | "summer";
export interface Placement { code: string; kind: "done" | "enr"; confirm?: boolean }
export interface Extra { code: string; reason: string }
export interface Meta { placed: Record<string, Placement>; extras: Extra[] }
