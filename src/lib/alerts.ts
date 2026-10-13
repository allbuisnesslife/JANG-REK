import { normalize, round2, subjectAverage } from "./calc";
import type { Alert, Evaluation, RevisionSession, Settings, Subject } from "../types";

const byDateAsc = (a: Evaluation, b: Evaluation) =>
  a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date);

/** Découpe chronologique en deux périodes comparables (même nombre d'évaluations à peu près). */
export function splitPeriods(evals: Evaluation[]): { prev: Evaluation[]; curr: Evaluation[] } | null {
  const sorted = [...evals].sort(byDateAsc);
  if (sorted.length < 4) return null; // jamais d'alerte fondée sur une note isolée
  const half = Math.floor(sorted.length / 2);
  if (half < 2 || sorted.length - half < 2) return null;
  return { prev: sorted.slice(0, half), curr: sorted.slice(half) };
}

export function avgOf(evals: Evaluation[]): number | null {
  const items = evals
    .map((e) => ({ value: normalize(e.score, e.maxScore), weight: e.coefficient }))
    .filter((i): i is { value: number; weight: number } => i.value !== null);
  if (!items.length) return null;
  const sum = items.reduce((s, i) => s + i.value * i.weight, 0);
  const w = items.reduce((s, i) => s + i.weight, 0);
  return w > 0 ? round2(sum / w) : null;
}

function notionsFor(subjectId: string, sessions: RevisionSession[], evals: Evaluation[]): string[] {
  const set = new Set<string>();
  sessions
    .filter((s) => s.subjectId === subjectId && s.difficulties.trim())
    .forEach((s) => set.add(s.chapter || s.difficulties));
  evals
    .filter((e) => e.subjectId === subjectId && e.comment && e.comment.trim())
    .forEach((e) => set.add((e.comment ?? "").trim()));
  return Array.from(set).slice(0, 4);
}

function actionPlan(
  subjectName: string,
  sessions: RevisionSession[],
  failedExercises: number,
  lastChapter: string | null,
  kind: Alert["kind"]
): string {
  const chapterPart = lastChapter
    ? `Reprends le chapitre « ${lastChapter} »`
    : `Reprends le dernier chapitre de ${subjectName} dans « Mes cours »`;
  const drill = failedExercises > 0
    ? `refais ${failedExercises} exercice${failedExercises > 1 ? "s" : ""} en échec`
    : "réalise trois exercices supplémentaires";
  if (kind === "progresse") {
    return `Continue sur cette lancée : ${chapterPart} en gardant le rythme 45 min de cours + 1 h 30 d'exercices, et garde un exercice de contrôle par semaine.`;
  }
  if (kind === "faible") {
    return `${chapterPart} puis ${drill} avant la prochaine évaluation. Bloque 45 min de cours et 1 h 30 d'exercices sur les deux prochaines séances.`;
  }
  if (kind === "baisse") {
    return `${chapterPart} et ${drill} avant la prochaine évaluation. Programme deux séances de 45 min de cours et 1 h 30 d'exercices cette semaine.`;
  }
  return `${chapterPart} pour consolider : 45 min de cours et 1 h 30 d'exercices à chaque séance.`;
}

export interface AlertInput {
  subjects: Subject[];
  evaluations: Evaluation[];
  sessions: RevisionSession[];
  settings: Settings;
}

/** Génère les alertes (vert / orange / rouge) à partir des données réelles. */
export function buildAlerts({ subjects, evaluations, sessions, settings }: AlertInput): Alert[] {
  const alerts: Alert[] = [];

  for (const subject of subjects) {
    if (subject.disabled) continue;
    const evals = evaluations.filter((e) => e.subjectId === subject.id).sort(byDateAsc);
    if (evals.length === 0) continue;

    const stat = subjectAverage(
      evals,
      settings.rules.find((r) => r.subjectId === subject.id),
      settings.minEvalsForAverage,
      subject.components
    );
    const current = stat.value;
    const periods = splitPeriods(evals);
    const prevAvg = periods ? avgOf(periods.prev) : null;
    const currAvg = periods ? avgOf(periods.curr) : null;
    const delta = prevAvg !== null && currAvg !== null ? round2(currAvg - prevAvg) : null;

    let level: Alert["level"] = "vert";
    let kind: Alert["kind"] = "stable";
    let title = "Résultats stables";

    const lowAvg =
      current !== null && evals.length >= settings.minEvalsForAlert
        ? current < settings.lowAverageThreshold
        : false;

    if (delta !== null && delta <= -settings.dropAlertPoints) {
      level = "rouge";
      kind = "baisse";
      title = `Baisse importante : ${Math.abs(delta)} points entre deux périodes`;
    } else if (delta !== null && delta <= -settings.dropModeratePoints) {
      level = "orange";
      kind = "baisse";
      title = `Baisse modérée : ${Math.abs(delta)} points entre deux périodes`;
    } else if (lowAvg && current !== null && current < settings.lowAverageThreshold - 2) {
      level = "rouge";
      kind = "faible";
      title = `Moyenne très inférieure à ${settings.lowAverageThreshold}/20 depuis ${evals.length} évaluations`;
    } else if (lowAvg) {
      level = "orange";
      kind = "faible";
      title = `Moyenne inférieure à ${settings.lowAverageThreshold}/20 sur plusieurs évaluations`;
    } else if (delta !== null && delta >= 1) {
      level = "vert";
      kind = "progresse";
      title = `Progression de ${delta} points entre deux périodes`;
    }

    const responsibleSource = kind === "baisse" && periods ? periods.curr : evals.slice(-3);
    const responsible = responsibleSource
      .slice()
      .sort((a, b) => (normalize(a.score, a.maxScore) ?? 0) - (normalize(b.score, b.maxScore) ?? 0))
      .slice(0, 3)
      .map((e) => ({
        name: e.name,
        date: e.date,
        score: e.score,
        maxScore: e.maxScore,
      }));

    const ownSessions = sessions
      .filter((s) => s.subjectId === subject.id)
      .sort((a, b) => b.date.localeCompare(a.date));
    const failed = ownSessions
      .slice(0, 3)
      .reduce((sum, s) => sum + (s.exercisesFailed || 0), 0);
    const lastChapter = ownSessions.find((s) => s.chapter.trim())?.chapter ?? null;

    alerts.push({
      id: `alert-${subject.id}`,
      level,
      subjectId: subject.id,
      subjectName: `${subject.code} — ${subject.name}`,
      kind,
      title,
      previousAverage: prevAvg,
      currentAverage: currAvg ?? current,
      delta: delta ?? (current !== null && currAvg !== null ? round2(current - currAvg) : null),
      responsible,
      notions: notionsFor(subject.id, sessions, evals),
      actionPlan: actionPlan(subject.name, ownSessions, failed, lastChapter, kind),
      generatedAt: new Date().toISOString(),
    });
  }

  const order = { rouge: 0, orange: 1, vert: 2 } as const;
  return alerts.sort((a, b) => order[a.level] - order[b.level]);
}

/** Les 3 actions prioritaires de la semaine, déduites des alertes réelles. */
export function topActions(alerts: Alert[]): Alert[] {
  return alerts.filter((a) => a.level !== "vert").slice(0, 3);
}
