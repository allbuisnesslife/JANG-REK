import { describe, expect, it } from "vitest";
import {
  aggregate,
  cumulativeSeries,
  normalize,
  round2,
  subjectAverage,
  subjectStats,
  weightedAverage,
} from "./calc";
import type { Evaluation, Subject, SubjectRule } from "../types";

const baseSubject: Subject = {
  id: "MTH1301",
  code: "MTH 1301",
  name: "Analyse 3, probabilités-statistiques",
  semester: "S3",
  ue: "MTH 1301",
  ueConfirmed: false,
  components: [],
  coefficient: 1,
  coefficientConfirmed: false,
  credits: null,
  creditsConfirmed: false,
  disabled: false,
};

let counter = 0;
const ev = (
  score: number,
  maxScore: number,
  coefficient: number,
  date: string,
  ruleGroup?: "cc" | "examen"
): Evaluation => ({
  id: `e${++counter}`,
  subjectId: "MTH1301",
  semester: "S3",
  name: `Ev ${counter}`,
  type: "devoir",
  score,
  maxScore,
  coefficient,
  date,
  ruleGroup,
});

describe("normalize — conversion sur 20", () => {
  it("convertit une note sur 10", () => {
    expect(normalize(8, 10)).toBe(16);
  });
  it("convertit une note sur 25", () => {
    expect(normalize(18, 25)).toBeCloseTo(14.4, 5);
  });
  it("laisse une note sur 20 inchangée", () => {
    expect(normalize(15, 20)).toBe(15);
  });
  it("rejette un note maximal invalide", () => {
    expect(normalize(15, 0)).toBeNull();
    expect(normalize(15, -5)).toBeNull();
  });
  it("rejette une note non numérique", () => {
    expect(normalize(NaN, 20)).toBeNull();
  });
});

describe("weightedAverage — moyenne pondérée", () => {
  it("calcule somme(v×p)/somme(p)", () => {
    expect(weightedAverage([
      { value: 12, weight: 1 },
      { value: 16, weight: 2 },
    ])).toBe(14.67);
  });
  it("ignore les poids nuls ou négatifs", () => {
    expect(weightedAverage([{ value: 10, weight: 0 }, { value: 14, weight: 2 }])).toBe(14);
  });
  it("renvoie null sans pondération", () => {
    expect(weightedAverage([])).toBeNull();
  });
});

describe("subjectAverage — règles et confiance", () => {
  it("données insuffisantes sans évaluation", () => {
    const r = subjectAverage([], undefined, 2);
    expect(r.value).toBeNull();
    expect(r.confidence).toBe("insufficient");
    expect(r.message).toMatch(/données insuffisantes/i);
  });

  it("moyenne pondérée provisoire sans règle officielle", () => {
    const r = subjectAverage([ev(10, 20, 1, "2026-01-01"), ev(16, 20, 2, "2026-01-02")], undefined, 2);
    expect(r.value).toBe(14);
    expect(r.confidence).toBe("provisional");
    expect(r.message).toMatch(/provisoire/i);
  });

  it("normalise les notes dont la note maximale diffère de 20", () => {
    // 8/10 -> 16/20, pondération 1 ; 15/20 pondération 1 => 15,5
    const r = subjectAverage([ev(8, 10, 1, "2026-01-01"), ev(15, 20, 1, "2026-01-02")], undefined, 2);
    expect(r.value).toBe(15.5);
  });

  it("applique une règle CC/Examen confirmée", () => {
    const rule: SubjectRule = { subjectId: "MTH1301", enabled: true, ccWeight: 0.4, examWeight: 0.6, examOnly: false };
    const r = subjectAverage(
      [ev(16, 20, 1, "2026-01-01", "cc"), ev(12, 20, 1, "2026-01-02", "examen")],
      rule,
      2
    );
    expect(r.value).toBe(13.6); // 16×0.4 + 12×0.6
    expect(r.confidence).toBe("confirmed");
  });

  it("reste provisoire si l'examen n'est pas encore reçu", () => {
    const rule: SubjectRule = { subjectId: "MTH1301", enabled: true, ccWeight: 0.4, examWeight: 0.6, examOnly: false };
    const r = subjectAverage([ev(16, 20, 1, "2026-01-01", "cc")], rule, 2);
    expect(r.value).toBe(16);
    expect(r.confidence).toBe("provisional");
    expect(r.message).toMatch(/examen final n'est pas encore reçu/i);
  });

  it("module sans CC : moyenne = examen seul (confirmée)", () => {
    const rule: SubjectRule = { subjectId: "MTH1301", enabled: true, ccWeight: 0.4, examWeight: 0.6, examOnly: true };
    const r = subjectAverage(
      [ev(10, 20, 1, "2026-01-01", "cc"), ev(14, 20, 1, "2026-01-02", "examen")],
      rule,
      2
    );
    expect(r.value).toBe(14);
    expect(r.confidence).toBe("confirmed");
    expect(r.message).toMatch(/sans contrôle continu/i);
  });

  it("module sans CC sans étiquette : toutes les notes comptent comme examen", () => {
    const rule: SubjectRule = { subjectId: "MTH1301", enabled: true, ccWeight: 0.4, examWeight: 0.6, examOnly: true };
    const r = subjectAverage([ev(12, 20, 1, "2026-01-01"), ev(16, 20, 1, "2026-01-02")], rule, 2);
    expect(r.value).toBe(14);
    expect(r.confidence).toBe("confirmed");
  });
});

describe("subjectAverage — UE multi-EC", () => {
  const comps = ["Physique de la télédétection", "Mécanique spatiale", "Traitement du signal"];

  function evc(score: number, component: string): Evaluation {
    return { ...ev(score, 20, 1, "2026-03-01"), component };
  }

  it("une seule note d'EC → provisoire, il manque les autres", () => {
    const r = subjectAverage([evc(14, "Physique de la télédétection")], undefined, 2, comps);
    expect(r.value).toBe(14);
    expect(r.confidence).toBe("provisional");
    expect(r.message).toMatch(/1\/3 EC/);
    expect(r.message).toMatch(/Mécanique spatiale/);
    expect(r.message).toMatch(/Traitement du signal/);
  });

  it("tous les EC notés → moyenne de l'UE (poids égaux entre EC)", () => {
    const r = subjectAverage(
      [evc(10, "Physique de la télédétection"), evc(16, "Mécanique spatiale"), evc(14, "Traitement du signal")],
      undefined,
      2,
      comps
    );
    expect(r.value).toBe(13.33); // (10+16+14)/3
    expect(r.confidence).toBe("provisional");
    expect(r.message).toMatch(/provisoire/i);
  });

  it("aucune note → insuffisant avec la liste des EC", () => {
    const r = subjectAverage([], undefined, 2, comps);
    expect(r.value).toBeNull();
    expect(r.confidence).toBe("insufficient");
    expect(r.message).toMatch(/éléments constitutifs/i);
  });

  it("règle examen seul s'applique à l'intérieur de chaque EC", () => {
    const rule: SubjectRule = { subjectId: "GMT1305", enabled: true, ccWeight: 0.4, examWeight: 0.6, examOnly: true };
    const r = subjectAverage(
      [
        { ...evc(8, "Physique de la télédétection"), ruleGroup: "cc" },
        { ...evc(12, "Physique de la télédétection"), ruleGroup: "examen" },
        evc(18, "Mécanique spatiale"),
        evc(10, "Traitement du signal"),
      ],
      rule,
      2,
      comps
    );
    // Physique → 12 (examen seul) ; UE = (12+18+10)/3 = 13.33
    expect(r.value).toBe(13.33);
    expect(r.confidence).toBe("confirmed");
  });
});

describe("aggregate — UE / semestre / année", () => {
  it("pondère par les coefficients de matière", () => {
    const r = aggregate(
      [
        { value: 12, coefficient: 1, confirmed: false },
        { value: 16, coefficient: 3, confirmed: false },
      ],
      false
    );
    expect(r.value).toBe(15);
    expect(r.confidence).toBe("provisional");
  });

  it("reste provisoire si les coefficients ne sont pas confirmés", () => {
    const r = aggregate([{ value: 14, coefficient: 1, confirmed: true }], false);
    expect(r.confidence).toBe("provisional");
  });

  it("devient confirmé si tout est confirmé", () => {
    const r = aggregate([{ value: 14, coefficient: 1, confirmed: true }], true);
    expect(r.confidence).toBe("confirmed");
  });

  it("aucune matière évaluée → insuffisant", () => {
    expect(aggregate([{ value: null, coefficient: 1, confirmed: false }], false).value).toBeNull();
  });
});

describe("subjectStats — meilleures / plus faibles notes", () => {
  it("fournit meilleure, plus faible et écart dernière/précédente", () => {
    const evals = [ev(10, 20, 1, "2026-01-01"), ev(20, 20, 1, "2026-01-02"), ev(8, 20, 1, "2026-01-03")];
    const st = subjectStats(baseSubject, evals, undefined, 2);
    expect(st.best).toBe(20);
    expect(st.worst).toBe(8);
    expect(st.latest).toBe(8);
    expect(st.previousLatest).toBe(20);
    expect(st.delta).toBe(-12);
    expect(st.average.count).toBe(3);
  });

  it("gère une matière sans aucune évaluation", () => {
    const st = subjectStats(baseSubject, [], undefined, 2);
    expect(st.average.value).toBeNull();
    expect(st.best).toBeNull();
    expect(st.delta).toBeNull();
  });
});

describe("cumulativeSeries — courbe d'évolution", () => {
  it("produit une moyenne cumulée croissante dans le temps", () => {
    const s = cumulativeSeries([ev(10, 20, 1, "2026-01-01"), ev(20, 20, 1, "2026-01-02")]);
    expect(s).toHaveLength(2);
    expect(s[0].average).toBe(10);
    expect(s[1].average).toBe(15);
  });
});

describe("round2", () => {
  it("arrondit à deux décimales", () => {
    expect(round2(14.666666)).toBe(14.67);
    expect(round2(15)).toBe(15);
  });
});
