import { describe, expect, it } from "vitest";

import { endOfIsoWeek, startOfIsoWeek } from "./dates";
import { makeGoal, makeHabit, makeLog } from "./fixtures";
import {
  activeGoalsOn,
  deriveStatus,
  goalCompletionRate,
  goalPace,
  goalProgress,
  goalWindowForScope,
  resolveCurrentValue,
  sharedGoalProgress,
} from "./goals";
import type { Habit, HabitLog } from "./types";

const workout: Habit = makeHabit({ id: "workout", category: "fitness" });
const prospect: Habit = makeHabit({
  id: "prospect",
  category: "business",
  type: "counter",
  targetValue: 10,
  unit: "prospects",
});

const habitsById = new Map<string, Habit>([
  [workout.id, workout],
  [prospect.id, prospect],
]);

describe("resolveCurrentValue — le pari central du produit", () => {
  it("habit_count : l'objectif avance tout seul quand on coche l'habitude liée", () => {
    const goal = makeGoal({
      id: "sessions",
      source: "habit_count",
      habitIds: ["workout"],
      targetValue: 20,
    });
    const logs: HabitLog[] = [
      makeLog("workout", "2026-08-03"),
      makeLog("workout", "2026-08-05"),
      makeLog("workout", "2026-08-07", { completed: false }),
    ];

    expect(resolveCurrentValue(goal, logs, habitsById, "2026-08-17")).toBe(2);
  });

  it("habit_sum : somme les valeurs enregistrées", () => {
    const goal = makeGoal({
      id: "prospects",
      source: "habit_sum",
      habitIds: ["prospect"],
      targetValue: 200,
    });
    const logs: HabitLog[] = [
      makeLog("prospect", "2026-08-03", { value: 8 }),
      makeLog("prospect", "2026-08-04", { value: 12 }),
    ];

    expect(resolveCurrentValue(goal, logs, habitsById, "2026-08-17")).toBe(20);
  });

  it("ignore les logs hors fenêtre de l'objectif", () => {
    const goal = makeGoal({
      id: "sessions",
      source: "habit_count",
      habitIds: ["workout"],
      startDate: "2026-08-01",
      dueDate: "2026-08-31",
    });
    const logs = [makeLog("workout", "2026-07-31"), makeLog("workout", "2026-08-02")];

    expect(resolveCurrentValue(goal, logs, habitsById, "2026-08-17")).toBe(1);
  });

  it("manual : n'est jamais dérivé", () => {
    const goal = makeGoal({ id: "revenue", currentValue: 400_000, targetValue: 1_000_000 });
    expect(resolveCurrentValue(goal, [makeLog("workout", "2026-08-02")], habitsById, "2026-08-17")).toBe(
      400_000,
    );
  });
});

describe("goalProgress", () => {
  it("plafonne le ratio à 1", () => {
    const goal = makeGoal({ id: "clients", targetValue: 5 });
    expect(goalProgress(goal, 8).ratio).toBe(1);
  });

  it("fait avancer le statut automatiquement", () => {
    const goal = makeGoal({ id: "clients", targetValue: 5 });
    expect(goalProgress(goal, 0).status).toBe("not_started");
    expect(goalProgress(goal, 3).status).toBe("in_progress");
    expect(goalProgress(goal, 5).status).toBe("completed");
  });

  it("abandoned reste manuel", () => {
    expect(deriveStatus("abandoned", 1)).toBe("abandoned");
  });

  it("un objectif non mesurable n'a pas de ratio", () => {
    const goal = makeGoal({ id: "vision", targetValue: null });
    expect(goalProgress(goal, 0).ratio).toBeNull();
  });
});

describe("goalPace", () => {
  it("compare la progression au temps écoulé", () => {
    const goal = makeGoal({ id: "clients", startDate: "2026-08-01", dueDate: "2026-08-31" });
    // 17 jours écoulés sur 31 ≈ 55%.
    const behind = goalPace(goal, 0.4, "2026-08-17");
    expect(behind?.onTrack).toBe(false);
    expect(behind?.daysRemaining).toBe(14);

    const ahead = goalPace(goal, 0.8, "2026-08-17");
    expect(ahead?.onTrack).toBe(true);
  });

  it("null sans échéance", () => {
    const goal = makeGoal({ id: "long", dueDate: null });
    expect(goalPace(goal, 0.5, "2026-08-17")).toBeNull();
  });
});

describe("goalWindowForScope", () => {
  // 2026-08-17 est un lundi.
  it("cale un objectif hebdomadaire sur la semaine ISO, lundi au dimanche", () => {
    expect(goalWindowForScope("weekly", "2026-08-20")).toEqual({
      startDate: "2026-08-17",
      dueDate: "2026-08-23",
    });
  });

  it("utilise les mêmes bornes que la consistance hebdomadaire", () => {
    const window = goalWindowForScope("weekly", "2026-08-20");
    expect(window.startDate).toBe(startOfIsoWeek("2026-08-20"));
    expect(window.dueDate).toBe(endOfIsoWeek("2026-08-20"));
  });

  it("cale un objectif mensuel sur le mois", () => {
    expect(goalWindowForScope("monthly", "2026-02-10")).toEqual({
      startDate: "2026-02-01",
      dueDate: "2026-02-28",
    });
  });

  it("cale un objectif annuel sur l'année civile", () => {
    expect(goalWindowForScope("yearly", "2026-08-17")).toEqual({
      startDate: "2026-01-01",
      dueDate: "2026-12-31",
    });
  });

  it("laisse un objectif long terme sans échéance", () => {
    // Sans ça, « long terme » ne serait qu'un objectif daté qu'on repousse.
    expect(goalWindowForScope("long_term", "2026-08-17").dueDate).toBeNull();
  });
});

describe("goalCompletionRate", () => {
  it("compte les objectifs atteints et exclut les abandonnés du dénominateur", () => {
    const goals = [
      makeGoal({ id: "done", targetValue: 5, currentValue: 5 }),
      makeGoal({ id: "ongoing", targetValue: 5, currentValue: 2 }),
      makeGoal({ id: "dropped", targetValue: 5, currentValue: 0, status: "abandoned" }),
    ];

    const rate = goalCompletionRate(goals, [], habitsById, "2026-08-17");
    expect(rate).toEqual({ completed: 1, total: 2, ratio: 0.5 });
  });

  it("null sans aucun objectif exploitable", () => {
    expect(goalCompletionRate([], [], habitsById, "2026-08-17").ratio).toBeNull();
  });
});

describe("sharedGoalProgress", () => {
  it("additionne les contributions et garde le détail par personne", () => {
    const result = sharedGoalProgress(
      [
        { userId: "ryan", value: 2 },
        { userId: "grace", value: 1 },
      ],
      4,
    );
    expect(result.total).toBe(3);
    expect(result.ratio).toBe(0.75);
    expect(result.byUser.get("ryan")).toBe(2);
  });
});

describe("activeGoalsOn", () => {
  it("trie par urgence et exclut les abandonnés", () => {
    const goals = [
      makeGoal({ id: "late", dueDate: "2026-08-31" }),
      makeGoal({ id: "soon", dueDate: "2026-08-20" }),
      makeGoal({ id: "dropped", status: "abandoned" }),
      makeGoal({ id: "someday", dueDate: null, scope: "long_term" }),
    ];

    expect(activeGoalsOn(goals, "2026-08-17").map((goal) => goal.id)).toEqual([
      "soon",
      "late",
      "someday",
    ]);
  });
});
