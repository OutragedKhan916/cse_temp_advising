"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import cmp from "@/data/cmp.json";
import coe from "@/data/coe.json";
import che from "@/data/che.json";
import cbe from "@/data/cbe.json";
import cve from "@/data/cve.json";
import cem from "@/data/cem.json";
import ele from "@/data/ele.json";
import ism from "@/data/ism.json";
import ine from "@/data/ine.json";
import mce from "@/data/mce.json";
import mje from "@/data/mje.json";
import CourseList from "@/components/CourseList";
import Flowchart from "@/components/Flowchart";
import Planner from "@/components/Planner";
import Tracker from "@/components/Tracker";
import Welcome, { type Applied } from "@/components/Welcome";
import { analyze, PER_SEM, termLabel } from "@/lib/critical";
import { LOAD, loadKind, noticeFor, type Notice } from "@/lib/load";
import { basePriorities } from "@/lib/plan";
import type { MjeData } from "@/lib/transcript";
import { earned, infoFor, lockInfo, normalize, standing } from "@/lib/status";
import type { Course, Meta, Program, Sets, Status } from "@/lib/types";

/** Drop prerequisites that point to a missing course or to the course itself, so a typo in the JSON cannot crash the page. */
function clean(p: Program): Program {
  const ids = new Set(p.courses.map((c) => c.id));
  const ok = (x: string, self: string) => {
    const good = x !== self && ids.has(x);
    if (!good) console.warn(`${p.name}: ${self} has an invalid prerequisite "${x}" (ignored)`);
    return good;
  };
  return { ...p, courses: p.courses.map((c) => ({ ...c, pre: c.pre.filter((x) => ok(x, c.id)), co: c.co.filter((x) => ok(x, c.id)), any: c.any?.filter((x) => ok(x, c.id)) })) };
}
// keys are the department course prefixes used by the catalog (CVE = Civil, ELE = Electrical, MCE = Mechanical ...)
const RAW: Record<string, unknown> = { CMP: cmp, COE: coe, CHE: che, CBE: cbe, CVE: cve, CEM: cem, ELE: ele, ISM: ism, INE: ine, MCE: mce };
const PROGRAMS: Record<string, Program> = Object.fromEntries(Object.entries(RAW).map(([k, p]) => [k, clean(p as Program)]));
const LEGEND: [Status, string][] = [["done", "Completed"], ["enr", "Currently enrolled"], ["plan", "Planned · unlocks nothing"], ["ok", "Can register"], ["pre", "Locked · prerequisite"], ["cr", "Locked · credits"]];
const CATS = [["H", "Hardware"], ["S", "Software"], ["N", "Networking"], ["M", "Mathematics"], ["C", "Sciences"], ["W", "Academic writing"], ["G", "General / electives"]];
const clone = (s: Sets): Sets => ({ done: new Set(s.done), enr: new Set(s.enr), plan: new Set(s.plan) });
const EMPTY: Meta = { placed: {}, extras: [] };
const empty = (): Sets => ({ done: new Set(), enr: new Set(), plan: new Set() });

export default function Page() {
  const [key, setKey] = useState("CMP");
  const [sel, setSel] = useState<Sets>(empty);
  const [meta, setMeta] = useState<Meta>(EMPTY);
  const [mode, setMode] = useState<"done" | "enr" | "plan">("done");
  const [hover, setHover] = useState<string | null>(null);
  const [theme, setTheme] = useState("light");
  const [ready, setReady] = useState(false);
  const [critical, setCritical] = useState(false);
  const [menu, setMenu] = useState(false); // legend / details panel on small screens
  const [notice, setNotice] = useState<Notice | null>(null);
  const [screen, setScreen] = useState<"loading" | "welcome" | "app">("loading");
  const pending = useRef<{ key: string; sel: Sets; meta: Meta } | null>(null);
  const program = PROGRAMS[key];
  const byId = useMemo(() => Object.fromEntries(program.courses.map((c) => [c.id, c])) as Record<string, Course>, [program]);
  const prio = useMemo(() => basePriorities(program), [program]);

  useEffect(() => { try { setTheme(localStorage.getItem("advising-theme") || "light"); } catch {} }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("advising-theme", theme); } catch {}
  }, [theme]);
  useEffect(() => { try { setScreen(localStorage.getItem("advising-started") ? "app" : "welcome"); } catch { setScreen("welcome"); } }, []);
  useEffect(() => { // load saved progress per program (or a freshly imported transcript)
    const p = pending.current;
    if (p && p.key === key) { setSel(p.sel); setMeta(p.meta); pending.current = null; setReady(true); return; }
    try {
      const raw = JSON.parse(localStorage.getItem("advising-" + key) || "{}");
      const d = Array.isArray(raw) ? raw : raw.done || [];
      setSel({ done: new Set(d), enr: new Set(Array.isArray(raw) ? [] : raw.enr || []), plan: new Set(Array.isArray(raw) ? [] : raw.plan || []) });
      setMeta({ placed: Array.isArray(raw) ? {} : raw.placed || {}, extras: Array.isArray(raw) ? [] : raw.extras || [] });
    } catch { setSel(empty()); setMeta(EMPTY); }
    setReady(true);
  }, [key]);
  useEffect(() => {
    if (ready) try { localStorage.setItem("advising-" + key, JSON.stringify({ done: [...sel.done], enr: [...sel.enr], plan: [...sel.plan], placed: meta.placed, extras: meta.extras })); } catch {}
  }, [sel, meta, key, ready]);
  useEffect(() => { // forget transcript labels for boxes that are no longer selected
    if (!ready) return;
    setMeta((m) => {
      const keep = Object.fromEntries(Object.entries(m.placed).filter(([id]) => sel.done.has(id) || sel.enr.has(id)));
      return Object.keys(keep).length === Object.keys(m.placed).length ? m : { ...m, placed: keep };
    });
  }, [sel, ready]);

  const cr = earned(program, sel.done);
  const st = standing(program, sel);
  const info = useMemo(() => Object.fromEntries(program.courses.map((c) => [c.id, infoFor(c, byId, sel, st)])), [program, byId, sel, st]);
  const crit = useMemo(() => (critical ? analyze(program, byId, sel) : null), [critical, program, byId, sel]);
  const count = (s: Status) => program.courses.filter((c) => info[c.id].status === s).length;
  const enrCr = program.courses.reduce((t, c) => t + (sel.enr.has(c.id) ? c.cr : 0), 0);
  const planCr = program.courses.reduce((t, c) => t + (sel.plan.has(c.id) ? c.cr : 0), 0);
  const chosen = program.courses.filter((c) => sel.plan.has(c.id));

  const picked = (s: Sets, id: string) => s.done.has(id) || s.enr.has(id) || s.plan.has(id);
  const planTotal = (s: Sets) => program.courses.reduce((t, c) => t + (s.plan.has(c.id) ? c.cr : 0), 0);
  /** adds to the plan unless that would pass the maximum load; false = blocked */
  const addPlan = (n: Sets, c: Course) => { if (planTotal(n) + c.cr > LOAD.max) return false; n.plan.add(c.id); return true; };
  /** popups: over the maximum when adding, heavy load when adding, and "too little" ONLY when courses are removed */
  const announce = (before: number, n: Sets, blocked: Course[]) => {
    const after = planTotal(n), k = loadKind(after);
    if (blocked.length) setNotice(noticeFor("over", after, blocked));
    else if (after > before && k === "high" && loadKind(before) !== "high") setNotice(noticeFor("high", after));
    else if (after < before && (k === "under" || k === "low")) setNotice(noticeFor(k, after));
  };
  const toggle = (id: string) => {
    const n = clone(sel), c = byId[id], before = planTotal(n);
    if (mode === "plan") {
      if (n.done.has(id) || n.enr.has(id)) return; // completed and enrolled courses stay as they are
      if (n.plan.has(id)) n.plan.delete(id);
      else if (lockInfo(c, byId, n, standing(program, n)).status !== "ok") return; // locked: cannot be chosen
      else if (!addPlan(n, c)) { announce(before, n, [c]); return; }
    } else {
      if (!picked(n, id) && lockInfo(c, byId, n, standing(program, n)).status !== "ok") return; // locked: cannot be chosen
      if (n[mode].has(id)) n[mode].delete(id);
      else { n.done.delete(id); n.enr.delete(id); n.plan.delete(id); n[mode].add(id); }
    }
    normalize(program, byId, n);
    setSel(n);
    announce(before, n, []);
  };
  const plan = (ids: string[]) => { // from the "next semester" tab: planned picks, unlock nothing
    const n = clone(sel), before = planTotal(n), blocked: Course[] = [];
    for (const id of ids) {
      const c = byId[id];
      if (picked(n, id) || lockInfo(c, byId, n, standing(program, n)).status !== "ok") continue;
      if (!addPlan(n, c)) blocked.push(c);
    }
    setSel(n);
    announce(before, n, blocked);
  };
  const unplan = (id: string) => { const n = clone(sel), before = planTotal(n); n.plan.delete(id); setSel(n); announce(before, n, []); };

  const yearList = (y: number) => program.courses.filter((c) => c.row !== 7 && c.col >> 1 === y).sort((a, b) => a.col - b.col || a.row - b.row);
  const isOpen = (c: Course, s: Sets) => picked(s, c.id) || lockInfo(c, byId, s, standing(program, s)).status === "ok";
  const yearOpen = [0, 1, 2, 3].map((y) => yearList(y).some((c) => isOpen(c, sel)));
  const yearAll = [0, 1, 2, 3].map((y) => { const o = yearList(y).filter((c) => isOpen(c, sel)); return o.length > 0 && o.every((c) => picked(sel, c.id)); });
  const pickYear = (y: number) => {
    const n = clone(sel), l = yearList(y), open = l.filter((c) => isOpen(c, n)), before = planTotal(n), blocked: Course[] = [];
    if (open.length && open.every((c) => picked(n, c.id))) open.forEach((c) => { n.done.delete(c.id); n.enr.delete(c.id); n.plan.delete(c.id); });
    else for (let pass = 0; pass < 3; pass++) for (const c of l) { // in column order so chains inside a year unlock as we go
      if (picked(n, c.id) || lockInfo(c, byId, n, standing(program, n)).status !== "ok") continue;
      if (mode === "plan") { if (!addPlan(n, c) && !blocked.includes(c)) blocked.push(c); } else n[mode].add(c.id);
    }
    normalize(program, byId, n);
    setSel(n);
    announce(before, n, blocked);
  };

  const hc = hover ? byId[hover] : null;
  const need = crit && hc ? [...crit.needed(hc.id)] : [];
  const mjeInfo = (mje as unknown as MjeData)[key];
  const takenCodes = new Set(Object.values(meta.placed).map((p) => p.code.replace(/\s/g, "")));
  const doneCodes = new Set(Object.entries(meta.placed).filter(([id]) => info[id]?.status === "done").map(([, p]) => p.code.replace(/\s/g, "")));
  const mjeAll = hc && /^MJE/.test(hc.id) && mjeInfo ? mjeInfo.eligible.filter((c) => !takenCodes.has(c) || doneCodes.has(c)).sort((a, b) => Number(doneCodes.has(b)) - Number(doneCodes.has(a))) : null; // completed (from transcript) first
  const mjeLeft = mjeAll ? mjeAll.filter((c) => !takenCodes.has(c)) : null;
  const enter = () => { try { localStorage.setItem("advising-started", "1"); } catch {} setScreen("app"); };
  const switchTo = (k: string) => { setReady(false); setHover(null); setKey(k); };
  const startManual = (k: string) => { if (k !== key) switchTo(k); enter(); };
  const applyImport = (r: Applied) => {
    const s: Sets = { done: new Set(r.done), enr: new Set(r.enr), plan: new Set() }, m = { placed: r.placed, extras: r.extras };
    if (r.key === key) { setSel(s); setMeta(m); } else { pending.current = { key: r.key, sel: s, meta: m }; switchTo(r.key); }
    enter();
  };
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  if (screen === "loading") return <div className="splash">Loading…</div>;
  if (screen === "welcome") return <Welcome programs={PROGRAMS} defaultKey={key} theme={theme} onTheme={toggleTheme} onManual={startManual} onApply={applyImport} />;

  return (
    <div className="app">
      <header>
        <h1><button className="brand" onClick={() => { setHover(null); setScreen("welcome"); }}>Advising Portal</button></h1>
        <select className="prog" value={key} aria-label="Program" onChange={(e) => switchTo(e.target.value)}>
          {Object.entries(PROGRAMS).map(([k, p]) => <option key={k} value={k}>{p.name}</option>)}
        </select>
        <div className="progress">
          <span>{cr} / {program.total} credits completed{enrCr ? ` · ${enrCr} enrolled` : ""}{planCr ? ` · ${planCr} planned` : ""}</span>
          <div><i className="d" style={{ width: Math.min(100, (cr / program.total) * 100) + "%" }} /><i className="e" style={{ width: Math.min(100, (enrCr / program.total) * 100) + "%" }} /><i className="p" style={{ width: Math.min(100, (planCr / program.total) * 100) + "%" }} /></div>
        </div>
        <div className="acts">
        <button className="ghost" onClick={() => setScreen("welcome")}>Import transcript</button>
        <button className={"ghost" + (critical ? " on" : "")} onClick={() => { setCritical(!critical); if (!critical) setMenu(true); }} title="Show what is needed to graduate and how much delay is possible">Critical pathways</button>
        <button className="ghost" onClick={() => confirm("Clear all selections for this program?") && (setSel(empty()), setMeta(EMPTY))}>Clear progress</button>
        </div>
      </header>
      <div className="mbar">
        <div className="seg">
          <button className={mode === "done" ? "on done" : ""} onClick={() => setMode("done")}>Completed</button>
          <button className={mode === "enr" ? "on enr" : ""} onClick={() => setMode("enr")}>Enrolled</button>
          <button className={mode === "plan" ? "on plan" : ""} onClick={() => setMode("plan")}>Plan</button>
        </div>
        <button className="ghost" aria-expanded={menu} onClick={() => { setMenu(!menu); setHover(null); }}>{menu ? "Close" : "Info"}</button>
      </div>
      <div className="body">
        <aside className={menu ? "open" : ""}>
          <section className="modesec">
            <h3>Clicking a course marks it as</h3>
            <div className="seg">
              <button className={mode === "done" ? "on done" : ""} onClick={() => setMode(mode === "done" ? "plan" : "done")}>Completed</button>
              <button className={mode === "enr" ? "on enr" : ""} onClick={() => setMode(mode === "enr" ? "plan" : "enr")}>Enrolled</button>
            </div>
            <p className="note">{mode === "plan"
              ? "Nothing selected: clicks now mark courses as planned. Planned courses do not unlock anything."
              : "Completed and Enrolled courses unlock the next courses. Press the active button again to switch to planning."}</p>
          </section>
          {crit && !hc && (
            <section>
              <h3>Critical pathways</h3>
              {crit.remaining.size === 0 ? <p className="note">Everything is completed or in progress.</p> : (<>
                <p><b>{crit.grad}</b> semester{crit.grad === 1 ? "" : "s"} to finish · earliest graduation <b>{termLabel(crit.grad)}</b></p>
                <p className="note">{crit.remainingCr} credits left. Prerequisites alone need {crit.finish} semester{crit.finish === 1 ? "" : "s"}; at {PER_SEM} credits a semester the credit load needs {crit.creditBound}. {crit.grad > crit.finish ? "Your credit load is the limit." : "Your prerequisite chain is the limit."}</p>
                {crit.chain.length > 0 && (<><p className="note">Critical chain (red arrows):</p>
                  <div>{crit.chain.map((c) => <span key={c} className="ec crit">{c}</span>)}</div></>)}
                {crit.chain[0] && crit.gated.has(crit.chain[0]) && <p className="note">{crit.chain[0]} is held back by its {byId[crit.chain[0]].minCr}-credit requirement, not by prerequisites: you reach that many credits in semester {crit.L[crit.chain[0]] - (byId[crit.chain[0]].row === 7 ? 0 : 1)} at {PER_SEM} credits a semester.</p>}
                <p className="note">Delaying a red course delays graduation by the same amount. Every other box shows how many semesters it can slip (+N). Hover or tap a course to see what it still needs. Enrolled courses count as finished.</p>
              </>)}
            </section>
          )}
          {!hc && (
          <section>
            <h3>Legend</h3>
            {LEGEND.map(([s, l]) => <div key={s} className={"lg " + s}><i />{l}<b>{count(s)}</b></div>)}
            <div className="lg dash"><i />Prerequisite / concurrent</div>
            {CATS.map(([c, l]) => <div key={c} className="lg cat" data-cat={c}><i />{l}</div>)}
          </section>
          )}
          <section className="detail">
            {hc ? (<>
              <h3>{hc.id}</h3><p>{hc.name}</p>
              <p className={"why " + info[hc.id].status}>{info[hc.id].why}</p>
              {meta.placed[hc.id] && <p className="note">Filled by <b>{meta.placed[hc.id].code}</b> ({info[hc.id].status === "done" ? "completed" : "currently taking"}){meta.placed[hc.id].confirm ? ", confirm with your advisor" : ""}</p>}
              <dl>
                <dt>Credits</dt><dd>{hc.cr}</dd>
                <dt>Priority</dt><dd>{hc.priority ?? prio[hc.id]} / 10</dd>
                <dt>Prerequisites</dt><dd>{hc.pre.join(", ") || "None"}</dd>
                {hc.any && hc.any.length > 0 && <><dt>Prerequisite (any one)</dt><dd>{hc.any.join(" or ")}</dd></>}
                {hc.co.length > 0 && <><dt>Prerequisite / concurrent</dt><dd>{hc.co.join(", ")}</dd></>}
                {hc.minCr > 0 && <><dt>Standing</dt><dd>{hc.minCr} credits completed</dd></>}
              </dl>
              {crit && hc && crit.remaining.has(hc.id) && (<>
                <h4 className="avail">Critical pathway</h4>
                <p className="note">Earliest semester: {termLabel(crit.L[hc.id])}. {crit.critical.has(hc.id)
                  ? "Critical: any delay pushes graduation back by the same amount."
                  : `Can slip up to ${crit.slack[hc.id]} semester${crit.slack[hc.id] === 1 ? "" : "s"} without delaying graduation.`}</p>
                {need.length > 0
                  ? <><p className="note">Still needed first ({need.length}):</p><div>{need.map((c) => <span key={c} className="ec crit">{c}</span>)}</div></>
                  : <p className="note">No other course is needed first.</p>}
              </>)}
              {mjeLeft && (<>
                <h4 className="avail">Available major electives ({mjeLeft.length})</h4>
                <div>{mjeAll!.map((c) => {
                  const warn = mjeInfo.confirm.includes(c);
                  return <span key={c} className={"ec" + (doneCodes.has(c) ? " go" : "") + (warn ? " warn" : "")}>{c.replace(/^([A-Z]+)(\d)/, "$1 $2")}{warn ? " (approval)" : ""}</span>;
                })}</div>
                <p className="note">Marked “approval”: special topic, needs advisor approval. Green = completed (from your transcript). Courses you are taking now are hidden.</p>
              </>)}
            </>) : <p className="hint">Hover or tap a course to trace its prerequisites. Locked courses cannot be selected. Progress saves in this browser.</p>}
          </section>
          <button className="theme" onClick={toggleTheme}>
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </aside>
        <div className="clist-wrap">
          <CourseList program={program} info={info} sel={sel} crit={crit} placed={meta.placed} onToggle={toggle}
            onInfo={(id) => { setHover(id); setMenu(true); }}
            yearAll={yearAll} yearOpen={yearOpen} onYear={pickYear} modeLabel={mode === "done" ? "completed" : mode === "enr" ? "enrolled" : "planned"}>
            <Tracker flow program={program} info={info} placed={meta.placed} extras={meta.extras} />
          </CourseList>
        </div>
        <div className="scroll" onClick={(e) => { if (!(e.target as HTMLElement).closest(".node")) setHover(null); }}>
          <Flowchart program={program} byId={byId} info={info} hover={hover} onHover={setHover} onToggle={toggle}
            yearAll={yearAll} yearOpen={yearOpen} onYear={pickYear} modeLabel={mode === "done" ? "completed" : mode === "enr" ? "enrolled" : "planned"} crit={crit} placed={meta.placed}
            extra={<Tracker program={program} info={info} placed={meta.placed} extras={meta.extras} />} />
        </div>
        <Planner program={program} info={info} doneCr={cr} enrCr={enrCr} chosen={chosen} onPlan={plan} onUnplan={unplan}
          onCheck={() => setNotice(noticeFor(loadKind(planCr), planCr))} />
      </div>
      {notice && (
        <div className="modal-back" onClick={() => setNotice(null)}>
          <div className={"modal " + notice.level} role="alertdialog" onClick={(e) => e.stopPropagation()}>
            <h3>{notice.title}</h3>
            <p>{notice.msg}</p>
            <button className="primary" onClick={() => setNotice(null)}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}
