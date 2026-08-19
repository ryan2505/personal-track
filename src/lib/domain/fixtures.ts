import type {
  Goal,
  Habit,
  HabitLog,
  LocalDate,
  Metric,
  MetricEntry,
  MonthPeriod,
  ScheduleRule,
} from "./types";

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

export function makeMetric(overrides: Partial<Metric> & { id: string }): Metric {
  return {
    name: overrides.id,
    kind: "output",
    cadence: "monthly",
    category: "business",
    group: null,
    unit: null,
    valueType: "count",
    direction: "increase",
    weight: 1,
    archivedAt: null,
    ...overrides,
  };
}

export function makeEntry(
  metricId: string,
  period: MonthPeriod,
  overrides: Partial<MetricEntry> = {},
): MetricEntry {
  return { metricId, period, target: null, actual: null, note: null, ...overrides };
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
    metricId: null,
    ...overrides,
  };
}
