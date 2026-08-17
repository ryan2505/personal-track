import type { ShareSnapshot } from "./snapshot";

/**
 * Client des liens vivants.
 *
 * Appelle directement les fonctions RPC via PostgREST, sans `@supabase/supabase-js` :
 * on n'a besoin que de trois appels, et la dépendance n'apporterait ici qu'un
 * poids de bundle. Elle redeviendra justifiée à M1, quand il faudra Auth,
 * Storage et Realtime.
 */

export interface LiveBoardRef {
  id: string;
  /** Jeton-capacité. Vit dans le fragment de l'URL, jamais dans la query string. */
  secret: string;
}

export interface LiveBoard {
  payload: ShareSnapshot;
  updatedAt: string;
}

export class ShareConfigError extends Error {
  constructor() {
    super(
      "Le partage vivant nécessite un projet Supabase configuré (NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
    this.name = "ShareConfigError";
  }
}

function config(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url === undefined || url === "" || key === undefined || key === "") {
    throw new ShareConfigError();
  }
  return { url: url.replace(/\/$/, ""), key };
}

export function isLiveShareConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url !== undefined && url !== "" && key !== undefined && key !== "";
}

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { url, key } = config();

  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Échec de ${name} (${response.status}) : ${detail.slice(0, 200)}`);
  }

  return (await response.json()) as T;
}

/** 32 octets aléatoires en base64url — assez pour qu'un lien ne se devine pas. */
export function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Crée le lien (`ref` absent) ou met à jour son contenu. */
export async function publishBoard(
  ref: LiveBoardRef | null,
  payload: ShareSnapshot,
): Promise<LiveBoardRef> {
  const secret = ref?.secret ?? generateSecret();
  const id = await rpc<string>("publish_shared_board", {
    p_id: ref?.id ?? null,
    p_secret: secret,
    p_payload: payload,
  });
  return { id, secret };
}

/** `null` si le lien n'existe pas, a été révoqué, ou si le secret est faux. */
export async function fetchBoard(ref: LiveBoardRef): Promise<LiveBoard | null> {
  const rows = await rpc<{ payload: ShareSnapshot; updated_at: string }[]>("get_shared_board", {
    p_id: ref.id,
    p_secret: ref.secret,
  });

  const row = rows[0];
  if (row === undefined) return null;
  return { payload: row.payload, updatedAt: row.updated_at };
}

export async function revokeBoard(ref: LiveBoardRef): Promise<boolean> {
  return rpc<boolean>("revoke_shared_board", { p_id: ref.id, p_secret: ref.secret });
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
