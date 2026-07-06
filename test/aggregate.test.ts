import { aggregate } from '../src/aggregate.js';
import type { RenderSample } from '../src/types.js';

const sample = (over: Partial<RenderSample> & Pick<RenderSample, 'id'>): RenderSample => ({
  phase: 'update',
  actualDuration: 1,
  baseDuration: 1,
  startTime: 0,
  commitTime: 0,
  ...over,
});

describe('aggregate', () => {
  it('returns an empty list for no samples', () => {
    expect(aggregate([])).toEqual([]);
  });

  it('collapses samples per component id in first-seen order', () => {
    const stats = aggregate([sample({ id: 'B' }), sample({ id: 'A' }), sample({ id: 'B' })]);
    expect(stats.map((s) => s.id)).toEqual(['B', 'A']);
  });

  it('counts mounts and updates separately (mount, update, nested-update)', () => {
    const stats = aggregate([
      sample({ id: 'A', phase: 'mount' }),
      sample({ id: 'A', phase: 'update' }),
      sample({ id: 'A', phase: 'nested-update' }),
    ]);
    expect(stats[0]).toMatchObject({ renders: 3, mounts: 1, updates: 2 });
  });

  it('computes avg, total, max and base', () => {
    const stats = aggregate([
      sample({ id: 'A', actualDuration: 6, baseDuration: 5 }),
      sample({ id: 'A', actualDuration: 2, baseDuration: 3 }),
    ]);
    expect(stats[0]).toMatchObject({ total: 8, avg: 4, max: 6, base: 4 });
  });

  it('tracks the max across both larger and smaller follow-up samples', () => {
    // ascending then descending exercises both sides of the "new max?" check
    const stats = aggregate([
      sample({ id: 'A', actualDuration: 3 }),
      sample({ id: 'A', actualDuration: 9 }),
      sample({ id: 'A', actualDuration: 4 }),
    ]);
    expect(stats[0].max).toBe(9);
  });
});
