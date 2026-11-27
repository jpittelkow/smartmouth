// The banishment reveal on the TV (ADR 0024). One timeline on the server's clock drives sound and picture, so every
// sound has its visual at the same instant, and a TV that reconnects mid-reveal resumes at the current beat:
//   drone → the light closes in · each heartbeat → the light throbs · quill strokes → the name writes itself ·
//   the held silence → everything freezes, even the flames · the bell → a ring of light and the room shakes ·
//   the hiss → the serpent draws itself, the candles flare green · each candle puff → one candle goes out.
// The word players must read (the name, the role) lands still; only light and the background move.
import { useEffect, useState } from 'react';
import type { PublicSeat } from '@smartmouth/protocol';
import { rules, type SnakesHostView } from '@smartmouth/game-snakes';
import { serverNow } from '../../socket.ts';
import { Arms } from './arms.tsx';
import { SFX, captionSound, useCues, type Cue } from './sound.ts';

const B = rules.BANISH_BEATS;
const CANDLES = 7;

export function Drama({ g, seat }: { g: SnakesHostView; seat: (id: string) => PublicSeat | undefined }) {
  const b = g.banished;
  const length = rules.BANISH_MS * (g.drama === 'quick' ? rules.QUICK_SHARE : 1);
  const at = (share: number) => g.stageStart + share * length;
  const [t, setT] = useState(() => (serverNow() - g.stageStart) / length);
  const [beat, setBeat] = useState(0);
  const [ring, setRing] = useState(0);
  const [out, setOut] = useState(0);
  const [green, setGreen] = useState(false);
  const [serpent, setSerpent] = useState(false);
  const [dim, setDim] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((serverNow() - g.stageStart) / length), 100);
    return () => clearInterval(id);
  }, [g.stageStart, length]);

  const snake = b?.role === 'snake';
  useCues(`banish:${g.stageStart}`, () => {
    if (!b) return [];
    const cues: Cue[] = [
      { at: at(B.dark), run: () => { SFX.droneOn(); captionSound('[a low drone]'); } },
    ];
    // The quill: one stroke per step of the ink wipe (the name is written in 9 steps over 1.4 s).
    for (let i = 0; i < 9; i++) cues.push({ at: at(B.name) + i * 155, run: () => { SFX.quill(); if (i === 0) captionSound('[a quill writes the name]'); } });
    // The heartbeat, speeding from 62 to 140 a minute, from the push-in to the held silence.
    // The recorded heartbeat runs across the whole build; without it, each beat is synthesized. Either way the
    // light throbs on the same schedule.
    let recorded = false;
    cues.push({ at: at(B.push), run: () => {
      SFX.droneOff();
      recorded = SFX.heartbeatRun((at(B.hold) - at(B.push)) / 1000);
      captionSound('[a heartbeat, faster and faster]');
    } });
    for (let off = 0, n = 0; at(B.push) + off < at(B.hold) - 150; n++) {
      const p = off / (at(B.hold) - at(B.push));
      const time = at(B.push) + off;
      cues.push({ at: time, run: () => { if (!recorded) SFX.heartbeat(); setBeat((x) => x + 1); } });
      off += 60_000 / (62 + (140 - 62) * p);
    }
    cues.push({ at: at(B.hold), run: () => captionSound('[silence: even the flames stop]') });
    cues.push({ at: at(B.land), run: () => {
      SFX.bell(); setRing((x) => x + 1);
      captionSound(snake ? '[a great bell, then a hiss]' : '[a great bell; the candles go out one by one]');
    } });
    if (snake) {
      cues.push({ at: at(B.land) + 150, run: () => { SFX.hiss(); setSerpent(true); } });
      cues.push({ at: at(B.land) + 500, run: () => { setGreen(true); captionSound('[green fire on every candle]'); } });
    } else {
      for (let i = 0; i < CANDLES; i++) cues.push({ at: at(B.land) + 200 + i * 250, run: () => { SFX.snuff(); setOut(i + 1); } });
      cues.push({ at: at(B.land) + 2100, run: () => { SFX.lute(0); setDim(1); captionSound('[one sad lute note]'); } });
      cues.push({ at: at(B.land) + 2450, run: () => { SFX.lute(1); setDim(2); } });
    }
    return cues;
  });

  if (!b) return null;
  const on = (share: number) => t >= share;
  const holding = on(B.hold) && !on(B.land);
  // A TV that joins after the role has landed draws its end state at once.
  const lateGreen = snake && on(B.land) && (green || t > B.land + 0.1);
  const lateOut = !snake && on(B.land) ? Math.max(out, t > B.land + 0.25 ? CANDLES : 0) : 0;
  return (
    <div className={`sm-drama${on(B.push) ? ' push' : ''}${holding ? ' hold' : ''}${on(B.land) ? ` landed ${snake ? 'snake' : 'guest'}` : ''}`}>
      <div key={`p${beat}`} className={`pool${beat ? ' thump' : ''}`} />
      <div key={`s${ring}`} className={`shake-layer${ring ? ' shake' : ''}`}>
        <div className={`row-candles${lateGreen ? ' green' : ''}`}>
          {Array.from({ length: CANDLES }, (_, i) => <span key={i} className={`cdl${i < lateOut ? ' out' : ''}`}><i /><b /></span>)}
        </div>
      </div>
      {ring > 0 && <div key={`r${ring}`} className="ring" />}
      <div className="body">
        <span className={`arms-wrap${on(B.name) ? ' on' : ''}`}><Arms color={seat(b.id)?.color} size={88} /></span>
        <span className={`name${on(B.name) ? ' on' : ''}`}>{seat(b.id)?.name}</span>
        <span className={`was${on(B.was) ? ' on' : ''}`}>was a</span>
        <span className={`role${on(B.land) ? ' on' : ''}${dim ? ` dim${dim}` : ''}`}>{snake ? 'Snake' : 'Guest'}</span>
        <svg className={`serpent${serpent || (snake && t > B.land + 0.1) ? ' go' : ''}`} viewBox="0 0 900 70" aria-hidden="true">
          <path d="M20 35 C120 -5 190 75 290 35 S460 -5 560 35 S730 75 830 35 L862 26 L880 35 L862 44 L830 35" fill="none" stroke="#5b8a63" strokeWidth="6" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
