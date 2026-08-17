"use client";

import { Button } from "@/components/ui/Button";

/**
 * Cadre commun des étapes.
 *
 * Deux règles tenues partout : chaque étape sauf la première est passable, et
 * chaque étape enregistre au passage — abandonner à l'étape 4 ne perd rien.
 */
export function StepShell({
  step,
  total,
  title,
  subtitle,
  children,
  onBack,
  onSkip,
  onNext,
  nextLabel = "Continuer",
  nextDisabled = false,
}: {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onBack?: () => void;
  onSkip?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-6 py-10">
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-faint text-xs tracking-[0.18em] uppercase">Personal OS</p>
          <p className="text-faint tabular text-xs">
            {step + 1} / {total}
          </p>
        </div>
        <div className="bg-surface-2 h-0.5 w-full overflow-hidden rounded-full">
          <div
            className="bg-accent h-full rounded-full transition-[width] duration-500"
            style={{ width: `${((step + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      <header className="mb-7">
        <h1 className="font-display text-3xl leading-tight text-balance">{title}</h1>
        {subtitle !== undefined && (
          <p className="text-muted mt-3 text-sm leading-relaxed">{subtitle}</p>
        )}
      </header>

      <div className="flex-1 pb-8">{children}</div>

      <footer className="sticky bottom-0 flex items-center gap-2 pt-4">
        {onBack !== undefined && (
          <Button onClick={onBack} aria-label="Étape précédente">
            Retour
          </Button>
        )}
        {onSkip !== undefined && (
          <Button variant="ghost" onClick={onSkip}>
            Passer
          </Button>
        )}
        <Button variant="primary" className="flex-1" onClick={onNext} disabled={nextDisabled}>
          {nextLabel}
        </Button>
      </footer>
    </main>
  );
}
