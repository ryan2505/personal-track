"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import {
  goalWindowForScope,
  type Goal,
  type GoalScope,
  type GoalSource,
  type Habit,
  type HabitCategory,
  type LocalDate,
} from "@/lib/domain";
import { CATEGORIES, CATEGORY_LABELS, GOAL_SCOPES, GOAL_SCOPE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

const SOURCES: { value: GoalSource; label: string; hint: string }[] = [
  { value: "manual", label: "Saisie manuelle", hint: "Tu mets la valeur à jour toi-même." },
  {
    value: "habit_count",
    label: "Nombre de fois",
    hint: "Compte les jours où les habitudes liées ont été pleinement tenues.",
  },
  {
    value: "habit_sum",
    label: "Somme des valeurs",
    hint: "Additionne les valeurs enregistrées sur les habitudes liées.",
  },
];

export function GoalForm({
  goal,
  habits,
  today,
  open,
  onClose,
  onSubmit,
}: {
  goal: Goal | null;
  habits: Habit[];
  today: LocalDate;
  open: boolean;
  onClose: () => void;
  onSubmit: (goal: Omit<Goal, "id">) => void;
}) {
  const [title, setTitle] = useState(goal?.title ?? "");
  const [category, setCategory] = useState<HabitCategory>(goal?.category ?? "business");
  const [scope, setScope] = useState<GoalScope>(goal?.scope ?? "monthly");
  const [target, setTarget] = useState(
    goal?.targetValue === null || goal?.targetValue === undefined ? "" : String(goal.targetValue),
  );
  const [unit, setUnit] = useState(goal?.unit ?? "");
  const [source, setSource] = useState<GoalSource>(goal?.source ?? "manual");
  const [habitIds, setHabitIds] = useState<string[]>(goal?.habitIds ?? []);
  const [dueDate, setDueDate] = useState(
    goal?.dueDate ?? (goalWindowForScope(goal?.scope ?? "monthly", today).dueDate ?? ""),
  );

  /**
   * Changer d'horizon recale l'échéance sur la fenêtre correspondante — le
   * lundi/dimanche ISO pour « cette semaine ». La date reste modifiable après.
   */
  const changeScope = (next: GoalScope) => {
    setScope(next);
    setDueDate(goalWindowForScope(next, today).dueDate ?? "");
  };

  const derived = source !== "manual";
  const activeSource = SOURCES.find((item) => item.value === source);

  const submit = () => {
    if (title.trim() === "") return;
    const parsed = Number(target);
    onSubmit({
      title: title.trim(),
      category,
      scope,
      targetValue: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
      currentValue: goal?.currentValue ?? 0,
      source,
      unit: unit.trim() === "" ? null : unit.trim(),
      startDate: goal?.startDate ?? goalWindowForScope(scope, today).startDate,
      dueDate: dueDate === "" ? null : dueDate,
      status: goal?.status ?? "not_started",
      habitIds: derived ? habitIds : [],
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={goal === null ? "Nouvel objectif" : "Modifier"}>
      <div className="space-y-4">
        <Field label="Intitulé">
          <TextInput
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Obtenir 5 nouveaux clients"
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
          <Field label="Horizon">
            <Select
              value={scope}
              onChange={(event) => changeScope(event.target.value as GoalScope)}
            >
              {GOAL_SCOPES.map((item) => (
                <option key={item} value={item}>
                  {GOAL_SCOPE_LABELS[item]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cible">
            <TextInput
              type="number"
              inputMode="decimal"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="5"
            />
          </Field>
          <Field label="Unité">
            <TextInput
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              placeholder="clients"
            />
          </Field>
        </div>

        <Field label="Échéance">
          <TextInput type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </Field>

        <Field label="Progression" hint={activeSource?.hint}>
          <Select value={source} onChange={(event) => setSource(event.target.value as GoalSource)}>
            {SOURCES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </Field>

        {derived && (
          <div className="space-y-2">
            <p className="text-muted text-xs tracking-wide uppercase">Habitudes qui l&apos;alimentent</p>
            {habits.length === 0 ? (
              <p className="text-faint text-xs">
                Crée d&apos;abord une habitude pour pouvoir y relier cet objectif.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {habits.map((habit) => {
                  const active = habitIds.includes(habit.id);
                  return (
                    <button
                      key={habit.id}
                      onClick={() =>
                        setHabitIds((current) =>
                          active
                            ? current.filter((id) => id !== habit.id)
                            : [...current, habit.id],
                        )
                      }
                      className={cn(
                        "min-h-10 rounded-md border px-3 text-xs transition-colors",
                        active
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border text-muted hover:border-border-strong",
                      )}
                    >
                      {habit.title}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="primary" className="flex-1" onClick={submit} disabled={title.trim() === ""}>
            {goal === null ? "Créer" : "Enregistrer"}
          </Button>
          <Button onClick={onClose}>Annuler</Button>
        </div>
      </div>
    </Modal>
  );
}
