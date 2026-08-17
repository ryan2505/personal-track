"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { HabitForm } from "@/components/habits/HabitForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { HabitCategory, HabitType, ScheduleRule } from "@/lib/domain";
import { describeRule } from "@/lib/labels";
import { useActiveHabits } from "@/lib/store/selectors";
import { useStore, type HabitInput } from "@/lib/store/StoreProvider";
import { cn } from "@/lib/utils";

import { StepShell } from "./StepShell";

interface Preset {
  title: string;
  category: HabitCategory;
  type: HabitType;
  unit: string | null;
  targetValue: number | null;
  rule: ScheduleRule;
}

const PRESETS: Preset[] = [
  { title: "Sport", category: "fitness", type: "boolean", unit: null, targetValue: null, rule: { kind: "times_per_week", timesPerPeriod: 3 } },
  { title: "Deep work", category: "business", type: "duration", unit: "min", targetValue: 120, rule: { kind: "days_of_week", daysOfWeek: [1, 2, 3, 4, 5] } },
  { title: "Lecture", category: "learning", type: "duration", unit: "min", targetValue: 20, rule: { kind: "daily" } },
  { title: "Eau", category: "health", type: "quantity", unit: "L", targetValue: 2.5, rule: { kind: "daily" } },
  { title: "Méditation", category: "spiritual", type: "boolean", unit: null, targetValue: null, rule: { kind: "daily" } },
  { title: "Prospection", category: "business", type: "counter", unit: "contacts", targetValue: 10, rule: { kind: "days_of_week", daysOfWeek: [1, 2, 3, 4, 5] } },
];

function toInput(preset: Preset): HabitInput {
  return {
    title: preset.title,
    category: preset.category,
    type: preset.type,
    unit: preset.unit,
    targetValue: preset.targetValue,
    direction: "at_least",
    weight: 1,
    rule: preset.rule,
  };
}

/**
 * Étape 5 — les habitudes.
 *
 * L'avertissement au-delà de six n'est pas décoratif : au-delà, le taux de
 * complétion s'effondre et l'utilisateur abandonne le produit entier.
 */
export function StepHabits({
  step,
  total,
  onFinish,
  onBack,
}: {
  step: number;
  total: number;
  onFinish: () => void;
  onBack: () => void;
}) {
  const { addHabit, archiveHabit } = useStore();
  const habits = useActiveHabits();
  const [creating, setCreating] = useState(false);

  const titles = new Set(habits.map((habit) => habit.title));
  const overloaded = habits.length > 6;

  return (
    <StepShell
      step={step}
      total={total}
      title="Ce qui t'y amène chaque jour."
      subtitle="Une habitude est une action répétée qui fait avancer un objectif. Commence petit."
      onNext={onFinish}
      onBack={onBack}
      nextLabel="Terminer"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => {
            const added = titles.has(preset.title);
            return (
              <button
                key={preset.title}
                disabled={added}
                onClick={() => addHabit(toInput(preset))}
                className={cn(
                  "min-h-11 rounded-md border px-3 text-sm transition-colors",
                  added
                    ? "border-border text-faint cursor-default"
                    : "border-border text-muted hover:border-accent hover:text-accent",
                )}
              >
                {added ? "✓ " : "+ "}
                {preset.title}
              </button>
            );
          })}
        </div>

        <Button className="w-full" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          Créer une habitude sur mesure
        </Button>

        {overloaded && (
          <p className="border-warn/30 bg-warn/5 text-warn rounded-md border px-4 py-3 text-xs leading-relaxed">
            Plus de six habitudes quotidiennes : au-delà, les taux de complétion chutent
            nettement. La consistance vaut mieux que l&apos;exhaustivité.
          </p>
        )}

        {habits.length === 0 ? (
          <Card>
            <EmptyState
              title="Aucune habitude"
              description="Choisis-en une ou deux ci-dessus. Tu pourras toujours en ajouter une fois le rythme pris."
            />
          </Card>
        ) : (
          <Card>
            <div className="divide-border divide-y">
              {habits.map((habit) => {
                const rule = habit.schedules.find((version) => version.effectiveTo === null)?.rule;
                return (
                  <div key={habit.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{habit.title}</p>
                      {rule !== undefined && (
                        <p className="text-faint text-xs">{describeRule(rule)}</p>
                      )}
                    </div>
                    <button
                      aria-label={`Retirer ${habit.title}`}
                      onClick={() => archiveHabit(habit.id)}
                      className="text-faint hover:text-danger flex size-9 shrink-0 items-center justify-center rounded-md"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      {creating && (
        <HabitForm
          habit={null}
          open
          onClose={() => setCreating(false)}
          onSubmit={(input) => addHabit(input)}
        />
      )}
    </StepShell>
  );
}
