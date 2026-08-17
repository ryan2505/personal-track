"use client";

import { markOnboardingComplete } from "@/lib/auth/client";
import { useStore } from "@/lib/store/StoreProvider";

import { StepBoard } from "./StepBoard";
import { StepGoals } from "./StepGoals";
import { StepHabits } from "./StepHabits";
import { StepIdentity } from "./StepIdentity";
import { StepVision } from "./StepVision";

const TOTAL = 5;

/**
 * Wizard d'onboarding.
 *
 * L'étape courante vit dans le profil persisté, pas dans un state local :
 * fermer l'onglet à l'étape 4 et revenir reprend exactement là.
 */
export function Onboarding() {
  const { state, setOnboardingStep, completeOnboarding } = useStore();
  const step = Math.min(Math.max(state.profile.onboardingStep, 0), TOTAL - 1);

  const go = (next: number) => setOnboardingStep(Math.min(Math.max(next, 0), TOTAL - 1));

  const finish = () => {
    completeOnboarding();
    // Trace côté serveur : permet de savoir, sur un autre appareil, que
    // l'onboarding a déjà été fait. Un échec réseau ne doit pas bloquer.
    void markOnboardingComplete().catch(() => {});
  };

  switch (step) {
    case 0:
      return <StepIdentity step={0} total={TOTAL} onNext={() => go(1)} />;
    case 1:
      return (
        <StepVision
          step={1}
          total={TOTAL}
          onNext={() => go(2)}
          onBack={() => go(0)}
          onSkip={() => go(2)}
        />
      );
    case 2:
      return (
        <StepBoard
          step={2}
          total={TOTAL}
          onNext={() => go(3)}
          onBack={() => go(1)}
          onSkip={() => go(3)}
        />
      );
    case 3:
      return (
        <StepGoals
          step={3}
          total={TOTAL}
          onNext={() => go(4)}
          onBack={() => go(2)}
          onSkip={() => go(4)}
        />
      );
    default:
      return (
        <StepHabits step={4} total={TOTAL} onFinish={finish} onBack={() => go(3)} />
      );
  }
}
