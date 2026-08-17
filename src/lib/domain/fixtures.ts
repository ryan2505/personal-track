import type { Goal, Habit, HabitLog, LocalDate, ScheduleRule } from "./types";

/** Fabriques de test. Aucun usage applicatif. */

export function makeHabit(overrides: Partial<Habit> & { id: string }): Habit {
  return {
    title: overrides.id,
    category: "personal",
    type: "boolean",
    unit: null,
    targetValue: null,
    direction: "at_least",
    weight: 1,
    startDate: "2026-01-01",
    endDate: null,
    schedules: [{ rule: { kind: "daily" }, effectiveFrom: "2026-01-01", effectiveTo: null }],
    ...overrides,
  };
}

export function withRule(
  id: string,
  rule: ScheduleRule,
  overrides: Partial<Habit> = {},
): Habit {
  return makeHabit({
    id,
    schedules: [{ rule, effectiveFrom: "2026-01-01", effectiveTo: null }],
    ...overrides,
  });
}

export function makeLog(
  habitId: string,
  localDate: LocalDate,
  overrides: Partial<HabitLog> = {},
): HabitLog {
  return { habitId, localDate, value: null, completed: true, ...overrides };
}

export function makeGoal(overrides: Partial<Goal> & { id: string }): Goal {
  return {
    title: overrides.id,
    category: "business",
    scope: "monthly",
    targetValue: 5,
    currentValue: 0,
    source: "manual",
    unit: null,
    startDate: "2026-08-01",
    dueDate: "2026-08-31",
    status: "not_started",
    habitIds: [],
    ...overrides,
  };
}
