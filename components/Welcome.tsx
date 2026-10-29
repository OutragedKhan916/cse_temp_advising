"use client";
import { useState } from "react";
import { DEPARTMENTS, departmentOf, findMajor, getCatalog, yearLabel, yearsFor } from "@/data";
import { matchTranscript, pastedLines, readTranscriptLines } from "@/lib/transcript";
import type { Extra, Placement } from "@/lib/types";

type Result = ReturnType<typeof matchTranscript>;
export interface Applied { key: string; done: string[]; enr: string[]; placed: Record<string, Placement>; extras: Extra[]; }
interface Props {
  defaultKey: string; defaultYear: string; theme: string; onTheme: () => void;
  onManual: (key: string, year: string) => void; onApply: (r: Applied, year: string) => void;
}

export default function Welcome({ defaultKey, defaultYear, theme, onTheme, onManual, onApply }: Props) {
  const [department, setDepartment] = useState(departmentOf(defaultKey)?.code ?? DEPARTMENTS[0].code);
  const [key, setKey] = useState(defaultKey);
  const [year, setYear] = useState(defaultYear);
  const cat = getCatalog(year), programs = cat.programs;
  const majors = DEPARTMENTS.find((d) => d.code === department)?.majors ?? [];
  const years = yearsFor(key);
  const pickDepartment = (d: string) => { setDepartment(d); const m = DEPARTMENTS.find((x) => x.code === d)?.majors[0]; if (m) pickMajor(m.code); };
  const pickMajor = (k: string) => { setKey(k); const ys = yearsFor(k); if (!ys.includes(year)) setYear(ys[0]); }; // keep the year if this major has it, else its newest
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [drag, setDrag] = useState(false);

  const [text, setText] = useState("");

  /** read the lines of a file or of pasted text, then fill in the courses */
  async function run(getLines: () => Promise<string[]> | string[]) {
    setErr(""); setBusy(true);
    try {
      const r = matchTranscript(await getLines(), programs, key, cat.ger, cat.mje);
      if (!r.found) throw new Error("No courses were found. Make sure it is your unofficial transcript or degree evaluation.");
      setRes(r);
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not read this."); }
    finally { setBusy(false); }
  }
  const handle = (f?: File) => {
    if (!f) return;
    if (!/\.(pdf|docx?)$/i.test(f.name) && f.type !== "application/pdf") { setErr("Please choose a PDF or Word (.docx) file."); return; }
    return run(() => readTranscriptLines(f));
  };
  const handleText = () => run(() => pastedLines(text));
  const slotName = (r: Result, id: string) => programs[r.key].courses.find((c) => c.id === id)?.name.replace("GER-Core ", "");

  return (
    <div className="wl">
      <button className="theme wl-theme" onClick={onTheme}>{theme === "dark" ? "☀ Light mode" : "🌙 Dark mode"}</button>
      <h1>Advising Portal</h1>
      <p className="sub">How would you like to fill in your courses?</p>

      {res ? (
        <div className="card summary">
          <h2>Transcript read: {programs[res.key].name}</h2>
          <p className="note">Catalog {cat.label}</p>
          {!res.detected && <p className="warn">Could not detect your program, so {programs[res.key].name} was used.</p>}
          <p><b className="c-done">{res.done.length} completed</b>: {res.done.join(", ") || "none"}</p>
          <p><b className="c-enr">{res.enr.length} in progress</b>: {res.enr.join(", ") || "none"}</p>
          {Object.keys(res.placed).length > 0 && (
            <p><b>Electives and GERs</b>: {(Object.entries(res.placed) as [string, Placement][]).map(([id, p]) => `${p.code} → ${slotName(res, id)}${p.confirm ? " ⚠" : ""}`).join(", ")}</p>
          )}
          {res.extras.length > 0 && <p className="warn">Not placed: {res.extras.map((e) => `${e.code} (${e.reason.toLowerCase()})`).join(", ")}</p>}
          <div className="row">
            <button className="primary" onClick={() => onApply(res, year)}>Open my chart</button>
            <button className="ghost" onClick={() => setRes(null)}>Choose another file</button>
          </div>
        </div>
      ) : (
        <div className="cards">
          <div className="card">
            <h2>✍ Fill in manually</h2>
            <p>Choose your major and catalog year, then mark completed and enrolled courses yourself. Your progress is saved in this browser.</p>
            <label>Department
              <select value={department} onChange={(e) => pickDepartment(e.target.value)}>
                {DEPARTMENTS.map((d) => <option key={d.code} value={d.code}>{d.code} · {d.name}</option>)}
              </select>
            </label>
            <label>Major
              <select value={key} onChange={(e) => pickMajor(e.target.value)}>
                {majors.map((m) => <option key={m.code} value={m.code}>{m.name} ({m.code})</option>)}
              </select>
            </label>
            <label>Catalog year
              <select value={year} onChange={(e) => setYear(e.target.value)}>
                {years.map((y) => <option key={y} value={y}>{yearLabel(y)}</option>)}
              </select>
            </label>
            <button className="primary" onClick={() => onManual(key, year)}>Start manually</button>
          </div>

          <div className="card">
            <h2>📄 Upload my transcript</h2>
            <p>Upload your unofficial transcript or degree evaluation (PDF or Word) and your completed and in-progress courses are filled in for you.</p>
            <label className={"drop" + (drag ? " on" : "")}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}>
              {busy ? "Reading your transcript…" : "Click to choose a PDF or Word file, or drop it here"}
              <input type="file" accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden disabled={busy} onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <details className="paste">
              <summary>Or paste the text instead</summary>
              <p className="note">Open your <b>Degree Evaluation</b> page, press <b>Ctrl+A</b> then <b>Ctrl+C</b> (on a phone: select all, then copy), and paste it below.</p>
              <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste your degree evaluation or transcript text here" rows={5} />
              <button className="ghost" disabled={busy || text.trim().length < 20} onClick={handleText}>Read pasted text</button>
            </details>
            {err && <p className="err">{err}</p>}
            <details>
              <summary>How do I get my transcript?</summary>
              <ol>
                <li>Log in to your university student portal (for AUS, Banner / Student Self-Service).</li>
                <li>Open <b>Unofficial Transcript</b> under your student records. Menu names may differ slightly.</li>
                <li>Choose <b>Undergraduate</b> level and the unofficial / web transcript type, then submit.</li>
                <li>Save it as a PDF: press <b>Print</b>, then choose <b>Save as PDF</b>.</li>
                <li>Or open <b>Degree Evaluation</b>, generate your evaluation, and save that page as a PDF or a Word (.docx) file.</li>
                <li>Upload the PDF or Word file here. Do not edit it.</li>
              </ol>
              <p className="priv">🔒 Your file is read inside your browser and is never uploaded to any server. You can still change anything on the chart afterwards.</p>
            </details>
          </div>
        </div>
      )}
      <div className="wl-foot">
        <a className="by" href="https://github.com/outragedkhan916" target="_blank" rel="noreferrer">by @OutragedKhan916</a>
        <span className="feedback">If you have any suggestions/feedback, please contact me at <a href="mailto:b00107694@aus.edu">b00107694@aus.edu</a></span>
      </div>
    </div>
  );
}
