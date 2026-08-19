"use client";

import { Lock, Unlock } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { TextArea } from "@/components/ui/Field";
import {
  hasAnswers,
  REVIEW_FIELDS,
  reviewScores,
  type MonthlyScorecard,
  type Review,
  type ReviewAnswers,
} from "@/lib/domain";
import { LAYER_LABELS, REVIEW_LABELS } from "@/lib/labels";
import { formatPercent } from "@/lib/utils";

/**
 * La revue du mois — la seule page du produit où l'on écrit des phrases.
 *
 * Elle vit au bas du bilan et non dans un écran séparé : on répond bien mieux
 * à « qu'est-ce qui n'a pas marché » avec les chiffres encore sous les yeux.
 */
export function MonthlyReview({
  review,
  card,
  onAnswer,
  onClose,
  onReopen,
  onPrepareNext,
  nextMonthLabel,
  canPrepareNext,
}: {
  review: Review | undefined;
  card: MonthlyScorecard;
  onAnswer: (patch: Partial<ReviewAnswers>) => void;
  onClose: () => void;
  onReopen: () => void;
  onPrepareNext: () => void;
  nextMonthLabel: string;
  canPrepareNext: boolean;
}) {
  const { snapshot, frozen } = reviewScores(review, card);
  const started = review !== undefined && hasAnswers(review);

  return (
    <Card className="mt-4">
      <CardHeader
        title="Revue du mois"
        action={
          frozen ? (
            <span className="text-faint inline-flex items-center gap-1.5 text-xs">
              <Lock className="size-3.5" /> Clôturée
            </span>
          ) : (
            <span className="text-faint text-xs">
              {started ? "En cours" : "Pas encore écrite"}
            </span>
          )
        }
      />

      <div className="border-border grid grid-cols-3 gap-3 border-b px-4 py-4 sm:px-5">
        <Frozen label={LAYER_LABELS.foundation} value={snapshot.consistency} />
        <Frozen label={LAYER_LABELS.execution} value={snapshot.execution} />
        <Frozen label={LAYER_LABELS.impact} value={snapshot.impact} />
      </div>

      <p className="text-faint border-border border-b px-4 py-2.5 text-xs leading-relaxed sm:px-5">
        {frozen
          ? "Chiffres figés à la clôture. Ce sont ceux sur lesquels tu as écrit — ils ne suivent plus les données."
          : "Chiffres vivants : corriger une journée oubliée les met encore à jour."}
      </p>

      <div className="divide-border divide-y">
        {REVIEW_FIELDS.map((field) => (
          <div key={field} className="px-4 py-4 sm:px-5">
            <p className="font-display mb-2 text-lg leading-snug">{REVIEW_LABELS[field].question}</p>
            <TextArea
              defaultValue={review?.[field] ?? ""}
              placeholder={REVIEW_LABELS[field].placeholder}
              readOnly={frozen}
              // Écrit à la sortie du champ : temporiser chaque frappe ferait
              // une écriture par mot sur une page de neuf champs libres.
              onBlur={(event) => {
                const value = event.target.value;
                if (value !== (review?.[field] ?? "")) onAnswer({ [field]: value });
              }}
              className={frozen ? "opacity-60" : undefined}
            />
          </div>
        ))}
      </div>

      <div className="border-border flex flex-wrap gap-2 border-t px-4 py-4 sm:px-5">
        {frozen ? (
          <Button onClick={onReopen}>
            <Unlock className="size-3.5" />
            Rouvrir la revue
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={() => onClose()}
            disabled={card.inProgress || !started}
            title={
              card.inProgress
                ? "Le mois n'est pas terminé."
                : started
                  ? undefined
                  : "Réponds à au moins une question."
            }
          >
            <Lock className="size-3.5" />
            Clôturer le mois
          </Button>
        )}

        {canPrepareNext && (
          <Button onClick={onPrepareNext}>Préparer {nextMonthLabel}</Button>
        )}
      </div>

      {card.inProgress && !frozen && (
        <p className="text-faint px-4 pb-4 text-xs leading-relaxed sm:px-5">
          Tu peux écrire dès maintenant — la clôture n&apos;est possible qu&apos;une fois le mois
          terminé, pour que les chiffres gelés soient les chiffres définitifs.
        </p>
      )}
    </Card>
  );
}

function Frozen({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <p className="text-faint text-xs">{label}</p>
      <p className="tabular mt-0.5 text-lg font-medium">{formatPercent(value)}</p>
    </div>
  );
}
