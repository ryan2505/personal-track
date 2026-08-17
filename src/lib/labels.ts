import type { Habit, HabitCategory, HabitType, ScheduleKind, ScheduleRule } from "@/lib/domain";

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
