// Salty's face on the TV (owner's pick 2026-11-27: the 3D-animated diva, "E", with her whole face moving, "B").
// Original art made on the local GPU (how: tools/art/salty/README.md). Each look (sober, Tipsy, Hammered, Gone) is a
// still picture plus a 12-second LivePortrait loop of her talking, made from that same picture, as an animated WebP.
// While her voice plays the loop sits over the still, restarted from its first frame (which is the still); when she
// stops, the still is back. From Hammered on she leans, and Gone sways.
// Not a <video>: on the Chromecast a video draws on its own layer over everything, a black circle while it loads.
import { useEffect, useState } from 'react';

const FILES = import.meta.glob<string>('./salty/*.{jpg,webp}', { eager: true, query: '?url', import: 'default' });
const still = (stage: number) => FILES[`./salty/s${stage}.jpg`] ?? '';
const loop = (stage: number) => FILES[`./salty/talk-s${stage}.webp`] ?? '';

const warmed = new Set<number>();
/** Fetch a stage's loop ahead of time so it starts the moment she speaks. */
function warm(stage: number) {
  if (warmed.has(stage) || typeof Image === 'undefined') return;
  warmed.add(stage);
  new Image().src = loop(stage);
}

/** `stage`: 0 or 1 sober (Buzzed looks sober), 2 Tipsy, 3 Hammered, 4 Gone. */
export function SaltyFace({ talking, stage = 0 }: { talking: boolean; stage?: number }) {
  const s = Math.min(4, Math.max(1, stage || 1));
  const [take, setTake] = useState(0); // a new key each time she starts talking restarts the animation
  useEffect(() => { warm(s); if (s < 4) warm(s + 1); }, [s]);
  useEffect(() => { if (talking) setTake((n) => n + 1); }, [talking]);
  return (
    <span className={`salty-face lean-${s}`}>
      <img src={still(s)} alt="" draggable={false} />
      {talking && <img key={`${s}-${take}`} className="talk" src={loop(s)} alt="" draggable={false} />}
    </span>
  );
}
