"use client";
import type { Course, Extra, Info, Placement, Program } from "@/lib/types";
import { GX, W, colX, rowY } from "@/lib/route";

interface Props { program: Program; info: Record<string, Info>; placed: Record<string, Placement>; extras: Extra[]; }

const label = (c: Course) =>
  /^MJE/.test(c.id) ? `Major elective ${c.id.slice(3)}` : /^FRE/.test(c.id) ? `Free elective ${c.id.slice(3)}`
  : c.id.startsWith("GERSCI") ? `Natural sciences ${c.id.slice(6)}` : c.id === "GERSEL" ? "Selected GER (any category)"
  : c.name.replace(/^GER-Core /, "");

/** Table in the free space of the plan: which transcript course sits in each GER / elective box. */
export default function Tracker({ program, info, placed, extras }: Props) {
  const groups: [string, RegExp][] = [["General education (GER)", /^GER/], ["Major electives", /^MJE/], ["Free electives", /^FRE/]];
  return (
    <div className="tracker" style={{ left: colX(0), top: rowY(6) + 6, width: 5 * (W + GX) - GX }}>
      <div className="tr-grid">
        {groups.map(([title, re]) => (
          <table key={title}>
            <thead><tr><th colSpan={2}>{title}</th></tr></thead>
            <tbody>
              {program.courses.filter((c) => re.test(c.id)).map((c) => {
                const st = info[c.id].status, on = st === "done" || st === "enr" || st === "plan", p = placed[c.id];
                return (
                  <tr key={c.id} className={on ? st : ""}>
                    <td>{label(c)}</td>
                    <td>{on ? (p ? p.code : st === "plan" ? "planned" : "marked manually") : "—"}{on && p?.confirm ? " ⚠ confirm" : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ))}
      </div>
      {extras.length > 0 && (
        <p className="tr-extra"><b>Not placed:</b> {extras.map((e) => `${e.code} (${e.reason.toLowerCase()})`).join(" · ")}</p>
      )}
      <p className="tr-rule">One GER course per category, then one more fills “Selected GER”. Anything beyond that, or not on the GER or major-elective lists, goes to a free elective. ⚠ = special topic, confirm with your advisor.</p>
    </div>
  );
}
