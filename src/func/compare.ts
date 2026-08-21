// Structural comparison for the plain JSON trees fetched from R2. Two properties
// matter here and JSON.stringify comparison has neither:
//
//   1. Key order is irrelevant. Every edit path rebuilds objects with {...prev}, and
//      a spread that reorders keys would otherwise register as an unsaved change.
//   2. An absent key equals an explicit `undefined`, which is how the dialogs clear
//      readMoreUrl. (JSON.stringify happens to agree here — it omits undefined-valued
//      keys — so it is key order, not this, that rules stringify out.)
//
// Plain JSON only: NaN, Date, Map, Set and RegExp are not handled and would compare
// as equal-if-empty. Nothing in PortfolioData holds any of them.
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
