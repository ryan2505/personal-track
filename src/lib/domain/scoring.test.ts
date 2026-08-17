import { describe, expect, it } from "vitest";

import { makeHabit, makeLog, withRule } from "./fixtures";
import {
  computeCompletion,
  consistency,
  consistencyByCategory,
  consistencyOnDates,
  dailyScore,
  indexLogs,
  quotaProgress,
} from "./scoring";
import type { Habit } from "./types";

describe("computeCompletion — INVARIANT §5.4 : toujours dans [0, 1]", () => {
  const study: Habit = makeHabit({
    id: "study",
    type: "duration",
    unit: "min",
    targetValue: 60,
  });

  it("absence de log = 0", () => {
    expect(computeCompletion(study, undefined)).toBe(0);
  });

  it("booléen : tout ou rien", () => {
    const meditate = makeHabit({ id: "meditate" });
    expect(computeCompletion(meditate, makeLog("meditate", "2026-08-17"))).toBe(1);
    expect(
      computeCompletion(meditate, makeLog("meditate", "2026-08-17", { completed: false })),
    ).toBe(0);
  });

  it("partiel : ratio à la cible", () => {
    expect(computeCompletion(study, makeLog("study", "2026-08-17", { value: 30 }))).toBe(0.5);
  });

  it("le dépassement est stocké mais jamais scoré au-dessus de 100%", () => {
    expect(computeCompletion(study, makeLog("study", "2026-08-17", { value: 75 }))).toBe(1);
    expect(computeCompletion(study, makeLog("study", "2026-08-17", { value: 600 }))).toBe(1);
  });

  it("direction at_most : rester sous la cible vaut 100%", () => {
    const scroll = makeHabit({
      id: "scroll",
      type: "duration",
      direction: "at_most",
      targetValue: 30,
      unit: "min",
    });
    expect(computeCompletion(scroll, makeLog("scroll", "2026-08-17", { value: 20 }))).toBe(1);
    expect(computeCompletion(scroll, makeLog("scroll", "2026-08-17", { value: 30 }))).toBe(1);
    expect(computeCompletion(scroll, makeLog("scroll", "2026-08-17", { value: 45 }))).toBe(0.5);
    expect(computeCompletion(scroll, makeLog("scroll", "2026-08-17", { value: 300 }))).toBe(0);
  });
});

describe("dailyScore", () => {
  it("INVARIANT §5.4 — un jour sans habitude attendue vaut null, pas 0", () => {
    const habit = withRule("workout", { kind: "days_of_week", daysOfWeek: [1] });
    const result = dailyScore([habit], indexLogs([]), "2026-08-18"); // mardi
    expect(result.score).toBeNull();
    expect(result.expected).toBe(0);
  });

  it("INVARIANT §5.2 — les habitudes à quota n'entrent pas au dénominateur du jour", () => {
    const daily = withRule("read", { kind: "daily" });
    const gym = withRule("gym", { kind: "times_per_week", timesPerPeriod: 3 });

    const result = dailyScore([daily, gym], indexLogs([makeLog("read", "2026-08-17")]), "2026-08-17");
    expect(result.expected).toBe(1);
    expect(result.score).toBe(1); // et non 0.5
  });

  it("distingue le score du nombre d'habitudes complétées", () => {
    const habits = [
      makeHabit({ id: "a" }),
      makeHabit({ id: "b" }),
      makeHabit({ id: "c", type: "numeric", targetValue: 10 }),
    ];
    const logs = indexLogs([
      makeLog("a", "2026-08-17"),
      makeLog("b", "2026-08-17"),
      makeLog("c", "2026-08-17", { value: 5 }),
    ]);

    const result = dailyScore(habits, logs, "2026-08-17");
    expect(result.completed).toBe(2); // c n'est pas pleinement accomplie
    expect(result.score).toBeCloseTo((1 + 1 + 0.5) / 3);
  });

  it("respecte la pondération", () => {
    const habits = [makeHabit({ id: "a", weight: 3 }), makeHabit({ id: "b", weight: 1 })];
    const result = dailyScore(habits, indexLogs([makeLog("a", "2026-08-17")]), "2026-08-17");
    expect(result.score).toBe(0.75);
  });
});

describe("quotaProgress", () => {
  const gym = withRule("gym", { kind: "times_per_week", timesPerPeriod: 3 });

  it("compte les réalisations de la période courante", () => {
    const logs = indexLogs([makeLog("gym", "2026-08-17"), makeLog("gym", "2026-08-19")]);
    const progress = quotaProgress(gym, logs, "2026-08-20");
    expect(progress).toEqual({
      done: 2,
      target: 3,
      periodStart: "2026-08-17",
      periodEnd: "2026-08-23",
    });
  });

  it("ne compte pas les réalisations de la semaine précédente", () => {
    const logs = indexLogs([makeLog("gym", "2026-08-14")]); // vendredi d'avant
    expect(quotaProgress(gym, logs, "2026-08-17")?.done).toBe(0);
  });

  it("null pour une habitude à planning daté", () => {
    const daily = withRule("read", { kind: "daily" });
    expect(quotaProgress(daily, indexLogs([]), "2026-08-17")).toBeNull();
  });
});

describe("consistency — INVARIANT §5.4", () => {
  it("n'est PAS la moyenne des scores quotidiens", () => {
    // Lundi : 1 habitude attendue, ratée. Mardi : 8 attendues, toutes faites.
    const monday = withRule("monday-only", { kind: "days_of_week", daysOfWeek: [1] });
    const tuesdays: Habit[] = Array.from({ length: 8 }, (_, i) =>
      withRule(`tue-${i}`, { kind: "days_of_week", daysOfWeek: [2] }),
    );
    const logs = indexLogs(tuesdays.map((habit) => makeLog(habit.id, "2026-08-18")));

    const result = consistency([monday, ...tuesdays], logs, "2026-08-17", "2026-08-18");

    expect(result.numerator).toBe(8);
    expect(result.denominator).toBe(9);
    expect(result.score).toBeCloseTo(8 / 9); // 88,9% — surtout pas 50%
  });

  it("intègre les habitudes à quota", () => {
    const gym = withRule("gym", { kind: "times_per_week", timesPerPeriod: 3 });
    const logs = indexLogs([makeLog("gym", "2026-08-17"), makeLog("gym", "2026-08-19")]);

    const result = consistency([gym], logs, "2026-08-17", "2026-08-23");
    expect(result.denominator).toBe(3);
    expect(result.numerator).toBe(2);
  });

  it("plafonne le dépassement d'un quota", () => {
    const gym = withRule("gym", { kind: "times_per_week", timesPerPeriod: 2 });
    const logs = indexLogs(
      ["2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20"].map((date) =>
        makeLog("gym", date),
      ),
    );

    const result = consistency([gym], logs, "2026-08-17", "2026-08-23");
    expect(result.score).toBe(1);
    expect(result.numerator).toBe(2);
  });

  it("consistencyOnDates découpe sur un ensemble de dates non contigu", () => {
    // Habitude quotidienne : tenue les deux lundis, ratée le mardi.
    const daily = withRule("read", { kind: "daily" });
    const logs = indexLogs([makeLog("read", "2026-08-17"), makeLog("read", "2026-08-24")]);
    const mondays = ["2026-08-17", "2026-08-24"];

    expect(consistencyOnDates([daily], logs, mondays).score).toBe(1);
    expect(consistencyOnDates([daily], logs, ["2026-08-18"]).score).toBe(0);
  });

  it("consistencyOnDates exclut les habitudes à quota", () => {
    const gym = withRule("gym", { kind: "times_per_week", timesPerPeriod: 3 });
    const result = consistencyOnDates([gym], indexLogs([]), ["2026-08-17", "2026-08-18"]);
    expect(result.denominator).toBe(0);
    expect(result.score).toBeNull();
  });

  it("retourne null quand rien n'était attendu", () => {
    const monday = withRule("monday-only", { kind: "days_of_week", daysOfWeek: [1] });
    expect(consistency([monday], indexLogs([]), "2026-08-18", "2026-08-19").score).toBeNull();
  });

  it("découpe par domaine de vie avec la même formule", () => {
    const habits = [
      makeHabit({ id: "sell", category: "business" }),
      makeHabit({ id: "run", category: "fitness" }),
    ];
    const logs = indexLogs([makeLog("sell", "2026-08-17")]);

    const byCategory = consistencyByCategory(habits, logs, "2026-08-17", "2026-08-17");
    expect(byCategory.get("business")?.score).toBe(1);
    expect(byCategory.get("fitness")?.score).toBe(0);
  });
});
