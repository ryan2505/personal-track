"use client";

import { Archive, Plus } from "lucide-react";
import { useState } from "react";

import { HabitForm } from "@/components/habits/HabitForm";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { habitStreak, type Habit } from "@/lib/domain";
import { CATEGORY_LABELS, describeRule, TYPE_LABELS } from "@/lib/labels";
import { useActiveHabits, useLogIndex } from "@/lib/store/selectors";
import { useStore } from "@/lib/store/StoreProvider";

export default function HabitsPage() {
  const { addHabit, updateHabit, archiveHabit, today } = useStore();
  const habits = useActiveHabits();
  const index = useLogIndex();
  const [editing, setEditing] = useState<Habit | null>(null);
  const [creating, setCreating] = useState(false);

  const overloaded = habits.length > 6;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Habitudes"
        subtitle={`${habits.length} active${habits.length > 1 ? "s" : ""}`}
        action={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Nouvelle
          </Button>
        }
      />

      {overloaded && (
        <p className="border-warn/30 bg-warn/5 text-warn mb-5 rounded-md border px-4 py-3 text-xs leading-relaxed">
          Tu suis plus de six habitudes. Au-delà, les taux de complétion chutent nettement —
          la consistance vaut mieux que l&apos;exhaustivité.
        </p>
      )}

      <Card>
        {habits.length === 0 ? (
          <EmptyState
            title="Aucune habitude"
            description="Une habitude est une action répétée qui alimente un objectif. Commence par une ou deux, pas par dix."
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                Créer une habitude
              </Button>
            }
          />
        ) : (
          <div className="divide-border divide-y">
            {habits.map((habit) => {
              const streak = habitStreak(habit, index, today);
              const rule = habit.schedules.find((version) => version.effectiveTo === null)?.rule;
              return (
                <div key={habit.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <button
                    onClick={() => setEditing(habit)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm">{habit.title}</span>
                    <span className="text-faint block truncate text-xs">
                      {CATEGORY_LABELS[habit.category]} · {TYPE_LABELS[habit.type]}
                      {rule !== undefined && ` · ${describeRule(rule)}`}
                    </span>
                  </button>
                  {streak !== null && streak.current > 0 && (
                    <span className="tabular text-accent shrink-0 text-xs">{streak.current}</span>
                  )}
                  <button
                    onClick={() => archiveHabit(habit.id)}
                    aria-label={`Archiver ${habit.title}`}
                    title="Archiver — l'historique est conservé"
                    className="text-faint hover:text-danger flex size-9 shrink-0 items-center justify-center rounded-md"
                  >
                    <Archive className="size-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <p className="text-faint mt-4 text-xs leading-relaxed">
        Archiver conserve l&apos;historique : les jours déjà tenus continuent de compter dans
        tes statistiques passées.
      </p>

      {creating && (
        <HabitForm
          habit={null}
          open
          onClose={() => setCreating(false)}
          onSubmit={(input) => addHabit(input)}
        />
      )}

      {editing !== null && (
        <HabitForm
          key={editing.id}
          habit={editing}
          open
          onClose={() => setEditing(null)}
          onSubmit={(input) => updateHabit(editing.id, input)}
        />
      )}
    </main>
  );
}
