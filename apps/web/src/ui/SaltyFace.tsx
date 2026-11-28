// Salty's face on the TV (owner's pick 2026-11-27: the 3D-animated diva, "E"). Original art made on the local GPU:
// Z-Image-Turbo for the portrait, FLUX.1 Kontext edits for her mouth and her Drunk stages, so she stays the same woman
// (how: tools/art/salty/README.md). Each stage has three mouth frames; while her voice plays the mouth flips
// between them, and from Hammered on she leans.
import { useEffect, useState } from 'react';

const FILES = import.meta.glob<string>('./salty/*.jpg', { eager: true, query: '?url', import: 'default' });
const FRAMES = ['closed', 'mid', 'open'] as const;
const url = (stage: number, frame: (typeof FRAMES)[number]) => FILES[`./salty/s${stage}-${frame}.jpg`] ?? '';

let preloaded = false;
function preload() {
  if (preloaded || typeof Image === 'undefined') return;
  preloaded = true;
  for (const src of Object.values(FILES)) { const i = new Image(); i.src = src; }
}

/** `stage`: 0 or 1 sober (Buzzed looks sober), 2 Tipsy, 3 Hammered, 4 Gone. */
export function SaltyFace({ talking, stage = 0 }: { talking: boolean; stage?: number }) {
  const s = Math.min(4, Math.max(1, stage || 1));
  const [frame, setFrame] = useState(0);
  useEffect(preload, []);
  useEffect(() => {
    if (!talking) { setFrame(0); return; }
    // Mostly parted, sometimes wide, now and then shut: reads as speech without tracking the audio.
    const t = setInterval(() => { const r = Math.random(); setFrame(r < 0.25 ? 0 : r < 0.8 ? 1 : 2); }, 150);
    return () => clearInterval(t);
  }, [talking]);
  return (
    <span className={`salty-face lean-${s}`}>
      <img src={url(s, FRAMES[frame] ?? 'closed')} alt="" draggable={false} />
    </span>
  );
}
