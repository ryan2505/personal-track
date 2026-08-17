"use client";

import { useState } from "react";

import { SecuritySection } from "@/components/auth/SecuritySection";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, TextInput } from "@/components/ui/Field";
import { approximateSize } from "@/lib/images";
import { useStore } from "@/lib/store/StoreProvider";

export default function SettingsPage() {
  const { state, setProfile, resetAll, today } = useStore();
  const [confirming, setConfirming] = useState(false);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader title="Réglages" />

      <SecuritySection />

      <Card className="mb-4">
        <CardHeader title="Profil" />
        <div className="space-y-4 p-4 sm:p-5">
          <Field label="Prénom">
            <TextInput
              value={state.profile.displayName}
              onChange={(event) => setProfile({ displayName: event.target.value })}
            />
          </Field>
          <Field
            label="Fuseau horaire"
            hint={`Aujourd'hui, dans ton fuseau : ${today}. C'est ce qui décide à quel jour appartient une habitude cochée tard le soir.`}
          >
            <TextInput
              value={state.profile.timezone}
              onChange={(event) => setProfile({ timezone: event.target.value })}
            />
          </Field>
        </div>
      </Card>

      <Card className="mb-4">
        <CardHeader title="Données" />
        <div className="space-y-3 p-4 text-sm sm:p-5">
          <p className="text-muted leading-relaxed">
            Tes données sont stockées <strong className="text-text">dans ce navigateur</strong>{" "}
            uniquement. Rien n&apos;est envoyé sur un serveur, et rien n&apos;est synchronisé entre
            appareils. Vider les données du site les efface définitivement.
          </p>
          <p className="text-faint tabular text-xs">
            {state.habits.length} habitudes · {state.goals.length} objectifs ·{" "}
            {state.logs.length} enregistrements · {state.visionItems.length} éléments de vision ·{" "}
            {Math.round(approximateSize(state) / 1024)} Ko
          </p>
        </div>
      </Card>

      <Card className="mb-4">
        <CardHeader title="Onboarding" />
        <div className="space-y-3 p-4 sm:p-5">
          <p className="text-muted text-sm leading-relaxed">
            Reprendre l&apos;assistant ne supprime rien : tes habitudes, objectifs et
            historique restent en place.
          </p>
          <Button onClick={() => setProfile({ onboarded: false, onboardingStep: 0 })}>
            Reprendre l&apos;assistant
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Zone de risque" />
        <div className="space-y-3 p-4 sm:p-5">
          {confirming ? (
            <div className="space-y-3">
              <p className="text-danger text-sm">
                Tout sera effacé : habitudes, objectifs, historique. Action irréversible.
              </p>
              <div className="flex gap-2">
                <Button variant="danger" onClick={resetAll}>
                  Effacer définitivement
                </Button>
                <Button onClick={() => setConfirming(false)}>Annuler</Button>
              </div>
            </div>
          ) : (
            <Button variant="danger" onClick={() => setConfirming(true)}>
              Réinitialiser l&apos;application
            </Button>
          )}
        </div>
      </Card>
    </main>
  );
}
