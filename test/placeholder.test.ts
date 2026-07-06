import { name } from '../src/index.js';

describe('scaffold', () => {
  it('exposes the package name', () => {
    expect(name).toBe('react-render-cost');
  });
});
