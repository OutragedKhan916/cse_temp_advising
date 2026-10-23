"use client";
import { useEffect, useMemo, useState } from "react";
import cmp from "@/data/cmp.json";
import coe from "@/data/coe.json";
import Flowchart from "@/components/Flowchart";
import { earned, infoFor, lockInfo, normalize } from "@/lib/status";
import type { Course, Program, Sets, Status } from "@/lib/types";

const PROGRAMS: Record<string, Program> = { CMP: cmp as unknown as Program, COE: coe as unknown as Program };
const LEGEND: [Status, string][] = [["done", "Completed"], ["enr", "Currently enrolled"], ["ok", "Can register"], ["pre", "Locked · prerequisite 🔒"], ["cr", "Locked · credits ⏳"]];
const CATS = [["H", "Hardware"], ["S", "Software"], ["N", "Networking"], ["M", "Mathematics"], ["C", "Sciences"], ["W", "Academic writing"], ["G", "General / electives"]];
const clone = (s: Sets): Sets => ({ done: new Set(s.done), enr: new Set(s.enr) });

export default function Page() {
  const [key, setKey] = useState("CMP");
  const [sel, setSel] = useState<Sets>({ done: new Set(), enr: new Set() });
  const [mode, setMode] = useState<"done" | "enr">("done");
  const [hover, setHover] = useState<string | null>(null);
  const [theme, setTheme] = useState("dark");
  const [ready, setReady] = useState(false);
  const program = PROGRAMS[key];
  const byId = useMemo(() => Object.fromEntries(program.courses.map((c) => [c.id, c])) as Record<string, Course>, [program]);

  useEffect(() => { try { setTheme(localStorage.getItem("advising-theme") || "dark"); } catch {} }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("advising-theme", theme); } catch {}
  }, [theme]);
  useEffect(() => { // load saved progress per program
    try {
      const raw = JSON.parse(localStorage.getItem("advising-" + key) || "{}");
      const d = Array.isArray(raw) ? raw : raw.done || [];
      setSel({ done: new Set(d), enr: new Set(Array.isArray(raw) ? [] : raw.enr || []) });
    } catch { setSel({ done: new Set(), enr: new Set() }); }
    setReady(true);
  }, [key]);
  useEffect(() => {
    if (ready) try { localStorage.setItem("advising-" + key, JSON.stringify({ done: [...sel.done], enr: [...sel.enr] })); } catch {}
  }, [sel, key, ready]);

  const cr = earned(program, sel.done);
  const info = useMemo(() => Object.fromEntries(program.courses.map((c) => [c.id, infoFor(c, byId, sel, cr)])), [program, byId, sel, cr]);
  const count = (s: Status) => program.courses.filter((c) => info[c.id].status === s).length;
  const enrCr = program.courses.reduce((t, c) => t + (sel.enr.has(c.id) ? c.cr : 0), 0);
  const other = mode === "done" ? "enr" : "done";

  const toggle = (id: string) => setSel((prev) => {
    const n = clone(prev), c = byId[id];
    if (!n.done.has(id) && !n.enr.has(id) && lockInfo(c, byId, n, earned(program, n.done)).status !== "ok") return prev; // locked: cannot be chosen
    if (n[mode].has(id)) n[mode].delete(id); else { n[other].delete(id); n[mode].add(id); }
    normalize(program, byId, n);
    return n;
  });

  const yearList = (y: number) => program.courses.filter((c) => c.row !== 7 && c.col >> 1 === y).sort((a, b) => a.col - b.col || a.row - b.row);
  const isOpen = (c: Course, s: Sets) => s.done.has(c.id) || s.enr.has(c.id) || lockInfo(c, byId, s, earned(program, s.done)).status === "ok";
  const yearOpen = [0, 1, 2, 3].map((y) => yearList(y).some((c) => isOpen(c, sel)));
  const yearAll = [0, 1, 2, 3].map((y) => { const o = yearList(y).filter((c) => isOpen(c, sel)); return o.length > 0 && o.every((c) => sel.done.has(c.id) || sel.enr.has(c.id)); });

  const pickYear = (y: number) => setSel((prev) => {
    const n = clone(prev), l = yearList(y), open = l.filter((c) => isOpen(c, n));
    if (open.length && open.every((c) => n.done.has(c.id) || n.enr.has(c.id))) open.forEach((c) => { n.done.delete(c.id); n.enr.delete(c.id); });
    else for (let pass = 0; pass < 3; pass++) for (const c of l) // in column order so chains inside a year unlock as we go
      if (!n.done.has(c.id) && !n.enr.has(c.id) && lockInfo(c, byId, n, earned(program, n.done)).status === "ok") n[mode].add(c.id);
    normalize(program, byId, n);
    return n;
  });

  const hc = hover ? byId[hover] : null;
  return (
    <div className="app">
      <header>
        <h1>Advising Portal</h1>
        <nav>{Object.entries(PROGRAMS).map(([k, p]) => (
          <button key={k} className={k === key ? "on" : ""} onClick={() => { setReady(false); setHover(null); setKey(k); }}>{p.name}</button>))}</nav>
        <div className="progress">
          <span>{cr} / {program.total} credits completed{enrCr ? ` · ${enrCr} enrolled` : ""}</span>
          <div><i className="d" style={{ width: Math.min(100, (cr / program.total) * 100) + "%" }} /><i className="e" style={{ width: Math.min(100, (enrCr / program.total) * 100) + "%" }} /></div>
        </div>
        <button className="ghost" onClick={() => confirm("Clear all selections for this program?") && setSel({ done: new Set(), enr: new Set() })}>Clear progress</button>
      </header>
      <div className="body">
        <aside>
          <section>
            <h3>Clicking a course marks it as</h3>
            <div className="seg">
              <button className={mode === "done" ? "on done" : ""} onClick={() => setMode("done")}>Completed</button>
              <button className={mode === "enr" ? "on enr" : ""} onClick={() => setMode("enr")}>Enrolled</button>
            </div>
          </section>
          <section>
            <h3>Legend</h3>
            {LEGEND.map(([s, l]) => <div key={s} className={"lg " + s}><i />{l}<b>{count(s)}</b></div>)}
            <div className="lg dash"><i />Prerequisite / concurrent</div>
            {CATS.map(([c, l]) => <div key={c} className="lg cat" data-cat={c}><i />{l}</div>)}
          </section>
          <section className="detail">
            {hc ? (<>
              <h3>{hc.id}</h3><p>{hc.name}</p>
              <p className={"why " + info[hc.id].status}>{info[hc.id].why}</p>
              <dl>
                <dt>Credits</dt><dd>{hc.cr}</dd>
                <dt>Prerequisites</dt><dd>{hc.pre.join(", ") || "None"}</dd>
                {hc.co.length > 0 && <><dt>Prerequisite / concurrent</dt><dd>{hc.co.join(", ")}</dd></>}
                {hc.minCr > 0 && <><dt>Standing</dt><dd>{hc.minCr} credits completed</dd></>}
              </dl>
            </>) : <p className="hint">Hover a course to trace its prerequisites. Locked courses cannot be selected. Progress saves in this browser.</p>}
          </section>
          <button className="theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? "☀ Light mode" : "🌙 Dark mode"}
          </button>
          <div style={{ fontSize: 12, fontStyle: "italic", color: "var(--hot)", opacity: 0.5, transition: "opacity .3s", userSelect: "none" }} onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")} onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.5")}>Done by @OutragedKhan916</div>
        </aside>
        <div className="scroll">
          <Flowchart program={program} byId={byId} info={info} hover={hover} onHover={setHover} onToggle={toggle}
            yearAll={yearAll} yearOpen={yearOpen} onYear={pickYear} modeLabel={mode === "done" ? "completed" : "enrolled"} />
        </div>
      </div>
    </div>
  );
}



