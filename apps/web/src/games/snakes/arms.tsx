// Snake Manor's art (design guide §8.4): coats of arms for the seats, the answer marks, Salty's seal and the candle.
// Original drawings, no images.
import { useEffect, useRef, useState } from 'react';
import { PLAYER_COLORS } from '@smartmouth/protocol';
import { serverNow } from '../../socket.ts';

/** The 10 seat colours become 10 heraldic tinctures, each with a fixed charge, so colour is never the only signal. */
const TINCTURES = [
  { name: 'or', field: '#c9a24a', metal: '#e9dcbd', charge: 'fess' },
  { name: 'gules', field: '#a3302a', metal: '#d9c17a', charge: 'chevron' },
  { name: 'vert', field: '#4f7d5b', metal: '#e9dcbd', charge: 'chief' },
  { name: 'azure', field: '#2f4f86', metal: '#d9c17a', charge: 'bend' },
  { name: 'purpure', field: '#6b3f73', metal: '#d9c17a', charge: 'cross' },
  { name: 'tenne', field: '#b06a2e', metal: '#e9dcbd', charge: 'saltire' },
  { name: 'sable', field: '#2a2622', metal: '#c9a24a', charge: 'pale' },
  { name: 'sanguine', field: '#6e1f22', metal: '#d9c17a', charge: 'bordure' },
  { name: 'murrey', field: '#8c3b5a', metal: '#e9dcbd', charge: 'quarterly' },
  { name: 'argent', field: '#d8d2c2', metal: '#a3302a', charge: 'pall' },
] as const;

export function tinctureFor(color: string | undefined) {
  const i = Math.max(0, PLAYER_COLORS.indexOf((color ?? '') as (typeof PLAYER_COLORS)[number]));
  return TINCTURES[i % TINCTURES.length] as (typeof TINCTURES)[number];
}

const SHIELD = 'M2 2H98V55C98 84 50 109 50 109C50 109 2 84 2 55Z';

function Charge({ kind, fill }: { kind: string; fill: string }) {
  switch (kind) {
    case 'chevron': return <path d="M-5 92 L50 40 L105 92 L105 70 L50 18 L-5 70 Z" fill={fill} />;
    case 'bend': return <path d="M-10 6 L14 -10 L110 96 L86 112 Z" fill={fill} />;
    case 'pale': return <rect x="36" y="0" width="28" height="120" fill={fill} />;
    case 'cross': return <><rect x="40" y="0" width="20" height="120" fill={fill} /><rect x="0" y="34" width="100" height="20" fill={fill} /></>;
    case 'saltire': return <path d="M-6 6 L6 -6 L106 106 L94 118 Z M106 6 L94 -6 L-6 106 L6 118 Z" fill={fill} />;
    case 'chief': return <rect x="0" y="0" width="100" height="32" fill={fill} />;
    case 'bordure': return <path d={`${SHIELD} M14 14V54C14 75 50 96 50 96C50 96 86 75 86 54V14Z`} fill={fill} fillRule="evenodd" />;
    case 'pall': return <path d="M-6 -6 L50 44 L106 -6 L106 14 L60 54 L60 120 L40 120 L40 54 L-6 14 Z" fill={fill} />;
    case 'quarterly': return <><rect x="50" y="0" width="50" height="50" fill={fill} /><rect x="0" y="50" width="50" height="70" fill={fill} /></>;
    default: return <rect x="0" y="40" width="100" height="28" fill={fill} />;
  }
}

let shieldIds = 0;

/** A seat's coat of arms. `faded` greys it out (a Ghost, a banished player). */
export function Arms({ color, size = 64, faded = false }: { color: string | undefined; size?: number; faded?: boolean }) {
  const t = tinctureFor(color);
  const id = useRef(`arms${shieldIds++}`).current;
  return (
    <svg className={`arms${faded ? ' faded' : ''}`} viewBox="0 0 100 112" width={size} height={size * 1.12} aria-hidden="true">
      <defs><clipPath id={id}><path d={SHIELD} /></clipPath></defs>
      <g clipPath={`url(#${id})`}>
        <rect width="100" height="112" fill={t.field} />
        <Charge kind={t.charge} fill={t.metal} />
        <path d="M2 2H98V40C70 30 30 30 2 40Z" fill="#fff" opacity=".07" />
      </g>
      <path d={SHIELD} fill="none" stroke="#c9a24a" strokeWidth="3" />
    </svg>
  );
}

/** Answer marks: crown, key, rose and sword, each with a Roman numeral (design guide §8.4). */
export const MARKS = [
  { id: 'crown', numeral: 'I', bg: '#8a6d22' },
  { id: 'key', numeral: 'II', bg: '#2f4f86' },
  { id: 'rose', numeral: 'III', bg: '#a3302a' },
  { id: 'sword', numeral: 'IV', bg: '#3f5f47' },
] as const;

export function Mark({ index, size = 40 }: { index: number; size?: number }) {
  const m = MARKS[index % MARKS.length] as (typeof MARKS)[number];
  return (
    <span className="mark" style={{ width: size, height: size, background: m.bg }} aria-label={`mark ${m.numeral}`}>
      <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} aria-hidden="true">
        {m.id === 'crown' && <><path d="M3 18h18l1.2-10.5-5.6 4.2L12 4l-4.6 7.7-5.6-4.2z" fill="currentColor" /><rect x="3" y="19.5" width="18" height="2" fill="currentColor" /></>}
        {m.id === 'key' && <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="7" cy="12" r="4" /><path d="M11 12h11M18 12v4M21.5 12v3" /></g>}
        {m.id === 'rose' && <g fill="currentColor"><circle cx="12" cy="5.5" r="4" /><circle cx="18.2" cy="10" r="4" /><circle cx="15.8" cy="17.3" r="4" /><circle cx="8.2" cy="17.3" r="4" /><circle cx="5.8" cy="10" r="4" /></g>}
        {m.id === 'sword' && <path d="M12 2v14M7 16h10M12 16v6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />}
      </svg>
    </span>
  );
}

/** Salty's wax seal (replaces the grin in this game); it pulses while he talks. */
export function Seal({ talking = false, small = false }: { talking?: boolean; small?: boolean }) {
  return <span className={`seal${talking ? ' talking' : ''}${small ? ' small' : ''}`} aria-hidden="true">S</span>;
}

/** Time left until `deadline`, ticking a few times a second. */
export function useLeft(deadline: number | null): { left: number; share: number } {
  const total = useRef(1);
  const [left, setLeft] = useState(() => (deadline ? Math.max(0, deadline - serverNow()) : 0));
  useEffect(() => {
    if (!deadline) { setLeft(0); return; }
    total.current = Math.max(1, deadline - serverNow());
    setLeft(Math.max(0, deadline - serverNow()));
    const id = setInterval(() => setLeft(Math.max(0, deadline - serverNow())), 250);
    return () => clearInterval(id);
  }, [deadline]);
  return { left, share: Math.min(1, left / total.current) };
}

export const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** The TV's timer: a candle that burns down and flares oxblood in the last five seconds. */
export function Candle({ deadline }: { deadline: number | null }) {
  const { left, share } = useLeft(deadline);
  const top = 138 + (1 - share) * 300;
  const late = left > 0 && left <= 5000;
  return (
    <div className={`candle${late ? ' late' : ''}`}>
      <svg viewBox="0 0 160 520" aria-label={`${clock(left)} left`}>
        <defs>
          <radialGradient id="cglow"><stop offset="0" stopColor={late ? '#c2453c' : '#f4c66a'} stopOpacity=".55" /><stop offset="1" stopColor="#f4c66a" stopOpacity="0" /></radialGradient>
          <linearGradient id="cwax" x1="0" x2="1"><stop offset="0" stopColor="#cdbf9e" /><stop offset=".5" stopColor="#efe4c8" /><stop offset="1" stopColor="#b9a983" /></linearGradient>
        </defs>
        <circle cx="80" cy={top - 60} r="80" fill="url(#cglow)" />
        <path d="M44 138 H116 V470 H44 Z" fill="#3a3128" opacity=".5" />
        <path d={`M44 ${top} Q60 ${top - 10} 72 ${top} T116 ${top} V470 H44 Z`} fill="url(#cwax)" />
        <line x1="80" y1={top} x2="80" y2={top - 24} stroke="#2a1f14" strokeWidth="4" />
        {left > 0 && (
          <g className="flame" style={{ transformOrigin: `80px ${top - 24}px` }}>
            <path d={`M80 ${top - 84} C96 ${top - 60} 98 ${top - 40} 80 ${top - 24} C62 ${top - 40} 64 ${top - 60} 80 ${top - 84} Z`} fill={late ? '#e0604f' : '#f4c66a'} />
            <path d={`M80 ${top - 58} C88 ${top - 46} 88 ${top - 36} 80 ${top - 28} C72 ${top - 36} 72 ${top - 46} 80 ${top - 58} Z`} fill="#fff4d6" />
          </g>
        )}
        <path d="M24 470 H136 L126 500 H34 Z" fill="#6b5a3e" />
      </svg>
      <span className="candle-time">{clock(left)}</span>
    </div>
  );
}
