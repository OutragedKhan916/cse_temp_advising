import type { Extra, Placement, Program } from "./types";

type Row = { code: string; section: string; text: string; cr?: number };
const START = /^([A-Z]{3,4})\s+(\d{3,5}[A-Z]?)\s+(.*)$/;
const GRADE = /\s(A[+-]?|B[+-]?|C[+-]?|D[+-]?|F|P|NP|W|WP|WF|I|TR)\s+\d+\.\d{3}/;
const PASS = /^(A[+-]?|B[+-]?|C[+-]?|D[+-]?|P|TR|EX)$/;
// "Academic History" (registrar) format: "[n] CMP 120 Programming I 3 NP 0.00 E"  (credits, grade, quality points)
const HIST = /^(?:\d{1,2}\s+)?([A-Z]{3,4})\s+(\d{3,5}[A-Z]?)\s+(.+?)\s+(\d{1,2})\s+(A[+-]?|B[+-]?|C[+-]?|D[+-]?|F|P|NP|W|WP|WF|I|IP|TR|EX|AUD|ANP|N)\s+\d+\.\d{2}(?:\s|$)/; // anything after the quality points (repeat flag, stray box numbers) is ignored
// transcript code -> catalog id, when they differ
const ALIAS: Record<string, string> = { MTH213: "CMP213", COE397: "NGN397", CMP397: "NGN397", COE497: "NGN397", CMP497: "NGN397" };
// GER category (data/ger.json) -> the GER slot(s) on the chart; any extra core course falls into GERSEL
const SLOT: Record<string, string[]> = { HCAW: ["GER221"], ART: ["GERART"], HIB: ["GERHIB", "GERHI"], CCP: ["GERCCP"] };
export type GerData = Record<string, string[]>;

/** Turn the text lines of an AUS unofficial transcript into course rows. */
export function parseTranscript(lines: string[]) {
  const m = lines.join("\n").match(/BS in Computer (Science|Engineering)/);
  const program = m ? (m[1] === "Science" ? "CMP" : "COE") : null;
  const rows: Row[] = [];
  const hist = lines.some((l) => l.trim() === "Institution Courses");
  let section = "";
  for (const raw of lines) {
    const l = raw.trim().replace(/\s+/g, " ");
    if (hist) {
      if (l === "Institution Courses" || l.startsWith("Transfer Courses")) { section = "hist"; continue; }
      if (l.includes("Transcript Level Totals")) { section = ""; continue; }
      const h = section === "hist" ? l.match(HIST) : null;
      if (h) rows.push({ code: h[1] + h[2], section: "hist", text: h[5], cr: Number(h[4]) }); // text = the grade
      continue;
    }
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

export type MjeData = Record<string, { eligible: string[]; confirm: string[] }>;
const SCI = ["BIO", "CHM", "PHY"]; // natural-science subjects -> GER-SCI slots (CMP)

/**
 * Place every course on the chart.
 * 1) a course in the catalog -> its own box   2) natural science -> GER-SCI   3) on the major-elective list -> MJE slot
 * 4) on a GER list -> its category slot, then the "selected GER" slot   5) everything else (and any overflow) -> free elective.
 */
export function matchTranscript(lines: string[], programs: Record<string, Program>, fallback: string, ger: GerData, mje: MjeData) {
  const { program, rows } = parseTranscript(lines);
  const key = program ?? fallback;
  const prog = programs[key];
  const ids = new Set(prog.courses.map((c) => c.id));
  const slots = (re: RegExp) => prog.courses.filter((c) => re.test(c.id)).map((c) => c.id);
  const mjeSlots = slots(/^MJE/), freSlots = slots(/^FRE/), sciSlots = slots(/^GERSCI/);
  const elig = new Set(mje[key]?.eligible ?? []), conf = new Set(mje[key]?.confirm ?? []);
  const done = new Set<string>(), enr = new Set<string>();
  const placed: Record<string, Placement> = {}, extras: Extra[] = [];
  const taken = (id: string) => done.has(id) || enr.has(id);
  const free = (list: string[]) => list.find((x) => !taken(x));

  const items: { code: string; kind: "done" | "enr"; cr: number }[] = [];
  for (const r of rows) {
    let kind: "done" | "enr" | null = null;
    if (r.section === "progress") kind = "enr";
    else if (r.section === "hist") { if (r.text === "IP") kind = "enr"; else if (PASS.test(r.text)) kind = "done"; }
    else { const g = r.text.match(GRADE)?.[1]; if (g && PASS.test(g)) kind = "done"; } // F / W / NP / I do not count
    if (kind) items.push({ code: r.code, kind, cr: r.cr ?? Number(r.text.match(/(\d+)\.\d{3}/)?.[1] ?? NaN) });
  }
  items.sort((a, b) => +(a.kind !== "done") - +(b.kind !== "done")); // completed courses claim slots first
  const all = new Set(items.map((i) => i.code));

  for (const { code, kind, cr } of items) {
    const label = code.replace(/^([A-Z]+)(\d)/, "$1 $2");
    const id = ALIAS[code] && ids.has(ALIAS[code]) ? ALIAS[code]
      : ["COE397", "CMP397", "COE497", "CMP497", "NGN397"].includes(code) ? ["NGN397", "COE497", "CMP497"].find((x) => ids.has(x)) ?? null
      : ids.has(code) ? code
      : code.endsWith("L") && ids.has(code.slice(0, -1)) ? code.slice(0, -1) // lab folded into its lecture course
      : null;
    if (id) { (kind === "done" ? done : enr).add(id); continue; }
    if (code.endsWith("L") && all.has(code.slice(0, -1))) continue; // lab counted together with its lecture course
    if (cr === 0 || Number(code.match(/\d+/)![0]) < 100) { extras.push({ code: label, reason: "Not counted (preparatory / 0 credit)" }); continue; }

    const subj = code.match(/^[A-Z]+/)![0];
    let slot: string | undefined, confirm = false;
    if (SCI.includes(subj) && sciSlots.length) slot = free(sciSlots);
    else if (elig.has(code)) { slot = free(mjeSlots); confirm = conf.has(code); }
    else {
      const gk = code.replace(/^MCM/, "MDC"); // old media code
      const cats = Object.keys(ger).filter((k) => ger[k].includes(gk));
      for (const c of cats) { const s = (SLOT[c] || []).find((x) => ids.has(x) && !taken(x)); if (s) { slot = s; break; } }
      if (!slot && cats.length) slot = free(["GERSEL"].filter((x) => ids.has(x)));
    }
    if (!slot) { slot = free(freSlots); confirm = false; } // not listed anywhere, or its category is full -> free elective
    if (!slot) { extras.push({ code: label, reason: "No slot left (extra credit)" }); continue; }
    (kind === "done" ? done : enr).add(slot);
    placed[slot] = { code: label, kind, ...(confirm ? { confirm } : {}) };
  }
  done.forEach((i) => enr.delete(i));
  return { key, detected: !!program, found: rows.length, done: [...done], enr: [...enr], placed, extras };
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
  const group = (items: { x: number; y: number; s: string }[]) => {
    const rows: { y: number; items: { x: number; s: string }[] }[] = [];
    for (const it of items) {
      let r = rows.find((q) => Math.abs(q.y - it.y) < 3);
      if (!r) rows.push((r = { y: it.y, items: [] }));
      r.items.push(it);
    }
    rows.sort((a, b) => b.y - a.y);
    return rows.map((r) => r.items.sort((a, b) => a.x - b.x).map((i) => i.s).join(" ").replace(/\s+/g, " "));
  };
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const width = page.getViewport({ scale: 1 }).width;
    const items = ((await page.getTextContent()).items as any[])
      .filter((it) => it.str.trim()).map((it) => ({ x: it.transform[4], y: it.transform[5], s: it.str.trim() }));
    if (items.some((i) => i.s === "Gdr")) { // registrar layout: terms sit in a left and a right column
      lines.push(...group(items.filter((i) => i.x < width * 0.487)), ...group(items.filter((i) => i.x >= width * 0.487)));
    } else lines.push(...group(items));
  }
  return lines;
}
