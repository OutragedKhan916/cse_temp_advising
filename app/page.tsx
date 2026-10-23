"use client";
import { useEffect, useMemo, useState } from "react";
import cmp from "@/data/cmp.json";
import coe from "@/data/coe.json";
import Flowchart from "@/components/Flowchart";
import { earned, infoFor } from "@/lib/status";
import type { Course, Program, Status } from "@/lib/types";

const PROGRAMS: Record<string, Program> = { CMP: cmp as Program, COE: coe as Program };
const LEGEND: [Status, string][] = [["done", "Completed"], ["ok", "Can be taken"], ["pre", "Locked by prerequisite"], ["cr", "Locked by credits"]];
const CATS = [["H", "Hardware"], ["S", "Software"], ["N", "Networking"], ["M", "Mathematics"], ["C", "Sciences"], ["W", "Academic writing"], ["G", "General / electives"]];

export default function Page() {
  const [key, setKey] = useState("CMP");
  const [done, setDone] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const program = PROGRAMS[key];
  const byId = useMemo(() => Object.fromEntries(program.courses.map((c) => [c.id, c])) as Record<string, Course>, [program]);

  useEffect(() => { // load saved progress per program
    try { setDone(new Set(JSON.parse(localStorage.getItem("advising-" + key) || "[]"))); } catch { setDone(new Set()); }
    setReady(true);
  }, [key]);
  useEffect(() => { if (ready) try { localStorage.setItem("advising-" + key, JSON.stringify([...done])); } catch {} }, [done, key, ready]);

  const cr = earned(program, done);
  const info = useMemo(() => Object.fromEntries(program.courses.map((c) => [c.id, infoFor(c, byId, done, cr)])), [program, byId, done, cr]);
  const count = (s: Status) => program.courses.filter((c) => info[c.id].status === s).length;
  const toggle = (id: string) => setDone((d) => { const n = new Set(d); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const sel = hover ? byId[hover] : null;

  return (
    <main>
      <header>
        <h1>Advising Portal</h1>
        <nav>{Object.entries(PROGRAMS).map(([k, p]) => (
          <button key={k} className={k === key ? "on" : ""} onClick={() => { setReady(false); setHover(null); setKey(k); }}>{p.name}</button>))}</nav>
        <div className="progress">
          <span>{cr} / {program.total} credits completed</span>
          <div><i style={{ width: Math.min(100, (cr / program.total) * 100) + "%" }} /></div>
        </div>
        <button className="ghost" onClick={() => confirm("Clear all completed courses for this program?") && setDone(new Set())}>Clear progress</button>
      </header>

      <div className="legend">
        {LEGEND.map(([s, l]) => <span key={s} className={"chip " + s}>{l} <b>{count(s)}</b></span>)}
        <span className="dash">Prerequisite / concurrent</span>
        {CATS.map(([c, l]) => <span key={c} className="cat" data-cat={c}>{l}</span>)}
      </div>

      <div className="layout">
        <div className="scroll"><Flowchart program={program} byId={byId} info={info} hover={hover} onHover={setHover} onToggle={toggle} /></div>
        <aside>
          {sel ? (<>
            <h2>{sel.id}</h2><p>{sel.name}</p>
            <p className={"chip " + info[sel.id].status}>{info[sel.id].why}</p>
            <dl>
              <dt>Credits</dt><dd>{sel.cr}</dd>
              <dt>Prerequisites</dt><dd>{sel.pre.join(", ") || "None"}</dd>
              {sel.co.length > 0 && <><dt>Prerequisite / concurrent</dt><dd>{sel.co.join(", ")}</dd></>}
              {sel.minCr > 0 && <><dt>Standing</dt><dd>{sel.minCr} credits completed</dd></>}
            </dl>
          </>) : <p className="hint">Click a course to mark it completed. Hover to trace everything it depends on. Progress saves in this browser.</p>}
        </aside>
      </div>
    </main>
  );
}
