"use client";

import { Check, Copy, Link2, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/AppShell";
import { LiveLinkPanel } from "@/components/share/LiveLinkPanel";
import { ShareCard } from "@/components/share/ShareCard";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, TextInput } from "@/components/ui/Field";
import { buildSnapshot } from "@/lib/share/build";
import { isLiveShareConfigured } from "@/lib/share/live";
import { shareUrl, type ShareSettings } from "@/lib/share/snapshot";
import { useStore } from "@/lib/store/StoreProvider";
import { cn } from "@/lib/utils";

const TOGGLES: { key: keyof Omit<ShareSettings, "note">; label: string; hint: string }[] = [
  { key: "daily", label: "Score du jour", hint: "Ton pourcentage d'aujourd'hui." },
  { key: "streak", label: "Série", hint: "Série en cours et record." },
  { key: "consistency", label: "Consistance", hint: "Semaine et mois en cours." },
  { key: "week", label: "7 derniers jours", hint: "Le petit graphique, sans les détails." },
  {
    key: "calendar",
    label: "Calendrier du mois",
    hint: "La grille du mois en cours, jour par jour.",
  },
  {
    key: "tracking",
    label: "Suivi du jour",
    hint: "Tes habitudes d'aujourd'hui, cochées ou non — intitulés compris.",
  },
  { key: "areas", label: "Domaines de vie", hint: "Tes scores par domaine." },
  { key: "goals", label: "Objectifs", hint: "Intitulés et progression." },
  { key: "habits", label: "Habitudes", hint: "Intitulés, fréquence et séries." },
];

export default function SharePage() {
  const { state, today, setShareSettings } = useStore();
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [origin, setOrigin] = useState("");
  const [showStatic, setShowStatic] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    setCanNativeShare(typeof navigator.share === "function");
  }, []);

  const settings = state.shareSettings;
  const live = state.liveBoard !== null;
  // Proposer les deux mécanismes côte à côte était un piège : on copiait le lien
  // figé en croyant partager le lien vivant. Le figé ne subsiste que là où il
  // n'y a pas de serveur.
  const liveAvailable = isLiveShareConfigured();

  // Une seule construction pour l'aperçu, le lien figé et la republication.
  const snapshot = useMemo(() => buildSnapshot(state, today), [state, today]);

  const staticUrl = origin === "" ? "" : shareUrl(origin, snapshot);
  const staticSize = new Blob([staticUrl]).size;
  const tooLong = staticSize > 8000;

  const copyStatic = async () => {
    await navigator.clipboard.writeText(staticUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Partager"
        subtitle="Donne accès à ta progression à quelqu'un. Tu choisis exactement ce qui sort, et tu peux le changer après coup."
      />

      <LiveLinkPanel />

      <Card className="mb-5">
        <CardHeader
          title="Ce que tu partages"
          action={
            live && <span className="text-success text-xs">appliqué en direct</span>
          }
        />
        <div className="divide-border divide-y">
          {TOGGLES.map((toggle) => (
            <button
              key={toggle.key}
              onClick={() => setShareSettings({ [toggle.key]: !settings[toggle.key] })}
              className="flex w-full items-center gap-3 px-4 py-3 text-left sm:px-5"
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded border transition-colors",
                  settings[toggle.key]
                    ? "border-accent bg-accent text-bg"
                    : "border-border-strong text-transparent",
                )}
              >
                <Check className="size-3.5" strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm">{toggle.label}</span>
                <span className="text-faint block text-xs">{toggle.hint}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="border-border border-t p-4 sm:p-5">
          <Field label="Mot d'accompagnement" hint="Optionnel. Apparaît en haut de la carte.">
            <TextInput
              value={settings.note}
              onChange={(event) => setShareSettings({ note: event.target.value })}
              placeholder="Semaine solide, on continue"
              maxLength={120}
            />
          </Field>
        </div>
      </Card>

      <div className="mb-5">
        <p className="text-faint mb-2 text-xs tracking-wide uppercase">Aperçu</p>
        <ShareCard snapshot={snapshot} />
        <p className="text-faint mt-2 text-xs leading-relaxed">
          C&apos;est exactement ce que verra la personne. Décocher une section la retire
          {live ? " du lien en cours, immédiatement." : " avant l'envoi."}
        </p>
      </div>

      {!liveAvailable && (
      <Card>
        <CardHeader
          title="Lien figé"
          action={
            <button
              onClick={() => setShowStatic((current) => !current)}
              className="text-muted hover:text-text text-xs"
            >
              {showStatic ? "Masquer" : "Afficher"}
            </button>
          }
        />
        {showStatic && (
          <div className="space-y-3 p-4 sm:p-5">
            <p className="text-muted text-sm leading-relaxed">
              Alternative sans serveur : les données sont encodées{" "}
              <strong>dans le lien lui-même</strong>. Il fonctionne partout et pour toujours,
              mais il ne se met jamais à jour et ne peut pas être révoqué — une fois envoyé, il
              vit sa vie.
            </p>
            <p className="text-faint text-xs leading-relaxed">
              Encodé mais non chiffré : quiconque l&apos;obtient peut le lire.
            </p>

            {tooLong && (
              <p className="text-warn text-xs leading-relaxed">
                Ce lien fait {Math.round(staticSize / 1024)} Ko et certaines messageries le
                tronqueront. Décoche le calendrier ou quelques sections.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {canNativeShare && (
                <Button
                  onClick={() =>
                    void navigator
                      .share({ title: "Personal OS", url: staticUrl })
                      .catch(() => {})
                  }
                  disabled={staticUrl === ""}
                >
                  <Share2 className="size-4" />
                  Partager
                </Button>
              )}
              <Button onClick={() => void copyStatic()} disabled={staticUrl === ""}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Lien copié" : "Copier le lien figé"}
              </Button>
              {staticUrl !== "" && (
                <a
                  href={`/shared#s=${staticUrl.split("#s=")[1] ?? ""}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted hover:text-text inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-sm"
                >
                  <Link2 className="size-4" />
                  Aperçu destinataire
                </a>
              )}
            </div>
          </div>
        )}
      </Card>
      )}
    </main>
  );
}
