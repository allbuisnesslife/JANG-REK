import { useEffect, useMemo, useRef, useState } from "react";
import { useApp, useActions } from "../store/store";
import { formatMinutes, formatDate } from "../lib/format";
import { todayISO, weekRange, uid } from "../lib/id";
import { Badge, Card, EmptyState, Field, PageHeader, StatCard, ConfirmButton } from "../components/ui";
import type { RevisionSession } from "../types";

interface Phase {
  label: string;
  minutes: number;
  kind: "cours" | "pause" | "rappel" | "exercice" | "correction" | "libre";
}

const PHASES: Record<"cours" | "exercices", Phase[]> = {
  cours: [
    { label: "Concentration", minutes: 25, kind: "cours" },
    { label: "Pause", minutes: 5, kind: "pause" },
    { label: "Rappel actif & vérification", minutes: 15, kind: "rappel" },
  ],
  exercices: [
    { label: "Exercices de base", minutes: 30, kind: "exercice" },
    { label: "Exercices niveau examen", minutes: 40, kind: "exercice" },
    { label: "Correction & analyse des erreurs", minutes: 20, kind: "correction" },
  ],
};

const mmss = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function Timer() {
  const [plan, setPlan] = useState<"cours" | "exercices">("cours");
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [left, setLeft] = useState(PHASES.cours[0].minutes * 60);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const phase = PHASES[plan][phaseIdx];

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => {
      setLeft((v) => Math.max(0, v - 1));
      setElapsed((e) => e + 1);
    }, 1000);
    return () => window.clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (!running || left > 0) return;
    const arr = PHASES[plan];
    if (phaseIdx < arr.length - 1) {
      const next = phaseIdx + 1;
      setPhaseIdx(next);
      setLeft(arr[next].minutes * 60);
    } else {
      setRunning(false);
      setDone(true);
    }
  }, [left, running, phaseIdx, plan]);

  function switchPlan(next: "cours" | "exercices") {
    setPlan(next);
    setPhaseIdx(0);
    setLeft(PHASES[next][0].minutes * 60);
    setRunning(false);
    setDone(false);
    setElapsed(0);
  }

  function reset() {
    setPhaseIdx(0);
    setLeft(PHASES[plan][0].minutes * 60);
    setRunning(false);
    setElapsed(0);
    setDone(false);
  }

  const totalPlanned = PHASES[plan].reduce((s, p) => s + p.minutes, 0);

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Chronomètre Pomodoro</h2>
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {(["cours", "exercices"] as const).map((p) => (
            <button
              key={p}
              onClick={() => switchPlan(p)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                plan === p ? "bg-white text-brand-700 shadow dark:bg-slate-900 dark:text-brand-300" : "text-slate-600 dark:text-slate-300"
              }`}
            >
              {p === "cours" ? "45 min de cours" : "90 min d'exercices"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-1 py-2">
        <p className="text-xs uppercase tracking-widest text-slate-400">
          Phase {phaseIdx + 1}/{PHASES[plan].length} · {phase.label}
        </p>
        <p className="font-mono text-6xl font-bold tabular-nums text-slate-900 dark:text-white">
          {mmss(left)}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Temps écoulé : {formatMinutes(Math.floor(elapsed / 60))} / {totalPlanned} min prévues
        </p>
        {done && (
          <Badge tone="green">Séance terminée — pense à enregistrer ta séance ci-dessous</Badge>
        )}
      </div>

      <div className="mb-3 flex gap-1">
        {PHASES[plan].map((p, i) => (
          <div
            key={p.label}
            className={`h-2 flex-1 rounded-full ${
              i < phaseIdx ? "bg-emerald-500" : i === phaseIdx ? "bg-brand-500" : "bg-slate-200 dark:bg-slate-700"
            }`}
            title={`${p.label} — ${p.minutes} min`}
          />
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <button className="btn-primary" onClick={() => setRunning((r) => !r)}>
          {running ? "Pause" : "Démarrer"}
        </button>
        <button className="btn-ghost" onClick={reset}>
          Réinitialiser
        </button>
        <button
          className="btn-ghost"
          onClick={() => {
            const i = Math.min(phaseIdx + 1, PHASES[plan].length - 1);
            setPhaseIdx(i);
            setLeft(PHASES[plan][i].minutes * 60);
          }}
        >
          Phase suivante
        </button>
      </div>

      <ul className="mt-4 grid gap-1.5 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-3">
        {PHASES[plan].map((p, i) => (
          <li
            key={p.label}
            className={`rounded-lg px-2 py-1.5 ${
              i === phaseIdx ? "bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300" : ""
            }`}
          >
            <strong>{p.minutes} min</strong> — {p.label}
          </li>
        ))}
      </ul>
    </Card>
  );
}

const emptyForm = (date: string, subjectId: string) => ({
  date,
  subjectId,
  chapter: "",
  summary: "",
  definitions: "",
  difficulties: "",
  exercisesToDo: "",
  exercisesDone: "",
  exercisesFailed: "",
  durationMin: "",
  documentId: "",
});

export default function Revision() {
  const { data } = useApp();
  const actions = useActions();
  const [form, setForm] = useState(() => emptyForm(todayISO(), data.subjects[0]?.id ?? ""));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newTask, setNewTask] = useState("");
  const [taskDate, setTaskDate] = useState(todayISO());
  const [taskSubject, setTaskSubject] = useState("");
  const [showMove, setShowMove] = useState<string | null>(null);
  const [saved, setSaved] = useState<RevisionSession | null>(null);
  const scrollRef = useRef<HTMLUListElement>(null);

  const week = weekRange();
  const sessions = useMemo(
    () => [...data.sessions].sort((a, b) => b.date.localeCompare(a.date)),
    [data.sessions]
  );
  const todaySessions = sessions.filter((s) => s.date === form.date);
  const weekMinutes = data.sessions
    .filter((s) => s.date >= week.from && s.date <= week.to)
    .reduce((sum, s) => sum + (s.durationMin || 0), 0);

  const difficultSubjects = useMemo(() => {
    const map = new Map<string, string>();
    data.sessions
      .filter((s) => s.difficulties.trim() || (s.exercisesFailed || 0) > 0)
      .forEach((s) => {
        const cur = map.get(s.subjectId) ?? "";
        if (!cur) map.set(s.subjectId, s.chapter || s.difficulties);
      });
    return [...map.entries()];
  }, [data.sessions]);

  function submit() {
    const e: Record<string, string> = {};
    if (!form.chapter.trim()) e.chapter = "Indique le chapitre étudié (ou le sujet de révision).";
    if (!form.subjectId) e.subjectId = "Choisis une matière.";
    if (!form.date) e.date = "Date requise.";
    const dur = Number(form.durationMin || 0);
    if (form.durationMin && (Number.isNaN(dur) || dur < 0)) e.durationMin = "Temps invalide.";
    setErrors(e);
    if (Object.keys(e).length) return;

    actions.addSession({
      date: form.date,
      subjectId: form.subjectId,
      chapter: form.chapter.trim(),
      summary: form.summary.trim(),
      definitions: form.definitions.trim(),
      difficulties: form.difficulties.trim(),
      exercisesToDo: form.exercisesToDo.trim(),
      exercisesDone: Number(form.exercisesDone || 0),
      exercisesFailed: Number(form.exercisesFailed || 0),
      durationMin: dur,
      documentId: form.documentId || undefined,
    });
    setSaved({
      ...form,
      id: uid("ses"),
      exercisesDone: Number(form.exercisesDone || 0),
      exercisesFailed: Number(form.exercisesFailed || 0),
      durationMin: dur,
    } as unknown as RevisionSession);
    setForm(emptyForm(form.date, form.subjectId));
    setErrors({});
    setTimeout(() => setSaved(null), 5000);
  }

  const dayTasks = data.tasks.filter((t) => t.date === form.date);
  const pendingTasks = data.tasks.filter((t) => !t.done);

  return (
    <div>
      <PageHeader
        title="Réviser aujourd'hui"
        subtitle="2 h 15 par jour : 45 min de cours (Pomodoro) + 1 h 30 d'exercices et de correction."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Révision cette semaine" value={formatMinutes(weekMinutes)} hint={`Objectif ${formatMinutes(data.goals.weeklyMinutes)}`} tone={weekMinutes >= data.goals.weeklyMinutes ? "good" : "warn"} />
        <StatCard label="Séances totales" value={data.sessions.length} hint={`${todaySessions.length} aujourd'hui`} />
        <StatCard
          label="Exercices (cette semaine)"
          value={
            data.sessions
              .filter((s) => s.date >= week.from && s.date <= week.to)
              .reduce((sum, s) => sum + (s.exercisesDone || 0), 0)
          }
          hint={`En échec : ${
            data.sessions
              .filter((s) => s.date >= week.from && s.date <= week.to)
              .reduce((sum, s) => sum + (s.exercisesFailed || 0), 0)
          }`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Timer />

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
            Séance du jour — que fais-tu réellement ?
          </h2>
          <p className="mb-3 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            Les cours dépendent de la disponibilité des professeurs : choisis chaque jour la matière
            réellement étudiée.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date" error={errors.date}>
              <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Matière" error={errors.subjectId}>
              <select className="input" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                {data.subjects
                  .filter((s) => !s.disabled)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name.slice(0, 45)}
                    </option>
                  ))}
              </select>
            </Field>

            <div className="sm:col-span-2">
              <Field label="Chapitre étudié" error={errors.chapter}>
                <input className="input" value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} placeholder="Ex. Analyse spatiale — indices de proximité" />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="Résumé du cours">
                <textarea className="input" rows={2} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="Définitions et formules importantes">
                <textarea className="input" rows={2} value={form.definitions} onChange={(e) => setForm({ ...form, definitions: e.target.value })} />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="Difficultés rencontrées" hint="Sert à générer tes notions à réviser dans Ma progression">
                <textarea className="input" rows={2} value={form.difficulties} onChange={(e) => setForm({ ...form, difficulties: e.target.value })} />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="Exercices à réaliser">
                <textarea className="input" rows={2} value={form.exercisesToDo} onChange={(e) => setForm({ ...form, exercisesToDo: e.target.value })} />
              </Field>
            </div>

            <Field label="Exercices réussis">
              <input className="input" inputMode="numeric" value={form.exercisesDone} onChange={(e) => setForm({ ...form, exercisesDone: e.target.value })} />
            </Field>
            <Field label="Exercices échoués">
              <input className="input" inputMode="numeric" value={form.exercisesFailed} onChange={(e) => setForm({ ...form, exercisesFailed: e.target.value })} />
            </Field>
            <Field label="Temps réel de révision (min)" hint="Ex. 135 pour 2 h 15" error={errors.durationMin}>
              <input className="input" inputMode="numeric" value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })} placeholder="135" />
            </Field>
            <Field label="Document associé (facultatif)">
              <select
                className="input"
                value={form.documentId ?? ""}
                onChange={(e) => setForm({ ...form, documentId: e.target.value })}
              >
                <option value="">Aucun</option>
                {data.documents
                  .filter((d) => !form.subjectId || d.subjectId === form.subjectId)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
              </select>
            </Field>
            <div className="flex items-end">
              <button className="btn-primary w-full" onClick={submit}>
                Enregistrer la séance
              </button>
            </div>
          </div>

          {saved && (
            <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              Séance enregistrée pour le {formatDate(saved.date)}.
            </p>
          )}

          {difficultSubjects.length > 0 && (
            <div className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Aucun cours dispensé aujourd'hui ?
              </p>
              <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                Reprends un ancien chapitre difficile ou prépare une matière en retard :
              </p>
              <div className="flex flex-wrap gap-1.5">
                {difficultSubjects.slice(0, 5).map(([id, chapter]) => (
                  <button
                    key={id}
                    className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-left text-[11px] hover:bg-brand-100 dark:bg-slate-800 dark:hover:bg-brand-900/40"
                    onClick={() => {
                      setForm({ ...form, subjectId: id, chapter: `Reprise : ${chapter}` });
                      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    {data.subjects.find((s) => s.id === id)?.code} — {chapter}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
            Liste de tâches (cochables)
          </h2>
          <div className="flex flex-wrap gap-2">
            <input
              className="input flex-1"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Ex. Refaire les exercices 3 et 5"
            />
            <input type="date" className="input !w-auto" value={taskDate} onChange={(e) => setTaskDate(e.target.value)} />
            <select className="input !w-auto" value={taskSubject} onChange={(e) => setTaskSubject(e.target.value)}>
              <option value="">Matière (optionnelle)</option>
              {data.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code}
                </option>
              ))}
            </select>
            <button
              className="btn-primary"
              onClick={() => {
                if (!newTask.trim()) return;
                actions.addTask({ label: newTask.trim(), date: taskDate, subjectId: taskSubject || undefined });
                setNewTask("");
              }}
            >
              Ajouter
            </button>
          </div>

          <ul className="mt-3 space-y-2" ref={scrollRef}>
            {dayTasks.length === 0 && pendingTasks.length === 0 && (
              <li className="text-sm text-slate-400">Aucune tâche.</li>
            )}
            {dayTasks.map((t) => (
              <li key={t.id} className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={t.done}
                  onChange={() => actions.toggleTask(t.id)}
                  aria-label={`Marquer « ${t.label} » comme terminée`}
                />
                <span className={`flex-1 text-sm ${t.done ? "text-slate-400 line-through" : ""}`}>
                  {t.label}
                  {t.subjectId && (
                    <span className="ml-2 text-xs text-brand-600">
                      {data.subjects.find((s) => s.id === t.subjectId)?.code}
                    </span>
                  )}
                </span>
                <div className="flex gap-2 text-xs">
                  <button className="text-brand-600 hover:underline" onClick={() => setShowMove(showMove === t.id ? null : t.id)}>
                    Déplacer
                  </button>
                  <button className="text-rose-600 hover:underline" onClick={() => actions.removeTask(t.id)}>
                    ×
                  </button>
                </div>
                {showMove === t.id && (
                  <div className="w-full">
                    <input
                      type="date"
                      className="input"
                      defaultValue={t.date}
                      onChange={(e) => {
                        if (e.target.value) {
                          actions.moveTask(t.id, e.target.value);
                          setShowMove(null);
                        }
                      }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>

          {pendingTasks.filter((t) => t.date !== form.date).length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Tâches non terminées à déplacer
              </p>
              <ul className="space-y-2">
                {pendingTasks
                  .filter((t) => t.date !== form.date)
                  .map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                      <span className="min-w-0 truncate">
                        {t.label}
                        <span className="ml-2 text-xs text-slate-400">{formatDate(t.date)}</span>
                      </span>
                      <button
                        className="whitespace-nowrap text-xs font-medium text-brand-600 hover:underline"
                        onClick={() => actions.moveTask(t.id, form.date)}
                      >
                        → Séance du jour
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
            Séances enregistrées
          </h2>
          {sessions.length === 0 ? (
            <EmptyState
              title="Aucune séance"
              description="Enregistre ta séance quotidienne : chapitre, difficultés, exercices réussis/échoués et temps réel."
            />
          ) : (
            <ul className="space-y-3">
              {sessions.slice(0, 8).map((s) => (
                <li key={s.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {data.subjects.find((x) => x.id === s.subjectId)?.code} — {s.chapter}
                    </p>
                    <span className="text-xs text-slate-400">{formatDate(s.date)}</span>
                  </div>
                  {s.summary && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{s.summary}</p>}
                  {s.difficulties && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                      Difficultés : {s.difficulties}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <Badge tone="green">{s.exercisesDone} réussis</Badge>
                    <Badge tone={s.exercisesFailed ? "red" : "slate"}>{s.exercisesFailed} en échec</Badge>
                    <Badge tone="blue">{formatMinutes(s.durationMin)}</Badge>
                  </div>
                  <div className="mt-2 flex gap-3 text-xs">
                    <button
                      className="text-brand-600 hover:underline"
                      onClick={() =>
                        setForm({
                          date: s.date,
                          subjectId: s.subjectId,
                          chapter: s.chapter,
                          summary: s.summary,
                          definitions: s.definitions,
                          difficulties: s.difficulties,
                          exercisesToDo: s.exercisesToDo,
                          exercisesDone: String(s.exercisesDone),
                          exercisesFailed: String(s.exercisesFailed),
                          durationMin: String(s.durationMin),
                          documentId: s.documentId ?? "",
                        })
                      }
                    >
                      Recharger dans le formulaire
                    </button>
                    <ConfirmButton className="text-rose-600 hover:underline" onConfirm={() => actions.removeSession(s.id)}>
                      Supprimer
                    </ConfirmButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
