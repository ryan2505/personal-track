import { compareDates, diffDays, eachDay } from "./dates";
import { isQuota, isScheduledOn, ruleForDate } from "./scheduling";
import { dailyScore, isFullyCompleted, findLog, type LogIndex } from "./scoring";
import type { Habit, LocalDate } from "./types";

/**
 * Streaks — CLAUDE.md §5.4.
 *
 * Quatre règles :
 *  1. Les jours neutres (aucune habitude attendue) sont SAUTÉS, pas cassants.
 *  2. Le jour courant ne casse jamais la série tant qu'il n'est pas terminé.
 *  3. Un joker par fenêtre glissante de 7 jours maintient la continuité sans
 *     incrémenter le compteur.
 *  4. `current` et `longest` utilisent exactement les mêmes règles — sinon la
 *     série courante peut dépasser le record, ce qui est absurde.
 */

/** Valeur de travail, décision §14.2 en attente de validation. */
export const STREAK_THRESHOLD = 0.8;
export const FREEZE_WINDOW_DAYS = 7;

export interface StreakResult {
  current: number;
  longest: number;
  /** Jokers consommés dans la série en cours. Affiché honnêtement à l'utilisateur. */
  freezesUsed: number;
}

function canFreeze(usedFreezes: readonly LocalDate[], date: LocalDate): boolean {
  return !usedFreezes.some((used) => Math.abs(diffDays(date, used)) < FREEZE_WINDOW_DAYS);
}

/**
 * Série globale, calculée en un seul passage avant du premier jour d'activité
 * jusqu'à aujourd'hui.
 */
export function computeStreaks(
  habits: readonly Habit[],
  index: LogIndex,
  today: LocalDate,
  threshold: number = STREAK_THRESHOLD,
): StreakResult {
  const start = habits.reduce<LocalDate | null>(
    (earliest, habit) =>
      earliest === null || compareDates(habit.startDate, earliest) < 0 ? habit.startDate : earliest,
    null,
  );

  if (start === null || compareDates(start, today) > 0) {
    return { current: 0, longest: 0, freezesUsed: 0 };
  }

  let run = 0;
  let longest = 0;
  let freezes: LocalDate[] = [];

  for (const date of eachDay(start, today)) {
    const { score } = dailyScore(habits, index, date);

    if (score === null) continue; // jour neutre

    if (score >= threshold) {
      run += 1;
      if (run > longest) longest = run;
      continue;
    }

    if (date === today) continue; // journée en cours, pas encore jouée

    if (canFreeze(freezes, date)) {
      freezes.push(date);
      continue; // continuité maintenue, compteur inchangé
    }

    run = 0;
    freezes = [];
  }

  return { current: run, longest, freezesUsed: freezes.length };
}

/**
 * Série d'une habitude : occurrences ATTENDUES consécutives pleinement
 * accomplies. Les jours non planifiés sont sautés — une habitude Lun/Mer/Ven
 * tenue trois semaines vaut 9, pas 1.
 *
 * Retourne `null` pour une habitude à quota : aucune occurrence datée, donc
 * aucune série journalière n'a de sens.
 */
export function habitStreak(
  habit: Habit,
  index: LogIndex,
  today: LocalDate,
): { current: number; longest: number } | null {
  const rule = ruleForDate(habit, today);
  if (rule !== null && isQuota(rule)) return null;

  if (compareDates(habit.startDate, today) > 0) {
    return { current: 0, longest: 0 };
  }

  let run = 0;
  let longest = 0;

  for (const date of eachDay(habit.startDate, today)) {
    if (!isScheduledOn(habit, date)) continue;

    if (isFullyCompleted(habit, findLog(index, habit.id, date))) {
      run += 1;
      if (run > longest) longest = run;
      continue;
    }

    if (date === today) continue; // occurrence du jour encore ouverte
    run = 0;
  }

  return { current: run, longest };
}
