import { describe, expect, it } from "vitest";

import { migrate, STATE_VERSION } from "./state";

/**
 * La migration est la garantie qu'un changement de forme ne fait jamais perdre
 * de données à quelqu'un qui suit ses habitudes depuis des semaines.
 */
describe("migrate", () => {
  const v1 = {
    version: 1,
    profile: { displayName: "Ryan", timezone: "Africa/Douala", onboarded: true },
    habits: [{ id: "h1" }],
    goals: [{ id: "g1" }],
    logs: [{ habitId: "h1", localDate: "2026-08-17" }],
  };

  it("conserve les données d'un état v1", () => {
    const migrated = migrate(v1, "UTC");
    expect(migrated?.version).toBe(STATE_VERSION);
    expect(migrated?.profile.displayName).toBe("Ryan");
    expect(migrated?.profile.timezone).toBe("Africa/Douala");
    expect(migrated?.habits).toHaveLength(1);
    expect(migrated?.goals).toHaveLength(1);
    expect(migrated?.logs).toHaveLength(1);
  });

  it("complète les champs introduits en v2", () => {
    const migrated = migrate(v1, "UTC");
    expect(migrated?.visionAreas).toEqual([]);
    expect(migrated?.visionItems).toEqual([]);
    expect(migrated?.profile.avatar).toBeNull();
  });

  it("ne renvoie pas un utilisateur déjà onboardé dans le wizard", () => {
    expect(migrate(v1, "UTC")?.profile.onboardingStep).toBe(5);
  });

  it("place un profil jamais onboardé à la première étape", () => {
    const fresh = { version: 1, profile: { displayName: "", onboarded: false } };
    expect(migrate(fresh, "UTC")?.profile.onboardingStep).toBe(0);
  });

  it("retombe sur le fuseau détecté quand il manque", () => {
    expect(migrate({ version: 1, profile: {} }, "Europe/Paris")?.profile.timezone).toBe(
      "Europe/Paris",
    );
  });

  it("retombe sur des réglages de partage fermés quand ils manquent", () => {
    const migrated = migrate(v1, "UTC");
    expect(migrated?.shareSettings.goals).toBe(false);
    expect(migrated?.shareSettings.habits).toBe(false);
    expect(migrated?.shareSettings.areas).toBe(false);
    expect(migrated?.shareSettings.note).toBe("");
  });

  it("ne laisse pas un réglage de partage inconnu ouvrir un champ", () => {
    const tampered = { ...v1, shareSettings: { inconnu: true } };
    const migrated = migrate(tampered, "UTC");
    expect(migrated?.shareSettings.goals).toBe(false);
    expect(migrated?.shareSettings.habits).toBe(false);
  });

  it("complète les métriques introduites en v5, sans toucher au reste", () => {
    const migrated = migrate(v1, "UTC");
    expect(migrated?.metrics).toEqual([]);
    expect(migrated?.metricEntries).toEqual([]);
    expect(migrated?.habits).toHaveLength(1);
  });

  it("conserve les métriques d'un état qui en a déjà", () => {
    const v5 = {
      ...v1,
      version: 5,
      metrics: [{ id: "m1", name: "Contenus" }],
      metricEntries: [{ metricId: "m1", period: "2026-08", target: 20, actual: 15 }],
    };
    const migrated = migrate(v5, "UTC");
    expect(migrated?.metrics).toHaveLength(1);
    expect(migrated?.metricEntries).toHaveLength(1);
  });

  it("complète les revues introduites en v6", () => {
    expect(migrate(v1, "UTC")?.reviews).toEqual([]);
  });

  it("v7 — une métrique d'avant la semaine reste mensuelle", () => {
    const v6 = {
      ...v1,
      version: 6,
      metrics: [{ id: "m1", name: "Contenus", kind: "output" }],
    };
    const migrated = migrate(v6, "UTC");
    expect(migrated?.metrics[0]?.cadence).toBe("monthly");
    expect(migrated?.metrics[0]?.name).toBe("Contenus");
  });

  it("v7 — une cadence déjà posée n'est pas réécrite", () => {
    const v7 = {
      ...v1,
      version: 7,
      metrics: [{ id: "m1", name: "Contenus", kind: "output", cadence: "weekly" }],
    };
    expect(migrate(v7, "UTC")?.metrics[0]?.cadence).toBe("weekly");
  });

  it("refuse un état venu d'une version future", () => {
    expect(migrate({ version: STATE_VERSION + 1 }, "UTC")).toBeNull();
  });

  it("survit à un état corrompu sans profil ni tableaux", () => {
    const migrated = migrate({ version: 1 }, "UTC");
    expect(migrated?.habits).toEqual([]);
    expect(migrated?.profile.onboarded).toBe(false);
  });
});
