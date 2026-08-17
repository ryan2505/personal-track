import { Check } from "lucide-react";

import { MonthHeatmap } from "@/components/calendar/MonthHeatmap";
import { Card } from "@/components/ui/Card";
import { ProgressBar, ScoreRing } from "@/components/ui/Progress";
import { formatLongDate } from "@/lib/labels";
import type { ShareSnapshot } from "@/lib/share/snapshot";
import { cn, formatPercent } from "@/lib/utils";

/**
 * Rendu d'un instantané. Volontairement identique dans l'aperçu et chez le
 * destinataire : ce que l'on voit avant d'envoyer est exactement ce qui part.
 */
export function ShareCard({ snapshot }: { snapshot: ShareSnapshot }) {
  const hasStats =
    snapshot.daily !== undefined ||
    snapshot.streak !== undefined ||
    snapshot.week !== undefined ||
    snapshot.month !== undefined;

  return (
    <Card className="overflow-hidden">
      <div className="border-border border-b px-5 py-4">
        <p className="text-faint text-xs tracking-[0.18em] uppercase">Personal OS</p>
        <p className="mt-1 text-base font-medium">{snapshot.name}</p>
        <p className="text-faint text-xs capitalize">{formatLongDate(snapshot.date)}</p>
      </div>

      {snapshot.note !== undefined && snapshot.note !== "" && (
        <p className="font-display border-border border-b px-5 py-4 text-lg leading-snug">
          {snapshot.note}
        </p>
      )}

      {hasStats && (
        <div className="flex flex-wrap items-center gap-6 px-5 py-5">
          {snapshot.daily !== undefined && (
            <ScoreRing ratio={snapshot.daily} size={64} label={formatPercent(snapshot.daily)} />
          )}
          <div className="space-y-1 text-sm">
            {snapshot.streak !== undefined && (
              <p className="tabular">
                Série : {snapshot.streak.current}{" "}
                <span className="text-faint">· record {snapshot.streak.longest}</span>
              </p>
            )}
            {snapshot.week !== undefined && (
              <p className="text-muted tabular">
                Cette semaine : {formatPercent(snapshot.week ?? null)}
              </p>
            )}
            {snapshot.month !== undefined && (
              <p className="text-muted tabular">Ce mois : {formatPercent(snapshot.month ?? null)}</p>
            )}
          </div>
        </div>
      )}

      {snapshot.spark !== undefined && snapshot.spark.length > 0 && (
        <div className="border-border border-t px-5 py-4">
          <p className="text-faint mb-2 text-xs">7 derniers jours</p>
          <div className="flex h-12 items-end gap-1.5">
            {snapshot.spark.map((score, index) => (
              <div key={index} className="flex h-full flex-1 items-end">
                <div
                  className={cn(
                    "w-full rounded-sm",
                    score === null ? "bg-border" : "bg-accent",
                  )}
                  style={{ height: `${score === null ? 5 : Math.max(5, score * 100)}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {snapshot.calendar !== undefined && snapshot.calendar.scores.length > 0 && (
        <div className="border-border border-t px-5 py-4">
          <p className="text-faint mb-2 text-xs">Calendrier</p>
          <MonthHeatmap
            from={snapshot.calendar.from}
            scores={snapshot.calendar.scores}
          />
        </div>
      )}

      {snapshot.tracking !== undefined && (
        <div className="border-border border-t px-5 py-4">
          <p className="text-faint mb-3 text-xs">Suivi du jour</p>
          {snapshot.tracking.length === 0 ? (
            <p className="text-faint text-xs leading-relaxed">
              Aucune habitude n&apos;était planifiée ce jour — un jour neutre, qui ne compte ni
              en positif ni en négatif.
            </p>
          ) : (
            <ul className="space-y-2">
              {snapshot.tracking.map((item) => {
                const done = item.completion === 1;
                return (
                  <li key={item.title} className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border",
                        done
                          ? "border-accent bg-accent text-bg"
                          : "border-border-strong text-transparent",
                      )}
                    >
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-xs",
                        done ? "text-muted line-through" : "text-text",
                      )}
                    >
                      {item.title}
                    </span>
                    {item.detail !== "" && (
                      <span className="tabular text-faint shrink-0 text-xs">{item.detail}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {snapshot.areas !== undefined && snapshot.areas.length > 0 && (
        <div className="border-border space-y-3 border-t px-5 py-4">
          <p className="text-faint text-xs">Domaines de vie</p>
          {snapshot.areas.map((area) => (
            <div key={area.label}>
              <div className="mb-1 flex items-baseline justify-between text-xs">
                <span className="text-muted">{area.label}</span>
                <span className="tabular">{formatPercent(area.score)}</span>
              </div>
              <ProgressBar ratio={area.score} />
            </div>
          ))}
        </div>
      )}

      {snapshot.goals !== undefined && snapshot.goals.length > 0 && (
        <div className="border-border space-y-3 border-t px-5 py-4">
          <p className="text-faint text-xs">Objectifs</p>
          {snapshot.goals.map((goal) => (
            <div key={goal.title}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                <span className="text-muted truncate">{goal.title}</span>
                <span className="tabular shrink-0">
                  {goal.current}
                  {goal.target !== null && ` / ${goal.target}`}
                </span>
              </div>
              <ProgressBar ratio={goal.ratio} />
            </div>
          ))}
        </div>
      )}

      {snapshot.habits !== undefined && snapshot.habits.length > 0 && (
        <div className="border-border border-t px-5 py-4">
          <p className="text-faint mb-2 text-xs">Habitudes</p>
          <ul className="space-y-1.5">
            {snapshot.habits.map((habit) => (
              <li key={habit.title} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate">{habit.title}</span>
                <span className="text-faint shrink-0">
                  {habit.schedule}
                  {habit.streak !== null && habit.streak > 0 && (
                    <span className="tabular text-accent"> · {habit.streak}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
