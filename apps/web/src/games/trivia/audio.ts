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

/** Trivia's beds sit about 4 dB above the shared default (owner, 2026-11-27: "up 1 to 2 notches"). */
const BED_LEVEL = 0.5;
let wanted = 0;
/**
 * Crossfade to a music bed (a random take each time it starts), or to silence. Waits for the sound list on first
 * load (the lobby asks before it arrives), and drops the request if another one came in meanwhile.
 */
export function bed(cue: string | null): void {
  const mine = ++wanted;
  void loadSounds().then((s) => {
    names = Object.keys(s);
    if (mine === wanted) playBed(cue ? variant(cue) : null, BED_LEVEL);
  });
}

/**
 * The bang that ends the drum roll (owner, 2026-11-27). Plays the picked `trivia-bang` file when there is one; until
 * then a synthesized crash (filtered noise) over a kick (a falling sine) stands in (design guide 4.1: placeholder).
 */
let ctx: AudioContext | null = null;
export function bang(): void {
  if (fx('bang', 0, 0.8)) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 1.6);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 5000;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.35, t);
    noise.connect(hp).connect(ng).connect(ctx.destination);
    noise.start(t);
    const kick = ctx.createOscillator();
    const kg = ctx.createGain();
    kick.frequency.setValueAtTime(140, t);
    kick.frequency.exponentialRampToValueAtTime(42, t + 0.35);
    kg.gain.setValueAtTime(0.9, t);
    kg.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    kick.connect(kg).connect(ctx.destination);
    kick.start(t);
    kick.stop(t + 0.55);
  } catch { /* no Web Audio: silent */ }
}

export { duck, stopMusic };
