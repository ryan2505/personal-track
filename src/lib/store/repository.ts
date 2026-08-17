import { detectTimezone, emptyState, migrate, type AppState } from "./state";

/**
 * La seule frontière de persistance de l'application.
 *
 * Aucun composant n'accède au stockage directement. Le remplacement par une
 * implémentation Supabase (M1) se fait ici, sans toucher à l'UI.
 */
export interface Repository {
  load(): Promise<AppState>;
  /** Lève si l'écriture échoue — typiquement le quota navigateur saturé. */
  save(state: AppState): Promise<void>;
  clear(): Promise<void>;
}

const STORAGE_KEY = "personal-os:state";

/**
 * Clé de stockage.
 *
 * En mode local (sans authentification) on garde la clé historique, pour ne pas
 * faire disparaître les données de quelqu'un qui utilisait déjà l'application.
 * Dès qu'un compte est connecté, l'espace est cloisonné par identifiant : deux
 * personnes sur le même navigateur ne doivent jamais voir les données de
 * l'autre, même en mode local.
 */
function storageKey(userId: string | null): string {
  return userId === null ? STORAGE_KEY : `${STORAGE_KEY}:${userId}`;
}

export class StorageFullError extends Error {
  constructor() {
    super(
      "Stockage du navigateur saturé. Retire quelques images du vision board pour continuer à enregistrer.",
    );
    this.name = "StorageFullError";
  }
}

export function createLocalRepository(userId: string | null): Repository {
  const key = storageKey(userId);

  return {
    async load() {
      const timezone = detectTimezone();
      if (typeof window === "undefined") return emptyState(timezone);

      const raw = window.localStorage.getItem(key);
      if (raw === null) return emptyState(timezone);

      try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null) return emptyState(timezone);
        return migrate(parsed as Record<string, unknown>, timezone) ?? emptyState(timezone);
      } catch {
        return emptyState(timezone);
      }
    },

    async save(state) {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(key, JSON.stringify(state));
      } catch {
        // Le quota est la seule cause réaliste ici, et elle doit remonter à
        // l'utilisateur : une écriture perdue en silence, c'est une journée perdue.
        throw new StorageFullError();
      }
    },

    async clear() {
      if (typeof window === "undefined") return;
      window.localStorage.removeItem(key);
    },
  };
}

export const localRepository: Repository = createLocalRepository(null);
