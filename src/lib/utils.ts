import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Formatage d'un ratio [0,1] en pourcentage entier. Aucun autre endroit ne calcule de %. */
export function formatPercent(ratio: number | null): string {
  if (ratio === null) return "—";
  return `${Math.round(ratio * 100)}%`;
}

/**
 * Échelle de complétion du calendrier et de la heatmap — définition unique.
 * `null` = jour neutre : transparent, jamais rouge. Le produit ne punit pas.
 */
export function levelClass(score: number | null): string {
  if (score === null) return "bg-transparent border border-border";
  if (score === 0) return "bg-level-0";
  if (score < 0.4) return "bg-level-1";
  if (score < 0.7) return "bg-level-2";
  if (score < 1) return "bg-level-3";
  return "bg-level-4";
}
