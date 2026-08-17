"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar, ScoreRing } from "@/components/ui/Progress";
import {
  addDays,
  endOfMonth,
  monthlyScorecard,
  scorecardVerdict,
  startOfMonth,
  type LocalDate,
} from "@/lib/domain";
import { CATEGORY_LABELS, formatLongDate, formatMonth, GOAL_SCOPE_SHORT } from "@/lib/labels";
import { useStore } from "@/lib/store/StoreProvider";
import { cn, formatPercent } from "@/lib/utils";

export default function ScorecardPage() {
  const { state, today } = useStore();
  const [month, setMonth] = useState<LocalDate>(today);

  const card = useMemo(
    () => monthlyScorecard(state.goals, state.habits, state.logs, month, today),
    [state.goals, state.habits, state.logs, month, today],
  );

  const verdict = scorecardVerdict(card);
  const isFuture = card.monthStart > today;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Bilan mensuel"
        subtitle="Où tu en es, ce que tu as fait au total, ce qu'il manque."
        action={
          <div className="flex gap-1">
            <button
              aria-label="Mois précédent"
              onClick={() => setMonth(addDays(startOfMonth(month), -1))}
              className="text-muted hover:text-text flex size-9 items-center justify-center rounded-md"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              aria-label="Mois suivant"
              onClick={() => setMonth(addDays(endOfMonth(month), 1))}
              className="text-muted hover:text-text flex size-9 items-center justify-center rounded-md"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        }
      />

      <p className="text-faint mb-5 text-xs capitalize">
        {formatMonth(card.monthStart)}
        {card.inProgress && (
          <span className="normal-case"> · en cours, arrêté au {formatLongDate(card.asOf)}</span>
        )}
      </p>

      {isFuture ? (
        <Card>
          <EmptyState
            title="Mois à venir"
            description="Rien à mesurer : ce mois n'a pas encore commencé."
          />
        </Card>
      ) : (
        <>
          {/* Le verdict d'abord : c'est ce qu'on vient chercher. */}
          <Card
            className={cn(
              "mb-5 p-5",
              verdict.tone === "celebrate" && "border-success/40 bg-success/5",
            )}
          >
            <div className="flex items-start gap-4">
              {verdict.tone === "celebrate" && (
                <span className="bg-success text-bg flex size-8 shrink-0 items-center justify-center rounded-full">
                  <Check className="size-5" strokeWidth={3} />
                </span>
              )}
              <div>
                <p
                  className={cn(
                    "font-display text-2xl leading-snug",
                    verdict.tone === "celebrate" && "text-success",
                  )}
                >
                  {verdict.title}
                </p>
                <p className="text-muted mt-1.5 text-sm leading-relaxed">{verdict.detail}</p>
              </div>
            </div>
          </Card>

          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <Card className="flex items-center gap-4 p-4">
              <ScoreRing
                ratio={card.consistency}
                size={56}
                label={formatPercent(card.consistency)}
              />
              <div>
                <p className="text-faint text-xs">Constance</p>
                <p className="tabular text-sm">
                  {round(card.habitsAchieved)} / {round(card.habitsExpected)}
                </p>
              </div>
            </Card>

            <Card className="p-4">
              <p className="text-faint text-xs">Objectifs atteints</p>
              <p className="tabular mt-1 text-2xl font-medium">
                {card.goalsReached}
                <span className="text-faint text-base"> / {card.goalsTracked}</span>
              </p>
            </Card>

            <Card className="p-4">
              <p className="text-faint text-xs">Occurrences manquées</p>
              <p className="tabular mt-1 text-2xl font-medium">{round(card.habitsDeficit)}</p>
              <p className="text-faint mt-1 text-xs">sur {round(card.habitsExpected)} attendues</p>
            </Card>
          </div>

          <Card>
            <CardHeader title="Objectifs, un par un" />
            {card.goals.length === 0 ? (
              <EmptyState
                title="Aucun objectif sur ce mois"
                description="Un bilan sans objectif ne mesure que la constance. Fixe une cible chiffrée pour le mois prochain."
              />
            ) : (
              <div className="divide-border divide-y">
                {card.goals.map((row) => (
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
                          {CATEGORY_LABELS[row.goal.category]} ·{" "}
                          {GOAL_SCOPE_SHORT[row.goal.scope]}
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

          {card.inProgress && (
            <p className="text-faint mt-4 text-xs leading-relaxed">
              Le mois n&apos;est pas terminé : seules les journées écoulées sont comptées. Les
              jours à venir ne pèsent pas encore contre toi.
            </p>
          )}
        </>
      )}
    </main>
  );
}

/** Les cibles dérivées peuvent tomber sur des décimales : on n'affiche pas « 17.000000001 ». */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}
