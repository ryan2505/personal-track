"use client";

import { Check } from "lucide-react";

import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/Progress";
import type { GoalScoreRow } from "@/lib/domain";
import { CATEGORY_LABELS, GOAL_SCOPE_SHORT } from "@/lib/labels";
import { cn, formatPercent } from "@/lib/utils";

/**
 * Les objectifs du mois, un par un.
 *
 * Le manque s'appelle « déficit » et jamais « échec » : c'est un écart chiffré,
 * la différence entre où tu es et où tu voulais être.
 */
export function GoalScoreList({ rows }: { rows: GoalScoreRow[] }) {
  return (
    <Card>
      <CardHeader title="Objectifs, un par un" />
      {rows.length === 0 ? (
        <EmptyState
          title="Aucun objectif sur ce mois"
          description="Un bilan sans objectif ne mesure que la constance. Fixe une cible chiffrée pour le mois prochain."
        />
      ) : (
        <div className="divide-border divide-y">
          {rows.map((row) => (
            <div key={row.goal.id} className="px-4 py-4 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm">
                    {row.reached && <Check className="text-success size-4 shrink-0" />}
                    <span className={cn("truncate", row.reached && "text-muted")}>
                      {row.goal.title}
                    </span>
                  </p>
                  <p className="text-faint mt-0.5 text-xs">
                    {CATEGORY_LABELS[row.goal.category]} · {GOAL_SCOPE_SHORT[row.goal.scope]}
                    {row.goal.source === "metric" && " · alimenté par une métrique"}
                    {row.spansBeyondMonth && " · progression globale"}
                  </p>
                </div>
                <span className="tabular shrink-0 text-sm">{formatPercent(row.ratio)}</span>
              </div>

              <ProgressBar
                ratio={row.ratio}
                className="mt-3"
                tone={row.reached ? "success" : "accent"}
              />

              <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
                <span className="text-muted tabular">
                  Réalisé : {round(row.achieved)}
                  {row.target !== null && ` / ${round(row.target)}`}
                  {row.goal.unit !== null && ` ${row.goal.unit}`}
                </span>
                {row.deficit !== null && (
                  <span className={cn("tabular", row.deficit === 0 ? "text-success" : "text-warn")}>
                    {row.deficit === 0
                      ? "Cible atteinte"
                      : `Déficit : ${round(row.deficit)}${row.goal.unit === null ? "" : ` ${row.goal.unit}`}`}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/** Les cibles dérivées peuvent tomber sur des décimales : on n'affiche pas « 17.000000001 ». */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}
