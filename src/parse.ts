import type { RenderPhase, RenderSample } from './types.js';

/** Thrown when the input can't be read as a list of render samples. */
export class ParseError extends Error {
  override name = 'ParseError';
}

const PHASES: readonly RenderPhase[] = ['mount', 'update', 'nested-update'];

function isPhase(value: unknown): value is RenderPhase {
  return typeof value === 'string' && PHASES.includes(value as RenderPhase);
}

/** Read a required, non-negative millisecond field. JSON numbers are always finite. */
function readDuration(record: Record<string, unknown>, key: string, where: string): number {
  const value = record[key];
  if (typeof value !== 'number' || value < 0) {
    throw new ParseError(`${where} has an invalid "${key}": expected a non-negative number.`);
  }
  return value;
}

/** Read an optional timestamp field, defaulting to 0 when it's absent. */
function readTimestamp(record: Record<string, unknown>, key: string, where: string): number {
  const value = record[key];
  if (value === undefined) {
    return 0;
  }
  if (typeof value !== 'number') {
    throw new ParseError(`${where} has an invalid "${key}": expected a number.`);
  }
  return value;
}

function normalize(item: unknown, index: number): RenderSample {
  const where = `sample #${index}`;
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    throw new ParseError(`${where} is not an object.`);
  }
  const record = item as Record<string, unknown>;

  const id = record.id;
  if (typeof id !== 'string' || id.length === 0) {
    throw new ParseError(`${where} is missing a non-empty string "id".`);
  }

  if (!isPhase(record.phase)) {
    throw new ParseError(
      `${where} ("${id}") has an invalid "phase": expected mount, update, or nested-update.`,
    );
  }

  return {
    id,
    phase: record.phase,
    actualDuration: readDuration(record, 'actualDuration', `${where} ("${id}")`),
    baseDuration: readDuration(record, 'baseDuration', `${where} ("${id}")`),
    startTime: readTimestamp(record, 'startTime', `${where} ("${id}")`),
    commitTime: readTimestamp(record, 'commitTime', `${where} ("${id}")`),
  };
}

/**
 * Parse a Profiler capture into {@link RenderSample}s. Accepts either a bare
 * JSON array of samples or an object of the shape `{ "samples": [...] }` (the
 * two shapes real capture snippets tend to produce).
 */
export function parseSamples(raw: string): RenderSample[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new ParseError('Input is not valid JSON.');
  }

  const list = Array.isArray(data)
    ? data
    : (data as { samples?: unknown } | null)?.samples;

  if (!Array.isArray(list)) {
    throw new ParseError(
      'Expected a JSON array of render samples, or an object with a "samples" array.',
    );
  }

  return list.map(normalize);
}
