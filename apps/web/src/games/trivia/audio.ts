// Trivia's sounds and music (the owner's picks, 2026-11-27; design guide 4.1). Files are listed by the server at
// /api/sounds as `trivia-<cue>` (a picked sound, every time) or `trivia-<cue>-1`, `-2`, ... (the owner liked every
// take, so they rotate). Playback, looping, crossfades and ducking under Salty use the shared player that Snake Manor
// built (games/snakes/music.ts). A cue with no file plays nothing, or the caller's synthesized fallback.
import { duck, loadSounds, playBed, playClip, stopMusic } from '../snakes/music.ts';

let names: string[] = [];
void loadSounds().then((s) => { names = Object.keys(s); });

/** One file for a cue: the picked one, or a random take of a rotating cue. */
export function variant(cue: string): string | null {
  const re = new RegExp(`^trivia-${cue}(-\\d+)?$`);
  const opts = names.filter((n) => re.test(n));
  return opts.length ? opts[Math.floor(Math.random() * opts.length)]! : null;
}

/** A one-shot effect after `delaySec`. False when there's no file, so the caller can synthesize instead. */
export function fx(cue: string, delaySec = 0, volume = 0.7): boolean {
  const v = variant(cue);
  return v ? playClip(v, delaySec, volume) : false;
}

let wanted = 0;
/**
 * Crossfade to a music bed (a random take each time it starts), or to silence. Waits for the sound list on first
 * load (the lobby asks before it arrives), and drops the request if another one came in meanwhile.
 */
export function bed(cue: string | null): void {
  const mine = ++wanted;
  void loadSounds().then((s) => {
    names = Object.keys(s);
    if (mine === wanted) playBed(cue ? variant(cue) : null);
  });
}

export { duck, stopMusic };
