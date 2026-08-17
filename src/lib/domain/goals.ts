import { compareDates, diffDays, isWithin, minDate } from "./dates";
import { isFullyCompleted } from "./scoring";
import type { Goal, GoalStatus, Habit, HabitLog, LocalDate } from "./types";

/**
 * Objectifs — CLAUDE.md §5.4.
 *
 * Le pari central du produit : un objectif mesurable peut être alimenté
 * automatiquement par les logs de ses habitudes liées. Sans ça, Goals et Habits
 * sont deux listes indépendantes affichées côte à côte.
 */

/**
 * Valeur courante de l'objectif.
 * - `manual`      → la saisie de l'utilisateur
 * - `habit_count` → nombre d'occurrences pleinement accomplies
 * - `habit_sum`   → somme des valeurs enregistrées
 */
export function resolveCurrentValue(
  goal: Goal,
  logs: readonly HabitLog[],
  habitsById: ReadonlyMap<string, Habit>,
  today: LocalDate,
): number {
  if (goal.source === "manual") return goal.currentValue;

  const linked = new Set(goal.habitIds);
  const windowEnd = goal.dueDate === null ? today : minDate(goal.dueDate, today);
  let total = 0;

  for (const log of logs) {
    if (!linked.has(log.habitId)) continue;
    if (!isWithin(log.localDate, goal.startDate, windowEnd)) continue;

    const habit = habitsById.get(log.habitId);
    if (habit === undefined) continue;

    if (goal.source === "habit_count") {
      if (isFullyCompleted(habit, log)) total += 1;
    } else {
      total += log.value ?? 0;
    }
  }

  return total;
}

export interface GoalProgress {
  current: number;
  target: number | null;
  /** Borné à [0, 1]. `null` si l'objectif n'est pas mesurable. */
  ratio: number | null;
  status: GoalStatus;
}

export function goalProgress(goal: Goal, current: number): GoalProgress {
  const target = goal.targetValue;

  if (target === null || target <= 0) {
    return {
      current,
      target,
      ratio: null,
      status: goal.status,
    };
  }

  const ratio = Math.min(current / target, 1);
  return { current, target, ratio, status: deriveStatus(goal.status, ratio) };
}

/** `abandoned` reste toujours manuel : la progression ne le réécrit jamais. */
export function deriveStatus(current: GoalStatus, ratio: number): GoalStatus {
  if (current === "abandoned") return "abandoned";
  if (ratio >= 1) return "completed";
  if (ratio > 0) return "in_progress";
  return "not_started";
}

export interface GoalPace {
  /** Part du temps écoulé sur la fenêtre de l'objectif, bornée à [0, 1]. */
  elapsedRatio: number;
  /** Avance (> 0) ou retard (< 0) en points de progression. */
  delta: number;
  onTrack: boolean;
  daysRemaining: number;
}

/**
 * « 3/5, 12 jours restants → sur la trajectoire / en retard. »
 * Bien plus actionnable qu'une barre de progression seule.
 * `null` si l'objectif n'a pas d'échéance ou n'est pas mesurable.
 */
export function goalPace(goal: Goal, ratio: number | null, today: LocalDate): GoalPace | null {
  if (goal.dueDate === null || ratio === null) return null;

  const totalDays = diffDays(goal.dueDate, goal.startDate) + 1;
  if (totalDays <= 0) return null;

  const elapsedDays = Math.min(Math.max(diffDays(today, goal.startDate) + 1, 0), totalDays);
  const elapsedRatio = elapsedDays / totalDays;
  const daysRemaining = Math.max(diffDays(goal.dueDate, today), 0);

  return {
    elapsedRatio,
    delta: ratio - elapsedRatio,
    onTrack: ratio >= elapsedRatio,
    daysRemaining,
  };
}

/** Progression d'un objectif partagé : somme des contributions de tous les participants. */
export function sharedGoalProgress(
  contributions: ReadonlyArray<{ userId: string; value: number }>,
  target: number,
): { total: number; ratio: number; byUser: Map<string, number> } {
  const byUser = new Map<string, number>();
  let total = 0;

  for (const contribution of contributions) {
    total += contribution.value;
    byUser.set(contribution.userId, (byUser.get(contribution.userId) ?? 0) + contribution.value);
  }

  return { total, ratio: target > 0 ? Math.min(total / target, 1) : 0, byUser };
}

/**
 * Taux d'atteinte des objectifs sur une période.
 * Les objectifs abandonnés sont exclus du dénominateur : renoncer
 * explicitement à un objectif n'est pas un échec d'exécution.
 */
export function goalCompletionRate(
  goals: readonly Goal[],
  logs: readonly HabitLog[],
  habitsById: ReadonlyMap<string, Habit>,
  today: LocalDate,
): { completed: number; total: number; ratio: number | null } {
  const considered = goals.filter((goal) => goal.status !== "abandoned");
  if (considered.length === 0) return { completed: 0, total: 0, ratio: null };

  let completed = 0;
  for (const goal of considered) {
    const current = resolveCurrentValue(goal, logs, habitsById, today);
    const { status } = goalProgress(goal, current);
    if (status === "completed") completed += 1;
  }

  return { completed, total: considered.length, ratio: completed / considered.length };
}

/** Objectifs actifs à une date donnée, du plus urgent au moins urgent. */
export function activeGoalsOn(goals: readonly Goal[], date: LocalDate): Goal[] {
  return goals
    .filter(
      (goal) =>
        goal.status !== "abandoned" &&
        compareDates(goal.startDate, date) <= 0 &&
        (goal.dueDate === null || compareDates(date, goal.dueDate) <= 0),
    )
    .sort((a, b) => {
      if (a.dueDate === null) return b.dueDate === null ? 0 : 1;
      if (b.dueDate === null) return -1;
      return compareDates(a.dueDate, b.dueDate);
    });
}
