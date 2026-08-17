"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import {
  addDays,
  compareDates,
  localToday,
  type Goal,
  type Habit,
  type HabitCategory,
  type HabitDirection,
  type HabitLog,
  type HabitType,
  type LocalDate,
  type ScheduleRule,
  type VisionArea,
  type VisionItem,
} from "@/lib/domain";

import type { LiveBoardRef } from "@/lib/share/live";
import type { ShareSettings } from "@/lib/share/snapshot";

import { localRepository, type Repository } from "./repository";
import { detectTimezone, emptyState, type AppState, type Profile } from "./state";

export interface HabitInput {
  title: string;
  category: HabitCategory;
  type: HabitType;
  unit: string | null;
  targetValue: number | null;
  direction: HabitDirection;
  weight: number;
  rule: ScheduleRule;
}

export interface LogPatch {
  completed?: boolean;
  value?: number | null;
  note?: string | null;
}

interface StoreValue {
  ready: boolean;
  state: AppState;
  today: LocalDate;
  /** Message d'échec de persistance, ou `null`. Jamais silencieux. */
  saveError: string | null;

  setProfile: (patch: Partial<Profile>) => void;
  setOnboardingStep: (step: number) => void;
  completeOnboarding: () => void;

  setVisionAreas: (areas: { category: HabitCategory; statement: string }[]) => void;
  removeVisionArea: (id: string) => void;
  addVisionItem: (item: Omit<VisionItem, "id" | "order">) => void;
  updateVisionItem: (id: string, patch: Partial<VisionItem>) => void;
  removeVisionItem: (id: string) => void;
  moveVisionItem: (id: string, direction: -1 | 1) => void;

  addHabit: (input: HabitInput) => Habit;
  updateHabit: (id: string, input: HabitInput) => void;
  archiveHabit: (id: string) => void;

  setLog: (habitId: string, date: LocalDate, patch: LogPatch) => void;
  toggleHabit: (habit: Habit, date: LocalDate) => void;
  adjustValue: (habit: Habit, date: LocalDate, delta: number) => void;

  addGoal: (goal: Omit<Goal, "id">) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  removeGoal: (id: string) => void;

  setShareSettings: (patch: Partial<ShareSettings>) => void;
  setLiveBoard: (ref: LiveBoardRef | null) => void;

  resetAll: () => void;
}

/** Temporisation d'écriture. Assez court pour être imperceptible, assez long
 *  pour regrouper une salve de frappes en une seule requête. */
const SAVE_DEBOUNCE_MS = 700;

const StoreContext = createContext<StoreValue | null>(null);

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

function sameRule(a: ScheduleRule, b: ScheduleRule): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function replaceLog(
  current: AppState,
  next: HabitLog,
  existing: HabitLog | undefined,
): AppState {
  return {
    ...current,
    logs:
      existing === undefined
        ? [...current.logs, next]
        : current.logs.map((log) => (log === existing ? next : log)),
  };
}

export function StoreProvider({
  children,
  repository = localRepository,
}: {
  children: React.ReactNode;
  repository?: Repository;
}) {
  const [state, setState] = useState<AppState>(() => emptyState(detectTimezone()));
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void repository.load().then((loaded) => {
      if (cancelled) return;
      setState(loaded);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  /**
   * La persistance est un effet dérivé de l'état, pas un effet de bord glissé
   * dans un updater : c'est ce qui permet de remonter une écriture échouée.
   *
   * Temporisée, parce que le dépôt peut être distant : sans ça, chaque frappe
   * dans un champ de note déclencherait une requête réseau.
   */
  const pending = useRef<AppState | null>(null);

  const flush = useCallback(async () => {
    const next = pending.current;
    if (next === null) return;
    pending.current = null;
    try {
      await repository.save(next);
      setSaveError(null);
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : "Enregistrement impossible.");
    }
  }, [repository]);

  useEffect(() => {
    if (!ready) return;
    pending.current = state;
    const timer = window.setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [state, ready, flush]);

  // Fermer l'onglet ou passer en arrière-plan ne doit pas perdre la dernière
  // modification restée dans la temporisation.
  const flushRef = useRef(flush);
  flushRef.current = flush;

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flushRef.current();
    };
    const onPageHide = () => void flushRef.current();

    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  // Démontage (déconnexion, changement de compte) : on écrit ce qui reste.
  useEffect(() => () => void flushRef.current(), []);

  const update = useCallback((mutate: (current: AppState) => AppState) => {
    setState(mutate);
  }, []);

  const today = localToday(state.profile.timezone);

  // ── Profil & onboarding ────────────────────────────────────────────────────

  const setProfile = useCallback(
    (patch: Partial<Profile>) => {
      update((current) => ({ ...current, profile: { ...current.profile, ...patch } }));
    },
    [update],
  );

  const setOnboardingStep = useCallback(
    (step: number) => {
      update((current) => ({
        ...current,
        profile: { ...current.profile, onboardingStep: step },
      }));
    },
    [update],
  );

  const completeOnboarding = useCallback(() => {
    update((current) => ({
      ...current,
      profile: {
        ...current.profile,
        onboarded: true,
        displayName: current.profile.displayName.trim() === "" ? "Toi" : current.profile.displayName,
      },
    }));
  }, [update]);

  // ── Vision ─────────────────────────────────────────────────────────────────

  /** Remplace l'ensemble des domaines : conserve l'id des domaines déjà présents. */
  const setVisionAreas = useCallback(
    (areas: { category: HabitCategory; statement: string }[]) => {
      update((current) => ({
        ...current,
        visionAreas: areas.map((area, index) => {
          const existing = current.visionAreas.find((item) => item.category === area.category);
          return {
            id: existing?.id ?? newId(),
            category: area.category,
            statement: area.statement,
            order: index,
          };
        }),
      }));
    },
    [update],
  );

  const removeVisionArea = useCallback(
    (id: string) => {
      update((current) => ({
        ...current,
        visionAreas: current.visionAreas.filter((area) => area.id !== id),
      }));
    },
    [update],
  );

  const addVisionItem = useCallback(
    (item: Omit<VisionItem, "id" | "order">) => {
      update((current) => ({
        ...current,
        visionItems: [
          ...current.visionItems,
          { ...item, id: newId(), order: current.visionItems.length },
        ],
      }));
    },
    [update],
  );

  const updateVisionItem = useCallback(
    (id: string, patch: Partial<VisionItem>) => {
      update((current) => ({
        ...current,
        visionItems: current.visionItems.map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      }));
    },
    [update],
  );

  const removeVisionItem = useCallback(
    (id: string) => {
      update((current) => ({
        ...current,
        visionItems: current.visionItems
          .filter((item) => item.id !== id)
          .map((item, index) => ({ ...item, order: index })),
      }));
    },
    [update],
  );

  const moveVisionItem = useCallback(
    (id: string, direction: -1 | 1) => {
      update((current) => {
        const ordered = [...current.visionItems].sort((a, b) => a.order - b.order);
        const index = ordered.findIndex((item) => item.id === id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= ordered.length) return current;

        const swapped = [...ordered];
        const moving = swapped[index];
        const displaced = swapped[target];
        if (moving === undefined || displaced === undefined) return current;
        swapped[index] = displaced;
        swapped[target] = moving;

        return {
          ...current,
          visionItems: swapped.map((item, position) => ({ ...item, order: position })),
        };
      });
    },
    [update],
  );

  // ── Habitudes ──────────────────────────────────────────────────────────────

  const addHabit = useCallback(
    (input: HabitInput) => {
      const habit: Habit = {
        id: newId(),
        title: input.title,
        category: input.category,
        type: input.type,
        unit: input.unit,
        targetValue: input.targetValue,
        direction: input.direction,
        weight: input.weight,
        startDate: today,
        endDate: null,
        schedules: [{ rule: input.rule, effectiveFrom: today, effectiveTo: null }],
      };
      update((current) => ({ ...current, habits: [...current.habits, habit] }));
      return habit;
    },
    [today, update],
  );

  /**
   * INVARIANT §5.3 — modifier le planning ne réécrit jamais le passé.
   * On clôt la version courante hier et on en ouvre une nouvelle aujourd'hui.
   */
  const updateHabit = useCallback(
    (id: string, input: HabitInput) => {
      update((current) => ({
        ...current,
        habits: current.habits.map((habit) => {
          if (habit.id !== id) return habit;

          const open = habit.schedules.find((version) => version.effectiveTo === null);
          let schedules = habit.schedules;

          if (open === undefined) {
            schedules = [
              ...habit.schedules,
              { rule: input.rule, effectiveFrom: today, effectiveTo: null },
            ];
          } else if (!sameRule(open.rule, input.rule)) {
            if (compareDates(open.effectiveFrom, today) >= 0) {
              // Version ouverte aujourd'hui même : on la remplace, rien à préserver.
              schedules = habit.schedules.map((version) =>
                version === open ? { ...version, rule: input.rule } : version,
              );
            } else {
              schedules = [
                ...habit.schedules.map((version) =>
                  version === open ? { ...version, effectiveTo: addDays(today, -1) } : version,
                ),
                { rule: input.rule, effectiveFrom: today, effectiveTo: null },
              ];
            }
          }

          return {
            ...habit,
            title: input.title,
            category: input.category,
            type: input.type,
            unit: input.unit,
            targetValue: input.targetValue,
            direction: input.direction,
            weight: input.weight,
            schedules,
          };
        }),
      }));
    },
    [today, update],
  );

  /** Archiver = borner la fenêtre d'activité. Jamais de suppression : l'historique reste. */
  const archiveHabit = useCallback(
    (id: string) => {
      update((current) => ({
        ...current,
        habits: current.habits.map((habit) =>
          habit.id === id ? { ...habit, endDate: today } : habit,
        ),
      }));
    },
    [today, update],
  );

  // ── Logs ───────────────────────────────────────────────────────────────────

  const setLog = useCallback(
    (habitId: string, date: LocalDate, patch: LogPatch) => {
      update((current) => {
        const existing = current.logs.find(
          (log) => log.habitId === habitId && log.localDate === date,
        );
        return replaceLog(
          current,
          {
            habitId,
            localDate: date,
            value: patch.value !== undefined ? patch.value : (existing?.value ?? null),
            completed:
              patch.completed !== undefined ? patch.completed : (existing?.completed ?? false),
            note: patch.note !== undefined ? patch.note : (existing?.note ?? null),
          },
          existing,
        );
      });
    },
    [update],
  );

  /**
   * L'état est lu DANS la mise à jour, pas depuis la closure : deux taps
   * rapprochés sur la même habitude ne peuvent pas partir d'un log périmé.
   */
  const toggleHabit = useCallback(
    (habit: Habit, date: LocalDate) => {
      update((current) => {
        const existing = current.logs.find(
          (log) => log.habitId === habit.id && log.localDate === date,
        );

        if (habit.type === "boolean") {
          return replaceLog(
            current,
            {
              habitId: habit.id,
              localDate: date,
              value: null,
              completed: !(existing?.completed ?? false),
              note: existing?.note ?? null,
            },
            existing,
          );
        }

        // Habitude mesurée : un tap remplit la cible, un second remet à zéro.
        const target = habit.targetValue ?? 1;
        const reached = (existing?.value ?? 0) >= target;
        return replaceLog(
          current,
          {
            habitId: habit.id,
            localDate: date,
            value: reached ? 0 : target,
            completed: !reached,
            note: existing?.note ?? null,
          },
          existing,
        );
      });
    },
    [update],
  );

  const adjustValue = useCallback(
    (habit: Habit, date: LocalDate, delta: number) => {
      update((current) => {
        const existing = current.logs.find(
          (log) => log.habitId === habit.id && log.localDate === date,
        );
        const value = Math.max(0, Math.round(((existing?.value ?? 0) + delta) * 100) / 100);
        return replaceLog(
          current,
          {
            habitId: habit.id,
            localDate: date,
            value,
            completed: habit.targetValue !== null && value >= habit.targetValue,
            note: existing?.note ?? null,
          },
          existing,
        );
      });
    },
    [update],
  );

  // ── Objectifs ──────────────────────────────────────────────────────────────

  const addGoal = useCallback(
    (goal: Omit<Goal, "id">) => {
      update((current) => ({ ...current, goals: [...current.goals, { ...goal, id: newId() }] }));
    },
    [update],
  );

  const updateGoal = useCallback(
    (id: string, patch: Partial<Goal>) => {
      update((current) => ({
        ...current,
        goals: current.goals.map((goal) => (goal.id === id ? { ...goal, ...patch } : goal)),
      }));
    },
    [update],
  );

  const removeGoal = useCallback(
    (id: string) => {
      update((current) => ({ ...current, goals: current.goals.filter((goal) => goal.id !== id) }));
    },
    [update],
  );

  const setShareSettings = useCallback(
    (patch: Partial<ShareSettings>) => {
      update((current) => ({
        ...current,
        shareSettings: { ...current.shareSettings, ...patch },
      }));
    },
    [update],
  );

  const setLiveBoard = useCallback(
    (ref: LiveBoardRef | null) => {
      update((current) => ({ ...current, liveBoard: ref }));
    },
    [update],
  );

  const resetAll = useCallback(() => {
    void repository.clear();
    setState(emptyState(detectTimezone()));
    setSaveError(null);
  }, [repository]);

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      state,
      today,
      saveError,
      setProfile,
      setOnboardingStep,
      completeOnboarding,
      setVisionAreas,
      removeVisionArea,
      addVisionItem,
      updateVisionItem,
      removeVisionItem,
      moveVisionItem,
      addHabit,
      updateHabit,
      archiveHabit,
      setLog,
      toggleHabit,
      adjustValue,
      addGoal,
      updateGoal,
      removeGoal,
      setShareSettings,
      setLiveBoard,
      resetAll,
    }),
    [
      ready,
      state,
      today,
      saveError,
      setProfile,
      setOnboardingStep,
      completeOnboarding,
      setVisionAreas,
      removeVisionArea,
      addVisionItem,
      updateVisionItem,
      removeVisionItem,
      moveVisionItem,
      addHabit,
      updateHabit,
      archiveHabit,
      setLog,
      toggleHabit,
      adjustValue,
      addGoal,
      updateGoal,
      removeGoal,
      setShareSettings,
      setLiveBoard,
      resetAll,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (value === null) throw new Error("useStore doit être utilisé dans <StoreProvider>");
  return value;
}

/** Type d'un `VisionArea` avant persistance, exposé pour les formulaires. */
export type VisionAreaDraft = Pick<VisionArea, "category" | "statement">;
