import type { ComponentStat, DiffRow, DiffStatus } from './types.js';

/** Rank a row for "biggest mover first" ordering. */
function magnitude(row: DiffRow): number {
  if (row.delta !== null) {
    return Math.abs(row.delta);
  }
  // delta is null only for added/removed, so exactly one side is non-null.
  const value = row.current ?? row.baseline;
  return Math.abs(value as number);
}

function classify(
  baseline: number | null,
  current: number | null,
  threshold: number,
): { delta: number | null; pct: number | null; status: DiffStatus } {
  if (baseline === null) {
    return { delta: null, pct: null, status: 'added' };
  }
  if (current === null) {
    return { delta: null, pct: null, status: 'removed' };
  }

  const delta = current - baseline;
  const pct = baseline > 0 ? (delta / baseline) * 100 : null;

  let status: DiffStatus;
  if (Math.abs(delta) <= threshold) {
    status = 'same';
  } else if (delta > 0) {
    status = 'regressed';
  } else {
    status = 'improved';
  }

  return { delta, pct, status };
}

/**
 * Compare current stats against a baseline, matching on component id. Diffs
 * smaller than `threshold` ms are reported as `same` (noise). Rows are ordered
 * biggest-mover first, then by id.
 */
export function diff(
  current: ComponentStat[],
  baseline: ComponentStat[],
  threshold = 0.1,
): DiffRow[] {
  const currentAvg = new Map(current.map((stat) => [stat.id, stat.avg]));
  const baselineAvg = new Map(baseline.map((stat) => [stat.id, stat.avg]));
  const ids = new Set([...baselineAvg.keys(), ...currentAvg.keys()]);

  const rows: DiffRow[] = [...ids].map((id) => {
    const base = baselineAvg.has(id) ? (baselineAvg.get(id) as number) : null;
    const curr = currentAvg.has(id) ? (currentAvg.get(id) as number) : null;
    const { delta, pct, status } = classify(base, curr, threshold);
    return { id, baseline: base, current: curr, delta, pct, status };
  });

  return rows.sort((a, b) => {
    const byMagnitude = magnitude(b) - magnitude(a);
    return byMagnitude !== 0 ? byMagnitude : a.id.localeCompare(b.id);
  });
}
