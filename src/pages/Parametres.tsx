import { useRef, useState } from "react";
import { useApp, useActions } from "../store/store";
import { evaluationsToCsv, downloadText } from "../lib/csv";
import { todayISO } from "../lib/id";
import { Badge, Card, Field, PageHeader } from "../components/ui";

export default function Parametres() {
  const { data } = useApp();
  const actions = useActions();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string>("");

  const s = data.settings;

  const downloadJson = () => {
    downloadText(
      `abl-goal-sauvegarde-${todayISO()}.json`,
      actions.exportJson(),
      "application/json"
    );
    setMsg("Sauvegarde JSON téléchargée.");
  };

  return (
    <div>
      <PageHeader
        title="Paramètres"
        subtitle="Règles de calcul, coefficients, seuils d'alerte et sauvegardes."
        actions={
          <button
            className="btn-primary"
            onClick={() => {
              setMsg("Paramètres appliqués automatiquement.");
              setTimeout(() => setMsg(""), 3000);
            }}
          >
            Appliquer
          </button>
        }
      />

      {msg && (
        <p className="mb-4 rounded-xl bg-brand-50 px-4 py-2.5 text-sm text-brand-800 dark:bg-brand-950/60 dark:text-brand-200">
          {msg}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Apparence</h2>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Mode sombre</p>
              <p className="text-xs text-slate-500">Interface bleu foncé / blanc.</p>
            </div>
            <button
              className={s.theme === "dark" ? "btn-primary" : "btn-ghost"}
              onClick={() => actions.setTheme(s.theme === "dark" ? "light" : "dark")}
            >
              {s.theme === "dark" ? "Actif" : "Inactif"}
            </button>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
            Seuils des alertes
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Baisse importante (points)">
              <input
                className="input"
                inputMode="decimal"
                value={s.dropAlertPoints}
                onChange={(e) => actions.updateSettings({ dropAlertPoints: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Baisse modérée (points)">
              <input
                className="input"
                inputMode="decimal"
                value={s.dropModeratePoints}
                onChange={(e) => actions.updateSettings({ dropModeratePoints: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Moyenne critique (/20)">
              <input
                className="input"
                inputMode="decimal"
                value={s.lowAverageThreshold}
                onChange={(e) => actions.updateSettings({ lowAverageThreshold: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Évaluations min. pour alerter" hint="Au moins 4 pour éviter les fausses alertes">
              <input
                className="input"
                inputMode="numeric"
                value={s.minEvalsForAlert}
                onChange={(e) => actions.updateSettings({ minEvalsForAlert: Number(e.target.value) || 1 })}
              />
            </Field>
            <Field label="Évaluations min. pour une moyenne" hint="Avant : « données insuffisantes »">
              <input
                className="input"
                inputMode="numeric"
                value={s.minEvalsForAverage}
                onChange={(e) => actions.updateSettings({ minEvalsForAverage: Number(e.target.value) || 1 })}
              />
            </Field>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">
            Règles de calcul par matière (Contrôle continu / Examen)
          </h2>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Coche « Sans CC » pour un module où le prof ne fait pas de contrôle continu : la
            moyenne est alors calculée uniquement avec la note d&apos;examen. Sinon, active la
            règle CC/Examen et étiquette chaque évaluation dans son formulaire (Mes notes).
            Sans règle, l&apos;application utilise une moyenne pondérée provisoire.
          </p>
          <div className="table-wrap">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <th className="th">Matière</th>
                  <th className="th">Règle active</th>
                  <th className="th">Sans CC</th>
                  <th className="th">Poids CC</th>
                  <th className="th">Poids Examen</th>
                  <th className="th">Coefficient matière</th>
                  <th className="th">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.subjects.map((sub) => {
                  const rule = s.rules.find((r) => r.subjectId === sub.id);
                  const enabled = rule?.enabled ?? false;
                  const examOnly = rule?.examOnly ?? false;
                  const base = {
                    subjectId: sub.id,
                    ccWeight: rule?.ccWeight ?? 0.4,
                    examWeight: rule?.examWeight ?? 0.6,
                  };
                  return (
                    <tr key={sub.id}>
                      <td className="td font-medium">{sub.code}</td>
                      <td className="td">
                        <input
                          type="checkbox"
                          checked={enabled}
                          aria-label={`Activer la règle pour ${sub.code}`}
                          onChange={(e) =>
                            actions.setRule({
                              ...base,
                              enabled: e.target.checked,
                              examOnly,
                            })
                          }
                        />
                      </td>
                      <td className="td">
                        <input
                          type="checkbox"
                          checked={examOnly}
                          disabled={!enabled}
                          title="Pas de contrôle continu : moyenne = note d'examen"
                          aria-label={`Sans contrôle continu pour ${sub.code}`}
                          onChange={(e) =>
                            actions.setRule({
                              ...base,
                              enabled: true,
                              examOnly: e.target.checked,
                            })
                          }
                        />
                      </td>
                      <td className="td">
                        <input
                          className="input !w-24 !py-1"
                          inputMode="decimal"
                          disabled={!enabled || examOnly}
                          value={rule?.ccWeight ?? 0.4}
                          onChange={(e) =>
                            actions.setRule({
                              ...base,
                              enabled: true,
                              examOnly,
                              ccWeight: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </td>
                      <td className="td">
                        <input
                          className="input !w-24 !py-1"
                          inputMode="decimal"
                          disabled={!enabled}
                          value={rule?.examWeight ?? 0.6}
                          onChange={(e) =>
                            actions.setRule({
                              ...base,
                              enabled: true,
                              examOnly,
                              examWeight: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </td>
                      <td className="td">
                        <input
                          className="input !w-20 !py-1"
                          inputMode="decimal"
                          value={sub.coefficient}
                          onChange={(e) =>
                            actions.updateSubject(sub.id, {
                              coefficient: Number(e.target.value) || 1,
                              coefficientConfirmed: sub.coefficientConfirmed,
                            })
                          }
                        />
                      </td>
                      <td className="td">
                        <Badge tone={enabled ? (examOnly ? "blue" : "green") : "amber"}>
                          {!enabled ? "provisoire" : examOnly ? "examen seul" : "règle active"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
            Les crédits ECTS ne sont jamais utilisés comme coefficients de moyenne. Confirme les
            coefficients réels dans la page « Ma maquette ».
          </p>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Sauvegardes</h2>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={downloadJson}>
              Exporter (JSON)
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                downloadText(
                  `abl-goal-notes-${todayISO()}.csv`,
                  evaluationsToCsv(data.evaluations, data.subjects)
                );
                setMsg("Notes exportées en CSV.");
              }}
            >
              Exporter les notes (CSV)
            </button>
            <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
              Importer une sauvegarde
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => actions.importJson(String(reader.result));
                reader.readAsText(f);
                e.target.value = "";
              }}
            />
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Les données sont enregistrées automatiquement dans ce navigateur (localStorage). Pour
            changer de téléphone ou de navigateur, exporte un JSON puis importe-le ailleurs.
          </p>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Données</h2>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => actions.loadDemo()}>
              Charger la démo
            </button>
            <button
              className="btn-danger"
              onClick={() => {
                if (window.confirm("Supprimer TOUTES tes données (notes, cours, séances) ?")) {
                  actions.resetAll();
                }
              }}
            >
              Tout supprimer
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            État actuel :{" "}
            {data.isDemo ? (
              <Badge tone="amber">données de démonstration</Badge>
            ) : (
              <Badge tone="green">tes données personnelles</Badge>
            )}{" "}
            — {data.evaluations.length} évaluation(s), {data.documents.length} document(s),{" "}
            {data.sessions.length} séance(s).
          </p>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
            Sécurité et synchronisation
          </h2>
          <ul className="list-inside list-disc space-y-1 text-xs text-slate-500 dark:text-slate-400">
            <li>
              Aucune clé secrète ni clé de service n'est stockée dans le frontend : l'application
              fonctionne sans backend.
            </li>
            <li>
              Migration possible vers Supabase (PostgreSQL) : la couche{" "}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">store/storage.ts</code>{" "}
              expose une interface <code>StorageAdapter</code> à implémenter côté client avec la clé
              <em>anon</em> publique uniquement.
            </li>
            <li>
              Côté base de données, activer RLS : chaque utilisateur ne lit et ne modifie que ses
              propres lignes (<code>user_id = auth.uid()</code>).
            </li>
            <li>Les mots de passe et tokens ne sont jamais stockés dans ce navigateur.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
