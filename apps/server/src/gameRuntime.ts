// Runs a room's game (ADR 0006) through that game's adapter: starts it, passes intents to the rules, keeps the
// player list and spice level in step with the room, records plays, and ends it. Timers live in ws.ts.
import { randomInt } from 'node:crypto';
import { BANDS, TEXT_MAX, isBand, effectiveSpice, type GamePlayer } from '@smartmouth/protocol';
import type { Db } from './db.ts';
import { markShown, recordPlay } from './questions.ts';
import { spiceState, type Room } from './rooms.ts';
import { findGame } from './games.ts';
import { RateLimit } from './limits.ts';
import { adapterFor } from './adapters/index.ts';
import type { Actor, Fail } from './adapters/types.ts';

export type { Actor } from './adapters/types.ts';

const players = (room: Room): GamePlayer[] => room.seats.filter((s) => isBand(s.band)).map((s) => ({ id: s.id, band: s.band }));

export function startGame(room: Room, gameId: string, db: Db, now: number, seed: number = randomInt(2 ** 31)): { ok: true } | Fail {
  const manifest = findGame(gameId);
  if (!manifest) return { ok: false, code: 'bad-message', message: 'Unknown game.' };
  if (room.game) return { ok: false, code: 'not-allowed', message: 'A game is already running.' };
  if (room.seats.length === 0) return { ok: false, code: 'not-ready', message: 'Someone has to join first.' };
  if (room.seats.length < manifest.minPlayers) {
    return { ok: false, code: 'not-ready', message: `${manifest.name} needs at least ${manifest.minPlayers} players.` };
  }
  if (room.seats.length > manifest.maxPlayers) {
    return { ok: false, code: 'not-ready', message: `${manifest.name} takes at most ${manifest.maxPlayers} players.` };
  }
  const outside = BANDS.filter((b) => !manifest.bands.includes(b.id) && room.seats.some((s) => s.band === b.id));
  if (outside.length) {
    const who = outside.map((b) => `${b.label} (${b.ages})`).join(' and ');
    return { ok: false, code: 'not-ready', message: `${manifest.name} isn't for ${who} players. Pick another game, or play without them.` };
  }
  const adapter = adapterFor(manifest.id);
  const r = adapter.start({ players: players(room), spice: spiceState(room).effective, seed, drama: room.drama, db, exclude: room.asked, now });
  if (!r.ok) return r;
  room.game = { id: manifest.id, state: r.state, seed, logged: 0 };
  room.notice = null;
  return { ok: true };
}

/** Typed text a player sends in a game (ADR 0023): at most 8 messages per 10 seconds per seat. */
const textLimit = new RateLimit(8, 10_000);

/**
 * Typed text as a game may use it: control and invisible characters dropped, whitespace collapsed, capped at
 * TEXT_MAX characters. Null when nothing is left.
 */
export function cleanText(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.replace(/[\p{Cc}\p{Cf}]/gu, '').replace(/\s+/g, ' ').trim();
  return text ? [...text].slice(0, TEXT_MAX).join('') : null;
}

/**
 * Passes a raw intent from a socket to the game. An intent carrying `text` is a typed message: it's cleaned and
 * rate-limited here, for every game, before the game sees it. True when something changed.
 */
export function gameIntent(room: Room, actor: Actor, raw: unknown, now: number): boolean {
  const g = room.game;
  if (!g || room.pausedAt !== null) return false;
  let intent = raw;
  if (raw && typeof raw === 'object' && 'text' in raw) {
    const text = cleanText((raw as { text: unknown }).text);
    const key = `${room.code}:${actor.kind === 'player' ? actor.seatId : 'host'}`;
    if (!text || !textLimit.allow(key, now)) return false;
    intent = { ...(raw as object), text };
  }
  const before = g.state;
  g.state = adapterFor(g.id).intent(before, actor, intent, now);
  return g.state !== before;
}

/** A grown-up paused the game: the clocks stop (ws.ts arms no timers while paused). */
export function pauseGame(room: Room, now: number): void {
  if (room.game && room.pausedAt === null) room.pausedAt = now;
}

/** Back on: every clock in the game moves forward by the time spent paused, so nobody loses a second. */
export function resumeGame(room: Room, now: number): void {
  const g = room.game;
  if (room.pausedAt === null) return;
  const ms = Math.max(0, now - room.pausedAt);
  room.pausedAt = null;
  const a = g ? adapterFor(g.id) : null;
  if (g && a?.shift) g.state = a.shift(g.state, ms);
}

/** A bot's moves right now (its game's `bot` hook), or none. */
export function botMovesFor(room: Room, seatId: string, rand: () => number = Math.random): unknown[] {
  const g = room.game;
  const a = g ? adapterFor(g.id) : null;
  return g && a?.bot ? a.bot(g.state, seatId, rand) : [];
}

/** Drops old rate-limit windows (called from the socket layer's sweep). */
export function pruneLimits(now: number): void {
  textLimit.prune(now);
}

export function skip(room: Room, now: number): void {
  const g = room.game;
  if (g) g.state = adapterFor(g.id).skip(g.state, now);
}

export function tickGame(room: Room, now: number): void {
  const g = room.game;
  if (g) g.state = adapterFor(g.id).tick(g.state, now);
}

/** Salty is talking until `until`: the game's current pause waits for him. */
export function holdForSpeech(room: Room, until: number): void {
  const g = room.game;
  const a = g ? adapterFor(g.id) : null;
  if (g && a?.hold) g.state = a.hold(g.state, until);
}

export function deadline(room: Room): number | null {
  const g = room.game;
  return g ? adapterFor(g.id).deadline(g.state) : null;
}

/** Someone joined, left or was kicked; or the spice changed. Keeps the game in step with the room. */
export function syncRoom(room: Room, now: number): void {
  const g = room.game;
  if (!g) return;
  const spice = effectiveSpice(room.spiceChosen, room.seats.map((s) => s.band));
  g.state = adapterFor(g.id).sync(g.state, players(room), spice, now);
}

/** Records new plays in the library's stats and remembers the questions asked tonight. */
export function drainLog(room: Room, db: Db, now: number): void {
  const g = room.game;
  if (!g) return;
  const shownNow = adapterFor(g.id).shown?.(g.state) ?? [];
  for (const id of shownNow) {
    if (g.shown?.includes(id)) continue;
    markShown(db, id, now);
    room.asked.add(id);
    (g.shown ??= []).push(id);
  }
  const plays = adapterFor(g.id).plays(g.state);
  for (const play of plays.slice(g.logged)) {
    recordPlay(db, play.questionId, play.right, play.ms, now);
    room.asked.add(play.questionId);
  }
  g.logged = plays.length;
}

/** Back to the lobby. A finished game's scores go onto the night's totals. */
export function endGame(room: Room): void {
  const g = room.game;
  if (!g) return;
  const a = adapterFor(g.id);
  if (a.isOver(g.state)) {
    const scores = a.scores(g.state);
    for (const seat of room.seats) seat.score += scores[seat.id] ?? 0;
  }
  room.game = null;
  room.pausedAt = null;
}
