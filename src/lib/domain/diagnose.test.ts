import { describe, expect, it } from "vitest";

import { diagnoseMonth, type Observation } from "./diagnose";
import { makeEntry, makeHabit, makeLog, makeMetric } from "./fixtures";
import { monthlyScorecard } from "./scorecard";
import type { LocalDate, MetricEntry, Metric } from "./types";

const daily = makeHabit({ id: "read", startDate: "2026-07-01" });

/**
 * Construit un mois de juillet terminé, avec une fondation pilotée par le
 * nombre de jours tenus sur les 31.
 */
function july(options: {
  heldDays: number;
  metrics?: Metric[];
  entries?: MetricEntry[];
  today?: LocalDate;
}) {
  const logs = Array.from({ length: options.heldDays }, (_, offset) =>
    makeLog("read", `2026-07-${String(offset + 1).padStart(2, "0")}`),
  );

  return monthlyScorecard({
    goals: [],
    habits: [daily],
    logs,
    metrics: options.metrics ?? [],
    metricEntries: options.entries ?? [],
    month: "2026-07-15",
    today: options.today ?? "2026-08-17",
  });
}

function tones(observations: Observation[]): string[] {
  return observations.map((observation) => observation.tone);
}

function joined(observations: Observation[]): string {
  return observations.map((o) => `${o.title} ${o.detail}`).join(" ");
}

describe("diagnoseMonth — jamais une cause affirmée", () => {
  it("emploie le conditionnel quand il propose une explication", () => {
    const card = july({
      heldDays: 31,
      metrics: [makeMetric({ id: "contents" })],
      entries: [makeEntry("contents", "2026-07", { target: 20, actual: 5 })],
    });

    const text = joined(diagnoseMonth(card));
    expect(text).toMatch(/possible|piste|peut/i);
    // Aucune formule qui prétendrait savoir ce qui s'est passé.
    expect(text).not.toMatch(/tu n'as pas assez|tu as échoué|parce que tu/i);
  });
});

describe("diagnoseMonth — les quatre configurations", () => {
  it("fondation haute + exécution basse : la régularité n'a pas produit", () => {
    const card = july({
      heldDays: 31,
      metrics: [makeMetric({ id: "contents" })],
      entries: [makeEntry("contents", "2026-07", { target: 20, actual: 5 })],
    });

    expect(diagnoseMonth(card)[0]?.title).toBe(
      "La régularité ne s'est pas transformée en production",
    );
  });

  it("exécution haute + impact bas : le doute porte sur la stratégie, pas sur la personne", () => {
    const card = july({
      heldDays: 20,
      metrics: [
        makeMetric({ id: "contents", kind: "output" }),
        makeMetric({ id: "revenue", kind: "result" }),
      ],
      entries: [
        makeEntry("contents", "2026-07", { target: 20, actual: 20 }),
        makeEntry("revenue", "2026-07", { target: 300, actual: 90 }),
      ],
    });

    const observations = diagnoseMonth(card);
    expect(observations[0]?.title).toBe(
      "Tu as produit ce qui était prévu, sans le résultat attendu",
    );
    // Le délai fait partie des pistes : un contenu d'août peut produire en octobre.
    expect(observations[0]?.detail).toMatch(/délai/);
  });

  it("impact haut + fondation basse : levier réel ou coup ponctuel, sans trancher", () => {
    const card = july({
      heldDays: 10,
      metrics: [makeMetric({ id: "revenue", kind: "result" })],
      entries: [makeEntry("revenue", "2026-07", { target: 300, actual: 300 })],
    });

    const observations = diagnoseMonth(card);
    expect(observations[0]?.title).toBe("Le résultat est là sans la régularité");
    expect(observations[0]?.detail).toMatch(/deux mois/);
  });

  it("les trois basses : le point de reprise est la fondation", () => {
    const card = july({
      heldDays: 10,
      metrics: [
        makeMetric({ id: "contents", kind: "output" }),
        makeMetric({ id: "revenue", kind: "result" }),
      ],
      entries: [
        makeEntry("contents", "2026-07", { target: 20, actual: 4 }),
        makeEntry("revenue", "2026-07", { target: 300, actual: 60 }),
      ],
    });

    const observations = diagnoseMonth(card);
    expect(observations[0]?.title).toBe("Les trois couches décrochent ensemble");
    expect(observations[0]?.detail).toMatch(/fondation/);
  });

  it("les trois hautes : une seule ligne, et elle félicite", () => {
    const card = july({
      heldDays: 31,
      metrics: [
        makeMetric({ id: "contents", kind: "output" }),
        makeMetric({ id: "revenue", kind: "result" }),
      ],
      entries: [
        makeEntry("contents", "2026-07", { target: 20, actual: 20 }),
        makeEntry("revenue", "2026-07", { target: 300, actual: 300 }),
      ],
    });

    const observations = diagnoseMonth(card);
    expect(tones(observations)).toEqual(["strength"]);
    expect(observations[0]?.title).toBe("Mois cohérent de bout en bout");
  });
});

describe("diagnoseMonth — le mois en cours ne se juge pas", () => {
  it("refuse toute comparaison entre couches avant la fin du mois", () => {
    const card = monthlyScorecard({
      goals: [],
      habits: [makeHabit({ id: "read", startDate: "2026-08-01" })],
      logs: ["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05"].map((date) =>
        makeLog("read", date),
      ),
      metrics: [makeMetric({ id: "contents" })],
      // Le 5 du mois, 3 contenus sur 20 : ce n'est pas un retard.
      metricEntries: [makeEntry("contents", "2026-08", { target: 20, actual: 3 })],
      month: "2026-08-05",
      today: "2026-08-05",
    });

    const observations = diagnoseMonth(card);
    expect(observations[0]?.tone).toBe("neutral");
    expect(observations[0]?.title).toBe("Mois en cours");
    expect(observations.some((o) => o.tone === "hypothesis")).toBe(false);
  });
});

describe("diagnoseMonth — le goulot est une métrique, pas un score", () => {
  it("nomme la métrique la plus en retard avec ses chiffres", () => {
    const card = july({
      heldDays: 25,
      metrics: [
        makeMetric({ id: "contents", name: "Contenus publiés" }),
        makeMetric({ id: "prospects", name: "Prospects contactés", unit: "prospects" }),
      ],
      entries: [
        makeEntry("contents", "2026-07", { target: 20, actual: 18 }),
        makeEntry("prospects", "2026-07", { target: 50, actual: 15 }),
      ],
    });

    const gap = diagnoseMonth(card).find((o) => o.tone === "gap");
    expect(gap?.title).toBe("Écart le plus large : Prospects contactés");
    expect(gap?.detail).toContain("15 prospects");
    expect(gap?.detail).toContain("50 prospects");
  });

  it("ne désigne pas de goulot quand tout est au-dessus du seuil", () => {
    const card = july({
      heldDays: 25,
      metrics: [makeMetric({ id: "a" }), makeMetric({ id: "b" })],
      entries: [
        makeEntry("a", "2026-07", { target: 10, actual: 9 }),
        makeEntry("b", "2026-07", { target: 10, actual: 8 }),
      ],
    });

    expect(diagnoseMonth(card).some((o) => o.tone === "gap")).toBe(false);
  });

  it("une seule métrique n'a pas de « plus en retard » : ce serait elle par défaut", () => {
    const card = july({
      heldDays: 25,
      metrics: [makeMetric({ id: "a" })],
      entries: [makeEntry("a", "2026-07", { target: 10, actual: 1 })],
    });

    expect(diagnoseMonth(card).some((o) => o.tone === "gap")).toBe(false);
  });
});

describe("diagnoseMonth — silence quand il n'y a rien à dire", () => {
  it("ne conclut rien sur une couche sans chiffre", () => {
    const card = july({ heldDays: 31 });
    // Fondation seule : aucune hypothèse croisée n'est possible.
    expect(diagnoseMonth(card).some((o) => o.tone === "hypothesis")).toBe(false);
  });

  it("reste muet sur une zone grise — ni tenu, ni décroché", () => {
    const card = july({
      heldDays: 22,
      metrics: [makeMetric({ id: "a" })],
      entries: [makeEntry("a", "2026-07", { target: 10, actual: 7 })],
    });

    expect(diagnoseMonth(card)).toEqual([]);
  });
});
