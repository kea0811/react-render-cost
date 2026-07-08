# react-render-cost

![tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)
![coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)
![license](https://img.shields.io/badge/license-MIT-blue.svg)

> Rank your React components by average render cost — straight from Profiler data. Find the slow ones, gate them in CI, and diff two runs to catch regressions before they ship.

You already have the numbers: React's `<Profiler>` hands you `actualDuration` on every commit. `react-render-cost` turns that firehose of samples into a ranked table — which components are actually expensive, how often they re-render, and whether a change made things worse. No flame graph spelunking, no guessing.

## For AI coding agents

Drop [`SKILL.md`](./SKILL.md) into your AI editor / Claude Code workspace and it learns how to use this tool — when to reach for it, the install + canonical pattern, the CLI flags, and the gotchas that are easy to miss.

## Install

```bash
pnpm add -g react-render-cost
# npm i -g react-render-cost   ·   yarn global add react-render-cost
```

> _Bleeding edge or before the first npm release: `pnpm add github:kea0811/react-render-cost`._

No install needed to try it once:

```bash
pnpm dlx react-render-cost profile.json
```

The binary installs as both `react-render-cost` and the shorter `rrc`.

## Capture a profile

Wrap the tree you care about in a `<Profiler>` and dump each `onRender` call into a JSON array:

```tsx
import { Profiler } from 'react';

const samples: unknown[] = [];

function record(id, phase, actualDuration, baseDuration, startTime, commitTime) {
  samples.push({ id, phase, actualDuration, baseDuration, startTime, commitTime });
}

// Flush `samples` to a file whenever it suits you (a button, an effect, on unload).
export default function App() {
  return (
    <Profiler id="MessageList" onRender={record}>
      <MessageList />
    </Profiler>
  );
}
```

`react-render-cost` reads a bare array of those samples, or an object shaped like `{ "samples": [ ... ] }`.

## Quick start

```bash
$ react-render-cost profile.json

profile.json — 5 components, 9 renders

  #  component    avg ms  max ms  renders  m/u  total ms
  ─  ───────────  ──────  ──────  ───────  ───  ────────
  1  MessageList   14.07   18.40        3  1/2     42.20
  2  Composer       5.80    6.20        2  1/1     11.60
  3  Sidebar        4.10    4.10        1  1/0      4.10
  4  Avatar         1.05    1.20        2  1/1      2.10
  5  Header         0.60    0.60        1  1/0      0.60
```

`m/u` is mounts / updates — a component with a low average but a huge update count is often the real culprit.

### Gate it in CI

`--budget` exits non-zero when any component's average blows past your ceiling, so a slow render can fail a pull request:

```bash
$ react-render-cost profile.json --budget 10 --top 3

profile.json — 5 components, 9 renders (showing top 3)

  #  component    avg ms  max ms  renders  m/u  total ms
  ─  ───────────  ──────  ──────  ───────  ───  ────────
  1  MessageList   14.07   18.40        3  1/2     42.20
  2  Composer       5.80    6.20        2  1/1     11.60
  3  Sidebar        4.10    4.10        1  1/0      4.10

  ✗ 1 component over the 10.00 ms budget: MessageList
# exit code 1
```

### Diff two runs

Point `--baseline` at a saved profile to see what moved. Regressions are flagged in red, wins in green, and the command exits non-zero if anything got slower — perfect for a before/after check on a refactor:

```bash
$ react-render-cost profile.json --baseline main.json

profile.json — diff vs main.json

  component    baseline  current   Δ ms     %  status
  ───────────  ────────  ───────  ─────  ────  ───────────
  MessageList      7.10    14.07  +6.97  +98%  ▲ regressed
  Composer         5.60     5.80  +0.20   +4%  ▲ regressed
  Sidebar          4.20     4.10  -0.10   -2%  ▽ improved
  Avatar           1.10     1.05  -0.05   -5%  · same
  Header           0.60     0.60   0.00    0%  · same

  ✗ 2 components slower by more than 0.10 ms
# exit code 1
```

## Flags

| Flag | Description |
| --- | --- |
| `<profile>` | Path to a Profiler JSON capture, or `-` to read stdin. |
| `-b, --baseline <file>` | Compare against a baseline capture and show the per-component delta. |
| `-s, --sort <key>` | Order by `avg` (default), `total`, `max`, `renders`, or `base`. |
| `-t, --top <n>` | Show only the N costliest components. |
| `-m, --min <ms>` | Hide components averaging below `<ms>` (cut the noise). |
| `--budget <ms>` | Exit `1` if any component averages above `<ms>`. |
| `--threshold <ms>` | Ignore diffs smaller than `<ms>` in diff mode (default `0.1`). |
| `-j, --json` | Print machine-readable JSON instead of a table. |
| `--no-color` | Disable ANSI colors (also respects `NO_COLOR`). |
| `-v, --version` | Print the version. |
| `-h, --help` | Show help with examples. |

### What the columns mean

- **avg ms** — mean `actualDuration` across every commit. The headline "render cost".
- **max ms** — the single slowest commit, so you can spot spiky renders.
- **renders** / **m/u** — how many commits, split into mounts vs updates.
- **total ms** — summed cost; sort by this to find what's eating the most wall-clock overall.
- **base** (JSON only) — mean `baseDuration`, the cost with memoization stripped away.

## Use it as a library

Everything the CLI does is exported, so you can build profiling into your own tooling:

```ts
import { parseSamples, aggregate, rank, diff } from 'react-render-cost';

const stats = aggregate(parseSamples(await fs.readFile('profile.json', 'utf8')));
const worst = rank(stats, { sort: 'total', top: 5 });
const moved = diff(stats, baselineStats, 0.25);
```

## JSON output

`--json` gives you a stable shape for dashboards and CI annotations:

```jsonc
{
  "profile": "profile.json",
  "components": 5,
  "renders": 9,
  "sort": "avg",
  "budget": 10,
  "overBudget": ["MessageList"],
  "ranked": [
    { "id": "MessageList", "renders": 3, "mounts": 1, "updates": 2, "avg": 14.07, "max": 18.4, "total": 42.2, "base": 12.53 }
  ]
}
```

## Contributing

Issues and PRs welcome. Local setup:

```bash
pnpm install
pnpm test          # vitest
pnpm test:coverage # 100% enforced
pnpm build         # tsup → dist/
```

## License

MIT © kea0811
