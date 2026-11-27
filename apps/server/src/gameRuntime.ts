// Runs a room's game (ADR 0006): starts it with questions from the library, passes intents to the rules, keeps the
// player list and spice level in step with the room, records plays, and ends it. Timers live in ws.ts.
import { isBand, effectiveSpice, type ErrorCode } from '@smartmouth/protocol';
import { DEFAULT_ROUNDS, rules, type TriviaContent, type TriviaIntent } from '@smartmouth/game-trivia';
import type { Db } from './db.ts';
import { pickForGame, recordPlay } from './questions.ts';
import { spiceState, type Room } from './rooms.ts';

type Fail = { ok: false; code: ErrorCode; message: string };

const players = (room: Room) => room.seats.filter((s) => isBand(s.band)).map((s) => ({ id: s.id, band: s.band }));

export function startGame(room: Room, gameId: string, db: Db, now: number): { ok: true } | Fail {
  if (gameId !== 'trivia') return { ok: false, code: 'bad-message', message: 'Unknown game.' };
  if (room.game) return { ok: false, code: 'not-allowed', message: 'A game is already running.' };
  if (room.seats.length === 0) return { ok: false, code: 'not-ready', message: 'Someone has to join first.' };
  const spice = spiceState(room).effective;
  // Spares beyond the rounds let the rules skip questions if the spice goes down mid-game.
  const content = pickForGame(db, { spice, exclude: room.asked, perBand: DEFAULT_ROUNDS + 4 }, now) as TriviaContent;
  const bands = new Set(room.seats.map((s) => s.band));
  const short = [...bands].filter((b) => content[b].length === 0);
  if (short.length === bands.size) {
    return { ok: false, code: 'no-questions', message: 'There are no live questions for these ages yet. Add some in the admin page.' };
  }
  room.game = { id: 'trivia', state: rules.init(players(room), { rounds: DEFAULT_ROUNDS, spice }, content, now), logged: 0 };
  room.notice = null;
  return { ok: true };
}

/** Validates a game intent from a socket. The TV (host) may only answer for a Little's turn, or skip. */
export function gameIntent(room: Room, actor: { kind: 'host' } | { kind: 'player'; seatId: string }, raw: unknown, now: number): boolean {
  if (!room.game || !raw || typeof raw !== 'object') return false;
  const x = raw as Record<string, unknown>;
  const choice = typeof x.choice === 'number' && Number.isInteger(x.choice) ? x.choice : -1;
  let intent: TriviaIntent;
  if (x.type === 'answer' && actor.kind === 'player') intent = { type: 'answer', choice };
  else if (x.type === 'answerFor' && actor.kind === 'host' && typeof x.playerId === 'string') intent = { type: 'answerFor', playerId: x.playerId, choice };
  else return false;
  const before = room.game.state;
  room.game.state = rules.intent(before, actor.kind === 'player' ? actor.seatId : 'host', intent, now);
  return room.game.state !== before;
}

export function skip(room: Room, now: number): void {
  if (room.game) room.game.state = rules.intent(room.game.state, 'host', { type: 'skip' }, now);
}

export function tickGame(room: Room, now: number): void {
  if (room.game) room.game.state = rules.tick(room.game.state, now);
}

export function deadline(room: Room): number | null {
  return room.game ? rules.nextDeadline(room.game.state) : null;
}

/** Someone joined, left or was kicked; or the spice changed. Keeps the game in step with the room. */
export function syncRoom(room: Room, now: number): void {
  if (!room.game) return;
  const bands = room.seats.map((s) => s.band);
  let s = rules.setPlayers(room.game.state, players(room), now);
  s = rules.setSpice(s, effectiveSpice(room.spiceChosen, bands));
  room.game.state = s;
}

/** Records new plays in the library's stats and remembers the questions asked tonight. */
export function drainLog(room: Room, db: Db, now: number): void {
  const g = room.game;
  if (!g) return;
  for (const play of g.state.log.slice(g.logged)) {
    recordPlay(db, play.questionId, play.right, play.ms, now);
    room.asked.add(play.questionId);
  }
  g.logged = g.state.log.length;
}

/** Back to the lobby. A finished game's scores go onto the night's totals. */
export function endGame(room: Room): void {
  const g = room.game;
  if (!g) return;
  if (rules.isOver(g.state)) {
    for (const seat of room.seats) seat.score += g.state.players[seat.id]?.score ?? 0;
  }
  room.game = null;
}
