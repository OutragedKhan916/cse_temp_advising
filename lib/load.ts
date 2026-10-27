import type { Course } from "./types";

/** Semester credit load rules: 15-17 normal, 12-14 and 18-19 not recommended, below 12 or above 19 not permitted. */
export const LOAD = { min: 12, normalMin: 15, normalMax: 17, max: 19 };
export type LoadKind = "none" | "under" | "low" | "ok" | "high" | "over";
export interface Notice { level: "ok" | "warn" | "error"; title: string; msg: string }

export function loadKind(cr: number): LoadKind {
  if (cr <= 0) return "none";
  if (cr < LOAD.min) return "under";
  if (cr < LOAD.normalMin) return "low";
  if (cr <= LOAD.normalMax) return "ok";
  if (cr <= LOAD.max) return "high";
  return "over";
}
export const METER: Record<LoadKind, string> = {
  none: "pick courses to plan", under: "keep adding: at least 12 needed", low: "light load, not recommended",
  ok: "normal load", high: "heavy load, not recommended", over: "above the 19-credit maximum",
};
const normal = `A normal student takes ${LOAD.normalMin}-${LOAD.normalMax} credits per semester.`;

export function noticeFor(kind: LoadKind, cr: number, blocked: Course[] = []): Notice {
  switch (kind) {
    case "low": return { level: "warn", title: "Warning: not recommended", msg: `${cr} credits is a light load. ${normal} The minimum allowed is ${LOAD.min}.` };
    case "high": return { level: "warn", title: "Warning: not recommended", msg: `${cr} credits is a heavy load. ${normal} The maximum allowed is ${LOAD.max}.` };
    case "under": return { level: "error", title: "Not allowed: too few credits", msg: `You have planned ${cr} credits. A semester needs at least ${LOAD.min} credits. ${normal}` };
    case "over": return { level: "error", title: "Not allowed: too many credits", msg: blocked.length
      ? `Adding ${blocked.map((c) => c.id).join(", ")} would pass the ${LOAD.max}-credit maximum, so ${blocked.length > 1 ? "they were" : "it was"} not added. ${normal}`
      : `${cr} credits is above the ${LOAD.max}-credit maximum. ${normal}` };
    case "ok": return { level: "ok", title: "Normal load", msg: `${cr} credits is within the normal range (${LOAD.normalMin}-${LOAD.normalMax}).` };
    default: return { level: "ok", title: "Nothing planned yet", msg: "Choose courses for next semester first." };
  }
}
