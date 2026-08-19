import type {
  Goal,
  Habit,
  HabitLog,
  Metric,
  MetricEntry,
  Review,
  VisionArea,
  VisionItem,
} from "@/lib/domain";
import type { LiveBoardRef } from "@/lib/share/live";
import { DEFAULT_SHARE_SETTINGS, type ShareSettings } from "@/lib/share/snapshot";

/**
 * État applicatif persisté.
 *
 * ⚠️ Adaptateur temporaire. Tant que Supabase n'est pas provisionné, la
 * persistance est locale au navigateur et mono-utilisateur. La frontière est
 * `Repository` (voir `repository.ts`) : le jour où l'on branche Postgres, seule
 * l'implémentation change, pas l'UI ni le domaine.
 */
export interface Profile {
  displayName: string;
  /** Image encodée, ou `null` : on retombe alors sur les initiales. */
  avatar: string | null;
  timezone: string;
  onboarded: boolean;
  /** Étape atteinte dans le wizard. Permet de reprendre là où on s'est arrêté. */
  onboardingStep: number;
}

export interface AppState {
  /** Incrémenté à chaque changement de forme du state → migration explicite. */
  version: number;
  profile: Profile;
  visionAreas: VisionArea[];
  visionItems: VisionItem[];
  habits: Habit[];
  goals: Goal[];
  logs: HabitLog[];
  /** Définitions des métriques mensuelles — outputs et results. */
  metrics: Metric[];
  /** Une valeur par (métrique, mois). Le contrat mensuel. */
  metricEntries: MetricEntry[];
  /** Revues de fin de période. Une par (kind, periodStart). */
  reviews: Review[];
  /** Ce que l'utilisateur accepte d'exposer dans un instantané partagé. */
  shareSettings: ShareSettings;
  /** Lien vivant publié, ou `null`. Contient le jeton : ne jamais l'inclure dans un payload. */
  liveBoard: LiveBoardRef | null;
}

export const STATE_VERSION = 6;

export function emptyState(timezone: string): AppState {
  return {
    version: STATE_VERSION,
    profile: {
      displayName: "",
      avatar: null,
      timezone,
      onboarded: false,
      onboardingStep: 0,
    },
    visionAreas: [],
    visionItems: [],
    habits: [],
    goals: [],
    logs: [],
    metrics: [],
    metricEntries: [],
    reviews: [],
    shareSettings: { ...DEFAULT_SHARE_SETTINGS },
    liveBoard: null,
  };
}

/**
 * Migrations. On ne jette jamais les données d'un utilisateur parce que la
 * forme a bougé : on complète ce qui manque.
 */
export function migrate(raw: Record<string, unknown>, timezone: string): AppState | null {
  const version = typeof raw.version === "number" ? raw.version : 0;
  if (version > STATE_VERSION) return null;

  const base = emptyState(timezone);
  const profile = (raw.profile ?? {}) as Partial<Profile>;

  return {
    version: STATE_VERSION,
    profile: {
      displayName: typeof profile.displayName === "string" ? profile.displayName : "",
      avatar: typeof profile.avatar === "string" ? profile.avatar : null,
      timezone: typeof profile.timezone === "string" ? profile.timezone : timezone,
      onboarded: profile.onboarded === true,
      // v1 n'avait pas d'étapes : un profil déjà onboardé est considéré terminé.
      onboardingStep:
        typeof profile.onboardingStep === "number"
          ? profile.onboardingStep
          : profile.onboarded === true
            ? 5
            : 0,
    },
    visionAreas: Array.isArray(raw.visionAreas) ? (raw.visionAreas as VisionArea[]) : base.visionAreas,
    visionItems: Array.isArray(raw.visionItems) ? (raw.visionItems as VisionItem[]) : base.visionItems,
    habits: Array.isArray(raw.habits) ? (raw.habits as Habit[]) : base.habits,
    goals: Array.isArray(raw.goals) ? (raw.goals as Goal[]) : base.goals,
    logs: Array.isArray(raw.logs) ? (raw.logs as HabitLog[]) : base.logs,
    // Introduits en v5. Un état antérieur repart simplement sans métrique : le
    // bilan mensuel retombe alors sur sa seule couche « fondation ».
    metrics: Array.isArray(raw.metrics) ? (raw.metrics as Metric[]) : base.metrics,
    metricEntries: Array.isArray(raw.metricEntries)
      ? (raw.metricEntries as MetricEntry[])
      : base.metricEntries,
    // Introduites en v6.
    reviews: Array.isArray(raw.reviews) ? (raw.reviews as Review[]) : base.reviews,
    // Un réglage de partage inconnu retombe sur le défaut fermé, jamais sur ouvert.
    shareSettings:
      typeof raw.shareSettings === "object" && raw.shareSettings !== null
        ? { ...DEFAULT_SHARE_SETTINGS, ...(raw.shareSettings as Partial<ShareSettings>) }
        : base.shareSettings,
    liveBoard:
      typeof raw.liveBoard === "object" &&
      raw.liveBoard !== null &&
      typeof (raw.liveBoard as LiveBoardRef).id === "string" &&
      typeof (raw.liveBoard as LiveBoardRef).secret === "string"
        ? (raw.liveBoard as LiveBoardRef)
        : null,
  };
}

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
