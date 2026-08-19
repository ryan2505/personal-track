import { isWeekPeriod, periodEnd, periodStart } from "@/lib/domain";
import type {
  GoalScope,
  Habit,
  HabitCategory,
  HabitType,
  Metric,
  MetricCadence,
  MetricDirection,
  MetricKind,
  MetricValueType,
  Period,
  ReviewField,
  ScheduleKind,
  ScheduleRule,
} from "@/lib/domain";

export const CATEGORIES: HabitCategory[] = [
  "career",
  "business",
  "finance",
  "health",
  "fitness",
  "learning",
  "relationships",
  "personal",
  "spiritual",
  "other",
];

export const CATEGORY_LABELS: Record<HabitCategory, string> = {
  career: "Carrière",
  business: "Business",
  finance: "Finances",
  health: "Santé",
  fitness: "Forme physique",
  learning: "Apprentissage",
  relationships: "Relations",
  personal: "Personnel",
  spiritual: "Spirituel",
  other: "Autre",
};

/** Amorce de la question posée à l'étape « Où vas-tu ? ». */
export const CATEGORY_PROMPTS: Record<HabitCategory, string> = {
  career: "Où veux-tu en être professionnellement ?",
  business: "Que veux-tu avoir construit ?",
  finance: "À quoi ressemble ton indépendance financière ?",
  health: "Dans quel état de santé veux-tu être ?",
  fitness: "Quel corps veux-tu avoir construit ?",
  learning: "Que veux-tu maîtriser ?",
  relationships: "Quelles relations veux-tu avoir nourries ?",
  personal: "Qui veux-tu être devenu ?",
  spiritual: "Où veux-tu en être intérieurement ?",
  other: "Où veux-tu être ?",
};

/** Du plus court au plus long — même ordre que le type `GoalScope`. */
export const GOAL_SCOPES: GoalScope[] = ["weekly", "monthly", "yearly", "long_term"];

export const GOAL_SCOPE_LABELS: Record<GoalScope, string> = {
  weekly: "Cette semaine",
  monthly: "Ce mois",
  yearly: "Cette année",
  long_term: "Long terme",
};

/** Étiquette courte, pour les listes. */
export const GOAL_SCOPE_SHORT: Record<GoalScope, string> = {
  weekly: "Semaine",
  monthly: "Mois",
  yearly: "Année",
  long_term: "Long terme",
};

export const HABIT_TYPES: HabitType[] = ["boolean", "numeric", "duration", "quantity", "counter"];

export const TYPE_LABELS: Record<HabitType, string> = {
  boolean: "Fait / pas fait",
  numeric: "Nombre",
  duration: "Durée",
  quantity: "Quantité",
  counter: "Compteur",
};

export const SCHEDULE_KINDS: ScheduleKind[] = [
  "daily",
  "days_of_week",
  "times_per_week",
  "days_of_month",
  "times_per_month",
];

export const SCHEDULE_LABELS: Record<ScheduleKind, string> = {
  daily: "Tous les jours",
  days_of_week: "Jours de la semaine",
  times_per_week: "X fois par semaine",
  days_of_month: "Jours du mois",
  times_per_month: "X fois par mois",
};

export const WEEKDAYS = [
  { iso: 1, short: "L", label: "Lundi" },
  { iso: 2, short: "M", label: "Mardi" },
  { iso: 3, short: "M", label: "Mercredi" },
  { iso: 4, short: "J", label: "Jeudi" },
  { iso: 5, short: "V", label: "Vendredi" },
  { iso: 6, short: "S", label: "Samedi" },
  { iso: 7, short: "D", label: "Dimanche" },
];

export function describeRule(rule: ScheduleRule): string {
  switch (rule.kind) {
    case "daily":
      return "Tous les jours";
    case "days_of_week": {
      const days = WEEKDAYS.filter((day) => rule.daysOfWeek.includes(day.iso));
      if (days.length === 0) return "Aucun jour";
      if (days.length === 7) return "Tous les jours";
      return days.map((day) => day.label.slice(0, 3)).join(" · ");
    }
    case "days_of_month":
      return `Le ${rule.daysOfMonth.join(", ")} du mois`;
    case "times_per_week":
      return `${rule.timesPerPeriod}× par semaine`;
    case "times_per_month":
      return `${rule.timesPerPeriod}× par mois`;
  }
}

/** Variante tolérante, pour les cas où aucune version de planning n'est ouverte. */
export function describeRuleFallback(rule: ScheduleRule | undefined): string {
  return rule === undefined ? "—" : describeRule(rule);
}

// ── Métriques mensuelles ─────────────────────────────────────────────────────

export const METRIC_KINDS: MetricKind[] = ["output", "result"];

export const METRIC_KIND_LABELS: Record<MetricKind, string> = {
  output: "Production",
  result: "Résultat",
};

/** L'intitulé de la couche, tel qu'il apparaît en tête du bilan. */
export const LAYER_LABELS = {
  foundation: "Fondation",
  execution: "Exécution",
  impact: "Impact",
} as const;

/** Ce que chaque couche répond, en une ligne. */
export const LAYER_QUESTIONS = {
  foundation: "Ce que j'ai fait",
  execution: "Ce que j'ai produit",
  impact: "Ce que ça a généré",
} as const;

export const METRIC_CADENCES: MetricCadence[] = ["weekly", "monthly"];

export const CADENCE_LABELS: Record<MetricCadence, string> = {
  weekly: "Chaque semaine",
  monthly: "Chaque mois",
};

/** Étiquette courte, pour les onglets et les lignes. */
export const CADENCE_SHORT: Record<MetricCadence, string> = {
  weekly: "Semaine",
  monthly: "Mois",
};

export const CADENCE_HINTS: Record<MetricCadence, string> = {
  weekly:
    "La cible se repose chaque lundi. Pour ce qui se pilote à la semaine : contenus, prospection, séances.",
  monthly:
    "La cible se repose le 1er. Pour ce qui ne se juge pas en sept jours : chiffre d'affaires, abonnés, poids.",
};

export const METRIC_DIRECTIONS: MetricDirection[] = ["increase", "decrease", "maintain"];

export const METRIC_DIRECTION_LABELS: Record<MetricDirection, string> = {
  increase: "Atteindre au moins",
  decrease: "Rester en dessous",
  maintain: "Se maintenir autour",
};

export const METRIC_DIRECTION_HINTS: Record<MetricDirection, string> = {
  increase: "Plus est mieux — chiffre d'affaires, abonnés, contenus publiés.",
  decrease: "Moins est mieux — dépenses, temps d'écran.",
  maintain: "Suivie sans être notée : définir un « bon écart » serait arbitraire.",
};

export const METRIC_VALUE_TYPES: MetricValueType[] = [
  "count",
  "currency",
  "percent",
  "duration",
  "decimal",
];

export const VALUE_TYPE_LABELS: Record<MetricValueType, string> = {
  count: "Nombre entier",
  currency: "Montant",
  percent: "Pourcentage",
  duration: "Durée",
  decimal: "Nombre décimal",
};

const INTEGER_FORMAT = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const DECIMAL_FORMAT = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

/**
 * Une valeur de métrique, dans son unité. `null` reste « — » : une valeur non
 * saisie n'est pas un zéro, et l'écran ne doit pas la maquiller en zéro.
 */
export function formatMetricValue(metric: Metric, value: number | null): string {
  if (value === null) return "—";

  const unit = metric.unit === null || metric.unit === "" ? "" : ` ${metric.unit}`;

  switch (metric.valueType) {
    case "currency":
      return `${INTEGER_FORMAT.format(value)}${unit}`;
    case "percent":
      return `${DECIMAL_FORMAT.format(value)} %`;
    case "count":
      return `${INTEGER_FORMAT.format(value)}${unit}`;
    case "duration":
    case "decimal":
      return `${DECIMAL_FORMAT.format(value)}${unit}`;
  }
}

// ── Revue mensuelle ──────────────────────────────────────────────────────────

/**
 * Les neuf questions. Ouvertes, non suggestives : « qu'est-ce qui t'a distrait »
 * appelle une observation, « pourquoi as-tu échoué » appelle une justification.
 */
export const REVIEW_LABELS: Record<ReviewField, { question: string; placeholder: string }> = {
  wentWell: {
    question: "Qu'est-ce qui a marché ?",
    placeholder: "Ce que tu referais à l'identique.",
  },
  wentPoorly: {
    question: "Qu'est-ce qui n'a pas marché ?",
    placeholder: "Sans chercher de coupable — juste ce qui a coincé.",
  },
  distractions: {
    question: "Qu'est-ce qui t'a distrait ?",
    placeholder: "Ce qui a mangé du temps sans rien produire.",
  },
  proudOf: {
    question: "De quoi es-tu fier ?",
    placeholder: "Même petit. Surtout si personne ne l'a vu.",
  },
  learned: {
    question: "La plus grande leçon",
    placeholder: "Une seule phrase, celle que tu veux relire dans un an.",
  },
  stopDoing: {
    question: "Qu'est-ce que tu arrêtes ?",
    placeholder: "Arrêter est une décision, pas un renoncement.",
  },
  startDoing: {
    question: "Qu'est-ce que tu commences ?",
    placeholder: "Une chose. Deux, c'est déjà une liste d'intentions.",
  },
  continueDoing: {
    question: "Qu'est-ce que tu continues ?",
    placeholder: "Ce qui est réglé et qu'il ne faut surtout pas rouvrir.",
  },
  mainFocus: {
    question: "Priorité n°1 du mois prochain",
    placeholder: "Si tu ne devais réussir qu'une chose.",
  },
};

const PERIOD_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const DAY_MONTH_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/**
 * « août 2026 », ou « semaine 34 · 17 – 23 août ».
 *
 * Le numéro de semaine seul ne dit rien à personne : on donne toujours les
 * dates avec, sinon l'utilisateur doit aller chercher un calendrier pour savoir
 * de quelle semaine on parle.
 */
export function formatPeriod(period: Period): string {
  if (!isWeekPeriod(period)) {
    return PERIOD_FORMAT.format(new Date(`${period}-01T00:00:00Z`));
  }

  const start = periodStart(period);
  const end = periodEnd(period);
  const asUtc = (date: string) => new Date(`${date}T00:00:00Z`);

  return `semaine ${Number(period.slice(6))} · ${DAY_MONTH_FORMAT.format(asUtc(start))} – ${DAY_MONTH_FORMAT.format(asUtc(end))}`;
}

/** « 45 / 60 min ». Le formatage vit ici, jamais dans un composant. */
export function formatValue(habit: Habit, value: number | null): string {
  const unit = habit.unit === null || habit.unit === "" ? "" : ` ${habit.unit}`;
  const current = value ?? 0;
  if (habit.targetValue === null) return `${current}${unit}`;
  return `${current} / ${habit.targetValue}${unit}`;
}

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

const MONTH_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** La date est déjà locale : on la formate en UTC pour ne pas la redécaler. */
export function formatLongDate(date: string): string {
  return DATE_FORMAT.format(new Date(`${date}T00:00:00Z`));
}

export function formatMonth(date: string): string {
  return MONTH_FORMAT.format(new Date(`${date}T00:00:00Z`));
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bonjour";
  if (hour < 18) return "Bon après-midi";
  return "Bonsoir";
}
