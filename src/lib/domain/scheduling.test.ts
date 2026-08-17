import { describe, expect, it } from "vitest";

import { makeHabit, withRule } from "./fixtures";
import { expectedOn, isScheduledOn, quotaExpectations, quotaHabitsOn } from "./scheduling";

// 2026-08-17 est un lundi.

describe("isScheduledOn", () => {
  it("planning quotidien : attendu tous les jours de la fenêtre", () => {
    const habit = withRule("daily", { kind: "daily" });
    expect(isScheduledOn(habit, "2026-08-17")).toBe(true);
    expect(isScheduledOn(habit, "2026-08-18")).toBe(true);
  });

  it("jours de semaine : uniquement les jours ISO listés", () => {
    const habit = withRule("workout", { kind: "days_of_week", daysOfWeek: [1, 3, 5] });
    expect(isScheduledOn(habit, "2026-08-17")).toBe(true); // lundi
    expect(isScheduledOn(habit, "2026-08-18")).toBe(false); // mardi
    expect(isScheduledOn(habit, "2026-08-19")).toBe(true); // mercredi
    expect(isScheduledOn(habit, "2026-08-23")).toBe(false); // dimanche
  });

  it("jours du mois : un 31 demandé retombe sur le dernier jour des mois plus courts", () => {
    const habit = withRule("invoice", { kind: "days_of_month", daysOfMonth: [31] });
    expect(isScheduledOn(habit, "2026-08-31")).toBe(true);
    expect(isScheduledOn(habit, "2026-02-28")).toBe(true);
    expect(isScheduledOn(habit, "2026-02-27")).toBe(false);
  });

  it("hors fenêtre d'activité : jamais attendu", () => {
    const habit = makeHabit({ id: "h", startDate: "2026-08-10", endDate: "2026-08-20" });
    expect(isScheduledOn(habit, "2026-08-09")).toBe(false);
    expect(isScheduledOn(habit, "2026-08-15")).toBe(true);
    expect(isScheduledOn(habit, "2026-08-21")).toBe(false);
  });

  it("INVARIANT §5.2 — une habitude à quota n'est attendue aucun jour précis", () => {
    const habit = withRule("gym", { kind: "times_per_week", timesPerPeriod: 3 });
    expect(isScheduledOn(habit, "2026-08-17")).toBe(false);
    expect(isScheduledOn(habit, "2026-08-18")).toBe(false);
    expect(expectedOn([habit], "2026-08-17")).toHaveLength(0);
    expect(quotaHabitsOn([habit], "2026-08-17")).toHaveLength(1);
  });
});

describe("INVARIANT §5.3 — l'historique n'est pas réécrit", () => {
  const habit = makeHabit({
    id: "workout",
    startDate: "2026-01-01",
    schedules: [
      // Ordre indifférent : la recherche se fait par fenêtre de validité.
      {
        rule: { kind: "days_of_week", daysOfWeek: [1, 3, 5] },
        effectiveFrom: "2026-01-01",
        effectiveTo: "2026-07-31",
      },
      { rule: { kind: "daily" }, effectiveFrom: "2026-08-01", effectiveTo: null },
    ],
  });

  it("un jour passé est évalué avec la règle en vigueur ce jour-là", () => {
    // Mardi 14 juillet : l'ancienne règle ne le planifiait pas.
    expect(isScheduledOn(habit, "2026-07-14")).toBe(false);
    // Mardi 18 août : la nouvelle règle s'applique.
    expect(isScheduledOn(habit, "2026-08-18")).toBe(true);
  });
});

describe("quotaExpectations", () => {
  const gym = withRule("gym", { kind: "times_per_week", timesPerPeriod: 3 });

  it("une semaine complète attend la cible entière", () => {
    const expectations = quotaExpectations(gym, "2026-08-17", "2026-08-23");
    expect(expectations).toHaveLength(1);
    expect(expectations[0]?.target).toBe(3);
  });

  it("une semaine partielle proratise — pas de pessimisme dès le lundi", () => {
    const expectations = quotaExpectations(gym, "2026-08-17", "2026-08-19");
    expect(expectations).toHaveLength(1);
    expect(expectations[0]?.target).toBeCloseTo((3 * 3) / 7);
  });

  it("découpe correctement plusieurs semaines", () => {
    const expectations = quotaExpectations(gym, "2026-08-17", "2026-08-30");
    expect(expectations).toHaveLength(2);
    expect(expectations[0]?.periodEnd).toBe("2026-08-23");
    expect(expectations[1]?.periodStart).toBe("2026-08-24");
  });

  it("ignore les jours sans quota en vigueur", () => {
    const daily = withRule("read", { kind: "daily" });
    expect(quotaExpectations(daily, "2026-08-17", "2026-08-23")).toHaveLength(0);
  });

  it("gère les quotas mensuels", () => {
    const books = withRule("books", { kind: "times_per_month", timesPerPeriod: 2 });
    const expectations = quotaExpectations(books, "2026-08-01", "2026-08-31");
    expect(expectations).toHaveLength(1);
    expect(expectations[0]?.target).toBe(2);
  });
});
