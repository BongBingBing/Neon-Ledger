// Shared helper for content modules: recursively freeze plain data.
export function freezeDeep(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.values(o).forEach(freezeDeep);
    Object.freeze(o);
  }
  return o;
}
