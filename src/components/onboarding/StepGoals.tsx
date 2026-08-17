"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { GoalForm } from "@/components/goals/GoalForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { CATEGORY_LABELS } from "@/lib/labels";
import { useActiveHabits } from "@/lib/store/selectors";
import { useStore } from "@/lib/store/StoreProvider";

import { StepShell } from "./StepShell";

/**
 * Étape 4 — les objectifs.
 *
 * Un objectif est un résultat daté et mesurable. C'est ce qui distingue le
 * produit d'une liste de cases à cocher.
 */
export function StepGoals({
  step,
  total,
  onNext,
  onBack,
  onSkip,
}: {
  step: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const { state, today, addGoal, removeGoal } = useStore();
  const habits = useActiveHabits();
  const [creating, setCreating] = useState(false);

  return (
    <StepShell
      step={step}
      total={total}
      title="Ce qui compte maintenant."
      subtitle="Un ou deux résultats concrets pour ce mois. Pas dix — le mois ne dure que trente jours."
      onNext={onNext}
      onBack={onBack}
      onSkip={onSkip}
      nextLabel={state.goals.length === 0 ? "Continuer" : "Continuer"}
    >
      <div className="space-y-4">
        <Button className="w-full" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          Ajouter un objectif
        </Button>

        {state.goals.length === 0 ? (
          <Card>
            <EmptyState
              title="Aucun objectif"
              description="Exemple : « Obtenir 5 nouveaux clients » ou « Faire 20 séances »."
            />
          </Card>
        ) : (
          <Card>
            <div className="divide-border divide-y">
              {state.goals.map((goal) => (
                <div key={goal.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{goal.title}</p>
                    <p className="text-faint text-xs">
                      {CATEGORY_LABELS[goal.category]}
                      {goal.targetValue !== null &&
                        ` · cible ${goal.targetValue}${goal.unit === null ? "" : ` ${goal.unit}`}`}
                    </p>
                  </div>
                  <button
                    aria-label={`Retirer ${goal.title}`}
                    onClick={() => removeGoal(goal.id)}
                    className="text-faint hover:text-danger flex size-9 shrink-0 items-center justify-center rounded-md"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {creating && (
        <GoalForm
          goal={null}
          habits={habits}
          today={today}
          open
          onClose={() => setCreating(false)}
          onSubmit={(goal) => addGoal(goal)}
        />
      )}
    </StepShell>
  );
}
