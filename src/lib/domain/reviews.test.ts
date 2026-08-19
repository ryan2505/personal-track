import { describe, expect, it } from "vitest";

import { makeEntry, makeHabit, makeLog, makeMetric } from "./fixtures";
import {
  emptyAnswers,
  findMonthlyReview,
  freezeScorecard,
  hasAnswers,
  monthlyReviewWindow,
  reviewScores,
} from "./reviews";
import { monthlyScorecard } from "./scorecard";
import type { Review } from "./types";

const habit = makeHabit({ id: "read", startDate: "2026-07-01" });

function cardFor(heldDays: number, actual: number) {
  return monthlyScorecard({
    goals: [],
    habits: [habit],
    logs: Array.from({ length: heldDays }, (_, offset) =>
      makeLog("read", `2026-07-${String(offset + 1).padStart(2, "0")}`),
    ),
    metrics: [makeMetric({ id: "contents" })],
    metricEntries: [makeEntry("contents", "2026-07", { target: 20, actual })],
    month: "2026-07-15",
    today: "2026-08-17",
  });
}

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: "r1",
    kind: "monthly",
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    metrics: null,
    completedAt: null,
    ...emptyAnswers(),
    ...overrides,
  };
}

describe("monthlyReviewWindow", () => {
  it("borne le mois entier, quelle que soit sa longueur", () => {
    expect(monthlyReviewWindow("2026-07")).toEqual({
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
    });
    expect(monthlyReviewWindow("2028-02").periodEnd).toBe("2028-02-29");
  });
});

describe("findMonthlyReview — une revue par période", () => {
  it("retrouve la revue du mois par son premier jour", () => {
    const reviews = [makeReview(), makeReview({ id: "r2", periodStart: "2026-08-01" })];
    expect(findMonthlyReview(reviews, "2026-07")?.id).toBe("r1");
    expect(findMonthlyReview(reviews, "2026-08")?.id).toBe("r2");
    expect(findMonthlyReview(reviews, "2026-09")).toBeUndefined();
  });

  it("ne confond pas une revue hebdomadaire commençant le 1er", () => {
    const weekly = makeReview({ id: "w1", kind: "weekly", periodEnd: "2026-07-07" });
    expect(findMonthlyReview([weekly], "2026-07")).toBeUndefined();
  });
});

describe("reviewScores — le gel", () => {
  it("une revue ouverte suit les données : corriger un oubli doit se voir", () => {
    const before = reviewScores(makeReview(), cardFor(20, 10));
    const after = reviewScores(makeReview(), cardFor(31, 20));

    expect(before.frozen).toBe(false);
    expect(after.frozen).toBe(false);
    expect(after.snapshot.consistency).toBeGreaterThan(before.snapshot.consistency ?? 0);
    expect(after.snapshot.execution).toBe(1);
  });

  it("INVARIANT — une revue clôturée garde les chiffres sur lesquels elle a été écrite", () => {
    const atClosing = freezeScorecard(cardFor(20, 10));
    const closed = makeReview({ metrics: atClosing, completedAt: "2026-08-01T09:00:00.000Z" });

    // Les données du mois changent après coup — la revue, elle, ne bouge pas.
    const result = reviewScores(closed, cardFor(31, 20));

    expect(result.frozen).toBe(true);
    expect(result.snapshot).toEqual(atClosing);
    expect(result.snapshot.execution).toBe(0.5);
  });

  it("des chiffres gelés sans clôture ne gèlent rien : c'est la clôture qui fige", () => {
    const stale = makeReview({ metrics: freezeScorecard(cardFor(5, 1)), completedAt: null });
    expect(reviewScores(stale, cardFor(31, 20)).frozen).toBe(false);
  });

  it("sans revue du tout, les chiffres sont ceux du bilan vivant", () => {
    const result = reviewScores(undefined, cardFor(31, 20));
    expect(result.frozen).toBe(false);
    expect(result.snapshot.consistency).toBe(1);
  });
});

describe("freezeScorecard", () => {
  it("capture les trois couches et les compteurs d'objectifs", () => {
    const snapshot = freezeScorecard(cardFor(20, 15));
    expect(snapshot.consistency).toBeCloseTo(20 / 31);
    expect(snapshot.execution).toBe(0.75);
    expect(snapshot.impact).toBeNull();
    expect(snapshot.habitsExpected).toBe(31);
    expect(snapshot.goalsTracked).toBe(0);
  });
});

describe("hasAnswers", () => {
  it("une revue vide, ou remplie d'espaces, n'a pas commencé", () => {
    expect(hasAnswers(emptyAnswers())).toBe(false);
    expect(hasAnswers({ ...emptyAnswers(), learned: "   " })).toBe(false);
  });

  it("une seule réponse suffit à la considérer commencée", () => {
    expect(hasAnswers({ ...emptyAnswers(), mainFocus: "Prospection" })).toBe(true);
  });
});
