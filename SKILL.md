---
name: react-render-cost
description: Use when a user wants to find which React components are slowest to render, gate render performance in CI, or compare render cost between two runs — a Node CLI that ranks components by average render cost from React `<Profiler>` (onRender) JSON. Node >= 18. Works with any React 16.9+ app (needs Profiler data, not a specific React version).
---

# react-render-cost

A Node CLI (and small library) that reads a React `<Profiler>` capture — the `onRender` arguments dumped to JSON — and ranks components by average render cost (`actualDuration`). Reach for it when someone wants to know *which* components are expensive, wants to fail CI when a component gets too slow, or wants to diff render cost before vs after a change. It does not instrument or run the app; it analyzes profiler data the user has already captured.

## When to reach for this

User says:
- "Which of my React components are the slowest to render?"
- "Rank my components by render cost / render time."
- "Fail CI if any component renders slower than X ms."
- "Did my refactor make rendering faster or slower?" (diff two profiles)

User does NOT mean this when they ask for:
- ❌ Bundle / download size of components → that's a bundle-size analyzer, not this.
- ❌ Live in-app profiling UI → that's the React DevTools Profiler; this is a CLI for captured data.
- ❌ Capturing the data for them → they wrap their tree in `<Profiler onRender>` and dump the args to JSON first (see below).

## Install

```bash
pnpm add -g react-render-cost   # installs `react-render-cost` and the short alias `rrc`
# pnpm dlx react-render-cost profile.json   # run once without installing
```

## Most common pattern (95% of cases)

1. Capture samples in the app:

```tsx
import { Profiler } from 'react';
const samples = [];
const record = (id, phase, actualDuration, baseDuration, startTime, commitTime) =>
  samples.push({ id, phase, actualDuration, baseDuration, startTime, commitTime });
// <Profiler id="Whatever" onRender={record}> ... </Profiler>
// then write `samples` to profile.json
```

2. Rank them:

```bash
react-render-cost profile.json
react-render-cost profile.json --budget 10          # exit 1 if any avg > 10ms (CI gate)
react-render-cost profile.json --baseline main.json # diff vs a saved run
```

Input is a bare JSON array of samples, or `{ "samples": [ ... ] }`. `-` reads stdin.

## API / flags

| Flag | What it does |
| --- | --- |
| `<profile>` | Profiler JSON path, or `-` for stdin (required). |
| `-b, --baseline <file>` | Diff mode: show per-component delta vs a baseline; exits 1 on any regression. |
| `-s, --sort <key>` | `avg` (default) · `total` · `max` · `renders` · `base`. |
| `-t, --top <n>` | Show only the N costliest. |
| `-m, --min <ms>` | Hide components averaging below `<ms>`. |
| `--budget <ms>` | Exit 1 if any component's average exceeds `<ms>`. |
| `--threshold <ms>` | Diff noise floor (default `0.1`). |
| `-j, --json` | Machine-readable JSON output. |
| `--no-color` | Disable ANSI (also respects `NO_COLOR`). |

Library exports (same package): `parseSamples`, `aggregate`, `rank`, `diff`, `renderRanking`, `renderDiff`, `createColors`, `run`.

## Gotchas worth knowing

1. **`avg` is `actualDuration`, not wall-clock time-in-app.** A component with a tiny average but a big `renders`/update count can still dominate `total` — sort by `total` to catch those.
2. **`--budget` and `--baseline` both change the exit code** (1 on over-budget / on any regression). That's the point in CI, but it means a scripted run can "fail" even though the table printed fine — check the code, or drop the gate flags for a plain report.
3. **Phases matter:** `mount` is one-time; the render cost that hurts is usually repeated `update`/`nested-update`. The `m/u` column and `renders` count surface that.

## Links

- npm / install: `pnpm add -g react-render-cost`
- demo / landing: https://react-render-cost.vercel.app
- repo: https://github.com/kea0811/react-render-cost
