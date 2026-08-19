"use client";

import Link from "next/link";
import { useMemo } from "react";

import { PageHeader } from "@/components/layout/AppShell";
import { ScorecardSummary } from "@/components/metrics/ScorecardSummary";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar, ScoreRing } from "@/components/ui/Progress";
import {
  activeGoalsOn,
  addDays,
  dailyScore,
  eachDay,
  endOfIsoWeek,
  goalProgress,
  resolveCurrentValue,
  startOfIsoWeek,
  type Habit,
} from "@/lib/domain";
import { formatLongDate, greeting, WEEKDAYS } from "@/lib/labels";
import {
  useDailyScore,
  useLogIndex,
  useMonthConsistency,
  useStreaks,
  useWeekConsistency,
} from "@/lib/store/selectors";
import { useStore } from "@/lib/store/StoreProvider";
import { cn, formatPercent } from "@/lib/utils";

export default function DashboardPage() {
  const { state, today } = useStore();
  const index = useLogIndex();
  const score = useDailyScore(today);
  const streaks = useStreaks();
  const week = useWeekConsistency(today);
  const month = useMonthConsistency(today);

  const weekDays = useMemo(
    () =>
      eachDay(startOfIsoWeek(today), endOfIsoWeek(today)).map((date) => ({
        date,
        score: dailyScore(state.habits, index, date).score,
        future: date > today,
      })),
    [today, state.habits, index],
  );

  const habitsById = useMemo(
    () => new Map<string, Habit>(state.habits.map((habit) => [habit.id, habit])),
    [state.habits],
  );

  const goals = activeGoalsOn(state.goals, today).slice(0, 4);

  const visionPreview = useMemo(
    () => [...state.visionItems].sort((a, b) => a.order - b.order).slice(0, 3),
    [state.visionItems],
  );

  // La vision reste sous les yeux : c'est ce qui donne un sens aux cases cochées.
  const leadStatement = state.visionAreas
    .map((area) => area.statement)
    .find((statement) => statement.trim() !== "");

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader
        title={`${greeting()}, ${state.profile.displayName}`}
        subtitle={formatLongDate(today)}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-4 p-4">
          <ScoreRing ratio={score.score} size={56} label={formatPercent(score.score)} />
          <div>
            <p className="text-faint text-xs">Aujourd&apos;hui</p>
            <p className="tabular text-sm">
              {score.completed} / {score.expected}
            </p>
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-faint text-xs">Cette semaine</p>
          <p className="tabular mt-1 text-2xl font-medium">{formatPercent(week.score)}</p>
          <ProgressBar ratio={week.score} className="mt-3" />
        </Card>
        <Card className="p-4">
          <p className="text-faint text-xs">Ce mois</p>
          <p className="tabular mt-1 text-2xl font-medium">{formatPercent(month.score)}</p>
          <ProgressBar ratio={month.score} className="mt-3" />
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader
          title="Semaine en cours"
          action={
            <span className="tabular text-muted text-xs">
              série {streaks.current} · record {streaks.longest}
            </span>
          }
        />
        <div className="grid grid-cols-7 gap-2 p-4 sm:p-5">
          {weekDays.map((day, position) => (
            <div key={day.date} className="flex flex-col items-center gap-2">
              <div className="bg-surface-2 flex h-24 w-full items-end overflow-hidden rounded-sm">
                <div
                  className={cn(
                    "w-full rounded-sm transition-[height] duration-500",
                    day.score === null ? "bg-border" : "bg-accent",
                  )}
                  style={{ height: `${day.score === null ? 4 : Math.max(4, day.score * 100)}%` }}
                />
              </div>
              <span
                className={cn(
                  "text-[10px]",
                  day.date === today ? "text-accent" : day.future ? "text-faint" : "text-muted",
                )}
              >
                {WEEKDAYS[position]?.short}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <ScorecardSummary />

      <Card>
        <CardHeader
          title="Objectifs"
          action={
            <Link href="/goals" className="text-muted hover:text-text text-xs">
              Tout voir
            </Link>
          }
        />
        {goals.length === 0 ? (
          <EmptyState
            title="Aucun objectif"
            description="Sans objectif, les habitudes ne sont que des cases à cocher."
          />
        ) : (
          <div className="divide-border divide-y">
            {goals.map((goal) => {
              const current = resolveCurrentValue(
                goal,
                state.logs,
                habitsById,
                today,
                state.metricEntries,
              );
              const progress = goalProgress(goal, current);
              return (
                <div key={goal.id} className="px-4 py-3 sm:px-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm">{goal.title}</span>
                    <span className="tabular text-muted shrink-0 text-xs">
                      {current}
                      {progress.target !== null && ` / ${progress.target}`}
                    </span>
                  </div>
                  <ProgressBar ratio={progress.ratio} className="mt-2" />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {visionPreview.length > 0 && (
        <Card className="mt-6">
          <CardHeader
            title="Ta vision"
            action={
              <Link href="/vision" className="text-muted hover:text-text text-xs">
                Tout voir
              </Link>
            }
          />
          <div className="grid grid-cols-3 gap-2 p-4 sm:p-5">
            {visionPreview.map((item) =>
              item.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={item.id}
                  src={item.content}
                  alt={item.caption ?? ""}
                  className="aspect-square w-full rounded-sm object-cover"
                />
              ) : (
                <div
                  key={item.id}
                  className="bg-surface-2 flex aspect-square items-center justify-center rounded-sm p-2 text-center"
                >
                  <span className="font-display line-clamp-4 text-xs leading-snug">
                    {item.content}
                  </span>
                </div>
              ),
            )}
          </div>
        </Card>
      )}

      {leadStatement !== undefined && (
        <p className="font-display text-muted mt-6 text-lg leading-snug text-balance">
          {leadStatement}
        </p>
      )}

      <p className="text-faint mt-6 text-xs">
        Hier :{" "}
        <span className="tabular">
          {formatPercent(dailyScore(state.habits, index, addDays(today, -1)).score)}
        </span>
      </p>
    </main>
  );
}
