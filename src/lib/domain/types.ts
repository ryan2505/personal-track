/**
 * Types du domaine — CLAUDE.md §2 (vocabulaire) et §5 (invariants).
 *
 * Ces types sont volontairement découplés des lignes Supabase : la couche
 * `queries/` fait la traduction. Le domaine ne connaît ni React ni Postgres.
 */

/** Date locale de l'utilisateur, format `YYYY-MM-DD`. Jamais un instant UTC. */
export type LocalDate = string;

/** Mois local, format `YYYY-MM`. Unité de période des métriques mensuelles. */
export type MonthPeriod = string;

export type HabitType = "boolean" | "numeric" | "duration" | "quantity" | "counter";

/** `at_least` : atteindre au moins la cible. `at_most` : ne pas dépasser la cible. */
export type HabitDirection = "at_least" | "at_most";

/**
 * Domaines de vie. Partagés par la vision, les objectifs et les habitudes :
 * c'est ce partage qui rend possible un score par domaine sans logique
 * supplémentaire.
 */
export type HabitCategory =
  | "career"
  | "business"
  | "finance"
  | "health"
  | "fitness"
  | "learning"
  | "relationships"
  | "personal"
  | "spiritual"
  | "other";

export type ScheduleKind =
  | "daily"
  | "days_of_week"
  | "days_of_month"
  | "times_per_week"
  | "times_per_month";

/**
 * Deux natures de planning, pas une (CLAUDE.md §5.2).
 * - Daté   : on sait si l'habitude est attendue le jour J → dénominateur quotidien.
 * - Quota  : aucun jour n'est attendu → jamais au dénominateur quotidien.
 */
export type ScheduleRule =
  | { kind: "daily" }
  /** `daysOfWeek` en jours ISO : 1 = lundi … 7 = dimanche. */
  | { kind: "days_of_week"; daysOfWeek: number[] }
  /** `daysOfMonth` de 1 à 31. Un jour au-delà de la longueur du mois retombe sur le dernier jour. */
  | { kind: "days_of_month"; daysOfMonth: number[] }
  | { kind: "times_per_week"; timesPerPeriod: number }
  | { kind: "times_per_month"; timesPerPeriod: number };

/**
 * Version datée d'un planning (CLAUDE.md §5.3 — l'historique est immuable).
 * Le calcul d'un jour passé utilise la règle en vigueur *ce jour-là*.
 */
export interface ScheduleVersion {
  rule: ScheduleRule;
  effectiveFrom: LocalDate;
  /** `null` = version courante. */
  effectiveTo: LocalDate | null;
}

export interface Habit {
  id: string;
  title: string;
  category: HabitCategory;
  type: HabitType;
  /** `min`, `L`, `reps`, `prospects`… `null` pour les habitudes booléennes. */
  unit: string | null;
  /** `null` pour les habitudes booléennes. */
  targetValue: number | null;
  direction: HabitDirection;
  /** Pondération dans le score quotidien. 1 par défaut. */
  weight: number;
  startDate: LocalDate;
  /**
   * Borne haute de la fenêtre d'activité. Archiver une habitude revient à poser
   * `endDate` au jour de l'archivage : les occurrences passées restent comptées.
   */
  endDate: LocalDate | null;
  schedules: ScheduleVersion[];
}

export interface HabitLog {
  habitId: string;
  localDate: LocalDate;
  /** `null` pour les habitudes booléennes. */
  value: number | null;
  completed: boolean;
  /** Preuve légère et optionnelle (CLAUDE.md §12 : la photo attend V1.1). */
  note?: string | null;
}

/**
 * La vision est le seul niveau non mesurable de la boucle : c'est une
 * direction, pas un résultat. Elle n'entre dans aucun score.
 */
export interface VisionArea {
  id: string;
  category: HabitCategory;
  /** « Où veux-tu être dans un an ? » — texte libre. */
  statement: string;
  order: number;
}

export type VisionItemKind = "image" | "text" | "quote";

export interface VisionItem {
  id: string;
  kind: VisionItemKind;
  /** `null` = non rattaché à un domaine de vie. */
  category: HabitCategory | null;
  /** Texte, citation, ou image encodée. */
  content: string;
  caption: string | null;
  /** Auteur d'une citation. */
  author: string | null;
  order: number;
}

/** Du plus court au plus long : c'est aussi l'ordre d'affichage. */
export type GoalScope = "weekly" | "monthly" | "yearly" | "long_term";
export type GoalStatus = "not_started" | "in_progress" | "completed" | "abandoned";
/**
 * `manual` : saisie à la main. Sinon la valeur est dérivée — des logs des
 * habitudes liées, ou des entrées mensuelles d'une métrique.
 *
 * `metric` est ce qui relie un objectif long à une métrique récurrente sans
 * jamais stocker le chiffre deux fois : « 10M FCFA en 2026 » lit les entrées
 * mensuelles de la métrique « Chiffre d'affaires ».
 */
export type GoalSource = "manual" | "habit_count" | "habit_sum" | "metric";

export interface Goal {
  id: string;
  title: string;
  category: HabitCategory;
  scope: GoalScope;
  targetValue: number | null;
  /** Ignoré si `source !== "manual"`. */
  currentValue: number;
  source: GoalSource;
  unit: string | null;
  startDate: LocalDate;
  dueDate: LocalDate | null;
  status: GoalStatus;
  /** Habitudes qui alimentent l'objectif (CLAUDE.md §1, pari n°1). */
  habitIds: string[];
  /** Métrique qui alimente l'objectif. Utilisé uniquement si `source === "metric"`. */
  metricId: string | null;
}

/**
 * Revue de fin de mois.
 *
 * Le seul endroit du produit où l'on écrit des phrases plutôt que des nombres —
 * et le seul qui referme la boucle : sans « qu'est-ce que je change », un bilan
 * n'est qu'un constat.
 */
export type ReviewKind = "weekly" | "monthly";

/** Les neuf questions. Les clés servent aussi d'identifiants d'affichage. */
export interface ReviewAnswers {
  wentWell: string;
  wentPoorly: string;
  distractions: string;
  proudOf: string;
  learned: string;
  stopDoing: string;
  startDoing: string;
  continueDoing: string;
  mainFocus: string;
}

export type ReviewField = keyof ReviewAnswers;

/**
 * Chiffres gelés au moment de la clôture.
 *
 * Sans ce gel, relire la revue de mars afficherait les statistiques recalculées
 * d'aujourd'hui — des chiffres qui n'ont jamais été ceux sur lesquels on a
 * écrit ces phrases.
 */
export interface ReviewSnapshot {
  consistency: number | null;
  execution: number | null;
  impact: number | null;
  goalsReached: number;
  goalsTracked: number;
  habitsAchieved: number;
  habitsExpected: number;
}

export interface Review extends ReviewAnswers {
  id: string;
  kind: ReviewKind;
  /** 1er du mois (mensuelle) ou lundi ISO (hebdomadaire). Une revue par période. */
  periodStart: LocalDate;
  periodEnd: LocalDate;
  /** `null` tant que la revue n'est pas clôturée : les chiffres restent vivants. */
  metrics: ReviewSnapshot | null;
  /** Instant technique de clôture, ou `null`. */
  completedAt: string | null;
}

/**
 * Métriques mensuelles — la troisième couche du système.
 *
 *   HABITUDES = ce que j'ai fait     → logs, constance
 *   OUTPUTS   = ce que j'ai produit  → 15 contenus, 35 prospects
 *   RESULTS   = ce que ça a généré   → 250k FCFA, +150 abonnés
 *
 * Une métrique n'est PAS une habitude déguisée : `kind` n'a délibérément pas de
 * valeur `habit`. Ce qui relève des habitudes se calcule depuis les logs, qui
 * en sont la source de vérité unique — il ne doit exister aucun endroit où
 * ressaisir « Prière = 25 » à la main.
 *
 * Une métrique n'est pas non plus un objectif : sa cible est *récurrente*, mois
 * après mois. « Publier 20 vidéos chaque mois » est une métrique ; « atteindre
 * 10M FCFA en 2026 » est un objectif, qui peut s'alimenter de cette métrique.
 */
export type MetricKind = "output" | "result";

/**
 * Sens de la cible. Plus n'est pas toujours mieux : les dépenses baissent, le
 * chiffre d'affaires monte, un poids de forme se maintient.
 *
 * `maintain` est volontairement **non scoré** en V1 : le scorer supposerait
 * d'inventer une tolérance que personne n'a définie. La métrique s'affiche,
 * elle ne pèse pas.
 */
export type MetricDirection = "increase" | "decrease" | "maintain";

/** Uniquement pour le formatage. N'intervient jamais dans un calcul. */
export type MetricValueType = "count" | "currency" | "percent" | "duration" | "decimal";

export interface Metric {
  id: string;
  /** « Contenus publiés », « Chiffre d'affaires ». */
  name: string;
  kind: MetricKind;
  category: HabitCategory;
  /**
   * Regroupement libre à l'intérieur d'un domaine de vie — « YouTube »,
   * « Coaching ». Les domaines restent l'enum partagé par la vision, les
   * objectifs et les habitudes : c'est ce partage qui rend les scores par
   * domaine gratuits. Un projet n'est pas un domaine de vie.
   */
  group: string | null;
  unit: string | null;
  valueType: MetricValueType;
  direction: MetricDirection;
  /** Pondération dans le score de sa couche. 1 par défaut. */
  weight: number;
  /** Jamais de suppression (CLAUDE.md §5.3) : les mois passés gardent leurs lignes. */
  archivedAt: LocalDate | null;
}

/**
 * La valeur d'une métrique pour un mois donné.
 *
 * L'existence de cette ligne est ce qui met la métrique au contrat du mois :
 * un mois ne contient que les métriques pour lesquelles on a posé une entrée.
 * Démarrer un nouveau mois, c'est choisir lesquelles on reconduit.
 */
export interface MetricEntry {
  metricId: string;
  period: MonthPeriod;
  /** `null` = suivi sans cible (CTR observé) : affiché, jamais scoré. */
  target: number | null;
  /** `null` = pas encore saisi. À ne jamais confondre avec `0`. */
  actual: number | null;
  note: string | null;
}
