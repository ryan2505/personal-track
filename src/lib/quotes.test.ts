import { describe, expect, it } from "vitest";

import { DEFAULT_QUOTES, quoteForDate } from "./quotes";

describe("quoteForDate", () => {
  it("INVARIANT — un même jour donne toujours la même citation", () => {
    const first = quoteForDate("2026-08-17");
    for (let attempt = 0; attempt < 50; attempt += 1) {
      expect(quoteForDate("2026-08-17")).toEqual(first);
    }
  });

  it("change chaque jour, sans répétition avant la fin du recueil", () => {
    const week = [
      "2026-08-17",
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
      "2026-08-22",
      "2026-08-23",
    ].map((date) => quoteForDate(date).text);

    // Rotation stricte : sept jours consécutifs, sept citations différentes.
    expect(new Set(week).size).toBe(7);
  });

  it("ne renvoie que des citations du recueil", () => {
    const known = new Set(DEFAULT_QUOTES.map((quote) => quote.text));
    for (let day = 1; day <= 28; day += 1) {
      const date = `2026-02-${String(day).padStart(2, "0")}`;
      expect(known.has(quoteForDate(date).text)).toBe(true);
    }
  });

  it("laisse l'auteur à null plutôt que de risquer une fausse attribution", () => {
    const unattributed = DEFAULT_QUOTES.filter((quote) => quote.author === null);
    expect(unattributed.length).toBeGreaterThan(0);
    for (const quote of DEFAULT_QUOTES) {
      expect(quote.text.trim()).not.toBe("");
      expect(quote.author === null || quote.author.trim() !== "").toBe(true);
    }
  });
});
