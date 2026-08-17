"use client";

import { Check, Copy, Radio, Share2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import {
  createShareLink,
  isLiveShareConfigured,
  liveShareUrl,
  revokeShareLink,
} from "@/lib/share/live";
import { useStore } from "@/lib/store/StoreProvider";

/**
 * Gestion du lien vivant : création, partage, révocation.
 *
 * La mise à jour du contenu n'est pas ici — elle est portée par `LivePublisher`,
 * monté au-dessus de toute l'application, pour que le lien suive les données
 * même quand cet écran n'est pas ouvert.
 */
export function LiveLinkPanel() {
  const { state, setLiveBoard } = useStore();
  const [origin, setOrigin] = useState("");
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    setCanNativeShare(typeof navigator.share === "function");
  }, []);

  const configured = isLiveShareConfigured();
  const board = state.liveBoard;
  const url = board === null || origin === "" ? "" : liveShareUrl(origin, board);

  if (!configured) {
    return (
      <Card className="mb-5">
        <CardHeader title="Lien vivant" />
        <div className="space-y-3 p-4 text-sm sm:p-5">
          <p className="text-muted leading-relaxed">
            Un lien qui se met à jour ne peut pas contenir les données : elles doivent vivre sur
            un serveur. Cette instance n&apos;en a pas encore.
          </p>
          <ol className="text-faint list-inside list-decimal space-y-1.5 text-xs leading-relaxed">
            <li>Créer un projet sur supabase.com</li>
            <li>
              Y appliquer les migrations de{" "}
              <code className="font-mono">supabase/migrations/</code>
            </li>
            <li>
              Renseigner <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> et{" "}
              <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> dans{" "}
              <code className="font-mono">.env.local</code>
            </li>
          </ol>
          <p className="text-faint text-xs leading-relaxed">
            En attendant, le lien figé plus bas fonctionne sans serveur.
          </p>
        </div>
      </Card>
    );
  }

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      setLiveBoard(await createShareLink());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Création impossible.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (board === null) return;
    setBusy(true);
    setError(null);
    try {
      await revokeShareLink(board);
      setLiveBoard(null);
      setConfirmingRevoke(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Révocation impossible.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="mb-5">
      <CardHeader
        title="Lien vivant"
        action={
          board !== null && (
            <span className="text-success inline-flex items-center gap-1.5 text-xs">
              <Radio className="size-3.5" />
              actif
            </span>
          )
        }
      />

      <div className="space-y-4 p-4 sm:p-5">
        {board === null ? (
          <>
            <p className="text-muted text-sm leading-relaxed">
              Crée un lien qui lit tes données en direct. Tu pourras changer ce qu&apos;il montre
              à tout moment, ou le révoquer définitivement.
            </p>
            <Button variant="primary" onClick={() => void create()} disabled={busy}>
              {busy ? "Création…" : "Créer un lien vivant"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-muted text-sm leading-relaxed">
              Ce lien suit tes données. Modifier les cases ci-dessous change immédiatement ce que
              voit la personne — même après l&apos;envoi.
            </p>

            <p className="border-border bg-surface-2 text-faint overflow-x-auto rounded-md border px-3 py-2 font-mono text-[11px] whitespace-nowrap">
              {url}
            </p>

            <p className="text-faint text-xs leading-relaxed">
              Le lien lit tes données réelles à chaque consultation. Il reste à jour même quand
              cet appareil est éteint, et le filtrage se fait sur le serveur : ce que tu décoches
              ne quitte jamais ton compte.
            </p>

            <div className="flex flex-wrap gap-2">
              {canNativeShare && (
                <Button
                  variant="primary"
                  onClick={() => void navigator.share({ title: "Personal OS", url }).catch(() => {})}
                >
                  <Share2 className="size-4" />
                  Partager
                </Button>
              )}
              <Button onClick={() => void copy()}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copié" : "Copier"}
              </Button>
              {confirmingRevoke ? (
                <>
                  <Button variant="danger" onClick={() => void revoke()} disabled={busy}>
                    Confirmer la révocation
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmingRevoke(false)}>
                    Annuler
                  </Button>
                </>
              ) : (
                <Button variant="danger" onClick={() => setConfirmingRevoke(true)}>
                  <Trash2 className="size-4" />
                  Révoquer
                </Button>
              )}
            </div>

            {confirmingRevoke && (
              <p className="text-danger text-xs leading-relaxed">
                Le contenu est effacé du serveur et le lien devient définitivement inutilisable,
                y compris pour les personnes qui l&apos;ont déjà.
              </p>
            )}
          </>
        )}

        {error !== null && <p className="text-danger text-xs leading-relaxed">{error}</p>}
      </div>
    </Card>
  );
}
