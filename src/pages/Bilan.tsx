import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../store/store";
import { useComputed } from "../store/computed";
import { buildWeeklyReport } from "../lib/goals";
import { formatDate, formatMinutes, formatNote } from "../lib/format";
import { Badge, Card, EmptyState, PageHeader, ProgressBar, StatCard } from "../components/ui";

function weekOf(offset: number): { from: string; to: string; label: string } {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    from: monday.toISOString().slice(0, 10),
    to: sunday.toISOString().slice(0, 10),
    label: `${monday.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} → ${sunday.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`,
  };
}

export default function Bilan() {
  const { data } = useApp();
  const computed = useComputed();
  const [offset, setOffset] = useState(0);
  const w = useMemo(() => weekOf(offset), [offset]);

  const report = useMemo(
    () => buildWeeklyReport(w.from, w.to, data.subjects, data.evaluations, data.sessions, computed.alerts),
    [w, data.subjects, data.evaluations, data.sessions, computed.alerts]
  );

  const goal = data.goals.general;
  const timeOk = report.totalMinutes >= data.goals.weeklyMinutes;
  const totalEx = report.exercisesSucceeded + report.exercisesFailed;
  const rate = totalEx > 0 ? Math.round((report.exercisesSucceeded / totalEx) * 100) : null;

  return (
    <div>
      <PageHeader
        title="Mon bilan hebdomadaire"
        subtitle="Généré chaque dimanche à partir de tes données réelles — aucune valeur inventée."
        actions={
          <div className="flex items-center gap-2">
            <button className="btn-ghost" onClick={() => setOffset((o) => o - 1)} aria-label="Semaine précédente">
              ←
            </button>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{w.label}</span>
            <button
              className="btn-ghost"
              onClick={() => setOffset((o) => Math.min(0, o + 1))}
              disabled={offset >= 0}
              aria-label="Semaine suivante"
            >
              →
            </button>
            {offset !== 0 && (
              <button className="btn-ghost" onClick={() => setOffset(0)}>
                Cette semaine
              </button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Temps de travail" value={formatMinutes(report.totalMinutes)} hint={`Objectif ${formatMinutes(data.goals.weeklyMinutes)}`} tone={timeOk ? "good" : "warn"} />
        <StatCard label="Séances de révision" value={report.sessionsCount} hint={`${report.subjectsStudied} matière(s) étudiée(s)`} />
        <StatCard
          label="Exercices réussis"
          value={report.exercisesSucceeded}
          hint={
            rate !== null
              ? `${rate}% de réussite (objectif ${data.goals.exerciseSuccessRate}%) · ${report.exercisesFailed} en échec`
              : "Aucun exercice enregistré"
          }
          tone={rate !== null && rate >= data.goals.exerciseSuccessRate ? "good" : "neutral"}
        />
        <StatCard
          label="Moyenne générale"
          value={computed.general.value !== null ? `${formatNote(computed.general.value)}/20` : "—"}
          hint={`Objectif ${goal}/20`}
          tone={computed.general.value !== null && computed.general.value >= goal ? "good" : "warn"}
        />
      </div>

      <div className="mt-4">
        <Card>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">Temps de révision de la semaine</span>
            <span className="text-xs text-slate-500">{Math.round((report.totalMinutes / Math.max(1, data.goals.weeklyMinutes)) * 100)}%</span>
          </div>
          <ProgressBar value={report.totalMinutes} max={data.goals.weeklyMinutes} tone={timeOk ? "green" : "amber"} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
            Matières en progression
          </h2>
          {report.progress.length === 0 ? (
            <p className="text-sm text-slate-400">
              Aucune progression mesurable cette semaine (il faut au moins 4 évaluations réparties en
              deux périodes).
            </p>
          ) : (
            <ul className="space-y-2">
              {report.progress.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-900/25">
                  <span className="truncate">{p.label}</span>
                  <Badge tone="green">+{formatNote(p.delta)} pt</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Matières en baisse</h2>
          {report.declining.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune baisse détectée.</p>
          ) : (
            <ul className="space-y-2">
              {report.declining.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm dark:bg-rose-900/25">
                  <span className="truncate">{p.label}</span>
                  <Badge tone="red">{formatNote(p.delta)} pt</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
            Chapitres non maîtrisés
          </h2>
          {report.weakChapters.length === 0 ? (
            <p className="text-sm text-slate-400">
              Aucune difficulté ou échec d'exercice enregistré cette semaine.
            </p>
          ) : (
            <ul className="space-y-2">
              {report.weakChapters.map((c, i) => (
                <li key={i} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                  <p className="font-medium text-slate-800 dark:text-slate-200">
                    {c.subject} — {c.chapter}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{c.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
            Trois priorités de la semaine suivante
          </h2>
          {report.priorities.length === 0 ? (
            <EmptyState
              title="Rien à signaler"
              description="Aucune alerte ni difficulté enregistrée. Continue de saisir tes notes et tes séances pour obtenir un bilan détaillé."
            />
          ) : (
            <ol className="space-y-3">
              {report.priorities.map((p, i) => (
                <li key={i} className="rounded-xl border border-brand-100 bg-brand-50/60 p-3 dark:border-brand-900/60 dark:bg-brand-950/40">
                  <p className="text-xs font-bold text-brand-600 dark:text-brand-400">Priorité {i + 1}</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{p.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{p.detail}</p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Détail de la semaine</h2>
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <p className="text-xs text-slate-400">Période</p>
            <p className="font-medium">
              {formatDate(w.from)} → {formatDate(w.to)}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <p className="text-xs text-slate-400">Exercices</p>
            <p className="font-medium">
              {report.exercisesSucceeded} réussis / {report.exercisesFailed} échoués
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <p className="text-xs text-slate-400">Rappel</p>
            <p className="font-medium">
              Bilan généré automatiquement — consulte aussi{" "}
              <Link to="/progression" className="text-brand-600 hover:underline">
                Ma progression
              </Link>
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
