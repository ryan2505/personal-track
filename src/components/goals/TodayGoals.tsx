"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Card, CardHeader } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/Progress";
import {
  activeGoalsOn,
  goalPace,
  goalProgress,
  isScheduledOn,
  isFullyCompleted,
  quotaProgress,
  resolveCurrentValue,
  ruleForDate,
  type Goal,
  type Habit,
  type LocalDate,
} from "@/lib/domain";
import { GOAL_SCOPE_SHORT } from "@/lib/labels";
import { useLogIndex } from "@/lib/store/selectors";
import { useStore } from "@/lib/store/StoreProvider";
import { cn, formatPercent } from "@/lib/utils";

/**
 * Les objectifs, ramenés sur l'écran des tâches du jour.
 *
 * C'est le pari central du produit rendu visible : cocher une habitude n'est pas
 * un geste isolé, c'est ce qui fait avancer un résultat. Sans ce rappel, Today
 * redevient une liste de cases et les objectifs vivent dans un écran qu'on
 * n'ouvre jamais.
 *
 * Seuls les objectifs concernés par la journée sont montrés : ceux qu'une
 * habitude d'aujourd'hui alimente. Afficher tous les objectifs actifs
 * transformerait l'écran le plus utilisé du produit en tableau de bord.
 */
export function TodayGoals({ date }: { date: LocalDate }) {
  const { state } = useStore();
  const index = useLogIndex();

  const habitsById = useMemo(
    () => new Map<string, Habit>(state.habits.map((habit) => [habit.id, habit])),
    [state.habits],
  );

  const rows = useMemo(() => {
    return activeGoalsOn(state.goals, date)
      .map((goal) => {
        // Habitudes liées réellement en jeu aujourd'hui : planifiées ce jour,
        // ou disponibles au titre d'un quota en cours.
        const todaysHabits = goal.habitIds
          .map((id) => habitsById.get(id))
          .filter((habit): habit is Habit => habit !== undefined)
          .filter((habit) => {
            if (isScheduledOn(habit, date)) return true;
            const rule = ruleForDate(habit, date);
            return rule !== null && (rule.kind === "times_per_week" || rule.kind === "times_per_month");
          });

        const doneToday = todaysHabits.filter((habit) =>
          isFullyCompleted(habit, index.get(`${habit.id}|${date}`)),
        ).length;

        const current = resolveCurrentValue(
          goal,
          state.logs,
          habitsById,
          date,
          state.metricEntries,
        );
        const progress = goalProgress(goal, current);

        return {
          goal,
          progress,
          pace: goalPace(goal, progress.ratio, date),
          expectedToday: todaysHabits.length,
          doneToday,
          // Contribution restante du jour : ce qui reste à cocher pour cet objectif.
          remaining: todaysHabits.length - doneToday,
        };
      })
      .filter((row) => row.expectedToday > 0)
      .sort((a, b) => b.remaining - a.remaining);
  }, [state.goals, state.logs, habitsById, index, date]);

  if (rows.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader
        title="Ce que ça fait avancer"
        action={
          <Link href="/goals" className="text-muted hover:text-text text-xs">
            Tous les objectifs
          </Link>
        }
      />
      <div className="divide-border divide-y">
        {rows.map((row) => {
          const complete = row.remaining === 0;
          return (
            <div key={row.goal.id} className="px-4 py-3 sm:px-5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm">{row.goal.title}</span>
                <span className="tabular shrink-0 text-xs">
                  {formatPercent(row.progress.ratio)}
                </span>
              </div>

              <ProgressBar
                ratio={row.progress.ratio}
                className="mt-2"
                tone={row.progress.status === "completed" ? "success" : "accent"}
              />

              <div className="text-faint mt-1.5 flex flex-wrap items-baseline gap-x-3 text-xs">
                <span className="tabular">
                  {row.progress.current}
                  {row.progress.target !== null && ` / ${row.progress.target}`}
                  {row.goal.unit !== null && ` ${row.goal.unit}`}
                </span>
                <span>{GOAL_SCOPE_SHORT[row.goal.scope]}</span>
                <span className={cn(complete ? "text-success" : "text-accent")}>
                  {complete
                    ? "Ta part du jour est faite"
                    : `${row.remaining} habitude${row.remaining > 1 ? "s" : ""} à cocher aujourd'hui`}
                </span>
                {row.pace !== null && !row.pace.onTrack && (
                  <span className="text-warn">
                    en retard · <span className="tabular">{row.pace.daysRemaining}</span> j restants
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
