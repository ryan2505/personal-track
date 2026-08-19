import {
  addDays,
  computeCompletion,
  computeStreaks,
  consistency,
  consistencyByCategory,
  dailyScore,
  eachDay,
  endOfIsoWeek,
  endOfMonth,
  expectedOn,
  findLog,
  goalProgress,
  habitStreak,
  indexLogs,
  resolveCurrentValue,
  startOfIsoWeek,
  startOfMonth,
  type Habit,
  type LocalDate,
} from "@/lib/domain";
import { CATEGORY_LABELS, describeRuleFallback, formatValue } from "@/lib/labels";
import type { AppState } from "@/lib/store/state";

import { roundScore, SNAPSHOT_VERSION, type ShareSnapshot } from "./snapshot";

/**
 * Construit l'instantané à partir des réglages de partage.
 *
 * Fonction unique, utilisée par l'aperçu ET par la republication automatique :
 * il ne doit pas exister deux chemins susceptibles de diverger sur ce qui sort
 * de l'appareil. Chaque bloc est strictement conditionné à un réglage.
 */
export function buildSnapshot(state: AppState, today: LocalDate): ShareSnapshot {
  const settings = state.shareSettings;
  const index = indexLogs(state.logs);
  const active = state.habits.filter((habit) => habit.endDate === null);

  const built: ShareSnapshot = {
    v: SNAPSHOT_VERSION,
    name: state.profile.displayName,
    date: today,
  };

  if (settings.note.trim() !== "") built.note = settings.note.trim();

  if (settings.daily) built.daily = roundScore(dailyScore(state.habits, index, today).score);

  if (settings.streak) {
    const streaks = computeStreaks(state.habits, index, today);
    built.streak = { current: streaks.current, longest: streaks.longest };
  }

  if (settings.consistency) {
    built.week = roundScore(
      consistency(state.habits, index, startOfIsoWeek(today), endOfIsoWeek(today)).score,
    );
    built.month = roundScore(
      consistency(state.habits, index, startOfMonth(today), endOfMonth(today)).score,
    );
  }

  if (settings.week) {
    built.spark = eachDay(addDays(today, -6), today).map((date) =>
      roundScore(dailyScore(state.habits, index, date).score),
    );
  }

  if (settings.calendar) {
    const monthStart = startOfMonth(today);
    built.calendar = {
      from: monthStart,
      // Du 1er à aujourd'hui : les jours à venir n'ont rien à montrer.
      scores: eachDay(monthStart, today).map((date) =>
        roundScore(dailyScore(state.habits, index, date).score),
      ),
    };
  }

  if (settings.tracking) {
    built.tracking = expectedOn(state.habits, today).map((habit) => {
      const log = findLog(index, habit.id, today);
      return {
        title: habit.title,
        completion: computeCompletion(habit, log),
        detail: habit.type === "boolean" ? "" : formatValue(habit, log?.value ?? 0),
      };
    });
  }

  if (settings.areas) {
    built.areas = [...consistencyByCategory(state.habits, index, startOfMonth(today), today)]
      .filter(([, result]) => result.score !== null)
      .map(([category, result]) => ({
        label: CATEGORY_LABELS[category],
        score: roundScore(result.score) ?? 0,
      }))
      .sort((a, b) => b.score - a.score);
  }

  if (settings.goals) {
    const habitsById = new Map<string, Habit>(state.habits.map((habit) => [habit.id, habit]));
    built.goals = state.goals
      .filter((goal) => goal.status !== "abandoned")
      .map((goal) => {
        const current = resolveCurrentValue(
          goal,
          state.logs,
          habitsById,
          today,
          state.metricEntries,
        );
        const progress = goalProgress(goal, current);
        return {
          title: goal.title,
          current,
          target: progress.target,
          ratio: roundScore(progress.ratio),
        };
      });
  }

  if (settings.habits) {
    built.habits = active.map((habit) => {
      const rule = habit.schedules.find((version) => version.effectiveTo === null)?.rule;
      return {
        title: habit.title,
        schedule: describeRuleFallback(rule),
        streak: habitStreak(habit, index, today)?.current ?? null,
      };
    });
  }

  return built;
}
