import type { MetricRow } from "./metrics";
import type { MonthlyScorecard } from "./scorecard";

/**
 * Lecture du bilan — CLAUDE.md §1 : le produit ne juge pas, il éclaire.
 *
 * Trois couches donnent leur valeur par leur **écart**. Une fondation à 91 %,
 * une exécution à 92 % et un impact à 42 % ne décrivent pas un mois raté : ils
 * localisent l'endroit où la chaîne casse, ce qu'aucun score unique ne peut
 * faire.
 *
 * Deux interdits, tenus par les tests :
 *  - jamais une cause affirmée. « Explication possible », jamais « tu as ».
 *    Le système voit des nombres ; il ne sait pas ce qui s'est passé dans le
 *    mois de quelqu'un.
 *  - jamais de comparaison entre couches sur un mois en cours. Le 10 du mois,
 *    une production à 25 % est simplement un mois à 30 % d'avancement, et
 *    parler de goulot d'étranglement serait une erreur de lecture.
 */

/** Au-delà : la couche tient. En deçà de `WEAK` : elle décroche. Entre : on ne dit rien. */
const STRONG = 0.8;
const WEAK = 0.6;

export type ObservationTone = "strength" | "gap" | "hypothesis" | "neutral";

export interface Observation {
  tone: ObservationTone;
  title: string;
  /** Toujours au conditionnel dès qu'il s'agit d'une cause. */
  detail: string;
}

export function diagnoseMonth(card: MonthlyScorecard): Observation[] {
  const foundation = card.consistency;
  const execution = card.execution.score;
  const impact = card.impact.score;

  const observations: Observation[] = [];
  const bottleneck = findBottleneck(card);

  if (card.inProgress) {
    // Rien de comparable tant que le mois n'est pas joué : les cibles
    // mensuelles se remplissent à la fin, pas au prorata des jours.
    observations.push({
      tone: "neutral",
      title: "Mois en cours",
      detail:
        "Les écarts entre couches ne se lisent qu'une fois le mois terminé : une production à mi-parcours n'est pas un retard.",
    });
    if (bottleneck !== null) observations.push(bottleneck);
    return observations;
  }

  if (isLow(foundation) && isLow(execution) && isLow(impact)) {
    observations.push({
      tone: "hypothesis",
      title: "Les trois couches décrochent ensemble",
      detail:
        "Quand tout baisse en même temps, le point de reprise est la fondation : c'est la seule couche que tu contrôles entièrement. Vise la régularité avant le volume.",
    });
  } else {
    if (isHigh(foundation) && isLow(execution)) {
      observations.push({
        tone: "hypothesis",
        title: "La régularité ne s'est pas transformée en production",
        detail:
          "Tu as tenu tes habitudes sans atteindre le volume prévu. Explications possibles : des sessions trop courtes pour aboutir, du travail commencé et jamais fini, ou une cible calibrée pour un mois plus disponible.",
      });
    }

    if (isHigh(execution) && isLow(impact)) {
      observations.push({
        tone: "hypothesis",
        title: "Tu as produit ce qui était prévu, sans le résultat attendu",
        detail:
          "Piste à examiner du côté de l'offre, du positionnement, de la qualité ou de la distribution — et n'écarte pas le délai : ce qui a été publié ce mois-ci peut produire son effet le mois prochain.",
      });
    }

    if (isHigh(impact) && isLow(foundation)) {
      observations.push({
        tone: "hypothesis",
        title: "Le résultat est là sans la régularité",
        detail:
          "Soit un effet de levier réel, soit un mois porté par un coup ponctuel. La différence se voit sur deux mois, pas sur un.",
      });
    }
  }

  if (bottleneck !== null) observations.push(bottleneck);

  if (isHigh(foundation) && isHigh(execution) && isHigh(impact)) {
    observations.push({
      tone: "strength",
      title: "Mois cohérent de bout en bout",
      detail: "Régularité, production et résultat au rendez-vous en même temps. C'est rare.",
    });
  } else {
    const strong = [
      isHigh(foundation) && "la régularité",
      isHigh(execution) && "la production",
      isHigh(impact) && "les résultats",
    ].filter((item): item is string => item !== false);

    if (strong.length > 0) {
      observations.push({
        tone: "strength",
        title: `Ce qui a tenu : ${strong.join(" et ")}`,
        detail: "À reconduire tel quel le mois prochain — c'est déjà réglé, ne le rouvre pas.",
      });
    }
  }

  // Quatre lignes maximum : au-delà, plus personne ne les lit.
  return observations.slice(0, 4);
}

/**
 * La métrique la plus en retard du mois, toutes couches confondues.
 * Un écart isolé est bien plus actionnable qu'un score de couche : « 35 sur 50
 * prospects » se corrige, « exécution à 72 % » ne se corrige pas.
 */
function findBottleneck(card: MonthlyScorecard): Observation | null {
  const rows = [...card.execution.rows, ...card.impact.rows].filter(
    (row): row is MetricRow & { ratio: number } => row.ratio !== null,
  );
  if (rows.length < 2) return null;

  const worst = rows.reduce((low, row) => (row.ratio < low.ratio ? row : low));
  if (worst.ratio >= WEAK) return null;

  const { metric, entry } = worst;
  const unit = metric.unit === null ? "" : ` ${metric.unit}`;

  return {
    tone: "gap",
    title: `Écart le plus large : ${metric.name}`,
    detail: `${entry.actual ?? 0}${unit} pour une cible de ${entry.target ?? 0}${unit}. C'est le point où une correction changerait le plus de choses.`,
  };
}

function isHigh(score: number | null): boolean {
  return score !== null && score >= STRONG;
}

function isLow(score: number | null): boolean {
  return score !== null && score < WEAK;
}
