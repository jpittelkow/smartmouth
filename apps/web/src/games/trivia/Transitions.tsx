// Trivia's transitions on the TV (owner, 2026-11-27: "a transition animation would be good"). Pure CSS animations,
// timed to the picked sounds: the round wipe rides the round whoosh, confetti lands with the applause. Everything is
// switched off by the global reduced-motion rule in app.css.
import { useMemo } from 'react';
import { Grin } from '../../ui/art.tsx';

/** The panel that sweeps across between rounds, carrying the round number and the question's category. */
export function RoundWipe({ round, rounds, category }: { round: number; rounds: number; category: string | null }) {
  return (
    <div className="round-wipe" aria-hidden="true">
      <div className="round-wipe-panel">
        <div className="round-wipe-num display">Round {round}</div>
        <div className="round-wipe-sub">{round === rounds ? 'Last one!' : `of ${rounds}`}{category ? ` · ${category}` : ''}</div>
      </div>
    </div>
  );
}

/** The game's title card: Salty's grin pops, the title slams down over turning rays. */
export function TitleCard({ rounds }: { rounds: number }) {
  return (
    <div className="title-card">
      <div className="title-rays" aria-hidden="true" />
      <div className="title-grin"><Grin /></div>
      <div className="title-word display">Trivia</div>
      <div className="title-sub display">{rounds} rounds. Phones out.</div>
    </div>
  );
}

const COLORS = ['var(--spot)', 'var(--hot)', 'var(--zap)', 'var(--sky)', 'var(--grape)', 'var(--paper)'];

/** A burst of confetti over the game area. `seed` changes give a new burst. */
export function Confetti({ seed, count = 70 }: { seed: string | number; count?: number }) {
  const bits = useMemo(() => Array.from({ length: count }, (_, i) => {
    const r = (n: number) => { const x = Math.sin((i + 1) * 9301 + n * 49297 + String(seed).length * 233) * 10000; return x - Math.floor(x); };
    return {
      left: `${r(1) * 100}%`, delay: `${r(2) * 1.2}s`, dur: `${3 + r(3) * 1.6}s`,
      drift: `${(r(4) - 0.5) * 220}px`, spin: `${(r(5) > 0.5 ? 1 : -1) * (360 + r(6) * 720)}deg`,
      w: `${10 + r(7) * 12}px`, h: `${6 + r(8) * 10}px`, color: COLORS[i % COLORS.length], round: r(9) > 0.7,
    };
  }), [seed, count]);
  return (
    <div className="confetti" aria-hidden="true" key={seed}>
      {bits.map((b, i) => (
        <i key={i} style={{
          left: b.left, width: b.w, height: b.h, background: b.color, borderRadius: b.round ? '50%' : '2px',
          animationDelay: b.delay, animationDuration: b.dur, ['--drift' as string]: b.drift, ['--spin' as string]: b.spin,
        }} />
      ))}
    </div>
  );
}

/** Stars bursting out from the middle, for a Little's turn and a Little's right pick. */
export function Sparkles({ seed, count = 18 }: { seed: string | number; count?: number }) {
  const stars = useMemo(() => Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    const d = 260 + (i % 3) * 90;
    return { x: `${Math.cos(a) * d}px`, y: `${Math.sin(a) * d * 0.6}px`, delay: `${(i % 4) * 0.06}s`, color: COLORS[i % 5] };
  }), [seed, count]);
  return (
    <div className="sparkles" aria-hidden="true" key={seed}>
      {stars.map((s, i) => <i key={i} style={{ ['--x' as string]: s.x, ['--y' as string]: s.y, animationDelay: s.delay, color: s.color }}>★</i>)}
    </div>
  );
}
