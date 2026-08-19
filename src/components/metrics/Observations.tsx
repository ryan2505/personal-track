"use client";

import { Lightbulb, TrendingDown, Sparkles, Clock } from "lucide-react";

import { Card, CardHeader } from "@/components/ui/Card";
import type { Observation, ObservationTone } from "@/lib/domain";
import { cn } from "@/lib/utils";

const ICONS: Record<ObservationTone, typeof Lightbulb> = {
  strength: Sparkles,
  gap: TrendingDown,
  hypothesis: Lightbulb,
  neutral: Clock,
};

const TONES: Record<ObservationTone, string> = {
  strength: "text-success",
  gap: "text-warn",
  hypothesis: "text-accent",
  neutral: "text-faint",
};

/**
 * Lecture du mois. Rien n'est calculé ici : les observations viennent du
 * domaine, où leur formulation est verrouillée par des tests — c'est le seul
 * endroit du produit où le ton lui-même est un invariant.
 */
export function Observations({ observations }: { observations: Observation[] }) {
  if (observations.length === 0) return null;

  return (
    <Card className="mb-4">
      <CardHeader title="Ce que ça raconte" />
      <div className="divide-border divide-y">
        {observations.map((observation) => {
          const Icon = ICONS[observation.tone];
          return (
            <div key={observation.title} className="flex gap-3 px-4 py-4 sm:px-5">
              <Icon className={cn("mt-0.5 size-4 shrink-0", TONES[observation.tone])} />
              <div>
                <p className="text-sm">{observation.title}</p>
                <p className="text-muted mt-1 text-sm leading-relaxed">{observation.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-faint border-border border-t px-4 py-3 text-xs leading-relaxed sm:px-5">
        Ce sont des pistes tirées de tes chiffres, pas des conclusions. Toi seul sais ce qu&apos;il
        s&apos;est passé dans ce mois.
      </p>
    </Card>
  );
}
