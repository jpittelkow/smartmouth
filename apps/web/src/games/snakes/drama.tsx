// The banishment reveal on the TV (ADR 0024). Its beats are placed by time since the stage began on the server, so
// a TV that reconnects mid-reveal picks up at the right beat.
import { useEffect, useState } from 'react';
import type { PublicSeat } from '@smartmouth/protocol';
import { rules, type SnakesHostView } from '@smartmouth/game-snakes';
import { serverNow } from '../../socket.ts';
import { Arms } from './arms.tsx';

/** Where each beat falls, as a share of the stage (Full drama: 15 s). The role lands at 11 s. */
export const BANISH_BEATS = { dark: 0, name: 3.5 / 15, push: 5 / 15, was: 8 / 15, hold: 9.5 / 15, land: 11 / 15 };

export function Drama({ g, seat }: { g: SnakesHostView; seat: (id: string) => PublicSeat | undefined }) {
  const b = g.banished;
  const length = rules.BANISH_MS * (g.drama === 'quick' ? rules.QUICK_SHARE : 1);
  const [t, setT] = useState(() => (serverNow() - g.stageStart) / length);
  useEffect(() => {
    const id = setInterval(() => setT((serverNow() - g.stageStart) / length), 100);
    return () => clearInterval(id);
  }, [g.stageStart, length]);
  if (!b) return null;
  const at = (beat: number) => t >= beat;
  const snake = b.role === 'snake';
  return (
    <div className={`sm-drama${at(BANISH_BEATS.push) ? ' push' : ''}${at(BANISH_BEATS.hold) && !at(BANISH_BEATS.land) ? ' hold' : ''}${at(BANISH_BEATS.land) ? ` landed ${snake ? 'snake' : 'guest'}` : ''}`}>
      <div className="pool" />
      <div className="body">
        <span className={`arms-wrap${at(BANISH_BEATS.name) ? ' on' : ''}`}><Arms color={seat(b.id)?.color} size={110} /></span>
        <span className={`name${at(BANISH_BEATS.name) ? ' on' : ''}`}>{seat(b.id)?.name}</span>
        <span className={`was${at(BANISH_BEATS.was) ? ' on' : ''}`}>was a</span>
        <span className={`role${at(BANISH_BEATS.land) ? ' on' : ''}`}>{snake ? 'Snake' : 'Guest'}</span>
      </div>
    </div>
  );
}
