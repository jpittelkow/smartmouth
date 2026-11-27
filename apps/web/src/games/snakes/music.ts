// Snake Manor's music on the TV (design guide §4, §8.5): a bed per stage from the picks in tools/sounds, looping,
// crossfading between stages, and ducked about 8 dB while Salty talks. The server lists the files at /api/sounds
// (cue -> URL); a cue with no file just stays silent, and the synthesized sounds in sound.ts cover the rest.
import type { SnakesHostView } from '@smartmouth/game-snakes';

let sounds: Record<string, string> = {};
let loaded: Promise<Record<string, string>> | null = null;

/** The picked sounds, fetched once per page. */
export function loadSounds(): Promise<Record<string, string>> {
  loaded ??= fetch('/api/sounds', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : { sounds: {} }))
    .then((j: { sounds?: Record<string, string> }) => { sounds = j.sounds ?? {}; return sounds; })
    .catch(() => sounds);
  return loaded;
}

export const hasSound = (cue: string) => !!sounds[cue];

/** The bed for each stage. The banishment has none: its silence is the point (ADR 0024). */
export function bedFor(g: SnakesHostView): string | null {
  switch (g.stage) {
    case 'deal': return 'theme';
    case 'mission': case 'missionReveal': return 'mission';
    case 'debate': case 'vote': case 'endVote': return 'table';
    case 'voteReveal': case 'unmask': return 'reveal';
    case 'night': return 'night';
    case 'breakfast': return 'breakfast';
    case 'final': return g.final?.winner === 'snake' ? 'snakes-win' : 'guests-win';
    default: return null;
  }
}

const LEVEL = 0.32;
/** About 8 dB down while Salty talks. */
const DUCKED = 0.13;
const FADE_MS = 1500;

/** `level`: this bed's volume (a game may play its beds louder than LEVEL); ducking keeps the same ~8 dB drop. */
let current: { cue: string; el: HTMLAudioElement; level: number } | null = null;
let ducked = false;
let pending: (() => void) | null = null;

function fade(el: HTMLAudioElement, to: number, ms: number, then?: () => void) {
  const from = el.volume;
  const start = performance.now();
  const step = () => {
    const p = Math.min(1, (performance.now() - start) / ms);
    el.volume = Math.max(0, Math.min(1, from + (to - from) * p));
    if (p < 1) requestAnimationFrame(step); else then?.();
  };
  requestAnimationFrame(step);
}

const target = () => { const l = current?.level ?? LEVEL; return ducked ? l * (DUCKED / LEVEL) : l; };

/** A desktop browser plays sound only after a click or key; the TV app's WebView plays at once. */
if (typeof window !== 'undefined') {
  const unlock = () => { const p = pending; pending = null; p?.(); };
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerdown', unlock);
}

/** Crossfade to a stage's bed (null: fade to silence). The win themes play once; the rest loop. */
export function playBed(cue: string | null, level = LEVEL) {
  if (current?.cue === cue) return;
  const old = current;
  current = null;
  if (old) fade(old.el, 0, FADE_MS, () => { old.el.pause(); old.el.src = ''; });
  const url = cue ? sounds[cue] : undefined;
  if (!cue || !url) return;
  const el = new Audio(url);
  el.loop = !cue.endsWith('-win');
  el.volume = 0;
  current = { cue, el, level };
  const start = () => el.play().then(() => fade(el, target(), FADE_MS)).catch(() => { pending = start; });
  start();
}

export function duck(on: boolean) {
  if (ducked === on) return;
  ducked = on;
  if (current) fade(current.el, target(), 400);
}

export function stopMusic() {
  playBed(null);
}

export interface ClipOptions {
  /** Stop after this many seconds (with a short fade). */
  maxSec?: number;
  /** Playback speed at the start, and the speed it ramps to over `maxSec` (the heartbeat speeding up). */
  rate?: number;
  rateTo?: number;
}

/**
 * A one-shot clip, after `delaySec`. False when there's no file, so the caller synthesizes the sound instead
 * (sound.ts). A speed ramp changes the pitch with the speed, like a real heartbeat racing.
 */
export function playClip(cue: string, delaySec = 0, volume = 0.8, opts: ClipOptions = {}): boolean {
  const url = sounds[cue];
  if (!url) return false;
  setTimeout(() => {
    const el = new Audio(url);
    el.volume = volume;
    el.preservesPitch = false;
    if (opts.rate) el.playbackRate = opts.rate;
    el.play().catch(() => {});
    const started = performance.now();
    if (opts.rate && opts.rateTo && opts.maxSec) {
      const from = opts.rate, to = opts.rateTo, sec = opts.maxSec;
      const ramp = setInterval(() => {
        const p = Math.min(1, (performance.now() - started) / (sec * 1000));
        el.playbackRate = from + (to - from) * p;
        if (p >= 1) clearInterval(ramp);
      }, 100);
    }
    if (opts.maxSec) setTimeout(() => fade(el, 0, 120, () => el.pause()), opts.maxSec * 1000);
  }, delaySec * 1000);
  return true;
}

const loops = new Map<string, HTMLAudioElement>();

/** A looping layer under the music (the night wind). */
export function startLoop(cue: string, volume = 0.3): boolean {
  const url = sounds[cue];
  if (!url || loops.has(cue)) return !!url;
  const el = new Audio(url);
  el.loop = true;
  el.volume = 0;
  loops.set(cue, el);
  el.play().then(() => fade(el, volume, 2000)).catch(() => {});
  return true;
}

export function stopLoop(cue: string) {
  const el = loops.get(cue);
  if (!el) return;
  loops.delete(cue);
  fade(el, 0, 1500, () => el.pause());
}
