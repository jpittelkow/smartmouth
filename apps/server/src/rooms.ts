// Rooms live in memory only (ADR 0004, 0005, 0016). Everything here is pure apart from token/code generation:
// the socket layer (ws.ts) calls these and sends the views.
import {
  AVATAR_COUNT, MAX_PLAYERS, type Drama, type GameLength, type QuestionLevel, type SetupView, type VoiceId, NAME_MAX, PLAYER_COLORS, effectiveSpice, spiceCap,
  type Band, type ErrorCode, type GameManifest, type HostGameView, type HostLobbyView, type PlayerGameView,
  type PlayerLobbyView, type PublicSeat, type Spice, type SpiceState,
} from '@smartmouth/protocol';
import { adapterFor } from './adapters/index.ts';
import { newSalty, type SaltyState } from './salty.ts';
import { makeCode, makeToken, normalizeCode } from './codes.ts';

/** A room with no host and no players connected is deleted after this long. */
export const IDLE_MS = 15 * 60 * 1000;

export interface Seat {
  id: string;
  token: string;
  name: string;
  band: Band;
  avatar: number;
  color: string;
  score: number;
  connected: boolean;
  /** A house bot (no phone): the server plays it from its own view (bots.ts). */
  bot?: boolean;
}

export interface Room {
  code: string;
  hostToken: string;
  hostConnected: boolean;
  seats: Seat[];
  spiceChosen: Spice;
  voice: VoiceId;
  /** Full drama or Quick for staged reveals (ADR 0024). */
  drama: Drama;
  /** How long the next game runs (owner, 2026-11-27). */
  length: GameLength;
  /** How hard the next game's questions are (picked on the TV). */
  level: QuestionLevel;
  /** A game being set up on the TV, or null. */
  setup: null | { gameId: string; step: SetupView['step']; ready: Set<string>; startsAt: number | null };
  /** When a grown-up paused the game (every clock stops), or null. */
  pausedAt: number | null;
  notice: string | null;
  /** Last time anything was connected or anything happened. */
  lastActive: number;
  nextSeat: number;
  /** The game being played, if any. */
  game: RunningGame | null;
  /** Questions asked in this room tonight, so the next game doesn't repeat them (ADR 0010). */
  asked: Set<number>;
  /** What Salty is saying (salty.ts). */
  salty: SaltyState;
}

export interface RunningGame {
  id: string;
  /** The game's own state; only its adapter (adapters/) reads it. */
  state: unknown;
  /** The random seed the game started from (ADR 0023). */
  seed: number;
  /** How many of state.log's plays have been recorded in the library. */
  logged: number;
  /** Questions already marked as shown (so a game ended early doesn't ask them again first next time). */
  shown?: number[];
}

export type Result<T> = { ok: true; value: T } | { ok: false; code: ErrorCode; message: string };

const fail = (code: ErrorCode, message: string): { ok: false; code: ErrorCode; message: string } => ({ ok: false, code, message });

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  // Drop control and invisible characters, collapse whitespace.
  const name = raw.replace(/[\p{Cc}\p{Cf}]/gu, '').replace(/\s+/g, ' ').trim();
  if (name.length < 1) return null;
  return [...name].slice(0, NAME_MAX).join('');
}

export class RoomStore {
  rooms = new Map<string, Room>();

  create(now: number): Room {
    const code = makeCode((c) => this.rooms.has(c));
    const room: Room = {
      code, hostToken: makeToken(), hostConnected: false, seats: [], spiceChosen: 'spicy', voice: 'female', drama: 'full', length: 'short', level: 'mixed', setup: null, pausedAt: null,
      notice: null, lastActive: now, nextSeat: 1, game: null, asked: new Set(), salty: newSalty(),
    };
    this.rooms.set(code, room);
    return room;
  }

  get(rawCode: string): Room | undefined {
    return this.rooms.get(normalizeCode(rawCode));
  }

  join(room: Room, input: { name: unknown; band: Band; avatar: unknown }, now: number): Result<Seat> {
    if (room.seats.length >= MAX_PLAYERS) return fail('room-full', `This room is full (${MAX_PLAYERS} players).`);
    const base = cleanName(input.name);
    if (!base) return fail('bad-name', 'Type a name first.');
    const avatar = typeof input.avatar === 'number' && Number.isInteger(input.avatar) && input.avatar >= 0 && input.avatar < AVATAR_COUNT
      ? input.avatar : 0;
    const seat: Seat = {
      id: `s${room.nextSeat++}`, token: makeToken(), name: uniqueName(room, base), band: input.band, avatar,
      color: freeColor(room), score: 0, connected: true,
    };
    room.seats.push(seat);
    room.lastActive = now;
    return { ok: true, value: seat };
  }

  /** A house bot: a grown-up seat with no phone, always connected, never the admin. */
  addBot(room: Room, now: number): Result<Seat> {
    if (room.seats.length >= MAX_PLAYERS) return fail('room-full', `This room is full (${MAX_PLAYERS} players).`);
    const name = BOT_NAMES.find((n) => !room.seats.some((s) => s.name === n)) ?? `Bot ${room.nextSeat}`;
    const r = this.join(room, { name, band: 'grownups', avatar: room.nextSeat % AVATAR_COUNT }, now);
    if (r.ok) r.value.bot = true;
    return r;
  }

  seatByToken(room: Room, token: unknown): Seat | undefined {
    if (typeof token !== 'string' || token.length === 0) return undefined;
    return room.seats.find((s) => s.token === token);
  }

  remove(room: Room, seatId: string, now: number): Seat | undefined {
    const i = room.seats.findIndex((s) => s.id === seatId);
    if (i < 0) return undefined;
    const [seat] = room.seats.splice(i, 1);
    room.lastActive = now;
    return seat;
  }

  /** Deletes rooms that have had nothing connected for IDLE_MS. Returns the deleted codes. */
  sweep(now: number): string[] {
    const gone: string[] = [];
    for (const room of this.rooms.values()) {
      // Bots don't keep a room alive.
      const anyone = room.hostConnected || room.seats.some((s) => s.connected && !s.bot);
      if (anyone) room.lastActive = now;
      else if (now - room.lastActive > IDLE_MS) gone.push(room.code);
    }
    for (const code of gone) this.rooms.delete(code);
    return gone;
  }
}

function uniqueName(room: Room, base: string): string {
  const taken = new Set(room.seats.map((s) => s.name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const suffix = ` ${n}`;
    const name = [...base].slice(0, NAME_MAX - suffix.length).join('') + suffix;
    if (!taken.has(name.toLowerCase())) return name;
  }
}

function freeColor(room: Room): string {
  const used = new Set(room.seats.map((s) => s.color));
  return PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[0];
}

/** The first grown-up to join is the admin; it moves on when they leave (ADR 0005). A bot never is. */
/** The setup as the TV and phones see it; bots are always ready. */
export function setupView(room: Room): SetupView | null {
  const s = room.setup;
  if (!s || room.game) return null;
  const ready = room.seats.filter((x) => x.bot || s.ready.has(x.id)).map((x) => x.id);
  return { gameId: s.gameId, step: s.step, asksLevel: s.gameId === 'trivia', level: room.level, ready, startsAt: s.startsAt };
}

export function adminSeatId(room: Room): string | null {
  return room.seats.find((s) => s.band === 'grownups' && !s.bot)?.id ?? null;
}

/** House bots' names: made up, never a real person (CLAUDE.md privacy rule). */
const BOT_NAMES = ['Bot Agnes', 'Bot Bertram', 'Bot Cecily', 'Bot Dunstan', 'Bot Edith', 'Bot Fulke', 'Bot Godric', 'Bot Hilde', 'Bot Ivo', 'Bot Joan'];

export function spiceState(room: Room): SpiceState {
  const bands = room.seats.map((s) => s.band);
  return { chosen: room.spiceChosen, cap: spiceCap(bands), effective: effectiveSpice(room.spiceChosen, bands) };
}

function publicSeat(room: Room, s: Seat): PublicSeat {
  return {
    id: s.id, name: s.name, band: s.band, avatar: s.avatar, color: s.color, score: s.score,
    connected: s.connected, isAdmin: adminSeatId(room) === s.id, isBot: !!s.bot,
  };
}

export function hostView(
  room: Room, joinUrl: string, games: GameManifest[], reads: HostGameView['reads'] = { question: null, turn: null },
): HostLobbyView | HostGameView {
  if (room.game) {
    return {
      role: 'host', phase: 'game', gameId: room.game.id, code: room.code, joinUrl,
      players: room.seats.map((s) => publicSeat(room, s)), spice: spiceState(room), voice: room.voice, drama: room.drama, length: room.length, paused: room.pausedAt !== null, game: adapterFor(room.game.id).hostView(room.game.state),
      salty: room.salty.cue, reads,
    };
  }
  return {
    role: 'host', phase: 'lobby', code: room.code, joinUrl,
    players: room.seats.map((s) => publicSeat(room, s)), spice: spiceState(room), voice: room.voice, drama: room.drama, length: room.length, games, setup: setupView(room),
    notice: room.notice, salty: room.salty.cue,
  };
}

export function playerView(room: Room, seat: Seat, games: GameManifest[]): PlayerLobbyView | PlayerGameView {
  if (room.game) {
    return {
      role: 'player', phase: 'game', gameId: room.game.id, code: room.code, you: publicSeat(room, seat),
      playerCount: room.seats.length, players: room.seats.map((s) => publicSeat(room, s)), spice: spiceState(room), voice: room.voice, drama: room.drama, length: room.length, paused: room.pausedAt !== null,
      game: adapterFor(room.game.id).playerView(room.game.state, seat.id),
    };
  }
  return {
    role: 'player', phase: 'lobby', code: room.code, you: publicSeat(room, seat),
    playerCount: room.seats.length, spice: spiceState(room), voice: room.voice, drama: room.drama, length: room.length, games, setup: setupView(room), notice: room.notice,
  };
}
