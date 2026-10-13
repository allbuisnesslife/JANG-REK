import { buildSubjects } from "../data/maquette";
import { isoDaysAgo } from "../lib/id";
import type { AppData, Evaluation, RevisionSession } from "../types";

export const DATA_VERSION = 2;

export function defaultSettings(): AppData["settings"] {
  return {
    theme: "light",
    dropAlertPoints: 2,
    dropModeratePoints: 1,
    lowAverageThreshold: 12,
    minEvalsForAlert: 4,
    minEvalsForAverage: 2,
    rules: [],
  };
}

export function defaultGoals(): AppData["goals"] {
  return {
    general: 15,
    bySemester: { S3: 15, S4: 15 },
    bySubject: {},
    weeklyMinutes: 2 * 60 + 15 * 7, // 2 h 15 par jour × 7
    exerciseSuccessRate: 80,
  };
}

export function createInitialState(isDemo = false): AppData {
  return {
    version: DATA_VERSION,
    isDemo,
    profile: { name: "Étudiant L2 Géomatique", promo: "L2 Géomatique — Sénégal", objective: 15 },
    subjects: buildSubjects(),
    evaluations: [],
    planned: [],
    sessions: [],
    documents: [],
    tasks: [],
    goals: defaultGoals(),
    settings: defaultSettings(),
    createdAt: new Date().toISOString(),
  };
}

let n = 0;
const ev = (
  subjectId: string,
  semester: Evaluation["semester"],
  name: string,
  type: Evaluation["type"],
  score: number,
  maxScore: number,
  coefficient: number,
  daysAgo: number,
  comment?: string,
  ruleGroup?: Evaluation["ruleGroup"]
): Evaluation => ({
  id: `demo_ev_${++n}`,
  subjectId,
  semester,
  name,
  type,
  score,
  maxScore,
  coefficient,
  date: isoDaysAgo(daysAgo),
  comment,
  ruleGroup,
});

/** Jeu de démonstration clairement identifié (isDemo = true), supprimable en un clic. */
export function createDemoState(): AppData {
  const base = createInitialState(true);

  const evaluations: Evaluation[] = [
    // MTH 1301 — trajectoire en baisse (sert à démontrer les alertes)
    ev("MTH1301", "S3", "Devoir 1 — Analyse 3", "devoir", 14, 20, 1, 40, "", "cc"),
    ev("MTH1301", "S3", "Contrôle continu — Probabilités", "controle_continu", 13.5, 20, 1, 27, "", "cc"),
    ev("MTH1301", "S3", "Examen partiel", "examen", 11.5, 20, 2, 13, "Lois de probabilité : exercices 3 et 5", "examen"),
    // GMT 1305
    ev("GMT1305", "S3", "Devoir 1 — Traitement du signal", "devoir", 15, 20, 1, 38, "", "cc"),
    ev("GMT1305", "S3", "TP — Analyse spectrale", "tp", 16, 20, 1, 22, "", "cc"),
    ev("GMT1305", "S3", "Examen", "examen", 14, 20, 2, 9, "", "examen"),
    // GMT 1306
    ev("GMT1306", "S3", "Devoir 1 — Géodésie", "devoir", 12, 20, 1, 35, "", "cc"),
    ev("GMT1306", "S3", "Exposé — Positionnement par satellite", "expose", 15, 20, 1, 18, "", "cc"),
    // INF 1302
    ev("INF1302", "S3", "Devoir 1 — Algorithmes", "devoir", 13, 20, 1, 33, "", "cc"),
    ev("INF1302", "S3", "TP — Structures de données", "tp", 17, 20, 1, 19, "", "cc"),
    // TCC 1307
    ev("TCC1307", "S3", "Anglais 3 — Test", "devoir", 15.5, 20, 1, 30, "", "cc"),
    ev("TCC1307", "S3", "Techniques d'expression 3 — Oral", "expose", 14, 20, 1, 16, "", "cc"),
    // GMT 1304
    ev("GMT1304", "S3", "Devoir 1 — Cartographie thématique", "devoir", 13, 20, 1, 31, "", "cc"),
    ev("GMT1304", "S3", "TP — Photogrammétrie 2", "tp", 14.5, 20, 1, 20, "", "cc"),
    // S4 (quelques évaluations)
    ev("MTH1401", "S4", "Devoir 1 — Analyse 4", "devoir", 12.5, 20, 1, 24, "", "cc"),
    ev("INF1402", "S4", "TP — POO Python", "tp", 16, 20, 1, 21, "", "cc"),
    ev("GMT1403", "S4", "Devoir 1 — Analyse spatiale", "devoir", 14, 20, 1, 17, "", "cc"),
  ];

  const sessions: RevisionSession[] = [
    {
      id: "demo_ses_1",
      date: isoDaysAgo(3),
      subjectId: "MTH1301",
      chapter: "Lois de probabilité à discrètes",
      summary: "Loi discrète, espérance, variance, théorème de la limite centrale.",
      definitions: "Espérance E(X) = Σ x·P(X=x) ; Variance Var(X) = E(X²) − E(X)²",
      difficulties: "Conversion d'une variable aléatoire continue en discrète sur les exercices 3 et 5",
      exercisesToDo: "Exercices 3, 5 et 8 du polycopie",
      exercisesDone: 3,
      exercisesFailed: 2,
      durationMin: 135,
    },
    {
      id: "demo_ses_2",
      date: isoDaysAgo(5),
      subjectId: "GMT1305",
      chapter: "Traitement du signal — filtrage",
      summary: "Filtres passe-bas/passe-haut, transformée de Fourier discrète.",
      definitions: "TFD : X(k) = Σ x(n)·e^(-j2πkn/N)",
      difficulties: "",
      exercisesToDo: "Exercices 1 et 2 du chapitre filtrage",
      exercisesDone: 4,
      exercisesFailed: 0,
      durationMin: 135,
    },
    {
      id: "demo_ses_3",
      date: isoDaysAgo(1),
      subjectId: "INF1302",
      chapter: "Structures de données — listes et piles",
      summary: "Implémentation des piles, files, arbres binaires.",
      definitions: "Pile : LIFO ; File : FIFO",
      difficulties: "Complexité des opérations d'insertion en arbre binaire équilibré",
      exercisesToDo: "Exercices 4 à 7",
      exercisesDone: 2,
      exercisesFailed: 1,
      durationMin: 135,
    },
  ];

  return {
    ...base,
    isDemo: true,
    evaluations,
    sessions,
    planned: [
      { id: "demo_pl_1", subjectId: "GMT1306", name: "Examen final", coefficient: 2 },
      { id: "demo_pl_2", subjectId: "MTH1301", name: "Examen final", coefficient: 2 },
      { id: "demo_pl_3", subjectId: "INF1302", name: "Examen final", coefficient: 2 },
    ],
    tasks: [
      {
        id: "demo_task_1",
        label: "Refaire les exercices 3 et 5 sur les lois de probabilité",
        subjectId: "MTH1301",
        done: false,
        date: isoDaysAgo(0),
        createdAt: new Date().toISOString(),
      },
      {
        id: "demo_task_2",
        label: "Fiche de révision : géodésie, ellipsoïde de référ",
        subjectId: "GMT1306",
        done: false,
        date: isoDaysAgo(0),
        createdAt: new Date().toISOString(),
      },
    ],
    documents: [
      {
        id: "demo_doc_1",
        title: "Lois de probabilités discrètes — fiche",
        kind: "fiche",
        semester: "S3",
        subjectId: "MTH1301",
        chapter: "Lois de probabilités",
        content:
          "Loi uniforme : P(X=x)=1/n\nLoi de Bernoulli : E(X)=p, Var(X)=p(1-p)\nLoi binomale : E(X)=np, Var(X)=np(1-p)\nLoi de Poisson : P(X=k)=λ^k e^-λ / k!",
        createdAt: new Date().toISOString(),
      },
    ],
  };
}
