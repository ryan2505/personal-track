"use client";

import { Check, Minus, Plus, StickyNote } from "lucide-react";

import { computeCompletion, type Habit, type HabitLog, type LocalDate } from "@/lib/domain";
import { CATEGORY_LABELS, formatValue } from "@/lib/labels";
import { useStore } from "@/lib/store/StoreProvider";
import { cn } from "@/lib/utils";

/** Incréments pensés pour le pouce : jamais de clavier pour un usage courant. */
export function stepFor(habit: Habit): number {
  if (habit.type === "duration") return 15;
  if (habit.type === "quantity") return 0.5;
  const target = habit.targetValue ?? 1;
  if (target >= 50) return 10;
  if (target >= 20) return 5;
  return 1;
}

export function HabitRow({
  habit,
  date,
  log,
  onOpenDetail,
  subtitle,
}: {
  habit: Habit;
  date: LocalDate;
  log: HabitLog | undefined;
  onOpenDetail: () => void;
  subtitle?: string;
}) {
  const { toggleHabit, adjustValue } = useStore();
  const completion = computeCompletion(habit, log);
  const done = completion === 1;
  const measured = habit.type !== "boolean";

  const bump = (direction: number) => {
    adjustValue(habit, date, direction * stepFor(habit));
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
      <button
        onClick={() => toggleHabit(habit, date)}
        aria-label={done ? `Décocher ${habit.title}` : `Cocher ${habit.title}`}
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
          done
            ? "border-accent bg-accent text-bg"
            : "border-border-strong text-transparent hover:border-accent",
        )}
      >
        <Check className="size-4" strokeWidth={3} />
      </button>

      <button onClick={onOpenDetail} className="min-w-0 flex-1 text-left">
        <span className={cn("block truncate text-sm", done ? "text-muted line-through" : "text-text")}>
          {habit.title}
        </span>
        <span className="text-faint block truncate text-xs">
          {subtitle ?? CATEGORY_LABELS[habit.category]}
          {log?.note !== null && log?.note !== undefined && log.note !== "" && (
            <StickyNote className="ml-1.5 inline size-3 align-[-1px]" />
          )}
        </span>
      </button>

      {measured ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => bump(-1)}
            aria-label="Diminuer"
            className="text-muted hover:text-text flex size-9 items-center justify-center rounded-md"
          >
            <Minus className="size-4" />
          </button>
          <span className="tabular text-muted w-24 text-center text-xs">
            {formatValue(habit, log?.value ?? 0)}
          </span>
          <button
            onClick={() => bump(1)}
            aria-label="Augmenter"
            className="text-muted hover:text-text flex size-9 items-center justify-center rounded-md"
          >
            <Plus className="size-4" />
          </button>
        </div>
      ) : (
        <span className="tabular text-faint shrink-0 text-xs">{done ? "100%" : ""}</span>
      )}
    </div>
  );
}
