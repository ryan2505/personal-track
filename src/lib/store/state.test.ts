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

  it("refuse un état venu d'une version future", () => {
    expect(migrate({ version: STATE_VERSION + 1 }, "UTC")).toBeNull();
  });

  it("survit à un état corrompu sans profil ni tableaux", () => {
    const migrated = migrate({ version: 1 }, "UTC");
    expect(migrated?.habits).toEqual([]);
    expect(migrated?.profile.onboarded).toBe(false);
  });
});
