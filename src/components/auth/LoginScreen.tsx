"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { signIn } from "@/lib/auth/client";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      // `onAuthStateChange` prend le relais : pas de navigation manuelle.
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-3">
        <p className="text-faint text-xs tracking-[0.18em] uppercase">Personal OS</p>
        <h1 className="font-display text-3xl leading-tight text-balance">
          Transforme ta vision en action quotidienne.
        </h1>
      </header>

      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <Field label="Identifiant">
          <TextInput
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            required
            autoFocus
          />
        </Field>

        <Field label="Mot de passe">
          <TextInput
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>

        {error !== null && <p className="text-danger text-xs leading-relaxed">{error}</p>}

        <Button type="submit" variant="primary" className="w-full" disabled={busy}>
          {busy ? "Connexion…" : "Se connecter"}
        </Button>
      </form>

      <p className="text-faint text-xs leading-relaxed">
        Chaque compte a son propre espace. Les données d&apos;une personne ne sont jamais
        visibles par l&apos;autre, même sur cet appareil.
      </p>
    </main>
  );
}
