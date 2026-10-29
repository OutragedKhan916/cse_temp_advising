/**
 * "Degree evaluation record" transcripts (Banner degree audit), as a PDF or a Word file.
 * Both are turned into the same thing first: one text line per table row, with the cells joined by " | ".
 * One parser then reads those lines, so PDF and Word give the same result.
 */

export type Row = { code: string; section: string; text: string; cr?: number };
export type Item = { s: string; x: number; y: number; h?: number };
export const SEP = " | ";

const SUBJ = /^[A-Z]{3,4}$/;
const COURSE = /^\d{3}[A-Z]?$/;
const TERM = /^\d{4,6}$/; // a page break can cut the term short ("2027" + "10")
const CRED = /^\d{1,2}\.\d{0,2}$/;
const PASS = /^(A[+-]?|B[+-]?|C[+-]?|D[+-]?|P|TR|EX)$/;

export const isDegreeEval = (lines: string[]) =>
  lines.some((l) => /Degree\s*evaluation\s*record/i.test(l)) ||
  (lines.some((l) => /Detail\s*Requirements/i.test(l)) && lines.some((l) => /Area\s*Requirements/i.test(l)));

/** CMP or COE, read from "Major Requirements for COE", "BS in Computer Engineering" or the Majors field. */
export function detectProgram(lines: string[]): "CMP" | "COE" | null {
  const t = lines.join("").replace(/[\s|]+/g, "");
  const a = t.match(/(?:Requirements|Electives)for(COE|CMP)/);
  if (a) return a[1] as "CMP" | "COE";
  const b = t.match(/BSinComputer(Science|Engineering)/) || t.match(/Majors?:?Computer(Science|Engineering)/);
  return b ? (b[1] === "Science" ? "CMP" : "COE") : null;
}

/** Read the course rows of a degree evaluation. A course that is listed in several areas is kept once. */
export function parseDegree(lines: string[]) {
  const best = new Map<string, Row>();
  const put = (r: Row) => {
    const old = best.get(r.code);
    if (!old || (old.section !== "hist" && r.section === "hist")) best.set(r.code, r); // completed beats in progress
  };
  let section = "";
  for (const raw of lines) {
    const cells = raw.split(SEP).map((c) => c.trim()).filter(Boolean);
    if (!cells.length) continue;
    const head = cells[0].replace(/\s+/g, "");
    if (/^InProgressCourses$/i.test(head)) { section = "ip"; continue; }
    if (/^RejectedCourses$/i.test(head)) { section = "rej"; continue; }
    if (/^DetailRequirements$/i.test(head)) { section = "detail"; continue; }
    if (section === "rej") continue; // courses the audit threw out (labs counted elsewhere)

    if (section === "ip") { // table: Area | Subject | Course | Title | Credits
      const i = cells.findIndex((c, k) => SUBJ.test(c) && COURSE.test(cells[k + 1] ?? ""));
      if (i < 0) continue;
      const cr = cells.slice(i + 2).find((c) => CRED.test(c));
      put({ code: cells[i] + cells[i + 1], section: "progress", text: "IP", cr: cr ? parseFloat(cr) : undefined });
      continue;
    }

    // detail rows: ... | Term | Subject | Course | Title | [Attribute] | Credits | Grade | Source
    const i = cells.findIndex((c, k) => TERM.test(c) && SUBJ.test(cells[k + 1] ?? "") && COURSE.test(cells[k + 2] ?? ""));
    if (i < 0) continue;
    const rest = cells.slice(i + 3);
    const ci = rest.findIndex((c, k) => k >= 1 && CRED.test(c));
    const tail = ci >= 0 ? rest.slice(ci + 1) : rest.slice(1);
    const source = tail.length && /^[HRT]$/.test(tail[tail.length - 1]) ? tail[tail.length - 1] : "";
    const grade = tail.filter((c) => c !== source)[0] ?? "";
    const code = cells[i + 1] + cells[i + 2];
    const cr = ci >= 0 ? parseFloat(rest[ci]) : undefined;
    if (grade === "IP" || (!grade && source === "R")) put({ code, section: "progress", text: "IP", cr }); // registered, no grade yet
    else if (PASS.test(grade)) put({ code, section: "hist", text: grade, cr });
    // F, W, NP, I ... do not count
  }
  return { program: detectProgram(lines), rows: [...best.values()] };
}

// ---------------------------------------------------------------- PDF
/**
 * The PDF prints very narrow table cells, so text is stacked one character per line.
 * Rebuild it: stack the characters of each column into tokens, then put tokens that share a vertical centre back into one row.
 */
export function stackLines(items: Item[]): string[] {
  const cols: { x: number; its: Item[] }[] = [];
  for (const it of [...items].sort((a, b) => a.x - b.x)) {
    let c = cols.find((q) => Math.abs(q.x - it.x) < 2);
    if (!c) cols.push((c = { x: it.x, its: [] }));
    c.its.push(it);
  }
  type Tok = { s: string; x: number; first: number; last: number; prev: string };
  const toks: Tok[] = [];
  for (const c of cols) {
    c.its.sort((a, b) => b.y - a.y);
    let cur: Tok | null = null;
    for (const it of c.its) {
      if (cur && cur.last - it.y <= 1.7 * (it.h || 11)) {
        cur.s += (cur.prev.length > 2 && it.s.length > 2 ? " " : "") + it.s;
        cur.last = it.y; cur.prev = it.s;
      } else toks.push((cur = { s: it.s, x: c.x, first: it.y, last: it.y, prev: it.s }));
    }
  }
  const centre = (t: Tok) => (t.first + t.last) / 2;
  toks.sort((a, b) => centre(b) - centre(a));
  const rows: { y: number; n: number; toks: Tok[] }[] = [];
  for (const t of toks) {
    const r = rows[rows.length - 1];
    if (r && Math.abs(r.y - centre(t)) <= 8) { r.toks.push(t); r.y = (r.y * r.n + centre(t)) / ++r.n; }
    else rows.push({ y: centre(t), n: 1, toks: [t] });
  }
  return rows.map((r) => r.toks.sort((a, b) => a.x - b.x).map((t) => t.s).join(SEP));
}

// ---------------------------------------------------------------- Word (.docx)
/** Read one file out of a zip (a .docx is a zip). Uses the browser's built-in inflate, so no library is needed. */
async function zipEntry(buf: ArrayBuffer, name: string): Promise<Uint8Array> {
  const u8 = new Uint8Array(buf), v = new DataView(buf);
  let e = u8.length - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("This is not a Word (.docx) file.");
  const n = v.getUint16(e + 10, true);
  let p = v.getUint32(e + 16, true);
  for (let k = 0; k < n && v.getUint32(p, true) === 0x02014b50; k++) {
    const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true);
    const nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), lho = v.getUint32(p + 42, true);
    if (new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl)) === name) {
      const start = lho + 30 + v.getUint16(lho + 26, true) + v.getUint16(lho + 28, true);
      const data = u8.subarray(start, start + csize);
      if (method === 0) return data;
      const out = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return new Uint8Array(await new Response(out).arrayBuffer());
    }
    p += 46 + nl + xl + cl;
  }
  throw new Error("This Word file has no readable text.");
}

const decode = (s: string) =>
  s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** word/document.xml -> one line per paragraph, and one line per table row with its cells joined by " | ". */
export function xmlToLines(xml: string): string[] {
  const lines: string[] = [];
  const re = /<(\/?)w:(tbl|tr|tc|p|t|tab|br|cr)\b[^>]*?(\/?)>|([^<]+)/g;
  let depth = 0, inT = false, para = "", cell = "", row: string[] | null = null;
  const open = (tag: string) => {
    if (tag === "tbl") depth++;
    else if (tag === "tr" && depth === 1) row = [];
    else if (tag === "tc" && depth === 1) cell = "";
    else if (tag === "p") para = "";
    else if (tag === "t") inT = true;
    else if (tag === "tab" || tag === "br" || tag === "cr") para += " ";
  };
  const close = (tag: string) => {
    if (tag === "tbl") depth--;
    else if (tag === "tr" && depth === 1 && row) { const cs = row.map((c) => c.replace(/\s+/g, " ").trim()).filter(Boolean); if (cs.length) lines.push(cs.join(SEP)); row = null; }
    else if (tag === "tc" && depth === 1 && row) row.push(cell);
    else if (tag === "p") { const t = para.replace(/\s+/g, " ").trim(); if (depth === 0) { if (t) lines.push(t); } else if (t) cell += (cell ? " " : "") + t; para = ""; }
    else if (tag === "t") inT = false;
  };
  for (let m; (m = re.exec(xml)); ) {
    if (m[4] !== undefined) { if (inT) para += decode(m[4]); continue; }
    if (m[1]) close(m[2]);
    else { open(m[2]); if (m[3]) close(m[2]); }
  }
  return lines;
}

export async function docxLines(buf: ArrayBuffer): Promise<string[]> {
  return xmlToLines(new TextDecoder().decode(await zipEntry(buf, "word/document.xml")));
}
