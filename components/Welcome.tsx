"use client";
import { useState } from "react";
import ger from "@/data/ger.json";
import mje from "@/data/mje.json";
import { matchTranscript, readPdfLines } from "@/lib/transcript";
import type { Extra, Placement, Program } from "@/lib/types";

type Result = ReturnType<typeof matchTranscript>;
export interface Applied { key: string; done: string[]; enr: string[]; placed: Record<string, Placement>; extras: Extra[]; }
interface Props {
  programs: Record<string, Program>; defaultKey: string; theme: string; onTheme: () => void;
  onManual: (key: string) => void; onApply: (r: Applied) => void;
}

export default function Welcome({ programs, defaultKey, theme, onTheme, onManual, onApply }: Props) {
  const [key, setKey] = useState(defaultKey);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [drag, setDrag] = useState(false);

  async function handle(f?: File) {
    if (!f) return;
    setErr(""); setBusy(true);
    try {
      if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") throw new Error("Please choose a PDF file.");
      const r = matchTranscript(await readPdfLines(f), programs, key, ger, mje);
      if (!r.found) throw new Error("No courses were found in this PDF. Make sure it is your unofficial transcript.");
      setRes(r);
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not read this file."); }
    finally { setBusy(false); }
  }
  const slotName = (r: Result, id: string) => programs[r.key].courses.find((c) => c.id === id)?.name.replace("GER-Core ", "");

  return (
    <div className="wl">
      <button className="theme wl-theme" onClick={onTheme}>{theme === "dark" ? "☀ Light mode" : "🌙 Dark mode"}</button>
      <img className="logo" src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/logo.png`} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />
      <h1>Advising Portal</h1>
      <p className="sub">How would you like to fill in your courses?</p>

      {res ? (
        <div className="card summary">
          <h2>Transcript read: {programs[res.key].name}</h2>
          {!res.detected && <p className="warn">Could not detect your program, so {programs[res.key].name} was used.</p>}
          <p><b className="c-done">{res.done.length} completed</b>: {res.done.join(", ") || "none"}</p>
          <p><b className="c-enr">{res.enr.length} in progress</b>: {res.enr.join(", ") || "none"}</p>
          {Object.keys(res.placed).length > 0 && (
            <p><b>Electives and GERs</b>: {(Object.entries(res.placed) as [string, Placement][]).map(([id, p]) => `${p.code} → ${slotName(res, id)}${p.confirm ? " ⚠" : ""}`).join(", ")}</p>
          )}
          {res.extras.length > 0 && <p className="warn">Not placed: {res.extras.map((e) => `${e.code} (${e.reason.toLowerCase()})`).join(", ")}</p>}
          <div className="row">
            <button className="primary" onClick={() => onApply(res)}>Open my chart</button>
            <button className="ghost" onClick={() => setRes(null)}>Choose another file</button>
          </div>
        </div>
      ) : (
        <div className="cards">
          <div className="card">
            <h2>✍ Fill in manually</h2>
            <p>Pick your program and mark completed and enrolled courses yourself.</p>
            <label>Program
              <select value={key} onChange={(e) => setKey(e.target.value)}>
                {Object.entries(programs).map(([k, p]) => <option key={k} value={k}>{p.name}</option>)}
              </select>
            </label>
            <button className="primary" onClick={() => onManual(key)}>Start manually</button>
          </div>

          <div className="card">
            <h2>📄 Upload my transcript</h2>
            <p>Upload your unofficial transcript PDF and your completed and in-progress courses are filled in for you.</p>
            <label className={"drop" + (drag ? " on" : "")}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}>
              {busy ? "Reading your transcript…" : "Click to choose a PDF, or drop it here"}
              <input type="file" accept="application/pdf,.pdf" hidden disabled={busy} onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            {err && <p className="err">{err}</p>}
            <details>
              <summary>How do I get my transcript?</summary>
              <ol>
                <li>Log in to your university student portal (for AUS, Banner / Student Self-Service).</li>
                <li>Open <b>Unofficial Transcript</b> under your student records. Menu names may differ slightly.</li>
                <li>Choose <b>Undergraduate</b> level and the unofficial / web transcript type, then submit.</li>
                <li>Save it as a PDF: press <b>Print</b>, then choose <b>Save as PDF</b>.</li>
                <li>Upload that PDF here. Do not edit it.</li>
              </ol>
              <p className="priv">🔒 Your file is read inside your browser and is never uploaded to any server. You can still change anything on the chart afterwards.</p>
            </details>
          </div>
        </div>
      )}
      <a className="by by-bottom" href="https://github.com/outragedkhan916" target="_blank" rel="noreferrer">by @outraged</a>
    </div>
  );
}
