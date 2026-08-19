"use client";

import { ArrowRight, Target } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { Card } from "@/components/ui/Card";
import { indexEntries, metricsForPeriod, weekPeriod } from "@/lib/domain";
import { useStore } from "@/lib/store/StoreProvider";

/**
 * Rappel de début de semaine, sur l'écran quotidien.
 *
 * Une ligne, un lien, aucun chiffre. Today répond à « qu'est-ce que je fais
 * aujourd'hui » ; y afficher des cibles hebdomadaires en ferait un second
 * tableau de bord et alourdirait l'écran le plus utilisé du produit.
 *
 * Il ne s'affiche que quand il y a réellement quelque chose à faire : des
 * métriques hebdomadaires existent, et la semaine en cours n'a pas encore ses
 * cibles.
 */
export function WeekTargetsNudge() {
  const { state, today } = useStore();

  const missing = useMemo(() => {
    const weekly = state.metrics.filter(
      (metric) => metric.cadence === "weekly" && metric.archivedAt === null,
    );
    if (weekly.length === 0) return 0;

    const rows = metricsForPeriod(weekly, indexEntries(state.metricEntries), weekPeriod(today));
    const withTarget = rows.filter((row) => row.entry.target !== null).length;
    return weekly.length - withTarget;
  }, [state.metrics, state.metricEntries, today]);

  if (missing === 0) return null;

  return (
    <Link href="/scorecard" className="block">
      <Card className="hover:border-border-strong mb-4 flex items-center gap-3 p-4 transition-colors">
        <Target className="text-accent size-4 shrink-0" />
        <span className="min-w-0 flex-1 text-sm">
          {missing} cible{missing > 1 ? "s" : ""} à poser pour cette semaine
        </span>
        <ArrowRight className="text-faint size-4 shrink-0" />
      </Card>
    </Link>
  );
}
