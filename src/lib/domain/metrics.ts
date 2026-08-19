import {
  addDays,
  compareDates,
  endOfMonth,
  isoWeek,
  isoWeekStart,
  startOfMonth,
} from "./dates";
import { ratioFor } from "./scoring";
import type {
  LocalDate,
  Metric,
  MetricCadence,
  MetricEntry,
  MetricKind,
  MonthPeriod,
  Period,
} from "./types";

/**
 * Métriques mensuelles — outputs et results.
 *
 * ⚠️ La formule d'agrégation n'est PAS celle de `consistency`.
 *
 * `consistency` fait Σ numérateurs / Σ dénominateurs parce que ses termes sont
 * commensurables : une occurrence d'habitude vaut une occurrence d'habitude.
 * Les métriques ne le sont pas. Sur `{20 contenus, 300000 FCFA}`, un
 * Σ min(réalisé, cible) / Σ cible donnerait un dénominateur de 300 020 : le
 * chiffre d'affaires écraserait tout et le score d'exécution ne mesurerait plus
 * que le revenu.
 *
 * L'agrégation est donc une moyenne pondérée de ratios individuels — la forme
 * de `dailyScore`, où chaque habitude compte pour une habitude. Chaque métrique
 * compte pour une métrique, quelle que soit son unité.
 */

// ── Périodes ────────────────────────────────────────────────────────────────
//
// Une période est un mois (`2026-08`) ou une semaine ISO (`2026-W34`). Le
// format se suffit à lui-même : aucune fonction n'a besoin qu'on lui passe la
// cadence à côté, et un identifiant mal formé ne peut pas se faire passer pour
// l'autre cadence.

export function isWeekPeriod(period: Period): boolean {
  return period.includes("W");
}

export function cadenceOf(period: Period): MetricCadence {
  return isWeekPeriod(period) ? "weekly" : "monthly";
}

/** Le mois auquel appartient une date locale. */
export function monthPeriod(date: LocalDate): MonthPeriod {
  return date.slice(0, 7);
}

/** La semaine ISO à laquelle appartient une date locale. */
export function weekPeriod(date: LocalDate): Period {
  const { year, week } = isoWeek(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** La période d'une date, selon la cadence demandée. */
export function periodFor(cadence: MetricCadence, date: LocalDate): Period {
  return cadence === "weekly" ? weekPeriod(date) : monthPeriod(date);
}

export function periodStart(period: Period): LocalDate {
  if (!isWeekPeriod(period)) return `${period}-01`;
  return isoWeekStart(Number(period.slice(0, 4)), Number(period.slice(6)));
}

export function periodEnd(period: Period): LocalDate {
  const start = periodStart(period);
  return isWeekPeriod(period) ? addDays(start, 6) : endOfMonth(start);
}

/** Décale d'un nombre de périodes de même cadence. `-1` = la précédente. */
export function shiftPeriod(period: Period, amount: number): Period {
  if (isWeekPeriod(period)) {
    // Passer par les dates plutôt que par le numéro de semaine : les années
    // ISO font 52 ou 53 semaines, et un modulo fixe se tromperait une année
    // sur cinq.
    return weekPeriod(addDays(periodStart(period), amount * 7));
  }

  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  const total = year * 12 + (month - 1) + amount;
  const shiftedYear = Math.floor(total / 12);
  const shiftedMonth = total - shiftedYear * 12 + 1;
  return `${String(shiftedYear).padStart(4, "0")}-${String(shiftedMonth).padStart(2, "0")}`;
}

/**
 * Les semaines rattachées à un mois : celles dont le **lundi** y tombe.
 *
 * Une semaine ISO chevauche presque toujours deux mois ; il faut donc une règle,
 * et celle-ci a le mérite d'être énonçable en une phrase à l'utilisateur.
 * Chaque semaine appartient à exactement un mois, aucune n'est comptée deux
 * fois ni oubliée.
 */
export function weeksInMonth(month: MonthPeriod): Period[] {
  const monthStart = startOfMonth(periodStart(month));
  const monthEnd = endOfMonth(monthStart);
  const weeks: Period[] = [];

  let monday = periodStart(weekPeriod(monthStart));
  if (compareDates(monday, monthStart) < 0) monday = addDays(monday, 7);

  while (compareDates(monday, monthEnd) <= 0) {
    weeks.push(weekPeriod(monday));
    monday = addDays(monday, 7);
  }

  return weeks;
}

// ── Index ───────────────────────────────────────────────────────────────────

export type EntryIndex = ReadonlyMap<string, MetricEntry>;

function entryKey(metricId: string, period: Period): string {
  return `${metricId}|${period}`;
}

export function indexEntries(entries: readonly MetricEntry[]): EntryIndex {
  const index = new Map<string, MetricEntry>();
  for (const entry of entries) {
    index.set(entryKey(entry.metricId, entry.period), entry);
  }
  return index;
}

export function findEntry(
  index: EntryIndex,
  metricId: string,
  period: Period,
): MetricEntry | undefined {
  return index.get(entryKey(metricId, period));
}

// ── Ratio d'une métrique ────────────────────────────────────────────────────

/**
 * Ratio d'atteinte pour un mois, ou `null` si la métrique n'est pas scorable.
 *
 * `null` couvre quatre cas distincts, et aucun ne vaut zéro :
 *  - pas d'entrée pour ce mois : la métrique n'est pas au contrat ;
 *  - pas de cible : métrique d'observation (CTR, meilleure vidéo) ;
 *  - pas de valeur saisie : « je ne sais pas » n'est pas « j'ai échoué » ;
 *  - direction `maintain` : non scorée en V1.
 */
export function metricRatio(metric: Metric, entry: MetricEntry | undefined): number | null {
  if (entry === undefined) return null;
  if (metric.direction === "maintain") return null;

  const { target, actual } = entry;
  if (target === null || actual === null || target < 0) return null;

  const direction = metric.direction === "decrease" ? "at_most" : "at_least";

  if (target === 0) {
    // « Zéro cigarette » se score ; « atteindre zéro client » ne veut rien dire.
    return direction === "at_most" ? (actual <= 0 ? 1 : 0) : null;
  }

  return ratioFor(direction, actual, target);
}

/**
 * Distance à la cible, dans l'unité de la métrique. Toujours positive : c'est
 * un écart chiffré, pas un jugement. En `decrease` c'est le dépassement, en
 * `increase` ce qu'il manque.
 */
export function metricGap(metric: Metric, entry: MetricEntry | undefined): number | null {
  if (entry === undefined) return null;
  const { target, actual } = entry;
  if (target === null || actual === null) return null;

  if (metric.direction === "maintain") return Math.abs(actual - target);
  if (metric.direction === "decrease") return Math.max(0, actual - target);
  return Math.max(0, target - actual);
}

// ── Agrégation ──────────────────────────────────────────────────────────────

export interface MetricRow {
  metric: Metric;
  /** Pour une ligne agrégée, une entrée synthétique portant les sommes. */
  entry: MetricEntry;
  /** `null` = non scorable. La ligne reste affichée. */
  ratio: number | null;
  gap: number | null;
  reached: boolean;
  /** La ligne entre-t-elle au dénominateur du score de sa couche ? */
  scorable: boolean;
  /**
   * Présent quand la ligne résume plusieurs semaines dans un bilan mensuel.
   * L'écran doit le dire : « 14 / 20 » sur 3 semaines saisies ne se lit pas
   * comme « 14 / 20 » sur un mois entier.
   */
  rollup?: { weeksEntered: number; weeksInMonth: number };
}

export interface MetricsScore {
  /** `null` = rien de scorable ce mois-ci. Jamais 0 : c'est neutre, pas raté. */
  score: number | null;
  rows: MetricRow[];
  /** Métriques entrant au score. */
  scored: number;
  /** Métriques affichées, observation comprise. */
  tracked: number;
  reached: number;
}

/**
 * Les métriques au contrat d'un mois : celles qui ont une entrée pour ce mois.
 * Une métrique archivée avant le début du mois en sort — mais ses mois passés
 * gardent leurs lignes, l'historique ne se réécrit pas.
 */
export function metricsForPeriod(
  metrics: readonly Metric[],
  index: EntryIndex,
  period: Period,
  kind?: MetricKind,
): MetricRow[] {
  const start = periodStart(period);
  const cadence = cadenceOf(period);
  const rows: MetricRow[] = [];

  for (const metric of metrics) {
    if (kind !== undefined && metric.kind !== kind) continue;
    if (metric.archivedAt !== null && compareDates(metric.archivedAt, start) < 0) continue;

    // Une métrique hebdomadaire vue depuis un mois passe par l'agrégation, pas
    // par une entrée directe : elle n'en a pas pour cette période.
    if (metric.cadence !== cadence) {
      if (cadence === "monthly" && metric.cadence === "weekly") {
        const rolled = rollupWeeks(metric, index, period);
        if (rolled !== null) rows.push(rolled);
      }
      continue;
    }

    const entry = findEntry(index, metric.id, period);
    if (entry === undefined) continue;

    const ratio = metricRatio(metric, entry);
    rows.push({
      metric,
      entry,
      ratio,
      gap: metricGap(metric, entry),
      reached: ratio === 1,
      scorable: ratio !== null,
    });
  }

  return rows.sort(compareRows);
}

/**
 * Une métrique hebdomadaire, résumée sur un mois.
 *
 * La somme est ici parfaitement légitime, contrairement à celle qu'on refuse
 * entre métriques : ce sont les mêmes semaines de la même métrique, dans la
 * même unité. 3 + 5 + 4 contenus font bien 12 contenus.
 *
 * Seules les semaines **effectivement saisies** entrent dans le total, cible
 * comprise. Compter la cible d'une semaine dont on n'a pas relevé le résultat
 * transformerait un mois en cours en échec dès le premier lundi, et un oubli
 * de saisie en faute.
 */
function rollupWeeks(metric: Metric, index: EntryIndex, month: MonthPeriod): MetricRow | null {
  const weeks = weeksInMonth(month);
  let target = 0;
  let actual = 0;
  let entered = 0;
  let hasTarget = false;

  for (const week of weeks) {
    const entry = findEntry(index, metric.id, week);
    if (entry === undefined || entry.actual === null) continue;

    entered += 1;
    actual += entry.actual;
    if (entry.target !== null) {
      target += entry.target;
      hasTarget = true;
    }
  }

  if (entered === 0) return null;

  const entry: MetricEntry = {
    metricId: metric.id,
    period: month,
    target: hasTarget ? target : null,
    actual,
    note: null,
  };
  const ratio = metricRatio(metric, entry);

  return {
    metric,
    entry,
    ratio,
    gap: metricGap(metric, entry),
    reached: ratio === 1,
    scorable: ratio !== null,
    rollup: { weeksEntered: entered, weeksInMonth: weeks.length },
  };
}

/**
 * Score d'une couche sur un mois : moyenne pondérée des ratios individuels.
 * Voir l'avertissement en tête de fichier — ce n'est volontairement pas la
 * formule de `consistency`.
 */
export function metricsScore(
  metrics: readonly Metric[],
  index: EntryIndex,
  period: Period,
  kind?: MetricKind,
): MetricsScore {
  const rows = metricsForPeriod(metrics, index, period, kind);

  let numerator = 0;
  let denominator = 0;
  let scored = 0;
  let reached = 0;

  for (const row of rows) {
    if (row.reached) reached += 1;
    if (row.ratio === null) continue;
    numerator += row.metric.weight * row.ratio;
    denominator += row.metric.weight;
    scored += 1;
  }

  return {
    score: denominator === 0 ? null : numerator / denominator,
    rows,
    scored,
    tracked: rows.length,
    reached,
  };
}

/**
 * Somme des valeurs d'une métrique sur un intervalle de mois, bornes incluses.
 * C'est par là qu'un objectif annuel s'alimente d'une métrique mensuelle sans
 * jamais stocker le chiffre une seconde fois.
 */
export function sumMetric(
  entries: readonly MetricEntry[],
  metricId: string,
  fromPeriod: Period,
  toPeriod: Period,
): number {
  let total = 0;
  for (const entry of entries) {
    if (entry.metricId !== metricId) continue;
    if (entry.period < fromPeriod || entry.period > toPeriod) continue;
    total += entry.actual ?? 0;
  }
  return total;
}

/**
 * Reconduire des métriques d'un mois sur le suivant — le cœur de « démarrer un
 * nouveau mois ».
 *
 * **La cible se reconduit, la valeur jamais.** Repartir avec le réalisé du mois
 * précédent afficherait un mois déjà à moitié joué au matin du 1er, et le score
 * d'un mois neuf serait celui de l'ancien.
 *
 * Retourne uniquement les lignes à ajouter : une métrique déjà au contrat du
 * mois d'arrivée n'est pas écrasée, sinon reconduire deux fois effacerait une
 * cible qu'on venait de relever.
 */
export function carryOverEntries(
  entries: readonly MetricEntry[],
  from: Period,
  to: Period,
  metricIds: readonly string[],
): MetricEntry[] {
  const index = indexEntries(entries);
  const wanted = new Set(metricIds);
  const added: MetricEntry[] = [];

  for (const metricId of wanted) {
    const source = findEntry(index, metricId, from);
    if (source === undefined) continue;
    if (findEntry(index, metricId, to) !== undefined) continue;

    added.push({ metricId, period: to, target: source.target, actual: null, note: null });
  }

  return added;
}

/**
 * Ce qui reste à faire d'abord, ce qui est acquis ensuite, l'observation en
 * dernier — même parti pris que le bilan mensuel : on regarde le manque avant
 * de regarder le succès.
 */
function compareRows(a: MetricRow, b: MetricRow): number {
  if (a.scorable !== b.scorable) return a.scorable ? -1 : 1;
  if (a.reached !== b.reached) return a.reached ? 1 : -1;
  return (b.ratio ?? 0) - (a.ratio ?? 0);
}
