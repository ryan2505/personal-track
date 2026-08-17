"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import type {
  Habit,
  HabitCategory,
  HabitDirection,
  HabitType,
  ScheduleKind,
  ScheduleRule,
} from "@/lib/domain";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  HABIT_TYPES,
  SCHEDULE_KINDS,
  SCHEDULE_LABELS,
  TYPE_LABELS,
  WEEKDAYS,
} from "@/lib/labels";
import type { HabitInput } from "@/lib/store/StoreProvider";
import { cn } from "@/lib/utils";

function currentRule(habit: Habit | null): ScheduleRule {
  const open = habit?.schedules.find((version) => version.effectiveTo === null);
  return open?.rule ?? { kind: "daily" };
}

/**
 * Formulaire progressif : le type d'habitude commande les champs affichés.
 * 5 types × 5 plannings × 2 directions — sans progressivité, l'écran devient
 * illisible (CLAUDE.md §8, risque n°5 de la Phase 0).
 */
export function HabitForm({
  habit,
  open,
  onClose,
  onSubmit,
}: {
  habit: Habit | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (input: HabitInput) => void;
}) {
  const initialRule = currentRule(habit);

  const [title, setTitle] = useState(habit?.title ?? "");
  const [category, setCategory] = useState<HabitCategory>(habit?.category ?? "personal");
  const [type, setType] = useState<HabitType>(habit?.type ?? "boolean");
  const [unit, setUnit] = useState(habit?.unit ?? "");
  const [target, setTarget] = useState(
    habit?.targetValue === null || habit?.targetValue === undefined ? "" : String(habit.targetValue),
  );
  const [direction, setDirection] = useState<HabitDirection>(habit?.direction ?? "at_least");
  const [weight, setWeight] = useState(String(habit?.weight ?? 1));
  const [kind, setKind] = useState<ScheduleKind>(initialRule.kind);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    initialRule.kind === "days_of_week" ? initialRule.daysOfWeek : [1, 3, 5],
  );
  const [daysOfMonth, setDaysOfMonth] = useState(
    initialRule.kind === "days_of_month" ? initialRule.daysOfMonth.join(", ") : "1",
  );
  const [times, setTimes] = useState(
    initialRule.kind === "times_per_week" || initialRule.kind === "times_per_month"
      ? String(initialRule.timesPerPeriod)
      : "3",
  );

  const measured = type !== "boolean";

  const buildRule = (): ScheduleRule => {
    switch (kind) {
      case "daily":
        return { kind: "daily" };
      case "days_of_week":
        return { kind: "days_of_week", daysOfWeek: [...daysOfWeek].sort((a, b) => a - b) };
      case "days_of_month":
        return {
          kind: "days_of_month",
          daysOfMonth: daysOfMonth
            .split(",")
            .map((part) => Number(part.trim()))
            .filter((day) => Number.isInteger(day) && day >= 1 && day <= 31),
        };
      case "times_per_week":
        return { kind: "times_per_week", timesPerPeriod: Math.max(1, Number(times) || 1) };
      case "times_per_month":
        return { kind: "times_per_month", timesPerPeriod: Math.max(1, Number(times) || 1) };
    }
  };

  const submit = () => {
    if (title.trim() === "") return;
    const parsedTarget = Number(target);
    onSubmit({
      title: title.trim(),
      category,
      type,
      unit: measured && unit.trim() !== "" ? unit.trim() : null,
      targetValue: measured && Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget : null,
      direction: measured ? direction : "at_least",
      weight: Math.max(1, Number(weight) || 1),
      rule: buildRule(),
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={habit === null ? "Nouvelle habitude" : "Modifier"}>
      <div className="space-y-4">
        <Field label="Intitulé">
          <TextInput
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Prospecter 10 entreprises"
            autoFocus
          />
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

          <Field label="Mesure">
            <Select value={type} onChange={(event) => setType(event.target.value as HabitType)}>
              {HABIT_TYPES.map((item) => (
                <option key={item} value={item}>
                  {TYPE_LABELS[item]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {measured && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cible">
                <TextInput
                  type="number"
                  inputMode="decimal"
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                  placeholder="60"
                />
              </Field>
              <Field label="Unité">
                <TextInput
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                  placeholder="min"
                />
              </Field>
            </div>

            <Field label="Sens" hint={direction === "at_most" ? "Rester sous la cible vaut 100%." : undefined}>
              <Select
                value={direction}
                onChange={(event) => setDirection(event.target.value as HabitDirection)}
              >
                <option value="at_least">Atteindre au moins la cible</option>
                <option value="at_most">Ne pas dépasser la cible</option>
              </Select>
            </Field>
          </>
        )}

        <Field label="Fréquence">
          <Select value={kind} onChange={(event) => setKind(event.target.value as ScheduleKind)}>
            {SCHEDULE_KINDS.map((item) => (
              <option key={item} value={item}>
                {SCHEDULE_LABELS[item]}
              </option>
            ))}
          </Select>
        </Field>

        {kind === "days_of_week" && (
          <div className="flex gap-1.5">
            {WEEKDAYS.map((day) => {
              const active = daysOfWeek.includes(day.iso);
              return (
                <button
                  key={day.iso}
                  aria-label={day.label}
                  aria-pressed={active}
                  onClick={() =>
                    setDaysOfWeek((current) =>
                      active ? current.filter((iso) => iso !== day.iso) : [...current, day.iso],
                    )
                  }
                  className={cn(
                    "size-10 rounded-md border text-sm transition-colors",
                    active
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted hover:border-border-strong",
                  )}
                >
                  {day.short}
                </button>
              );
            })}
          </div>
        )}

        {kind === "days_of_month" && (
          <Field label="Jours" hint="Séparés par des virgules. Un 31 retombe sur le dernier jour des mois plus courts.">
            <TextInput value={daysOfMonth} onChange={(event) => setDaysOfMonth(event.target.value)} />
          </Field>
        )}

        {(kind === "times_per_week" || kind === "times_per_month") && (
          <Field
            label="Nombre de fois"
            hint="Aucun jour n'est imposé : rater un jour précis ne fait pas baisser ton score."
          >
            <TextInput
              type="number"
              inputMode="numeric"
              value={times}
              onChange={(event) => setTimes(event.target.value)}
            />
          </Field>
        )}

        <Field label="Poids" hint="Une habitude de poids 3 compte trois fois plus dans le score du jour.">
          <Select value={weight} onChange={(event) => setWeight(event.target.value)}>
            <option value="1">Normal</option>
            <option value="2">Important</option>
            <option value="3">Critique</option>
          </Select>
        </Field>

        {habit !== null && (
          <p className="text-faint text-xs leading-relaxed">
            Changer la fréquence n&apos;affecte que les jours à venir. Ton historique et tes
            scores passés restent tels qu&apos;ils ont été vécus.
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="primary" className="flex-1" onClick={submit} disabled={title.trim() === ""}>
            {habit === null ? "Créer" : "Enregistrer"}
          </Button>
          <Button onClick={onClose}>Annuler</Button>
        </div>
      </div>
    </Modal>
  );
}
