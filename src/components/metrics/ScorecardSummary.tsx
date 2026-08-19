"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Card, CardHeader } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/Progress";
import { monthlyScorecard } from "@/lib/domain";
import { formatMonth, LAYER_LABELS } from "@/lib/labels";
import { useStore } from "@/lib/store/StoreProvider";
import { formatPercent } from "@/lib/utils";

/**
 * Le bilan du mois, en trois barres, sur le tableau de bord.
 *
 * Volontairement réduit : le tableau de bord répond à « où j'en suis
 * aujourd'hui ». Le mois entier a son écran, et un résumé qui déborderait
 * ferait doublon avec lui.
 */
export function ScorecardSummary() {
  const { state, today } = useStore();

  const card = useMemo(
    () =>
      monthlyScorecard({
        goals: state.goals,
        habits: state.habits,
        logs: state.logs,
        metrics: state.metrics,
        metricEntries: state.metricEntries,
        month: today,
        today,
      }),
    [state.goals, state.habits, state.logs, state.metrics, state.metricEntries, today],
  );

  // Sans métrique, ces deux barres seraient vides tous les mois : on ne montre
  // le bloc que lorsqu'il a quelque chose à dire de plus que la constance.
  if (card.execution.tracked === 0 && card.impact.tracked === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader
        title={<span className="capitalize">{formatMonth(card.monthStart)}</span>}
        action={
          <Link href="/scorecard" className="text-muted hover:text-text text-xs">
            Voir le bilan
          </Link>
        }
      />
      <div className="space-y-3 p-4 sm:p-5">
        <Line label={LAYER_LABELS.foundation} ratio={card.consistency} />
        <Line label={LAYER_LABELS.execution} ratio={card.execution.score} />
        <Line label={LAYER_LABELS.impact} ratio={card.impact.score} />
      </div>
    </Card>
  );
}

function Line({ label, ratio }: { label: string; ratio: number | null }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
        <span className="text-muted">{label}</span>
        <span className="tabular">{formatPercent(ratio)}</span>
      </div>
      <ProgressBar ratio={ratio} />
    </div>
  );
}
