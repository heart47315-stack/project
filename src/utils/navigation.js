export function resolveBackTarget(target = 'home') {
  return target && String(target).trim() ? String(target).trim() : 'home';
}

export function getRoleScreen(role) {
  return role === 'admin' ? 'admin' : 'home';
}

export function resetAuthHistory() {
  return ['login'];
}

export function canAccessAdminScreen(role) {
  return role === 'admin';
}

export function pushScreenHistory(history = [], nextScreen) {
  const target = resolveBackTarget(nextScreen);
  const safeHistory = Array.isArray(history) ? history.filter((screen) => screen && typeof screen === 'string') : [];

  if (!safeHistory.length) return [target];

  const previous = safeHistory[safeHistory.length - 1];
  if (previous === target) return safeHistory;

  const previousIndex = safeHistory.lastIndexOf(target);
  if (previousIndex !== -1) {
    return safeHistory.slice(0, previousIndex + 1);
  }

  return [...safeHistory, target];
}

export function popScreenHistory(history = []) {
  if (!Array.isArray(history) || history.length <= 1) return history.length ? [history[0] || 'home'] : ['home'];
  return history.slice(0, -1);
}
