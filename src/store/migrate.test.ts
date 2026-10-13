import { describe, expect, it } from "vitest";
import { buildSubjects, OFFICIAL_TOTALS } from "../data/maquette";
import { migrateSubjects } from "./store";
import type { Subject } from "../types";

const official = buildSubjects();

function unconfirmed(subjectId: string): Subject {
  const base = official.find((s) => s.id === subjectId)!;
  return {
    ...base,
    coefficient: 1,
    coefficientConfirmed: false,
    credits: null,
    creditsConfirmed: false,
    ueConfirmed: false,
  };
}

describe("maquette officielle L2", () => {
  it("13 UE (7 en S3, 6 en S4)", () => {
    expect(official).toHaveLength(13);
    expect(official.filter((s) => s.semester === "S3")).toHaveLength(7);
    expect(official.filter((s) => s.semester === "S4")).toHaveLength(6);
  });

  it("tous les coefficients et crédits sont confirmés", () => {
    for (const s of official) {
      expect(s.coefficientConfirmed).toBe(true);
      expect(s.creditsConfirmed).toBe(true);
      expect(s.ueConfirmed).toBe(true);
      expect(s.coefficient).toBeGreaterThan(1);
      expect(s.credits).toBeGreaterThan(0);
    }
  });

  it("totaux S3 et S4 conformes à la maquette", () => {
    for (const sem of ["S3", "S4"] as const) {
      const list = official.filter((s) => s.semester === sem);
      const coef = list.reduce((sum, s) => sum + s.coefficient, 0);
      const credits = list.reduce((sum, s) => sum + (s.credits ?? 0), 0);
      expect(coef).toBe(OFFICIAL_TOTALS[sem].coefficient);
      expect(credits).toBe(OFFICIAL_TOTALS[sem].credits);
    }
  });
});

describe("migrateSubjects", () => {
  it("applique les valeurs officielles aux matières non confirmées", () => {
    const stored = [unconfirmed("MTH1301")];
    const m = migrateSubjects(stored, official).find((s) => s.id === "MTH1301")!;
    const off = official.find((s) => s.id === "MTH1301")!;
    expect(m.coefficient).toBe(off.coefficient);
    expect(m.credits).toBe(off.credits);
    expect(m.coefficientConfirmed).toBe(true);
    expect(m.creditsConfirmed).toBe(true);
  });

  it("conserve les valeurs déjà confirmées par l'utilisateur", () => {
    const base = official.find((s) => s.id === "MTH1301")!;
    const stored: Subject[] = [{ ...base, coefficient: 9, credits: 99 }];
    const m = migrateSubjects(stored, official).find((s) => s.id === "MTH1301")!;
    expect(m.coefficient).toBe(9);
    expect(m.credits).toBe(99);
  });

  it("ajoute les UE officielles absentes de l'état stocké", () => {
    const stored = official.filter((s) => s.id !== "GMT1403").map((s) => ({ ...s }));
    const next = migrateSubjects(stored, official);
    expect(next).toHaveLength(official.length);
    expect(next.find((s) => s.id === "GMT1403")).toBeDefined();
  });
});
