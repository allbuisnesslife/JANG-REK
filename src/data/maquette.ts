import type { SemesterId, Subject } from "../types";

export const SEMESTERS: { id: SemesterId; label: string }[] = [
  { id: "S3", label: "Semestre 3" },
  { id: "S4", label: "Semestre 4" },
];

/** Totaux officiels de la maquette L2 Géomatique (UIDT / UFR SI). */
export const OFFICIAL_TOTALS: Record<SemesterId, { coefficient: number; credits: number }> = {
  S3: { coefficient: 26, credits: 30 },
  S4: { coefficient: 23, credits: 30 },
};

type Seed = Omit<
  Subject,
  "ueConfirmed" | "coefficientConfirmed" | "creditsConfirmed" | "disabled"
>;

const SEEDS: Seed[] = [
  // ── Semestre 3 (7 UE) ──────────────────────────────────────────
  {
    id: "MTH1301",
    code: "MTH 1301",
    name: "Analyse 3, probabilités-statistiques",
    semester: "S3",
    ue: "MTH 1301",
    components: ["Probabilités-statistiques"],
    coefficient: 4,
    credits: 5,
  },
  {
    id: "INF1302",
    code: "INF 1302",
    name: "Algorithmique et programmation",
    semester: "S3",
    ue: "INF 1302",
    components: [],
    coefficient: 3,
    credits: 4,
  },
  {
    id: "GMT1303",
    code: "GMT 1303",
    name: "Introduction aux SIG",
    semester: "S3",
    ue: "GMT 1303",
    components: [],
    coefficient: 3,
    credits: 4,
  },
  {
    id: "GMT1304",
    code: "GMT 1304",
    name: "Cartographie thématique et photogrammétrie",
    semester: "S3",
    ue: "GMT 1304",
    components: [],
    coefficient: 4,
    credits: 5,
  },
  {
    id: "GMT1305",
    code: "GMT 1305",
    name: "Traitement du signal et télédétection",
    semester: "S3",
    ue: "GMT 1305",
    components: ["Physique de la télédétection", "Mécanique spatiale", "Traitement du signal"],
    coefficient: 4,
    credits: 5,
  },
  {
    id: "GMT1306",
    code: "GMT 1306",
    name: "Géodésie",
    semester: "S3",
    ue: "GMT 1306",
    components: [],
    coefficient: 3,
    credits: 4,
  },
  {
    id: "TCC1307",
    code: "TCC 1307",
    name: "Anglais 3 et techniques d'expression 3",
    semester: "S3",
    ue: "TCC 1307",
    components: [],
    coefficient: 5,
    credits: 3,
  },

  // ── Semestre 4 (6 UE) ──────────────────────────────────────────
  {
    id: "MTH1401",
    code: "MTH 1401",
    name: "Analyse 4 et équations différentielles",
    semester: "S4",
    ue: "MTH 1401",
    components: [],
    coefficient: 4,
    credits: 5,
  },
  {
    id: "INF1402",
    code: "INF 1402",
    name: "Programmation orientée objet",
    semester: "S4",
    ue: "INF 1402",
    components: [],
    coefficient: 3,
    credits: 5,
  },
  {
    id: "GMT1403",
    code: "GMT 1403",
    name: "Systèmes d'information géographique",
    semester: "S4",
    ue: "GMT 1403",
    components: [],
    coefficient: 4,
    credits: 5,
  },
  {
    id: "GMT1404",
    code: "GMT 1404",
    name: "Télédétection avancée",
    semester: "S4",
    ue: "GMT 1404",
    components: [],
    coefficient: 4,
    credits: 5,
  },
  {
    id: "GMT1405",
    code: "GMT 1405",
    name: "Bases de données et SIG",
    semester: "S4",
    ue: "GMT 1405",
    components: [],
    coefficient: 4,
    credits: 5,
  },
  {
    id: "TCC1406",
    code: "TCC 1406",
    name: "Anglais 4 et techniques d'expression 4",
    semester: "S4",
    ue: "TCC 1406",
    components: [],
    coefficient: 4,
    credits: 5,
  },
];

/** Construit la liste officielle des 13 UE (tous champs confirmés). */
export function buildSubjects(): Subject[] {
  return SEEDS.map((s) => ({
    ...s,
    ueConfirmed: true,
    coefficientConfirmed: true,
    creditsConfirmed: true,
    disabled: false,
  }));
}
