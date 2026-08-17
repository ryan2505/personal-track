import { getSupabase } from "@/lib/auth/client";

import { createLocalRepository, type Repository } from "./repository";
import { detectTimezone, emptyState, migrate, type AppState } from "./state";

/**
 * Persistance serveur.
 *
 * Les données cessent d'appartenir au navigateur : elles suivent le compte,
 * survivent à un vidage de cache et se retrouvent d'un appareil à l'autre.
 *
 * `save` ne doit jamais échouer en silence — c'est la règle qui vaut pour tous
 * les dépôts (voir `StorageFullError`). Une erreur remonte jusqu'au bandeau de
 * l'application.
 */
/**
 * Un échec d'écriture doit dire quoi faire, pas recracher le message de l'API.
 * Le cas le plus probable au démarrage est la migration 0012 non appliquée.
 */
function explainSaveFailure(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("user_state") || normalized.includes("could not find the table")) {
    return "La table user_state est absente : applique la migration supabase/migrations/0012_user_state.sql. Tes données restent enregistrées sur cet appareil en attendant.";
  }
  if (normalized.includes("row-level security") || normalized.includes("policy")) {
    return "Écriture refusée par la base. Vérifie que la migration 0012 a bien créé sa policy RLS. Tes données restent sur cet appareil.";
  }
  if (normalized.includes("failed to fetch") || normalized.includes("network")) {
    return "Serveur injoignable. Tes données restent sur cet appareil et repartiront à la prochaine connexion.";
  }
  return `Enregistrement serveur impossible : ${message}. Tes données restent sur cet appareil.`;
}

export function createSupabaseRepository(userId: string): Repository {
  // Conservé comme miroir : si le réseau tombe, l'application continue de
  // fonctionner sur le dernier état connu au lieu de repartir à zéro.
  const mirror = createLocalRepository(userId);

  return {
    async load() {
      const supabase = getSupabase();
      const timezone = detectTimezone();
      if (supabase === null) return mirror.load();

      const { data, error } = await supabase
        .from("user_state")
        .select("state")
        .eq("user_id", userId)
        .maybeSingle();

      if (error !== null) {
        // Serveur injoignable : on repart du miroir plutôt que de présenter un
        // espace vide, qui déclencherait l'onboarding et donnerait l'impression
        // que tout est perdu.
        return mirror.load();
      }

      if (data === null) {
        // Premier chargement sur ce compte. S'il existe un état local (usage
        // avant l'authentification, ou avant cette bascule), on l'adopte au
        // lieu de le jeter.
        const local = await mirror.load();
        if (local.profile.onboarded || local.habits.length > 0) {
          await this.save(local);
          return local;
        }
        return emptyState(timezone);
      }

      const raw: unknown = data.state;
      if (typeof raw !== "object" || raw === null) return emptyState(timezone);
      const migrated = migrate(raw as Record<string, unknown>, timezone);
      if (migrated === null) return emptyState(timezone);

      // Le miroir suit, pour couvrir la prochaine coupure réseau.
      void mirror.save(migrated).catch(() => {});
      return migrated;
    },

    async save(state: AppState) {
      const supabase = getSupabase();
      if (supabase === null) return mirror.save(state);

      // Le miroir d'abord : même si le réseau échoue, un rafraîchissement
      // immédiat retrouve les données.
      await mirror.save(state).catch(() => {});

      const { error } = await supabase.from("user_state").upsert(
        {
          user_id: userId,
          state,
          version: state.version,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      if (error !== null) {
        throw new Error(explainSaveFailure(error.message));
      }
    },

    async clear() {
      const supabase = getSupabase();
      await mirror.clear();
      if (supabase === null) return;
      await supabase.from("user_state").delete().eq("user_id", userId);
    },
  };
}
