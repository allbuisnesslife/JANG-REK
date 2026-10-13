import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp, useActions } from "../store/store";
import { useComputed } from "../store/computed";
import { normalize, round2, subjectAverage } from "../lib/calc";
import { evaluationsToCsv, downloadText } from "../lib/csv";
import { formatDate, formatNote, confidenceLabel } from "../lib/format";
import { todayISO } from "../lib/id";
import { Badge, EmptyState, Field, Modal, PageHeader, StatCard } from "../components/ui";
import type { EvalType, Evaluation, SemesterId } from "../types";
import { EVAL_TYPES } from "../types";

interface FormState {
  id?: string;
  subjectId: string;
  semester: SemesterId;
  /** Élément constitutif de l'UE (ex. « Physique de la télédétection »). */
  component: string;
  name: string;
  type: EvalType;
  score: string;
  maxScore: string;
  coefficient: string;
  date: string;
  comment: string;
  ruleGroup: "" | "cc" | "examen";
}

const emptyForm = (subjectId: string, semester: SemesterId): FormState => ({
  subjectId,
  semester,
  component: "",
  name: "",
  type: "devoir",
  score: "",
  maxScore: "20",
  coefficient: "1",
  date: todayISO(),
  comment: "",
  ruleGroup: "",
});

function validate(f: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.name.trim()) e.name = "Indique le nom de l'évaluation.";
  if (!f.subjectId) e.subjectId = "Choisis une matière.";
  const score = Number(f.score);
  const max = Number(f.maxScore);
  if (f.score.trim() === "" || Number.isNaN(score)) e.score = "Note requise (nombre).";
  else if (score < 0) e.score = "La note ne peut pas être négative.";
  else if (Number.isFinite(max) && max > 0 && score > max) e.score = `La note dépasse la note maximale (${max}).`;
  if (!Number.isFinite(max) || max <= 0) e.maxScore = "Note maximale supérieure à 0.";
  const c = Number(f.coefficient);
  if (!Number.isFinite(c) || c <= 0) e.coefficient = "Coefficient supérieur à 0.";
  if (!f.date) e.date = "Date requise.";
  return e;
}

export default function Notes() {
  const { data } = useApp();
  const actions = useActions();
  const computed = useComputed();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() =>
    emptyForm(data.subjects[0]?.id ?? "", (data.subjects[0]?.semester ?? "S3") as SemesterId)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [fSemester, setFSemester] = useState<"all" | SemesterId>("all");
  const [fSubject, setFSubject] = useState("all");
  const [fType, setFType] = useState<"all" | EvalType>("all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");

  const filtered = useMemo(() => {
    return data.evaluations
      .filter((e) => (fSemester === "all" ? true : e.semester === fSemester))
      .filter((e) => (fSubject === "all" ? true : e.subjectId === fSubject))
      .filter((e) => (fType === "all" ? true : e.type === fType))
      .filter((e) => (fFrom ? e.date >= fFrom : true))
      .filter((e) => (fTo ? e.date <= fTo : true))
      .sort((a, b) => (b.date === a.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)));
  }, [data.evaluations, fSemester, fSubject, fType, fFrom, fTo]);

  const filteredAvg = useMemo(() => {
    const items = filtered
      .map((e) => ({ value: normalize(e.score, e.maxScore), weight: e.coefficient }))
      .filter((i): i is { value: number; weight: number } => i.value !== null);
    if (!items.length) return null;
    const w = items.reduce((s, i) => s + i.weight, 0);
    return w > 0 ? round2(items.reduce((s, i) => s + i.value * i.weight, 0) / w) : null;
  }, [filtered]);

  const allNorm = data.evaluations
    .map((e) => normalize(e.score, e.maxScore))
    .filter((n): n is number => n !== null);
  const best = allNorm.length ? Math.max(...allNorm) : null;
  const worst = allNorm.length ? Math.min(...allNorm) : null;

  const sortedByDate = [...data.evaluations].sort((a, b) => a.date.localeCompare(b.date));
  const normSorted = sortedByDate
    .map((e) => normalize(e.score, e.maxScore))
    .filter((n): n is number => n !== null);
  const last = normSorted.length ? normSorted[normSorted.length - 1] : null;
  const prev = normSorted.length > 1 ? normSorted[normSorted.length - 2] : null;

  const subjectOf = (id: string) => data.subjects.find((s) => s.id === id);
  const ruleOf = (id: string) => data.settings.rules.find((r) => r.subjectId === id);

  function openNew(subjectId?: string) {
    const s = subjectId ? subjectOf(subjectId) : data.subjects[0];
    setForm(emptyForm(s?.id ?? "", (s?.semester ?? "S3") as SemesterId));
    setErrors({});
    setOpen(true);
  }

  function openEdit(ev: Evaluation) {
    setForm({
      id: ev.id,
      subjectId: ev.subjectId,
      semester: ev.semester,
      component: ev.component ?? "",
      name: ev.name,
      type: ev.type,
      score: String(ev.score),
      maxScore: String(ev.maxScore),
      coefficient: String(ev.coefficient),
      date: ev.date,
      comment: ev.comment ?? "",
      ruleGroup: ev.ruleGroup ?? "",
    });
    setErrors({});
    setOpen(true);
  }

  function toggleHasCC(hasCC: boolean, subjectId: string) {
    const rule = ruleOf(subjectId);
    actions.setRule({
      subjectId,
      enabled: true,
      ccWeight: rule?.ccWeight ?? 0.4,
      examWeight: rule?.examWeight ?? 0.6,
      examOnly: !hasCC,
    });
    setForm((f) => ({
      ...f,
      subjectId,
      ruleGroup: hasCC ? (f.ruleGroup === "examen" ? "examen" : f.ruleGroup) : "examen",
    }));
  }

  function submit() {
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const rule = ruleOf(form.subjectId);
    const examOnly = rule?.enabled === true && rule.examOnly === true;

    const payload = {
      subjectId: form.subjectId,
      semester: form.semester,
      component: form.component.trim() || undefined,
      name: form.name.trim(),
      type: form.type,
      score: Number(form.score),
      maxScore: Number(form.maxScore),
      coefficient: Number(form.coefficient),
      date: form.date,
      comment: form.comment.trim() || undefined,
      ruleGroup: examOnly
        ? ("examen" as const)
        : form.ruleGroup
          ? (form.ruleGroup as "cc" | "examen")
          : undefined,
    };

    if (form.id) actions.updateEvaluation(form.id, payload);
    else actions.addEvaluation(payload);
    setOpen(false);
  }

  const typeLabel = (t: EvalType) => EVAL_TYPES.find((x) => x.id === t)?.label ?? t;

  return (
    <div>
      <PageHeader
        title="Mes notes"
        subtitle="Saisie, modification et calcul instantané de tes moyennes pondérées."
        actions={
          <>
            <button
              className="btn-ghost"
              onClick={() =>
                downloadText(
                  `abl-goal-notes-${todayISO()}.csv`,
                  evaluationsToCsv(data.evaluations, data.subjects)
                )
              }
              disabled={!data.evaluations.length}
            >
              Exporter CSV
            </button>
            <button className="btn-primary" onClick={() => openNew()}>
              + Ajouter une évaluation
            </button>
          </>
        }
      />

      {/* Distinction essentielle : notes reçues vs moyenne finale */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Moyenne sur les notes reçues"
          value={computed.general.value !== null ? `${formatNote(computed.general.value)}/20` : "—"}
          hint={confidenceLabel(computed.general.confidence)}
          tone={computed.general.value === null ? "neutral" : computed.general.value >= data.goals.general ? "good" : "warn"}
        />
        <StatCard
          label={`Moyenne finale visée (S3 + S4)`}
          value={data.goals.general + "/20"}
          hint={
            computed.globalProjection.neededOverall !== null
              ? `Il te faut ${formatNote(computed.globalProjection.neededOverall)}/20 sur les évaluations restantes`
              : "Ajoute des évaluations prévues pour calculer la note à viser"
          }
          tone="info"
        />
        <StatCard
          label="Dernière vs précédente"
          value={last !== null && prev !== null ? `${round2(last - prev) > 0 ? "+" : ""}${formatNote(round2(last - prev))}` : "—"}
          hint={`Meilleure note ${formatNote(best)} · Plus faible ${formatNote(worst)}`}
          tone={last !== null && prev !== null && last - prev >= 0 ? "good" : "bad"}
        />
      </div>

      {!computed.globalProjection.feasible && computed.globalProjection.neededOverall !== null && (
        <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          <strong>Objectif difficilement atteignable :</strong> il faudrait{" "}
          {formatNote(computed.globalProjection.neededOverall)}/20 sur l'ensemble des évaluations
          restantes (au-delà de 20). Meilleure moyenne encore accessible :{" "}
          <strong>{formatNote(computed.globalProjection.bestPossible)}/20</strong>.
        </div>
      )}

      {/* Filtres */}
      <div className="card mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Semestre">
          <select className="input" value={fSemester} onChange={(e) => setFSemester(e.target.value as never)}>
            <option value="all">Tous</option>
            <option value="S3">Semestre 3</option>
            <option value="S4">Semestre 4</option>
          </select>
        </Field>
        <Field label="Matière">
          <select className="input" value={fSubject} onChange={(e) => setFSubject(e.target.value)}>
            <option value="all">Toutes</option>
            {data.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type d'évaluation">
          <select className="input" value={fType} onChange={(e) => setFType(e.target.value as never)}>
            <option value="all">Tous</option>
            {EVAL_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Du">
          <input type="date" className="input" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
        </Field>
        <Field label="Au">
          <input type="date" className="input" value={fTo} onChange={(e) => setFTo(e.target.value)} />
        </Field>
        <div className="sm:col-span-2 lg:col-span-5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            {filtered.length} évaluation(s) · moyenne du filtre :{" "}
            <strong>{filteredAvg !== null ? `${formatNote(filteredAvg)}/20` : "—"}</strong>
          </span>
          <button
            className="underline"
            onClick={() => {
              setFSemester("all");
              setFSubject("all");
              setFType("all");
              setFFrom("");
              setFTo("");
            }}
          >
            Réinitialiser les filtres
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Aucune évaluation"
          description={
            data.evaluations.length
              ? "Aucune évaluation ne correspond à ces filtres."
              : "Aucune note pour l'instant. Ajoute ta première évaluation pour lancer les calculs et les graphiques."
          }
          action={
            <button className="btn-primary" onClick={() => openNew()}>
              Ajouter une évaluation
            </button>
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="th">Date</th>
                <th className="th">Matière</th>
                <th className="th">Évaluation</th>
                <th className="th">Type</th>
                <th className="th">Note</th>
                <th className="th">Sur 20</th>
                <th className="th">Coef.</th>
                <th className="th">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((e) => {
                const s = subjectOf(e.subjectId);
                const n = normalize(e.score, e.maxScore);
                return (
                  <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="td">{formatDate(e.date)}</td>
                    <td className="td">
                      <span className="font-medium">{s?.code ?? e.subjectId}</span>
                      {e.component && (
                        <span className="ml-1 text-xs text-brand-600 dark:text-brand-400">· {e.component}</span>
                      )}
                      {e.comment && (
                        <span className="ml-2 hidden text-xs text-slate-400 md:inline">— {e.comment}</span>
                      )}
                    </td>
                    <td className="td">{e.name}</td>
                    <td className="td">
                      <Badge tone={e.type === "examen" ? "blue" : "slate"}>{typeLabel(e.type)}</Badge>
                    </td>
                    <td className="td">
                      {e.score}/{e.maxScore}
                    </td>
                    <td className="td">
                      <span
                        className={`font-semibold ${
                          (n ?? 0) >= data.goals.general
                            ? "text-emerald-600"
                            : (n ?? 0) >= data.settings.lowAverageThreshold
                              ? "text-amber-600"
                              : "text-rose-600"
                        }`}
                      >
                        {formatNote(n)}
                      </span>
                    </td>
                    <td className="td">{e.coefficient}</td>
                    <td className="td">
                      <div className="flex gap-2">
                        <button className="text-brand-600 hover:underline" onClick={() => openEdit(e)}>
                          Modifier
                        </button>
                        <button
                          className="text-rose-600 hover:underline"
                          onClick={() => actions.removeEvaluation(e.id)}
                        >
                          Suppr.
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        Moyennes par matière, UE et semestre détaillées dans{" "}
        <Link className="font-medium text-brand-600 hover:underline" to="/moyennes">
          Mes moyennes
        </Link>
        . Les alertes de baisse sont dans{" "}
        <Link className="font-medium text-brand-600 hover:underline" to="/progression">
          Ma progression
        </Link>
        .
      </p>

      {/* Formulaire */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? "Modifier l'évaluation" : "Ajouter une évaluation"}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Matière" error={errors.subjectId}>
              <select
                className="input"
                value={form.subjectId}
                onChange={(e) => {
                  const s = subjectOf(e.target.value);
                  const r = ruleOf(e.target.value);
                  const examOnly = r?.enabled === true && r.examOnly === true;
                  const comps = s?.components ?? [];
                  setForm({
                    ...form,
                    subjectId: e.target.value,
                    semester: (s?.semester ?? form.semester) as SemesterId,
                    component: comps.includes(form.component) ? form.component : "",
                    ruleGroup: examOnly ? "examen" : form.ruleGroup,
                  });
                }}
              >
                {(["S3", "S4"] as SemesterId[]).map((sem) => (
                  <optgroup key={sem} label={sem === "S3" ? "Semestre 3" : "Semestre 4"}>
                    {data.subjects
                      .filter((s) => s.semester === sem)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} — {s.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Semestre">
            <input className="input" value={form.semester === "S3" ? "Semestre 3" : "Semestre 4"} readOnly />
          </Field>
          <Field label="UE">
            <input className="input" value={subjectOf(form.subjectId)?.ue ?? ""} readOnly />
          </Field>

          {(subjectOf(form.subjectId)?.components.length ?? 0) > 0 && (
            <div className="sm:col-span-2">
              <Field
                label="Élément constitutif (EC)"
                hint="L'UE n'est moyennée que lorsque chaque EC a au moins une note"
              >
                <select
                  className="input"
                  value={form.component}
                  onChange={(e) => setForm({ ...form, component: e.target.value })}
                >
                  <option value="">— Choisir un EC —</option>
                  {(subjectOf(form.subjectId)?.components ?? []).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              {form.component && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Cette note sera rattachée à « {form.component} ».
                </p>
              )}
            </div>
          )}

          <div className="sm:col-span-2">
            <Field label="Nom de l'évaluation" error={errors.name}>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex. Examen partiel, Devoir 2, TP SIG…"
              />
            </Field>
          </div>

          <Field label="Type">
            <select
              className="input"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as EvalType })}
            >
              {EVAL_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
            <label className="flex items-start gap-2 text-sm text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={!(ruleOf(form.subjectId)?.enabled && ruleOf(form.subjectId)?.examOnly)}
                onChange={(e) => toggleHasCC(e.target.checked, form.subjectId)}
              />
              <span>
                Ce module a un contrôle continu (CC)
                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                  Décoche si le prof ne fait pas de CC : la moyenne sera calculée uniquement avec la
                  note d'examen (aucune note de contrôle ignorée).
                </span>
              </span>
            </label>
            {ruleOf(form.subjectId)?.enabled && ruleOf(form.subjectId)?.examOnly && (
              <p className="mt-2 text-xs font-medium text-blue-700 dark:text-blue-300">
                Mode « examen seul » actif pour cette matière — cette note sera comptée comme Examen.
              </p>
            )}
          </div>

          {!(ruleOf(form.subjectId)?.enabled && ruleOf(form.subjectId)?.examOnly) && (
            <Field
              label="Groupe (si règle CC/Examen active)"
              hint="Sert à appliquer la règle de calcul officielle"
            >
              <select
                className="input"
                value={form.ruleGroup}
                onChange={(e) => setForm({ ...form, ruleGroup: e.target.value as never })}
              >
                <option value="">Aucun</option>
                <option value="cc">Contrôle continu</option>
                <option value="examen">Examen</option>
              </select>
            </Field>
          )}

          <Field label="Note obtenue" error={errors.score}>
            <input
              className="input"
              inputMode="decimal"
              value={form.score}
              onChange={(e) => setForm({ ...form, score: e.target.value })}
              placeholder="Ex. 14,5"
            />
          </Field>
          <Field label="Note maximale" error={errors.maxScore} hint="20 par défaut">
            <input
              className="input"
              inputMode="decimal"
              value={form.maxScore}
              onChange={(e) => setForm({ ...form, maxScore: e.target.value })}
            />
          </Field>
          <Field label="Coefficient" error={errors.coefficient}>
            <input
              className="input"
              inputMode="decimal"
              value={form.coefficient}
              onChange={(e) => setForm({ ...form, coefficient: e.target.value })}
            />
          </Field>
          <Field label="Date" error={errors.date}>
            <input
              type="date"
              className="input"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Commentaire (facultatif)">
              <textarea
                className="input"
                rows={2}
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
                placeholder="Chapitres concernés, erreurs, notions à revoir…"
              />
            </Field>
          </div>

          <div className="sm:col-span-2 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
            <span className="text-slate-500 dark:text-slate-400">Valeur normalisée sur 20 :</span>
            <strong>
              {formatNote(
                normalize(Number(form.score) || 0, Number(form.maxScore) || 20)
              )}
              /20
            </strong>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setOpen(false)}>
            Annuler
          </button>
          <button className="btn-primary" onClick={submit}>
            {form.id ? "Enregistrer" : "Ajouter"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
