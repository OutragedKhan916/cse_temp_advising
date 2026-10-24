import type { Program } from "./types";

type Row = { code: string; section: string; text: string };
const START = /^([A-Z]{3,4})\s+(\d{3,5}[A-Z]?)\s+(.*)$/;
const GRADE = /\s(A[+-]?|B[+-]?|C[+-]?|D[+-]?|F|P|NP|W|WP|WF|I|TR)\s+\d+\.\d{3}/;
const PASS = /^(A[+-]?|B[+-]?|C[+-]?|D[+-]?|P|TR)$/;
// transcript code -> catalog id, when they differ
const ALIAS: Record<string, string> = { MTH213: "CMP213" };
// GER category (data/ger.json) -> the GER slot(s) on the chart; any extra core course falls into GERSEL
const SLOT: Record<string, string[]> = { HCAW: ["GER221"], ART: ["GERART"], HIB: ["GERHIB", "GERHI"], CCP: ["GERCCP"] };
export type GerData = Record<string, string[]>;

/** Turn the text lines of an AUS unofficial transcript into course rows. */
export function parseTranscript(lines: string[]) {
  const m = lines.join("\n").match(/BS in Computer (Science|Engineering)/);
  const program = m ? (m[1] === "Science" ? "CMP" : "COE") : null;
  const rows: Row[] = [];
  let section = "";
  for (const raw of lines) {
    const l = raw.trim();
    if (l.includes("TRANSFER CREDIT ACCEPTED")) { section = "transfer"; continue; }
    if (l.includes("INSTITUTION CREDIT")) { section = "inst"; continue; }
    if (l.includes("TRANSCRIPT TOTALS")) { section = ""; continue; }
    if (l.includes("IN PROGRESS")) { section = "progress"; continue; }
    if (!section) continue;
    const s = l.match(START);
    if (s && (section === "transfer" || /^(UG|GR)\b/.test(s[3]))) rows.push({ code: s[1] + s[2], section, text: s[3] });
    // wrapped course titles continue on the next line until the credit hours appear
    else if (rows.length && !/\d+\.\d{3}/.test(rows[rows.length - 1].text)) rows[rows.length - 1].text += " " + l;
  }
  return { program, rows };
}

export function matchTranscript(lines: string[], programs: Record<string, Program>, fallback: string, ger: GerData) {
  const { program, rows } = parseTranscript(lines);
  const key = program ?? fallback;
  const ids = new Set(programs[key].courses.map((c) => c.id));
  const done = new Set<string>(), enr = new Set<string>(), unmatched = new Set<string>();
  const gerUsed: { code: string; slot: string }[] = [];
  const items: { code: string; kind: "done" | "enr" }[] = [];
  for (const r of rows) {
    let kind: "done" | "enr" | null = null;
    if (r.section === "progress") kind = "enr";
    else { const g = r.text.match(GRADE)?.[1]; if (g && PASS.test(g)) kind = "done"; } // F / W / NP / I do not count
    if (kind) items.push({ code: r.code, kind });
  }
  items.sort((a, b) => +(a.kind !== "done") - +(b.kind !== "done")); // completed courses claim slots first
  const taken = (id: string) => done.has(id) || enr.has(id);
  for (const { code, kind } of items) {
    const label = code.replace(/^([A-Z]+)(\d)/, "$1 $2");
    let id: string | null = ALIAS[code] && ids.has(ALIAS[code]) ? ALIAS[code]
      : ids.has(code) ? code
      : code.endsWith("L") && ids.has(code.slice(0, -1)) ? code.slice(0, -1) // lab folded into its lecture course
      : null;
    if (!id) { // general education: first free slot of its category, otherwise the "selected GER course" slot
      const cats = Object.keys(ger).filter((k) => ger[k].includes(code));
      for (const c of cats) { const slot = (SLOT[c] || []).find((x) => ids.has(x) && !taken(x)); if (slot) { id = slot; break; } }
      if (!id && cats.length && ids.has("GERSEL") && !taken("GERSEL")) id = "GERSEL";
      if (id) gerUsed.push({ code: label, slot: id });
    }
    if (!id) unmatched.add(label);
    else (kind === "done" ? done : enr).add(id);
  }
  done.forEach((id) => enr.delete(id));
  return { key, detected: !!program, found: rows.length, done: [...done], enr: [...enr], unmatched: [...unmatched], ger: gerUsed };
}

/** Read a PDF in the browser (pdf.js from a CDN) and return its text, one string per visual line. */
const CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
function loadPdfJs(): Promise<any> {
  const w = window as any;
  if (w.pdfjsLib) return Promise.resolve(w.pdfjsLib);
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = CDN + "pdf.min.js";
    s.onload = () => { w.pdfjsLib.GlobalWorkerOptions.workerSrc = CDN + "pdf.worker.min.js"; res(w.pdfjsLib); };
    s.onerror = () => rej(new Error("Could not load the PDF reader. Check your internet connection and try again."));
    document.head.appendChild(s);
  });
}
export async function readPdfLines(file: File): Promise<string[]> {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const lines: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    const rows: { y: number; items: { x: number; s: string }[] }[] = [];
    for (const it of content.items as any[]) {
      if (!it.str.trim()) continue;
      const x = it.transform[4], y = it.transform[5];
      let r = rows.find((q) => Math.abs(q.y - y) < 3);
      if (!r) rows.push((r = { y, items: [] }));
      r.items.push({ x, s: it.str.trim() });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) lines.push(r.items.sort((a, b) => a.x - b.x).map((i) => i.s).join(" "));
  }
  return lines;
}
