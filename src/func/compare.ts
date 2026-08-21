// Treats an absent key and an explicit `undefined` as equal. The dialogs set
// readMoreUrl to undefined rather than deleting it, so a JSON.stringify comparison
// would report a change where there is none.
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  const objectA = a as Record<string, unknown>;
  const objectB = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(objectA), ...Object.keys(objectB)]);

  for (const key of keys) {
    if (!deepEqual(objectA[key], objectB[key])) return false;
  }
  return true;
}

export { deepEqual };
