import { createColors } from '../src/color.js';

const ESC = String.fromCharCode(27);

describe('createColors', () => {
  it('wraps text in ANSI codes when enabled', () => {
    const c = createColors(true);
    for (const paint of [c.red, c.green, c.yellow, c.cyan, c.magenta, c.dim, c.bold]) {
      const painted = paint('hi');
      expect(painted).toContain(ESC);
      expect(painted).toContain('hi');
      expect(painted).not.toBe('hi');
    }
  });

  it('is the identity when disabled', () => {
    const c = createColors(false);
    for (const paint of [c.red, c.green, c.yellow, c.cyan, c.magenta, c.dim, c.bold]) {
      expect(paint('hi')).toBe('hi');
    }
  });
});
