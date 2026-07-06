import type { ComponentStat, RenderSample } from './types.js';

interface Accumulator {
  id: string;
  renders: number;
  mounts: number;
  updates: number;
  totalActual: number;
  maxActual: number;
  totalBase: number;
}

/**
 * Collapse a flat list of render samples into one {@link ComponentStat} per
 * component id. Components appear in first-seen order; ranking happens later.
 */
export function aggregate(samples: RenderSample[]): ComponentStat[] {
  const byId = new Map<string, Accumulator>();

  for (const sample of samples) {
    let acc = byId.get(sample.id);
    if (acc === undefined) {
      acc = {
        id: sample.id,
        renders: 0,
        mounts: 0,
        updates: 0,
        totalActual: 0,
        maxActual: 0,
        totalBase: 0,
      };
      byId.set(sample.id, acc);
    }

    acc.renders += 1;
    if (sample.phase === 'mount') {
      acc.mounts += 1;
    } else {
      acc.updates += 1;
    }
    acc.totalActual += sample.actualDuration;
    acc.totalBase += sample.baseDuration;
    if (sample.actualDuration > acc.maxActual) {
      acc.maxActual = sample.actualDuration;
    }
  }

  return [...byId.values()].map((acc) => ({
    id: acc.id,
    renders: acc.renders,
    mounts: acc.mounts,
    updates: acc.updates,
    avg: acc.totalActual / acc.renders,
    max: acc.maxActual,
    total: acc.totalActual,
    base: acc.totalBase / acc.renders,
  }));
}
