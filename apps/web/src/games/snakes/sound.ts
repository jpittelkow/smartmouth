// Snake Manor's sounds (ADR 0024, design guide §8.5), made with Web Audio on the TV like the countdown ticks
// (host/sfx.ts): no files to fetch or level. Every sound that carries meaning also sets a caption, shown under
// Salty's strip, and every sound has a picture timed to the same moment (drama.tsx).
import { useEffect, useSyncExternalStore } from 'react';
import { serverNow } from '../../socket.ts';
import { hasSound, playClip } from './music.ts';

/** When the quill recording last started, so nine strokes in a row play it once (it's 1.5 s of real scratching). */
let quillUntil = 0;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return ctx.state === 'running' ? ctx : null;
}

if (typeof window !== 'undefined') {
  const unlock = () => { audio(); };
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerdown', unlock);
}

const env = (g: GainNode, at: number, peak: number, a: number, d: number) => {
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + a);
  g.gain.exponentialRampToValueAtTime(0.0001, at + a + d);
};

function noise(a: AudioContext, sec: number): AudioBufferSourceNode {
  const b = a.createBuffer(1, Math.ceil(a.sampleRate * sec), a.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = a.createBufferSource();
  s.buffer = b;
  return s;
}

function tone(freq: number, type: OscillatorType, vol: number, attack: number, decay: number, delay = 0) {
  const a = audio();
  if (!a || !master) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  env(g, t, vol, attack, decay);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + attack + decay + 0.05);
}

function burst(sec: number, filter: BiquadFilterType, freq: number, vol: number, delay = 0) {
  const a = audio();
  if (!a || !master) return;
  const t = a.currentTime + delay;
  const n = noise(a, sec);
  const f = a.createBiquadFilter();
  const g = a.createGain();
  f.type = filter;
  f.frequency.value = freq;
  env(g, t, vol, Math.min(0.3, sec / 4), sec * 0.7);
  n.connect(f).connect(g).connect(master);
  n.start(t);
  n.stop(t + sec);
}

let drone: { gain: GainNode; oscs: OscillatorNode[] } | null = null;

/** The sound bank. Names match the cues in drama.tsx. */
export const SFX = {
  /** The low drone. Skipped at night when the night music is playing instead. */
  droneOn(unlessMusic?: string) {
    if (unlessMusic && hasSound(unlessMusic)) return;
    const a = audio();
    if (!a || !master || drone) return;
    const g = a.createGain();
    const f = a.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 340;
    g.gain.value = 0.0001;
    f.connect(g).connect(master);
    const oscs = [55, 82.4, 110.3].map((hz, i) => {
      const o = a.createOscillator();
      o.type = i === 1 ? 'sawtooth' : 'triangle';
      o.frequency.value = hz;
      o.detune.value = i * 4;
      o.connect(f);
      o.start();
      return o;
    });
    g.gain.exponentialRampToValueAtTime(0.2, a.currentTime + 1.2);
    drone = { gain: g, oscs };
  },
  droneOff() {
    const a = audio();
    if (!a || !drone) return;
    const d = drone;
    drone = null;
    d.gain.gain.cancelScheduledValues(a.currentTime);
    d.gain.gain.setValueAtTime(Math.max(d.gain.gain.value, 0.0002), a.currentTime);
    d.gain.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.9);
    for (const o of d.oscs) o.stop(a.currentTime + 1);
  },
  /**
   * The heartbeat recording across `sec`, its speed ramping from 62 to 140 a minute (the recording is 97), cut dead
   * at the end. False when there's no recording: the caller plays synthesized beats instead.
   */
  heartbeatRun(sec: number): boolean {
    return playClip('heartbeat', 0, 0.9, { rate: 62 / 97, rateTo: 140 / 97, maxSec: sec });
  },
  /** One synthesized heartbeat: lub-dub. */
  heartbeat() {
    const a = audio();
    if (!a || !master) return;
    for (const [off, vol] of [[0, 0.9], [0.16, 0.55]] as const) {
      const t = a.currentTime + off;
      const o = a.createOscillator();
      const g = a.createGain();
      o.frequency.setValueAtTime(90, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      env(g, t, vol, 0.008, 0.22);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 0.3);
    }
  },
  /** A quill stroke: the recording (once per 1.5 s, however many strokes), else a synthesized scratch. */
  quill() {
    if (hasSound('quill')) {
      const now = performance.now();
      if (now < quillUntil) return;
      quillUntil = now + 1400;
      playClip('quill', 0, 0.55, { maxSec: 1.5 });
      return;
    }
    burst(0.12, 'bandpass', 3800, 0.16);
  },
  /** A wax seal pressed down. */
  thud() {
    if (playClip('seal', 0, 0.9)) return;
    tone(70, 'sine', 0.7, 0.005, 0.25); burst(0.08, 'lowpass', 600, 0.25);
  },
  /** The great bell: the picked recording when there is one (tools/sounds), else synthesized. */
  bell(delay = 0) {
    if (playClip('bell', delay)) return;
    for (const [m, v, d] of [[1, 0.5, 7], [2, 0.25, 5], [2.4, 0.22, 4.5], [3, 0.14, 3.5], [4.2, 0.1, 2.5], [5.4, 0.06, 1.8]] as const) {
      tone(146.8 * m, 'sine', v, 0.01, d, delay);
    }
    burst(0.08, 'highpass', 2000, 0.3, delay);
  },
  hiss() { burst(2.2, 'highpass', 4200, 0.3, 0.15); },
  snuff() {
    if (playClip('candles', 0, 0.45, { maxSec: 1 })) return;
    burst(0.15, 'lowpass', 900, 0.12);
  },
  lute(step: number) { tone(step === 0 ? 196 : 233.1, 'triangle', 0.18, 0.005, 1.8); },
  /** A vote letter torn open (the reveal). */
  envelope() { if (!playClip('envelope', 0, 0.85, { maxSec: 2.5 })) burst(0.5, 'bandpass', 2600, 0.14); },
  /** The letter unfolding to show the name. */
  unfold() { if (!playClip('unfold', 0, 0.75, { maxSec: 2 })) burst(0.35, 'highpass', 3000, 0.08); },
  /** A sealed letter laid on the table (a vote cast): the paper sound, short and quiet. */
  letterIn() { if (!playClip('unfold', 0, 0.35, { maxSec: 0.6 })) burst(0.15, 'bandpass', 2400, 0.08); },
  /** A blade drawn: the Snakes earned a Dagger. */
  dagger() { if (!playClip('dagger', 0, 0.8, { maxSec: 2 })) { tone(1800, 'sawtooth', 0.04, 0.2, 0.5); burst(0.6, 'highpass', 5000, 0.12); } },
  /** A metal clang: a shield given. */
  shield() { if (!playClip('shield', 0, 0.7, { maxSec: 2 })) { tone(620, 'triangle', 0.15, 0.002, 0.8); tone(931, 'sine', 0.08, 0.002, 0.6); } },
  /** Cards dealt: the deal. */
  cards() { if (!playClip('cards', 0, 0.7, { maxSec: 3 })) for (let i = 0; i < 4; i++) burst(0.06, 'bandpass', 3000, 0.1, i * 0.15); },
  /** A cloth whoosh: a mask comes off. */
  whoosh() { if (!playClip('whoosh', 0, 0.7, { maxSec: 1.5 })) burst(0.5, 'bandpass', 900, 0.12); },
  /** A knock on the door: a vote at the last table. */
  knock() { if (!playClip('knock', 0, 0.8, { maxSec: 1.5 })) { tone(120, 'sine', 0.5, 0.002, 0.15); tone(120, 'sine', 0.4, 0.002, 0.15, 0.18); } },
  /** The clock in the last ten seconds. */
  tick() { if (!playClip('tick', 0, 0.45, { maxSec: 0.5 })) tone(1500, 'square', 0.05, 0.002, 0.05); },
  /** A trumpet fanfare: target hit, the Guests win. Falls back to the synthesized flourish. */
  fanfare() { if (!playClip('fanfare', 0, 0.75, { maxSec: 6 })) SFX.flourish(); },
  /** A bright little flourish: a mission's target hit. */
  flourish() { [523.3, 659.3, 784, 1046.5].forEach((hz, i) => tone(hz, 'triangle', 0.15, 0.005, 0.5, i * 0.09)); },
  /** A cracked, off-key fanfare: a target missed. */
  crackedFanfare() { [392, 370, 311.1].forEach((hz, i) => { tone(hz, 'sawtooth', 0.08, 0.02, 0.5, i * 0.22); tone(hz * 1.03, 'sawtooth', 0.05, 0.02, 0.5, i * 0.22); }); },
  /** Birdsong for the morning. */
  birds() { if (playClip('birds', 0, 0.5, { maxSec: 6 })) return; for (let i = 0; i < 5; i++) tone(2400 + Math.random() * 1400, 'sine', 0.05, 0.01, 0.12, i * 0.21 + Math.random() * 0.05); },
  /** The manor staff gasp: the empty chair. */
  gasp() { if (!playClip('gasp', 0, 0.8, { maxSec: 3 })) burst(0.6, 'bandpass', 1400, 0.22); },
  /** A soft chime: one more of you made it to breakfast. */
  chime() { if (playClip('chime', 0, 0.6, { maxSec: 2.5 })) return; tone(880, 'sine', 0.12, 0.005, 1.2); tone(1320, 'sine', 0.05, 0.005, 0.9); },
  /** The choir and brass for the end (the win music replaces it when there is one). */
  finale() {
    if (hasSound('guests-win') || hasSound('snakes-win')) return; [196, 246.9, 293.7, 392].forEach((hz) => { tone(hz, 'sawtooth', 0.05, 0.6, 2.6); tone(hz * 2, 'sine', 0.05, 0.6, 2.6); }); },
};

// ---------- captions for sounds (design guide §7: every meaningful sound is captioned) ----------

let caption = '';
const listeners = new Set<() => void>();
export function captionSound(text: string) {
  caption = text;
  for (const l of listeners) l();
}
export function useSoundCaption(): string {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => caption);
}

// ---------- cues on the server's clock ----------

export interface Cue { at: number; run: () => void }

/**
 * Runs each cue at its server time. A cue whose time has already passed (a TV that reconnected mid-reveal) is
 * skipped, unless it's under half a second late, so the picture and sound resume at the current beat.
 */
export function useCues(key: string, cues: () => Cue[]) {
  useEffect(() => {
    const now = serverNow();
    const timers = cues().filter((c) => c.at >= now - 500).map((c) => setTimeout(c.run, Math.max(0, c.at - now)));
    return () => { for (const t of timers) clearTimeout(t); };
    // The cue list is rebuilt when `key` changes (a new stage); it never changes within one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => () => { SFX.droneOff(); captionSound(''); }, []);
}
