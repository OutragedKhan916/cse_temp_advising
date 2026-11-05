"use client";
import { courseDoc } from "@/lib/courses";

const LABELS: Record<string, string> = { credits: "Credits", prerequisites: "Prerequisites", corequisites: "Corequisites", offered: "Offered" };
const SKIP = new Set(["title", "description"]);

/** Description and information of the selected course (from data/aus_courses.json). */
export default function CourseInfo({ code }: { code: string }) {
  const doc = courseDoc(code);
  const pretty = code.replace(/^([A-Z]+)(\d)/, "$1 $2");
  return (
    <section className="cinfo" aria-label={`Course information for ${pretty}`}>
      <h4 className="avail">Course information</h4>
      {doc ? (<>
        <p className="ci-title"><b>{pretty}</b>{doc.title ? ` · ${doc.title}` : ""}</p>
        {doc.description ? <p className="ci-desc">{doc.description}</p> : <p className="note">No description added yet.</p>}
        <dl>
          {Object.entries(doc).filter(([k, v]) => !SKIP.has(k) && v !== "" && v != null).map(([k, v]) => (
            <div key={k}><dt>{LABELS[k] ?? k.charAt(0).toUpperCase() + k.slice(1)}</dt><dd>{String(v)}</dd></div>
          ))}
        </dl>
      </>) : <p className="note">No description added yet for {pretty}.</p>}
    </section>
  );
}
