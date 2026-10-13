import { useState } from "react";
import { useApp } from "../store/store";
import { useComputed } from "../store/computed";
import { aggregate, componentBreakdown, subjectStats } from "../lib/calc";
import { confidenceLabel, formatNote, formatDate } from "../lib/format";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "../components/ui";
import type { SemesterId } from "../types";
import { SEMESTERS } from "../data/maquette";

type Tab = "matieres" | "ue" | "semestres" | "objectif";

export default function Moyennes() {
  const { data } = useApp();
  const c = useComputed();
  const [tab, setTab] = useState<Tab>("matieres");
  const [sem, setSem] = useState<"all" | SemesterId>("all");

  const coeffsConfirmed = data.subjects.some((s) => s.coefficientConfirmed);

  const ueGroups = (() => {
    const map = new Map<string, { ue: string; semester: SemesterId; ids: string[] }>();
    data.subjects
      .filter((s) => !s.disabled && (sem === "all" || s.semester === sem))
      .forEach((s) => {
        const key = `${s.semester}|${s.ue}`;
        const g = map.get(key) ?? { ue: s.ue, semester: s.semester, ids: [] };
        g.ids.push(s.id);
        map.set(key, g);
      });
    return [...map.values()];
  })();

  const tabs: { id: Tab; label: string }[] = [
    { id: "matieres", label: "Par matière" },
    { id: "ue", label: "Par UE" },
    { id: "semestres", label: "Par semestre" },
    { id: "objectif", label: "Notes à viser" },
  ];

  return (
    <div>
      <PageHeader
        title="Mes moyennes"
        subtitle="Moyennes pondérées calculées en temps réel : notes reçues, règles officielles et projection finale."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Moyenne générale (reçue)"
          value={c.general.value !== null ? `${formatNote(c.general.value)}/20` : "Données insuffisantes"}
          hint={confidenceLabel(c.general.confidence)}
          tone={c.general.value !== null && c.general.value >= data.goals.general ? "good" : "warn"}
        />
        <StatCard label="Semestre 3" value={c.s3.value !== null ? `${formatNote(c.s3.value)}/20` : "—"} hint={confidenceLabel(c.s3.confidence)} />
        <StatCard label="Semestre 4" value={c.s4.value !== null ? `${formatNote(c.s4.value)}/20` : "—"} hint={confidenceLabel(c.s4.confidence)} />
        <StatCard
          label="Moyenne finale à viser"
          value={`${data.goals.general}/20`}
          hint={
            c.globalProjection.feasible === false
              ? `Impossible : meilleure moyenne ${formatNote(c.globalProjection.bestPossible)}/20`
              : c.globalProjection.neededOverall !== null
                ? `Note à obtenir sur le restant : ${formatNote(c.globalProjection.neededOverall)}/20`
                : "Évaluations prévues à définir"
          }
          tone={c.globalProjection.feasible === false ? "bad" : "info"}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-3.5 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "bg-brand-600 text-white"
                : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
        <select className="input ml-auto !w-auto" value={sem} onChange={(e) => setSem(e.target.value as never)}>
          <option value="all">Tous les semestres</option>
          {SEMESTERS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {data.evaluations.length === 0 ? (
        <EmptyState
          title="Aucune moyenne calculable"
          description="Saisis au moins une évaluation pour obtenir tes moyennes. Tant que les règles officielles ne sont pas renseignées, les valeurs affichées sont provisoires."
        />
      ) : (
        <>
          {tab === "matieres" && (
            <div className="table-wrap">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr>
                    <th className="th">Code</th>
                    <th className="th">Matière</th>
                    <th className="th">Sem.</th>
                    <th className="th">UE</th>
                    <th className="th">Éval.</th>
                    <th className="th">Moyenne</th>
                    <th className="th">Meilleure</th>
                    <th className="th">Plus faible</th>
                    <th className="th">Écart dernière/préc.</th>
                    <th className="th">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {c.stats.map((st) => (
                    <tr key={st.subject.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="td font-mono font-semibold text-brand-600 dark:text-brand-400">{st.subject.code}</td>
                      <td className="td max-w-xs">
                        <span className="block truncate">{st.subject.name}</span>
                        {(st.subject.components?.length ?? 0) > 1 && (
                          <ul className="mt-1 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {componentBreakdown(
                              st.evals,
                              st.subject.components,
                              data.settings.rules.find((r) => r.subjectId === st.subject.id),
                              data.settings.minEvalsForAverage
                            ).map((part) => (
                              <li key={part.name} className="flex justify-between gap-2">
                                <span className="truncate">{part.name}</span>
                                <span className="shrink-0 font-medium">
                                  {part.average.value !== null ? formatNote(part.average.value) : "—"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="td">{st.subject.semester}</td>
                      <td className="td">{st.subject.ue}</td>
                      <td className="td">{st.average.count}</td>
                      <td className="td font-semibold">
                        {st.average.value !== null ? `${formatNote(st.average.value)}/20` : "—"}
                      </td>
                      <td className="td text-emerald-600">{formatNote(st.best)}</td>
                      <td className="td text-rose-600">{formatNote(st.worst)}</td>
                      <td className="td">
                        {st.delta === null ? (
                          "—"
                        ) : (
                          <span className={st.delta >= 0 ? "text-emerald-600" : "text-rose-600"}>
                            {st.delta >= 0 ? "+" : ""}
                            {formatNote(st.delta)}
                          </span>
                        )}
                      </td>
                      <td className="td">
                        <Badge
                          tone={
                            st.average.confidence === "confirmed"
                              ? "green"
                              : st.average.confidence === "provisional"
                                ? "amber"
                                : "red"
                          }
                        >
                          {confidenceLabel(st.average.confidence)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "ue" && (
            <div className="grid gap-3 md:grid-cols-2">
              {ueGroups.map((g) => {
                const parts = g.ids
                  .map((id) => {
                    const s = data.subjects.find((x) => x.id === id)!;
                    const st = subjectStats(
                      s,
                      data.evaluations,
                      data.settings.rules.find((r) => r.subjectId === id),
                      data.settings.minEvalsForAverage
                    );
                    return {
                      value: st.average.value,
                      coefficient: s.coefficient,
                      confirmed: s.coefficientConfirmed && st.average.confidence === "confirmed",
                      count: st.average.count,
                      code: s.code,
                    };
                  })
                  .filter((p) => p.value !== null);
                const agg = aggregate(
                  parts.map((p) => ({ value: p.value, coefficient: p.coefficient, confirmed: p.confirmed })),
                  coeffsConfirmed
                );
                return (
                  <Card key={g.ue + g.semester}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{g.ue}</p>
                        <p className="text-xs text-slate-500">{g.semester}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {parts.length} matière(s) évaluée(s) · poids total {agg.weight}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {agg.value !== null ? formatNote(agg.value) : "—"}
                        </p>
                        <Badge tone={agg.confidence === "confirmed" ? "green" : "amber"}>
                          {confidenceLabel(agg.confidence)}
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">{agg.message}</p>
                  </Card>
                );
              })}
            </div>
          )}

          {tab === "semestres" && (
            <div className="grid gap-4 md:grid-cols-3">
              {SEMESTERS.map((s) => {
                const avg = s.id === "S3" ? c.s3 : c.s4;
                const goal = data.goals.bySemester[s.id];
                return (
                  <Card key={s.id}>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{s.label}</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                      {avg.value !== null ? `${formatNote(avg.value)}/20` : "—"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{avg.message ?? confidenceLabel(avg.confidence)}</p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-slate-500">Objectif</span>
                      <span className="font-semibold text-brand-600">{goal}/20</span>
                    </div>
                  </Card>
                );
              })}
              <Card>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Année (S3 + S4)</p>
                <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                  {c.general.value !== null ? `${formatNote(c.general.value)}/20` : "—"}
                </p>
                <p className="mt-1 text-xs text-slate-400">{c.general.message ?? confidenceLabel(c.general.confidence)}</p>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Objectif annuel</span>
                  <span className="font-semibold text-brand-600">{data.goals.general}/20</span>
                </div>
              </Card>
            </div>
          )}

          {tab === "objectif" && (
            <div className="table-wrap">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr>
                    <th className="th">Matière</th>
                    <th className="th">Moyenne actuelle</th>
                    <th className="th">Écart à l'objectif</th>
                    <th className="th">Poids restant prévu</th>
                    <th className="th">Note à obtenir</th>
                    <th className="th">Meilleure moyenne atteignable</th>
                    <th className="th">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {c.projections
                    .filter((p) => sem === "all" || (data.subjects.find((s) => s.id === p.subjectId)?.semester === sem))
                    .map((p) => (
                      <tr key={p.subjectId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="td">{p.subjectName}</td>
                        <td className="td font-semibold">{p.current !== null ? `${formatNote(p.current)}/20` : "—"}</td>
                        <td className="td">{p.gap !== null ? `${p.gap >= 0 ? "+" : ""}${formatNote(p.gap)}` : "—"}</td>
                        <td className="td">{p.hasPlanned ? p.plannedWeight : "à définir"}</td>
                        <td className="td font-semibold text-brand-600">
                          {p.needed !== null ? `${formatNote(p.needed)}/20` : "non déterminable"}
                        </td>
                        <td className="td">{p.bestPossible !== null ? `${formatNote(p.bestPossible)}/20` : "—"}</td>
                        <td className="td">
                          {!p.hasPlanned ? (
                            <Badge tone="slate">évaluation prévue manquante</Badge>
                          ) : p.feasible === false ? (
                            <Badge tone="red">objectif impossible</Badge>
                          ) : p.needed !== null && p.needed <= 0 ? (
                            <Badge tone="green">objectif déjà assuré</Badge>
                          ) : (
                            <Badge tone="blue">atteignable</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <p className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                Formule : note = (somme des notes reçues × coefficients + x × poids restant) / poids
                total. Le poids restant provient des évaluations prévues dans{" "}
                <a href="/objectifs" className="text-brand-600 underline">
                  Mes objectifs
                </a>
                . Dernière évaluation enregistrée le{" "}
                {data.evaluations.length
                  ? formatDate([...data.evaluations].sort((a, b) => b.date.localeCompare(a.date))[0].date)
                  : "—"}
                .
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
