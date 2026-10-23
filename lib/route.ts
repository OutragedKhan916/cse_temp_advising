import type { Course } from "./types";

export const W = 164, H = 68, GX = 96, GY = 34, TOP = 56;
export const colX = (c: number) => c * (W + GX);
export const rowY = (r: number) => TOP + r * (H + GY) + (r === 7 ? 12 : 0);
type Pt = [number, number];

/** Orthogonal route with rounded corners. Long edges travel through the empty gap between rows. */
export function edgePath(a: Course, t: Course, lane: number): string {
  const x1 = colX(a.col) + W, y1 = rowY(a.row) + H / 2;
  const x2 = colX(t.col), y2 = rowY(t.row) + H / 2;
  let pts: Pt[];
  if (t.col === a.col) { // same column: straight vertical hop
    const down = t.row > a.row, cx = colX(a.col) + W / 2 + (down ? -12 : 12);
    pts = [[cx, down ? rowY(a.row) + H : rowY(a.row)], [cx, down ? rowY(t.row) : rowY(t.row) + H]];
  } else if (t.col === a.col + 1) {
    const mx = x2 - 14 - (lane % 5) * 11;
    pts = y1 === y2 ? [[x1, y1], [x2, y2]] : [[x1, y1], [mx, y1], [mx, y2], [x2, y2]];
  } else {
    const gx1 = x1 + 14 + (lane % 4) * 7, gx2 = x2 - 14 - (lane % 5) * 11;
    const gy = (t.row >= a.row ? rowY(a.row) + H + GY / 2 : rowY(a.row) - GY / 2) + ((lane % 3) - 1) * 6;
    pts = [[x1, y1], [gx1, y1], [gx1, gy], [gx2, gy], [gx2, y2], [x2, y2]];
  }
  return round(pts, 9);
}

function round(p: Pt[], r: number): string {
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 1; i < p.length - 1; i++) {
    const [px, py] = p[i - 1], [x, y] = p[i], [nx, ny] = p[i + 1];
    const l1 = Math.hypot(x - px, y - py), l2 = Math.hypot(nx - x, ny - y);
    const k = Math.min(r, l1 / 2, l2 / 2);
    d += ` L${x - ((x - px) / l1) * k},${y - ((y - py) / l1) * k} Q${x},${y} ${x + ((nx - x) / l2) * k},${y + ((ny - y) / l2) * k}`;
  }
  const e = p[p.length - 1];
  return d + ` L${e[0]},${e[1]}`;
}
