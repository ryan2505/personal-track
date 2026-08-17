import { compareDates, endOfMonth, minDate, startOfMonth } from "./dates";
import { goalProgress, resolveCurrentValue } from "./goals";
import { consistency, indexLogs } from "./scoring";
import type { Goal, Habit, HabitLog, LocalDate } from "./types";

/**
 * Bilan mensuel.
 *
 * Répond à trois questions, dans cet ordre : où j'en suis, ce que j'ai fait au
 * total, ce qu'il manque. Le manque est nommé « déficit » et jamais présenté
 * comme un échec : c'est un écart chiffré, pas un jugement (CLAUDE.md §1).
 *
 * Toute la logique est ici et non dans l'écran, pour la même raison que le
 * reste du domaine : c'est testable, et il ne peut pas exister deux définitions
 * de « objectif atteint ».
 */

export interface GoalScoreRow {
  goal: Goal;
  target: number | null;
  /** Ce qui a réellement été fait, arrêté à la fin du mois analysé. */
  achieved: number;
  /** Ce qu'il manque pour atteindre la cible. `0` si atteinte, `null` si non mesurable. */
  deficit: number | null;
  ratio: number | null;
  reached: boolean;
  /** L'objectif déborde-t-il du mois analysé ? Sa progression est alors globale. */
  spansBeyondMonth: boolean;
}

export interface MonthlyScorecard {
  monthStart: LocalDate;
  monthEnd: LocalDate;
  /** Dernier jour réellement pris en compte : un mois en cours s'arrête à aujourd'hui. */
  asOf: LocalDate;
  inProgress: boolean;

  goals: GoalScoreRow[];
  goalsReached: number;
  /** Objectifs mesurables suivis sur ce mois — le dénominateur du bilan. */
  goalsTracked: number;

  /** Occurrences d'habitudes tenues et attendues sur le mois. */
  habitsAchieved: number;
  habitsExpected: number;
  /** Occurrences manquées. */
  habitsDeficit: number;
  consistency: number | null;

  /** Vrai seulement si au moins un objectif était suivi et que tous sont atteints. */
  allGoalsReached: boolean;
}

export function monthlyScorecard(
  goals: readonly Goal[],
  habits: readonly Habit[],
  logs: readonly HabitLog[],
  month: LocalDate,
  today: LocalDate,
): MonthlyScorecard {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  // Un mois en cours ne doit pas être jugé sur des jours qui n'ont pas eu lieu.
  const asOf = minDate(monthEnd, today);
  const inProgress = compareDates(today, monthEnd) <= 0 && compareDates(today, monthStart) >= 0;

  const index = indexLogs(logs);
  const habitsById = new Map<string, Habit>(habits.map((habit) => [habit.id, habit]));

  const rows: GoalScoreRow[] = goals
    .filter(
      (goal) =>
        goal.status !== "abandoned" &&
        // La fenêtre de l'objectif recoupe le mois analysé.
        compareDates(goal.startDate, monthEnd) <= 0 &&
        (goal.dueDate === null || compareDates(goal.dueDate, monthStart) >= 0),
    )
    .map((goal) => {
      const achieved = resolveCurrentValue(goal, logs, habitsById, asOf);
      const progress = goalProgress(goal, achieved);
      const target = progress.target;

      return {
        goal,
        target,
        achieved,
        deficit: target === null ? null : Math.max(0, target - achieved),
        ratio: progress.ratio,
        reached: progress.status === "completed",
        spansBeyondMonth: goal.dueDate === null || compareDates(goal.dueDate, monthEnd) > 0,
      };
    })
    .sort((a, b) => {
      // Les objectifs atteints descendent : on regarde d'abord ce qui reste à faire.
      if (a.reached !== b.reached) return a.reached ? 1 : -1;
      return (b.ratio ?? 0) - (a.ratio ?? 0);
    });

  const measurable = rows.filter((row) => row.target !== null);
  const goalsReached = measurable.filter((row) => row.reached).length;

  const habitResult = consistency(habits, index, monthStart, asOf);

  return {
    monthStart,
    monthEnd,
    asOf,
    inProgress,
    goals: rows,
    goalsReached,
    goalsTracked: measurable.length,
    habitsAchieved: habitResult.numerator,
    habitsExpected: habitResult.denominator,
    habitsDeficit: Math.max(0, habitResult.denominator - habitResult.numerator),
    consistency: habitResult.score,
    allGoalsReached: measurable.length > 0 && goalsReached === measurable.length,
  };
}

/**
 * Message de fin de bilan.
 *
 * Sobre et proportionné : féliciter pour un mois moyen dévalue les félicitations
 * d'un mois réellement tenu. Un mois en cours n'est jamais félicité — il n'est
 * pas fini.
 */
export function scorecardVerdict(card: MonthlyScorecard): {
  tone: "celebrate" | "solid" | "neutral";
  title: string;
  detail: string;
} {
  if (card.goalsTracked === 0 && card.habitsExpected === 0) {
    return {
      tone: "neutral",
      title: "Rien à mesurer ce mois-ci",
      detail: "Aucun objectif mesurable ni habitude planifiée sur cette période.",
    };
  }

  if (card.allGoalsReached && !card.inProgress) {
    return {
      tone: "celebrate",
      title: "Tous tes objectifs sont atteints.",
      detail: `${card.goalsReached} sur ${card.goalsTracked}, mois terminé. C'est le genre de mois qui compose une année.`,
    };
  }

  if (card.allGoalsReached && card.inProgress) {
    return {
      tone: "celebrate",
      title: "Tous tes objectifs sont déjà atteints.",
      detail: "Et le mois n'est pas fini. Tu peux relever une cible, ou tenir jusqu'au bout.",
    };
  }

  if (card.consistency !== null && card.consistency >= 0.8) {
    return {
      tone: "solid",
      title: "Mois solide.",
      detail:
        card.goalsTracked === 0
          ? "Ta constance est là, même sans objectif chiffré."
          : `${card.goalsReached} objectif${card.goalsReached > 1 ? "s" : ""} sur ${card.goalsTracked}, avec une constance qui tient.`,
    };
  }

  return {
    tone: "neutral",
    title: card.inProgress ? "Mois en cours" : "Bilan du mois",
    detail:
      card.goalsTracked === 0
        ? "Aucun objectif chiffré : seule la constance est mesurée."
        : `${card.goalsReached} objectif${card.goalsReached > 1 ? "s" : ""} atteint${card.goalsReached > 1 ? "s" : ""} sur ${card.goalsTracked}.`,
  };
}
