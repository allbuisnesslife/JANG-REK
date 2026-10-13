import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp, useActions } from "../store/store";
import { useComputed } from "../store/computed";
import { formatNote, formatMinutes, formatDate } from "../lib/format";
import { Badge, Card, EmptyState, Field, PageHeader, StatCard } from "../components/ui";
import { todayISO } from "../lib/id";
import { SEMESTERS } from "../data/maquette";

export default function Objectifs() {
  const { data } = useApp();
  const actions = useActions();
  const c = useComputed();

  const [general, setGeneral] = useState(String(data.goals.general));
  const [weekly, setWeekly] = useState(String(Math.round(data.goals.weeklyMinutes / 60)));
  const [rate, setRate] = useState(String(data.goals.exerciseSuccessRate));
  const [semGoals, setSemGoals] = useState({
    S3: String(data.goals.bySemester.S3),
    S4: String(data.goals.bySemester.S4),
  });
  const [subjectGoals, setSubjectGoals] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const [plSubject, setPlSubject] = useState(data.subjects[0]?.id ?? "");
  const [plName, setPlName] = useState("Examen final");
  const [plCoef, setPlCoef] = useState("2");
  const [plDate, setPlDate] = useState("");

  function save() {
    const g = Math.min(20, Math.max(0, Number(general) || 15));
    const goals = {
      general: g,
      bySemester: {
        S3: Math.min(20, Math.max(0, Number(semGoals.S3) || g)),
        S4: Math.min(20, Math.max(0, Number(semGoals.S4) || g)),
      },
      bySubject: Object.fromEntries(
        data.subjects
          .filter((s) => subjectGoals[s.id] !== undefined && subjectGoals[s.id] !== "")
          .map((s) => [s.id, Math.min(20, Math.max(0, Number(subjectGoals[s.id]) || g))])
      ),
      weeklyMinutes: Math.max(0, Math.round(Number(weekly) || 0) * 60),
      exerciseSuccessRate: Math.min(100, Math.max(0, Number(rate) || 0)),
    };
    actions.setGoals(goals);
    setSaved(true);
    setTimeout(() => setSaved(false), 3500);
  }

  const impossible = c.projections.filter((p) => p.feasible === false);

  return (
    <div>
      <PageHeader
        title="Mes objectifs"
        subtitle="Objectif principal : au moins 15/20. Les notes nécessaires sont calculées uniquement quand les évaluations restantes sont déclarées."
        actions={
          <button className="btn-primary" onClick={save}>
            Enregistrer les objectifs
          </button>
        }
      />

      {saved && (
        <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          Objectifs enregistrés et recalculés.
        </p>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Moyenne actuelle"
          value={c.general.value !== null ? `${formatNote(c.general.value)}/20` : "—"}
          hint={`Objectif ${data.goals.general}/20`}
        />
        <StatCard
          label="Note à obtenir sur le restant"
          value={
            c.globalProjection.neededOverall !== null
              ? `${formatNote(c.globalProjection.neededOverall)}/20`
              : "Non déterminable"
          }
          hint={
            c.globalProjection.neededOverall === null
              ? "Déclare les évaluations restantes ci-dessous"
              : c.globalProjection.feasible
                ? "Objectif atteignable"
                : "Objectif impossible avec ces coefficients"
          }
          tone={c.globalProjection.feasible === false ? "bad" : "info"}
        />
        <StatCard
          label="Meilleure moyenne atteignable"
          value={
            c.globalProjection.bestPossible !== null
              ? `${formatNote(c.globalProjection.bestPossible)}/20`
              : "—"
          }
          hint="Si tu obtiens 20 à tout le restant"
        />
        <StatCard
          label="Révision hebdomadaire"
          value={formatMinutes(c.weeklyMinutes)}
          hint={`Objectif ${formatMinutes(data.goals.weeklyMinutes)}`}
          tone={c.weeklyMinutes >= data.goals.weeklyMinutes ? "good" : "warn"}
        />
      </div>

      {impossible.length > 0 && (
        <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          <strong>Objectif impossible pour {impossible.length} matière(s) :</strong>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {impossible.map((p) => (
              <li key={p.subjectId}>
                {p.subjectName} — il faudrait {formatNote(p.needed)}/20 ; meilleure moyenne
                accessible : {formatNote(p.bestPossible)}/20.
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
            Objectifs de moyenne
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Moyenne générale (/20)">
              <input className="input" inputMode="decimal" value={general} onChange={(e) => setGeneral(e.target.value)} />
            </Field>
            {SEMESTERS.map((s) => (
              <Field key={s.id} label={`${s.label} (/20)`}>
                <input
                  className="input"
                  inputMode="decimal"
                  value={semGoals[s.id]}
                  onChange={(e) => setSemGoals({ ...semGoals, [s.id]: e.target.value })}
                />
              </Field>
            ))}
            <Field label="Temps de révision (h/semaine)">
              <input className="input" inputMode="decimal" value={weekly} onChange={(e) => setWeekly(e.target.value)} />
            </Field>
            <Field label="Réussite aux exercices (%)">
              <input className="input" inputMode="numeric" value={rate} onChange={(e) => setRate(e.target.value)} />
            </Field>
          </div>

          <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Objectif par matière (/20)
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.subjects
              .filter((s) => !s.disabled)
              .map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs font-medium text-slate-600 dark:text-slate-300">
                    {s.code}
                  </span>
                  <input
                    className="input !py-1.5"
                    inputMode="decimal"
                    placeholder={String(data.goals.general)}
                    value={subjectGoals[s.id] ?? ""}
                    onChange={(e) => setSubjectGoals({ ...subjectGoals, [s.id]: e.target.value })}
                  />
                </div>
              ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Laisse vide pour utiliser l'objectif général ({data.goals.general}/20).
          </p>
          <button className="btn-primary mt-3" onClick={save}>
            Enregistrer
          </button>
        </Card>

        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Évaluations restantes (nécessaires au calcul)
            </h2>
            <button
              className="btn-ghost !py-1.5 text-xs"
              onClick={() => actions.planFinalExamForAll(2)}
            >
              + Examen final partout (coef 2)
            </button>
          </div>

          <div className="mb-3 grid gap-2 sm:grid-cols-4">
            <Field label="Matière">
              <select className="input" value={plSubject} onChange={(e) => setPlSubject(e.target.value)}>
                {data.subjects
                  .filter((s) => !s.disabled)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Évaluation">
              <input className="input" value={plName} onChange={(e) => setPlName(e.target.value)} />
            </Field>
            <Field label="Coefficient">
              <input className="input" inputMode="decimal" value={plCoef} onChange={(e) => setPlCoef(e.target.value)} />
            </Field>
            <Field label="Date (optionnelle)">
              <input type="date" className="input" value={plDate} onChange={(e) => setPlDate(e.target.value)} />
            </Field>
          </div>
          <button
            className="btn-primary"
            onClick={() => {
              const coef = Number(plCoef);
              if (!plName.trim() || !Number.isFinite(coef) || coef <= 0) return;
              actions.addPlanned({
                subjectId: plSubject,
                name: plName.trim(),
                coefficient: coef,
                date: plDate || undefined,
              });
              setPlDate("");
            }}
          >
            Ajouter une évaluation prévue
          </button>

          {data.planned.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="Aucune évaluation prévue"
                description="Sans évaluation restante déclarée, la note à obtenir est mathématiquement non déterminable : aucune hypothèse n'est inventée."
              />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {[...data.planned]
                .sort((a, b) => a.subjectId.localeCompare(b.subjectId))
                .map((p) => {
                  const proj = c.projections.find((x) => x.subjectId === p.subjectId);
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800 dark:text-slate-200">
                          {data.subjects.find((s) => s.id === p.subjectId)?.code} — {p.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          coef {p.coefficient}
                          {p.date ? ` · ${formatDate(p.date)}` : ""}
                          {proj?.needed !== null && proj?.needed !== undefined ? (
                            <>
                              {" "}
                              · note à viser{" "}
                              <strong className="text-brand-600">{formatNote(proj.needed)}/20</strong>
                            </>
                          ) : null}
                        </p>
                      </div>
                      <button
                        className="shrink-0 text-xs text-rose-600 hover:underline"
                        onClick={() => actions.removePlanned(p.id)}
                      >
                        Retirer
                      </button>
                    </li>
                  );
                })}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Projection matière par matière
            </h2>
            <Badge tone={c.globalProjection.feasible === false ? "red" : "blue"}>
              {c.globalProjection.feasible === false ? "Ajustement nécessaire" : "Sur la bonne voie"}
            </Badge>
          </div>
          <div className="table-wrap">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <th className="th">Matière</th>
                  <th className="th">Actuelle</th>
                  <th className="th">Écart</th>
                  <th className="th">Poids restant</th>
                  <th className="th">Note à obtenir</th>
                  <th className="th">Maximum atteignable</th>
                  <th className="th">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {c.projections.map((p) => (
                  <tr key={p.subjectId}>
                    <td className="td">{p.subjectName}</td>
                    <td className="td font-semibold">{p.current !== null ? formatNote(p.current) : "—"}</td>
                    <td className="td">{p.gap !== null ? `${p.gap >= 0 ? "+" : ""}${formatNote(p.gap)}` : "—"}</td>
                    <td className="td">{p.hasPlanned ? p.plannedWeight : "—"}</td>
                    <td className="td font-semibold text-brand-600">
                      {p.needed !== null ? `${formatNote(p.needed)}/20` : "non déterminable"}
                    </td>
                    <td className="td">{p.bestPossible !== null ? `${formatNote(p.bestPossible)}/20` : "—"}</td>
                    <td className="td">
                      {!p.hasPlanned ? (
                        <Badge tone="slate">à déclarer</Badge>
                      ) : p.feasible === false ? (
                        <Badge tone="red">impossible</Badge>
                      ) : p.needed !== null && p.needed <= 0 ? (
                        <Badge tone="green">assuré</Badge>
                      ) : (
                        <Badge tone="blue">atteignable</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Voir aussi{" "}
            <Link to="/moyennes" className="text-brand-600 hover:underline">
              Mes moyennes
            </Link>{" "}
            et{" "}
            <Link to="/progression" className="text-brand-600 hover:underline">
              Ma progression
            </Link>
            . Dernière saisie :{" "}
            {data.evaluations.length
              ? formatDate([...data.evaluations].sort((a, b) => b.date.localeCompare(a.date))[0].date)
              : "aucune"}
            .
          </p>
        </Card>
      </div>

      <p className="mt-3 text-center text-xs text-slate-400">
        Formulaire : note = (somme des notes reçues × coef. + note_restante × poids_restant) / poids
        total. Date du jour : {formatDate(todayISO())}.
      </p>
    </div>
  );
}
