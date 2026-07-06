import { run } from '../src/cli.js';
import type { RunDeps } from '../src/deps.js';

const ESC = String.fromCharCode(27);

interface Harness {
  deps: RunDeps;
  out: string[];
  err: string[];
  stdout: () => string;
  stderr: () => string;
}

function harness(files: Record<string, string>, env: Record<string, string | undefined> = {}): Harness {
  const out: string[] = [];
  const err: string[] = [];
  const deps: RunDeps = {
    log: (message) => out.push(message),
    error: (message) => err.push(message),
    readFile: (path) => {
      if (!(path in files)) {
        throw new Error(`ENOENT: no such file, open '${path}'`);
      }
      return files[path];
    },
    env,
  };
  return { deps, out, err, stdout: () => out.join('\n'), stderr: () => err.join('\n') };
}

const PROFILE = JSON.stringify([
  { id: 'Slow', phase: 'mount', actualDuration: 12, baseDuration: 10 },
  { id: 'Slow', phase: 'update', actualDuration: 8, baseDuration: 7 },
  { id: 'Mid', phase: 'mount', actualDuration: 4, baseDuration: 4 },
  { id: 'Fast', phase: 'mount', actualDuration: 1, baseDuration: 1 },
]);

const BASELINE = JSON.stringify([
  { id: 'Slow', phase: 'mount', actualDuration: 4, baseDuration: 4 },
  { id: 'Mid', phase: 'mount', actualDuration: 4, baseDuration: 4 },
  { id: 'Fast', phase: 'mount', actualDuration: 1, baseDuration: 1 },
]);

describe('run — ranking', () => {
  it('prints a ranking and exits 0', async () => {
    const h = harness({ 'p.json': PROFILE });
    const code = await run(['p.json'], h.deps);
    expect(code).toBe(0);
    expect(h.stdout()).toContain('Slow');
    expect(h.stdout()).toContain('component');
  });

  it('colors output by default', async () => {
    const h = harness({ 'p.json': PROFILE });
    await run(['p.json'], h.deps);
    expect(h.stdout()).toContain(ESC);
  });

  it('honours --no-color', async () => {
    const h = harness({ 'p.json': PROFILE });
    await run(['p.json', '--no-color'], h.deps);
    expect(h.stdout()).not.toContain(ESC);
  });

  it('honours the NO_COLOR env var', async () => {
    const h = harness({ 'p.json': PROFILE }, { NO_COLOR: '1' });
    await run(['p.json'], h.deps);
    expect(h.stdout()).not.toContain(ESC);
  });

  it('emits JSON with --json', async () => {
    const h = harness({ 'p.json': PROFILE });
    const code = await run(['p.json', '--json'], h.deps);
    expect(code).toBe(0);
    const parsed = JSON.parse(h.stdout());
    expect(parsed.components).toBe(3);
    expect(parsed.renders).toBe(4);
    expect(parsed.ranked[0].id).toBe('Slow');
  });

  it('sorts by an alternate key', async () => {
    const h = harness({ 'p.json': PROFILE });
    await run(['p.json', '--sort', 'renders', '--json'], h.deps);
    expect(JSON.parse(h.stdout()).sort).toBe('renders');
  });

  it('caps with --top', async () => {
    const h = harness({ 'p.json': PROFILE });
    await run(['p.json', '--top', '1', '--json'], h.deps);
    expect(JSON.parse(h.stdout()).ranked).toHaveLength(1);
  });

  it('filters with --min', async () => {
    const h = harness({ 'p.json': PROFILE });
    await run(['p.json', '--min', '5', '--json'], h.deps);
    expect(JSON.parse(h.stdout()).ranked.map((r: { id: string }) => r.id)).toEqual(['Slow']);
  });

  it('fails the budget gate and exits 1', async () => {
    const h = harness({ 'p.json': PROFILE });
    const code = await run(['p.json', '--budget', '8', '--no-color'], h.deps);
    expect(code).toBe(1);
    expect(h.stdout()).toContain('over the 8.00 ms budget');
  });

  it('passes the budget gate and exits 0', async () => {
    const h = harness({ 'p.json': PROFILE });
    const code = await run(['p.json', '--budget', '100'], h.deps);
    expect(code).toBe(0);
  });
});

describe('run — diff', () => {
  it('diffs against a baseline and exits 1 on a regression', async () => {
    const h = harness({ 'p.json': PROFILE, 'base.json': BASELINE });
    const code = await run(['p.json', '--baseline', 'base.json', '--no-color'], h.deps);
    expect(code).toBe(1);
    expect(h.stdout()).toContain('diff vs base.json');
    expect(h.stdout()).toContain('regressed');
  });

  it('exits 0 when the baseline matches (no regressions)', async () => {
    const h = harness({ 'p.json': PROFILE, 'base.json': PROFILE });
    const code = await run(['p.json', '--baseline', 'base.json'], h.deps);
    expect(code).toBe(0);
  });

  it('emits diff JSON', async () => {
    const h = harness({ 'p.json': PROFILE, 'base.json': BASELINE });
    await run(['p.json', '--baseline', 'base.json', '--json'], h.deps);
    expect(JSON.parse(h.stdout()).baseline).toBe('base.json');
  });

  it('errors when the baseline file is unreadable', async () => {
    const h = harness({ 'p.json': PROFILE });
    const code = await run(['p.json', '--baseline', 'nope.json'], h.deps);
    expect(code).toBe(2);
    expect(h.stderr()).toContain('cannot read baseline');
  });
});

describe('run — errors and meta', () => {
  it('errors on a missing profile', async () => {
    const h = harness({});
    const code = await run(['missing.json'], h.deps);
    expect(code).toBe(2);
    expect(h.stderr()).toContain('cannot analyze');
  });

  it('errors on invalid JSON', async () => {
    const h = harness({ 'p.json': 'not json' });
    const code = await run(['p.json'], h.deps);
    expect(code).toBe(2);
    expect(h.stderr()).toContain('not valid JSON');
  });

  it('errors on an empty profile', async () => {
    const h = harness({ 'p.json': '[]' });
    const code = await run(['p.json'], h.deps);
    expect(code).toBe(2);
    expect(h.stderr()).toContain('no render samples');
  });

  it('rejects a non-positive --top', async () => {
    const h = harness({ 'p.json': PROFILE });
    expect(await run(['p.json', '--top', '0'], h.deps)).toBe(1);
  });

  it('rejects a non-numeric --top', async () => {
    const h = harness({ 'p.json': PROFILE });
    expect(await run(['p.json', '--top', 'abc'], h.deps)).toBe(1);
  });

  it('rejects a negative --min', async () => {
    const h = harness({ 'p.json': PROFILE });
    expect(await run(['p.json', '--min', '-1'], h.deps)).toBe(1);
  });

  it('rejects a non-numeric --min', async () => {
    const h = harness({ 'p.json': PROFILE });
    expect(await run(['p.json', '--min', 'abc'], h.deps)).toBe(1);
  });

  it('rejects a non-positive --budget', async () => {
    const h = harness({ 'p.json': PROFILE });
    expect(await run(['p.json', '--budget', '0'], h.deps)).toBe(1);
  });

  it('rejects a non-numeric --budget', async () => {
    const h = harness({ 'p.json': PROFILE });
    expect(await run(['p.json', '--budget', 'abc'], h.deps)).toBe(1);
  });

  it('rejects a negative --threshold', async () => {
    const h = harness({ 'p.json': PROFILE, 'base.json': BASELINE });
    expect(await run(['p.json', '--baseline', 'base.json', '--threshold', '-1'], h.deps)).toBe(1);
  });

  it('rejects an unknown --sort key', async () => {
    const h = harness({ 'p.json': PROFILE });
    expect(await run(['p.json', '--sort', 'sideways'], h.deps)).toBe(1);
  });

  it('exits 0 for --help', async () => {
    const h = harness({ 'p.json': PROFILE });
    expect(await run(['--help'], h.deps)).toBe(0);
    expect(h.stdout()).toContain('Examples:');
  });

  it('exits 0 for --version', async () => {
    const h = harness({ 'p.json': PROFILE });
    expect(await run(['--version'], h.deps)).toBe(0);
    expect(h.stdout()).toContain('0.1.0');
  });

  it('exits non-zero when the required argument is missing', async () => {
    const h = harness({ 'p.json': PROFILE });
    expect(await run([], h.deps)).toBe(1);
  });
});
