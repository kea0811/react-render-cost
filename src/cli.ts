import { Command, type CommanderError, InvalidArgumentError, Option } from 'commander';
import { aggregate } from './aggregate.js';
import { type Colors, createColors } from './color.js';
import type { RunDeps } from './deps.js';
import { diff } from './diff.js';
import { parseSamples } from './parse.js';
import { rank } from './rank.js';
import { type DiffReport, type RankReport, renderDiff, renderRanking } from './render.js';
import type { ComponentStat, SortKey } from './types.js';

const VERSION = '0.1.0';

const DESCRIPTION = 'Rank React components by average render cost from Profiler data.';

const SORT_KEYS: SortKey[] = ['avg', 'total', 'max', 'renders', 'base'];

const HELP_EXAMPLES = `
Examples:
  $ react-render-cost profile.json
  $ react-render-cost profile.json --top 10 --sort total
  $ react-render-cost profile.json --budget 8          # exit 1 if any component is slower
  $ react-render-cost profile.json --baseline main.json    # diff two runs
  $ react-render-cost profile.json --min 0.5 --json
  $ cat profile.json | react-render-cost -

Capture a profile by wrapping your tree in <Profiler onRender={...}> and dumping
each call's arguments to a JSON array.
`;

interface CliOptions {
  baseline?: string;
  sort: string;
  top?: number;
  min?: number;
  budget?: number;
  threshold: number;
  json?: boolean;
  color?: boolean;
}

const trimTrailingNewline = (text: string): string => text.replace(/\n+$/, '');

/** Parse a `--top` value, rejecting anything that isn't a positive integer. */
function parsePositiveInt(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new InvalidArgumentError('must be a positive integer');
  }
  return n;
}

/** Parse a millisecond value that must be zero or greater. */
function parseNonNegative(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new InvalidArgumentError('must be a non-negative number');
  }
  return n;
}

/** Parse a millisecond value that must be strictly positive. */
function parsePositive(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new InvalidArgumentError('must be a positive number');
  }
  return n;
}

/** Read + parse one capture, aggregating it into per-component stats. */
function loadStats(path: string, deps: RunDeps): ComponentStat[] {
  return aggregate(parseSamples(deps.readFile(path)));
}

function runRanking(
  profile: string,
  stats: ComponentStat[],
  options: CliOptions,
  deps: RunDeps,
  colors: Colors,
): number {
  const sort = options.sort as SortKey;
  const ranked = rank(stats, { sort, top: options.top, min: options.min });

  const budget = options.budget ?? null;
  let overBudget: ComponentStat[] = [];
  if (budget !== null) {
    const ceiling = budget;
    overBudget = stats.filter((stat) => stat.avg > ceiling).sort((a, b) => b.avg - a.avg);
  }

  const report: RankReport = {
    profile,
    sort,
    ranked,
    totalComponents: stats.length,
    totalRenders: stats.reduce((sum, stat) => sum + stat.renders, 0),
    budget,
    overBudget,
  };

  deps.log(renderRanking(report, { json: options.json === true, colors }));
  return overBudget.length > 0 ? 1 : 0;
}

function runDiff(
  profile: string,
  stats: ComponentStat[],
  baselinePath: string,
  options: CliOptions,
  deps: RunDeps,
  colors: Colors,
): number {
  let baseStats: ComponentStat[];
  try {
    baseStats = loadStats(baselinePath, deps);
  } catch (err) {
    deps.error(colors.red(`error: cannot read baseline ${baselinePath}: ${(err as Error).message}`));
    return 2;
  }

  const rows = diff(stats, baseStats, options.threshold);
  const report: DiffReport = { profile, baseline: baselinePath, threshold: options.threshold, rows };
  deps.log(renderDiff(report, { json: options.json === true, colors }));

  return rows.some((row) => row.status === 'regressed') ? 1 : 0;
}

function execute(profile: string, options: CliOptions, deps: RunDeps, colors: Colors): number {
  let stats: ComponentStat[];
  try {
    stats = loadStats(profile, deps);
  } catch (err) {
    deps.error(colors.red(`error: cannot analyze ${profile}: ${(err as Error).message}`));
    return 2;
  }

  if (stats.length === 0) {
    deps.error(colors.red('error: no render samples found in the profile.'));
    return 2;
  }

  if (options.baseline !== undefined) {
    return runDiff(profile, stats, options.baseline, options, deps, colors);
  }
  return runRanking(profile, stats, options, deps, colors);
}

/**
 * Parse `argv` (user args, without `node` and the script path) and run the CLI.
 * Returns the process exit code. Every side effect is injected via {@link RunDeps}.
 */
export async function run(argv: string[], deps: RunDeps): Promise<number> {
  let exitCode = 0;

  const program = new Command();
  program
    .name('react-render-cost')
    .description(DESCRIPTION)
    .argument('<profile>', 'path to a React Profiler JSON capture (or "-" for stdin)')
    .option('-b, --baseline <file>', 'compare against a baseline capture and show the delta')
    .addOption(
      new Option('-s, --sort <key>', 'order components by metric').choices(SORT_KEYS).default('avg'),
    )
    .addOption(
      new Option('-t, --top <n>', 'show only the N costliest components').argParser(parsePositiveInt),
    )
    .addOption(
      new Option('-m, --min <ms>', 'hide components averaging below <ms>').argParser(parseNonNegative),
    )
    .addOption(
      new Option('--budget <ms>', 'exit 1 if any component averages above <ms>').argParser(parsePositive),
    )
    .addOption(
      new Option('--threshold <ms>', 'ignore diffs smaller than <ms> in diff mode')
        .argParser(parseNonNegative)
        .default(0.1),
    )
    .option('-j, --json', 'print machine-readable JSON')
    .option('--no-color', 'disable ANSI colors (also respects the NO_COLOR env var)')
    .version(VERSION, '-v, --version', 'print the version number')
    .addHelpText('after', HELP_EXAMPLES)
    .exitOverride()
    .configureOutput({
      writeOut: (text) => deps.log(trimTrailingNewline(text)),
      writeErr: (text) => deps.error(trimTrailingNewline(text)),
    })
    .action((profile: string, options: CliOptions) => {
      const colorsEnabled = options.color !== false && !deps.env.NO_COLOR;
      exitCode = execute(profile, options, deps, createColors(colorsEnabled));
    });

  try {
    await program.parseAsync(argv, { from: 'user' });
  } catch (err) {
    // exitOverride() turns help/version/parse failures into a thrown
    // CommanderError, which always carries a numeric exit code.
    return (err as CommanderError).exitCode;
  }
  return exitCode;
}
