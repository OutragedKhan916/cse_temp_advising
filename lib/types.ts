export type Cat = "H" | "S" | "N" | "M" | "C" | "W" | "G";
export type Status = "done" | "enr" | "ok" | "pre" | "cr";
export type Sets = { done: Set<string>; enr: Set<string> };
export interface Course {
  id: string; name: string; cr: number; cat: Cat;
  col: number; row: number; pre: string[]; co: string[]; minCr: number;
}
export interface Program { name: string; total: number; years: string[]; courses: Course[]; }
export interface Info { status: Status; why: string; }
