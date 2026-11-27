// Age bands belong to each player (ADR 0008).
export type Band = 'little' | 'kids' | 'tweens' | 'teens' | 'grownups';

export interface BandInfo {
  id: Band;
  label: string;
  ages: string;
  /** Points multiplier so mixed ages can tie (starting values, tuned in playtests). */
  multiplier: number;
}

export const BANDS: readonly BandInfo[] = [
  { id: 'little', label: 'Little', ages: '3–5', multiplier: 3 },
  { id: 'kids', label: 'Kids', ages: '6–8', multiplier: 2 },
  { id: 'tweens', label: 'Tweens', ages: '9–12', multiplier: 1.5 },
  { id: 'teens', label: 'Teens', ages: '13–17', multiplier: 1.2 },
  { id: 'grownups', label: 'Grown-ups', ages: '18+', multiplier: 1 },
];

export const BAND_IDS: readonly Band[] = BANDS.map((b) => b.id);

export function isBand(x: unknown): x is Band {
  return typeof x === 'string' && (BAND_IDS as readonly string[]).includes(x);
}

/** Youngest first; used to find the room's spice cap. */
export function bandRank(b: Band): number {
  return BAND_IDS.indexOf(b);
}
