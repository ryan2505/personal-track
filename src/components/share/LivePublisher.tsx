"use client";

import { CloudOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { buildSnapshot } from "@/lib/share/build";
import { publishBoard } from "@/lib/share/live";
import { useStore } from "@/lib/store/StoreProvider";

const DEBOUNCE_MS = 1500;

/**
 * Republie le lien vivant dès que les données changent.
 *
 * Monté une seule fois, au-dessus de toute l'application : sans ça, le lien ne
 * se mettrait à jour qu'en visitant l'écran Partager, ce qui ne mérite pas le
 * mot « vivant ».
 *
 * Limite inhérente à l'architecture actuelle : la source de vérité est le
 * navigateur de l'émetteur. Le lien reflète donc le dernier état connu quand
 * l'application était ouverte — il ne peut pas se mettre à jour appareil
 * éteint. Cette limite disparaît quand les données vivront côté serveur (M1).
 */
export function LivePublisher() {
  const { state, today, ready } = useStore();
  const [failed, setFailed] = useState(false);

  const board = state.liveBoard;

  // La sérialisation sert de comparateur : on ne republie que sur changement réel.
  const serialized = useMemo(
    () => (board === null ? null : JSON.stringify(buildSnapshot(state, today))),
    [board, state, today],
  );

  useEffect(() => {
    if (!ready || board === null || serialized === null) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      publishBoard(board, JSON.parse(serialized) as ReturnType<typeof buildSnapshot>)
        .then(() => {
          if (!cancelled) setFailed(false);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ready, board, serialized]);

  if (!failed) return null;

  return (
    <div className="border-warn/40 bg-warn/10 text-warn fixed inset-x-0 top-0 z-50 flex items-center gap-2 border-b px-4 py-2 text-xs">
      <CloudOff className="size-4 shrink-0" />
      <span>
        Le lien partagé n&apos;a pas pu être mis à jour. Il montre encore l&apos;état précédent.
      </span>
    </div>
  );
}
