import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApp, useActions } from "../store/store";
import { useComputed } from "../store/computed";
import { formatNote, formatDate, formatMinutes, confidenceLabel } from "../lib/format";
import { Badge, Card, EmptyState, PageHeader, ProgressBar, StatCard } from "../components/ui";
import { todayISO } from "../lib/id";

export default function Dashboard() {
  const { data } = useApp();
  const actions = useActions();
  const c = useComputed();

  const goal = data.goals.general;
  const general = c.general.value;
  const hasNotes = data.evaluations.length > 0;

  const chartData = c.generalSeries.map((p) => ({
    name: `#${p.index}`,
    date: p.date,
    moyenne: p.average,
    label: p.label,
  }));

  const subjectBars = c.subjectSeries("all")
    .filter((s) => s.average !== null)
    .map((s) => ({ name: s.code, moyenne: s.average as number, objectif: goal }));

  const upcoming = [...data.planned]
    .filter((p) => !data.subjects.find((s) => s.id === p.subjectId)?.disabled)
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"))
    .slice(0, 5);

  const nextTasks = data.tasks.filter((t) => !t.done).slice(0, 4);

  return (
    <div>
      <PageHeader
        title={`Bonjour, ${data.profile.name.split(" ")[0]}`}
        subtitle="Ton tableau de bord L2 Géomatique — objectif annuel 15/20."
        actions={
          <Link to="/notes" className="btn-primary">
            + Saisir une note
          </Link>
        }
      />

      {!hasNotes && (
        <div className="mb-5">
          <EmptyState
            title="Aucune note enregistrée"
            description="Ajoute ta première évaluation pour afficher tes moyennes, tes courbes et tes alertes. Aucune moyenne officielle ne sera affichée tant que les données sont insuffisantes."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link to="/notes" className="btn-primary">
                  Ajouter une évaluation
                </Link>
                <button className="btn-ghost" onClick={() => actions.loadDemo()}>
                  Voir un exemple (démo)
                </button>
              </div>
            }
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Moyenne générale actuelle"
          value={general !== null ? `${formatNote(general)}/20` : "Données insuffisantes"}
          hint={confidenceLabel(c.general.confidence)}
          tone={
            general === null ? "neutral" : general >= goal ? "good" : general >= data.settings.lowAverageThreshold ? "warn" : "bad"
          }
        />
        <StatCard
          label="Objectif annuel"
          value={`${goal}/20`}
          hint={
            c.globalProjection.neededOverall !== null
              ? `À obtenir sur le restant : ${formatNote(c.globalProjection.neededOverall)}/20`
              : "Définis des évaluations prévues dans Mes objectifs"
          }
          tone="info"
        />
        <StatCard
          label="Semestre 3"
          value={c.s3.value !== null ? `${formatNote(c.s3.value)}/20` : "—"}
          hint={confidenceLabel(c.s3.confidence)}
          tone={c.s3.value !== null && c.s3.value >= goal ? "good" : "neutral"}
        />
        <StatCard
          label="Semestre 4"
          value={c.s4.value !== null ? `${formatNote(c.s4.value)}/20` : "—"}
          hint={confidenceLabel(c.s4.confidence)}
          tone={c.s4.value !== null && c.s4.value >= goal ? "good" : "neutral"}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Matières maîtrisées"
          value={c.mastered}
          hint={`≥ ${goal}/20`}
          tone="good"
        />
        <StatCard
          label="À surveiller"
          value={c.watch}
          hint={`Entre ${data.settings.lowAverageThreshold} et ${goal}/20`}
          tone="warn"
        />
        <StatCard
          label="Prioritaires"
          value={c.critical}
          hint={`< ${data.settings.lowAverageThreshold}/20`}
          tone="bad"
        />
        <StatCard
          label="Révision cette semaine"
          value={formatMinutes(c.weeklyMinutes)}
          hint={`Objectif ${formatMinutes(data.goals.weeklyMinutes)}`}
          tone="info"
        />
      </div>

      <div className="mt-4">
        <Card>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Progression vers l'objectif
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {general !== null
                  ? `Il te manque ${formatNote(Math.max(0, goal - general))} point(s) de moyenne.`
                  : "Progression calculée dès la première note."}
              </p>
            </div>
            <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">
              {general !== null ? `${Math.min(100, Math.round((general / goal) * 100))}%` : "0%"}
            </span>
          </div>
          <ProgressBar
            value={general ?? 0}
            max={goal}
            tone={(general ?? 0) >= goal ? "green" : (general ?? 0) >= data.settings.lowAverageThreshold ? "amber" : "red"}
          />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Moyenne générale au fil des évaluations
            </h2>
            <Link to="/progression" className="text-xs font-medium text-brand-600 hover:underline">
              Voir tout →
            </Link>
          </div>
          {chartData.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Pas encore de données.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1b5ef5" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#1b5ef5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip
                    formatter={(v: number) => [`${formatNote(v)}/20`, "Moyenne"]}
                    labelFormatter={(_l, p) =>
                      p?.[0]?.payload ? `${p[0].payload.label} — ${formatDate(p[0].payload.date)}` : ""
                    }
                  />
                  <ReferenceLine y={goal} stroke="#10b981" strokeDasharray="5 4" />
                  <Area type="monotone" dataKey="moyenne" stroke="#1b5ef5" strokeWidth={2.5} fill="url(#g)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
            3 actions prioritaires
          </h2>
          {c.priorities.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Aucune alerte active. Saisis au moins 4 évaluations par matière pour activer la
              détection des baisses.
            </p>
          ) : (
            <ol className="space-y-3">
              {c.priorities.map((a, i) => (
                <li key={a.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">{i + 1}</span>
                    <Badge tone={a.level === "rouge" ? "red" : a.level === "orange" ? "amber" : "green"}>
                      {a.level}
                    </Badge>
                  </div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {a.subjectName}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {a.actionPlan}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Moyennes par matière (vs objectif)
            </h2>
            <Link to="/moyennes" className="text-xs font-medium text-brand-600 hover:underline">
              Détail →
            </Link>
          </div>
          {subjectBars.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Pas encore de données.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectBars} margin={{ top: 5, right: 5, left: -22, bottom: 40 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-40} textAnchor="end" />
                  <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip formatter={(v: number) => [`${formatNote(v)}/20`, "Moyenne"]} />
                  <ReferenceLine y={goal} stroke="#10b981" strokeDasharray="5 4" />
                  <Bar dataKey="moyenne" radius={[6, 6, 0, 0]}>
                    {subjectBars.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          entry.moyenne >= goal
                            ? "#10b981"
                            : entry.moyenne >= data.settings.lowAverageThreshold
                              ? "#f59e0b"
                              : "#f43f5e"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <div className="grid gap-4">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Prochains examens et devoirs
              </h2>
              <Link to="/objectifs" className="text-xs font-medium text-brand-600 hover:underline">
                Gérer →
              </Link>
            </div>
            {upcoming.length === 0 && nextTasks.length === 0 ? (
              <p className="text-sm text-slate-400">
                Aucune évaluation prévue ni tâche en attente.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {upcoming.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                    <span className="truncate">
                      {data.subjects.find((s) => s.id === p.subjectId)?.code} — {p.name}
                    </span>
                    <span className="whitespace-nowrap text-xs text-slate-500">
                      {p.date ? formatDate(p.date) : "date à définir"} · coef {p.coefficient}
                    </span>
                  </li>
                ))}
                {nextTasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                    <span className="truncate">{t.label}</span>
                    <span className="whitespace-nowrap text-xs text-slate-500">{formatDate(t.date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Dernières notes enregistrées
              </h2>
              <Link to="/notes" className="text-xs font-medium text-brand-600 hover:underline">
                Toutes →
              </Link>
            </div>
            {c.latest.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune note enregistrée.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {c.latest.map((e) => {
                  const s = data.subjects.find((x) => x.id === e.subjectId);
                  return (
                    <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800 dark:text-slate-200">
                          {s?.code} — {e.name}
                        </p>
                        <p className="text-xs text-slate-400">{formatDate(e.date)}</p>
                      </div>
                      <span className="whitespace-nowrap font-semibold text-brand-600 dark:text-brand-400">
                        {e.score}/{e.maxScore}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-slate-400">
        Données enregistrées automatiquement le {formatDate(todayISO())} · sauvegarde locale
        persistante
      </p>
    </div>
  );
}
