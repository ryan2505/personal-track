"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Field";
import { cadenceOf, type Metric, type MetricKind, type MetricsScore, type Period } from "@/lib/domain";
import { formatPeriod, METRIC_KIND_LABELS } from "@/lib/labels";
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
          title={`Aucune ${METRIC_KIND_LABELS[kind].toLowerCase()} sur ${formatPeriod(period)}`}
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
          {rows.map((row) => (
            // La période fait partie de la clé : changer de mois doit repartir
            // des champs du nouveau mois, pas garder ceux de l'ancien.
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
