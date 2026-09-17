import {
  resolveBackTarget,
  getRoleScreen,
  resetAuthHistory,
  canAccessAdminScreen,
  pushScreenHistory,
  popScreenHistory,
} from '../src/utils/navigation';

describe('navigation helpers', () => {
  it('keeps a valid back target', () => {
    expect(resolveBackTarget('profile')).toBe('profile');
  });

  it('falls back to home when the target is empty', () => {
    expect(resolveBackTarget('   ')).toBe('home');
    expect(resolveBackTarget('')).toBe('home');
    expect(resolveBackTarget(null)).toBe('home');
  });

  it('routes admin and regular users to the correct landing screen', () => {
    expect(getRoleScreen('admin')).toBe('admin');
    expect(getRoleScreen('user')).toBe('home');
  });

  it('resets auth history to login after logout', () => {
    expect(resetAuthHistory()).toEqual(['login']);
    expect(canAccessAdminScreen('admin')).toBe(true);
    expect(canAccessAdminScreen('user')).toBe(false);
  });

  it('keeps admin user mode from creating duplicate dashboard history entries', () => {
    expect(pushScreenHistory(['login', 'admin'], 'home')).toEqual(['login', 'admin', 'home']);
    expect(popScreenHistory(['login', 'admin', 'home'])).toEqual(['login', 'admin']);
    expect(pushScreenHistory(['login', 'admin', 'home'], 'admin')).toEqual(['login', 'admin']);
  });
});
