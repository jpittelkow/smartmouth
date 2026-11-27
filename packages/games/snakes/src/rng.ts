// A small seeded random number generator (mulberry32). The state lives in the game state, so the rules stay pure
// and a game replays exactly from its seed (ADR 0023).

/** The next number in [0, 1) and the next state. */
export function next(state: number): [number, number] {
  let t = (state + 0x6d2b79f5) | 0;
  const nextState = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, nextState];
}

/** A random whole number in [0, n), and the next state. */
export function int(state: number, n: number): [number, number] {
  const [r, s] = next(state);
  return [Math.floor(r * n), s];
}

/** One item picked at random, and the next state. */
export function pick<T>(state: number, items: readonly T[]): [T | undefined, number] {
  if (items.length === 0) return [undefined, state];
  const [i, s] = int(state, items.length);
  return [items.at(i), s];
}

/** A shuffled copy, and the next state. */
export function shuffle<T>(state: number, items: readonly T[]): [T[], number] {
  const out = [...items];
  let s = state;
  for (let i = out.length - 1; i > 0; i--) {
    let j: number;
    [j, s] = int(s, i + 1);
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return [out, s];
}
