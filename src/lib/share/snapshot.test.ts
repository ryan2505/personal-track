import { describe, expect, it } from "vitest";

import {
  decodeSnapshot,
  encodeSnapshot,
  readSnapshotFromHash,
  roundScore,
  shareUrl,
  SNAPSHOT_VERSION,
  type ShareSnapshot,
} from "./snapshot";

const snapshot: ShareSnapshot = {
  v: SNAPSHOT_VERSION,
  name: "Ryan",
  date: "2026-08-17",
  daily: 0.83,
  streak: { current: 12, longest: 34 },
  areas: [{ label: "Business", score: 0.91 }],
};

describe("encodage d'un instantané", () => {
  it("fait un aller-retour sans perte", () => {
    expect(decodeSnapshot(encodeSnapshot(snapshot))).toEqual(snapshot);
  });

  it("survit aux accents et aux emoji", () => {
    const accented: ShareSnapshot = {
      ...snapshot,
      name: "Grâce 🔥",
      note: "Semaine solide — on continue",
    };
    expect(decodeSnapshot(encodeSnapshot(accented))?.note).toBe("Semaine solide — on continue");
    expect(decodeSnapshot(encodeSnapshot(accented))?.name).toBe("Grâce 🔥");
  });

  it("produit un payload sans caractère à échapper dans une URL", () => {
    expect(encodeSnapshot(snapshot)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("place le payload dans le fragment, jamais dans la query string", () => {
    const url = shareUrl("https://example.com", snapshot);
    // Le fragment n'est pas transmis au serveur ni écrit dans ses logs.
    expect(url).toContain("/shared#s=");
    expect(url).not.toContain("?");
  });
});

describe("calendrier et suivi du jour", () => {
  const withCalendar: ShareSnapshot = {
    ...snapshot,
    calendar: {
      from: "2026-08-01",
      scores: [1, 0.5, null, 0, 0.83],
    },
    tracking: [
      { title: "Workout", completion: 1, detail: "" },
      { title: "Étudier", completion: 0.5, detail: "30 / 60 min" },
    ],
  };

  it("transporte la grille et la checklist sans perte", () => {
    const decoded = decodeSnapshot(encodeSnapshot(withCalendar));
    expect(decoded?.calendar?.from).toBe("2026-08-01");
    expect(decoded?.calendar?.scores).toEqual([1, 0.5, null, 0, 0.83]);
    expect(decoded?.tracking?.[1]?.detail).toBe("30 / 60 min");
  });

  it("préserve les jours neutres, qui ne sont pas des zéros", () => {
    const decoded = decodeSnapshot(encodeSnapshot(withCalendar));
    expect(decoded?.calendar?.scores[2]).toBeNull();
    expect(decoded?.calendar?.scores[3]).toBe(0);
  });

  it("arrondit au centième pour raccourcir le lien", () => {
    expect(roundScore(0.8333333333)).toBe(0.83);
    expect(roundScore(null)).toBeNull();
    expect(roundScore(1)).toBe(1);
  });

  it("reste dans une taille d'URL raisonnable sur un mois complet", () => {
    const month: ShareSnapshot = {
      ...snapshot,
      calendar: {
        from: "2026-08-01",
        scores: Array.from({ length: 31 }, (_, index) => roundScore(index / 31)),
      },
    };
    // Les messageries tronquent au-delà de quelques milliers de caractères.
    expect(shareUrl("https://example.com", month).length).toBeLessThan(1200);
  });
});

describe("décodage défensif", () => {
  it("refuse un payload vide", () => {
    expect(decodeSnapshot("")).toBeNull();
    expect(decodeSnapshot("   ")).toBeNull();
  });

  it("refuse un payload illisible", () => {
    expect(decodeSnapshot("pas-du-base64-valide!!")).toBeNull();
  });

  it("refuse un payload tronqué", () => {
    const encoded = encodeSnapshot(snapshot);
    expect(decodeSnapshot(encoded.slice(0, Math.floor(encoded.length / 2)))).toBeNull();
  });

  it("refuse une version inconnue", () => {
    const future = encodeSnapshot({ ...snapshot, v: SNAPSHOT_VERSION + 1 });
    expect(decodeSnapshot(future)).toBeNull();
  });

  it("refuse un objet sans les champs obligatoires", () => {
    const encoded = encodeSnapshot({ v: SNAPSHOT_VERSION } as ShareSnapshot);
    expect(decodeSnapshot(encoded)).toBeNull();
  });
});

describe("lecture depuis le fragment", () => {
  it("lit un fragment complet", () => {
    expect(readSnapshotFromHash(`#s=${encodeSnapshot(snapshot)}`)?.name).toBe("Ryan");
  });

  it("retourne null sans marqueur", () => {
    expect(readSnapshotFromHash("#autre=1")).toBeNull();
    expect(readSnapshotFromHash("")).toBeNull();
  });
});
