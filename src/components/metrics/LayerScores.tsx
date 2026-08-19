"use client";

import { Card } from "@/components/ui/Card";
import { ProgressBar, ScoreRing } from "@/components/ui/Progress";
import type { MonthlyScorecard } from "@/lib/domain";
import { LAYER_LABELS, LAYER_QUESTIONS } from "@/lib/labels";
import { formatPercent } from "@/lib/utils";

/**
 * Les trois couches en tête de bilan.
 *
 * Volontairement côte à côte et jamais fondues en un chiffre unique : un mois à
 * 91 / 92 / 42 ne dit pas la même chose qu'un mois plat à 75, et c'est
 * exactement cet écart qu'on vient lire.
 */
export function LayerScores({ card }: { card: MonthlyScorecard }) {
  return (
    <>
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-4 p-4">
          <ScoreRing
            ratio={card.consistency}
            size={56}
            label={formatPercent(card.consistency)}
          />
          <div className="min-w-0">
            <p className="text-xs">{LAYER_LABELS.foundation}</p>
            <p className="text-faint text-xs">{LAYER_QUESTIONS.foundation}</p>
            <p className="tabular text-muted mt-1 text-xs">
              {round(card.habitsAchieved)} / {round(card.habitsExpected)} occurrences
            </p>
          </div>
        </Card>

        <LayerCard
          label={LAYER_LABELS.execution}
          question={LAYER_QUESTIONS.execution}
          score={card.execution.score}
          detail={detail(card.execution.reached, card.execution.scored)}
        />
        <LayerCard
          label={LAYER_LABELS.impact}
          question={LAYER_QUESTIONS.impact}
          score={card.impact.score}
          detail={detail(card.impact.reached, card.impact.scored)}
        />
      </div>

      <p className="text-faint mb-5 text-xs leading-relaxed">
        Trois mesures, jamais moyennées : la première dit ce que tu as fait, la deuxième ce que tu
        as produit, la troisième ce que ça a généré.
      </p>
    </>
  );
}

function LayerCard({
  label,
  question,
  score,
  detail,
}: {
  label: string;
  question: string;
  score: number | null;
  detail: string;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs">{label}</p>
      <p className="text-faint text-xs">{question}</p>
      <p className="tabular mt-1 text-2xl font-medium">{formatPercent(score)}</p>
      <ProgressBar ratio={score} className="mt-3" />
      <p className="text-faint tabular mt-2 text-xs">{detail}</p>
    </Card>
  );
}

function detail(reached: number, scored: number): string {
  if (scored === 0) return "Aucune cible sur la période";
  return `${reached} cible${reached > 1 ? "s" : ""} sur ${scored}`;
}

/** Les dénominateurs pondérés tombent sur des décimales : pas de « 17.0000001 ». */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}
