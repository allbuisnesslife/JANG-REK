import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type {
  AppData,
  CourseDoc,
  Evaluation,
  PlannedEvaluation,
  RevisionSession,
  Settings,
  Subject,
  SubjectRule,
  WeeklyTask,
} from "../types";
import { getAdapter } from "./storage";
import { createDemoState, createInitialState, DATA_VERSION } from "./initialState";
import { uid } from "../lib/id";

/* ------------------------------------------------------------------ */
/* État global + persistance                                           */
/* ------------------------------------------------------------------ */

/**
 * Applique la maquette officielle aux matières non confirmées de l'utilisateur
 * et ajoute les éventuelles nouvelles UE absentes de l'état stocké.
 * Les valeurs déjà confirmées manuellement par l'utilisateur sont conservées.
 */
export function migrateSubjects(stored: Subject[], official: Subject[]): Subject[] {
  const byId = new Map(stored.map((s) => [s.id, s]));
  return official.map((off) => {
    const s = byId.get(off.id);
    if (!s) return off;
    if (s.coefficientConfirmed && s.creditsConfirmed && s.ueConfirmed) return s;
    return {
      ...s,
      ue: s.ueConfirmed ? s.ue : off.ue,
      ueConfirmed: s.ueConfirmed || off.ueConfirmed,
      coefficient: s.coefficientConfirmed ? s.coefficient : off.coefficient,
      coefficientConfirmed: s.coefficientConfirmed || off.coefficientConfirmed,
      credits: s.creditsConfirmed ? s.credits : off.credits,
      creditsConfirmed: s.creditsConfirmed || off.creditsConfirmed,
    };
  });
}

function bootstrap(): AppData {
  const stored = getAdapter().load();
  const fresh = createInitialState(false);
  if (!stored) return createDemoState();
  // Fusion profonde : garantit qu'un nouvel ajout de paramètre garde sa valeur par défaut.
  return {
    ...fresh,
    ...stored,
    subjects: migrateSubjects(
      Array.isArray(stored.subjects) ? stored.subjects : fresh.subjects,
      fresh.subjects
    ),
    profile: { ...fresh.profile, ...(stored.profile ?? {}) },
    goals: { ...fresh.goals, ...(stored.goals ?? {}) },
    settings: {
      ...fresh.settings,
      ...(stored.settings ?? {}),
      rules: ((stored.settings?.rules ?? []) as SubjectRule[]).map((r) => ({
        ...r,
        examOnly: r.examOnly ?? false,
      })),
    },
    version: DATA_VERSION,
  };
}

let state: AppData = bootstrap();
const listeners = new Set<() => void>();
let saveFailed = false;

function persist() {
  const ok = getAdapter().save(state);
  if (ok) saveFailed = false;
  else if (!saveFailed) {
    saveFailed = true;
    pushToast("Sauvegarde impossible (stockage plein). Exporte tes données en JSON.", "error");
  }
}

function commit(next: AppData) {
  state = next;
  persist();
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const getState = () => state;

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, getState, getState);
}

/** Supprime les données de démonstration avant la première saisie réelle. */
function purgeDemo(d: AppData): AppData {
  if (!d.isDemo) return d;
  const clean = createInitialState(false);
  pushToast("Données de démonstration supprimées. Tu saisis maintenant tes vraies notes.", "info");
  return clean;
}

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */

export interface Toast {
  id: string;
  message: string;
  tone: "success" | "error" | "info";
}
let toasts: Toast[] = [];
const toastListeners = new Set<() => void>();

export function pushToast(message: string, tone: Toast["tone"] = "success") {
  const t: Toast = { id: uid("toast"), message, tone };
  toasts = [...toasts, t];
  toastListeners.forEach((l) => l());
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    toastListeners.forEach((l) => l());
  }, 4200);
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      toastListeners.add(l);
      return () => toastListeners.delete(l);
    },
    () => toasts,
    () => toasts
  );
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  toastListeners.forEach((l) => l());
}

/* ------------------------------------------------------------------ */
/* Actions                                                            */
/* ------------------------------------------------------------------ */

const patch = (fn: (d: AppData) => AppData) => commit(fn(state));

export const actions = {
  /* ---- Notes ---- */
  addEvaluation(input: Omit<Evaluation, "id">) {
    let base = purgeDemo(state);
    const ev: Evaluation = { ...input, id: uid("ev") };
    commit({ ...base, evaluations: [...base.evaluations, ev] });
    pushToast("Évaluation enregistrée.");
  },
  updateEvaluation(id: string, changes: Partial<Evaluation>) {
    commit({
      ...state,
      evaluations: state.evaluations.map((e) => (e.id === id ? { ...e, ...changes } : e)),
    });
    pushToast("Évaluation mise à jour.");
  },
  removeEvaluation(id: string) {
    commit({ ...state, evaluations: state.evaluations.filter((e) => e.id !== id) });
    pushToast("Évaluation supprimée.", "info");
  },

  /* ---- Évaluations prévues ---- */
  addPlanned(input: Omit<PlannedEvaluation, "id">) {
    let base = purgeDemo(state);
    commit({ ...base, planned: [...base.planned, { ...input, id: uid("pl") }] });
  },
  removePlanned(id: string) {
    commit({ ...state, planned: state.planned.filter((p) => p.id !== id) });
  },
  planFinalExamForAll(weight: number) {
    let base = purgeDemo(state);
    const missing = base.subjects.filter(
      (s) =>
        !s.disabled &&
        !base.planned.some((p) => p.subjectId === s.id) &&
        base.evaluations.some((e) => e.subjectId === s.id)
    );
    commit({
      ...base,
      planned: [
        ...base.planned,
        ...missing.map((s) => ({
          id: uid("pl"),
          subjectId: s.id,
          name: "Examen final",
          coefficient: weight,
        })),
      ],
    });
    pushToast(`${missing.length} évaluation(s) prévue(s) ajoutée(s).`);
  },

  /* ---- Maquette / paramètres ---- */
  updateSubject(id: string, changes: Partial<Subject>) {
    commit({
      ...state,
      subjects: state.subjects.map((s) => (s.id === id ? { ...s, ...changes } : s)),
    });
  },
  setRule(rule: SubjectRule) {
    const exists = state.settings.rules.some((r) => r.subjectId === rule.subjectId);
    const rules = exists
      ? state.settings.rules.map((r) => (r.subjectId === rule.subjectId ? rule : r))
      : [...state.settings.rules, rule];
    commit({ ...state, settings: { ...state.settings, rules } });
  },
  updateSettings(changes: Partial<Settings>) {
    commit({ ...state, settings: { ...state.settings, ...changes } });
  },
  setTheme(theme: Settings["theme"]) {
    commit({ ...state, settings: { ...state.settings, theme } });
  },

  /* ---- Séances de révision ---- */
  addSession(input: Omit<RevisionSession, "id">) {
    let base = purgeDemo(state);
    commit({ ...base, sessions: [...base.sessions, { ...input, id: uid("ses") }] });
    pushToast("Séance de révision enregistrée.");
  },
  updateSession(id: string, changes: Partial<RevisionSession>) {
    commit({
      ...state,
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, ...changes } : s)),
    });
  },
  removeSession(id: string) {
    commit({ ...state, sessions: state.sessions.filter((s) => s.id !== id) });
  },

  /* ---- Documents ---- */
  addDocument(input: Omit<CourseDoc, "id" | "createdAt">) {
    let base = purgeDemo(state);
    const doc: CourseDoc = { ...input, id: uid("doc"), createdAt: new Date().toISOString() };
    commit({ ...base, documents: [...base.documents, doc] });
    pushToast("Document enregistré.");
  },
  updateDocument(id: string, changes: Partial<CourseDoc>) {
    commit({
      ...state,
      documents: state.documents.map((d) => (d.id === id ? { ...d, ...changes } : d)),
    });
  },
  removeDocument(id: string) {
    commit({ ...state, documents: state.documents.filter((d) => d.id !== id) });
  },

  /* ---- Tâches ---- */
  addTask(input: { label: string; subjectId?: string; date: string }) {
    let base = purgeDemo(state);
    const task: WeeklyTask = {
      id: uid("task"),
      label: input.label,
      subjectId: input.subjectId,
      date: input.date,
      done: false,
      createdAt: new Date().toISOString(),
    };
    commit({ ...base, tasks: [...base.tasks, task] });
  },
  toggleTask(id: string) {
    commit({
      ...state,
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    });
  },
  moveTask(id: string, date: string) {
    commit({ ...state, tasks: state.tasks.map((t) => (t.id === id ? { ...t, date } : t)) });
    pushToast("Tâche déplacée.", "info");
  },
  removeTask(id: string) {
    commit({ ...state, tasks: state.tasks.filter((t) => t.id !== id) });
  },

  /* ---- Objectifs / profil ---- */
  setGoals(goals: AppData["goals"]) {
    commit({ ...state, goals });
  },
  setObjective(objective: number) {
    commit({ ...state, profile: { ...state.profile, objective }, goals: { ...state.goals, general: objective } });
  },
  setProfile(changes: Partial<AppData["profile"]>) {
    commit({ ...state, profile: { ...state.profile, ...changes } });
  },

  /* ---- Démonstration / données ---- */
  loadDemo() {
    commit(createDemoState());
    pushToast("Données de démonstration chargées.", "info");
  },
  clearDemo() {
    commit(createInitialState(false));
    pushToast("Données de démonstration supprimées.", "info");
  },
  resetAll() {
    commit(createInitialState(false));
    pushToast("Toutes les données ont été supprimées.", "info");
  },
  exportJson() {
    return JSON.stringify(state, null, 2);
  },
  importJson(raw: string): boolean {
    try {
      const parsed = JSON.parse(raw) as AppData;
      if (!parsed || !Array.isArray(parsed.subjects) || !Array.isArray(parsed.evaluations)) {
        pushToast("Fichier invalide : structure non reconnue.", "error");
        return false;
      }
      commit({ ...createInitialState(false), ...parsed, version: DATA_VERSION });
      pushToast("Sauvegarde importée avec succès.");
      return true;
    } catch {
      pushToast("Fichier JSON invalide.", "error");
      return false;
    }
  },
};

/* ------------------------------------------------------------------ */
/* Contexte React                                                      */
/* ------------------------------------------------------------------ */

interface Ctx {
  data: AppData;
  actions: typeof actions;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const data = useAppData();

  useEffect(() => {
    const root = document.documentElement;
    if (data.settings.theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [data.settings.theme]);

  const value = useMemo(() => ({ data, actions }), [data]);
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp doit être utilisé dans AppProvider");
  return ctx;
}

export function useActions() {
  return useApp().actions;
}

/** Réinitialise l'état (utile pour les tests). */
export function __resetState(next?: AppData) {
  state = next ?? createInitialState(false);
  persist();
  listeners.forEach((l) => l());
}
