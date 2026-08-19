import { describe, expect, it } from "vitest";

import { makeEntry, makeGoal, makeHabit, makeLog, makeMetric, withRule } from "./fixtures";
import {
  monthlyScorecard,
  monthlyTrend,
  monthsOfYear,
  scorecardVerdict,
  type ScorecardInput,
} from "./scorecard";
import type { Goal, Habit, HabitLog } from "./types";

const workout: Habit = makeHabit({
  id: "workout",
  category: "fitness",
  startDate: "2026-08-01",
});

/** Les listes non fournies sont vides : chaque test ne cite que ce qu'il éprouve. */
function card(input: Partial<ScorecardInput> & { month: string; today: string }) {
  return monthlyScorecard({
    goals: [],
    habits: [],
    logs: [],
    metrics: [],
    metricEntries: [],
    ...input,
  });
}

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
    const result = card({
      goals: [goal],
      habits: [workout],
      logs,
      month: "2026-08-17",
      today: "2026-08-17",
    });
    const row = result.goals[0];
    expect(row?.achieved).toBe(3);
    expect(row?.target).toBe(20);
    expect(row?.deficit).toBe(17);
  });

  it("ramène le déficit à zéro quand la cible est dépassée, jamais à un négatif", () => {
    const easy = makeGoal({ ...goal, id: "easy", targetValue: 2 });
    const result = card({
      goals: [easy],
      habits: [workout],
      logs,
      month: "2026-08-17",
      today: "2026-08-17",
    });
    expect(result.goals[0]?.deficit).toBe(0);
    expect(result.goals[0]?.reached).toBe(true);
  });

  it("INVARIANT — un mois passé ne compte pas les jours postérieurs", () => {
    // Le mois analysé est juillet ; les logs d'août ne doivent rien y ajouter.
    const july = makeGoal({
      ...goal,
      id: "july",
      startDate: "2026-07-01",
      dueDate: "2026-07-31",
    });
    const result = card({
      goals: [july],
      habits: [workout],
      logs,
      month: "2026-07-15",
      today: "2026-08-17",
    });
    expect(result.goals[0]?.achieved).toBe(0);
  });

  it("exclut les objectifs abandonnés et ceux hors du mois", () => {
    const dropped = makeGoal({ ...goal, id: "dropped", status: "abandoned" });
    const september = makeGoal({
      ...goal,
      id: "september",
      startDate: "2026-09-01",
      dueDate: "2026-09-30",
    });

    const result = card({
      goals: [goal, dropped, september],
      habits: [workout],
      logs,
      month: "2026-08-17",
      today: "2026-08-17",
    });
    expect(result.goals.map((row) => row.goal.id)).toEqual(["sessions"]);
  });

  it("signale un objectif qui déborde du mois", () => {
    const yearly = makeGoal({ ...goal, id: "yearly", scope: "yearly", dueDate: "2026-12-31" });
    const result = card({
      goals: [yearly],
      habits: [workout],
      logs,
      month: "2026-08-17",
      today: "2026-08-17",
    });
    expect(result.goals[0]?.spansBeyondMonth).toBe(true);
  });

  it("ne compte que les objectifs mesurables au dénominateur", () => {
    const vague = makeGoal({ ...goal, id: "vague", targetValue: null, source: "manual" });
    const result = card({
      goals: [goal, vague],
      habits: [workout],
      logs,
      month: "2026-08-17",
      today: "2026-08-17",
    });
    expect(result.goalsTracked).toBe(1);
  });

  it("un objectif alimenté par une métrique lit les entrées, sans stocker le chiffre", () => {
    const revenue = makeGoal({
      id: "revenue",
      source: "metric",
      metricId: "ca",
      targetValue: 1_000_000,
      // Objectif annuel : il agrège plusieurs mois de la métrique.
      scope: "yearly",
      startDate: "2026-01-01",
      dueDate: "2026-12-31",
      // Volontairement faux : `currentValue` doit être ignoré pour une source dérivée.
      currentValue: 999,
    });

    const result = card({
      goals: [revenue],
      metrics: [makeMetric({ id: "ca", kind: "result" })],
      metricEntries: [
        makeEntry("ca", "2026-07", { target: 300_000, actual: 210_000 }),
        makeEntry("ca", "2026-08", { target: 300_000, actual: 250_000 }),
        // Postérieur au mois analysé : ne doit pas compter.
        makeEntry("ca", "2026-09", { target: 300_000, actual: 310_000 }),
      ],
      month: "2026-08-17",
      today: "2026-08-17",
    });

    expect(result.goals[0]?.achieved).toBe(460_000);
  });
});

describe("monthlyScorecard — habitudes", () => {
  it("compte les occurrences tenues, attendues, et le déficit", () => {
    const daily = withRule("read", { kind: "daily" }, { startDate: "2026-08-01" });
    const logs = ["2026-08-01", "2026-08-02", "2026-08-03"].map((date) => makeLog("read", date));

    // Mois en cours arrêté au 5 : cinq occurrences attendues, trois tenues.
    const result = card({ habits: [daily], logs, month: "2026-08-05", today: "2026-08-05" });
    expect(result.habitsExpected).toBe(5);
    expect(result.habitsAchieved).toBe(3);
    expect(result.habitsDeficit).toBe(2);
    expect(result.consistency).toBeCloseTo(3 / 5);
  });

  it("INVARIANT — un mois en cours s'arrête à aujourd'hui, pas à la fin du mois", () => {
    const daily = withRule("read", { kind: "daily" }, { startDate: "2026-08-01" });
    const result = card({ habits: [daily], month: "2026-08-05", today: "2026-08-05" });
    expect(result.asOf).toBe("2026-08-05");
    expect(result.inProgress).toBe(true);
    // Sinon les 26 jours restants compteraient comme autant d'échecs.
    expect(result.habitsExpected).toBe(5);
  });

  it("un mois passé est évalué en entier", () => {
    const daily = withRule("read", { kind: "daily" }, { startDate: "2026-07-01" });
    const result = card({ habits: [daily], month: "2026-07-10", today: "2026-08-17" });
    expect(result.asOf).toBe("2026-07-31");
    expect(result.inProgress).toBe(false);
    expect(result.habitsExpected).toBe(31);
  });
});

describe("monthlyScorecard — les trois couches", () => {
  const metrics = [
    makeMetric({ id: "contents", kind: "output" }),
    makeMetric({ id: "prospects", kind: "output" }),
    makeMetric({ id: "revenue", kind: "result", valueType: "currency" }),
  ];

  const entries = [
    makeEntry("contents", "2026-08", { target: 20, actual: 15 }),
    makeEntry("prospects", "2026-08", { target: 50, actual: 35 }),
    makeEntry("revenue", "2026-08", { target: 300_000, actual: 250_000 }),
  ];

  it("sépare exécution et impact, sans jamais les mélanger", () => {
    const result = card({ metrics, metricEntries: entries, month: "2026-08-17", today: "2026-08-17" });

    // (15/20 + 35/50) / 2
    expect(result.execution.score).toBeCloseTo(0.725);
    expect(result.impact.score).toBeCloseTo(250 / 300);
    expect(result.execution.tracked).toBe(2);
    expect(result.impact.tracked).toBe(1);
  });

  it("les trois couches sont indépendantes : une fondation tenue n'achète pas un impact", () => {
    const daily = withRule("read", { kind: "daily" }, { startDate: "2026-08-01" });
    const logs = ["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05"].map((date) =>
      makeLog("read", date),
    );

    const result = card({
      habits: [daily],
      logs,
      metrics: [makeMetric({ id: "revenue", kind: "result" })],
      metricEntries: [makeEntry("revenue", "2026-08", { target: 100, actual: 20 })],
      month: "2026-08-05",
      today: "2026-08-05",
    });

    expect(result.consistency).toBe(1);
    expect(result.impact.score).toBeCloseTo(0.2);
  });

  it("un mois sans métrique laisse les deux couches neutres, jamais à zéro", () => {
    const result = card({ month: "2026-08-17", today: "2026-08-17" });
    expect(result.execution.score).toBeNull();
    expect(result.impact.score).toBeNull();
  });

  it("ne lit que le mois analysé", () => {
    const result = card({
      metrics,
      metricEntries: [
        ...entries,
        makeEntry("contents", "2026-09", { target: 20, actual: 20 }),
      ],
      month: "2026-09-10",
      today: "2026-09-10",
    });

    expect(result.period).toBe("2026-09");
    expect(result.execution.tracked).toBe(1);
    expect(result.execution.score).toBe(1);
  });
});

describe("scorecard par domaine de vie", () => {
  const habits = [
    withRule("pray", { kind: "daily" }, { category: "spiritual", startDate: "2026-08-01" }),
    withRule("call", { kind: "daily" }, { category: "business", startDate: "2026-08-01" }),
  ];
  // Prière tenue 5 jours sur 5, prospection 1 jour sur 5.
  const logs = [
    ...["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05"].map((d) =>
      makeLog("pray", d),
    ),
    makeLog("call", "2026-08-01"),
  ];
  const metrics = [
    makeMetric({ id: "contents", kind: "output", category: "business" }),
    makeMetric({ id: "revenue", kind: "result", category: "business" }),
    makeMetric({ id: "chapters", kind: "output", category: "spiritual" }),
  ];
  const entries = [
    makeEntry("contents", "2026-08", { target: 20, actual: 10 }),
    makeEntry("revenue", "2026-08", { target: 300, actual: 300 }),
    makeEntry("chapters", "2026-08", { target: 4, actual: 4 }),
  ];

  const result = card({
    habits,
    logs,
    metrics,
    metricEntries: entries,
    month: "2026-08-05",
    today: "2026-08-05",
  });

  it("donne à chaque domaine ses trois couches", () => {
    const business = result.areas.find((area) => area.category === "business");
    const spiritual = result.areas.find((area) => area.category === "spiritual");

    expect(business?.foundation).toBeCloseTo(0.2);
    expect(business?.execution.score).toBe(0.5);
    expect(business?.impact.score).toBe(1);

    expect(spiritual?.foundation).toBe(1);
    expect(spiritual?.execution.score).toBe(1);
    expect(spiritual?.impact.score).toBeNull();
  });

  it("INVARIANT — le découpage ne recalcule rien : la somme des lignes est le tout", () => {
    const split = result.areas.flatMap((area) => area.execution.rows.map((r) => r.metric.id));
    expect(split.sort()).toEqual(result.execution.rows.map((r) => r.metric.id).sort());
  });

  it("le score global n'est pas la moyenne des domaines", () => {
    // Business 0,5 et Spirituel 1 : la moyenne des domaines donnerait 0,75.
    // Le global pondère chaque métrique, pas chaque domaine → (0,5 + 1) / 2.
    expect(result.execution.score).toBe(0.75);
    // Ici les deux coïncident ; le test existe pour figer la définition, pas
    // le nombre : c'est la couche qui pondère les métriques, jamais les aires.
    expect(result.areas).toHaveLength(2);
  });

  it("écarte les domaines sans matière plutôt que de les afficher à vide", () => {
    expect(result.areas.map((area) => area.category)).toEqual(["business", "spiritual"]);
  });

  it("rattache les objectifs à leur domaine", () => {
    const withGoal = card({
      habits,
      logs,
      metrics,
      metricEntries: entries,
      goals: [makeGoal({ id: "g", category: "spiritual", startDate: "2026-08-01", dueDate: "2026-08-31" })],
      month: "2026-08-05",
      today: "2026-08-05",
    });

    expect(withGoal.areas.find((a) => a.category === "spiritual")?.goals).toHaveLength(1);
    expect(withGoal.areas.find((a) => a.category === "business")?.goals).toHaveLength(0);
  });

  it("un domaine qui n'a qu'un objectif existe quand même", () => {
    const onlyGoal = card({
      goals: [makeGoal({ id: "g", category: "finance", startDate: "2026-08-01", dueDate: "2026-08-31" })],
      month: "2026-08-05",
      today: "2026-08-05",
    });

    expect(onlyGoal.areas.map((a) => a.category)).toEqual(["finance"]);
    expect(onlyGoal.areas[0]?.foundation).toBeNull();
  });

  it("l'ordre est déterministe — une liste qui bouge chaque mois ne se compare pas", () => {
    const again = card({
      habits: [...habits].reverse(),
      logs,
      metrics: [...metrics].reverse(),
      metricEntries: entries,
      month: "2026-08-05",
      today: "2026-08-05",
    });
    expect(again.areas.map((a) => a.category)).toEqual(result.areas.map((a) => a.category));
  });
});

describe("monthlyTrend — la même mesure, mois après mois", () => {
  const daily = withRule("read", { kind: "daily" }, { startDate: "2026-06-01" });
  const input = {
    goals: [],
    habits: [daily],
    logs: ["2026-06-01", "2026-06-02", "2026-07-01"].map((date) => makeLog("read", date)),
    metrics: [makeMetric({ id: "contents" })],
    metricEntries: [
      makeEntry("contents", "2026-06", { target: 10, actual: 5 }),
      makeEntry("contents", "2026-07", { target: 10, actual: 10 }),
    ],
    today: "2026-08-05",
  };

  it("rend une ligne par mois, avec les trois couches", () => {
    const trend = monthlyTrend(input, ["2026-06", "2026-07"]);
    expect(trend.map((row) => row.period)).toEqual(["2026-06", "2026-07"]);
    expect(trend[0]?.execution).toBe(0.5);
    expect(trend[1]?.execution).toBe(1);
    expect(trend[0]?.foundation).toBeCloseTo(2 / 30);
  });

  it("écarte les mois à venir plutôt que de les rendre à zéro", () => {
    const trend = monthlyTrend(input, monthsOfYear(2026));
    expect(trend.map((row) => row.period)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
  });

  it("signale le mois en cours : il ne se compare pas encore aux autres", () => {
    const trend = monthlyTrend(input, ["2026-07", "2026-08"]);
    expect(trend[0]?.inProgress).toBe(false);
    expect(trend[1]?.inProgress).toBe(true);
  });

  it("un mois sans rien reste neutre sur les trois couches", () => {
    const trend = monthlyTrend({ ...input, habits: [], metrics: [] }, ["2026-06"]);
    expect(trend[0]).toEqual({
      period: "2026-06",
      foundation: null,
      execution: null,
      impact: null,
      inProgress: false,
    });
  });
});

describe("scorecardVerdict", () => {
  // Fenêtre calée sur juillet : un objectif d'août serait exclu du bilan de juillet.
  const july = { startDate: "2026-07-01", dueDate: "2026-07-31" };
  const reached = makeGoal({ id: "done", targetValue: 2, currentValue: 2, ...july });
  const missed = makeGoal({ id: "missed", targetValue: 10, currentValue: 1, ...july });

  it("félicite quand tous les objectifs sont atteints sur un mois terminé", () => {
    const result = card({ goals: [reached], month: "2026-07-15", today: "2026-08-17" });
    expect(scorecardVerdict(result).tone).toBe("celebrate");
  });

  it("ne félicite pas un mois moyen — sinon la félicitation ne vaut rien", () => {
    const result = card({ goals: [missed], month: "2026-07-15", today: "2026-08-17" });
    expect(scorecardVerdict(result).tone).toBe("neutral");
  });

  it("reste neutre quand il n'y a rien à mesurer", () => {
    const result = card({ month: "2026-08-17", today: "2026-08-17" });
    expect(result.allGoalsReached).toBe(false);
    expect(scorecardVerdict(result).tone).toBe("neutral");
  });

  it("un mois qui n'a que des métriques n'est pas « rien à mesurer »", () => {
    const result = card({
      metrics: [makeMetric({ id: "contents" })],
      metricEntries: [makeEntry("contents", "2026-08", { target: 20, actual: 15 })],
      month: "2026-08-17",
      today: "2026-08-17",
    });
    expect(scorecardVerdict(result).title).not.toBe("Rien à mesurer ce mois-ci");
  });
});
