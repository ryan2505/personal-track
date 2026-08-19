"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { GoalForm } from "@/components/goals/GoalForm";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/Progress";
import {
  activeGoalsOn,
  goalPace,
  goalProgress,
  resolveCurrentValue,
  type Goal,
  type Habit,
} from "@/lib/domain";
import { CATEGORY_LABELS, GOAL_SCOPE_SHORT } from "@/lib/labels";
import { useActiveHabits } from "@/lib/store/selectors";
import { useStore } from "@/lib/store/StoreProvider";
import { cn, formatPercent } from "@/lib/utils";

export default function GoalsPage() {
  const { state, today, addGoal, updateGoal, removeGoal } = useStore();
  const habits = useActiveHabits();
  const [editing, setEditing] = useState<Goal | null>(null);
  const [creating, setCreating] = useState(false);

  const habitsById = useMemo(
    () => new Map<string, Habit>(state.habits.map((habit) => [habit.id, habit])),
    [state.habits],
  );

  const goals = activeGoalsOn(state.goals, today);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Objectifs"
        subtitle="Un objectif est un résultat. Une habitude est ce qui l'y amène."
        action={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Nouvel
          </Button>
        }
      />

      {goals.length === 0 ? (
        <Card>
          <EmptyState
            title="Aucun objectif actif"
            description="Définis un résultat mesurable pour ce mois, puis relie-le aux habitudes qui le feront avancer tout seul."
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                Créer un objectif
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => {
            const current = resolveCurrentValue(
              goal,
              state.logs,
              habitsById,
              today,
              state.metricEntries,
            );
            const progress = goalProgress(goal, current);
            const pace = goalPace(goal, progress.ratio, today);
            const linked = goal.habitIds
              .map((id) => habitsById.get(id)?.title)
              .filter((title): title is string => title !== undefined);

            return (
              <Card key={goal.id} className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <button onClick={() => setEditing(goal)} className="min-w-0 flex-1 text-left">
                    <span className="block text-sm font-medium">{goal.title}</span>
                    <span className="text-faint text-xs">
                      {CATEGORY_LABELS[goal.category]}
                      <span className="border-border ml-2 rounded-sm border px-1.5 py-0.5">
                        {GOAL_SCOPE_SHORT[goal.scope]}
                      </span>
                    </span>
                  </button>
                  <span className="tabular shrink-0 text-sm">{formatPercent(progress.ratio)}</span>
                </div>

                <ProgressBar
                  ratio={progress.ratio}
                  className="mt-3"
                  tone={progress.status === "completed" ? "success" : "accent"}
                />

                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="tabular text-muted text-xs">
                    {current}
                    {progress.target !== null && ` / ${progress.target}`}
                    {goal.unit !== null && ` ${goal.unit}`}
                  </span>

                  {goal.source === "manual" ? (
                    <div className="flex items-center gap-1">
                      <button
                        aria-label="Diminuer"
                        onClick={() =>
                          updateGoal(goal.id, { currentValue: Math.max(0, goal.currentValue - 1) })
                        }
                        className="text-muted hover:text-text flex size-8 items-center justify-center rounded-md"
                      >
                        <Minus className="size-4" />
                      </button>
                      <button
                        aria-label="Augmenter"
                        onClick={() => updateGoal(goal.id, { currentValue: goal.currentValue + 1 })}
                        className="text-muted hover:text-text flex size-8 items-center justify-center rounded-md"
                      >
                        <Plus className="size-4" />
                      </button>
                      <button
                        aria-label="Supprimer"
                        onClick={() => removeGoal(goal.id)}
                        className="text-faint hover:text-danger flex size-8 items-center justify-center rounded-md"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      aria-label="Supprimer"
                      onClick={() => removeGoal(goal.id)}
                      className="text-faint hover:text-danger flex size-8 items-center justify-center rounded-md"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>

                {pace !== null && (
                  <p
                    className={cn(
                      "mt-2 text-xs",
                      pace.onTrack ? "text-success" : "text-warn",
                    )}
                  >
                    {pace.onTrack ? "Sur la trajectoire" : "En retard"} ·{" "}
                    <span className="tabular">{pace.daysRemaining}</span> jours restants
                  </p>
                )}

                {linked.length > 0 && (
                  <p className="text-faint mt-2 text-xs">
                    Alimenté par {linked.join(", ")}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

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

      {editing !== null && (
        <GoalForm
          key={editing.id}
          goal={editing}
          habits={habits}
          today={today}
          open
          onClose={() => setEditing(null)}
          onSubmit={(goal) => updateGoal(editing.id, goal)}
        />
      )}
    </main>
  );
}
