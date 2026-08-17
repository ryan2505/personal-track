"use client";

import { useMemo } from "react";

import { LoginScreen } from "@/components/auth/LoginScreen";
import { AppGate } from "@/components/layout/AppGate";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createLocalRepository } from "@/lib/store/repository";
import { createSupabaseRepository } from "@/lib/store/supabaseRepository";
import { StoreProvider } from "@/lib/store/StoreProvider";

/**
 * Aiguillage session → données.
 *
 * Trois cas :
 *   · pas de projet Supabase  → mode local, aucune connexion demandée
 *   · configuré, pas de session → écran de connexion
 *   · connecté                 → espace cloisonné par identifiant de compte
 *
 * Le dépôt est mémoïsé sur l'identifiant : changer de compte recharge l'état de
 * ce compte, et sans mémoïsation la reconstruction à chaque rendu relancerait
 * le chargement en boucle.
 */
export function SessionShell({ children }: { children: React.ReactNode }) {
  const { enabled, ready, user } = useAuth();

  /**
   * Connecté → base de données : les données survivent au navigateur et suivent
   * le compte. Sinon → navigateur seul, seule option en mode local.
   *
   * Mémoïsé sur l'identifiant : sans ça, un dépôt reconstruit à chaque rendu
   * relancerait le chargement en boucle.
   */
  const repository = useMemo(
    () => (user === null ? createLocalRepository(null) : createSupabaseRepository(user.id)),
    [user],
  );

  if (enabled && !ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="text-faint text-sm">Chargement…</span>
      </div>
    );
  }

  if (enabled && user === null) return <LoginScreen />;

  return (
    <StoreProvider key={user?.id ?? "local"} repository={repository}>
      <AppGate>{children}</AppGate>
    </StoreProvider>
  );
}
