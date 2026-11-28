// Drunk mode (owner, 2026-11-27; docs/design/drunk-salty-script.md): the level above Filthy. Salty gets drunker as the
// game goes, in four stages, and stays drunk into the room's next game (the bar tab). Drinking noises are separate
// clips, in her own voice for the mouth sounds, played at {markers} at the start or end of a line.

/** The drunk stages: 1 Buzzed, 2 Tipsy, 3 Hammered, 4 Gone. */
export type DrunkStage = 1 | 2 | 3 | 4;

/**
 * The stage from how far through the game the room is (0 to 1) and how many Drunk games it has already finished:
 * each finished game moves the start one stage on (game 2 starts Tipsy, game 3 Hammered, game 4 on is all Gone).
 */
export function drunkStage(progress: number, gamesBefore: number): DrunkStage {
  const own = progress < 0.25 ? 1 : progress < 0.55 ? 2 : progress < 0.85 ? 3 : 4;
  return Math.min(4, own + Math.max(0, gamesBefore)) as DrunkStage;
}

/** Between games: still as drunk as the last one left her (stage 3 has the "between games" lines). */
export function lobbyStage(gamesBefore: number): DrunkStage {
  return gamesBefore <= 0 ? 1 : (Math.min(4, gamesBefore + 2) as DrunkStage);
}

/**
 * The owner's picks (auditions 3 to 5, 2026-11-27): mp3s in DATA_DIR/media/sounds/drunk, trimmed and levelled. Names
 * carry a version, because Cloudflare caches /media for a year. Where a sound has more than one clip, they rotate.
 */
const V = '20261127';
export const DRUNK_SOUNDS: Record<string, readonly string[]> = {
  sip: [`sip-1.${V}.mp3`],
  hiccup: [`hiccup-1.${V}.mp3`],
  hiccups: [`hiccups-1.${V}.mp3`],
  gulp: [`gulp-1.${V}.mp3`, `gulp-2.${V}.mp3`, `gulp-3.${V}.mp3`],
  slurp: [`slurp-1.${V}.mp3`, `slurp-2.${V}.mp3`],
  clink: [`clink-1.${V}.mp3`],
  toast: [`toast-1.${V}.mp3`],
  pour: [`pour-1.${V}.mp3`],
  slam: [`slam-1.${V}.mp3`],
  'bottle-roll': [`roll-1.${V}.mp3`],
};

export function soundUrl(marker: string, rand: () => number): string | null {
  const files = DRUNK_SOUNDS[marker];
  if (!files?.length) return null;
  return `/media/sounds/drunk/${files[Math.floor(rand() * files.length)]}`;
}

/** The {markers} a line starts and ends with (lines never have one in the middle). */
export function markers(text: string): { before: string[]; after: string[] } {
  const head = /^((?:\{[^}]+\}\s*)*)/.exec(text)?.[1] ?? '';
  const tail = /((?:\s*\{[^}]+\})*)\s*$/.exec(text)?.[1] ?? '';
  const names = (s: string) => [...s.matchAll(/\{([^}]+)\}/g)].map((m) => m[1] as string);
  return { before: names(head), after: head === text ? [] : names(tail) };
}

/**
 * A line with no sound of its own sometimes gets one between lines, more often as she gets drunker (the script's
 * table): stage 1 a sip or clink after about 1 line in 4; later, a noise before about 1 line in 3.
 */
export function extraSound(stage: DrunkStage, rand: () => number): { before: string[]; after: string[] } {
  const roll = rand();
  const pick = (xs: string[]) => xs[Math.floor(rand() * xs.length)] as string;
  if (stage === 1) return roll < 0.25 ? { before: [], after: [pick(['sip', 'clink'])] } : { before: [], after: [] };
  if (stage === 2) return roll < 0.33 ? { before: [pick(['sip', 'hiccup', 'hiccup'])], after: [] } : { before: [], after: [] };
  if (stage === 3) return roll < 0.33 ? { before: [pick(['gulp', 'slurp', 'pour', 'hiccup'])], after: [] } : { before: [], after: [] };
  return roll < 0.4 ? { before: [pick(['hiccups', 'hiccup', 'slam', 'slurp'])], after: [] } : { before: [], after: [] };
}
