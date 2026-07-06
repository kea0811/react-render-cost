import type { ComponentStat, SortKey } from './types.js';

/** Options for {@link rank}. */
export interface RankOptions {
  /** Metric to order by (defaults to `avg`). */
  sort?: SortKey;
  /** Keep only the top N rows after sorting. */
  top?: number;
  /** Drop components whose average render is below this many milliseconds. */
  min?: number;
}

/** Pull the sort metric off a stat. A lookup map keeps every key branch-free. */
const METRIC: Record<SortKey, (stat: ComponentStat) => number> = {
  avg: (stat) => stat.avg,
  total: (stat) => stat.total,
  max: (stat) => stat.max,
  renders: (stat) => stat.renders,
  base: (stat) => stat.base,
};

/**
 * Sort components by the chosen metric (descending, ties broken by id) and
 * apply the optional `min` floor and `top` cap. Returns a new array; the input
 * is left untouched.
 */
export function rank(stats: ComponentStat[], options: RankOptions = {}): ComponentStat[] {
  const sort = options.sort ?? 'avg';
  const metric = METRIC[sort];

  let rows = stats;
  if (options.min !== undefined) {
    const floor = options.min;
    rows = rows.filter((stat) => stat.avg >= floor);
  }

  rows = [...rows].sort((a, b) => {
    const diff = metric(b) - metric(a);
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });

  if (options.top !== undefined) {
    rows = rows.slice(0, options.top);
  }

  return rows;
}
