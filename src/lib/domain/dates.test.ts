import { describe, expect, it } from "vitest";

import {
  addDays,
  daysInMonth,
  diffDays,
  eachDay,
  endOfIsoWeek,
  endOfMonth,
  isLocalDate,
  isWithin,
  isoWeekday,
  localToday,
  startOfIsoWeek,
  startOfMonth,
  toLocalDate,
} from "./dates";

describe("frontière timezone (CLAUDE.md §5.1)", () => {
  it("attribue une coche de 00h30 à Douala au bon jour local, pas au jour UTC", () => {
    // 2026-08-17T23:30Z = 2026-08-18T00:30 à Douala (UTC+1)
    const instant = new Date("2026-08-17T23:30:00Z");
    expect(toLocalDate(instant, "Africa/Douala")).toBe("2026-08-18");
    expect(instant.toISOString().slice(0, 10)).toBe("2026-08-17");
  });

  it("gère aussi les décalages négatifs", () => {
    // 2026-08-18T02:00Z = 2026-08-17T22:00 à New York (UTC-4 en août)
    const instant = new Date("2026-08-18T02:00:00Z");
    expect(toLocalDate(instant, "America/New_York")).toBe("2026-08-17");
  });

  it("localToday suit le fuseau de l'utilisateur", () => {
    const now = new Date("2026-08-17T23:30:00Z");
    expect(localToday("Africa/Douala", now)).toBe("2026-08-18");
    expect(localToday("America/New_York", now)).toBe("2026-08-17");
  });
});

describe("arithmétique de dates", () => {
  it("valide le format", () => {
    expect(isLocalDate("2026-08-17")).toBe(true);
    expect(isLocalDate("2026-02-30")).toBe(false);
    expect(isLocalDate("2026-8-17")).toBe(false);
  });

  it("additionne sans dériver aux changements de mois et d'année", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("compte les jours entre deux dates", () => {
    expect(diffDays("2026-08-17", "2026-08-10")).toBe(7);
    expect(diffDays("2026-08-10", "2026-08-17")).toBe(-7);
    expect(diffDays("2026-08-17", "2026-08-17")).toBe(0);
  });

  it("utilise des jours ISO (1 = lundi)", () => {
    expect(isoWeekday("2026-08-17")).toBe(1);
    expect(isoWeekday("2026-08-23")).toBe(7);
  });

  it("borne les semaines du lundi au dimanche", () => {
    expect(startOfIsoWeek("2026-08-20")).toBe("2026-08-17");
    expect(endOfIsoWeek("2026-08-20")).toBe("2026-08-23");
  });

  it("borne les mois", () => {
    expect(startOfMonth("2026-08-17")).toBe("2026-08-01");
    expect(endOfMonth("2026-08-17")).toBe("2026-08-31");
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
    expect(daysInMonth("2028-02-01")).toBe(29);
  });

  it("teste l'appartenance, borne haute ouverte incluse", () => {
    expect(isWithin("2026-08-17", "2026-08-01", "2026-08-31")).toBe(true);
    expect(isWithin("2026-08-31", "2026-08-01", "2026-08-31")).toBe(true);
    expect(isWithin("2026-09-01", "2026-08-01", "2026-08-31")).toBe(false);
    expect(isWithin("2030-01-01", "2026-08-01", null)).toBe(true);
  });

  it("énumère les jours bornes incluses", () => {
    expect(eachDay("2026-08-17", "2026-08-19")).toEqual([
      "2026-08-17",
      "2026-08-18",
      "2026-08-19",
    ]);
    expect(eachDay("2026-08-17", "2026-08-17")).toHaveLength(1);
  });
});
