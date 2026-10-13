import { useApp, useActions } from "../store/store";
import { OFFICIAL_TOTALS, SEMESTERS } from "../data/maquette";
import { Badge, Card, PageHeader } from "../components/ui";
import type { SemesterId } from "../types";

export default function Maquette() {
  const { data } = useApp();
  const actions = useActions();

  return (
    <div>
      <PageHeader
        title="Ma maquette"
        subtitle="Coefficients et crédits de la maquette officielle L2 Géomatique (UIDT / UFR SI). Modifiable si besoin — confirme pour figer une valeur."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        {SEMESTERS.map((sem) => {
          const list = data.subjects.filter((s) => s.semester === sem.id && !s.disabled);
          const coef = list.reduce((sum, s) => sum + s.coefficient, 0);
          const credits = list.reduce((sum, s) => sum + (s.credits ?? 0), 0);
          const official = OFFICIAL_TOTALS[sem.id];
          const ok = coef === official.coefficient && credits === official.credits;
          return (
            <Card key={sem.id}>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {sem.label}
              </p>
              <p className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white">
                {list.length} UE · {coef} coef · {credits} ECTS
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Officiel : {official.coefficient} coef / {official.credits} ECTS
              </p>
              <div className="mt-2">
                <Badge tone={ok ? "green" : "amber"}>
                  {ok ? "conforme à la maquette" : "écart avec l'officiel"}
                </Badge>
              </div>
            </Card>
          );
        })}
      </div>

      {SEMESTERS.map((sem) => (
        <Card key={sem.id} className="mb-4 overflow-x-auto">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{sem.label}</h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="pb-2 pr-3">Code</th>
                <th className="pb-2 pr-3">Matière</th>
                <th className="pb-2 pr-3">UE</th>
                <th className="pb-2 pr-3">Coef</th>
                <th className="pb-2 pr-3">ECTS</th>
                <th className="pb-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {data.subjects
                .filter((s) => s.semester === sem.id)
                .map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
                    <td className="td font-mono text-xs">{s.code}</td>
                    <td className="td">
                      {s.name}
                      {s.components.length > 0 && (
                        <span className="ml-2 text-xs text-slate-400">
                          ({s.components.length} EC)
                        </span>
                      )}
                    </td>
                    <td className="td text-xs text-slate-500 dark:text-slate-400">{s.ue}</td>
                    <td className="td">
                      <input
                        className="input !w-16 !py-1"
                        inputMode="decimal"
                        value={s.coefficient}
                        onChange={(e) =>
                          actions.updateSubject(s.id, {
                            coefficient: Number(e.target.value) || 1,
                          })
                        }
                      />
                    </td>
                    <td className="td">
                      <input
                        className="input !w-16 !py-1"
                        inputMode="decimal"
                        value={s.credits ?? ""}
                        onChange={(e) =>
                          actions.updateSubject(s.id, {
                            credits: e.target.value === "" ? null : Number(e.target.value) || 0,
                          })
                        }
                      />
                    </td>
                    <td className="td">
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={s.coefficientConfirmed ? "green" : "amber"}>
                          coef {s.coefficientConfirmed ? "confirmé" : "à confirmer"}
                        </Badge>
                        <Badge tone={s.creditsConfirmed ? "green" : "amber"}>
                          ECTS {s.creditsConfirmed ? "confirmé" : "à confirmer"}
                        </Badge>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}
