import { endOfMonth, startOfMonth } from "./dates";
import { periodStart } from "./metrics";
import type { MonthlyScorecard } from "./scorecard";
import type {
  LocalDate,
  MonthPeriod,
  Review,
  ReviewAnswers,
  ReviewField,
  ReviewSnapshot,
} from "./types";

/**
 * Revues — la dernière étape de la boucle.
 *
 *   VISION → OBJECTIFS → HABITUDES → EXÉCUTION → PRODUCTION → RÉSULTATS
 *          → REVUE → MOIS SUIVANT
 *
 * Deux règles portent tout le reste :
 *  - une revue par période, identifiée par son premier jour ;
 *  - une fois clôturée, elle affiche les chiffres **du moment où elle a été
 *    écrite**, jamais les chiffres recalculés d'aujourd'hui.
 */

/** L'ordre des questions est celui dans lequel on y répond. */
export const REVIEW_FIELDS: ReviewField[] = [
  "wentWell",
  "wentPoorly",
  "distractions",
  "proudOf",
  "learned",
  "stopDoing",
  "startDoing",
  "continueDoing",
  "mainFocus",
];

export function emptyAnswers(): ReviewAnswers {
  return {
    wentWell: "",
    wentPoorly: "",
    distractions: "",
    proudOf: "",
    learned: "",
    stopDoing: "",
    startDoing: "",
    continueDoing: "",
    mainFocus: "",
  };
}

export function monthlyReviewWindow(period: MonthPeriod): {
  periodStart: LocalDate;
  periodEnd: LocalDate;
} {
  const start = periodStart(period);
  return { periodStart: startOfMonth(start), periodEnd: endOfMonth(start) };
}

export function findMonthlyReview(
  reviews: readonly Review[],
  period: MonthPeriod,
): Review | undefined {
  const { periodStart: start } = monthlyReviewWindow(period);
  return reviews.find((review) => review.kind === "monthly" && review.periodStart === start);
}

/** Photographie des chiffres du bilan, telle qu'elle sera figée à la clôture. */
export function freezeScorecard(card: MonthlyScorecard): ReviewSnapshot {
  return {
    consistency: card.consistency,
    execution: card.execution.score,
    impact: card.impact.score,
    goalsReached: card.goalsReached,
    goalsTracked: card.goalsTracked,
    habitsAchieved: card.habitsAchieved,
    habitsExpected: card.habitsExpected,
  };
}

/**
 * Les chiffres à afficher au-dessus d'une revue.
 *
 * Tant qu'elle est ouverte, ils suivent les données : corriger un oubli du 12
 * doit se voir. Une fois clôturée, ils sont gelés — et l'écran doit le dire,
 * sinon l'utilisateur croira à un bug en voyant deux chiffres différents pour
 * le même mois.
 */
export function reviewScores(
  review: Review | undefined,
  card: MonthlyScorecard,
): { snapshot: ReviewSnapshot; frozen: boolean } {
  if (review?.metrics != null && review.completedAt !== null) {
    return { snapshot: review.metrics, frozen: true };
  }
  return { snapshot: freezeScorecard(card), frozen: false };
}

/** Une revue vide n'a pas à être conservée ni signalée comme commencée. */
export function hasAnswers(answers: ReviewAnswers): boolean {
  return REVIEW_FIELDS.some((field) => answers[field].trim() !== "");
}
