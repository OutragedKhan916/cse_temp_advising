"use client";
import { useMemo } from "react";
import type { Course, Info, Placement, Program } from "@/lib/types";
import type { Crit } from "@/lib/critical";
import { chain, code, title } from "@/lib/status";
import { GX, H, TOP, W, GY, colX, edgePath, rowY } from "@/lib/route";

interface Props {
  program: Program; byId: Record<string, Course>; info: Record<string, Info>;
  hover: string | null; onHover: (id: string | null) => void; onToggle: (id: string) => void;
  yearAll: boolean[]; yearOpen: boolean[]; onYear: (y: number) => void; modeLabel: string; extra?: React.ReactNode; crit?: Crit | null; placed?: Record<string, Placement>;
}
const ICON = { done: "Done", enr: "Enrolled", plan: "Planned", ok: "", pre: "Locked", cr: "Credits" } as const;

export default function Flowchart({ program, byId, info, hover, onHover, onToggle, yearAll, yearOpen, onYear, modeLabel, extra, crit, placed }: Props) {
  const width = 8 * (W + GX), height = TOP + 8 * (H + GY) + 170; // extra room for the elective table
  const edges = useMemo(() => {
    const lanes: number[] = Array(8).fill(0);
    return program.courses.flatMap((t) =>
      [...t.pre.map((p) => [p, false, false] as const), ...(t.any || []).map((p) => [p, false, true] as const), ...t.co.map((p) => [p, true, false] as const)].map(([p, co, any]) => ({
        from: p, to: t.id, co, any, d: edgePath(byId[p], t, lanes[t.col]++),
      })));
  }, [program, byId]);
  const focus = useMemo(() => {
    if (!hover) return null;
    if (crit) { const s = crit.needed(hover); s.add(hover); return s; } // critical mode: only what is still left to do
    return chain(hover, byId);
  }, [hover, byId, crit]);
  /** red arrows: what is still needed for the hovered course, or the tight critical chain when nothing is hovered */
  const red = (e: { from: string; to: string; co: boolean; any: boolean }) => {
    if (!crit || !crit.remaining.has(e.from) || !crit.remaining.has(e.to)) return false;
    if (e.any && crit.pickAny[e.to] !== e.from) return false;
    if (focus) return focus.has(e.from) && focus.has(e.to);
    const w = e.co ? 0 : byId[e.to].row === 7 ? 0 : 1;
    return crit.critical.has(e.from) && crit.critical.has(e.to) && crit.L[e.to] - crit.L[e.from] === w;
  };

  return (
    <div className="board" style={{ width, height }}>
      {program.years.map((y, i) => (
        <div key={y} className={"band " + (i % 2 ? "odd" : "")} style={{ left: i * 2 * (W + GX) - GX / 2, width: 2 * (W + GX) }}>
          <div className="yt">{y}</div>
          <button className="yearbtn" disabled={!yearOpen[i]} onClick={() => onYear(i)}>
            {yearAll[i] ? "Clear year" : `Select year (${modeLabel})`}
          </button>
        </div>
      ))}
      <div className="summer" style={{ left: colX(5) + 24, top: rowY(7) - 34, width: 2 * (W + GX) - 48, height: H + 48 }}>Summer · 8 weeks</div>
      <svg width={width} height={height}>
        <defs>
          {["a", "g", "b", "r"].map((k) => (
            <marker key={k} id={"m" + k} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path className={"mk " + k} d="M0,1 L10,5 L0,9 z" />
            </marker>))}
        </defs>
        {edges.map((e, i) => {
          const isRed = red(e), hot = isRed || (!crit && !!focus && focus.has(e.from) && focus.has(e.to));
          const k = isRed ? "r" : hot ? "b" : info[e.from].status === "done" ? "g" : "a";
          const mark = crit ? { markerStart: `url(#m${k})` } : { markerEnd: `url(#m${k})` }; // critical mode: arrows point back to what is needed
          return <path key={i} className={"e " + k} d={e.d} strokeWidth={hot ? 2.8 : 1.5}
            strokeDasharray={e.co ? "5 4" : undefined} {...mark}
            opacity={focus ? (hot ? 1 : 0.1) : k === "a" ? 0.6 : 0.9} />;
        })}
      </svg>
      {program.courses.map((c) => {
        const i = info[c.id], locked = i.status === "pre" || i.status === "cr";
        // filled elective / GER boxes: pink like any completed course; orange glow while currently taking
        const glow = /^(GER|MJE|FRE)/.test(c.id) && (i.status === "done" || i.status === "enr") ? (i.status === "enr" ? " glow-enr" : " filled") : "";
        const filledBy = glow ? placed?.[c.id]?.code : undefined;
        const rem = !!crit && crit.remaining.has(c.id), isCrit = rem && crit!.critical.has(c.id);
        const slackTxt = rem ? (isCrit ? " · critical" : crit!.slack[c.id] > 0 ? ` · +${crit!.slack[c.id]} sem` : "") : "";
        return (
          <button key={c.id} className={`node ${i.status}${isCrit ? " crit" : ""}${glow}`} data-cat={c.cat} aria-disabled={locked}
            title={locked ? i.why : undefined}
            style={{ left: colX(c.col), top: rowY(c.row), width: W, height: H, opacity: focus && !focus.has(c.id) ? 0.3 : 1 }}
            onClick={() => !locked && onToggle(c.id)} onMouseEnter={() => onHover(c.id)} onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(c.id)} onBlur={() => onHover(null)}>
            <span className="code"><span>{code(c)}{filledBy ? ` · ${filledBy}` : ""}</span><em>{ICON[i.status]}</em></span>
            <span className="name">{title(c)}</span>
            <span className="cr">{c.cr} cr{c.minCr ? ` · ${c.minCr} cr standing` : ""}<b className="slack">{slackTxt}</b></span>
          </button>
        );
      })}
      {extra}
    </div>
  );
}
