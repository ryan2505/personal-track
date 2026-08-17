"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, TextInput } from "@/components/ui/Field";
import { useAuth } from "@/lib/auth/AuthProvider";
import { changePassword, validatePassword } from "@/lib/auth/client";

export function SecuritySection() {
  const { enabled, user, signOut } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!enabled || user === null) {
    return (
      <Card className="mb-4">
        <CardHeader title="Compte" />
        <p className="text-muted p-4 text-sm leading-relaxed sm:p-5">
          Aucune authentification configurée : l&apos;application tourne en mode local sur cet
          appareil. Les comptes séparés arrivent avec le projet Supabase.
        </p>
      </Card>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setDone(false);

    const invalid = validatePassword(next);
    if (invalid !== null) {
      setError(invalid);
      return;
    }
    if (next !== confirm) {
      setError("Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }
    if (next === current) {
      setError("Le nouveau mot de passe doit être différent de l'ancien.");
      return;
    }

    setBusy(true);
    try {
      await changePassword(user.email, current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Changement impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader
        title="Compte"
        action={
          <button
            onClick={() => void signOut()}
            className="text-muted hover:text-text text-xs"
          >
            Se déconnecter
          </button>
        }
      />

      <div className="space-y-4 p-4 sm:p-5">
        <p className="text-faint text-xs">
          Connecté en tant que <span className="text-muted">{user.email}</span>
        </p>

        <form onSubmit={(event) => void submit(event)} className="space-y-3">
          <Field label="Mot de passe actuel">
            <TextInput
              type="password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>

          <Field label="Nouveau mot de passe" hint="Au moins 8 caractères.">
            <TextInput
              type="password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>

          <Field label="Confirmer">
            <TextInput
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>

          {error !== null && <p className="text-danger text-xs leading-relaxed">{error}</p>}
          {done && <p className="text-success text-xs">Mot de passe mis à jour.</p>}

          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Mise à jour…" : "Changer le mot de passe"}
          </Button>
        </form>
      </div>
    </Card>
  );
}
