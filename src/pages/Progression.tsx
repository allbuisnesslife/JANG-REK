import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApp } from "../store/store";
import { useComputed } from "../store/computed";
import { cumulativeSeries, subjectStats, round2 } from "../lib/calc";
import { formatNote, formatDate } from "../lib/format";
import { Badge, Card, EmptyState, PageHeader } from "../components/ui";
import type { SemesterId } from "../types";
import { SEMESTERS } from "../data/maquette";

const COLORS = [
  "#1b5ef5",
  "#f59e0b",
  "#10b981",
  "#f43f5e",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#64748b",
  "#14b8a6",
  "#e11d48",
];

export default function Progression() {
  const { data } = useApp();
  const c = useComputed();
  const [sem, setSem] = useState<"all" | SemesterId>("all");
  const goal = data.goals.general;

  const generalSeries = useMemo(
    () => c.generalSeries.map((p) => ({ name: `#${p.index}`, moyenne: p.average, label: p.label, date: p.date })),
    [c.generalSeries]
  );

  const subjectLines = useMemo(() => {
    const ids = data.subjects
      .filter((s) => !s.disabled && (sem === "all" || s.semester === sem))
      .map((s) => s.id);
    const series = ids.map((id) => ({ id, points: cumulativeSeries(data.evaluations.filter((e) => e.subjectId === id)) }));
    const maxLen = Math.max(0, ...series.map((s) => s.points.length));
    const rows = Array.from({ length: maxLen }, (_, i) => {
      const row: Record<string, number | string> = { name: `#${i + 1}` };
      series.forEach((s) => {
        if (s.points[i]) row[s.id] = s.points[i].average;
      });
      return row;
    });
    const legend = series
      .map((s) => ({
        id: s.id,
        label: data.subjects.find((x) => x.id === s.id)?.code ?? s.id,
        color: COLORS[ids.indexOf(s.id) % COLORS.length],
        hasData: s.points.length > 0,
      }))
      .filter((l) => l.hasData);
    return { rows, legend };
  }, [data.subjects, data.evaluations, sem]);

  const comparison = useMemo(() => {
    return data.subjects
      .filter((s) => !s.disabled && (sem === "all" || s.semester === sem))
      .map((s, i) => {
        const st = subjectStats(
          s,
          data.evaluations,
          data.settings.rules.find((r) => r.subjectId === s.id),
          data.settings.minEvalsForAverage
        );
        return {
          name: s.code,
          moyenne: st.average.value,
          objectif: data.goals.bySubject[s.id] ?? goal,
          color: COLORS[i % COLORS.length],
        };
      })
      .filter((x) => x.moyenne !== null);
  }, [data, sem, goal]);

  const semesters = SEMESTERS.map((s) => ({
    name: s.label,
    moyenne: s.id === "S3" ? c.s3.value : c.s4.value,
    objectif: data.goals.bySemester[s.id],
  })).filter((x) => x.moyenne !== null);

  const alerts = c.alerts;

  return (
    <div>
      <PageHeader
        title="Ma progression"
        subtitle="Courbes actualisées à chaque note saisie, comparaison aux objectifs et alertes de baisse transparentes."
        actions={
          <div className="flex gap-1 rounded-xl bg-white p-1 dark:bg-slate-900">
            {(["all", "S3", "S4"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setSem(v)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  sem === v ? "bg-brand-600 text-white" : "text-slate-600 dark:text-slate-300"
                }`}
              >
                {v === "all" ? "Toutes" : v}
              </button>
            ))}
          </div>
        }
      />

      {data.evaluations.length === 0 ? (
        <EmptyState
          title="Pas encore de courbe à afficher"
          description="Les graphiques apparaîtront dès ta première évaluation enregistrée dans Mes notes."
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="lg:col-span-2">
              <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                1 · Évolution de la moyenne générale au fil des évaluations
              </h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={generalSeries} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <Tooltip
                      formatter={(v: number) => [`${formatNote(v)}/20`, "Moyenne"]}
                      labelFormatter={(_l, p) =>
                        p?.[0]?.payload ? `${p[0].payload.label} — ${formatDate(p[0].payload.date)}` : ""
                      }
                    />
                    <ReferenceLine y={goal} stroke="#10b981" strokeDasharray="5 4" />
                    <Line type="monotone" dataKey="moyenne" stroke="#1b5ef5" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Ligne verte pointillée : objectif de {goal}/20.
              </p>
            </Card>

            <Card>
              <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                2 · Courbe distincte pour chaque matière
              </h2>
              {subjectLines.rows.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Aucune donnée.</p>
              ) : (
                <>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={subjectLines.rows} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                        <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                        <Tooltip formatter={(v: number) => [`${formatNote(v)}/20`, "Moyenne"]} />
                        <Legend />
                        {subjectLines.legend.map((l) => (
                          <Line
                            key={l.id}
                            type="monotone"
                            dataKey={l.id}
                            name={l.label}
                            stroke={l.color}
                            strokeWidth={2}
                            dot={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
                    {subjectLines.legend.map((l) => (
                      <span key={l.id} className="inline-flex items-center gap-1">
                        <span className="h-2 w-4 rounded" style={{ background: l.color }} />
                        {l.label}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </Card>

            <Card>
              <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                3 · Comparaison des moyennes par matière
              </h2>
              {comparison.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Aucune donnée.</p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparison} margin={{ top: 5, right: 5, left: -22, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-40} textAnchor="end" />
                      <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                      <Tooltip formatter={(v: number) => [`${formatNote(v)}/20`, "Moyenne"]} />
                      <Bar dataKey="moyenne" radius={[6, 6, 0, 0]}>
                        {comparison.map((entry, i) => {
                          const v = entry.moyenne ?? 0;
                          return (
                            <Cell
                              key={i}
                              fill={
                                v >= goal
                                  ? "#10b981"
                                  : v >= data.settings.lowAverageThreshold
                                    ? "#f59e0b"
                                    : "#f43f5e"
                              }
                            />
                          );
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card>
              <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                4 · Mes moyennes vs objectifs fixés
              </h2>
              {comparison.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Aucune donnée.</p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparison} margin={{ top: 5, right: 5, left: -22, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-40} textAnchor="end" />
                      <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                      <Tooltip formatter={(v: number, n: string) => [`${formatNote(v)}/20`, n]} />
                      <Legend />
                      <Bar dataKey="moyenne" name="Moyenne" fill="#1b5ef5" radius={[5, 5, 0, 0]} />
                      <Bar dataKey="objectif" name="Objectif" fill="#10b981" radius={[5, 5, 0, 0]} opacity={0.7} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card>
              <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                5 · Résultats par semestre
              </h2>
              {semesters.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Aucune donnée.</p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={semesters} margin={{ top: 5, right: 5, left: -22, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                      <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                      <Tooltip formatter={(v: number, n: string) => [`${formatNote(v)}/20`, n]} />
                      <Legend />
                      <Bar dataKey="moyenne" name="Moyenne" fill="#1b5ef5" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="objectif" name="Objectif" fill="#10b981" radius={[6, 6, 0, 0]} opacity={0.7} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          {/* Système d'alertes */}
          <div className="mt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Alertes et détection des baisses
              </h2>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <Badge tone="green">Vert : stable / progression</Badge>
                <Badge tone="amber">
                  Orange : baisse ≥ {data.settings.dropModeratePoints} pt ou moyenne &lt;{" "}
                  {data.settings.lowAverageThreshold}/20
                </Badge>
                <Badge tone="red">
                  Rouge : baisse ≥ {data.settings.dropAlertPoints} pts ou difficulté persistante
                </Badge>
              </div>
            </div>

            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Une alerte n'est déclenchée qu'à partir de 4 évaluations réparties sur deux périodes
              comparables : aucune décision à partir d'une note isolée. Seuils modifiables dans
              Paramètres.
            </p>

            {alerts.length === 0 ? (
              <EmptyState
                title="Aucune alerte"
                description="Il faut au moins 4 évaluations dans une matière pour comparer deux périodes."
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {alerts.map((a) => (
                  <Card
                    key={a.id}
                    className={
                      a.level === "rouge"
                        ? "border-rose-300 dark:border-rose-900"
                        : a.level === "orange"
                          ? "border-amber-300 dark:border-amber-900"
                          : "border-emerald-200 dark:border-emerald-900"
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Badge tone={a.level === "rouge" ? "red" : a.level === "orange" ? "amber" : "green"}>
                          Niveau {a.level}
                        </Badge>
                        <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                          {a.subjectName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{a.title}</p>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <p>
                          Avant :{" "}
                          <strong className="text-sm text-slate-800 dark:text-slate-200">
                            {a.previousAverage !== null ? formatNote(a.previousAverage) : "—"}
                          </strong>
                        </p>
                        <p>
                          Après :{" "}
                          <strong className="text-sm text-slate-800 dark:text-slate-200">
                            {a.currentAverage !== null ? formatNote(a.currentAverage) : "—"}
                          </strong>
                        </p>
                        {a.delta !== null && (
                          <p className={a.delta >= 0 ? "text-emerald-600" : "text-rose-600"}>
                            {a.delta >= 0 ? "+" : ""}
                            {formatNote(a.delta)} pt(s)
                          </p>
                        )}
                      </div>
                    </div>

                    {a.responsible.length > 0 && (
                      <div className="mt-3">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Évaluations responsables
                        </p>
                        <ul className="space-y-1 text-xs">
                          {a.responsible.map((r, i) => (
                            <li key={i} className="flex justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-slate-800/60">
                              <span className="truncate">{r.name}</span>
                              <span className="whitespace-nowrap text-slate-500">
                                {formatDate(r.date)} · {r.score}/{r.maxScore}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-3">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Notions à réviser
                      </p>
                      {a.notions.length ? (
                        <ul className="flex flex-wrap gap-1.5">
                          {a.notions.map((n, i) => (
                            <li key={i} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {n}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[11px] text-slate-400">
                          Aucune notion renseignée — ajoute le chapitre dans « Réviser aujourd'hui »
                          pour enrichir ce conseil.
                        </p>
                      )}
                    </div>

                    <div className="mt-3 rounded-xl bg-brand-50 p-3 text-xs leading-relaxed text-brand-900 dark:bg-brand-950/60 dark:text-brand-100">
                      <strong>Plan d'action :</strong> {a.actionPlan}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <p className="mt-3 text-[11px] text-slate-400">
              {(() => {
                const drop = data.settings.dropAlertPoints;
                const sample = alerts.find((a) => a.level === "rouge" && a.previousAverage && a.currentAverage);
                return sample
                  ? `Exemple réel : moyenne de ${sample.subjectName.split("—")[0].trim()} passée de ${formatNote(sample.previousAverage)} à ${formatNote(sample.currentAverage)} (écart ${formatNote(Math.abs(round2((sample.currentAverage ?? 0) - (sample.previousAverage ?? 0))))} ≥ ${drop}).`
                  : `Une baisse est signalée quand la moyenne d'une matière diminue d'au moins ${drop} points entre deux périodes comparables.`;
              })()}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
