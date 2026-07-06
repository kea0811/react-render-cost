import { diff } from '../src/diff.js';
import type { ComponentStat, DiffRow } from '../src/types.js';

const stat = (id: string, avg: number): ComponentStat => ({
  id,
  renders: 1,
  mounts: 1,
  updates: 0,
  avg,
  max: avg,
  total: avg,
  base: avg,
});

const baseline = [stat('A', 6), stat('Imp', 10), stat('Same1', 4), stat('Same2', 4), stat('Zero', 0), stat('Rem', 3)];
const current = [stat('A', 12), stat('Imp', 4), stat('Same1', 4), stat('Same2', 4), stat('Zero', 2), stat('Add', 5)];

const byId = (rows: DiffRow[]): Map<string, DiffRow> => new Map(rows.map((row) => [row.id, row]));

describe('diff', () => {
  const rows = diff(current, baseline);
  const map = byId(rows);

  it('flags a regression', () => {
    expect(map.get('A')).toMatchObject({ baseline: 6, current: 12, delta: 6, status: 'regressed' });
  });

  it('flags an improvement', () => {
    expect(map.get('Imp')).toMatchObject({ delta: -6, status: 'improved' });
  });

  it('marks tiny moves as "same"', () => {
    expect(map.get('Same1')?.status).toBe('same');
    expect(map.get('Same2')?.status).toBe('same');
  });

  it('marks new components as "added"', () => {
    expect(map.get('Add')).toMatchObject({ baseline: null, current: 5, delta: null, pct: null, status: 'added' });
  });

  it('marks vanished components as "removed"', () => {
    expect(map.get('Rem')).toMatchObject({ baseline: 3, current: null, delta: null, pct: null, status: 'removed' });
  });

  it('computes percentage change when the baseline is positive', () => {
    expect(map.get('A')?.pct).toBeCloseTo(100);
  });

  it('leaves pct null when the baseline average is zero', () => {
    expect(map.get('Zero')).toMatchObject({ delta: 2, pct: null, status: 'regressed' });
  });

  it('orders biggest movers first, ties broken by id', () => {
    // A and Imp both move by 6 → id order puts A first; the two "same" rows (magnitude 0) sit last, A→Z.
    expect(rows[0].id).toBe('A');
    const sames = rows.filter((row) => row.status === 'same').map((row) => row.id);
    expect(sames).toEqual(['Same1', 'Same2']);
  });

  it('uses a default threshold of 0.1ms', () => {
    const [row] = diff([stat('X', 1.05)], [stat('X', 1)]);
    expect(row.status).toBe('same');
  });

  it('honours a custom threshold', () => {
    const [row] = diff([stat('X', 1.05)], [stat('X', 1)], 0.01);
    expect(row.status).toBe('regressed');
  });
});
