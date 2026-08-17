import { getSupabase } from "@/lib/auth/client";
import type { AppState } from "@/lib/store/state";

/**
 * Liens de partage vivants.
 *
 * Le lien ne transporte aucune donnée : il désigne un propriétaire, et chaque
 * consultation lit sa base au moment de la requête. Le destinataire voit donc
 * toujours l'état réel — y compris quand l'appareil du propriétaire est éteint.
 *
 * Le filtrage est fait côté serveur par `get_shared_state` (migration 0014) :
 * les notes, la vision et les descriptions ne quittent jamais le compte, et les
 * intitulés d'habitudes restent masqués tant qu'ils n'ont pas été ouverts.
 * Filtrer côté client aurait envoyé les données puis fait semblant de les cacher.
 */

export interface LiveBoardRef {
  id: string;
  /** Jeton-capacité. Vit dans le fragment de l'URL, jamais dans la query string. */
  secret: string;
}

export class ShareConfigError extends Error {
  constructor() {
    super(
      "Le partage vivant nécessite un projet Supabase configuré (NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
    this.name = "ShareConfigError";
  }
}

export function isLiveShareConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url !== undefined && url !== "" && key !== undefined && key !== "";
}

/** 32 octets aléatoires en base64url — assez pour qu'un lien ne se devine pas. */
export function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function client() {
  const supabase = getSupabase();
  if (supabase === null) throw new ShareConfigError();
  return supabase;
}

/** Crée le lien. Seul le propriétaire authentifié peut en créer un sur ses données. */
export async function createShareLink(): Promise<LiveBoardRef> {
  const secret = generateSecret();
  const { data, error } = await client().rpc("create_share_link", { p_secret: secret });

  if (error !== null) throw new Error(error.message);
  if (typeof data !== "string") throw new Error("Création du lien impossible.");

  return { id: data, secret };
}

export async function revokeShareLink(ref: LiveBoardRef): Promise<boolean> {
  const { data, error } = await client().rpc("revoke_share_link", { p_id: ref.id });
  if (error !== null) throw new Error(error.message);
  return data === true;
}

/**
 * État partagé, tel que projeté par le serveur.
 *
 * Structurellement compatible avec `AppState` pour que le destinataire calcule
 * l'instantané avec exactement le même code de domaine que le propriétaire —
 * pas de seconde implémentation susceptible de diverger.
 */
export type SharedState = Pick<
  AppState,
  "version" | "profile" | "habits" | "goals" | "logs" | "visionAreas" | "visionItems" | "shareSettings"
>;

/** `null` si le lien n'existe pas, a été révoqué, ou si le secret est faux. */
export async function fetchSharedState(ref: LiveBoardRef): Promise<SharedState | null> {
  const { data, error } = await client().rpc("get_shared_state", {
    p_id: ref.id,
    p_secret: ref.secret,
  });

  if (error !== null) throw new Error(error.message);
  if (data === null || typeof data !== "object") return null;

  return data as SharedState;
}

export function liveShareUrl(origin: string, ref: LiveBoardRef): string {
  return `${origin}/live/${ref.id}#k=${ref.secret}`;
}

/** Lit le secret du fragment. Absent du fragment = lien inutilisable, volontairement. */
export function readSecretFromHash(hash: string): string | null {
  const marker = hash.indexOf("k=");
  if (marker < 0) return null;
  const secret = hash.slice(marker + 2).trim();
  return secret === "" ? null : secret;
}
