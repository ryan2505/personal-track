"use client";

import { AlertTriangle } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { useStore } from "@/lib/store/StoreProvider";

/**
 * Trois états explicites : chargement, onboarding, application.
 * Le chargement rend un écran neutre plutôt qu'un flash d'état vide.
 */
export function AppGate({ children }: { children: React.ReactNode }) {
  const { ready, state, saveError } = useStore();

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="text-faint text-sm">Chargement…</span>
      </div>
    );
  }

  const banner =
    saveError === null ? null : (
      // Une écriture perdue en silence, c'est une journée de suivi perdue.
      <div className="border-danger/40 bg-danger/10 text-danger fixed inset-x-0 top-0 z-50 flex items-start gap-2 border-b px-4 py-3 text-xs leading-relaxed">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span>{saveError}</span>
      </div>
    );

  if (!state.profile.onboarded) {
    return (
      <>
        {banner}
        <Onboarding />
      </>
    );
  }

  return (
    <>
      {banner}
      <AppShell>{children}</AppShell>
    </>
  );
}
