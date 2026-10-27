"use client";
import { useMemo, useState } from "react";
import type { Course, Info, Program, Term } from "@/lib/types";
import { loadKind, METER } from "@/lib/load";
import { kindOf, recommend } from "@/lib/plan";

interface Props {
  program: Program; info: Record<string, Info>; doneCr: number; enrCr: number;
  chosen: Course[]; onPlan: (ids: string[]) => void; onUnplan: (id: string) => void; onCheck: () => void;
}
const TERMS: [Term, string][] = [["fall", "Fall"], ["spring", "Spring"], ["summer", "Summer"]];
const tag = (c: Course) => ({ GER: "GER", MJE: "Major elective", FRE: "Free elective", core: "" }[kindOf(c)]);
const short = (c: Course) => c.id.replace(/^(MJE|FRE)\d/, "$1").replace(/^GERSCI\d/, "GER-SCI");

/** Bottom-right tab: pick next semester's courses. Picks turn green and never unlock other courses. */
export default function Planner({ program, info, doneCr, enrCr, chosen, onPlan, onUnplan, onCheck }: Props) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState<Term>("fall");
  const { recommended, others } = useMemo(() => recommend(program, info, doneCr, term), [program, info, doneCr, term]);
  const chosenCr = chosen.reduce((t, c) => t + c.cr, 0);
  const kind = loadKind(chosenCr);
  const row = ({ c, score }: { c: Course; score: number }, star = false) => (
    <li key={c.id} className={star ? "star" : ""}>
      <span className="pr" title="Priority (10 = most important)">{score}</span>
      <span className="pn"><b>{short(c)}</b> {c.name.replace(/^GER-(Core|SCI) /, "")}
        <small>{c.cr} cr{tag(c) ? ` · ${tag(c)}` : ""}</small></span>
      <button onClick={() => onPlan([c.id])}>+ Plan</button>
    </li>
  );
  return (
    <div className="planner">
      {open && (
        <div className="plan-panel">
          <div className="seg">{TERMS.map(([t, l]) => <button key={t} className={term === t ? "on" : ""} onClick={() => setTerm(t)}>{l}</button>)}</div>
          <p className="note">Completed {doneCr} cr{enrCr ? ` · enrolled ${enrCr} cr` : ""}. Priority runs 0-10 (10 = most important). Chosen courses turn green and do not unlock other courses.</p>
          <div className={"meter " + kind}>
            <span>Planned load: <b>{chosenCr} cr</b> · {METER[kind]}</span>
            <small>Normal 15-17 · allowed 12-19</small>
            <button onClick={onCheck}>Check my plan</button>
          </div>
          {chosen.length > 0 && (<>
            <h4>Chosen · {chosenCr} cr</h4>
            <ul>{chosen.map((c) => (
              <li key={c.id} className="chosen">
                <span className="pr">✓</span>
                <span className="pn"><b>{short(c)}</b> {c.name.replace(/^GER-(Core|SCI) /, "")}<small>{c.cr} cr</small></span>
                <button onClick={() => onUnplan(c.id)} title="Remove">✕</button>
              </li>))}
            </ul>
          </>)}
          {recommended.length === 0 && <p className="note">Nothing more is open for registration in {term}.</p>}
          {recommended.length > 0 && (<>
            <h4>Highly recommended</h4>
            <ul>{recommended.map((r) => row(r, true))}</ul>
            <button className="primary" onClick={() => onPlan(recommended.map((r) => r.c.id))}>Choose these {recommended.length}</button>
          </>)}
          {others.length > 0 && (<><h4>Free to choose</h4><ul>{others.map((r) => row(r))}</ul></>)}
        </div>
      )}
      <button className={"plan-tab " + kind} onClick={() => setOpen(!open)}>📅 Next semester{chosen.length ? ` · ${chosenCr} cr` : ""} {open ? "▾" : "▴"}</button>
    </div>
  );
}
