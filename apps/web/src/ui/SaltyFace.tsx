// Salty's face on the TV (owner's pick 2026-11-27: the 3D-animated diva, "E", with her whole face moving, "B").
// Original art made on the local GPU (how: tools/art/salty/README.md). Each look (sober, Tipsy, Hammered, Gone) is a
// still picture plus a sheet of 72 frames of her talking (a LivePortrait animation of that same picture, 6 s at 12 fps,
// 9 across by 8 down). While her voice plays, the frames are drawn onto a canvas over the still, forward then back so
// the loop never jumps; when she stops, the still is back. From Hammered on she leans, and Gone sways.
// Drawn by hand on purpose: the Chromecast draws a <video> over everything (a black circle while it loads) and
// mis-draws an animated WebP for its first second (a shrunken face).
import { useEffect, useRef, useState } from 'react';

const FILES = import.meta.glob<string>('./salty/*.jpg', { eager: true, query: '?url', import: 'default' });
const still = (stage: number) => FILES[`./salty/s${stage}.jpg`] ?? '';
const sheetUrl = (stage: number) => FILES[`./salty/talk-s${stage}.jpg`] ?? '';
const COLS = 9, FRAMES = 72, CELL = 160, FRAME_MS = 1000 / 12;

/** Sheets load once and stay decoded; `ready` once the picture can be drawn. */
const sheets = new Map<number, { img: HTMLImageElement; ready: boolean }>();
function sheet(stage: number) {
  let s = sheets.get(stage);
  if (!s && typeof Image !== 'undefined') {
    const img = new Image();
    const entry = { img, ready: false };
    sheets.set(stage, entry);
    img.onload = () => { void img.decode().catch(() => {}).then(() => { entry.ready = true; }); };
    img.src = sheetUrl(stage);
    s = entry;
  }
  return s;
}

/** `stage`: 0 or 1 sober (Buzzed looks sober), 2 Tipsy, 3 Hammered, 4 Gone. */
export function SaltyFace({ talking, stage = 0 }: { talking: boolean; stage?: number }) {
  const s = Math.min(4, Math.max(1, stage || 1));
  const canvas = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  useEffect(() => { sheet(s); if (s < 4) sheet(s + 1); }, [s]); // load ahead: the next stage comes as she drinks
  useEffect(() => {
    const c = canvas.current;
    const sh = sheet(s);
    const ctx = c?.getContext('2d');
    if (!talking || !sh || !ctx) { setDrawing(false); return; }
    let n = 0;
    const tick = () => {
      if (!sh.ready) return; // still loading: her still stays up
      const i = n % (FRAMES * 2 - 2); // forward then back: 0..71..1
      const f = i < FRAMES ? i : FRAMES * 2 - 2 - i;
      ctx.drawImage(sh.img, (f % COLS) * CELL, Math.floor(f / COLS) * CELL, CELL, CELL, 0, 0, CELL, CELL);
      if (n === 0) setDrawing(true);
      n++;
    };
    tick();
    const t = setInterval(tick, FRAME_MS);
    return () => { clearInterval(t); setDrawing(false); };
  }, [talking, s]);
  return (
    <span className={`salty-face lean-${s}`}>
      <img src={still(s)} alt="" draggable={false} />
      <canvas ref={canvas} width={CELL} height={CELL} className={drawing ? 'on' : ''} aria-hidden="true" />
    </span>
  );
}
