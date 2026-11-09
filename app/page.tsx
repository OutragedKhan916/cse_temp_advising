"use client";
import { useEffect, useMemo, useRef, useState, type FocusEvent as ReactFocus, type KeyboardEvent as ReactKey, type MouseEvent as ReactMouse } from "react";
import { DEFAULT_KEY, DEFAULT_YEAR, getCatalog, programTitle } from "@/data";
import CourseInfo from "@/components/CourseInfo";
import { GER_BOX, GER_TITLE } from "@/lib/transcript";
import Flowchart from "@/components/Flowchart";
import Planner from "@/components/Planner";
import Tracker from "@/components/Tracker";
import Welcome, { type Applied } from "@/components/Welcome";
import { analyze, PER_SEM, termLabel } from "@/lib/critical";
import { LOAD, loadKind, noticeFor, type Notice } from "@/lib/load";
import { earned, infoFor, lockInfo, normalize, standing } from "@/lib/status";
import type { Course, Meta, Program, Sets, Status } from "@/lib/types";

const LEGEND: [Status, string][] = [["done", "Completed"], ["enr", "Currently enrolled"], ["plan", "Planned · unlocks nothing"], ["ok", "Can register"], ["pre", "Locked · prerequisite 🔒"], ["cr", "Locked · credits ⏳"]];
const CATS = [["H", "Hardware"], ["S", "Software"], ["N", "Networking"], ["M", "Mathematics"], ["C", "Sciences"], ["W", "Academic writing"], ["G", "General / electives"]];
const clone = (s: Sets): Sets => ({ done: new Set(s.done), enr: new Set(s.enr), plan: new Set(s.plan) });
const EMPTY: Meta = { placed: {}, extras: [] };
/** saved-progress key; the first catalog year keeps the original key so old saves still load */
const skey = (y: string, k: string) => (y === DEFAULT_YEAR ? "advising-" + k : `advising-${y}-${k}`);
const empty = (): Sets => ({ done: new Set(), enr: new Set(), plan: new Set() });

export default function Page() {
  const [key, setKey] = useState(DEFAULT_KEY);
  const [year, setYear] = useState(DEFAULT_YEAR);
  const catalog = getCatalog(year), PROGRAMS = catalog.programs;
  const [sel, setSel] = useState<Sets>(empty);
  const [meta, setMeta] = useState<Meta>(EMPTY);
  const [mode, setMode] = useState<"done" | "enr" | "plan">("done");
  const [hover, setHover] = useState<string | null>(null);
  const [theme, setTheme] = useState("dark");
  const [zoom, setZoom] = useState(1);
  const [pin, setPin] = useState<string | null>(null); // course selected with the tick: its description shows in the side panel
  const [tip, setTip] = useState<{ code: string; pinned: boolean; x?: number; y?: number } | null>(null); // description popup of a course chip: centred on screen until it is dragged
  const tipRef = useRef<HTMLDivElement>(null);
  const [sheet, setSheet] = useState(false); // phone: side panel as a bottom sheet
  useEffect(() => { if (window.innerWidth < 800) setZoom(0.8); }, []);
  const [ready, setReady] = useState(false);
  const [critical, setCritical] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [screen, setScreen] = useState<"welcome" | "app">("welcome") // the site always opens on the main page;
  const pending = useRef<{ key: string; year: string; sel: Sets; meta: Meta } | null>(null);
  const program = PROGRAMS[key];
  const byId = useMemo(() => Object.fromEntries(program.courses.map((c) => [c.id, c])) as Record<string, Course>, [program]);

  useEffect(() => { try { setTheme(localStorage.getItem("advising-theme") || "dark"); } catch {} }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("advising-theme", theme); } catch {}
  }, [theme]);
  useEffect(() => { // load saved progress per program (or a freshly imported transcript)
    const p = pending.current;
    if (p && p.key === key && p.year === year) { setSel(p.sel); setMeta(p.meta); pending.current = null; setReady(true); return; }
    try {
      const raw = JSON.parse(localStorage.getItem(skey(year, key)) || "{}");
      const mig = (a: string[]) => a.map((x) => (x === "CMP213" ? "MTH213" : x)); // CMP213 was renamed MTH213: keep old saved progress
      const d = Array.isArray(raw) ? raw : raw.done || [];
      const placed = Array.isArray(raw) ? {} : Object.fromEntries(Object.entries(raw.placed || {}).map(([k, v]) => [k === "CMP213" ? "MTH213" : k, v]));
      setSel({ done: new Set(mig(d)), enr: new Set(mig(Array.isArray(raw) ? [] : raw.enr || [])), plan: new Set(mig(Array.isArray(raw) ? [] : raw.plan || [])) });
      setMeta({ placed: placed as Meta["placed"], extras: Array.isArray(raw) ? [] : raw.extras || [] });
    } catch { setSel(empty()); setMeta(EMPTY); }
    setReady(true);
  }, [key, year]);
  useEffect(() => {
    if (ready) try { localStorage.setItem(skey(year, key), JSON.stringify({ done: [...sel.done], enr: [...sel.enr], plan: [...sel.plan], placed: meta.placed, extras: meta.extras })); } catch {}
  }, [sel, meta, key, year, ready]);
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
  /** adds to the green plan unless that would pass the maximum load; false = blocked */
  const addPlan = (n: Sets, c: Course) => { if (planTotal(n) + c.cr > LOAD.max) return false; n.plan.add(c.id); return true; };
  /** popups: only when the plan reaches 18-19 credits (heavy) or an add would pass 19 (blocked). Everything else shows only in the planner meter. */
  const announce = (before: number, n: Sets, blocked: Course[]) => {
    const after = planTotal(n), k = loadKind(after);
    if (blocked.length) setNotice(noticeFor("over", after, blocked));
    else if (after > before && k === "high") setNotice(noticeFor("high", after)); // popups only at 18-19 credits (20+ is blocked above); light loads only show in the meter
  };
  const toggle = (id: string) => {
    const n = clone(sel), c = byId[id], before = planTotal(n);
    if (mode === "plan") {
      if (n.done.has(id) || n.enr.has(id)) return; // pink and orange courses stay as they are
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
  const plan = (ids: string[]) => { // from the "next semester" tab: green picks, unlock nothing
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

  // hovering a major elective keeps its panel open (so the mouse can move to the sidebar); click empty space, press Esc or use Clear to close it
  const sticky = (id: string) => /^MJE|^GER(?!SCI)/.test(id); // elective and GER boxes keep their list open so the mouse can reach it
  const onHover = (id: string | null) => setHover((h) => (id === null && h && sticky(h) ? h : id));
  useEffect(() => { const f = (e: KeyboardEvent) => e.key === "Escape" && (setHover(null), setPin(null), setTip(null)); window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f); }, []);
  // a click anywhere else lets go of a popup that was kept open
  useEffect(() => { const f = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest(".tip, .ec")) setTip((t) => (t?.pinned ? null : t)); }; document.addEventListener("mousedown", f); return () => document.removeEventListener("mousedown", f); }, []);
  /** hover shows the popup, a click keeps it open (click again to close) */
  const chipTip = (code: string) => {
    const place = (_el: HTMLElement, pinned: boolean) => setTip((t) => ({ code, pinned, x: t?.pinned && pinned ? t.x : undefined, y: t?.pinned && pinned ? t.y : undefined })); // hover and a fresh click open in the middle of the screen; moving a kept popup keeps its place
    return {
      role: "button" as const, tabIndex: 0, "aria-label": `Description of ${code}`,
      onMouseEnter: (e: ReactMouse<HTMLElement>) => { if (!tip?.pinned) place(e.currentTarget, false); },
      onMouseLeave: () => setTip((t) => (t?.pinned ? t : null)),
      onFocus: (e: ReactFocus<HTMLElement>) => { if (!tip?.pinned) place(e.currentTarget, false); },
      onClick: (e: ReactMouse<HTMLElement>) => { if (tip?.pinned && tip.code === code) setTip(null); else place(e.currentTarget, true); },
      onKeyDown: (e: ReactKey<HTMLElement>) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } },
    };
  };
  const hc = hover ? byId[hover] : pin ? byId[pin] : null; // hovering shows a course; otherwise the selected one stays
  const need = crit && hc ? [...crit.needed(hc.id)] : [];
  const mjeInfo = catalog.mje[key];
  const takenCodes = new Set(Object.values(meta.placed).map((p) => p.code.replace(/\s/g, "")));
  const doneCodes = new Set(Object.entries(meta.placed).filter(([id]) => info[id]?.status === "done").map(([, p]) => p.code.replace(/\s/g, "")));
  const enrCodes = new Set(Object.entries(meta.placed).filter(([id]) => info[id]?.status === "enr").map(([, p]) => p.code.replace(/\s/g, "")));
  const chip = (c: string) => (doneCodes.has(c) ? " go" : enrCodes.has(c) ? " en" : ""); // green glow = completed, orange glow = enrolled
  const mjeAll = hc && /^MJE/.test(hc.id) && mjeInfo ? [...mjeInfo.eligible].sort((a, b) => Number(doneCodes.has(b)) * 2 + Number(enrCodes.has(b)) - (Number(doneCodes.has(a)) * 2 + Number(enrCodes.has(a)))) : null; // completed (from transcript) first
  /** "ARA101 ARA102 ANT205 ..." -> one group per subject, so the lists can be split by a thin line */
  const bySubject = (l: string[]) => Object.entries(l.reduce<Record<string, string[]>>((m, c) => { (m[c.match(/^[A-Z]+/)![0]] ||= []).push(c); return m; }, {})).sort(([a], [b]) => a.localeCompare(b)).map(([, g]) => g);
  // GER boxes: the course list of their category (completed ones glow green, ones you are taking now are hidden)
  const gerCats = hc ? GER_BOX[hc.id] : undefined;
  const gerLists = gerCats ? gerCats.map((cat) => ({ cat, list: [...(catalog.ger[cat] ?? [])].sort() })) : null;
  const mjeLeft = mjeAll ? mjeAll.filter((c) => !takenCodes.has(c)) : null;
  const enter = () => setScreen("app");
  const switchTo = (k: string, y = year) => { setReady(false); setHover(null); setPin(null); setKey(k); setYear(y); };
  const startManual = (k: string, y: string) => { if (k !== key || y !== year) switchTo(k, y); enter(); };
  const applyImport = (r: Applied, y: string) => {
    const s: Sets = { done: new Set(r.done), enr: new Set(r.enr), plan: new Set() }, m = { placed: r.placed, extras: r.extras };
    if (r.key === key && y === year) { setSel(s); setMeta(m); } else { pending.current = { key: r.key, year: y, sel: s, meta: m }; switchTo(r.key, y); }
    enter();
  };
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  if (screen === "welcome") return <Welcome defaultKey={key} defaultYear={year} theme={theme} onTheme={toggleTheme} onManual={startManual} onApply={applyImport} />;

  return (
    <div className="app">
      <header>
        <h1><button className="brand" onClick={() => { setHover(null); setScreen("welcome"); }}>Advising Portal</button></h1>
        <span className="yr">{programTitle(program, year)}</span>
        <div className="progress">
          <span>{cr} / {program.total} credits completed{enrCr ? ` · ${enrCr} enrolled` : ""}{planCr ? ` · ${planCr} planned` : ""}</span>
          <div><i className="d" style={{ width: Math.min(100, (cr / program.total) * 100) + "%" }} /><i className="e" style={{ width: Math.min(100, (enrCr / program.total) * 100) + "%" }} /><i className="p" style={{ width: Math.min(100, (planCr / program.total) * 100) + "%" }} /></div>
        </div>
        <div className="acts">
        <button className="ghost" onClick={() => setScreen("welcome")}>Import transcript</button>
        <button className={"ghost" + (critical ? " on" : "")} onClick={() => setCritical(!critical)} title="Show what is needed to graduate and how much delay is possible">Critical pathways</button>
        <button className="ghost" onClick={() => confirm("Clear all selections for this program?") && (setSel(empty()), setMeta(EMPTY))}>Clear progress</button>
        </div>
      </header>
      <div className="modebar">
        <span>Tap marks:</span>
        <button className={mode === "done" ? "on done" : ""} onClick={() => setMode("done")}>Completed</button>
        <button className={mode === "enr" ? "on enr" : ""} onClick={() => setMode("enr")}>Enrolled</button>
        <button className={mode === "plan" ? "on plan" : ""} onClick={() => setMode("plan")}>Plan</button>
        <span className="zoom"><button onClick={() => setZoom(Math.max(0.4, +(zoom - 0.1).toFixed(2)))} aria-label="Zoom out">−</button><button onClick={() => setZoom(Math.min(1.4, +(zoom + 0.1).toFixed(2)))} aria-label="Zoom in">+</button></span>
      </div>
      <div className="body">
        <aside className={sheet ? "open" : ""}>
          <button className="sheet-x" onClick={() => setSheet(false)}>✕ Close</button>
          <section>
            <h3>Clicking a course marks it as</h3>
            <div className="seg">
              <button className={mode === "done" ? "on done" : ""} onClick={() => setMode(mode === "done" ? "plan" : "done")}>Completed</button>
              <button className={mode === "enr" ? "on enr" : ""} onClick={() => setMode(mode === "enr" ? "plan" : "enr")}>Enrolled</button>
            </div>
            <p className="note">{mode === "plan"
              ? "Nothing selected: clicks now mark courses green (planned). Green courses do not unlock anything."
              : "Completed (pink) and Enrolled (orange) unlock the next courses. Press the active button again to switch to green planning."}</p>
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
              <h3>{hc.id}{(sticky(hc.id) || pin === hc.id) && <button className="clr" onClick={() => { setHover(null); setPin(null); }}>✕ Close</button>}</h3><p>{hc.name}</p>
              <p className={"why " + info[hc.id].status}>{info[hc.id].why}</p>
              {meta.placed[hc.id] && <p className="note">Filled by <b>{meta.placed[hc.id].code}</b> ({info[hc.id].status === "done" ? "completed" : "currently taking"}){meta.placed[hc.id].confirm ? " ⚠ confirm with your advisor" : ""}</p>}
              {pin === hc.id && <CourseInfo code={meta.placed[hc.id]?.code ?? hc.id} />}
              {gerLists && (<>
                <h4 className="avail">{hc.id === "GERSEL" ? "Courses that count (any of the four core areas)" : "Courses that count here"}</h4>
                {gerLists.map(({ cat, list }) => (
                  <div key={cat}>
                    {gerLists.length > 1 && <p className="mje-g">{GER_TITLE[cat]}</p>}
                    {bySubject(list).map((g) => <div key={g[0]} className="subj">{g.map((c) => <span key={c} {...chipTip(c)} className={"ec" + chip(c)}>{c.replace(/^([A-Z]+)(\d)/, "$1 $2")}</span>)}</div>)}
                  </div>
                ))}
                <p className="note">Green glow = completed, orange glow = enrolled (from your transcript).</p>
              </>)}
              {hc.id.startsWith("GERSCI") && <p className="note">Natural science: any biology (BIO), chemistry (CHM) or physics (PHY) course counts.</p>}
              {mjeLeft && (<>
                <h4 className="avail">Available major electives ({mjeLeft.length})</h4>
                {mjeInfo.rule && <p className="note"><b>Rule:</b> at least {mjeInfo.rule.minCore} core electives, at most {mjeInfo.rule.maxBreadth} breadth electives, {mjeInfo.rule.max} major electives in total.</p>}
                {([["Core electives", (c: string) => !!mjeInfo.core?.includes(c)], ["Breadth electives", (c: string) => !!mjeInfo.breadth?.includes(c)], ["Special topics (confirm classification)", (c: string) => !mjeInfo.core?.includes(c) && !mjeInfo.breadth?.includes(c)]] as [string, (c: string) => boolean][]).map(([title, test]) => {
                  const list = mjeAll!.filter(test);
                  return list.length ? (<div key={title}><p className="mje-g">{title}</p>{list.map((c) => {
                    const warn = mjeInfo.confirm.includes(c);
                    return <span key={c} {...chipTip(c)} className={"ec" + chip(c) + (warn ? " warn" : "")}>{c.replace(/^([A-Z]+)(\d)/, "$1 $2")}{warn ? " ⚠" : ""}</span>;
                  })}</div>) : null;
                })}
                <p className="note">⚠ special topic: needs advisor approval. Green glow = completed, orange glow = enrolled (from your transcript).</p>
              </>)}
              <dl>
                <dt>Credits</dt><dd>{hc.cr}</dd>
                
                <dt>Prerequisites</dt><dd>{hc.pre.join(", ") || "None"}</dd>
                {hc.any && hc.any.length > 0 && <><dt>Prerequisite (any one)</dt><dd>{hc.any.join(" or ")}</dd></>}
                {hc.co.length > 0 && <><dt>Prerequisite / concurrent</dt><dd>{hc.co.join(", ")}</dd></>}
                {hc.minCr > 0 && <><dt>Standing</dt><dd>{hc.minCr} credits completed</dd></>}
                {hc.rec ? <><dt>Recommended</dt><dd>+{hc.rec} credits completed (a suggestion, not a requirement)</dd></> : null}
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
            </>) : <p className="hint">Hover or tap a course to trace its prerequisites. Locked courses cannot be selected. Progress saves in this browser.</p>}
          </section>
          <p className="scope">Only for <b>Computer Science (CMP)</b> and <b>Computer Engineering (COE)</b> majors. It does not count double majors, minors or other programs.</p>
          <button className="theme" onClick={toggleTheme}>
            {theme === "dark" ? "☀ Light mode" : "🌙 Dark mode"}
          </button>
        </aside>
        <button className="fab" onClick={() => setSheet(true)}>ⓘ {hc ? hc.id : "Info"}</button>
        <div className="scroll" onClick={(e) => { if (!(e.target as HTMLElement).closest(".node")) setHover(null); }}>
          <div style={{ zoom }}>
          <Flowchart program={program} byId={byId} info={info} hover={hover} pin={pin} onPin={(id) => { if (pin !== id) setSheet(true); setPin(pin === id ? null : id); }} onHover={onHover} onToggle={toggle}
            yearAll={yearAll} yearOpen={yearOpen} onYear={pickYear} modeLabel={mode === "done" ? "completed" : mode === "enr" ? "enrolled" : "planned"} crit={crit} placed={meta.placed}
            extra={<Tracker program={program} info={info} placed={meta.placed} extras={meta.extras} mje={mjeInfo} />} />
          </div>
        </div>
        <Planner program={program} info={info} doneCr={cr} enrCr={enrCr} chosen={chosen} onPlan={plan} onUnplan={unplan}
          onCheck={() => setNotice(noticeFor(loadKind(planCr), planCr))} />
      </div>
      {tip && (
        <div ref={tipRef} className={"tip" + (tip.pinned ? " pinned" : "") + (tip.x === undefined ? " mid" : "")} style={tip.x === undefined ? undefined : { left: tip.x, top: tip.y }}>
          {tip.pinned && (
            <div className="tip-bar"
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest("button")) return;
                const box = tipRef.current!.getBoundingClientRect(), dx = e.clientX - box.left, dy = e.clientY - box.top;
                const move = (m: PointerEvent) => setTip((t) => (t ? { ...t, x: Math.max(0, Math.min(m.clientX - dx, window.innerWidth - box.width)), y: Math.max(0, Math.min(m.clientY - dy, window.innerHeight - 40)) } : t));
                const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
                window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
                setTip((t) => (t ? { ...t, x: box.left, y: box.top } : t)); // leave the centred position
              }}>
              <span>⠿ Drag to move</span><button className="clr" onClick={() => setTip(null)}>✕ Close</button>
            </div>
          )}
          <CourseInfo code={tip.code} />
        </div>
      )}
      {notice && (
        <div className="modal-back" onClick={() => setNotice(null)}>
          <div className={"modal " + notice.level} role="alertdialog" onClick={(e) => e.stopPropagation()}>
            <h3>{notice.level === "error" ? "⛔ " : notice.level === "warn" ? "⚠ " : "✓ "}{notice.title}</h3>
            <p>{notice.msg}</p>
            <button className="primary" onClick={() => setNotice(null)}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}
