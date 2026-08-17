"use client";

import { useState } from "react";

import { TextArea } from "@/components/ui/Field";
import type { HabitCategory } from "@/lib/domain";
import { CATEGORIES, CATEGORY_LABELS, CATEGORY_PROMPTS } from "@/lib/labels";
import { useStore } from "@/lib/store/StoreProvider";
import { cn } from "@/lib/utils";

import { StepShell } from "./StepShell";

/**
 * Étape 2 — la vision.
 *
 * L'utilisateur choisit ses domaines : imposer les dix produirait dix champs
 * vides et un abandon. La vision n'entre dans aucun score, c'est une direction.
 */
export function StepVision({
  step,
  total,
  onNext,
  onBack,
  onSkip,
}: {
  step: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const { state, setVisionAreas } = useStore();

  const [selected, setSelected] = useState<HabitCategory[]>(
    state.visionAreas.length > 0
      ? state.visionAreas.map((area) => area.category)
      : ["business", "fitness", "personal"],
  );
  const [statements, setStatements] = useState<Partial<Record<HabitCategory, string>>>(() =>
    Object.fromEntries(state.visionAreas.map((area) => [area.category, area.statement])),
  );

  const submit = () => {
    setVisionAreas(
      selected.map((category) => ({
        category,
        statement: (statements[category] ?? "").trim(),
      })),
    );
    onNext();
  };

  return (
    <StepShell
      step={step}
      total={total}
      title="Où vas-tu ?"
      subtitle="Choisis les domaines qui comptent vraiment pour toi. Tu pourras en ajouter plus tard."
      onNext={submit}
      onBack={onBack}
      onSkip={onSkip}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((category) => {
            const active = selected.includes(category);
            return (
              <button
                key={category}
                aria-pressed={active}
                onClick={() =>
                  setSelected((current) =>
                    active
                      ? current.filter((item) => item !== category)
                      : [...current, category],
                  )
                }
                className={cn(
                  "min-h-11 rounded-md border px-3 text-sm transition-colors",
                  active
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted hover:border-border-strong",
                )}
              >
                {CATEGORY_LABELS[category]}
              </button>
            );
          })}
        </div>

        {selected.length > 0 && (
          <div className="space-y-5">
            {selected.map((category) => (
              <div key={category} className="space-y-2">
                <p className="text-sm font-medium">{CATEGORY_LABELS[category]}</p>
                <p className="text-faint text-xs">{CATEGORY_PROMPTS[category]}</p>
                <TextArea
                  value={statements[category] ?? ""}
                  onChange={(event) =>
                    setStatements((current) => ({ ...current, [category]: event.target.value }))
                  }
                  placeholder="Dans un an…"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </StepShell>
  );
}
