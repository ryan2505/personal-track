"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/AppShell";
import { AreaBreakdown } from "@/components/metrics/AreaBreakdown";
import { GoalScoreList } from "@/components/metrics/GoalScoreList";
import { LayerScores } from "@/components/metrics/LayerScores";
import { MetricForm } from "@/components/metrics/MetricForm";
import { MetricSection } from "@/components/metrics/MetricSection";
import { MonthlyReview } from "@/components/metrics/MonthlyReview";
import { Observations } from "@/components/metrics/Observations";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  diagnoseMonth,
  findMonthlyReview,
  freezeScorecard,
  indexEntries,
  metricsForPeriod,
  periodFor,
  periodScorecard,
  periodStart,
  scorecardVerdict,
  shiftPeriod,
  type LocalDate,
  type Metric,
  type MetricCadence,
  type MetricKind,
} from "@/lib/domain";
import {
  CADENCE_SHORT,
  formatLongDate,
  formatPeriod,
  LAYER_LABELS,
  LAYER_QUESTIONS,
  METRIC_CADENCES,
} from "@/lib/labels";
import { useStore } from "@/lib/store/StoreProvider";
import { cn } from "@/lib/utils";

export default function ScorecardPage() {
  const store = useStore();
  const { state, today } = store;
  const [cadence, setCadence] = useState<MetricCadence>("monthly");
  /** N'importe quelle date de la période affichée. La cadence fait le reste. */
  const [anchor, setAnchor] = useState<LocalDate>(today);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<{ metric: Metric | null; kind: MetricKind } | null>(null);

  const card = useMemo(
    () =>
      periodScorecard({
        goals: state.goals,
        habits: state.habits,
        logs: state.logs,
        metrics: state.metrics,
        metricEntries: state.metricEntries,
        period: periodFor(cadence, anchor),
        today,
      }),
    [state.goals, state.habits, state.logs, state.metrics, state.metricEntries, cadence, anchor, today],
  );

  const step = (amount: number) => setAnchor(periodStart(shiftPeriod(card.period, amount)));

  const previous = useMemo(() => shiftPeriod(card.period, -1), [card.period]);
  const next = useMemo(() => shiftPeriod(card.period, 1), [card.period]);
  const isMonthly = card.cadence === "monthly";
  const review = isMonthly ? findMonthlyReview(state.reviews, card.period) : undefined;

  /** Ce que « préparer le mois suivant » reconduirait : tout ce qui est au contrat. */
  const carryToNext = useMemo(() => {
    const index = indexEntries(state.metricEntries);
    const already = new Set(
      metricsForPeriod(state.metrics, index, next).map((row) => row.metric.id),
    );
    return metricsForPeriod(state.metrics, index, card.period)
      .map((row) => row.metric.id)
      .filter((id) => !already.has(id));
  }, [state.metrics, state.metricEntries, card.period, next]);

  /** Ce qui existe mais n'est pas au contrat du mois, et ce qui est reconductible. */
  const offers = useMemo(() => {
    const index = indexEntries(state.metricEntries);
    const inMonth = new Set(
      metricsForPeriod(state.metrics, index, card.period).map((row) => row.metric.id),
    );
    const carryable = new Set(
      metricsForPeriod(state.metrics, index, previous).map((row) => row.metric.id),
    );

    return (kind: MetricKind) => {
      const own = state.metrics.filter(
        (metric) =>
          metric.kind === kind &&
          metric.archivedAt === null &&
          // Une métrique mensuelle n'a rien à faire dans une vue semaine : son
          // entrée y serait posée sur une période qu'elle ne lit jamais.
          metric.cadence === card.cadence,
      );
      return {
        available: own.filter((metric) => !inMonth.has(metric.id)),
        carryable: own.filter((metric) => carryable.has(metric.id) && !inMonth.has(metric.id)),
      };
    };
  }, [state.metrics, state.metricEntries, card.period, card.cadence, previous]);

  const verdict = scorecardVerdict(card);
  const isFuture = card.start > today;

  const section = (kind: MetricKind) => {
    const { available, carryable } = offers(kind);
    return (
      <MetricSection
        title={kind === "output" ? LAYER_LABELS.execution : LAYER_LABELS.impact}
        question={kind === "output" ? LAYER_QUESTIONS.execution : LAYER_QUESTIONS.impact}
        kind={kind}
        score={kind === "output" ? card.execution : card.impact}
        period={card.period}
        available={available}
        previousPeriodCount={carryable.length}
        editing={editing}
        onChangeEntry={(metricId, patch) => store.setMetricEntry(metricId, card.period, patch)}
        onRemoveEntry={(metricId) => store.removeMetricEntry(metricId, card.period)}
        onAddToMonth={(metricId) =>
          store.setMetricEntry(metricId, card.period, { target: null, actual: null })
        }
        onCarryOver={() =>
          store.carryOverMetrics(
            previous,
            card.period,
            carryable.map((metric) => metric.id),
          )
        }
        onCreate={() => setForm({ metric: null, kind })}
        onEdit={(metric) => setForm({ metric, kind })}
      />
    );
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Bilan"
        subtitle="Ce que tu as fait, ce que tu as produit, ce que ça a généré."
        action={
          <div className="flex gap-1">
            <button
              aria-label="Période précédente"
              onClick={() => step(-1)}
              className="text-muted hover:text-text flex size-9 items-center justify-center rounded-md"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              aria-label="Période suivante"
              onClick={() => step(1)}
              className="text-muted hover:text-text flex size-9 items-center justify-center rounded-md"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        }
      />

      <div className="border-border mb-4 flex w-fit overflow-hidden rounded-md border">
        {METRIC_CADENCES.map((item) => (
          <button
            key={item}
            onClick={() => {
              setCadence(item);
              // On reste sur la même date : passer de « semaine 34 » à « août »
              // doit montrer le mois qui contient cette semaine, pas aujourd'hui.
              setEditing(false);
            }}
            className={cn(
              "px-4 py-2 text-xs transition-colors",
              cadence === item ? "bg-surface-2 text-text" : "text-muted hover:text-text",
            )}
          >
            {CADENCE_SHORT[item]}
          </button>
        ))}
      </div>

      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-faint text-xs first-letter:capitalize">
          {formatPeriod(card.period)}
          {card.inProgress && (
            <span className="normal-case"> · en cours, arrêté au {formatLongDate(card.asOf)}</span>
          )}
        </p>
        {!isFuture && (
          <Button onClick={() => setEditing((value) => !value)} className="h-9 text-xs">
            {editing ? "Terminer la saisie" : "Saisir les chiffres"}
          </Button>
        )}
      </div>

      {isFuture ? (
        <Card>
          <EmptyState
            title={isMonthly ? "Mois à venir" : "Semaine à venir"}
            description="Rien à mesurer : cette période n'a pas encore commencé."
          />
        </Card>
      ) : (
        <>
          <Card
            className={cn("mb-5 p-5", verdict.tone === "celebrate" && "border-success/40 bg-success/5")}
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

          <LayerScores card={card} />

          <AreaBreakdown card={card} />

          {section("output")}
          {section("result")}

          {isMonthly && <Observations observations={diagnoseMonth(card)} />}

          <GoalScoreList rows={card.goals} />

          {isMonthly && (
          <MonthlyReview
            review={review}
            card={card}
            onAnswer={(patch) => store.answerMonthlyReview(card.period, patch)}
            onClose={() => store.closeMonthlyReview(card.period, freezeScorecard(card))}
            onReopen={() => store.reopenMonthlyReview(card.period)}
            onPrepareNext={() => store.carryOverMetrics(card.period, next, carryToNext)}
            nextMonthLabel={formatPeriod(next)}
            canPrepareNext={carryToNext.length > 0}
          />
          )}

          {card.inProgress && (
            <p className="text-faint mt-4 text-xs leading-relaxed">
              La période n&apos;est pas terminée : seules les journées écoulées sont comptées. Les
              jours à venir ne pèsent pas encore contre toi.
            </p>
          )}

          {!isMonthly && (
            <p className="text-faint mt-4 text-xs leading-relaxed">
              La lecture croisée des couches et la revue vivent à l&apos;échelle du mois. Tes
              cibles hebdomadaires y remontent, additionnées sur les semaines du mois.
            </p>
          )}
        </>
      )}

      {form !== null && (
        <MetricForm
          key={form.metric?.id ?? "new"}
          metric={form.metric}
          defaultCadence={cadence}
          open
          onClose={() => setForm(null)}
          onSubmit={(input) => {
            if (form.metric === null) {
              const created = store.addMetric({ ...input, kind: form.kind });
              // Elle entre aussitôt au contrat de la période courante — sinon
              // elle disparaîtrait de l'écran d'où on vient de la créer. La
              // période suit SA cadence : créer une cible hebdomadaire depuis
              // la vue mensuelle la pose sur la semaine en cours.
              store.setMetricEntry(created.id, periodFor(created.cadence, anchor), {
                target: null,
                actual: null,
              });
            } else {
              store.updateMetric(form.metric.id, input);
            }
          }}
          onArchive={() => {
            if (form.metric !== null) store.archiveMetric(form.metric.id);
          }}
        />
      )}
    </main>
  );
}
