"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { HabitRow } from "@/components/habits/HabitRow";
import { LogDetailModal } from "@/components/habits/LogDetailModal";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  addDays,
  dailyScore,
  eachDay,
  endOfMonth,
  expectedOn,
  findLog,
  isoWeekday,
  startOfMonth,
  type Habit,
  type LocalDate,
} from "@/lib/domain";
import { formatLongDate, formatMonth, WEEKDAYS } from "@/lib/labels";
import { useLogIndex } from "@/lib/store/selectors";
import { useStore } from "@/lib/store/StoreProvider";
import { cn, formatPercent, levelClass } from "@/lib/utils";

export default function CalendarPage() {
  const { state, today } = useStore();
  const index = useLogIndex();
  const [cursor, setCursor] = useState<LocalDate>(today);
  const [selected, setSelected] = useState<LocalDate>(today);
  const [detail, setDetail] = useState<Habit | null>(null);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);

  const days = useMemo(() => {
    return eachDay(monthStart, monthEnd).map((date) => ({
      date,
      score: dailyScore(state.habits, index, date).score,
    }));
  }, [monthStart, monthEnd, state.habits, index]);

  const leading = isoWeekday(monthStart) - 1;
  const selectedHabits = expectedOn(state.habits, selected);
  const selectedScore = dailyScore(state.habits, index, selected);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader title="Calendrier" subtitle="Clique un jour pour le consulter ou le corriger." />

      <Card className="mb-6">
        <CardHeader
          title={<span className="capitalize">{formatMonth(cursor)}</span>}
          action={
            <div className="flex gap-1">
              <button
                aria-label="Mois précédent"
                onClick={() => setCursor(addDays(startOfMonth(cursor), -1))}
                className="text-muted hover:text-text flex size-9 items-center justify-center rounded-md"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                aria-label="Mois suivant"
                onClick={() => setCursor(addDays(endOfMonth(cursor), 1))}
                className="text-muted hover:text-text flex size-9 items-center justify-center rounded-md"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          }
        />

        <div className="p-4 sm:p-5">
          <div className="text-faint mb-2 grid grid-cols-7 gap-1.5 text-center text-[10px] uppercase">
            {WEEKDAYS.map((day) => (
              <span key={day.label}>{day.short}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: leading }, (_, i) => (
              <span key={`pad-${i}`} />
            ))}
            {days.map(({ date, score }) => {
              const isToday = date === today;
              const isSelected = date === selected;
              return (
                <button
                  key={date}
                  onClick={() => setSelected(date)}
                  title={`${formatLongDate(date)} — ${formatPercent(score)}`}
                  className={cn(
                    "relative aspect-square rounded-sm text-[11px] transition-colors",
                    levelClass(score),
                    score !== null && score >= 0.7 ? "text-bg" : "text-muted",
                    isSelected && "ring-accent ring-2 ring-offset-1 ring-offset-[var(--color-bg)]",
                  )}
                >
                  <span className="tabular absolute inset-0 flex items-center justify-center">
                    {Number(date.slice(8, 10))}
                  </span>
                  {isToday && (
                    <span className="bg-accent absolute inset-x-0 -bottom-0.5 mx-auto size-1 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="text-faint mt-4 flex items-center justify-end gap-1.5 text-[10px]">
            <span>Moins</span>
            {["bg-level-0", "bg-level-1", "bg-level-2", "bg-level-3", "bg-level-4"].map((tone) => (
              <span key={tone} className={cn("size-2.5 rounded-sm", tone)} />
            ))}
            <span>Plus</span>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={<span className="capitalize">{formatLongDate(selected)}</span>}
          action={
            <span className="tabular text-muted text-sm">{formatPercent(selectedScore.score)}</span>
          }
        />
        {selectedHabits.length === 0 ? (
          <EmptyState
            title="Jour neutre"
            description="Aucune habitude n'était planifiée ce jour-là. Il ne compte ni en positif ni en négatif dans ta consistance."
          />
        ) : (
          <div className="divide-border divide-y">
            {selectedHabits.map((habit) => (
              <HabitRow
                key={habit.id}
                habit={habit}
                date={selected}
                log={findLog(index, habit.id, selected)}
                onOpenDetail={() => setDetail(habit)}
              />
            ))}
          </div>
        )}
      </Card>

      <LogDetailModal
        habit={detail}
        date={selected}
        log={detail === null ? undefined : findLog(index, detail.id, selected)}
        onClose={() => setDetail(null)}
      />
    </main>
  );
}
