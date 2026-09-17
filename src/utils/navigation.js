export function resolveBackTarget(target = 'home') {
  return target && String(target).trim() ? String(target).trim() : 'home';
}

export function pushScreenHistory(history = [], nextScreen) {
  const target = resolveBackTarget(nextScreen);
  if (!history.length) return [target];
  const previous = history[history.length - 1];
  if (previous === target) return history;
  return [...history, target];
}

export function popScreenHistory(history = []) {
  if (!Array.isArray(history) || history.length <= 1) return history.length ? [history[0] || 'home'] : ['home'];
  return history.slice(0, -1);
}
