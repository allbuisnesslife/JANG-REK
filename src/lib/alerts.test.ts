import { describe, expect, it } from "vitest";
import { avgOf, buildAlerts, splitPeriods } from "./alerts";
import { projectSubject, projectGlobal } from "./goals";
import { defaultGoals, defaultSettings } from "../store/initialState";
import type { Evaluation, RevisionSession, Subject } from "../types";

let n = 0;
const ev = (score: number, day: number, coef = 1): Evaluation => ({
  id: `a${++n}`,
  subjectId: "MTH1301",
  semester: "S3",
  name: `Ev ${n}`,
  type: "devoir",
  score,
  maxScore: 20,
  coefficient: coef,
  date: `2026-03-${String(day).padStart(2, "0")}`,
});

const subject: Subject = {
  id: "MTH1301",
  code: "MTH 1301",
  name: "Analyse 3, probabilités-statistiques",
  semester: "S3",
  ue: "MTH 1301",
  ueConfirmed: false,
  components: ["Probabilités-statistiques"],
  coefficient: 1,
  coefficientConfirmed: false,
  credits: null,
  creditsConfirmed: false,
  disabled: false,
};

const settings = defaultSettings();

describe("splitPeriods — pas d'alerte sur une note isolée", () => {
  it("refuse moins de 4 évaluations", () => {
    expect(splitPeriods([ev(15, 1), ev(10, 2), ev(9, 3)])).toBeNull();
  });
  it("accepte 4 évaluations et sépare en deux périodes", () => {
    const p = splitPeriods([ev(15, 1), ev(15, 2), ev(10, 3), ev(10, 4)]);
    expect(p).not.toBeNull();
    expect(p!.prev).toHaveLength(2);
    expect(p!.curr).toHaveLength(2);
  });
  it("trie chronologiquement", () => {
    const p = splitPeriods([ev(10, 4), ev(15, 1), ev(10, 3), ev(15, 2)]);
    expect(p!.prev.map((e) => e.date)).toEqual(["2026-03-01", "2026-03-02"]);
  });
});

describe("avgOf", () => {
  it("calcule la moyenne simple", () => {
    expect(avgOf([ev(12, 1), ev(16, 2)])).toBe(14);
  });
  it("renvoie null sans évaluation", () => {
    expect(avgOf([])).toBeNull();
  });
});

describe("buildAlerts — détection des baisses", () => {
  const run = (evals: Evaluation[], sessions: RevisionSession[] = []) =>
    buildAlerts({ subjects: [subject], evaluations: evals, sessions, settings });

  it("pas d'alerte sans évaluation", () => {
    expect(run([])).toHaveLength(0);
  });

  it("baisse importante → niveau rouge (≥ 2 points)", () => {
    const alerts = run([ev(15, 1), ev(15, 2), ev(11, 3), ev(11, 4)]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].level).toBe("rouge");
    expect(alerts[0].kind).toBe("baisse");
    expect(alerts[0].previousAverage).toBe(15);
    expect(alerts[0].currentAverage).toBe(11);
    expect(alerts[0].delta).toBe(-4);
    expect(alerts[0].responsible.length).toBeGreaterThan(0);
    expect(alerts[0].actionPlan.length).toBeGreaterThan(10);
  });

  it("baisse modérée → niveau orange", () => {
    const alerts = run([ev(15, 1), ev(15, 2), ev(14, 3), ev(13, 4)]);
    expect(alerts[0].level).toBe("orange");
  });

  it("moyenne stable et suffisante → niveau vert", () => {
    const alerts = run([ev(16, 1), ev(16, 2), ev(15, 3), ev(16, 4)]);
    expect(alerts[0].level).toBe("vert");
  });

  it("progression → niveau vert avec kind progresse", () => {
    const alerts = run([ev(11, 1), ev(11, 2), ev(15, 3), ev(15, 4)]);
    expect(alerts[0].kind).toBe("progresse");
    expect(alerts[0].delta).toBe(4);
  });

  it("moyenne faible persistante → alerte (≥ minEvalsForAlert)", () => {
    const alerts = run([ev(10, 1), ev(10, 2), ev(11, 3), ev(11, 4)]);
    expect(alerts[0].level === "orange" || alerts[0].level === "rouge").toBe(true);
    expect(alerts[0].kind === "faible" || alerts[0].kind === "baisse").toBe(true);
  });

  it("n'utilise pas les difficultés inventées : notions issues des séances réelles", () => {
    const sessions: RevisionSession[] = [
      {
        id: "s1",
        date: "2026-03-05",
        subjectId: "MTH1301",
        chapter: "Lois de probabilité",
        summary: "",
        definitions: "",
        difficulties: "Lois continues",
        exercisesToDo: "",
        exercisesDone: 1,
        exercisesFailed: 2,
        durationMin: 60,
      },
    ];
    const alerts = run([ev(15, 1), ev(15, 2), ev(11, 3), ev(11, 4)], sessions);
    expect(alerts[0].notions).toContain("Lois de probabilité");
    expect(alerts[0].actionPlan).toContain("2 exercices");
  });
});

describe("projectSubject / projectGlobal — notes nécessaires", () => {
  const planned = [
    { id: "p1", subjectId: "MTH1301", name: "Examen final", coefficient: 2 },
  ];

  it("non déterminable sans évaluation prévue", () => {
    const p = projectSubject(subject, [ev(12, 1, 1)], [], 15);
    expect(p.needed).toBeNull();
    expect(p.feasible).toBeNull();
    expect(p.current).toBe(12);
  });

  it("calcule la note à obtenir pour atteindre 15", () => {
    // reçues : 12 (poids 1) ; restant : poids 2 → (15×3 − 12)/2 = 16.5
    const p = projectSubject(subject, [ev(12, 1, 1)], planned, 15);
    expect(p.needed).toBe(16.5);
    expect(p.feasible).toBe(true);
  });

  it("détecte un objectif impossible et calcule le maximum atteignable", () => {
    // reçues : 6 (poids total 2) ; restant : poids 1 → (15×3 − 12)/1 = 33 > 20 → impossible
    const p = projectSubject(subject, [ev(6, 1, 1), ev(6, 2, 1)], [{ ...planned[0], coefficient: 1 }], 15);
    expect(p.needed).toBeGreaterThan(20);
    expect(p.feasible).toBe(false);
    expect(p.bestPossible).toBe(10.67); // (12 + 20×1) / 3
  });

  it("signale un objectif déjà assuré", () => {
    // 20/20 obtenu avec très peu de poids restant → note restante négative = objectif assuré
    const p = projectSubject(
      subject,
      [ev(20, 1, 1)],
      [{ id: "p2", subjectId: "MTH1301", name: "Examen", coefficient: 0.3 }],
      15
    );
    expect(p.needed).toBeLessThanOrEqual(0);
  });

  it("projection globale agrège les poids restants", () => {
    const p1 = projectSubject(subject, [ev(12, 1, 1)], planned, 15);
    const g = projectGlobal([p1], 15);
    expect(g.current).toBe(12);
    expect(g.neededOverall).toBe(16.5);
    expect(g.feasible).toBe(true);
  });

  it("projection globale sans notes → null", () => {
    const g = projectGlobal([], 15);
    expect(g.current).toBeNull();
    expect(g.neededOverall).toBeNull();
  });
});
