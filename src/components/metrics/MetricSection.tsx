"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Field";
import {
  cadenceOf,
  type HabitCategory,
  type Metric,
  type MetricKind,
  type MetricRow,
  type MetricsScore,
  type Period,
} from "@/lib/domain";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/labels";
/** « Aucune production », « Aucun résultat » — l'accord suit le mot, pas le type. */
const EMPTY_TITLES: Record<MetricKind, string> = {
  output: "Aucune production chiffrée",
  result: "Aucun résultat chiffré",
};
import type { EntryPatch } from "@/lib/store/StoreProvider";
import { formatPercent } from "@/lib/utils";

import { MetricLine } from "./MetricLine";

/**
 * Une couche du bilan : ses métriques, son score, et de quoi la remplir.
 *
 * Le score en tête est celui de la couche seule. Il n'est jamais fondu avec les
 * autres : c'est l'écart entre les couches qui porte l'information.
 */
export function MetricSection({
  title,
  question,
  kind,
  score,
  period,
  available,
  previousPeriodCount,
  editing,
  onChangeEntry,
  onRemoveEntry,
  onAddToMonth,
  onCarryOver,
  onCreate,
  onEdit,
}: {
  title: string;
  question: string;
  kind: MetricKind;
  score: MetricsScore;
  period: Period;
  /** Métriques de cette couche pas encore au contrat de la période. */
  available: Metric[];
  /** Nombre de métriques reconductibles depuis la période précédente. */
  previousPeriodCount: number;
  editing: boolean;
  onChangeEntry: (metricId: string, patch: EntryPatch) => void;
  onRemoveEntry: (metricId: string) => void;
  onAddToMonth: (metricId: string) => void;
  onCarryOver: () => void;
  onCreate: () => void;
  onEdit: (metric: Metric) => void;
}) {
  const [picked, setPicked] = useState("");
  const word = cadenceOf(period) === "weekly" ? "la semaine" : "le mois";

  /**
   * En lecture, les lignes sont triées par le domaine : ce qui reste à faire
   * d'abord. En saisie, elles sont figées par ordre alphabétique.
   *
   * Sans ça, porter une métrique à 100 % la fait descendre en bas de la section
   * pendant qu'on tape, et le champ suivant qu'on croit viser appartient déjà à
   * une autre métrique. Un tri utile à la lecture devient un piège à la saisie.
   */
  const rows = editing
    ? [...score.rows].sort((a, b) => a.metric.name.localeCompare(b.metric.name, "fr"))
    : score.rows;

  /**
   * Regroupement par domaine de vie, dans l'ordre du produit.
   *
   * L'en-tête n'apparaît qu'à partir de deux domaines : sur une seule
   * catégorie, il n'annonce rien et ne fait qu'ajouter une ligne de bruit
   * au-dessus de chaque section.
   */
  const groups = useMemo(() => {
    const byCategory = new Map<HabitCategory, MetricRow[]>();
    for (const row of rows) {
      const bucket = byCategory.get(row.metric.category);
      if (bucket === undefined) byCategory.set(row.metric.category, [row]);
      else bucket.push(row);
    }
    return [...byCategory.entries()].sort(
      (a, b) => CATEGORIES.indexOf(a[0]) - CATEGORIES.indexOf(b[0]),
    );
  }, [rows]);

  return (
    <Card className="mb-4">
      <CardHeader
        title={
          <span className="flex items-baseline gap-2">
            {title}
            <span className="text-faint text-xs font-normal">{question}</span>
          </span>
        }
        action={
          <span className="tabular text-sm">
            {formatPercent(score.score)}
            {score.scored > 0 && (
              <span className="text-faint ml-2 text-xs">
                {score.reached}/{score.scored}
              </span>
            )}
          </span>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title={`${EMPTY_TITLES[kind]} sur cette ${word === "la semaine" ? "semaine" : "période"}`}
          description={
            previousPeriodCount > 0
              ? `Reconduis ${word === "la semaine" ? "la semaine précédente" : "le mois précédent"}, ou pose de nouvelles cibles.`
              : "Une cible chiffrée transforme une période en engagement plutôt qu'en intention."
          }
          action={
            previousPeriodCount > 0 ? (
              <Button onClick={onCarryOver}>
                Reconduire {word === "la semaine" ? "la semaine précédente" : "le mois précédent"}
              </Button>
            ) : (
              <Button variant="primary" onClick={onCreate}>
                Créer une métrique
              </Button>
            )
          }
        />
      ) : (
        <div className="divide-border divide-y">
          {groups.map(([category, groupRows]) => (
            <div key={category}>
              {groups.length > 1 && (
                <p className="text-faint bg-surface-2/40 px-4 py-1.5 text-[11px] tracking-wide uppercase sm:px-5">
                  {CATEGORY_LABELS[category]}
                </p>
              )}
              <div className="divide-border divide-y">
                {groupRows.map((row) => (
                  // La période fait partie de la clé : changer de mois doit
                  // repartir des champs du nouveau mois, pas garder l'ancien.
                  <MetricLine
                    key={`${row.metric.id}|${row.entry.period}`}
                    row={row}
                    editing={editing}
                    onChange={(patch) => onChangeEntry(row.metric.id, patch)}
                    onRemove={() => onRemoveEntry(row.metric.id)}
                    onEdit={() => onEdit(row.metric)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="border-border flex flex-wrap items-center gap-2 border-t px-4 py-3 sm:px-5">
          {available.length > 0 && (
            <>
              <Select
                value={picked}
                onChange={(event) => {
                  const id = event.target.value;
                  setPicked("");
                  if (id !== "") onAddToMonth(id);
                }}
                className="h-10 w-auto min-w-40 flex-1 py-0 text-xs"
              >
                <option value="">Ajouter à {word}…</option>
                {available.map((metric) => (
                  <option key={metric.id} value={metric.id}>
                    {metric.name}
                  </option>
                ))}
              </Select>
              {previousPeriodCount > 0 && rows.length > 0 && (
                <Button onClick={onCarryOver} className="h-10 text-xs">
                  Reconduire
                </Button>
              )}
            </>
          )}
          <Button onClick={onCreate} className="h-10 text-xs">
            <Plus className="size-3.5" />
            Nouvelle
          </Button>
        </div>
      )}
    </Card>
  );
}
