/**
 * PRNG determinista (mulberry32).
 *
 * El trazo se guarda como datos, no como píxeles: al re-renderizar un cuadro
 * (onion skin, export, undo) la aleatoriedad debe repetirse exactamente. Por
 * eso cada trazo guarda su semilla.
 */
export interface Rng {
  next(): number;
  range(min: number, max: number): number;
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - max + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
  };
}
