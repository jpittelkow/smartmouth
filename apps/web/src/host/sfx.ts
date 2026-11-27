// Small sound effects for the TV, made with Web Audio (no files): the countdown's last-five-seconds tick and the
// time's-up buzz (owner, 2026-11-27). Like Salty's voice, a desktop browser needs one click or key first; the TV
// app's WebView plays without one.
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return ctx;
}

if (typeof window !== 'undefined') {
  const unlock = () => { audio(); };
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerdown', unlock);
}

function blip(freq: number, ms: number, type: OscillatorType, gain: number) {
  const a = audio();
  if (!a || a.state !== 'running') return;
  const t = a.currentTime;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + ms / 1000 + 0.02);
}

/** One tick of the last five seconds; `secondsLeft` 1 is the sharpest. */
export function tick(secondsLeft: number) {
  blip(secondsLeft <= 1 ? 1320 : 880, 90, 'square', 0.12);
}

/** Time's up. */
export function buzz() {
  blip(150, 450, 'sawtooth', 0.14);
  blip(155, 450, 'sawtooth', 0.1);
}
