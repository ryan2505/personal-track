"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { requestPasswordReset, signIn } from "@/lib/auth/client";

type Mode = "signin" | "forgot";

export function LoginScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signin") {
        await signIn(email, password);
        // `onAuthStateChange` prend le relais : pas de navigation manuelle.
      } else {
        await requestPasswordReset(email, `${window.location.origin}/reset-password`);
        setSent(true);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Opération impossible.");
    } finally {
      setBusy(false);
    }
  };

  const switchTo = (next: Mode) => {
    setMode(next);
    setError(null);
    setSent(false);
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-3">
        <p className="text-faint text-xs tracking-[0.18em] uppercase">Personal OS</p>
        <h1 className="font-display text-3xl leading-tight text-balance">
          {mode === "signin"
            ? "Transforme ta vision en action quotidienne."
            : "Réinitialiser ton mot de passe."}
        </h1>
      </header>

      {sent ? (
        <div className="space-y-4">
          {/* Message identique que l'adresse existe ou non : révéler quels
              comptes existent serait une fuite gratuite. */}
          <p className="text-muted text-sm leading-relaxed">
            Si un compte correspond à cette adresse, un lien de réinitialisation vient d&apos;y
            être envoyé. Il est valable une heure et ne fonctionne qu&apos;une fois.
          </p>
          <Button className="w-full" onClick={() => switchTo("signin")}>
            Retour à la connexion
          </Button>
        </div>
      ) : (
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

          {mode === "signin" && (
            <Field label="Mot de passe">
              <TextInput
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>
          )}

          {error !== null && <p className="text-danger text-xs leading-relaxed">{error}</p>}

          <Button type="submit" variant="primary" className="w-full" disabled={busy}>
            {busy
              ? mode === "signin"
                ? "Connexion…"
                : "Envoi…"
              : mode === "signin"
                ? "Se connecter"
                : "Envoyer le lien"}
          </Button>

          <button
            type="button"
            onClick={() => switchTo(mode === "signin" ? "forgot" : "signin")}
            className="text-muted hover:text-text w-full text-center text-xs"
          >
            {mode === "signin" ? "Mot de passe oublié ?" : "Retour à la connexion"}
          </button>
        </form>
      )}

      <p className="text-faint text-xs leading-relaxed">
        Chaque compte a son propre espace. Les données d&apos;une personne ne sont jamais
        visibles par l&apos;autre, même sur cet appareil.
      </p>
    </main>
  );
}
