"use client";
import { useMemo } from "react";
import type { Course, Info, Program } from "@/lib/types";
import { chain, code, title } from "@/lib/status";
import { GX, H, TOP, W, GY, colX, edgePath, rowY } from "@/lib/route";

interface Props {
  program: Program; byId: Record<string, Course>; info: Record<string, Info>;
  hover: string | null; onHover: (id: string | null) => void; onToggle: (id: string) => void;
  yearAll: boolean[]; yearOpen: boolean[]; onYear: (y: number) => void; modeLabel: string;
}
const ICON = { done: "✓", enr: "●", ok: "", pre: "🔒", cr: "⏳" } as const;

export default function Flowchart({ program, byId, info, hover, onHover, onToggle, yearAll, yearOpen, onYear, modeLabel }: Props) {
  const width = 8 * (W + GX), height = TOP + 8 * (H + GY) + 24;
  const edges = useMemo(() => {
    const lanes: number[] = Array(8).fill(0);
    return program.courses.flatMap((t) =>
      [...t.pre.map((p) => [p, false] as const), ...(t.any || []).map((p) => [p, false] as const), ...t.co.map((p) => [p, true] as const)].map(([p, co]) => ({
        from: p, to: t.id, co, d: edgePath(byId[p], t, lanes[t.col]++),
      })));
  }, [program, byId]);
  const focus = useMemo(() => (hover ? chain(hover, byId) : null), [hover, byId]);

  return (
    <div className="board" style={{ width, height }}>
      {program.years.map((y, i) => (
        <div key={y} className={"band " + (i % 2 ? "odd" : "")} style={{ left: i * 2 * (W + GX) - GX / 2, width: 2 * (W + GX) }}>
          <div className="yt">{y}</div>
          <button className="yearbtn" disabled={!yearOpen[i]} onClick={() => onYear(i)}>
            {yearAll[i] ? "✕ Clear year" : `☑ Select year (${modeLabel})`}
          </button>
        </div>
      ))}
      <div className="summer" style={{ left: colX(5) + 24, top: rowY(7) - 34, width: 2 * (W + GX) - 48, height: H + 48 }}>Summer · 8 weeks</div>
      <svg width={width} height={height}>
        <defs>
          {["a", "g", "b"].map((k) => (
            <marker key={k} id={"m" + k} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path className={"mk " + k} d="M0,1 L10,5 L0,9 z" />
            </marker>))}
        </defs>
        {edges.map((e, i) => {
          const hot = !!focus && focus.has(e.from) && focus.has(e.to);
          const k = hot ? "b" : info[e.from].status === "done" ? "g" : "a";
          return <path key={i} className={"e " + k} d={e.d} strokeWidth={hot ? 2.6 : 1.5}
            strokeDasharray={e.co ? "5 4" : undefined} markerEnd={`url(#m${k})`}
            opacity={focus ? (hot ? 1 : 0.1) : k === "a" ? 0.6 : 0.9} />;
        })}
      </svg>
      {program.courses.map((c) => {
        const i = info[c.id], locked = i.status === "pre" || i.status === "cr";
        return (
          <button key={c.id} className={`node ${i.status}`} data-cat={c.cat} aria-disabled={locked}
            title={locked ? i.why : undefined}
            style={{ left: colX(c.col), top: rowY(c.row), width: W, height: H, opacity: focus && !focus.has(c.id) ? 0.3 : 1 }}
            onClick={() => !locked && onToggle(c.id)} onMouseEnter={() => onHover(c.id)} onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(c.id)} onBlur={() => onHover(null)}>
            <span className="code">{code(c)}<em>{ICON[i.status]}</em></span>
            <span className="name">{title(c)}</span>
            <span className="cr">{c.cr} cr{c.minCr ? ` · ${c.minCr} cr standing` : ""}</span>
          </button>
        );
      })}
    </div>
  );
}
