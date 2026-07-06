import { rank } from '../src/rank.js';
import type { ComponentStat } from '../src/types.js';

const stat = (over: Partial<ComponentStat> & Pick<ComponentStat, 'id'>): ComponentStat => ({
  renders: 1,
  mounts: 1,
  updates: 0,
  avg: 1,
  max: 1,
  total: 1,
  base: 1,
  ...over,
});

const A = stat({ id: 'A', avg: 3, total: 30, max: 5, renders: 10, base: 2 });
const B = stat({ id: 'B', avg: 9, total: 9, max: 20, renders: 1, base: 8 });
const C = stat({ id: 'C', avg: 6, total: 12, max: 6, renders: 2, base: 5 });

describe('rank', () => {
  it('defaults to descending average', () => {
    expect(rank([A, B, C]).map((s) => s.id)).toEqual(['B', 'C', 'A']);
  });

  it('sorts by total', () => {
    expect(rank([A, B, C], { sort: 'total' }).map((s) => s.id)).toEqual(['A', 'C', 'B']);
  });

  it('sorts by max', () => {
    expect(rank([A, B, C], { sort: 'max' }).map((s) => s.id)).toEqual(['B', 'C', 'A']);
  });

  it('sorts by renders', () => {
    expect(rank([A, B, C], { sort: 'renders' }).map((s) => s.id)).toEqual(['A', 'C', 'B']);
  });

  it('sorts by base', () => {
    expect(rank([A, B, C], { sort: 'base' }).map((s) => s.id)).toEqual(['B', 'C', 'A']);
  });

  it('breaks ties by id', () => {
    const x = stat({ id: 'zed', avg: 5 });
    const y = stat({ id: 'abe', avg: 5 });
    expect(rank([x, y]).map((s) => s.id)).toEqual(['abe', 'zed']);
  });

  it('applies the min floor', () => {
    expect(rank([A, B, C], { min: 5 }).map((s) => s.id)).toEqual(['B', 'C']);
  });

  it('caps with top', () => {
    expect(rank([A, B, C], { top: 1 }).map((s) => s.id)).toEqual(['B']);
  });

  it('does not mutate the input', () => {
    const input = [A, B, C];
    rank(input, { sort: 'total' });
    expect(input.map((s) => s.id)).toEqual(['A', 'B', 'C']);
  });
});
