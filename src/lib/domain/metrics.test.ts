import { describe, expect, it } from "vitest";

import { makeEntry, makeMetric } from "./fixtures";
import {
  carryOverEntries,
  indexEntries,
  metricGap,
  metricRatio,
  metricsForPeriod,
  metricsScore,
  monthPeriod,
  periodEnd,
  periodStart,
  shiftPeriod,
  sumMetric,
} from "./metrics";

const AUGUST = "2026-08";

describe("périodes", () => {
  it("le mois d'une date locale, ses bornes", () => {
    expect(monthPeriod("2026-08-17")).toBe(AUGUST);
    expect(periodStart(AUGUST)).toBe("2026-08-01");
    expect(periodEnd(AUGUST)).toBe("2026-08-31");
    expect(periodEnd("2028-02")).toBe("2028-02-29");
  });

  it("le décalage traverse les années sans se tromper", () => {
    expect(shiftPeriod(AUGUST, 1)).toBe("2026-09");
    expect(shiftPeriod(AUGUST, -1)).toBe("2026-07");
    expect(shiftPeriod("2026-01", -1)).toBe("2025-12");
    expect(shiftPeriod("2026-12", 1)).toBe("2027-01");
    expect(shiftPeriod("2026-03", -14)).toBe("2025-01");
  });
});

describe("metricRatio — direction increase", () => {
  const contents = makeMetric({ id: "contents" });

  it("ratio à la cible", () => {
    expect(metricRatio(contents, makeEntry("contents", AUGUST, { target: 20, actual: 15 }))).toBe(
      0.75,
    );
  });

  it("le dépassement ne monte jamais au-dessus de 100%", () => {
    expect(metricRatio(contents, makeEntry("contents", AUGUST, { target: 20, actual: 26 }))).toBe(1);
  });

  it("cible à zéro : n'a aucun sens en increase, donc non scoré", () => {
    expect(metricRatio(contents, makeEntry("contents", AUGUST, { target: 0, actual: 3 }))).toBeNull();
  });
});

describe("metricRatio — direction decrease", () => {
  const spend = makeMetric({ id: "spend", kind: "result", direction: "decrease" });

  it("rester sous la cible vaut 100%", () => {
    expect(metricRatio(spend, makeEntry("spend", AUGUST, { target: 100, actual: 80 }))).toBe(1);
    expect(metricRatio(spend, makeEntry("spend", AUGUST, { target: 100, actual: 100 }))).toBe(1);
  });

  it("le dépassement décroît, borné à 0", () => {
    expect(metricRatio(spend, makeEntry("spend", AUGUST, { target: 100, actual: 150 }))).toBe(0.5);
    expect(metricRatio(spend, makeEntry("spend", AUGUST, { target: 100, actual: 900 }))).toBe(0);
  });

  it("cible à zéro : « zéro cigarette » se score bien", () => {
    const zero = makeMetric({ id: "zero", direction: "decrease" });
    expect(metricRatio(zero, makeEntry("zero", AUGUST, { target: 0, actual: 0 }))).toBe(1);
    expect(metricRatio(zero, makeEntry("zero", AUGUST, { target: 0, actual: 1 }))).toBe(0);
  });

  it("même formule de dépassement que les habitudes at_most", () => {
    // Garde-fou de non-régression : si l'une des deux formules bouge, celle-ci
    // doit bouger avec, sinon « 75/60 » ne vaut plus la même chose par écran.
    expect(metricRatio(spend, makeEntry("spend", AUGUST, { target: 30, actual: 45 }))).toBe(0.5);
  });
});

describe("metricRatio — les quatre non-scorables ne valent jamais 0", () => {
  it("pas d'entrée : la métrique n'est pas au contrat du mois", () => {
    expect(metricRatio(makeMetric({ id: "m" }), undefined)).toBeNull();
  });

  it("pas de cible : métrique d'observation", () => {
    const ctr = makeMetric({ id: "ctr", kind: "result", valueType: "percent" });
    expect(metricRatio(ctr, makeEntry("ctr", AUGUST, { actual: 5.2 }))).toBeNull();
  });

  it("valeur non saisie : « je ne sais pas » n'est pas « j'ai échoué »", () => {
    const m = makeMetric({ id: "m" });
    expect(metricRatio(m, makeEntry("m", AUGUST, { target: 20 }))).toBeNull();
    // Et un zéro explicitement saisi, lui, se score bien.
    expect(metricRatio(m, makeEntry("m", AUGUST, { target: 20, actual: 0 }))).toBe(0);
  });

  it("direction maintain : suivie, non scorée en V1", () => {
    const weight = makeMetric({ id: "weight", kind: "result", direction: "maintain" });
    expect(metricRatio(weight, makeEntry("weight", AUGUST, { target: 72, actual: 72 }))).toBeNull();
  });
});

describe("metricGap — un écart chiffré, toujours positif", () => {
  it("increase : ce qu'il manque", () => {
    const m = makeMetric({ id: "m" });
    expect(metricGap(m, makeEntry("m", AUGUST, { target: 50, actual: 35 }))).toBe(15);
    expect(metricGap(m, makeEntry("m", AUGUST, { target: 50, actual: 60 }))).toBe(0);
  });

  it("decrease : le dépassement", () => {
    const m = makeMetric({ id: "m", direction: "decrease" });
    expect(metricGap(m, makeEntry("m", AUGUST, { target: 100, actual: 130 }))).toBe(30);
    expect(metricGap(m, makeEntry("m", AUGUST, { target: 100, actual: 80 }))).toBe(0);
  });

  it("maintain : la distance, dans les deux sens", () => {
    const m = makeMetric({ id: "m", direction: "maintain" });
    expect(metricGap(m, makeEntry("m", AUGUST, { target: 72, actual: 75 }))).toBe(3);
    expect(metricGap(m, makeEntry("m", AUGUST, { target: 72, actual: 69 }))).toBe(3);
  });
});

describe("metricsScore — INVARIANT : moyenne pondérée de ratios, pas Σréalisé / Σcible", () => {
  it("une métrique en FCFA n'écrase pas une métrique en unités", () => {
    const metrics = [
      makeMetric({ id: "contents", name: "Contenus publiés" }),
      makeMetric({ id: "revenue", name: "CA", kind: "output", valueType: "currency" }),
    ];
    const entries = [
      // 0% sur les contenus…
      makeEntry("contents", AUGUST, { target: 20, actual: 0 }),
      // …et 100% sur un chiffre d'affaires de six ordres de grandeur au-dessus.
      makeEntry("revenue", AUGUST, { target: 300_000, actual: 300_000 }),
    ];

    const result = metricsScore(metrics, indexEntries(entries), AUGUST);

    // Σ min(réalisé, cible) / Σ cible donnerait 300000 / 300020 ≈ 99,99%.
    expect(result.score).toBe(0.5);
  });

  it("le poids déplace le score, l'unité jamais", () => {
    const metrics = [
      makeMetric({ id: "a", weight: 3 }),
      makeMetric({ id: "b", weight: 1 }),
    ];
    const entries = [
      makeEntry("a", AUGUST, { target: 10, actual: 10 }),
      makeEntry("b", AUGUST, { target: 10, actual: 0 }),
    ];

    expect(metricsScore(metrics, indexEntries(entries), AUGUST).score).toBe(0.75);
  });

  it("aucune métrique scorable → null, jamais 0", () => {
    const metrics = [makeMetric({ id: "ctr", direction: "maintain" })];
    const entries = [makeEntry("ctr", AUGUST, { target: 5, actual: 5 })];

    const result = metricsScore(metrics, indexEntries(entries), AUGUST);
    expect(result.score).toBeNull();
    expect(result.tracked).toBe(1);
    expect(result.scored).toBe(0);
  });

  it("un mois vide est neutre", () => {
    expect(metricsScore([], indexEntries([]), AUGUST).score).toBeNull();
  });

  it("les métriques d'observation sont affichées sans peser sur le score", () => {
    const metrics = [
      makeMetric({ id: "videos" }),
      makeMetric({ id: "ctr", valueType: "percent" }),
    ];
    const entries = [
      makeEntry("videos", AUGUST, { target: 4, actual: 2 }),
      makeEntry("ctr", AUGUST, { actual: 5.2 }),
    ];

    const result = metricsScore(metrics, indexEntries(entries), AUGUST);
    expect(result.score).toBe(0.5);
    expect(result.tracked).toBe(2);
    expect(result.scored).toBe(1);
  });

  it("sépare outputs et results", () => {
    const metrics = [
      makeMetric({ id: "prospects", kind: "output" }),
      makeMetric({ id: "clients", kind: "result" }),
    ];
    const entries = [
      makeEntry("prospects", AUGUST, { target: 50, actual: 35 }),
      makeEntry("clients", AUGUST, { target: 15, actual: 12 }),
    ];
    const index = indexEntries(entries);

    expect(metricsScore(metrics, index, AUGUST, "output").score).toBe(0.7);
    expect(metricsScore(metrics, index, AUGUST, "result").score).toBe(0.8);
  });
});

describe("metricsForPeriod — le contrat du mois", () => {
  it("une métrique sans entrée n'est pas au contrat de ce mois", () => {
    const metrics = [makeMetric({ id: "a" }), makeMetric({ id: "b" })];
    const entries = [makeEntry("a", AUGUST, { target: 1, actual: 1 })];

    const rows = metricsForPeriod(metrics, indexEntries(entries), AUGUST);
    expect(rows.map((row) => row.metric.id)).toEqual(["a"]);
  });

  it("INVARIANT §5.3 — archiver ne réécrit pas les mois déjà tenus", () => {
    const metrics = [makeMetric({ id: "a", archivedAt: "2026-08-20" })];
    const entries = [
      makeEntry("a", AUGUST, { target: 10, actual: 10 }),
      makeEntry("a", "2026-09", { target: 10, actual: 0 }),
    ];
    const index = indexEntries(entries);

    // Archivée en cours d'août : août la garde…
    expect(metricsForPeriod(metrics, index, AUGUST)).toHaveLength(1);
    // …septembre, non, même si une entrée traîne.
    expect(metricsForPeriod(metrics, index, "2026-09")).toHaveLength(0);
  });

  it("ce qui reste à faire d'abord, l'acquis ensuite, l'observation en dernier", () => {
    const metrics = [
      makeMetric({ id: "done" }),
      makeMetric({ id: "watched" }),
      makeMetric({ id: "low" }),
      makeMetric({ id: "high" }),
    ];
    const entries = [
      makeEntry("done", AUGUST, { target: 10, actual: 10 }),
      makeEntry("watched", AUGUST, { actual: 42 }),
      makeEntry("low", AUGUST, { target: 10, actual: 2 }),
      makeEntry("high", AUGUST, { target: 10, actual: 8 }),
    ];

    const rows = metricsForPeriod(metrics, indexEntries(entries), AUGUST);
    expect(rows.map((row) => row.metric.id)).toEqual(["high", "low", "done", "watched"]);
  });
});

describe("carryOverEntries — démarrer un nouveau mois", () => {
  const entries = [
    makeEntry("contents", AUGUST, { target: 20, actual: 15, note: "bon mois" }),
    makeEntry("prospects", AUGUST, { target: 50, actual: 35 }),
  ];

  it("la cible se reconduit, la valeur jamais", () => {
    const added = carryOverEntries(entries, AUGUST, "2026-09", ["contents"]);
    expect(added).toEqual([
      { metricId: "contents", period: "2026-09", target: 20, actual: null, note: null },
    ]);
  });

  it("ne reconduit que ce qu'on a choisi", () => {
    const added = carryOverEntries(entries, AUGUST, "2026-09", ["prospects"]);
    expect(added.map((entry) => entry.metricId)).toEqual(["prospects"]);
  });

  it("reconduire deux fois n'écrase pas une cible qu'on venait de relever", () => {
    const withSeptember = [
      ...entries,
      makeEntry("contents", "2026-09", { target: 30, actual: 4 }),
    ];
    expect(carryOverEntries(withSeptember, AUGUST, "2026-09", ["contents"])).toEqual([]);
  });

  it("une métrique absente du mois source n'invente pas de ligne", () => {
    expect(carryOverEntries(entries, AUGUST, "2026-09", ["inconnue"])).toEqual([]);
  });
});

describe("sumMetric — un objectif long s'alimente sans stocker le chiffre deux fois", () => {
  const entries = [
    makeEntry("revenue", "2026-07", { target: 300, actual: 210 }),
    makeEntry("revenue", AUGUST, { target: 300, actual: 250 }),
    makeEntry("revenue", "2026-09", { target: 300, actual: 310 }),
    makeEntry("other", AUGUST, { target: 1, actual: 999 }),
  ];

  it("somme sur la fenêtre, bornes incluses", () => {
    expect(sumMetric(entries, "revenue", "2026-07", "2026-09")).toBe(770);
    expect(sumMetric(entries, "revenue", AUGUST, AUGUST)).toBe(250);
  });

  it("un mois non saisi compte pour zéro dans un total, sans devenir un échec", () => {
    const partial = [makeEntry("revenue", AUGUST, { target: 300 })];
    expect(sumMetric(partial, "revenue", AUGUST, AUGUST)).toBe(0);
  });

  it("hors fenêtre, rien", () => {
    expect(sumMetric(entries, "revenue", "2027-01", "2027-12")).toBe(0);
  });
});
