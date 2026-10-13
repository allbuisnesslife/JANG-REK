export type SemesterId = "S3" | "S4";

export type EvalType =
  | "devoir"
  | "controle_continu"
  | "tp"
  | "expose"
  | "examen";

export const EVAL_TYPES: { id: EvalType; label: string }[] = [
  { id: "devoir", label: "Devoir" },
  { id: "controle_continu", label: "Contrôle continu" },
  { id: "tp", label: "TP" },
  { id: "expose", label: "Exposé" },
  { id: "examen", label: "Examen" },
];

/** Matière de la maquette. Les coefficients/credits ne sont "confirmés" que si la maquette officielle les valide. */
export interface Subject {
  id: string;
  code: string;
  name: string;
  semester: SemesterId;
  /** UE de rattachement. Non confirmé tant que la maquette officielle n'a pas été saisie. */
  ue: string;
  ueConfirmed: boolean;
  /** Sous-matières / parties du programme. */
  components: string[];
  /** Coefficient utilisé pour agréger la matière dans l'UE/le semestre. */
  coefficient: number;
  coefficientConfirmed: boolean;
  /** ECTS — renseignés uniquement si confirmés par la maquette officielle. */
  credits: number | null;
  creditsConfirmed: boolean;
  /** Désactivée (module non suivi ce semestre) */
  disabled: boolean;
}

export interface Evaluation {
  id: string;
  subjectId: string;
  semester: SemesterId;
  name: string;
  type: EvalType;
  /** Note obtenue telle que saisie. */
  score: number;
  /** Note maximale (20 par défaut). */
  maxScore: number;
  coefficient: number;
  /** ISO yyyy-mm-dd */
  date: string;
  comment?: string;
  /** Règle officielle de calcul (ex: CC 40% / Examen 60%) si renseignée. */
  ruleGroup?: "cc" | "examen";
  /** Élément constitutif (EC) de l'UE — ex. « Physique de la télédétection » dans GMT 1305. */
  component?: string;
}

/** Évaluation annoncée mais pas encore reçue : sert au calcul des notes nécessaires. */
export interface PlannedEvaluation {
  id: string;
  subjectId: string;
  name: string;
  coefficient: number;
  /** ISO yyyy-mm-dd si connue */
  date?: string;
}

export interface RevisionSession {
  id: string;
  date: string;
  subjectId: string;
  chapter: string;
  summary: string;
  definitions: string;
  difficulties: string;
  exercisesToDo: string;
  exercisesDone: number;
  exercisesFailed: number;
  durationMin: number;
  /** Lien vers un document de "Mes cours" */
  documentId?: string;
}

export type DocKind = "cours" | "fiche" | "formule" | "definition" | "pdf";

export interface CourseDoc {
  id: string;
  title: string;
  kind: DocKind;
  semester: SemesterId | "";
  subjectId: string;
  chapter: string;
  content: string;
  /** Contenu base64 d'un PDF (stockage local, taille limitée). */
  pdfData?: string;
  pdfName?: string;
  createdAt: string;
}

export interface WeeklyTask {
  id: string;
  label: string;
  subjectId?: string;
  done: boolean;
  /** Date cible (ISO) — permet de déplacer une tâche à une autre séance */
  date: string;
  createdAt: string;
}

export interface Goals {
  general: number;
  bySemester: Record<SemesterId, number>;
  bySubject: Record<string, number>;
  weeklyMinutes: number;
  exerciseSuccessRate: number;
}

export type Confidence = "insufficient" | "provisional" | "confirmed";

export interface AverageResult {
  value: number | null;
  confidence: Confidence;
  /** Nombre d'évaluations prises en compte */
  count: number;
  /** Somme des coefficients utilisés */
  weight: number;
  message?: string;
}

export interface Settings {
  theme: "light" | "dark";
  /** Seuils d'alerte configurables */
  dropAlertPoints: number;
  dropModeratePoints: number;
  lowAverageThreshold: number;
  minEvalsForAlert: number;
  /** Règles par matière : sépare CC et examen si renseignées */
  rules: SubjectRule[];
  /** N'afficher aucune moyenne tant que le nombre minimum d'évaluations n'est pas atteint */
  minEvalsForAverage: number;
}

export interface SubjectRule {
  subjectId: string;
  enabled: boolean;
  ccWeight: number;
  examWeight: number;
  /** true = pas de contrôle continu : la moyenne = note d'examen seule. */
  examOnly: boolean;
}

export interface Alert {
  id: string;
  level: "vert" | "orange" | "rouge";
  subjectId: string;
  subjectName: string;
  kind: "baisse" | "faible" | "stable" | "progresse";
  title: string;
  previousAverage: number | null;
  currentAverage: number | null;
  delta: number | null;
  responsible: { name: string; date: string; score: number; maxScore: number }[];
  notions: string[];
  actionPlan: string;
  generatedAt: string;
}

export interface AppData {
  version: number;
  isDemo: boolean;
  profile: { name: string; promo: string; objective: number };
  subjects: Subject[];
  evaluations: Evaluation[];
  planned: PlannedEvaluation[];
  sessions: RevisionSession[];
  documents: CourseDoc[];
  tasks: WeeklyTask[];
  goals: Goals;
  settings: Settings;
  createdAt: string;
}
