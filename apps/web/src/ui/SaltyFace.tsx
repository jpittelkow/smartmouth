// Salty's face on the TV (owner's pick 2026-11-27: the 3D-animated diva, "E", with her whole face moving, "B").
// Original art made on the local GPU (how: tools/art/salty/README.md). Each look (sober, Tipsy, Hammered, Gone) is a
// still picture plus a 12-second LivePortrait loop of her talking, made from that same picture. While her voice plays
// the loop fades in over the still; when she stops it fades out. From Hammered on she leans, and Gone sways.
import { useEffect, useRef } from 'react';

const FILES = import.meta.glob<string>('./salty/*.{jpg,mp4}', { eager: true, query: '?url', import: 'default' });
const still = (stage: number) => FILES[`./salty/s${stage}.jpg`] ?? '';
const loop = (stage: number) => FILES[`./salty/talk-s${stage}.mp4`] ?? '';

/** `stage`: 0 or 1 sober (Buzzed looks sober), 2 Tipsy, 3 Hammered, 4 Gone. */
export function SaltyFace({ talking, stage = 0 }: { talking: boolean; stage?: number }) {
  const s = Math.min(4, Math.max(1, stage || 1));
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (talking) {
      // Start from the top: the loop's first frame is her still picture, so the fade-in has nothing to jump.
      v.currentTime = 0;
      void v.play().catch(() => {});
      return;
    }
    const t = setTimeout(() => v.pause(), 250); // after the fade-out
    return () => clearTimeout(t);
  }, [talking, s]);
  return (
    <span className={`salty-face lean-${s}${talking ? ' talking' : ''}`}>
      <img src={still(s)} alt="" draggable={false} />
      <video ref={video} key={s} src={loop(s)} muted loop playsInline preload="auto" aria-hidden="true" />
    </span>
  );
}
