"use client";
import { useMemo } from "react";
import type { Course, Info, Program } from "@/lib/types";
import { chain, code, title } from "@/lib/status";
import { GX, GY, H, TOP, W, colX, edgePath, rowY } from "@/lib/route";

interface Props {
  program: Program; byId: Record<string, Course>; info: Record<string, Info>;
  hover: string | null; onHover: (id: string | null) => void; onToggle: (id: string) => void;
}
const ICON = { done: "✓", ok: "", pre: "🔒", cr: "⏳" } as const;

export default function Flowchart({ program, byId, info, hover, onHover, onToggle }: Props) {
  const width = 8 * (W + GX), height = TOP + 8 * (H + GY) + 24;
  const edges = useMemo(() => {
    const lanes: number[] = Array(8).fill(0);
    return program.courses.flatMap((t) =>
      [...t.pre.map((p) => [p, false] as const), ...t.co.map((p) => [p, true] as const)].map(([p, co]) => ({
        from: p, to: t.id, co, d: edgePath(byId[p], t, lanes[t.col]++),
      })));
  }, [program, byId]);
  const focus = useMemo(() => (hover ? chain(hover, byId) : null), [hover, byId]);

  return (
    <div className="board" style={{ width, height }}>
      {program.years.map((y, i) => (
        <div key={y} className={"band " + (i % 2 ? "odd" : "")} style={{ left: i * 2 * (W + GX) - GX / 2, width: 2 * (W + GX) }}>{y}</div>
      ))}
      <div className="band summer" style={{ left: colX(5) + 24, top: rowY(7) - 40, width: 2 * (W + GX) - 48, height: H + 56 }}>Summer · 8 weeks</div>
      <svg width={width} height={height}>
        <defs>
          {[["a", "#5b6b8f"], ["g", "#34c38f"], ["b", "#5aa9ff"]].map(([id, c]) => (
            <marker key={id} id={"m" + id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,1 L10,5 L0,9 z" fill={c} />
            </marker>))}
        </defs>
        {edges.map((e, i) => {
          const hot = !!focus && focus.has(e.from) && focus.has(e.to);
          const k = hot ? "b" : info[e.from].status === "done" ? "g" : "a";
          const col = { a: "#5b6b8f", g: "#34c38f", b: "#5aa9ff" }[k];
          return <path key={i} d={e.d} fill="none" stroke={col} strokeWidth={hot ? 2.6 : 1.5}
            strokeDasharray={e.co ? "5 4" : undefined} markerEnd={`url(#m${k})`}
            opacity={focus ? (hot ? 1 : 0.1) : k === "a" ? 0.55 : 0.85} />;
        })}
      </svg>
      {program.courses.map((c) => {
        const i = info[c.id];
        return (
          <button key={c.id} className={`node ${i.status}`} data-cat={c.cat}
            style={{ left: colX(c.col), top: rowY(c.row), width: W, height: H, opacity: focus && !focus.has(c.id) ? 0.3 : 1 }}
            onClick={() => onToggle(c.id)} onMouseEnter={() => onHover(c.id)} onMouseLeave={() => onHover(null)}
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
