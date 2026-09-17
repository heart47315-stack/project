export function resolveBackTarget(target = 'home') {
  return target && String(target).trim() ? String(target).trim() : 'home';
}
