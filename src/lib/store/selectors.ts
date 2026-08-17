"use client";

import { useMemo } from "react";

import {
  computeStreaks,
  consistency,
  consistencyByCategory,
  dailyScore,
  endOfIsoWeek,
  endOfMonth,
  indexLogs,
  startOfIsoWeek,
  startOfMonth,
  type Habit,
  type LocalDate,
  type LogIndex,
} from "@/lib/domain";

import { useStore } from "./StoreProvider";

/** Index des logs, mémoïsé : recalculé uniquement quand les logs changent. */
export function useLogIndex(): LogIndex {
  const { state } = useStore();
  return useMemo(() => indexLogs(state.logs), [state.logs]);
}

/** Habitudes non archivées, dans l'ordre de création. */
export function useActiveHabits(): Habit[] {
  const { state } = useStore();
  return useMemo(() => state.habits.filter((habit) => habit.endDate === null), [state.habits]);
}

export function useDailyScore(date: LocalDate) {
  const habits = useActiveHabits();
  const index = useLogIndex();
  return useMemo(() => dailyScore(habits, index, date), [habits, index, date]);
}

export function useStreaks() {
  const { state, today } = useStore();
  const index = useLogIndex();
  // Les habitudes archivées comptent : elles ont bien été tenues dans le passé.
  return useMemo(() => computeStreaks(state.habits, index, today), [state.habits, index, today]);
}

export function useWeekConsistency(date: LocalDate) {
  const { state } = useStore();
  const index = useLogIndex();
  return useMemo(
    () => consistency(state.habits, index, startOfIsoWeek(date), endOfIsoWeek(date)),
    [state.habits, index, date],
  );
}

export function useMonthConsistency(date: LocalDate) {
  const { state } = useStore();
  const index = useLogIndex();
  return useMemo(
    () => consistency(state.habits, index, startOfMonth(date), endOfMonth(date)),
    [state.habits, index, date],
  );
}

export function useCategoryConsistency(from: LocalDate, to: LocalDate) {
  const { state } = useStore();
  const index = useLogIndex();
  return useMemo(
    () => consistencyByCategory(state.habits, index, from, to),
    [state.habits, index, from, to],
  );
}
