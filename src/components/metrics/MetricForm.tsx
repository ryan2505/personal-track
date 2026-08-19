"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import type {
  HabitCategory,
  Metric,
  MetricCadence,
  MetricDirection,
  MetricKind,
  MetricValueType,
} from "@/lib/domain";
import {
  CADENCE_HINTS,
  CADENCE_LABELS,
  CATEGORIES,
  CATEGORY_LABELS,
  METRIC_CADENCES,
  METRIC_DIRECTION_HINTS,
  METRIC_DIRECTION_LABELS,
  METRIC_DIRECTIONS,
  METRIC_KIND_LABELS,
  METRIC_KINDS,
  METRIC_VALUE_TYPES,
  VALUE_TYPE_LABELS,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

const KIND_HINTS: Record<MetricKind, string> = {
  output: "Ce que tu produis et que tu contrôles : contenus publiés, prospects contactés.",
  result: "Ce que ça génère, et que tu ne décides pas seul : chiffre d'affaires, abonnés.",
};

export function MetricForm({
  metric,
  defaultCadence,
  open,
  onClose,
  onSubmit,
  onArchive,
}: {
  metric: Metric | null;
  /** Cadence proposée à la création — celle de la vue d'où l'on vient. */
  defaultCadence: MetricCadence;
  open: boolean;
  onClose: () => void;
  onSubmit: (metric: Omit<Metric, "id" | "archivedAt">) => void;
  onArchive: () => void;
}) {
  const [name, setName] = useState(metric?.name ?? "");
  const [kind, setKind] = useState<MetricKind>(metric?.kind ?? "output");
  const [cadence, setCadence] = useState<MetricCadence>(metric?.cadence ?? defaultCadence);
  const [category, setCategory] = useState<HabitCategory>(metric?.category ?? "business");
  const [group, setGroup] = useState(metric?.group ?? "");
  const [unit, setUnit] = useState(metric?.unit ?? "");
  const [valueType, setValueType] = useState<MetricValueType>(metric?.valueType ?? "count");
  const [direction, setDirection] = useState<MetricDirection>(metric?.direction ?? "increase");
  const [weight, setWeight] = useState(String(metric?.weight ?? 1));

  const submit = () => {
    if (name.trim() === "") return;
    onSubmit({
      name: name.trim(),
      kind,
      cadence,
      category,
      group: group.trim() === "" ? null : group.trim(),
      unit: unit.trim() === "" ? null : unit.trim(),
      valueType,
      direction,
      weight: Math.max(1, Number(weight) || 1),
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={metric === null ? "Nouvelle métrique" : "Modifier"}>
      <div className="space-y-4">
        <Field label="Intitulé">
          <TextInput
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Contenus publiés"
            autoFocus
          />
        </Field>

        <Field label="Nature" hint={KIND_HINTS[kind]}>
          <div className="grid grid-cols-2 gap-2">
            {METRIC_KINDS.map((item) => (
              <button
                key={item}
                onClick={() => setKind(item)}
                className={cn(
                  "min-h-11 rounded-md border px-3 text-sm transition-colors",
                  kind === item
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted hover:border-border-strong",
                )}
              >
                {METRIC_KIND_LABELS[item]}
              </button>
            ))}
          </div>
        </Field>

        <Field
          label="Rythme"
          hint={
            metric === null
              ? CADENCE_HINTS[cadence]
              : "Le rythme ne se change pas après coup : les périodes déjà chiffrées n'auraient plus de sens. Arrête cette métrique et crée-en une autre."
          }
        >
          <div className="grid grid-cols-2 gap-2">
            {METRIC_CADENCES.map((item) => (
              <button
                key={item}
                onClick={() => metric === null && setCadence(item)}
                disabled={metric !== null && metric.cadence !== item}
                className={cn(
                  "min-h-11 rounded-md border px-3 text-sm transition-colors",
                  cadence === item
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted hover:border-border-strong",
                  metric !== null && "disabled:opacity-30",
                )}
              >
                {CADENCE_LABELS[item]}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Domaine">
            <Select
              value={category}
              onChange={(event) => setCategory(event.target.value as HabitCategory)}
            >
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {CATEGORY_LABELS[item]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Projet" hint="Facultatif — « YouTube », « Coaching ».">
            <TextInput
              value={group}
              onChange={(event) => setGroup(event.target.value)}
              placeholder="YouTube"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Format">
            <Select
              value={valueType}
              onChange={(event) => setValueType(event.target.value as MetricValueType)}
            >
              {METRIC_VALUE_TYPES.map((item) => (
                <option key={item} value={item}>
                  {VALUE_TYPE_LABELS[item]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Unité">
            <TextInput
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              placeholder="FCFA"
            />
          </Field>
        </div>

        <Field label="Sens de la cible" hint={METRIC_DIRECTION_HINTS[direction]}>
          <Select
            value={direction}
            onChange={(event) => setDirection(event.target.value as MetricDirection)}
          >
            {METRIC_DIRECTIONS.map((item) => (
              <option key={item} value={item}>
                {METRIC_DIRECTION_LABELS[item]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Poids" hint="Une métrique de poids 3 pèse trois fois plus dans le score de sa couche.">
          <Select value={weight} onChange={(event) => setWeight(event.target.value)}>
            <option value="1">Normal</option>
            <option value="2">Important</option>
            <option value="3">Critique</option>
          </Select>
        </Field>

        <p className="text-faint text-xs leading-relaxed">
          Les métriques ne remplacent pas tes habitudes : ce que tu coches chaque jour reste la
          seule source de la couche Fondation, et ne se ressaisit jamais ici.
        </p>

        <div className="flex gap-2 pt-1">
          <Button variant="primary" className="flex-1" onClick={submit} disabled={name.trim() === ""}>
            {metric === null ? "Créer" : "Enregistrer"}
          </Button>
          <Button onClick={onClose}>Annuler</Button>
        </div>

        {metric !== null && (
          <div className="border-border border-t pt-3">
            <Button
              variant="danger"
              className="w-full"
              onClick={() => {
                onArchive();
                onClose();
              }}
            >
              Arrêter cette métrique
            </Button>
            <p className="text-faint mt-2 text-xs leading-relaxed">
              Elle sort des mois à venir. Les mois déjà chiffrés la gardent : ils ont été jugés
              avec, leur score ne doit pas changer aujourd&apos;hui.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
