"use client";

import { VisionBoard } from "@/components/vision/VisionBoard";

import { StepShell } from "./StepShell";

/** Étape 3 — le vision board. Chaque ajout est enregistré immédiatement. */
export function StepBoard({
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
  return (
    <StepShell
      step={step}
      total={total}
      title="Ce que tu veux avoir sous les yeux."
      subtitle="Des images, des mots, des citations. Ce board réapparaîtra sur ton dashboard les jours où la motivation manque."
      onNext={onNext}
      onBack={onBack}
      onSkip={onSkip}
    >
      <VisionBoard />
    </StepShell>
  );
}
