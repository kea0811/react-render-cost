import { createColors } from '../src/color.js';
import { type DiffReport, type RankReport, renderDiff, renderRanking } from '../src/render.js';
import type { ComponentStat, DiffRow } from '../src/types.js';

const plain = { json: false, colors: createColors(false) };
const asJson = { json: true, colors: createColors(false) };

const stat = (over: Partial<ComponentStat> & Pick<ComponentStat, 'id' | 'avg'>): ComponentStat => ({
  renders: 1,
  mounts: 1,
  updates: 0,
  max: over.avg,
  total: over.avg,
  base: over.avg,
  ...over,
});

const rankReport = (over: Partial<RankReport> = {}): RankReport => ({
  profile: 'profile.json',
  sort: 'avg',
  ranked: [stat({ id: 'A', avg: 10 }), stat({ id: 'B', avg: 6 }), stat({ id: 'C', avg: 3 }), stat({ id: 'D', avg: 1 })],
  totalComponents: 4,
  totalRenders: 12,
  budget: null,
  overBudget: [],
  ...over,
});

describe('renderRanking', () => {
  it('renders a heat-mapped table spanning every heat band', () => {
    const out = renderRanking(rankReport(), plain);
    expect(out).toContain('profile.json');
    expect(out).toContain('component');
    for (const id of ['A', 'B', 'C', 'D']) {
      expect(out).toContain(id);
    }
  });

  it('applies real ANSI colors when enabled', () => {
    const out = renderRanking(rankReport(), { json: false, colors: createColors(true) });
    expect(out).toContain(String.fromCharCode(27));
  });

  it('handles an all-zero profile without dividing by zero', () => {
    const out = renderRanking(
      rankReport({ ranked: [stat({ id: 'A', avg: 0 })], totalComponents: 1, totalRenders: 1 }),
      plain,
    );
    expect(out).toContain('1 component,');
    expect(out).toContain('1 render');
  });

  it('shows a "showing top N" note when the list is capped', () => {
    const out = renderRanking(rankReport({ ranked: [stat({ id: 'A', avg: 10 })] }), plain);
    expect(out).toContain('showing top 1');
  });

  it('prints an empty-state note when nothing survives the filters', () => {
    const out = renderRanking(rankReport({ ranked: [] }), plain);
    expect(out).toContain('no components to show');
  });

  it('reports a failed budget in red prose', () => {
    const out = renderRanking(
      rankReport({ budget: 5, overBudget: [stat({ id: 'A', avg: 10 })] }),
      plain,
    );
    expect(out).toContain('✗');
    expect(out).toContain('over the 5.00 ms budget');
    expect(out).toContain('1 component');
  });

  it('reports a passing budget', () => {
    const out = renderRanking(rankReport({ budget: 50, overBudget: [] }), plain);
    expect(out).toContain('✓');
    expect(out).toContain('within the 50.00 ms budget');
  });

  it('emits JSON with rounded numbers', () => {
    const report = rankReport({
      ranked: [stat({ id: 'A', avg: 10.456, max: 14.2, total: 41.8, base: 9.58 })],
      budget: 5,
      overBudget: [stat({ id: 'A', avg: 10.456 })],
    });
    const parsed = JSON.parse(renderRanking(report, asJson));
    expect(parsed.components).toBe(4);
    expect(parsed.budget).toBe(5);
    expect(parsed.overBudget).toEqual(['A']);
    expect(parsed.ranked[0]).toMatchObject({ id: 'A', avg: 10.46, max: 14.2, total: 41.8, base: 9.58 });
  });
});

const diffRow = (over: Partial<DiffRow> & Pick<DiffRow, 'id' | 'status'>): DiffRow => ({
  baseline: 4,
  current: 4,
  delta: 0,
  pct: 0,
  ...over,
});

const mixedRows: DiffRow[] = [
  diffRow({ id: 'R', baseline: 4, current: 9, delta: 5, pct: 125, status: 'regressed' }),
  diffRow({ id: 'I', baseline: 10, current: 4, delta: -6, pct: -60, status: 'improved' }),
  diffRow({ id: 'S', status: 'same' }),
  diffRow({ id: 'A', baseline: null, current: 5, delta: null, pct: null, status: 'added' }),
  diffRow({ id: 'X', baseline: 3, current: null, delta: null, pct: null, status: 'removed' }),
];

const diffReport = (rows: DiffRow[]): DiffReport => ({
  profile: 'profile.json',
  baseline: 'main.json',
  threshold: 0.1,
  rows,
});

describe('renderDiff', () => {
  it('renders every status, sign and symbol', () => {
    const out = renderDiff(diffReport(mixedRows), plain);
    expect(out).toContain('diff vs main.json');
    expect(out).toContain('+5.00');
    expect(out).toContain('-6.00');
    expect(out).toContain('+125%');
    expect(out).toContain('-60%');
    expect(out).toContain('▲ regressed');
    expect(out).toContain('▽ improved');
    expect(out).toContain('· same');
    expect(out).toContain('+ added');
    expect(out).toContain('− removed');
    expect(out).toContain('–'); // dash for the missing side of added/removed
  });

  it('warns in red when there are regressions', () => {
    const out = renderDiff(diffReport(mixedRows), plain);
    expect(out).toContain('✗');
    expect(out).toContain('slower by more than 0.10 ms');
  });

  it('confirms in green when there are no regressions', () => {
    const clean = mixedRows.filter((row) => row.status !== 'regressed');
    const out = renderDiff(diffReport(clean), plain);
    expect(out).toContain('✓');
    expect(out).toContain('no regressions beyond 0.10 ms');
  });

  it('emits JSON with nulls preserved and numbers rounded', () => {
    const parsed = JSON.parse(renderDiff(diffReport(mixedRows), asJson));
    expect(parsed.baseline).toBe('main.json');
    const added = parsed.rows.find((row: DiffRow) => row.id === 'A');
    expect(added).toMatchObject({ baseline: null, current: 5, delta: null, pct: null });
    const regressed = parsed.rows.find((row: DiffRow) => row.id === 'R');
    expect(regressed).toMatchObject({ delta: 5, pct: 125 });
  });
});
