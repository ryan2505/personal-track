"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/AppShell";
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
  addDays,
  diagnoseMonth,
  endOfMonth,
  findMonthlyReview,
  freezeScorecard,
  indexEntries,
  metricsForPeriod,
  monthlyScorecard,
  scorecardVerdict,
  shiftPeriod,
  startOfMonth,
  type LocalDate,
  type Metric,
  type MetricKind,
} from "@/lib/domain";
import {
  formatLongDate,
  formatMonth,
  formatPeriod,
  LAYER_LABELS,
  LAYER_QUESTIONS,
} from "@/lib/labels";
import { useStore } from "@/lib/store/StoreProvider";
import { cn } from "@/lib/utils";

export default function ScorecardPage() {
  const store = useStore();
  const { state, today } = store;
  const [month, setMonth] = useState<LocalDate>(today);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<{ metric: Metric | null; kind: MetricKind } | null>(null);

  const card = useMemo(
    () =>
      monthlyScorecard({
        goals: state.goals,
        habits: state.habits,
        logs: state.logs,
        metrics: state.metrics,
        metricEntries: state.metricEntries,
        month,
        today,
      }),
    [state.goals, state.habits, state.logs, state.metrics, state.metricEntries, month, today],
  );

  const previous = useMemo(() => shiftPeriod(card.period, -1), [card.period]);
  const next = useMemo(() => shiftPeriod(card.period, 1), [card.period]);
  const review = findMonthlyReview(state.reviews, card.period);

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
        (metric) => metric.kind === kind && metric.archivedAt === null,
      );
      return {
        available: own.filter((metric) => !inMonth.has(metric.id)),
        carryable: own.filter((metric) => carryable.has(metric.id) && !inMonth.has(metric.id)),
      };
    };
  }, [state.metrics, state.metricEntries, card.period, previous]);

  const verdict = scorecardVerdict(card);
  const isFuture = card.monthStart > today;

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
        title="Bilan mensuel"
        subtitle="Ce que tu as fait, ce que tu as produit, ce que ça a généré."
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

      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-faint text-xs capitalize">
          {formatMonth(card.monthStart)}
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
            title="Mois à venir"
            description="Rien à mesurer : ce mois n'a pas encore commencé."
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

          {section("output")}
          {section("result")}

          <Observations observations={diagnoseMonth(card)} />

          <GoalScoreList rows={card.goals} />

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

          {card.inProgress && (
            <p className="text-faint mt-4 text-xs leading-relaxed">
              Le mois n&apos;est pas terminé : seules les journées écoulées sont comptées. Les jours
              à venir ne pèsent pas encore contre toi.
            </p>
          )}
        </>
      )}

      {form !== null && (
        <MetricForm
          key={form.metric?.id ?? "new"}
          metric={form.metric}
          open
          onClose={() => setForm(null)}
          onSubmit={(input) => {
            if (form.metric === null) {
              const created = store.addMetric({ ...input, kind: form.kind });
              // Une métrique créée depuis un mois y entre aussitôt : sinon elle
              // disparaîtrait de l'écran d'où on vient de la créer.
              store.setMetricEntry(created.id, card.period, { target: null, actual: null });
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
