"use client";

import { Check, Pencil, X } from "lucide-react";

import { TextInput } from "@/components/ui/Field";
import { ProgressBar } from "@/components/ui/Progress";
import type { MetricRow } from "@/lib/domain";
import { formatMetricValue, METRIC_DIRECTION_LABELS } from "@/lib/labels";
import type { EntryPatch } from "@/lib/store/StoreProvider";
import { cn, formatPercent } from "@/lib/utils";

/**
 * Une ligne de métrique dans le bilan.
 *
 * Aucun calcul ici : `ratio` et `gap` viennent du domaine. Le composant ne fait
 * que choisir les mots — et le mot compte : un écart s'annonce comme un écart,
 * jamais comme un échec.
 */
export function MetricLine({
  row,
  editing,
  onChange,
  onRemove,
  onEdit,
}: {
  row: MetricRow;
  editing: boolean;
  onChange: (patch: EntryPatch) => void;
  onRemove: () => void;
  onEdit: () => void;
}) {
  const { metric, entry, ratio } = row;

  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm">
            {row.reached && <Check className="text-success size-4 shrink-0" />}
            <span className={cn("truncate", row.reached && "text-muted")}>{metric.name}</span>
          </p>
          <p className="text-faint mt-0.5 text-xs">
            {metric.group ?? METRIC_DIRECTION_LABELS[metric.direction]}
            {!row.scorable && " · suivi seul"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="tabular text-sm">{row.scorable ? formatPercent(ratio) : "—"}</span>
          {editing && (
            <>
              <button
                aria-label={`Modifier ${metric.name}`}
                onClick={onEdit}
                className="text-faint hover:text-text flex size-8 items-center justify-center rounded-md"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                aria-label={`Retirer ${metric.name} de ce mois`}
                onClick={onRemove}
                className="text-faint hover:text-danger flex size-8 items-center justify-center rounded-md"
              >
                <X className="size-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {row.scorable && <ProgressBar ratio={ratio} className="mt-3" tone={row.reached ? "success" : "accent"} />}

      {editing ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <NumberField
            label="Cible"
            value={entry.target}
            onCommit={(target) => onChange({ target })}
          />
          <NumberField
            label="Réalisé"
            value={entry.actual}
            onCommit={(actual) => onChange({ actual })}
          />
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
          <span className="text-muted tabular">
            {formatMetricValue(metric, entry.actual)}
            {entry.target !== null && ` / ${formatMetricValue(metric, entry.target)}`}
          </span>
          <GapLabel row={row} />
        </div>
      )}
    </div>
  );
}

function GapLabel({ row }: { row: MetricRow }) {
  const { metric, entry, gap } = row;

  if (entry.actual === null) {
    return <span className="text-faint">Pas encore saisi</span>;
  }
  if (gap === null) {
    return <span className="text-faint">Sans cible</span>;
  }
  if (gap === 0) {
    return <span className="text-success tabular">Cible atteinte</span>;
  }

  const value = formatMetricValue(metric, gap);
  return (
    <span className="text-warn tabular">
      {metric.direction === "decrease" ? `Dépassement : ${value}` : `Manque : ${value}`}
    </span>
  );
}

/**
 * Champ numérique tolérant au vide.
 *
 * Vider le champ écrit `null`, pas `0` : « je n'ai pas encore relevé » et
 * « j'ai fait zéro » sont deux états différents, et le score ne traite que le
 * second. La valeur est validée à la sortie du champ, pas à chaque frappe :
 * taper « 250 » passerait sinon par 2 puis 25.
 */
function NumberField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number | null;
  onCommit: (value: number | null) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-faint text-[11px] tracking-wide uppercase">{label}</span>
      <TextInput
        type="number"
        inputMode="decimal"
        defaultValue={value === null ? "" : String(value)}
        onBlur={(event) => {
          const raw = event.target.value.trim();
          if (raw === "") return onCommit(null);
          const parsed = Number(raw);
          onCommit(Number.isFinite(parsed) ? parsed : null);
        }}
        className="tabular py-2"
      />
    </label>
  );
}
