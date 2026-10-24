import type { Program } from "./types";

type Row = { code: string; section: string; text: string };
const START = /^([A-Z]{3,4})\s+(\d{3}[A-Z]?)\s+(.*)$/;
const GRADE = /\s(A[+-]?|B[+-]?|C[+-]?|D[+-]?|F|P|NP|W|WP|WF|I|TR)\s+\d+\.\d{3}/;
const PASS = /^(A[+-]?|B[+-]?|C[+-]?|D[+-]?|P|TR)$/;
// transcript code -> catalog id, when they differ
const ALIAS: Record<string, string> = { MTH213: "CMP213", ARA102: "GER221" };

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

export function matchTranscript(lines: string[], programs: Record<string, Program>, fallback: string) {
  const { program, rows } = parseTranscript(lines);
  const key = program ?? fallback;
  const ids = new Set(programs[key].courses.map((c) => c.id));
  const done = new Set<string>(), enr = new Set<string>(), unmatched = new Set<string>();
  for (const r of rows) {
    let kind: "done" | "enr" | null = null;
    if (r.section === "progress") kind = "enr";
    else { const g = r.text.match(GRADE)?.[1]; if (g && PASS.test(g)) kind = "done"; } // F / W / NP / I do not count
    if (!kind) continue;
    const id = ALIAS[r.code] && ids.has(ALIAS[r.code]) ? ALIAS[r.code]
      : ids.has(r.code) ? r.code
      : r.code.endsWith("L") && ids.has(r.code.slice(0, -1)) ? r.code.slice(0, -1) // lab folded into its lecture course
      : null;
    if (!id) unmatched.add(r.code.replace(/^([A-Z]+)(\d)/, "$1 $2"));
    else (kind === "done" ? done : enr).add(id);
  }
  done.forEach((id) => enr.delete(id));
  return { key, detected: !!program, found: rows.length, done: [...done], enr: [...enr], unmatched: [...unmatched] };
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
