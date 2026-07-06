export { parseSamples, ParseError } from './parse.js';
export { aggregate } from './aggregate.js';
export { rank, type RankOptions } from './rank.js';
export { diff } from './diff.js';
export { createColors, type Colors } from './color.js';
export {
  renderRanking,
  renderDiff,
  type RenderOptions,
  type RankReport,
  type DiffReport,
} from './render.js';
export { run } from './cli.js';
export type { RunDeps } from './deps.js';
export type {
  RenderPhase,
  RenderSample,
  ComponentStat,
  SortKey,
  DiffStatus,
  DiffRow,
} from './types.js';
