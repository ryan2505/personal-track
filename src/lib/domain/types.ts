/**
 * Types du domaine — CLAUDE.md §2 (vocabulaire) et §5 (invariants).
 *
 * Ces types sont volontairement découplés des lignes Supabase : la couche
 * `queries/` fait la traduction. Le domaine ne connaît ni React ni Postgres.
 */

/** Date locale de l'utilisateur, format `YYYY-MM-DD`. Jamais un instant UTC. */
export type LocalDate = string;

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

export type GoalScope = "long_term" | "yearly" | "monthly";
export type GoalStatus = "not_started" | "in_progress" | "completed" | "abandoned";
/** `manual` : saisie à la main. Sinon la valeur est dérivée des logs des habitudes liées. */
export type GoalSource = "manual" | "habit_count" | "habit_sum";

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
}
