"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { monthlyTrend, monthsOfYear, type MonthlySummary } from "@/lib/domain";
import { LAYER_LABELS } from "@/lib/labels";
import { useStore } from "@/lib/store/StoreProvider";
import { cn, formatPercent } from "@/lib/utils";

const MONTH_SHORT = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });

/**
 * L'année, mois par mois, sur les trois couches.
 *
 * C'est la seule vue où l'on voit une trajectoire plutôt qu'un état : trois
 * mois d'exécution en hausse et d'impact plat disent quelque chose qu'aucun
 * bilan mensuel isolé ne peut dire.
 */
export function MonthlyTrend() {
  const { state, today } = useStore();
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));

  const rows = useMemo(
    () =>
      monthlyTrend(
        {
          goals: state.goals,
          habits: state.habits,
          logs: state.logs,
          metrics: state.metrics,
          metricEntries: state.metricEntries,
          today,
        },
        monthsOfYear(year),
      ),
    [state.goals, state.habits, state.logs, state.metrics, state.metricEntries, today, year],
  );

  return (
    <Card className="mb-4">
      <CardHeader
        title="Mois par mois"
        action={
          <div className="flex items-center gap-1">
            <button
              aria-label="Année précédente"
              onClick={() => setYear((value) => value - 1)}
              className="text-muted hover:text-text flex size-8 items-center justify-center rounded-md"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="tabular text-xs">{year}</span>
            <button
              aria-label="Année suivante"
              onClick={() => setYear((value) => value + 1)}
              className="text-muted hover:text-text flex size-8 items-center justify-center rounded-md"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title={`Rien en ${year}`}
          description="Aucun mois écoulé sur cette année."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-md text-xs">
            <thead>
              <tr className="text-faint border-border border-b">
                <th className="px-4 py-2.5 text-left font-normal sm:px-5">Mois</th>
                <th className="px-2 py-2.5 text-right font-normal">{LAYER_LABELS.foundation}</th>
                <th className="px-2 py-2.5 text-right font-normal">{LAYER_LABELS.execution}</th>
                <th className="px-4 py-2.5 text-right font-normal sm:px-5">
                  {LAYER_LABELS.impact}
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((row) => (
                <TrendRow key={row.period} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-faint border-border border-t px-4 py-3 text-xs leading-relaxed sm:px-5">
        Les mois à venir ne figurent pas : une colonne vide est honnête, un 0 % raconterait un
        échec qui n&apos;a pas eu lieu.
      </p>
    </Card>
  );
}

function TrendRow({ row }: { row: MonthlySummary }) {
  const label = MONTH_SHORT.format(new Date(`${row.period}-01T00:00:00Z`));

  return (
    <tr className={cn(row.inProgress && "text-muted")}>
      <td className="px-4 py-2.5 capitalize sm:px-5">
        {label}
        {row.inProgress && <span className="text-faint"> · en cours</span>}
      </td>
      <Cell value={row.foundation} />
      <Cell value={row.execution} />
      <Cell value={row.impact} last />
    </tr>
  );
}

function Cell({ value, last = false }: { value: number | null; last?: boolean }) {
  return (
    <td
      className={cn(
        "tabular py-2.5 text-right",
        last ? "px-4 sm:px-5" : "px-2",
        value === null && "text-faint",
      )}
    >
      {formatPercent(value)}
    </td>
  );
}
