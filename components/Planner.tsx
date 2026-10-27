"use client";
import { useMemo, useState } from "react";
import type { Course, Info, Program, Term } from "@/lib/types";
import { kindOf, recommend } from "@/lib/plan";

interface Props { program: Program; info: Record<string, Info>; doneCr: number; enrCr: number; onPlan: (ids: string[]) => void; }
const TERMS: [Term, string][] = [["fall", "Fall"], ["spring", "Spring"], ["summer", "Summer"]];
const tag = (c: Course) => ({ GER: "GER", MJE: "Major elective", FRE: "Free elective", core: "" }[kindOf(c)]);

/** Bottom-right tab: what to register for next semester, ranked by priority (0-10). */
export default function Planner({ program, info, doneCr, enrCr, onPlan }: Props) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState<Term>("fall");
  const { recommended, others } = useMemo(() => recommend(program, info, doneCr, term), [program, info, doneCr, term]);
  const row = ({ c, score }: { c: Course; score: number }, star = false) => (
    <li key={c.id} className={star ? "star" : ""}>
      <span className="pr" title="Priority (10 = most important)">{score}</span>
      <span className="pn"><b>{c.id.replace(/^(MJE|FRE)\d/, "$1").replace(/^GERSCI\d/, "GER-SCI")}</b> {c.name.replace(/^GER-(Core|SCI) /, "")}
        <small>{c.cr} cr{tag(c) ? ` · ${tag(c)}` : ""}</small></span>
      <button onClick={() => onPlan([c.id])}>+ Plan</button>
    </li>
  );
  return (
    <div className="planner">
      {open && (
        <div className="plan-panel">
          <div className="seg">{TERMS.map(([t, l]) => <button key={t} className={term === t ? "on" : ""} onClick={() => setTerm(t)}>{l}</button>)}</div>
          <p className="note">Completed {doneCr} cr{enrCr ? ` · enrolled ${enrCr} cr` : ""}. Priority runs 0-10 (10 = most important).</p>
          {recommended.length === 0 && <p className="note">Nothing is open for registration in {term}. Mark what you are taking as <b>Enrolled</b> to unlock the next courses.</p>}
          {recommended.length > 0 && (<>
            <h4>Highly recommended</h4>
            <ul>{recommended.map((r) => row(r, true))}</ul>
            <button className="primary" onClick={() => onPlan(recommended.map((r) => r.c.id))}>Plan these {recommended.length}</button>
          </>)}
          {others.length > 0 && (<><h4>Free to choose</h4><ul>{others.map((r) => row(r))}</ul></>)}
        </div>
      )}
      <button className="plan-tab" onClick={() => setOpen(!open)}>📅 Next semester {open ? "▾" : "▴"}</button>
    </div>
  );
}
