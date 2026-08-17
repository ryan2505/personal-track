import { addDays, isoWeekday, type LocalDate } from "@/lib/domain";
import { formatLongDate, formatMonth, WEEKDAYS } from "@/lib/labels";
import { cn, formatPercent, levelClass } from "@/lib/utils";

/**
 * Calendrier en lecture seule, reconstruit à partir d'une seule date de départ
 * et d'une suite de scores. Pas d'accès au store : utilisable tel quel chez un
 * destinataire qui n'a aucune donnée.
 */
export function MonthHeatmap({
  from,
  scores,
  showLegend = true,
}: {
  from: LocalDate;
  scores: (number | null)[];
  showLegend?: boolean;
}) {
  const leading = isoWeekday(from) - 1;

  return (
    <div>
      <p className="text-faint mb-2 text-xs capitalize">{formatMonth(from)}</p>

      <div className="text-faint mb-1.5 grid grid-cols-7 gap-1 text-center text-[9px] uppercase">
        {WEEKDAYS.map((day) => (
          <span key={day.label}>{day.short}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leading }, (_, index) => (
          <span key={`pad-${index}`} />
        ))}
        {scores.map((score, index) => {
          const date = addDays(from, index);
          return (
            <span
              key={date}
              title={`${formatLongDate(date)} — ${formatPercent(score)}`}
              className={cn(
                "flex aspect-square items-center justify-center rounded-sm text-[10px]",
                levelClass(score),
                score !== null && score >= 0.7 ? "text-bg" : "text-faint",
              )}
            >
              <span className="tabular">{Number(date.slice(8, 10))}</span>
            </span>
          );
        })}
      </div>

      {showLegend && (
        <div className="text-faint mt-3 flex items-center justify-end gap-1.5 text-[9px]">
          <span>Moins</span>
          {["bg-level-0", "bg-level-1", "bg-level-2", "bg-level-3", "bg-level-4"].map((tone) => (
            <span key={tone} className={cn("size-2.5 rounded-sm", tone)} />
          ))}
          <span>Plus</span>
        </div>
      )}
    </div>
  );
}
