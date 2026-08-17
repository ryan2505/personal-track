"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { habitStreak, type Habit, type HabitLog, type LocalDate } from "@/lib/domain";
import { describeRule, formatLongDate } from "@/lib/labels";
import { useLogIndex } from "@/lib/store/selectors";
import { useStore } from "@/lib/store/StoreProvider";

/**
 * Saisie précise et note. Volontairement hors du chemin critique : cocher une
 * habitude ne passe jamais par cette modale.
 */
export function LogDetailModal({
  habit,
  date,
  log,
  onClose,
}: {
  habit: Habit | null;
  date: LocalDate;
  log: HabitLog | undefined;
  onClose: () => void;
}) {
  const { setLog, today } = useStore();
  const index = useLogIndex();
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    setValue(log?.value === null || log?.value === undefined ? "" : String(log.value));
    setNote(log?.note ?? "");
  }, [log, habit]);

  if (habit === null) return null;

  const streak = habitStreak(habit, index, today);
  const rule = habit.schedules.find((version) => version.effectiveTo === null)?.rule;

  const save = () => {
    const parsed = value.trim() === "" ? null : Number(value);
    const numeric = parsed !== null && Number.isFinite(parsed) ? parsed : null;
    setLog(habit.id, date, {
      value: habit.type === "boolean" ? null : numeric,
      note: note.trim() === "" ? null : note.trim(),
      completed:
        habit.type === "boolean"
          ? (log?.completed ?? false)
          : habit.targetValue !== null && (numeric ?? 0) >= habit.targetValue,
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={habit.title}>
      <div className="space-y-5">
        <div className="text-muted flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span>{formatLongDate(date)}</span>
          {rule !== undefined && <span>{describeRule(rule)}</span>}
          {streak !== null && <span className="tabular">Série : {streak.current}</span>}
        </div>

        {habit.type !== "boolean" && (
          <Field label={`Valeur${habit.unit === null ? "" : ` (${habit.unit})`}`}>
            <TextInput
              type="number"
              inputMode="decimal"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={habit.targetValue === null ? "0" : String(habit.targetValue)}
            />
          </Field>
        )}

        <Field label="Note" hint="Optionnel. Une preuve légère de ce que tu as fait.">
          <TextArea value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>

        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" onClick={save}>
            Enregistrer
          </Button>
          <Button onClick={onClose}>Annuler</Button>
        </div>
      </div>
    </Modal>
  );
}
