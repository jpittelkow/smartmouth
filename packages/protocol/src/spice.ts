// Spice levels (ADR 0014, design guide §3). The server never picks content above the room's level.
import { bandRank, type Band } from './bands.ts';

// Drunk (owner, 2026-11-27) sits above Filthy: Salty gets drunker as the game goes (docs/design/drunk-salty-script.md).
// Grown-ups only, so any younger player in the room caps it.
export type Spice = 'mild' | 'spicy' | 'hot' | 'filthy' | 'drunk';
export const SPICES: readonly Spice[] = ['mild', 'spicy', 'hot', 'filthy', 'drunk'];

export const SPICE_LABEL: Record<Spice, string> = {
  mild: 'Mild', spicy: 'Spicy', hot: 'Hot', filthy: 'Filthy', drunk: 'Drunk',
};

const CAP_BY_BAND: Record<Band, Spice> = {
  little: 'mild', kids: 'spicy', tweens: 'spicy', teens: 'hot', grownups: 'drunk',
};

export function isSpice(x: unknown): x is Spice {
  return typeof x === 'string' && (SPICES as readonly string[]).includes(x);
}

export function spiceRank(s: Spice): number {
  return SPICES.indexOf(s);
}

/** The highest level the youngest player present allows. An empty room allows Mild only. */
export function spiceCap(bands: readonly Band[]): Spice {
  if (bands.length === 0) return 'mild';
  let youngest = bands[0] as Band;
  for (const b of bands) if (bandRank(b) < bandRank(youngest)) youngest = b;
  return CAP_BY_BAND[youngest];
}

/** The level actually used: the lower of what a grown-up chose and the cap. */
export function effectiveSpice(chosen: Spice, bands: readonly Band[]): Spice {
  const cap = spiceCap(bands);
  return spiceRank(chosen) <= spiceRank(cap) ? chosen : cap;
}

/** True when content tagged `level` may be used at room level `room`. */
export function spiceAllows(room: Spice, level: Spice): boolean {
  return spiceRank(level) <= spiceRank(room);
}
