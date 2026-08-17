import {
  eachDay,
  endOfIsoWeek,
  endOfMonth,
  startOfIsoWeek,
  startOfMonth,
} from "./dates";
import { expectedOn, isQuota, quotaExpectations, ruleForDate } from "./scheduling";
import type { Habit, HabitCategory, HabitLog, LocalDate } from "./types";

/**
 * Scoring — CLAUDE.md §5.4.
 *
 * Trois règles à ne jamais violer :
 *  1. `completion` ∈ [0, 1]. Le dépassement est affiché, jamais scoré.
 *  2. Un jour sans habitude attendue vaut `null` (neutre), surtout pas 0.
 *  3. La consistance est Σ numérateurs / Σ dénominateurs — pas la moyenne des
 *     scores quotidiens.
 */

export type LogIndex = ReadonlyMap<string, HabitLog>;

function logKey(habitId: string, date: LocalDate): string {
  return `${habitId}|${date}`;
}

export function indexLogs(logs: readonly HabitLog[]): LogIndex {
  const index = new Map<string, HabitLog>();
  for (const log of logs) {
    index.set(logKey(log.habitId, log.localDate), log);
  }
  return index;
}

export function findLog(index: LogIndex, habitId: string, date: LocalDate): HabitLog | undefined {
  return index.get(logKey(habitId, date));
}

/** Ratio d'accomplissement d'une occurrence. Toujours borné à [0, 1]. */
export function computeCompletion(habit: Habit, log: HabitLog | undefined): number {
  if (log === undefined) return 0;

  if (habit.type === "boolean") {
    return log.completed ? 1 : 0;
  }

  const value = log.value ?? 0;
  const target = habit.targetValue;

  if (target === null || target <= 0) {
    // Pas de cible exploitable : on retombe sur une sémantique binaire.
    return habit.direction === "at_most" ? (value <= 0 ? 1 : 0) : value > 0 ? 1 : 0;
  }

  if (habit.direction === "at_most") {
    if (value <= target) return 1;
    return Math.max(0, 1 - (value - target) / target);
  }

  return Math.min(value / target, 1);
}

/** `true` uniquement si l'occurrence est pleinement accomplie. */
export function isFullyCompleted(habit: Habit, log: HabitLog | undefined): boolean {
  return computeCompletion(habit, log) === 1;
}

export interface DailyScore {
  date: LocalDate;
  /** `null` = jour neutre (aucune habitude datée attendue). */
  score: number | null;
  /** Nombre d'habitudes datées attendues ce jour. */
  expected: number;
  /** Nombre d'habitudes pleinement accomplies. À ne pas confondre avec `score`. */
  completed: number;
}

/**
 * Score du jour : moyenne pondérée des completions des habitudes à planning
 * DATÉ. Les habitudes à quota n'y entrent jamais (CLAUDE.md §5.2).
 */
export function dailyScore(habits: readonly Habit[], index: LogIndex, date: LocalDate): DailyScore {
  const expected = expectedOn(habits, date);

  let numerator = 0;
  let denominator = 0;
  let completed = 0;

  for (const habit of expected) {
    const log = findLog(index, habit.id, date);
    const completion = computeCompletion(habit, log);
    numerator += habit.weight * completion;
    denominator += habit.weight;
    if (completion === 1) completed += 1;
  }

  return {
    date,
    score: denominator === 0 ? null : numerator / denominator,
    expected: expected.length,
    completed,
  };
}

/**
 * Avancement d'une habitude à quota sur sa période courante — « 1 / 3 cette
 * semaine ». `null` si l'habitude n'est pas à quota ce jour-là.
 */
export function quotaProgress(
  habit: Habit,
  index: LogIndex,
  date: LocalDate,
): { done: number; target: number; periodStart: LocalDate; periodEnd: LocalDate } | null {
  const rule = ruleForDate(habit, date);
  if (rule === null || !isQuota(rule) || !("timesPerPeriod" in rule)) return null;

  const weekly = rule.kind === "times_per_week";
  const periodStart = weekly ? startOfIsoWeek(date) : startOfMonth(date);
  const periodEnd = weekly ? endOfIsoWeek(date) : endOfMonth(date);

  let done = 0;
  for (const day of eachDay(periodStart, periodEnd)) {
    if (isFullyCompleted(habit, findLog(index, habit.id, day))) done += 1;
  }

  return { done, target: rule.timesPerPeriod, periodStart, periodEnd };
}

export interface ConsistencyResult {
  /** `null` = rien n'était attendu sur la période. */
  score: number | null;
  numerator: number;
  denominator: number;
}

/**
 * Consistance sur un ensemble de dates arbitraire — uniquement la part datée.
 *
 * Sert aux découpes qui ne sont pas des intervalles continus : « tous les
 * lundis », « les week-ends ». Les habitudes à quota en sont exclues par
 * construction : une habitude « 3×/semaine » n'appartient à aucun jour, elle ne
 * peut donc pas être attribuée à un jour de la semaine.
 */
export function consistencyOnDates(
  habits: readonly Habit[],
  index: LogIndex,
  dates: readonly LocalDate[],
): ConsistencyResult {
  let numerator = 0;
  let denominator = 0;

  for (const date of dates) {
    for (const habit of expectedOn(habits, date)) {
      numerator += habit.weight * computeCompletion(habit, findLog(index, habit.id, date));
      denominator += habit.weight;
    }
  }

  return {
    score: denominator === 0 ? null : numerator / denominator,
    numerator,
    denominator,
  };
}

/**
 * Consistance sur une période, bornes incluses.
 *
 * ⚠️ Ce n'est PAS la moyenne des scores quotidiens : lundi 1 habitude ratée
 * puis mardi 8 réussies donnent 8/9 = 89%, pas 50%.
 */
export function consistency(
  habits: readonly Habit[],
  index: LogIndex,
  from: LocalDate,
  to: LocalDate,
): ConsistencyResult {
  // Part datée : chaque occurrence attendue pèse `weight`.
  const dated = consistencyOnDates(habits, index, eachDay(from, to));
  let numerator = dated.numerator;
  let denominator = dated.denominator;

  // Part quota : chaque période pèse `weight × cible proratisée`.
  for (const habit of habits) {
    for (const expectation of quotaExpectations(habit, from, to)) {
      if (expectation.target <= 0) continue;
      let done = 0;
      for (const date of eachDay(expectation.periodStart, expectation.periodEnd)) {
        if (isFullyCompleted(habit, findLog(index, habit.id, date))) done += 1;
      }
      numerator += habit.weight * Math.min(done, expectation.target);
      denominator += habit.weight * expectation.target;
    }
  }

  return {
    score: denominator === 0 ? null : numerator / denominator,
    numerator,
    denominator,
  };
}

/**
 * Même formule, filtrée par catégorie → scores par domaine de vie.
 * Aucune logique séparée : c'est le même calcul sur un sous-ensemble.
 */
export function consistencyByCategory(
  habits: readonly Habit[],
  index: LogIndex,
  from: LocalDate,
  to: LocalDate,
): Map<HabitCategory, ConsistencyResult> {
  const byCategory = new Map<HabitCategory, Habit[]>();
  for (const habit of habits) {
    const bucket = byCategory.get(habit.category);
    if (bucket === undefined) byCategory.set(habit.category, [habit]);
    else bucket.push(habit);
  }

  const results = new Map<HabitCategory, ConsistencyResult>();
  for (const [category, bucket] of byCategory) {
    results.set(category, consistency(bucket, index, from, to));
  }
  return results;
}
