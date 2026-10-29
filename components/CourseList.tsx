"use client";
import { useState } from "react";
import type { Course, Info, Placement, Program, Sets } from "@/lib/types";
import type { Crit } from "@/lib/critical";
import { code, title } from "@/lib/status";

interface Props {
  program: Program; info: Record<string, Info>; sel: Sets; crit?: Crit | null; placed: Record<string, Placement>;
  onToggle: (id: string) => void; onInfo: (id: string) => void;
  yearAll: boolean[]; yearOpen: boolean[]; onYear: (y: number) => void; modeLabel: string; children?: React.ReactNode;
}
const ICON = { done: "Done", enr: "Enrolled", plan: "Planned", ok: "", pre: "Locked", cr: "Credits" } as const;
const FILTERS = [["all", "All"], ["ok", "Available now"], ["left", "Not completed"]] as const;

/** Phone layout: the same courses as the flowchart, one semester per section. */
export default function CourseList({ program, info, sel, crit, placed, onToggle, onInfo, yearAll, yearOpen, onYear, modeLabel, children }: Props) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all");
  const show = (c: Course) => filter === "all" || (filter === "ok" ? info[c.id].status === "ok" : !sel.done.has(c.id));
  const terms = Array.from({ length: 8 }, (_, col) => ({ col, list: program.courses.filter((c) => c.row !== 7 && c.col === col).sort((a, b) => a.row - b.row) }));
  const summer = program.courses.filter((c) => c.row === 7);
  const card = (c: Course) => {
    const i = info[c.id], locked = i.status === "pre" || i.status === "cr";
    const glow = /^(GER|MJE|FRE)/.test(c.id) && (i.status === "done" || i.status === "enr") ? ` glow-${i.status}` : "";
    const filledBy = glow ? placed[c.id]?.code : undefined;
    const rem = !!crit && crit.remaining.has(c.id), isCrit = rem && crit!.critical.has(c.id);
    const slack = rem ? (isCrit ? "critical" : crit!.slack[c.id] > 0 ? `+${crit!.slack[c.id]} sem` : "") : "";
    const req = [c.pre.length ? "Needs " + c.pre.join(", ") : "", c.any?.length ? "one of " + c.any.join(" / ") : "", c.co.length ? "with/after " + c.co.join(", ") : "", c.minCr ? c.minCr + " cr standing" : ""].filter(Boolean).join(" · ");
    return (
      <div key={c.id} className="cwrap">
        <button className={`ccard ${i.status}${isCrit ? " crit" : ""}${glow}`} data-cat={c.cat} aria-disabled={locked} onClick={() => !locked && onToggle(c.id)}>
          <span className="ctop"><b>{code(c)}{filledBy ? ` · ${filledBy}` : ""}</b><em>{ICON[i.status]}</em><span className="ccr">{c.cr} cr{slack ? ` · ${slack}` : ""}</span></span>
          <span className="cname">{title(c)}</span>
          <span className="creq">{locked ? i.why : req || "No prerequisites"}</span>
        </button>
        <button className="cinfo" aria-label={`Details for ${c.id}`} onClick={() => onInfo(c.id)}>ⓘ</button>
      </div>
    );
  };
  return (
    <div className="clist">
      <div className="chips">{FILTERS.map(([k, l]) => <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>)}</div>
      {program.years.map((y, yi) => (
        <section key={y} className="cyear">
          <div className="cyh"><h2>{y}</h2>
            <button className="yearbtn" disabled={!yearOpen[yi]} onClick={() => onYear(yi)}>{yearAll[yi] ? "Clear year" : `Select year (${modeLabel})`}</button>
          </div>
          {[terms[yi * 2], terms[yi * 2 + 1]].map((t) => {
            const l = t.list.filter(show), extra = t.col === 5 ? summer.filter(show) : [];
            return (
              <div key={t.col} className="cterm">
                <h3>{t.col % 2 ? "Spring" : "Fall"}<span>{t.list.reduce((s, c) => s + c.cr, 0)} cr</span></h3>
                {l.length ? l.map(card) : <p className="cnone">Nothing to show</p>}
                {extra.length > 0 && <><h3 className="sum">Summer</h3>{extra.map(card)}</>}
              </div>
            );
          })}
        </section>
      ))}
      {children}
    </div>
  );
}
