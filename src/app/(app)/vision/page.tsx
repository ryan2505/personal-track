"use client";

import { Check, Pencil, X } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TextArea } from "@/components/ui/Field";
import { VisionBoard } from "@/components/vision/VisionBoard";
import { CATEGORY_LABELS, CATEGORY_PROMPTS } from "@/lib/labels";
import { useStore } from "@/lib/store/StoreProvider";

export default function VisionPage() {
  const { state, setVisionAreas, setProfile } = useStore();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const areas = [...state.visionAreas].sort((a, b) => a.order - b.order);

  const commit = (id: string) => {
    setVisionAreas(
      areas.map((area) => ({
        category: area.category,
        statement: area.id === id ? draft.trim() : area.statement,
      })),
    );
    setEditing(null);
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Vision"
        subtitle="Le seul niveau qui n'entre dans aucun score. C'est une direction, pas un résultat."
      />

      <Card className="mb-6">
        <CardHeader title="Domaines de vie" />
        {areas.length === 0 ? (
          <EmptyState
            title="Aucune vision définie"
            description="Reprends l'onboarding depuis les réglages pour choisir tes domaines et écrire où tu vas."
          />
        ) : (
          <div className="divide-border divide-y">
            {areas.map((area) => (
              <div key={area.id} className="px-4 py-4 sm:px-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{CATEGORY_LABELS[area.category]}</p>
                  {editing === area.id ? (
                    <div className="flex gap-1">
                      <button
                        aria-label="Enregistrer"
                        onClick={() => commit(area.id)}
                        className="text-accent flex size-8 items-center justify-center rounded-md"
                      >
                        <Check className="size-4" />
                      </button>
                      <button
                        aria-label="Annuler"
                        onClick={() => setEditing(null)}
                        className="text-faint flex size-8 items-center justify-center rounded-md"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      aria-label={`Modifier ${CATEGORY_LABELS[area.category]}`}
                      onClick={() => {
                        setDraft(area.statement);
                        setEditing(area.id);
                      }}
                      className="text-faint hover:text-text flex size-8 items-center justify-center rounded-md"
                    >
                      <Pencil className="size-4" />
                    </button>
                  )}
                </div>

                {editing === area.id ? (
                  <TextArea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    autoFocus
                  />
                ) : area.statement === "" ? (
                  <p className="text-faint text-sm italic">{CATEGORY_PROMPTS[area.category]}</p>
                ) : (
                  <p className="font-display text-lg leading-snug">{area.statement}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4 sm:p-5">
        <h2 className="mb-4 text-sm font-medium">Vision board</h2>
        <VisionBoard />
      </Card>

      <div className="mt-6">
        <Button
          variant="ghost"
          onClick={() => setProfile({ onboarded: false, onboardingStep: 1 })}
        >
          Reprendre l&apos;assistant de vision
        </Button>
      </div>
    </main>
  );
}
