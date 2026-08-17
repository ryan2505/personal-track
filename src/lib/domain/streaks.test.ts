import { describe, expect, it } from "vitest";

import { eachDay } from "./dates";
import { makeHabit, makeLog, withRule } from "./fixtures";
import { indexLogs } from "./scoring";
import { computeStreaks, habitStreak } from "./streaks";

const daily = makeHabit({ id: "read", startDate: "2026-08-01" });

function logsFor(dates: string[]) {
  return indexLogs(dates.map((date) => makeLog("read", date)));
}

describe("computeStreaks", () => {
  it("compte les jours consécutifs au-dessus du seuil", () => {
    const dates = eachDay("2026-08-11", "2026-08-17");
    const result = computeStreaks([daily], logsFor(dates), "2026-08-17");
    expect(result.current).toBe(7);
    expect(result.longest).toBe(7);
  });

  it("INVARIANT — la journée en cours ne casse jamais la série", () => {
    const dates = eachDay("2026-08-11", "2026-08-16"); // rien pour le 17
    const result = computeStreaks([daily], logsFor(dates), "2026-08-17");
    expect(result.current).toBe(6);
  });

  it("INVARIANT — les jours neutres sont sautés, pas cassants", () => {
    // Habitude planifiée uniquement les lundis : les autres jours sont neutres.
    const monday = withRule("monday", { kind: "days_of_week", daysOfWeek: [1] }, {
      startDate: "2026-08-03",
    });
    const logs = indexLogs(
      ["2026-08-03", "2026-08-10", "2026-08-17"].map((date) => makeLog("monday", date)),
    );
    const result = computeStreaks([monday], logs, "2026-08-17");
    expect(result.current).toBe(3);
  });

  it("un joker absorbe un jour raté isolé", () => {
    const dates = eachDay("2026-08-01", "2026-08-17").filter((date) => date !== "2026-08-10");
    const result = computeStreaks([daily], logsFor(dates), "2026-08-17");
    expect(result.freezesUsed).toBe(1);
    // 16 jours tenus, le jour gelé ne compte pas dans le total.
    expect(result.current).toBe(16);
  });

  it("deux ratés dans la même fenêtre de 7 jours cassent la série", () => {
    const dates = eachDay("2026-08-01", "2026-08-17").filter(
      (date) => date !== "2026-08-10" && date !== "2026-08-13",
    );
    const result = computeStreaks([daily], logsFor(dates), "2026-08-17");
    expect(result.current).toBe(4); // du 14 au 17
  });

  it("la série courante ne dépasse jamais le record", () => {
    const dates = eachDay("2026-08-01", "2026-08-17").filter((date) => date !== "2026-08-10");
    const result = computeStreaks([daily], logsFor(dates), "2026-08-17");
    expect(result.current).toBeLessThanOrEqual(result.longest);
  });

  it("retourne zéro sans habitude", () => {
    expect(computeStreaks([], indexLogs([]), "2026-08-17")).toEqual({
      current: 0,
      longest: 0,
      freezesUsed: 0,
    });
  });
});

describe("habitStreak", () => {
  it("INVARIANT — les jours non planifiés sont sautés", () => {
    const workout = withRule("workout", { kind: "days_of_week", daysOfWeek: [1, 3, 5] }, {
      startDate: "2026-08-03",
    });
    // Trois semaines pleines de lundi/mercredi/vendredi.
    const dates = [
      "2026-08-03", "2026-08-05", "2026-08-07",
      "2026-08-10", "2026-08-12", "2026-08-14",
      "2026-08-17", "2026-08-19", "2026-08-21",
    ];
    const logs = indexLogs(dates.map((date) => makeLog("workout", date)));

    expect(habitStreak(workout, logs, "2026-08-21")).toEqual({ current: 9, longest: 9 });
  });

  it("retourne null pour une habitude à quota", () => {
    const gym = withRule("gym", { kind: "times_per_week", timesPerPeriod: 3 });
    expect(habitStreak(gym, indexLogs([]), "2026-08-17")).toBeNull();
  });
});
