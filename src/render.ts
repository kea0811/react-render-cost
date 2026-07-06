import type { Colors } from './color.js';
import type { ComponentStat, DiffRow, DiffStatus, SortKey } from './types.js';

/** Shared render options. */
export interface RenderOptions {
  /** Emit machine-readable JSON instead of a table. */
  json: boolean;
  /** The palette to paint with. */
  colors: Colors;
}

/** A ranking ready to be printed. */
export interface RankReport {
  profile: string;
  sort: SortKey;
  /** The rows to display (already sorted, filtered and capped). */
  ranked: ComponentStat[];
  /** How many components existed before any `--top`/`--min` cap. */
  totalComponents: number;
  /** Total render commits across the whole profile. */
  totalRenders: number;
  /** The `--budget` ceiling in ms, or `null` when no gate was set. */
  budget: number | null;
  /** Components whose average exceeded the budget (across the whole profile). */
  overBudget: ComponentStat[];
}

/** A baseline comparison ready to be printed. */
export interface DiffReport {
  profile: string;
  baseline: string;
  threshold: number;
  rows: DiffRow[];
}

type Align = 'left' | 'right';
type Paint = (text: string) => string;

interface Column {
  header: string;
  align: Align;
}

interface Cell {
  text: string;
  paint?: Paint;
}

const formatMs = (n: number): string => n.toFixed(2);
const round2 = (n: number): number => Math.round(n * 100) / 100;
const roundOrNull = (n: number | null): number | null => (n === null ? null : round2(n));
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

function pad(text: string, width: number, align: Align): string {
  return align === 'right' ? text.padStart(width) : text.padEnd(width);
}

/** Lay out a fixed-width table. Widths come from plain text; color is applied after padding. */
function renderTable(columns: Column[], rows: Cell[][], colors: Colors): string[] {
  const widths = columns.map((col, i) =>
    Math.max(col.header.length, ...rows.map((row) => row[i].text.length)),
  );

  const line = (cells: string[]): string => `  ${cells.join('  ')}`;
  const lines: string[] = [];
  lines.push(line(columns.map((col, i) => colors.dim(pad(col.header, widths[i], col.align)))));
  lines.push(line(widths.map((width) => colors.dim('─'.repeat(width)))));
  for (const row of rows) {
    lines.push(
      line(
        row.map((cell, i) => {
          const padded = pad(cell.text, widths[i], columns[i].align);
          return cell.paint ? cell.paint(padded) : padded;
        }),
      ),
    );
  }
  return lines;
}

/** Pick a heat color from a 0..1 cost ratio: hotter (slower) is redder. */
function heatPaint(ratio: number, colors: Colors): Paint {
  if (ratio >= 0.75) {
    return colors.red;
  }
  if (ratio >= 0.5) {
    return colors.yellow;
  }
  if (ratio >= 0.25) {
    return colors.cyan;
  }
  return colors.green;
}

const RANK_COLUMNS: Column[] = [
  { header: '#', align: 'right' },
  { header: 'component', align: 'left' },
  { header: 'avg ms', align: 'right' },
  { header: 'max ms', align: 'right' },
  { header: 'renders', align: 'right' },
  { header: 'm/u', align: 'right' },
  { header: 'total ms', align: 'right' },
];

function renderRankingText(report: RankReport, colors: Colors): string {
  const { profile, ranked, totalComponents, totalRenders, budget, overBudget } = report;

  const showing = ranked.length < totalComponents ? ` (showing top ${ranked.length})` : '';
  const heading = `${colors.bold(profile)} ${colors.dim(
    `— ${plural(totalComponents, 'component')}, ${plural(totalRenders, 'render')}${showing}`,
  )}`;

  if (ranked.length === 0) {
    return `${heading}\n\n  ${colors.dim('no components to show')}`;
  }

  const maxAvg = Math.max(...ranked.map((stat) => stat.avg));
  const rows: Cell[][] = ranked.map((stat, index) => {
    const ratio = maxAvg > 0 ? stat.avg / maxAvg : 0;
    const paint = heatPaint(ratio, colors);
    return [
      { text: String(index + 1), paint: colors.dim },
      { text: stat.id, paint },
      { text: formatMs(stat.avg), paint },
      { text: formatMs(stat.max) },
      { text: String(stat.renders) },
      { text: `${stat.mounts}/${stat.updates}`, paint: colors.dim },
      { text: formatMs(stat.total) },
    ];
  });

  const lines = [heading, '', ...renderTable(RANK_COLUMNS, rows, colors)];

  if (budget !== null) {
    lines.push('');
    if (overBudget.length > 0) {
      const names = overBudget.map((stat) => stat.id).join(', ');
      lines.push(
        colors.red(
          `  ✗ ${plural(overBudget.length, 'component')} over the ${formatMs(budget)} ms budget: ${names}`,
        ),
      );
    } else {
      lines.push(colors.green(`  ✓ every component is within the ${formatMs(budget)} ms budget`));
    }
  }

  return lines.join('\n');
}

function renderRankingJson(report: RankReport): string {
  return JSON.stringify(
    {
      profile: report.profile,
      components: report.totalComponents,
      renders: report.totalRenders,
      sort: report.sort,
      budget: report.budget,
      overBudget: report.overBudget.map((stat) => stat.id),
      ranked: report.ranked.map((stat) => ({
        id: stat.id,
        renders: stat.renders,
        mounts: stat.mounts,
        updates: stat.updates,
        avg: round2(stat.avg),
        max: round2(stat.max),
        total: round2(stat.total),
        base: round2(stat.base),
      })),
    },
    null,
    2,
  );
}

/** Render a ranking as a colored table or a JSON document. */
export function renderRanking(report: RankReport, options: RenderOptions): string {
  return options.json ? renderRankingJson(report) : renderRankingText(report, options.colors);
}

const DIFF_COLUMNS: Column[] = [
  { header: 'component', align: 'left' },
  { header: 'baseline', align: 'right' },
  { header: 'current', align: 'right' },
  { header: 'Δ ms', align: 'right' },
  { header: '%', align: 'right' },
  { header: 'status', align: 'left' },
];

const STATUS_SYMBOL: Record<DiffStatus, string> = {
  added: '+',
  removed: '−',
  regressed: '▲',
  improved: '▽',
  same: '·',
};

const STATUS_PAINT: Record<DiffStatus, (colors: Colors) => Paint> = {
  added: (colors) => colors.cyan,
  removed: (colors) => colors.magenta,
  regressed: (colors) => colors.red,
  improved: (colors) => colors.green,
  same: (colors) => colors.dim,
};

const msOrDash = (value: number | null): string => (value === null ? '–' : formatMs(value));

function deltaText(delta: number | null): string {
  if (delta === null) {
    return '–';
  }
  const sign = delta > 0 ? '+' : '';
  return `${sign}${formatMs(delta)}`;
}

function pctText(pct: number | null): string {
  if (pct === null) {
    return '–';
  }
  const sign = pct > 0 ? '+' : '';
  return `${sign}${Math.round(pct)}%`;
}

function renderDiffText(report: DiffReport, colors: Colors): string {
  const { profile, baseline, threshold, rows } = report;

  const heading = `${colors.bold(profile)} ${colors.dim(`— diff vs ${baseline}`)}`;

  const cells: Cell[][] = rows.map((row) => {
    const paint = STATUS_PAINT[row.status](colors);
    return [
      { text: row.id, paint: row.status === 'same' ? colors.dim : undefined },
      { text: msOrDash(row.baseline) },
      { text: msOrDash(row.current) },
      { text: deltaText(row.delta), paint },
      { text: pctText(row.pct), paint },
      { text: `${STATUS_SYMBOL[row.status]} ${row.status}`, paint },
    ];
  });

  const regressions = rows.filter((row) => row.status === 'regressed').length;
  const lines = [heading, '', ...renderTable(DIFF_COLUMNS, cells, colors), ''];
  if (regressions > 0) {
    lines.push(
      colors.red(`  ✗ ${plural(regressions, 'component')} slower by more than ${formatMs(threshold)} ms`),
    );
  } else {
    lines.push(colors.green(`  ✓ no regressions beyond ${formatMs(threshold)} ms`));
  }

  return lines.join('\n');
}

function renderDiffJson(report: DiffReport): string {
  return JSON.stringify(
    {
      profile: report.profile,
      baseline: report.baseline,
      threshold: report.threshold,
      rows: report.rows.map((row) => ({
        id: row.id,
        baseline: roundOrNull(row.baseline),
        current: roundOrNull(row.current),
        delta: roundOrNull(row.delta),
        pct: roundOrNull(row.pct),
        status: row.status,
      })),
    },
    null,
    2,
  );
}

/** Render a baseline comparison as a colored table or a JSON document. */
export function renderDiff(report: DiffReport, options: RenderOptions): string {
  return options.json ? renderDiffJson(report) : renderDiffText(report, options.colors);
}
