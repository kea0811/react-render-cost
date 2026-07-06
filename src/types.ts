/** The three commit phases React reports to a `<Profiler onRender>` callback. */
export type RenderPhase = 'mount' | 'update' | 'nested-update';

/**
 * One render sample, mirroring the arguments React hands to
 * `<Profiler onRender={(id, phase, actualDuration, baseDuration, ...)}>`.
 * `startTime`/`commitTime` are optional — they aren't needed to rank cost.
 */
export interface RenderSample {
  id: string;
  phase: RenderPhase;
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
}

/** Aggregated render cost for a single component id. */
export interface ComponentStat {
  id: string;
  /** Total number of commits this component took part in. */
  renders: number;
  /** Commits where `phase === 'mount'`. */
  mounts: number;
  /** Commits where `phase` is `update` or `nested-update`. */
  updates: number;
  /** Mean `actualDuration` in milliseconds. */
  avg: number;
  /** Slowest single `actualDuration` in milliseconds. */
  max: number;
  /** Summed `actualDuration` across every commit, in milliseconds. */
  total: number;
  /** Mean `baseDuration` — the cost with memoization stripped away. */
  base: number;
}

/** The metric a ranking is ordered by. */
export type SortKey = 'avg' | 'total' | 'max' | 'renders' | 'base';

/** How a component's average moved between a baseline and the current run. */
export type DiffStatus = 'added' | 'removed' | 'regressed' | 'improved' | 'same';

/** One row of a baseline-vs-current comparison. */
export interface DiffRow {
  id: string;
  /** Average render cost in the baseline run, or `null` if the component is new. */
  baseline: number | null;
  /** Average render cost in the current run, or `null` if the component is gone. */
  current: number | null;
  /** `current - baseline`, or `null` when one side is missing. */
  delta: number | null;
  /** Percentage change relative to the baseline, or `null` when it can't be computed. */
  pct: number | null;
  status: DiffStatus;
}
