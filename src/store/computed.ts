import { useMemo } from "react";
import { useApp } from "./store";
import {
  generalAverage,
  semesterAverage,
  subjectStats,
  cumulativeSeries,
  perSubjectSeries,
  type SubjectStats,
} from "../lib/calc";
import { buildAlerts, topActions } from "../lib/alerts";
import { projectAll, projectGlobal, latestEvaluations, buildWeeklyReport } from "../lib/goals";
import { weekRange } from "../lib/id";
import type { Alert, AverageResult } from "../types";

export interface Computed {
  stats: SubjectStats[];
  general: AverageResult;
  s3: AverageResult;
  s4: AverageResult;
  alerts: Alert[];
  priorities: Alert[];
  projections: ReturnType<typeof projectAll>;
  globalProjection: ReturnType<typeof projectGlobal>;
  generalSeries: ReturnType<typeof cumulativeSeries>;
  subjectSeries: (semester: "S3" | "S4" | "all") => ReturnType<typeof perSubjectSeries>;
  latest: ReturnType<typeof latestEvaluations>;
  weekly: ReturnType<typeof buildWeeklyReport>;
  weeklyMinutes: number;
  mastered: number;
  watch: number;
  critical: number;
}

export function useComputed(): Computed {
  const { data } = useApp();

  return useMemo(() => {
    const { subjects, evaluations, sessions, settings, goals, planned } = data;
    const rules = settings.rules;

    const stats = subjects
      .filter((s) => !s.disabled)
      .map((s) => subjectStats(s, evaluations, rules.find((r) => r.subjectId === s.id), settings.minEvalsForAverage))
      .sort((a, b) => a.subject.code.localeCompare(b.subject.code));

    const coefficientsConfirmed = subjects.some((s) => s.coefficientConfirmed);

    const general = generalAverage(subjects, evaluations, rules, settings.minEvalsForAverage, coefficientsConfirmed);
    const s3 = semesterAverage("S3", subjects, evaluations, rules, settings.minEvalsForAverage, coefficientsConfirmed);
    const s4 = semesterAverage("S4", subjects, evaluations, rules, settings.minEvalsForAverage, coefficientsConfirmed);

    const alerts = buildAlerts({ subjects, evaluations, sessions, settings });
    const priorities = topActions(alerts);

    const projections = projectAll(subjects, evaluations, planned, goals);
    const globalProjection = projectGlobal(projections, goals.general);

    const week = weekRange();
    const weekSessions = sessions.filter((s) => s.date >= week.from && s.date <= week.to);
    const weeklyMinutes = weekSessions.reduce((sum, s) => sum + (s.durationMin || 0), 0);

    const evaluable = stats.filter((s) => s.average.value !== null);
    const mastered = evaluable.filter((s) => (s.average.value ?? 0) >= goals.general).length;
    const watch = evaluable.filter((s) => {
      const v = s.average.value ?? 0;
      return v >= settings.lowAverageThreshold && v < goals.general;
    }).length;
    const critical = evaluable.filter((s) => (s.average.value ?? 0) < settings.lowAverageThreshold).length;

    return {
      stats,
      general,
      s3,
      s4,
      alerts,
      priorities,
      projections,
      globalProjection,
      generalSeries: cumulativeSeries(evaluations),
      subjectSeries: (semester) =>
        perSubjectSeries(semester, subjects, evaluations, rules, settings.minEvalsForAverage),
      latest: latestEvaluations(evaluations, 6),
      weekly: buildWeeklyReport(week.from, week.to, subjects, evaluations, sessions, alerts),
      weeklyMinutes,
      mastered,
      watch,
      critical,
    };
  }, [data]);
}
