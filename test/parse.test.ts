import { ParseError, parseSamples } from '../src/parse.js';

const one = (extra: Record<string, unknown> = {}) =>
  JSON.stringify([{ id: 'A', phase: 'mount', actualDuration: 1, baseDuration: 1, ...extra }]);

describe('parseSamples', () => {
  it('parses a bare array of samples', () => {
    const samples = parseSamples(one({ startTime: 3, commitTime: 5 }));
    expect(samples).toEqual([
      { id: 'A', phase: 'mount', actualDuration: 1, baseDuration: 1, startTime: 3, commitTime: 5 },
    ]);
  });

  it('parses an object with a "samples" array', () => {
    const raw = JSON.stringify({ samples: [{ id: 'A', phase: 'update', actualDuration: 2, baseDuration: 2 }] });
    const samples = parseSamples(raw);
    expect(samples).toHaveLength(1);
    expect(samples[0].phase).toBe('update');
  });

  it('defaults startTime/commitTime to 0 when absent', () => {
    const [sample] = parseSamples(one());
    expect(sample.startTime).toBe(0);
    expect(sample.commitTime).toBe(0);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseSamples('not json')).toThrow(ParseError);
    expect(() => parseSamples('not json')).toThrow(/not valid JSON/);
  });

  it('throws when the top level is neither an array nor a { samples } object', () => {
    expect(() => parseSamples('42')).toThrow(/Expected a JSON array/);
    expect(() => parseSamples(JSON.stringify({ other: [] }))).toThrow(/Expected a JSON array/);
  });

  it('throws on a null top level (optional-chain guard)', () => {
    expect(() => parseSamples('null')).toThrow(/Expected a JSON array/);
  });

  it('rejects a non-object sample', () => {
    expect(() => parseSamples('[42]')).toThrow(/sample #0 is not an object/);
  });

  it('rejects an array masquerading as a sample', () => {
    expect(() => parseSamples('[[]]')).toThrow(/sample #0 is not an object/);
  });

  it('rejects a missing or empty id', () => {
    expect(() => parseSamples('[{"phase":"mount","actualDuration":1,"baseDuration":1}]')).toThrow(/"id"/);
    expect(() => parseSamples('[{"id":"","phase":"mount","actualDuration":1,"baseDuration":1}]')).toThrow(/"id"/);
  });

  it('rejects an invalid phase', () => {
    expect(() => parseSamples('[{"id":"A","phase":"paint","actualDuration":1,"baseDuration":1}]')).toThrow(
      /invalid "phase"/,
    );
  });

  it('rejects a non-number duration', () => {
    expect(() => parseSamples('[{"id":"A","phase":"mount","actualDuration":"x","baseDuration":1}]')).toThrow(
      /"actualDuration"/,
    );
  });

  it('rejects a negative duration', () => {
    expect(() => parseSamples('[{"id":"A","phase":"mount","actualDuration":-1,"baseDuration":1}]')).toThrow(
      /"actualDuration"/,
    );
  });

  it('rejects an invalid baseDuration', () => {
    expect(() => parseSamples('[{"id":"A","phase":"mount","actualDuration":1,"baseDuration":"x"}]')).toThrow(
      /"baseDuration"/,
    );
  });

  it('rejects a non-number timestamp', () => {
    expect(() => parseSamples(one({ startTime: 'soon' }))).toThrow(/"startTime"/);
  });

  it('accepts nested-update as a phase', () => {
    const [sample] = parseSamples(one({ phase: 'nested-update' }));
    expect(sample.phase).toBe('nested-update');
  });
});
