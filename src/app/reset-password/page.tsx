"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, TextInput } from "@/components/ui/Field";
import { getSupabase, setNewPassword, validatePassword } from "@/lib/auth/client";

/**
 * Choix d'un nouveau mot de passe après passage par le lien reçu par mail.
 *
 * Hors du groupe `(app)` : la personne arrive sans session applicative, et
 * l'`AppGate` la renverrait vers l'onboarding ou la connexion.
 *
 * Le jeton de récupération arrive dans le fragment de l'URL. `detectSessionInUrl`
 * l'échange contre une session temporaire — d'où l'attente d'un tick avant de
 * conclure que le lien est invalide.
 */
export default function ResetPasswordPage() {
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    if (supabase === null) {
      setChecking(false);
      return;
    }

    let cancelled = false;

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setHasSession(data.session !== null);
      setChecking(false);
    };

    // L'événement arrive dès que le jeton du fragment est consommé.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setHasSession(session !== null);
      setChecking(false);
    });

    void check();

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const invalid = validatePassword(password);
    if (invalid !== null) {
      setError(invalid);
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setBusy(true);
    try {
      await setNewPassword(password);
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Changement impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-3">
        <p className="text-faint text-xs tracking-[0.18em] uppercase">Personal OS</p>
        <h1 className="font-display text-3xl leading-tight text-balance">
          Nouveau mot de passe
        </h1>
      </header>

      {checking && <p className="text-faint text-sm">Vérification du lien…</p>}

      {!checking && !hasSession && (
        <Card>
          <EmptyState
            title="Lien invalide ou expiré"
            description="Un lien de réinitialisation n'est valable qu'une heure et ne fonctionne qu'une fois. Demande-en un nouveau depuis l'écran de connexion."
            action={
              <Link href="/today">
                <Button variant="primary">Retour à la connexion</Button>
              </Link>
            }
          />
        </Card>
      )}

      {!checking && hasSession && done && (
        <div className="space-y-4">
          <p className="text-success text-sm">Mot de passe mis à jour.</p>
          <Link href="/today">
            <Button variant="primary" className="w-full">
              Aller à mon espace
            </Button>
          </Link>
        </div>
      )}

      {!checking && hasSession && !done && (
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <Field label="Nouveau mot de passe" hint="Au moins 8 caractères.">
            <TextInput
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
              autoFocus
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

          <Button type="submit" variant="primary" className="w-full" disabled={busy}>
            {busy ? "Mise à jour…" : "Enregistrer"}
          </Button>
        </form>
      )}
    </main>
  );
}
