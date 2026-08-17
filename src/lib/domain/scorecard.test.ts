import { describe, expect, it } from "vitest";

import { makeGoal, makeHabit, makeLog, withRule } from "./fixtures";
import { monthlyScorecard, scorecardVerdict } from "./scorecard";
import type { Goal, Habit, HabitLog } from "./types";

const workout: Habit = makeHabit({
  id: "workout",
  category: "fitness",
  startDate: "2026-08-01",
});

describe("monthlyScorecard — objectifs", () => {
  const goal: Goal = makeGoal({
    id: "sessions",
    source: "habit_count",
    habitIds: ["workout"],
    targetValue: 20,
    startDate: "2026-08-01",
    dueDate: "2026-08-31",
  });

  const logs: HabitLog[] = ["2026-08-03", "2026-08-05", "2026-08-07"].map((date) =>
    makeLog("workout", date),
  );

  it("chiffre le réalisé et le déficit", () => {
    const card = monthlyScorecard([goal], [workout], logs, "2026-08-17", "2026-08-17");
    const row = card.goals[0];
    expect(row?.achieved).toBe(3);
    expect(row?.target).toBe(20);
    expect(row?.deficit).toBe(17);
  });

  it("ramène le déficit à zéro quand la cible est dépassée, jamais à un négatif", () => {
    const easy = makeGoal({ ...goal, id: "easy", targetValue: 2 });
    const card = monthlyScorecard([easy], [workout], logs, "2026-08-17", "2026-08-17");
    expect(card.goals[0]?.deficit).toBe(0);
    expect(card.goals[0]?.reached).toBe(true);
  });

  it("INVARIANT — un mois passé ne compte pas les jours postérieurs", () => {
    // Le mois analysé est juillet ; les logs d'août ne doivent rien y ajouter.
    const july = makeGoal({
      ...goal,
      id: "july",
      startDate: "2026-07-01",
      dueDate: "2026-07-31",
    });
    const card = monthlyScorecard([july], [workout], logs, "2026-07-15", "2026-08-17");
    expect(card.goals[0]?.achieved).toBe(0);
  });

  it("exclut les objectifs abandonnés et ceux hors du mois", () => {
    const dropped = makeGoal({ ...goal, id: "dropped", status: "abandoned" });
    const september = makeGoal({
      ...goal,
      id: "september",
      startDate: "2026-09-01",
      dueDate: "2026-09-30",
    });

    const card = monthlyScorecard(
      [goal, dropped, september],
      [workout],
      logs,
      "2026-08-17",
      "2026-08-17",
    );
    expect(card.goals.map((row) => row.goal.id)).toEqual(["sessions"]);
  });

  it("signale un objectif qui déborde du mois", () => {
    const yearly = makeGoal({
      ...goal,
      id: "yearly",
      scope: "yearly",
      dueDate: "2026-12-31",
    });
    const card = monthlyScorecard([yearly], [workout], logs, "2026-08-17", "2026-08-17");
    expect(card.goals[0]?.spansBeyondMonth).toBe(true);
  });

  it("ne compte que les objectifs mesurables au dénominateur", () => {
    const vague = makeGoal({ ...goal, id: "vague", targetValue: null, source: "manual" });
    const card = monthlyScorecard([goal, vague], [workout], logs, "2026-08-17", "2026-08-17");
    expect(card.goalsTracked).toBe(1);
  });
});

describe("monthlyScorecard — habitudes", () => {
  it("compte les occurrences tenues, attendues, et le déficit", () => {
    const daily = withRule("read", { kind: "daily" }, { startDate: "2026-08-01" });
    const logs = ["2026-08-01", "2026-08-02", "2026-08-03"].map((date) => makeLog("read", date));

    // Mois en cours arrêté au 5 : cinq occurrences attendues, trois tenues.
    const card = monthlyScorecard([], [daily], logs, "2026-08-05", "2026-08-05");
    expect(card.habitsExpected).toBe(5);
    expect(card.habitsAchieved).toBe(3);
    expect(card.habitsDeficit).toBe(2);
    expect(card.consistency).toBeCloseTo(3 / 5);
  });

  it("INVARIANT — un mois en cours s'arrête à aujourd'hui, pas à la fin du mois", () => {
    const daily = withRule("read", { kind: "daily" }, { startDate: "2026-08-01" });
    const card = monthlyScorecard([], [daily], [], "2026-08-05", "2026-08-05");
    expect(card.asOf).toBe("2026-08-05");
    expect(card.inProgress).toBe(true);
    // Sinon les 26 jours restants compteraient comme autant d'échecs.
    expect(card.habitsExpected).toBe(5);
  });

  it("un mois passé est évalué en entier", () => {
    const daily = withRule("read", { kind: "daily" }, { startDate: "2026-07-01" });
    const card = monthlyScorecard([], [daily], [], "2026-07-10", "2026-08-17");
    expect(card.asOf).toBe("2026-07-31");
    expect(card.inProgress).toBe(false);
    expect(card.habitsExpected).toBe(31);
  });
});

describe("scorecardVerdict", () => {
  // Fenêtre calée sur juillet : un objectif d'août serait exclu du bilan de juillet.
  const july = { startDate: "2026-07-01", dueDate: "2026-07-31" };
  const reached = makeGoal({ id: "done", targetValue: 2, currentValue: 2, ...july });
  const missed = makeGoal({ id: "missed", targetValue: 10, currentValue: 1, ...july });

  it("félicite quand tous les objectifs sont atteints sur un mois terminé", () => {
    const card = monthlyScorecard([reached], [], [], "2026-07-15", "2026-08-17");
    expect(scorecardVerdict(card).tone).toBe("celebrate");
  });

  it("ne félicite pas un mois moyen — sinon la félicitation ne vaut rien", () => {
    const card = monthlyScorecard([missed], [], [], "2026-07-15", "2026-08-17");
    expect(scorecardVerdict(card).tone).toBe("neutral");
  });

  it("reste neutre quand il n'y a rien à mesurer", () => {
    const card = monthlyScorecard([], [], [], "2026-08-17", "2026-08-17");
    expect(card.allGoalsReached).toBe(false);
    expect(scorecardVerdict(card).tone).toBe("neutral");
  });
});
