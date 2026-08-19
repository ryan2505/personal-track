import { compareDates, endOfMonth } from "./dates";
import { ratioFor } from "./scoring";
import type {
  LocalDate,
  Metric,
  MetricEntry,
  MetricKind,
  MonthPeriod,
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

/** Le mois auquel appartient une date locale. */
export function monthPeriod(date: LocalDate): MonthPeriod {
  return date.slice(0, 7);
}

export function periodStart(period: MonthPeriod): LocalDate {
  return `${period}-01`;
}

export function periodEnd(period: MonthPeriod): LocalDate {
  return endOfMonth(periodStart(period));
}

/** Décale d'un nombre de mois. `-1` = le mois précédent. */
export function shiftPeriod(period: MonthPeriod, months: number): MonthPeriod {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  const total = year * 12 + (month - 1) + months;
  const shiftedYear = Math.floor(total / 12);
  const shiftedMonth = total - shiftedYear * 12 + 1;
  return `${String(shiftedYear).padStart(4, "0")}-${String(shiftedMonth).padStart(2, "0")}`;
}

// ── Index ───────────────────────────────────────────────────────────────────

export type EntryIndex = ReadonlyMap<string, MetricEntry>;

function entryKey(metricId: string, period: MonthPeriod): string {
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
  period: MonthPeriod,
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
  entry: MetricEntry;
  /** `null` = non scorable. La ligne reste affichée. */
  ratio: number | null;
  gap: number | null;
  reached: boolean;
  /** La ligne entre-t-elle au dénominateur du score de sa couche ? */
  scorable: boolean;
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
  period: MonthPeriod,
  kind?: MetricKind,
): MetricRow[] {
  const start = periodStart(period);
  const rows: MetricRow[] = [];

  for (const metric of metrics) {
    if (kind !== undefined && metric.kind !== kind) continue;
    if (metric.archivedAt !== null && compareDates(metric.archivedAt, start) < 0) continue;

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
 * Score d'une couche sur un mois : moyenne pondérée des ratios individuels.
 * Voir l'avertissement en tête de fichier — ce n'est volontairement pas la
 * formule de `consistency`.
 */
export function metricsScore(
  metrics: readonly Metric[],
  index: EntryIndex,
  period: MonthPeriod,
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
  fromPeriod: MonthPeriod,
  toPeriod: MonthPeriod,
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
  from: MonthPeriod,
  to: MonthPeriod,
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
