"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ShareCard } from "@/components/share/ShareCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { readSnapshotFromHash, type ShareSnapshot } from "@/lib/share/snapshot";

/**
 * Page destinataire.
 *
 * Délibérément hors du groupe `(app)` : le visiteur n'a ni profil ni données,
 * et l'`AppGate` le renverrait dans l'onboarding. Elle est en lecture seule et
 * ne touche jamais au stockage local du visiteur.
 *
 * Le décodage se fait dans un effet parce que le fragment d'URL n'existe que
 * côté navigateur — c'est précisément ce qui fait qu'il n'atteint aucun serveur.
 */
export default function SharedPage() {
  const [snapshot, setSnapshot] = useState<ShareSnapshot | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSnapshot(readSnapshotFromHash(window.location.hash));
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="text-faint text-sm">Chargement…</span>
      </div>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-4 py-12 sm:px-6">
      {snapshot === null ? (
        <Card>
          <EmptyState
            title="Lien illisible"
            description="Ce lien est incomplet, périmé ou a été tronqué par la messagerie qui l'a transmis. Demande à la personne de le renvoyer."
          />
        </Card>
      ) : (
        <>
          <ShareCard snapshot={snapshot} />
          <p className="text-faint text-xs leading-relaxed">
            Instantané figé au {snapshot.date}, partagé volontairement. Il ne se met pas à jour
            et ne donne accès à rien d&apos;autre.
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
