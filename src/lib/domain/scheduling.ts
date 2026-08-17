import {
  addDays,
  compareDates,
  dayOfMonth,
  daysInMonth,
  diffDays,
  endOfIsoWeek,
  endOfMonth,
  isWithin,
  isoWeekday,
  maxDate,
  minDate,
  startOfIsoWeek,
  startOfMonth,
} from "./dates";
import type { Habit, LocalDate, ScheduleRule, ScheduleVersion } from "./types";

/**
 * Planning — CLAUDE.md §5.2 et §5.3.
 *
 * Deux invariants gouvernent ce fichier :
 *  1. Une habitude à quota n'est attendue AUCUN jour précis.
 *  2. Un jour passé est évalué avec la règle en vigueur ce jour-là.
 */

export function isDateBound(rule: ScheduleRule): boolean {
  return rule.kind === "daily" || rule.kind === "days_of_week" || rule.kind === "days_of_month";
}

export function isQuota(rule: ScheduleRule): boolean {
  return rule.kind === "times_per_week" || rule.kind === "times_per_month";
}

/** Version de planning en vigueur à cette date, ou `null` hors fenêtre d'activité. */
export function versionForDate(habit: Habit, date: LocalDate): ScheduleVersion | null {
  if (!isWithin(date, habit.startDate, habit.endDate)) return null;
  return (
    habit.schedules.find((candidate) =>
      isWithin(date, candidate.effectiveFrom, candidate.effectiveTo),
    ) ?? null
  );
}

/** Règle en vigueur pour cette habitude à cette date, ou `null` hors fenêtre d'activité. */
export function ruleForDate(habit: Habit, date: LocalDate): ScheduleRule | null {
  return versionForDate(habit, date)?.rule ?? null;
}

/**
 * L'habitude est-elle attendue ce jour précis ?
 * Toujours `false` pour un planning à quota : une habitude « 3×/semaine » ne
 * peut pas rater un lundi.
 */
export function isScheduledOn(habit: Habit, date: LocalDate): boolean {
  const rule = ruleForDate(habit, date);
  if (rule === null) return false;

  switch (rule.kind) {
    case "daily":
      return true;
    case "days_of_week":
      return rule.daysOfWeek.includes(isoWeekday(date));
    case "days_of_month": {
      const day = dayOfMonth(date);
      const lastDay = daysInMonth(date);
      // Un « 31 » demandé sur un mois de 30 jours retombe sur le dernier jour.
      return rule.daysOfMonth.some((target) => target === day || (target > lastDay && day === lastDay));
    }
    case "times_per_week":
    case "times_per_month":
      return false;
  }
}

/** Habitudes à planning daté attendues ce jour — le dénominateur du score quotidien. */
export function expectedOn(habits: readonly Habit[], date: LocalDate): Habit[] {
  return habits.filter((habit) => isScheduledOn(habit, date));
}

/** Habitudes à quota actives ce jour — affichées dans Today en section « Disponibles ». */
export function quotaHabitsOn(habits: readonly Habit[], date: LocalDate): Habit[] {
  return habits.filter((habit) => {
    const rule = ruleForDate(habit, date);
    return rule !== null && isQuota(rule);
  });
}

export interface QuotaExpectation {
  habitId: string;
  periodStart: LocalDate;
  periodEnd: LocalDate;
  /**
   * Cible attendue sur la portion de période couverte par l'intervalle analysé.
   * Proratisée : une semaine complète vaut N, trois jours de semaine valent 3N/7.
   * Sans proratisation, la consistance d'une semaine en cours serait
   * artificiellement basse dès le lundi.
   */
  target: number;
}

/**
 * Découpe l'intervalle en périodes (semaines ISO ou mois) et calcule la cible
 * attendue de chaque habitude à quota sur chacune.
 */
export function quotaExpectations(habit: Habit, from: LocalDate, to: LocalDate): QuotaExpectation[] {
  const expectations: QuotaExpectation[] = [];
  let cursor = from;

  while (compareDates(cursor, to) <= 0) {
    const version = versionForDate(habit, cursor);
    const rule = version?.rule;

    if (rule === undefined || !isQuota(rule) || !("timesPerPeriod" in rule)) {
      // Pas de quota en vigueur ce jour-là : on avance d'un jour.
      cursor = addDays(cursor, 1);
      continue;
    }

    const weekly = rule.kind === "times_per_week";
    const fullStart = weekly ? startOfIsoWeek(cursor) : startOfMonth(cursor);
    const fullEnd = weekly ? endOfIsoWeek(cursor) : endOfMonth(cursor);

    const periodStart = maxDate(fullStart, cursor);
    // On borne aussi sur la fin de la version : si le planning change en cours de
    // semaine, la portion suivante sera traitée à l'itération d'après.
    const versionEnd = version?.effectiveTo ?? null;
    const periodEnd = versionEnd === null ? minDate(fullEnd, to) : minDate(minDate(fullEnd, to), versionEnd);

    const covered = diffDays(periodEnd, periodStart) + 1;
    const length = diffDays(fullEnd, fullStart) + 1;

    expectations.push({
      habitId: habit.id,
      periodStart,
      periodEnd,
      target: (rule.timesPerPeriod * covered) / length,
    });

    cursor = addDays(periodEnd, 1);
  }

  return expectations;
}
