"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ShareCard } from "@/components/share/ShareCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { localToday } from "@/lib/domain";
import { buildSnapshot } from "@/lib/share/build";
import { fetchSharedState, readSecretFromHash, ShareConfigError } from "@/lib/share/live";
import type { ShareSnapshot } from "@/lib/share/snapshot";
import { detectTimezone, emptyState } from "@/lib/store/state";

/** Intervalle de rafraîchissement. Assez court pour suivre, assez long pour rester discret. */
const POLL_MS = 15_000;

type State =
  | { kind: "loading" }
  | { kind: "missing-secret" }
  | { kind: "unavailable"; reason: string }
  | { kind: "ready"; snapshot: ShareSnapshot; fetchedAt: number };

/**
 * Page destinataire.
 *
 * Le lien ne contient aucune donnée : à chaque consultation, on lit l'état réel
 * du propriétaire, déjà filtré par le serveur selon ses réglages de partage.
 * L'instantané est ensuite calculé ici avec **le même code de domaine** que chez
 * le propriétaire — une seconde implémentation finirait par afficher d'autres
 * chiffres que les siens.
 *
 * Hors du groupe `(app)` : le visiteur n'a ni profil ni données locales, et
 * l'`AppGate` le renverrait dans l'onboarding.
 */
export default function LiveBoardPage() {
  const params = useParams<{ id: string }>();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [secret, setSecret] = useState<string | null>(null);
  const [checkedHash, setCheckedHash] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setSecret(readSecretFromHash(window.location.hash));
    setCheckedHash(true);
  }, []);

  const load = useCallback(async () => {
    if (secret === null || params.id === undefined) return;
    setRefreshing(true);
    try {
      const shared = await fetchSharedState({ id: params.id, secret });

      if (shared === null) {
        setState({
          kind: "unavailable",
          reason:
            "Ce lien n'existe plus, a été révoqué par son auteur, ou la clé qu'il contient est incomplète.",
        });
        return;
      }

      // Le fuseau du propriétaire fait foi : son « aujourd'hui » n'est pas
      // forcément celui de la personne qui regarde.
      const owner = { ...emptyState(detectTimezone()), ...shared };
      const ownerToday = localToday(owner.profile.timezone);

      setState({
        kind: "ready",
        snapshot: buildSnapshot(owner, ownerToday),
        fetchedAt: Date.now(),
      });
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
    if (!checkedHash) return;

    if (secret === null) {
      setState({ kind: "missing-secret" });
      return;
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
  }, [checkedHash, secret, load]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-4 py-12 sm:px-6">
      {state.kind === "loading" && <p className="text-faint text-center text-sm">Chargement…</p>}

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
              Données lues en direct · actualisé {formatAgo(state.fetchedAt)}
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
            Cette page lit les données réelles de son auteur et se met à jour toute seule. Elle
            ne montre que ce qu&apos;il a choisi de partager, et ne donne accès à rien d&apos;autre.
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

function formatAgo(timestamp: number): string {
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 30) return "à l'instant";
  if (seconds < 90) return "il y a une minute";
  return `il y a ${Math.round(seconds / 60)} min`;
}
