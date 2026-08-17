import type { LocalDate } from "@/lib/domain";

/**
 * Instantané partageable.
 *
 * ⚠️ Ce n'est PAS le système couple de CLAUDE.md §19. C'est un cliché figé,
 * encodé dans le fragment de l'URL : rien ne transite par un serveur, mais rien
 * n'est chiffré non plus — quiconque possède le lien peut le lire, et il ne se
 * met jamais à jour. Le partage vivant, privé et bidirectionnel attend M8.
 *
 * Le fragment (`#`) est délibéré : contrairement à la query string, il n'est
 * jamais envoyé au serveur ni écrit dans ses logs.
 */

export const SNAPSHOT_VERSION = 1;

export interface SharedArea {
  label: string;
  score: number;
}

export interface SharedGoal {
  title: string;
  current: number;
  target: number | null;
  ratio: number | null;
}

export interface SharedHabit {
  title: string;
  schedule: string;
  streak: number | null;
}

/**
 * Calendrier reconstruit chez le destinataire à partir d'une seule date et
 * d'une suite de scores consécutifs — bien plus compact qu'une liste de dates.
 */
export interface SharedCalendar {
  /** Premier jour de la suite. Les suivants s'en déduisent. */
  from: LocalDate;
  scores: (number | null)[];
}

/** Une ligne du suivi du jour. */
export interface SharedTrackingItem {
  title: string;
  /** Ratio [0,1] déjà borné par le domaine. */
  completion: number;
  /** « 45 / 60 min », ou chaîne vide pour une habitude binaire. */
  detail: string;
}

export interface ShareSnapshot {
  v: number;
  name: string;
  date: LocalDate;
  daily?: number | null;
  week?: number | null;
  month?: number | null;
  streak?: { current: number; longest: number };
  /** Sept derniers scores quotidiens, du plus ancien au plus récent. */
  spark?: (number | null)[];
  areas?: SharedArea[];
  goals?: SharedGoal[];
  habits?: SharedHabit[];
  calendar?: SharedCalendar;
  tracking?: SharedTrackingItem[];
  note?: string;
}

export interface ShareSettings {
  daily: boolean;
  streak: boolean;
  consistency: boolean;
  week: boolean;
  calendar: boolean;
  tracking: boolean;
  areas: boolean;
  goals: boolean;
  habits: boolean;
  note: string;
}

/** Tout à `false` par défaut sauf le strict minimum : on ouvre, on n'ouvre pas par défaut. */
export const DEFAULT_SHARE_SETTINGS: ShareSettings = {
  daily: true,
  streak: true,
  consistency: false,
  week: false,
  calendar: false,
  tracking: false,
  areas: false,
  goals: false,
  habits: false,
  note: "",
};

/**
 * Les scores du calendrier sont arrondis au centième avant encodage : sur un
 * mois complet, ça divise la taille du lien par deux sans rien changer de
 * visible (l'échelle n'a que cinq paliers).
 */
export function roundScore(score: number | null): number | null {
  return score === null ? null : Math.round(score * 100) / 100;
}

// ── Encodage ────────────────────────────────────────────────────────────────

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

export function encodeSnapshot(snapshot: ShareSnapshot): string {
  return toBase64Url(JSON.stringify(snapshot));
}

/** `null` sur payload absent, tronqué, altéré ou d'une version inconnue. */
export function decodeSnapshot(encoded: string): ShareSnapshot | null {
  if (encoded.trim() === "") return null;

  try {
    const parsed: unknown = JSON.parse(fromBase64Url(encoded));
    if (typeof parsed !== "object" || parsed === null) return null;

    const candidate = parsed as Partial<ShareSnapshot>;
    if (candidate.v !== SNAPSHOT_VERSION) return null;
    if (typeof candidate.name !== "string" || typeof candidate.date !== "string") return null;

    return candidate as ShareSnapshot;
  } catch {
    return null;
  }
}

export function shareUrl(origin: string, snapshot: ShareSnapshot): string {
  return `${origin}/shared#s=${encodeSnapshot(snapshot)}`;
}

/** Lit le payload d'une URL complète ou d'un simple fragment. */
export function readSnapshotFromHash(hash: string): ShareSnapshot | null {
  const marker = hash.indexOf("s=");
  if (marker < 0) return null;
  return decodeSnapshot(hash.slice(marker + 2));
}
