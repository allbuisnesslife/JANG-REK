import { normalize, round2 } from "./calc";
import { avgOf, splitPeriods } from "./alerts";
import type {
  Alert,
  Evaluation,
  Goals,
  PlannedEvaluation,
  RevisionSession,
  SemesterId,
  Subject,
} from "../types";

export interface Projection {
  subjectId: string;
  subjectName: string;
  current: number | null;
  currentWeight: number;
  plannedWeight: number;
  /** Note moyenne à obtenir sur les évaluations prévues pour atteindre l'objectif. */
  needed: number | null;
  feasible: boolean | null;
  /** Meilleure moyenne finale encore accessible. */
  bestPossible: number | null;
  gap: number | null;
  receivedSum: number;
  hasPlanned: boolean;
}

/**
 * Calcule, pour une matière, la note nécessaire sur les évaluations restantes.
 * - Pas d'évaluation prévue → non déterminable (aucune hypothèse inventée).
 * - Note nécessaire > 20 → objectif impossible : on calcule la meilleure moyenne atteignable.
 */
export function projectSubject(
  subject: Subject,
  evals: Evaluation[],
  planned: PlannedEvaluation[],
  goal: number
): Projection {
  const own = evals.filter((e) => e.subjectId === subject.id);
  const received = own
    .map((e) => ({ value: normalize(e.score, e.maxScore), weight: e.coefficient }))
    .filter((i): i is { value: number; weight: number } => i.value !== null && i.weight > 0);

  const S = received.reduce((s, i) => s + i.value * i.weight, 0);
  const Wc = received.reduce((s, i) => s + i.weight, 0);
  const ownPlanned = planned.filter((p) => p.subjectId === subject.id);
  const Wp = ownPlanned.reduce((s, p) => s + (p.coefficient > 0 ? p.coefficient : 0), 0);

  const current = Wc > 0 ? round2(S / Wc) : null;
  const gap = current !== null ? round2(goal - current) : null;

  if (Wp <= 0) {
    return {
      subjectId: subject.id,
      subjectName: `${subject.code} — ${subject.name}`,
      current,
      currentWeight: round2(Wc),
      plannedWeight: 0,
      needed: null,
      feasible: null,
      bestPossible: current,
      gap,
      receivedSum: round2(S),
      hasPlanned: false,
    };
  }

  const needed = round2((goal * (Wc + Wp) - S) / Wp);
  const bestPossible = round2((S + 20 * Wp) / (Wc + Wp));
  const feasible = needed <= 20;

  return {
    subjectId: subject.id,
    subjectName: `${subject.code} — ${subject.name}`,
    current,
    currentWeight: round2(Wc),
    plannedWeight: round2(Wp),
    needed,
    feasible,
    bestPossible,
    gap,
    receivedSum: round2(S),
    hasPlanned: true,
  };
}

export function projectAll(
  subjects: Subject[],
  evals: Evaluation[],
  planned: PlannedEvaluation[],
  goals: Goals,
  semester?: SemesterId
): Projection[] {
  return subjects
    .filter((s) => !s.disabled && (!semester || s.semester === semester))
    .map((s) =>
      projectSubject(s, evals, planned, goals.bySubject[s.id] ?? goals.general)
    );
}

export interface GlobalProjection {
  current: number | null;
  neededOverall: number | null;
  feasible: boolean | null;
  bestPossible: number | null;
}

/**
 * Projection générale : quelle moyenne faut-il sur l'ensemble des évaluations restantes.
 */
export function projectGlobal(projections: Projection[], goal: number): GlobalProjection {
  const withWeight = projections;
  const S = withWeight.reduce((s, p) => s + p.receivedSum, 0);
  const Wc = withWeight.reduce((s, p) => s + p.currentWeight, 0);
  const Wp = withWeight.reduce((s, p) => s + p.plannedWeight, 0);
  if (Wc <= 0) {
    return { current: null, neededOverall: null, feasible: null, bestPossible: null };
  }
  const current = round2(S / Wc);
  if (Wp <= 0) {
    return { current, neededOverall: null, feasible: null, bestPossible: current };
  }
  const needed = round2((goal * (Wc + Wp) - S) / Wp);
  return {
    current,
    neededOverall: needed,
    feasible: needed <= 20,
    bestPossible: round2((S + 20 * Wp) / (Wc + Wp)),
  };
}

export interface WeeklyReport {
  from: string;
  to: string;
  totalMinutes: number;
  sessionsCount: number;
  exercisesSucceeded: number;
  exercisesFailed: number;
  progress: { id: string; label: string; delta: number }[];
  declining: { id: string; label: string; delta: number }[];
  weakChapters: { subject: string; chapter: string; reason: string }[];
  priorities: { label: string; detail: string }[];
  subjectsStudied: number;
}

/** Bilan hebdomadaire calculé uniquement à partir des données réelles saisies. */
export function buildWeeklyReport(
  from: string,
  to: string,
  subjects: Subject[],
  evals: Evaluation[],
  sessions: RevisionSession[],
  alerts: Alert[]
): WeeklyReport {
  const inRange = sessions.filter((s) => s.date >= from && s.date <= to);
  const totalMinutes = inRange.reduce((sum, s) => sum + (s.durationMin || 0), 0);
  const exercisesSucceeded = inRange.reduce((sum, s) => sum + (s.exercisesDone || 0), 0);
  const exercisesFailed = inRange.reduce((sum, s) => sum + (s.exercisesFailed || 0), 0);
  const studiedIds = new Set(inRange.map((s) => s.subjectId));
  const codeOf = (id: string) => subjects.find((s) => s.id === id)?.code ?? id;

  const progress: WeeklyReport["progress"] = [];
  const declining: WeeklyReport["declining"] = [];
  for (const subject of subjects) {
    if (subject.disabled) continue;
    const own = evals.filter((e) => e.subjectId === subject.id);
    const periods = splitPeriods(own);
    if (!periods) continue;
    const prev = avgOf(periods.prev);
    const curr = avgOf(periods.curr);
    if (prev === null || curr === null) continue;
    const delta = round2(curr - prev);
    const label = `${subject.code} — ${subject.name}`;
    if (delta >= 0.5) progress.push({ id: subject.id, label, delta });
    else if (delta <= -0.5) declining.push({ id: subject.id, label, delta });
  }
  progress.sort((a, b) => b.delta - a.delta);
  declining.sort((a, b) => a.delta - b.delta);

  const weakChapters: WeeklyReport["weakChapters"] = inRange
    .filter((s) => s.difficulties.trim() || (s.exercisesFailed || 0) > 0)
    .map((s) => ({
      subject: codeOf(s.subjectId),
      chapter: s.chapter || "(chapitre non renseigné)",
      reason: s.difficulties.trim()
        ? `Difficulté notée : ${s.difficulties}`
        : `${s.exercisesFailed} exercice(s) en échec`,
    }));

  const priorities: WeeklyReport["priorities"] = [];
  const alertPriority = alerts.filter((a) => a.level !== "vert");
  for (const a of alertPriority.slice(0, 3)) {
    priorities.push({ label: a.subjectName, detail: a.actionPlan });
  }
  if (priorities.length < 3) {
    for (const d of declining.slice(0, 3 - priorities.length)) {
      priorities.push({
        label: d.label,
        detail: `Moyenne en baisse de ${Math.abs(d.delta)} point(s) : reprendre les chapitres récents et refaire des exercices avant la prochaine évaluation.`,
      });
    }
  }
  if (priorities.length < 3 && weakChapters.length) {
    for (const w of weakChapters.slice(0, 3 - priorities.length)) {
      priorities.push({
        label: `${w.subject} — ${w.chapter}`,
        detail: `${w.reason}. Prévoir une séance de 45 min de cours et 1 h 30 d'exercices sur ce chapitre.`,
      });
    }
  }

  return {
    from,
    to,
    totalMinutes,
    sessionsCount: inRange.length,
    exercisesSucceeded,
    exercisesFailed,
    progress,
    declining,
    weakChapters,
    priorities,
    subjectsStudied: studiedIds.size,
  };
}

/** Notes les plus récentes (pour le tableau de bord). */
export function latestEvaluations(evals: Evaluation[], n: number): Evaluation[] {
  return [...evals].sort((a, b) =>
    b.date === a.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)
  ).slice(0, n);
}
