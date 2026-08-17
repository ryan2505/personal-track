"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ShareCard } from "@/components/share/ShareCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { fetchBoard, readSecretFromHash, ShareConfigError } from "@/lib/share/live";
import type { ShareSnapshot } from "@/lib/share/snapshot";

/** Fréquence de rafraîchissement. Assez court pour être vivant, assez long pour rester discret. */
const POLL_MS = 20_000;

type State =
  | { kind: "loading" }
  | { kind: "missing-secret" }
  | { kind: "unavailable"; reason: string }
  | { kind: "ready"; snapshot: ShareSnapshot; updatedAt: string };

/**
 * Page destinataire d'un lien vivant.
 *
 * Hors du groupe `(app)` : le visiteur n'a ni profil ni données locales, et
 * l'`AppGate` le renverrait dans l'onboarding.
 *
 * Le rafraîchissement est un sondage, pas du websocket : diffuser en Realtime
 * supposerait d'exposer la table à la clé anon, ce que le modèle jeton-capacité
 * refuse justement. On échange quelques secondes de latence contre une surface
 * d'accès réduite à trois fonctions.
 */
export default function LiveBoardPage() {
  const params = useParams<{ id: string }>();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [secret, setSecret] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setSecret(readSecretFromHash(window.location.hash));
  }, []);

  const load = useCallback(async () => {
    if (secret === null || params.id === undefined) return;
    setRefreshing(true);
    try {
      const board = await fetchBoard({ id: params.id, secret });
      setState(
        board === null
          ? {
              kind: "unavailable",
              reason:
                "Ce lien n'existe plus, a été révoqué par son auteur, ou la clé qu'il contient est incomplète.",
            }
          : { kind: "ready", snapshot: board.payload, updatedAt: board.updatedAt },
      );
    } catch (error) {
      setState({
        kind: "unavailable",
        reason:
          error instanceof ShareConfigError
            ? "Cette instance n'a pas de partage vivant configuré."
            : "Impossible de joindre le serveur pour le moment.",
      });
    } finally {
      setRefreshing(false);
    }
  }, [params.id, secret]);

  useEffect(() => {
    if (secret === null) {
      // `useEffect` a tourné mais le fragment était vide : lien tronqué.
      const timer = window.setTimeout(() => {
        setState((current) =>
          current.kind === "loading" ? { kind: "missing-secret" } : current,
        );
      }, 0);
      return () => window.clearTimeout(timer);
    }

    void load();
    const interval = window.setInterval(() => void load(), POLL_MS);

    // Revenir sur l'onglet doit montrer l'état à jour sans attendre le cycle.
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [secret, load]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-4 py-12 sm:px-6">
      {state.kind === "loading" && (
        <p className="text-faint text-center text-sm">Chargement…</p>
      )}

      {state.kind === "missing-secret" && (
        <Card>
          <EmptyState
            title="Lien incomplet"
            description="La clé d'accès manque à la fin de l'adresse. Certaines messageries la coupent : demande à la personne de renvoyer le lien entier."
          />
        </Card>
      )}

      {state.kind === "unavailable" && (
        <Card>
          <EmptyState title="Lien indisponible" description={state.reason} />
        </Card>
      )}

      {state.kind === "ready" && (
        <>
          <ShareCard snapshot={state.snapshot} />
          <div className="flex items-center justify-between gap-3">
            <p className="text-faint text-xs">
              Mis à jour {formatUpdatedAt(state.updatedAt)}
            </p>
            <button
              onClick={() => void load()}
              disabled={refreshing}
              className="text-muted hover:text-text inline-flex items-center gap-1.5 text-xs disabled:opacity-50"
            >
              <RefreshCw className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} />
              Actualiser
            </button>
          </div>
          <p className="text-faint text-xs leading-relaxed">
            Cette page se met à jour toute seule. Elle reflète le dernier état enregistré par
            son auteur, et ne donne accès à rien d&apos;autre.
          </p>
        </>
      )}

      <div className="border-border space-y-3 border-t pt-6">
        <p className="font-display text-xl leading-snug">
          Transforme ta vision en action quotidienne.
        </p>
        <Link href="/today">
          <Button variant="primary">Créer mon espace</Button>
        </Link>
      </div>
    </main>
  );
}

function formatUpdatedAt(iso: string): string {
  const elapsed = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(elapsed / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `le ${new Date(iso).toLocaleDateString("fr-FR")}`;
}
