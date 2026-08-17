"use client";

import Link from "next/link";
import { useState } from "react";

import { HabitRow } from "@/components/habits/HabitRow";
import { LogDetailModal } from "@/components/habits/LogDetailModal";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScoreRing } from "@/components/ui/Progress";
import {
  expectedOn,
  findLog,
  quotaHabitsOn,
  quotaProgress,
  type Habit,
} from "@/lib/domain";
import { formatLongDate, greeting } from "@/lib/labels";
import { quoteForDate } from "@/lib/quotes";
import { useActiveHabits, useDailyScore, useLogIndex, useStreaks } from "@/lib/store/selectors";
import { useStore } from "@/lib/store/StoreProvider";
import { formatPercent } from "@/lib/utils";

export default function TodayPage() {
  const { state, today } = useStore();
  const habits = useActiveHabits();
  const index = useLogIndex();
  const score = useDailyScore(today);
  const streaks = useStreaks();
  const [detail, setDetail] = useState<Habit | null>(null);

  const scheduled = expectedOn(habits, today);
  // Déterministe : une même journée donne toujours la même citation.
  const quote = quoteForDate(today);
  const quotas = quotaHabitsOn(habits, today);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-faint text-xs tracking-[0.18em] uppercase">
          {formatLongDate(today)}
        </p>
        <h1 className="mt-2 text-xl font-medium">
          {greeting()}, {state.profile.displayName}
        </h1>
      </header>

      <Card className="mb-6 flex items-center gap-6 p-5">
        <ScoreRing ratio={score.score} label={formatPercent(score.score)} />
        <div className="min-w-0 space-y-1">
          <p className="text-sm">
            <span className="tabular font-medium">
              {score.completed} / {score.expected}
            </span>{" "}
            <span className="text-muted">habitudes complétées</span>
          </p>
          <p className="text-muted tabular text-sm">
            Série : {streaks.current} {streaks.current > 1 ? "jours" : "jour"}
            {streaks.freezesUsed > 0 && (
              <span className="text-faint"> · maintenue avec {streaks.freezesUsed} joker</span>
            )}
          </p>
          <p className="text-faint tabular text-xs">Record : {streaks.longest}</p>
        </div>
      </Card>

      <Card className="mb-6">
        <CardHeader title="Aujourd'hui" />
        {scheduled.length === 0 ? (
          <EmptyState
            title={habits.length === 0 ? "Aucune habitude" : "Rien de prévu aujourd'hui"}
            description={
              habits.length === 0
                ? "Crée ta première habitude pour commencer à suivre ton exécution quotidienne."
                : "Aucune habitude n'est planifiée ce jour. Ce n'est pas un échec : ce jour ne compte pas dans ton score."
            }
            action={
              habits.length === 0 ? (
                <Link href="/habits">
                  <Button variant="primary">Créer une habitude</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="divide-border divide-y">
            {scheduled.map((habit) => (
              <HabitRow
                key={habit.id}
                habit={habit}
                date={today}
                log={findLog(index, habit.id, today)}
                onOpenDetail={() => setDetail(habit)}
              />
            ))}
          </div>
        )}
      </Card>

      {quotas.length > 0 && (
        <Card>
          <CardHeader title="Disponibles cette période" />
          {/* Les habitudes à quota ne pèsent pas sur le score du jour. */}
          <div className="divide-border divide-y">
            {quotas.map((habit) => {
              const progress = quotaProgress(habit, index, today);
              return (
                <HabitRow
                  key={habit.id}
                  habit={habit}
                  date={today}
                  log={findLog(index, habit.id, today)}
                  onOpenDetail={() => setDetail(habit)}
                  subtitle={
                    progress === null
                      ? undefined
                      : `${progress.done} / ${progress.target} cette période`
                  }
                />
              );
            })}
          </div>
        </Card>
      )}

      <figure className="mt-8">
        <blockquote className="font-display text-muted text-lg leading-snug text-balance">
          {quote.text}
        </blockquote>
        {quote.author !== null && (
          <figcaption className="text-faint mt-1 text-xs">{quote.author}</figcaption>
        )}
      </figure>

      <LogDetailModal
        habit={detail}
        date={today}
        log={detail === null ? undefined : findLog(index, detail.id, today)}
        onClose={() => setDetail(null)}
      />
    </main>
  );
}
