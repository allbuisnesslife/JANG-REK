import type { Evaluation, Subject } from "../types";
import { normalize } from "./calc";

function escapeCell(v: string | number): string {
  const s = String(v ?? "");
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function evaluationsToCsv(evals: Evaluation[], subjects: Subject[]): string {
  const header = [
    "Code",
    "Matiere",
    "Semestre",
    "UE",
    "ElementConstitutif",
    "Evaluation",
    "Type",
    "Note",
    "NoteMax",
    "NoteSur20",
    "Coefficient",
    "Date",
    "Commentaire",
  ];
  const rows = evals.map((e) => {
    const s = subjects.find((x) => x.id === e.subjectId);
    const n = normalize(e.score, e.maxScore);
    return [
      s?.code ?? "",
      s?.name ?? e.subjectId,
      e.semester,
      s?.ue ?? "",
      e.component ?? "",
      e.name,
      e.type,
      e.score,
      e.maxScore,
      n === null ? "" : n.toFixed(2),
      e.coefficient,
      e.date,
      e.comment ?? "",
    ].map(escapeCell);
  });
  return [header, ...rows].map((r) => r.join(";")).join("\r\n");
}

export function downloadText(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob(["\ufeff" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
