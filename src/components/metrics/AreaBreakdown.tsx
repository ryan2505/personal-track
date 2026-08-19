"use client";

import { useMemo } from "react";

import { Card, CardHeader } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/Progress";
import type { AreaScore, MonthlyScorecard } from "@/lib/domain";
import { CATEGORIES, CATEGORY_LABELS, LAYER_LABELS } from "@/lib/labels";
import { cn, formatPercent } from "@/lib/utils";

/**
 * Les trois couches, domaine de vie par domaine de vie.
 *
 * C'est ici que le bilan devient actionnable : « Exécution 72 % » ne se corrige
 * pas, « Business 72 % pendant que Santé est à 95 % » se corrige. Le score
 * global dit s'il y a un problème, cette vue dit où.
 *
 * Aucun calcul : `AreaScore` vient du domaine, où le découpage réutilise
 * exactement la même formule que les couches globales.
 */
export function AreaBreakdown({ card }: { card: MonthlyScorecard }) {
  // Le domaine rend un ordre déterministe ; l'écran le remet dans l'ordre des
  // domaines de vie du produit, celui de la vision et de l'onboarding.
  const areas = useMemo(
    () =>
      [...card.areas].sort(
        (a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category),
      ),
    [card.areas],
  );

  if (areas.length === 0) return null;

  return (
    <Card className="mb-4">
      <CardHeader
        title="Par domaine de vie"
        action={<span className="text-faint text-xs">Fondation · Exécution · Impact</span>}
      />
      <div className="divide-border divide-y">
        {areas.map((area) => (
          <AreaRow key={area.category} area={area} />
        ))}
      </div>
      <p className="text-faint border-border border-t px-4 py-3 text-xs leading-relaxed sm:px-5">
        Un tiret signale une couche sans rien de mesurable dans ce domaine — pas un zéro.
      </p>
    </Card>
  );
}

function AreaRow({ area }: { area: AreaScore }) {
  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="text-sm">{CATEGORY_LABELS[area.category]}</span>
        <span className="text-faint tabular text-xs">
          {area.habitsExpected > 0 && `${round(area.habitsAchieved)} / ${round(area.habitsExpected)} occurrences`}
          {area.habitsExpected > 0 && area.goals.length > 0 && " · "}
          {area.goals.length > 0 &&
            `${area.goals.length} objectif${area.goals.length > 1 ? "s" : ""}`}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Layer label={LAYER_LABELS.foundation} ratio={area.foundation} />
        <Layer label={LAYER_LABELS.execution} ratio={area.execution.score} />
        <Layer label={LAYER_LABELS.impact} ratio={area.impact.score} />
      </div>
    </div>
  );
}

function Layer({ label, ratio }: { label: string; ratio: number | null }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-faint text-[11px]">{label}</span>
        <span className={cn("tabular text-xs", ratio === null && "text-faint")}>
          {formatPercent(ratio)}
        </span>
      </div>
      <ProgressBar ratio={ratio} />
    </div>
  );
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
