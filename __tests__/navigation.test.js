import { resolveBackTarget } from '../src/utils/navigation';

describe('navigation helpers', () => {
  it('keeps a valid back target', () => {
    expect(resolveBackTarget('profile')).toBe('profile');
  });

  it('falls back to home when the target is empty', () => {
    expect(resolveBackTarget('   ')).toBe('home');
    expect(resolveBackTarget('')).toBe('home');
    expect(resolveBackTarget(null)).toBe('home');
  });
});
