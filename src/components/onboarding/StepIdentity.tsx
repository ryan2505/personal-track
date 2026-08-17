"use client";

import { ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { useAuth } from "@/lib/auth/AuthProvider";
import { compressImage } from "@/lib/images";
import { useStore } from "@/lib/store/StoreProvider";

import { StepShell } from "./StepShell";

const COMMON_ZONES = [
  "Africa/Douala",
  "Africa/Abidjan",
  "Africa/Lagos",
  "Europe/Paris",
  "America/New_York",
  "UTC",
];

export function StepIdentity({ step, total, onNext }: { step: number; total: number; onNext: () => void }) {
  const { state, setProfile } = useStore();
  const { user } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  // À la première connexion l'espace est vierge : on part du nom du compte
  // plutôt que d'un champ vide.
  const [name, setName] = useState(
    state.profile.displayName !== "" ? state.profile.displayName : (user?.displayName ?? ""),
  );
  const [timezone, setTimezone] = useState(state.profile.timezone);
  const [avatar, setAvatar] = useState(state.profile.avatar);
  const [error, setError] = useState<string | null>(null);

  const initials = name.trim().slice(0, 2).toUpperCase();

  const pick = async (file: File | undefined) => {
    if (file === undefined) return;
    setError(null);
    try {
      setAvatar(await compressImage(file));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Image illisible.");
    }
  };

  const submit = () => {
    setProfile({ displayName: name.trim(), timezone, avatar });
    onNext();
  };

  return (
    <StepShell
      step={step}
      total={total}
      title="Qui es-tu ?"
      subtitle="Construisons la version de toi vers laquelle tu travailles."
      onNext={submit}
      nextDisabled={name.trim() === ""}
    >
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="border-border bg-surface-2 relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border">
            {avatar === null ? (
              <span className="text-muted text-lg">{initials === "" ? "?" : initials}</span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="size-full object-cover" />
            )}
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void pick(event.target.files?.[0])}
            />
            <Button onClick={() => fileInput.current?.click()}>
              <ImagePlus className="size-4" />
              Photo
            </Button>
            {avatar !== null && (
              <Button variant="ghost" onClick={() => setAvatar(null)} aria-label="Retirer la photo">
                <X className="size-4" />
              </Button>
            )}
          </div>
        </div>

        {error !== null && <p className="text-danger text-xs">{error}</p>}

        <Field label="Prénom">
          <TextInput
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ryan"
            autoFocus
          />
        </Field>

        <Field
          label="Fuseau horaire"
          hint="Décide à quel jour appartient une habitude cochée à 23h. Ne change jamais ton historique."
        >
          <TextInput value={timezone} onChange={(event) => setTimezone(event.target.value)} />
        </Field>

        <div className="flex flex-wrap gap-2">
          {COMMON_ZONES.map((zone) => (
            <button
              key={zone}
              onClick={() => setTimezone(zone)}
              className={
                zone === timezone
                  ? "border-accent text-accent bg-accent/10 min-h-9 rounded-md border px-2.5 text-xs"
                  : "border-border text-muted hover:border-border-strong min-h-9 rounded-md border px-2.5 text-xs"
              }
            >
              {zone}
            </button>
          ))}
        </div>
      </div>
    </StepShell>
  );
}
