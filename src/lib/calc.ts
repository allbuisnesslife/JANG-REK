import type {
  AverageResult,
  Confidence,
  Evaluation,
  SemesterId,
  Subject,
  SubjectRule,
} from "../types";

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Normalise une note vers 20. Renvoie null si la note est invalide. */
export function normalize(score: number, maxScore: number): number | null {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) {
    return null;
  }
  return (score / maxScore) * 20;
}

export interface WeightedItem {
  value: number;
  weight: number;
}

/** Moyenne pondérée : somme(valeur × poids) / somme(poids). null si aucun poids. */
export function weightedAverage(items: WeightedItem[]): number | null {
  let sum = 0;
  let w = 0;
  for (const it of items) {
    if (!Number.isFinite(it.value) || !Number.isFinite(it.weight) || it.weight <= 0) {
      continue;
    }
    sum += it.value * it.weight;
    w += it.weight;
  }
  if (w === 0) return null;
  return round2(sum / w);
}

const rank: Record<Confidence, number> = { insufficient: 0, provisional: 1, confirmed: 2 };
export const weakest = (a: Confidence, b: Confidence): Confidence =>
  rank[a] <= rank[b] ? a : b;

function result(
  value: number | null,
  confidence: Confidence,
  count: number,
  weight: number,
  message?: string
): AverageResult {
  return { value, confidence, count, weight, message };
}

/**
 * Moyenne d'un lot d'évaluations d'une même « unité » (EC ou UE entière),
 * avec la règle CC/Examen ou « examen seul » le cas échéant.
 */
function applyRuleAverage(
  evals: Evaluation[],
  rule: SubjectRule | undefined,
  minEvals: number
): AverageResult {
  const usable = evals.filter((e) => normalize(e.score, e.maxScore) !== null);
  if (usable.length === 0) {
    return result(null, "insufficient", 0, 0, "Aucune évaluation saisie — données insuffisantes.");
  }

  if (rule?.enabled) {
    const weight = usable.reduce((s, e) => s + e.coefficient, 0);

    // Module sans contrôle continu : moyenne = note d'examen seule.
    if (rule.examOnly) {
      const taggedEx = usable.filter((e) => e.ruleGroup === "examen");
      const pool = taggedEx.length > 0 ? taggedEx : usable;
      const exAvg = weightedAverage(
        pool.map((e) => ({ value: normalize(e.score, e.maxScore)!, weight: e.coefficient }))
      );
      if (exAvg !== null) {
        return result(
          exAvg,
          "confirmed",
          pool.length,
          weight,
          taggedEx.length > 0
            ? "Module sans contrôle continu : moyenne calculée sur la note d'examen."
            : "Module sans contrôle continu : toutes les notes saisies sont comptées comme examen."
        );
      }
      return result(
        null,
        "insufficient",
        usable.length,
        weight,
        "Module sans contrôle continu — saisis la note d'examen."
      );
    }

    const cc = usable.filter((e) => e.ruleGroup === "cc");
    const ex = usable.filter((e) => e.ruleGroup === "examen");
    const ccAvg = weightedAverage(
      cc.map((e) => ({ value: normalize(e.score, e.maxScore)!, weight: e.coefficient }))
    );
    const exAvg = weightedAverage(
      ex.map((e) => ({ value: normalize(e.score, e.maxScore)!, weight: e.coefficient }))
    );
    const cw = rule.ccWeight;
    const ew = rule.examWeight;

    if (ccAvg !== null && exAvg !== null && cw > 0 && ew > 0) {
      const v = round2((ccAvg * cw + exAvg * ew) / (cw + ew));
      return result(v, "confirmed", usable.length, weight);
    }
    if (ccAvg !== null && exAvg === null && cw > 0) {
      return result(
        ccAvg,
        "provisional",
        usable.length,
        weight,
        "Contrôle continu calculé — l'examen final n'est pas encore reçu."
      );
    }
    if (exAvg !== null && ccAvg === null && ew > 0) {
      return result(
        exAvg,
        "provisional",
        usable.length,
        weight,
        "Examen calculé — le contrôle continu n'est pas encore saisi."
      );
    }
    return result(
      null,
      "insufficient",
      usable.length,
      weight,
      "Règle activée mais aucune évaluation étiquetée CC ou Examen."
    );
  }

  const items = usable.map((e) => ({
    value: normalize(e.score, e.maxScore)!,
    weight: e.coefficient,
  }));
  const v = weightedAverage(items);
  const weight = usable.reduce((s, e) => s + e.coefficient, 0);
  return result(
    v,
    "provisional",
    usable.length,
    weight,
    rule?.enabled
      ? undefined
      : "Moyenne pondérée provisoire : aucune règle officielle (CC/Examen) renseignée."
  );
}

export interface ComponentAverage {
  name: string;
  average: AverageResult;
}

/** Détail des moyennes par élément constitutif (EC) d'une UE. */
export function componentBreakdown(
  evals: Evaluation[],
  components: string[],
  rule: SubjectRule | undefined,
  minEvals: number
): ComponentAverage[] {
  return components.map((name) => ({
    name,
    average: applyRuleAverage(
      evals.filter((e) => e.component === name),
      rule,
      minEvals
    ),
  }));
}

/**
 * Moyenne d'une matière (UE).
 * - UE multi-EC : chaque note est rattachée à un élément constitutif.
 *   L'UE n'est « complète » que lorsque chaque EC a au moins une note ;
 *   sinon moyenne provisoire des EC déjà notés + liste des EC manquants.
 * - UE mono-EC (ou sans EC) : règle CC/Examen / examen seul, sinon moyenne pondérée provisoire.
 */
export function subjectAverage(
  evals: Evaluation[],
  rule: SubjectRule | undefined,
  minEvals: number,
  components?: string[]
): AverageResult {
  const comps = (components ?? []).filter((c) => c.trim().length > 0);
  if (comps.length <= 1) {
    return applyRuleAverage(evals, rule, minEvals);
  }

  const parts = componentBreakdown(evals, comps, rule, minEvals);
  const available = parts.filter((p) => p.average.value !== null);
  const missing = parts.filter((p) => p.average.value === null).map((p) => p.name);

  if (available.length === 0) {
    return result(
      null,
      "insufficient",
      0,
      0,
      `UE à ${comps.length} éléments constitutifs — saisis chaque note d'EC (${comps.join(" ; ")}).`
    );
  }

  const v = weightedAverage(
    available.map((p) => ({ value: p.average.value as number, weight: 1 }))
  );
  const count = available.reduce((s, p) => s + p.average.count, 0);
  const weight = available.reduce((s, p) => s + p.average.weight, 0);

  if (missing.length > 0) {
    return result(
      v,
      "provisional",
      count,
      weight,
      `Moyenne provisoire de l'UE (${available.length}/${comps.length} EC notés) — il manque : ${missing.join(", ")}.`
    );
  }

  const allConfirmed = available.every((p) => p.average.confidence === "confirmed");
  return result(
    v,
    allConfirmed ? "confirmed" : "provisional",
    count,
    weight,
    allConfirmed
      ? undefined
      : rule?.enabled
        ? "Tous les EC sont notés mais une ou plusieurs notes restent provisoires (règle CC/Examen)."
        : "Tous les EC sont notés — moyenne provisoire (aucune règle officielle CC/Examen)."
  );
}

/** Agrégation d'un niveau (UE, semestre, année) : pondérée par coefficient de matière. */
export function aggregate(
  parts: { value: number | null; coefficient: number; confirmed: boolean }[],
  coefficientsConfirmed: boolean
): AverageResult {
  const usable = parts.filter((p) => p.value !== null && p.coefficient > 0);
  if (usable.length === 0) {
    return result(null, "insufficient", 0, 0, "Aucune matière évaluée — données insuffisantes.");
  }
  const v = weightedAverage(
    usable.map((p) => ({ value: p.value as number, weight: p.coefficient }))
  );
  const weight = usable.reduce((s, p) => s + p.coefficient, 0);
  const allConfirmed = usable.every((p) => p.confirmed);
  const confidence: Confidence =
    coefficientsConfirmed && allConfirmed ? "confirmed" : "provisional";
  return result(
    v,
    confidence,
    usable.length,
    weight,
    confidence === "provisional"
      ? "Agrégation provisoire : coefficients de matière non confirmés par la maquette officielle."
      : undefined
  );
}

export interface SubjectStats {
  subject: Subject;
  average: AverageResult;
  evals: Evaluation[];
  best: number | null;
  worst: number | null;
  latest: number | null;
  previousLatest: number | null;
  delta: number | null;
}

const byDateAsc = (a: Evaluation, b: Evaluation) =>
  a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date);

export function subjectStats(
  subject: Subject,
  evals: Evaluation[],
  rule: SubjectRule | undefined,
  minEvals: number
): SubjectStats {
  const own = evals.filter((e) => e.subjectId === subject.id).sort(byDateAsc);
  const normalized = own
    .map((e) => normalize(e.score, e.maxScore))
    .filter((n): n is number => n !== null);
  const average = subjectAverage(own, rule, minEvals, subject.components);
  const latest = normalized.length ? normalized[normalized.length - 1] : null;
  const previousLatest = normalized.length > 1 ? normalized[normalized.length - 2] : null;
  return {
    subject,
    average,
    evals: own,
    best: normalized.length ? Math.max(...normalized) : null,
    worst: normalized.length ? Math.min(...normalized) : null,
    latest,
    previousLatest,
    delta: latest !== null && previousLatest !== null ? round2(latest - previousLatest) : null,
  };
}

export function semesterAverage(
  semester: SemesterId,
  subjects: Subject[],
  evals: Evaluation[],
  rules: SubjectRule[],
  minEvals: number,
  coefficientsConfirmed: boolean
): AverageResult {
  const parts = subjects
    .filter((s) => s.semester === semester && !s.disabled)
    .map((s) => {
      const st = subjectStats(s, evals, rules.find((r) => r.subjectId === s.id), minEvals);
      return {
        value: st.average.value,
        coefficient: s.coefficient,
        confirmed: s.coefficientConfirmed && st.average.confidence === "confirmed",
      };
    });
  return aggregate(parts, coefficientsConfirmed);
}

export function generalAverage(
  subjects: Subject[],
  evals: Evaluation[],
  rules: SubjectRule[],
  minEvals: number,
  coefficientsConfirmed: boolean
): AverageResult {
  const parts = subjects
    .filter((s) => !s.disabled)
    .map((s) => {
      const st = subjectStats(s, evals, rules.find((r) => r.subjectId === s.id), minEvals);
      return {
        value: st.average.value,
        coefficient: s.coefficient,
        confirmed: s.coefficientConfirmed && st.average.confidence === "confirmed",
      };
    });
  return aggregate(parts, coefficientsConfirmed);
}

/** Série cumulative : moyenne générale après chaque évaluation (pour la courbe d'évolution). */
export function cumulativeSeries(evals: Evaluation[]): { index: number; date: string; label: string; average: number }[] {
  const sorted = [...evals].sort(byDateAsc);
  const items: WeightedItem[] = [];
  const out: { index: number; date: string; label: string; average: number }[] = [];
  sorted.forEach((e, i) => {
    const n = normalize(e.score, e.maxScore);
    if (n === null) return;
    items.push({ value: n, weight: e.coefficient });
    out.push({
      index: out.length + 1,
      date: e.date,
      label: `${e.name}`,
      average: weightedAverage(items) ?? 0,
    });
    void i;
  });
  return out;
}

/** Moyennes par matière pour un semestre donné (graphique comparatif). */
export function perSubjectSeries(
  semester: SemesterId | "all",
  subjects: Subject[],
  evals: Evaluation[],
  rules: SubjectRule[],
  minEvals: number
): { id: string; code: string; name: string; average: number | null; count: number }[] {
  return subjects
    .filter((s) => !s.disabled && (semester === "all" || s.semester === semester))
    .map((s) => {
      const st = subjectStats(s, evals, rules.find((r) => r.subjectId === s.id), minEvals);
      return {
        id: s.id,
        code: s.code,
        name: s.name,
        average: st.average.value,
        count: st.average.count,
      };
    });
}

/** Évolution d'une matière : moyenne cumulée au fil des évaluations. */
export function subjectCumulative(evals: Evaluation[], subjectId: string) {
  return cumulativeSeries(evals.filter((e) => e.subjectId === subjectId));
}
