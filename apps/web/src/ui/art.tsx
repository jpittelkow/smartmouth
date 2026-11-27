// Original art: the grin logo mark (guide §2) and the blob avatars (guide §5.4). Inline SVG, no files.
import type { Band } from '@smartmouth/protocol';

export function Grin({ talking = false }: { talking?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M14 18 L30 13" stroke="var(--paper)" strokeWidth="5" strokeLinecap="round" />
      <path
        d={talking ? 'M8 30 Q32 64 58 26 Q34 44 8 30 Z' : 'M8 32 Q32 56 58 28 Q34 40 8 32 Z'}
        fill="var(--hot)" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round"
      />
      <rect x="34" y="35" width="7" height="8" rx="1.5" fill="var(--spot)" stroke="var(--ink)" strokeWidth="2" />
    </svg>
  );
}

// Eight blob bodies; the face is shared.
const BODIES = [
  'M50 8 C78 8 92 30 90 56 C88 82 70 94 50 94 C28 94 10 82 10 56 C10 28 24 8 50 8 Z',
  'M50 6 L62 22 L84 20 L80 44 L94 60 L74 72 L72 94 L50 84 L28 94 L26 72 L6 60 L20 44 L16 20 L38 22 Z',
  'M20 24 C20 10 80 10 80 24 L88 84 C88 96 12 96 12 84 Z',
  'M50 10 C74 4 96 24 90 50 C96 76 74 98 50 90 C26 98 4 76 10 50 C4 24 26 4 50 10 Z',
  'M30 8 C40 18 60 18 70 8 C88 18 94 46 88 70 C82 92 18 92 12 70 C6 46 12 18 30 8 Z',
  'M50 4 C66 20 92 30 90 58 C88 84 70 96 50 96 C30 96 12 84 10 58 C8 30 34 20 50 4 Z',
  'M14 30 C14 12 34 8 50 14 C66 8 86 12 86 30 C96 50 88 92 50 92 C12 92 4 50 14 30 Z',
  'M50 12 C64 2 76 14 74 26 C92 26 98 46 86 58 C96 74 82 94 62 88 C56 98 44 98 38 88 C18 94 4 74 14 58 C2 46 8 26 26 26 C24 14 36 2 50 12 Z',
];

export function Blob({ avatar, color }: { avatar: number; color: string }) {
  const body = BODIES[avatar % BODIES.length];
  const look = (avatar * 7) % 5 - 2; // googly eyes look a different way per blob
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path d={body} fill={color} stroke="var(--ink)" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="37" cy="46" r="11" fill="#fff" stroke="var(--ink)" strokeWidth="3" />
      <circle cx="63" cy="46" r="11" fill="#fff" stroke="var(--ink)" strokeWidth="3" />
      <circle cx={37 + look} cy="48" r="5" fill="var(--ink)" />
      <circle cx={63 + look} cy="48" r="5" fill="var(--ink)" />
      <path d="M40 66 Q50 74 60 66" stroke="var(--ink)" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Age pictures for the join screen: a blob that grows with the band. */
export function BandIcon({ band }: { band: Band }) {
  const size = { little: 18, kids: 24, tweens: 30, teens: 36, grownups: 42 }[band];
  const y = 46 - size;
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x={24 - size / 2} y={y} width={size} height={size} rx={size / 2.4} fill="var(--grape)" stroke="var(--ink)" strokeWidth="3" />
      <circle cx={24 - size / 6} cy={y + size / 2.6} r={size / 9} fill="var(--ink)" />
      <circle cx={24 + size / 6} cy={y + size / 2.6} r={size / 9} fill="var(--ink)" />
    </svg>
  );
}

/** Answer slots: colour AND shape, so colour is never the only signal (design guide §5.2). */
export const SLOTS = [
  { color: 'var(--slot-1)', name: 'star' },
  { color: 'var(--slot-2)', name: 'heart' },
  { color: 'var(--slot-3)', name: 'moon' },
  { color: 'var(--slot-4)', name: 'bolt' },
] as const;

const SHAPES: Record<string, string> = {
  star: 'M50 6 L62 37 L95 38 L69 58 L79 91 L50 72 L21 91 L31 58 L5 38 L38 37 Z',
  heart: 'M50 88 C20 66 6 50 6 32 C6 17 18 8 30 8 C40 8 46 14 50 22 C54 14 60 8 70 8 C82 8 94 17 94 32 C94 50 80 66 50 88 Z',
  moon: 'M62 6 C38 10 22 30 22 52 C22 76 42 94 66 94 C76 94 86 90 92 84 C64 84 46 66 46 44 C46 26 54 14 62 6 Z',
  bolt: 'M58 4 L18 56 L46 56 L38 96 L82 40 L54 40 L64 4 Z',
};

export function SlotShape({ slot, size = 48 }: { slot: number; size?: number }) {
  const s = SLOTS[slot % SLOTS.length] ?? SLOTS[0];
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ flex: 'none' }}>
      <path d={SHAPES[s.name]} fill={s.color} stroke="var(--ink)" strokeWidth="6" strokeLinejoin="round" />
    </svg>
  );
}

export function Tick({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <circle cx="24" cy="24" r="21" fill="var(--zap)" stroke="var(--ink)" strokeWidth="4" />
      <path d="M14 25 L21 32 L35 17" fill="none" stroke="var(--ink)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A picture answer: the picture when there is one, else a big word card (until pictures are made, ADR 0011). */
export function PictureCard({ text, image, index }: { text: string; image: string | null; index: number }) {
  const tints = ['#fff1b8', '#ffd6e0', '#c9f5ea', '#d3e6ff'];
  return (
    <span className="pic-card" style={{ background: tints[index % tints.length] }}>
      {image ? <img src={image} alt={text} /> : <span className="pic-word">{text}</span>}
    </span>
  );
}
