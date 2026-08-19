"use client";

import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/AppShell";
import { MonthlyTrend } from "@/components/metrics/MonthlyTrend";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/Progress";
import {
  addDays,
  consistency,
  consistencyByCategory,
  consistencyOnDates,
  dailyScore,
  eachDay,
  goalCompletionRate,
  habitStreak,
  isoWeekday,
  type Habit,
  type LocalDate,
} from "@/lib/domain";
import { CATEGORY_LABELS, formatLongDate, WEEKDAYS } from "@/lib/labels";
import { useActiveHabits, useLogIndex, useStreaks } from "@/lib/store/selectors";
import { useStore } from "@/lib/store/StoreProvider";
import { cn, formatPercent } from "@/lib/utils";

const RANGES = [
  { days: 7, label: "7 jours" },
  { days: 30, label: "30 jours" },
  { days: 90, label: "90 jours" },
];

export default function AnalyticsPage() {
  const { state, today } = useStore();
  const index = useLogIndex();
  const habits = useActiveHabits();
  const streaks = useStreaks();
  const [days, setDays] = useState(30);

  const from: LocalDate = addDays(today, -(days - 1));
  const dates = useMemo(() => eachDay(from, today), [from, today]);

  const overall = useMemo(
    () => consistency(state.habits, index, from, today),
    [state.habits, index, from, today],
  );

  /** Même fenêtre, juste avant : c'est la comparaison qui rend un chiffre lisible. */
  const previous = useMemo(
    () => consistency(state.habits, index, addDays(from, -days), addDays(from, -1)),
    [state.habits, index, from, days],
  );

  const delta =
    overall.score === null || previous.score === null ? null : overall.score - previous.score;

  const trend = useMemo(
    () => dates.map((date) => ({ date, score: dailyScore(state.habits, index, date).score })),
    [dates, state.habits, index],
  );

  const byCategory = useMemo(
    () =>
      [...consistencyByCategory(state.habits, index, from, today)]
        .filter(([, result]) => result.denominator > 0)
        .sort((a, b) => (b[1].score ?? 0) - (a[1].score ?? 0)),
    [state.habits, index, from, today],
  );

  /**
   * Par jour de semaine : consistance pondérée sur les dates de ce jour, pas
   * moyenne des scores journaliers — cohérent avec le reste de la page.
   */
  const byWeekday = useMemo(
    () =>
      WEEKDAYS.map((day) => ({
        ...day,
        result: consistencyOnDates(
          state.habits,
          index,
          dates.filter((date) => isoWeekday(date) === day.iso),
        ),
      })),
    [state.habits, index, dates],
  );

  const byHabit = useMemo(
    () =>
      habits
        .map((habit) => ({
          habit,
          result: consistency([habit], index, from, today),
          streak: habitStreak(habit, index, today),
        }))
        .filter((entry) => entry.result.denominator > 0)
        .sort((a, b) => (b.result.score ?? 0) - (a.result.score ?? 0)),
    [habits, index, from, today],
  );

  const habitsById = useMemo(
    () => new Map<string, Habit>(state.habits.map((habit) => [habit.id, habit])),
    [state.habits],
  );
  const goalRate = useMemo(
    () => goalCompletionRate(state.goals, state.logs, habitsById, today, state.metricEntries),
    [state.goals, state.logs, habitsById, today, state.metricEntries],
  );

  const best = byHabit[0];
  const weakest = byHabit.length > 1 ? byHabit[byHabit.length - 1] : undefined;
  const totalCompleted = useMemo(
    () => state.logs.filter((log) => log.completed).length,
    [state.logs],
  );

  if (state.habits.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <PageHeader title="Analytics" />
        <Card>
          <EmptyState
            title="Pas encore de données"
            description="Les statistiques deviennent utiles après quelques semaines de suivi réel. Crée d'abord une habitude."
          />
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Analytics"
        subtitle="Consistance pondérée par occurrence attendue, pas moyenne des journées."
        action={
          <div className="border-border flex overflow-hidden rounded-md border">
            {RANGES.map((range) => (
              <button
                key={range.days}
                onClick={() => setDays(range.days)}
                className={cn(
                  "px-3 py-2 text-xs transition-colors",
                  days === range.days
                    ? "bg-surface-2 text-text"
                    : "text-muted hover:text-text",
                )}
              >
                {range.label}
              </button>
            ))}
          </div>
        }
      />

      <Card className="mb-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-faint text-xs">Consistance globale</p>
            <p className="tabular mt-1 text-4xl font-medium">{formatPercent(overall.score)}</p>
          </div>
          <DeltaPill delta={delta} />
        </div>

        <ProgressBar ratio={overall.score} className="mt-4" />

        <p className="text-faint tabular mt-3 text-xs">
          {round(overall.numerator)} occurrences tenues sur {round(overall.denominator)} attendues
          {" · depuis le "}
          {formatLongDate(from)}
        </p>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Série actuelle" value={String(streaks.current)} suffix="j" />
        <Metric label="Record" value={String(streaks.longest)} suffix="j" />
        <Metric
          label="Objectifs atteints"
          value={goalRate.total === 0 ? "—" : `${goalRate.completed}/${goalRate.total}`}
        />
        <Metric label="Total coché" value={String(totalCompleted)} />
      </div>

      <Card className="mb-4">
        <CardHeader title="Évolution" />
        <div className="p-4 sm:p-5">
          <div className="flex h-28 items-end gap-px">
            {trend.map((day) => (
              <div
                key={day.date}
                title={`${formatLongDate(day.date)} — ${formatPercent(day.score)}`}
                className="flex h-full flex-1 items-end"
              >
                <div
                  className={cn(
                    "w-full rounded-t-[1px]",
                    day.score === null ? "bg-border" : "bg-accent",
                  )}
                  style={{
                    height: `${day.score === null ? 3 : Math.max(3, day.score * 100)}%`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="text-faint mt-2 flex justify-between text-[10px]">
            <span>{formatLongDate(from)}</span>
            <span>aujourd&apos;hui</span>
          </div>
          <p className="text-faint mt-3 text-xs leading-relaxed">
            Les barres grises sont des jours neutres — aucune habitude n&apos;y était planifiée.
            Ils ne comptent ni en positif ni en négatif.
          </p>
        </div>
      </Card>

      <MonthlyTrend />

      <Card className="mb-4">
        <CardHeader title="Par domaine de vie" />
        {byCategory.length === 0 ? (
          <EmptyState title="Rien à répartir" description="Aucune occurrence attendue sur cette période." />
        ) : (
          <div className="space-y-3 p-4 sm:p-5">
            {byCategory.map(([category, result]) => (
              <Bar
                key={category}
                label={CATEGORY_LABELS[category]}
                ratio={result.score}
                detail={`${round(result.numerator)} / ${round(result.denominator)}`}
              />
            ))}
          </div>
        )}
      </Card>

      <Card className="mb-4">
        <CardHeader title="Par jour de la semaine" />
        <div className="grid grid-cols-7 gap-2 p-4 sm:p-5">
          {byWeekday.map((day) => (
            <div key={day.label} className="flex flex-col items-center gap-2">
              <div className="bg-surface-2 flex h-20 w-full items-end overflow-hidden rounded-sm">
                <div
                  className="bg-accent w-full rounded-sm transition-[height] duration-500"
                  style={{
                    height: `${day.result.score === null ? 2 : Math.max(2, day.result.score * 100)}%`,
                  }}
                />
              </div>
              <span className="text-faint text-[10px]">{day.short}</span>
              <span className="tabular text-muted text-[10px]">
                {day.result.score === null ? "—" : formatPercent(day.result.score)}
              </span>
            </div>
          ))}
        </div>
        <p className="text-faint px-4 pb-4 text-xs leading-relaxed sm:px-5">
          Les habitudes à quota sont exclues de cette découpe : « 3× par semaine » n&apos;appartient
          à aucun jour précis.
        </p>
      </Card>

      {best !== undefined && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Highlight
            tone="success"
            label="Habitude la plus tenue"
            title={best.habit.title}
            value={formatPercent(best.result.score)}
          />
          {weakest !== undefined && (
            <Highlight
              tone="warn"
              label="Celle qui décroche"
              title={weakest.habit.title}
              value={formatPercent(weakest.result.score)}
            />
          )}
        </div>
      )}

      <Card>
        <CardHeader title="Par habitude" />
        {byHabit.length === 0 ? (
          <EmptyState
            title="Rien à comparer"
            description="Aucune occurrence attendue sur cette période."
          />
        ) : (
          <div className="space-y-3 p-4 sm:p-5">
            {byHabit.map(({ habit, result, streak }) => (
              <Bar
                key={habit.id}
                label={habit.title}
                ratio={result.score}
                detail={
                  streak === null
                    ? `${round(result.numerator)} / ${round(result.denominator)}`
                    : `série ${streak.current}`
                }
              />
            ))}
          </div>
        )}
      </Card>
    </main>
  );
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function Metric({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <Card className="p-4">
      <p className="text-faint text-xs">{label}</p>
      <p className="tabular mt-1 text-xl font-medium">
        {value}
        {suffix !== undefined && <span className="text-faint text-sm"> {suffix}</span>}
      </p>
    </Card>
  );
}

function Bar({
  label,
  ratio,
  detail,
}: {
  label: string;
  ratio: number | null;
  detail: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
        <span className="text-muted truncate">{label}</span>
        <span className="flex shrink-0 items-baseline gap-2">
          <span className="text-faint tabular">{detail}</span>
          <span className="tabular">{formatPercent(ratio)}</span>
        </span>
      </div>
      <ProgressBar ratio={ratio} />
    </div>
  );
}

function DeltaPill({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="text-faint text-xs">pas de comparaison</span>;
  }

  const points = Math.round(delta * 100);
  const flat = points === 0;
  const up = points > 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs",
        flat ? "text-muted bg-surface-2" : up ? "text-success bg-success/10" : "text-warn bg-warn/10",
      )}
      title="Comparé à la période précédente de même durée"
    >
      {flat ? (
        <Minus className="size-3.5" />
      ) : up ? (
        <TrendingUp className="size-3.5" />
      ) : (
        <TrendingDown className="size-3.5" />
      )}
      <span className="tabular">
        {up ? "+" : ""}
        {points} pts
      </span>
    </span>
  );
}

function Highlight({
  tone,
  label,
  title,
  value,
}: {
  tone: "success" | "warn";
  label: string;
  title: string;
  value: string;
}) {
  return (
    <Card className="p-4">
      <p className="text-faint text-xs">{label}</p>
      <p className="mt-1 truncate text-sm font-medium">{title}</p>
      <p className={cn("tabular mt-1 text-lg", tone === "success" ? "text-success" : "text-warn")}>
        {value}
      </p>
    </Card>
  );
}
