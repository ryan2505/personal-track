import { formatInTimeZone } from "date-fns-tz";

import type { LocalDate } from "./types";

/**
 * Arithmétique de dates locales — CLAUDE.md §5.1.
 *
 * Règle : la conversion timezone → date locale se fait UNE SEULE FOIS, à
 * l'écriture, via `toLocalDate` / `localToday`. Tout le reste du système
 * raisonne en dates nues `YYYY-MM-DD`.
 *
 * L'arithmétique interne passe par des instants UTC minuit : pas de DST, pas de
 * décalage surprise. Aucune fonction de ce fichier hors des deux frontières
 * ci-dessous ne doit connaître de fuseau horaire.
 */

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

export function isLocalDate(value: string): boolean {
  if (!LOCAL_DATE_PATTERN.test(value)) return false;
  const parsed = parseLocalDate(value);
  return formatDate(parsed) === value;
}

export function assertLocalDate(value: string): LocalDate {
  if (!isLocalDate(value)) {
    throw new Error(`LocalDate invalide : "${value}" (attendu YYYY-MM-DD)`);
  }
  return value;
}

// ── Frontières timezone ──────────────────────────────────────────────────────

/** Le « aujourd'hui » de l'utilisateur, dans SON fuseau. */
export function localToday(timeZone: string, now: Date = new Date()): LocalDate {
  return formatInTimeZone(now, timeZone, "yyyy-MM-dd");
}

/** Convertit un instant en date locale. À n'appeler qu'au moment de l'écriture. */
export function toLocalDate(instant: Date, timeZone: string): LocalDate {
  return formatInTimeZone(instant, timeZone, "yyyy-MM-dd");
}

// ── Arithmétique pure ────────────────────────────────────────────────────────

/** Instant UTC minuit correspondant à la date. Usage interne / comparaisons. */
export function parseLocalDate(date: LocalDate): Date {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(instant: Date): LocalDate {
  return instant.toISOString().slice(0, 10);
}

export function addDays(date: LocalDate, amount: number): LocalDate {
  return formatDate(new Date(parseLocalDate(date).getTime() + amount * MS_PER_DAY));
}

/** Nombre de jours de `from` vers `to`. Positif si `to` est après `from`. */
export function diffDays(to: LocalDate, from: LocalDate): number {
  return Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / MS_PER_DAY);
}

/** < 0 si `a` précède `b`, 0 si égales, > 0 sinon. */
export function compareDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minDate(a: LocalDate, b: LocalDate): LocalDate {
  return a <= b ? a : b;
}

export function maxDate(a: LocalDate, b: LocalDate): LocalDate {
  return a >= b ? a : b;
}

/** Bornes incluses. `to === null` = pas de borne haute. */
export function isWithin(date: LocalDate, from: LocalDate, to: LocalDate | null): boolean {
  if (compareDates(date, from) < 0) return false;
  if (to !== null && compareDates(date, to) > 0) return false;
  return true;
}

/** Jour ISO : 1 = lundi … 7 = dimanche. */
export function isoWeekday(date: LocalDate): number {
  return ((parseLocalDate(date).getUTCDay() + 6) % 7) + 1;
}

export function dayOfMonth(date: LocalDate): number {
  return parseLocalDate(date).getUTCDate();
}

export function daysInMonth(date: LocalDate): number {
  const instant = parseLocalDate(date);
  return new Date(Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth() + 1, 0)).getUTCDate();
}

export function startOfIsoWeek(date: LocalDate): LocalDate {
  return addDays(date, -(isoWeekday(date) - 1));
}

export function endOfIsoWeek(date: LocalDate): LocalDate {
  return addDays(startOfIsoWeek(date), 6);
}

/**
 * Numéro de semaine ISO et son année.
 *
 * L'année ISO n'est pas l'année civile : une semaine appartient à l'année de
 * son **jeudi**. Le 29 décembre 2025 est un lundi de la semaine 1 de 2026, et
 * le 1er janvier 2021 tombe encore dans la semaine 53 de 2020. Sans cette
 * règle, deux semaines de décembre et janvier porteraient le même identifiant
 * et écraseraient leurs cibles l'une l'autre.
 */
export function isoWeek(date: LocalDate): { year: number; week: number } {
  const monday = startOfIsoWeek(date);
  const year = Number(addDays(monday, 3).slice(0, 4));
  // Le 4 janvier appartient toujours à la semaine 1, quelle que soit l'année.
  const firstMonday = startOfIsoWeek(`${year}-01-04`);
  return { year, week: Math.round(diffDays(monday, firstMonday) / 7) + 1 };
}

/** Lundi d'une semaine ISO donnée. Inverse exact de `isoWeek`. */
export function isoWeekStart(year: number, week: number): LocalDate {
  return addDays(startOfIsoWeek(`${year}-01-04`), (week - 1) * 7);
}

export function startOfMonth(date: LocalDate): LocalDate {
  return `${date.slice(0, 8)}01`;
}

export function endOfMonth(date: LocalDate): LocalDate {
  return `${date.slice(0, 8)}${String(daysInMonth(date)).padStart(2, "0")}`;
}

/** Toutes les dates de `from` à `to`, bornes incluses. */
export function eachDay(from: LocalDate, to: LocalDate): LocalDate[] {
  const days: LocalDate[] = [];
  for (let cursor = from; compareDates(cursor, to) <= 0; cursor = addDays(cursor, 1)) {
    days.push(cursor);
  }
  return days;
}
