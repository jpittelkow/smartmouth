// The live socket: turns client intents into room changes and sends every client its own view (ADR 0004).
import type { IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { isBand, isDrama, isLength, isSpice, isVoice, type ClientMsg, type ErrorCode, type ServerMsg } from '@smartmouth/protocol';
import { RoomStore, hostView, playerView, adminSeatId, type Room } from './rooms.ts';
import { GAMES, findGame } from './games.ts';
import { RateLimit, clientAddress, originAllowed } from './limits.ts';
import { normalizeCode } from './codes.ts';
import type { Db } from './db.ts';
import { botMovesFor, holdForSpeech, pauseGame, resumeGame, deadline, drainLog, endGame, gameIntent, pruneLimits, skip, startGame, syncRoom, tickGame } from './gameRuntime.ts';
import { idleCue, cueJoin, readsFor, updateSalty } from './salty.ts';
import type { VoiceBank } from './voice.ts';
import type { BotMinds } from './botMinds.ts';

export interface SocketOptions {
  /** The address phones use, shown on the TV. Falls back to the host page's own origin. */
  publicUrl: string | null;
  allowedOrigins: ReadonlySet<string>;
  /** Which peers may vouch for the client's address (limits.ts trustedProxies). */
  trusted?: (addr: string | undefined) => boolean;
  /** The question library, for picking a game's questions and recording plays. */
  db: Db;
  /** Salty's lines and recordings; null in tests that don't need him. */
  voice?: VoiceBank | null;
  /** Bots that think with a model (Snake Manor); without it bots use the simple rules only. */
  minds?: BotMinds | null;
  now?: () => number;
}

type Conn =
  | { kind: 'none' }
  | { kind: 'host'; code: string }
  | { kind: 'player'; code: string; seatId: string };

interface Client {
  ws: WebSocket;
  ip: string;
  origin: string | undefined;
  conn: Conn;
  msgWindow: number;
  msgCount: number;
}

const MAX_MSG_BYTES = 4096;
const MAX_MSGS_PER_SEC = 30;

export function attachSockets(wss: WebSocketServer, store: RoomStore, opts: SocketOptions) {
  const now = opts.now ?? Date.now;
  const joinLimit = new RateLimit(20, 60_000);
  const createLimit = new RateLimit(10, 60_000);
  const clients = new Set<Client>();

  const send = (c: Client, msg: ServerMsg) => { if (c.ws.readyState === WebSocket.OPEN) c.ws.send(JSON.stringify(msg)); };
  const error = (c: Client, code: ErrorCode, message: string) => send(c, { t: 'error', code, message });

  const joinUrlFor = (c: Client, room: Room) => {
    const base = opts.publicUrl ?? c.origin ?? '';
    return `${base.replace(/\/$/, '')}/play?code=${room.code}`;
  };

  /** A beat after Salty stops talking before the game moves on. */
const SPEECH_TAIL_MS = 1200;

  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  /** One pending move per house bot (`code:seatId`). */
  const botTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** One pending line at the table per bot (`code:seatId`), and how many lines each bot has said per window. */
  const talkTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const talked = new Map<string, number>();
  const minds = opts.minds ?? null;
  let stopped = false;

  /** After any change: record plays, re-arm the game's timer, then send everyone their view. */
  function broadcast(room: Room) {
    if (stopped) return; // shutting down: the database may already be closed
    settle(room);
    send_views(room);
  }

  function settle(room: Room) {
    const t = now();
    drainLog(room, opts.db, t);
    // The game's pause waits for Salty to finish (plus a beat), so he isn't cut off.
    const speech = updateSalty(room, opts.voice ?? null, t);
    if (speech > 0) holdForSpeech(room, t + speech + SPEECH_TAIL_MS);
    clearTimeout(timers.get(room.code));
    timers.delete(room.code);
    if (room.pausedAt !== null) return; // paused: no clock runs, no bot moves
    const due = deadline(room);
    if (due !== null) {
      timers.set(room.code, setTimeout(() => {
        timers.delete(room.code);
        if (!store.rooms.has(room.code)) return;
        tickGame(room, now());
        broadcast(room);
      }, Math.max(0, due - t) + 5));
    }
    scheduleBots(room);
    scheduleTalk(room);
  }

  /**
   * House bots act a human-ish moment after something changes: each bot with something to do gets one timer, and
   * when it fires the bot looks again at its own view and sends what a phone would.
   */
  function scheduleBots(room: Room) {
    if (!room.game || room.pausedAt !== null) return;
    for (const seat of room.seats) {
      const key = `${room.code}:${seat.id}`;
      if (!seat.bot || botTimers.has(key) || botMovesFor(room, seat.id).length === 0) continue;
      botTimers.set(key, setTimeout(() => {
        botTimers.delete(key);
        if (stopped || !store.rooms.has(room.code) || !room.game || room.pausedAt !== null) return;
        const act = (intents: unknown[]) => {
          let changed = false;
          for (const intent of intents) changed = gameIntent(room, { kind: 'player', seatId: seat.id }, intent, now()) || changed;
          return changed;
        };
        const kind = minds?.decision(room, seat.id) ?? null;
        if (!minds || !kind) { if (act(botMovesFor(room, seat.id))) broadcast(room); else scheduleBots(room); return; }
        // Thinking: hold this bot's slot until the model answers, then fill any gap with the simple rules.
        botTimers.set(key, setTimeout(() => {}, 0));
        void minds.think(room, seat.id, kind).then((intents) => {
          botTimers.delete(key);
          if (stopped || !store.rooms.has(room.code) || !room.game || room.pausedAt !== null) return;
          const a = intents ? act(intents) : false;
          const b = act(botMovesFor(room, seat.id));
          if (a || b) broadcast(room); else scheduleBots(room);
        });
      }, 900 + Math.random() * 2200));
    }
  }

  /**
   * Thinking bots talk at the table: during the Round Table each says a line or two a few seconds apart, reading
   * what was said before (so they answer each other and the humans). Only with a model; the simple bots stay quiet.
   */
  function scheduleTalk(room: Room) {
    if (!minds || !room.game || room.pausedAt !== null) return;
    const bots = room.seats.filter((x) => x.bot).length;
    for (const seat of room.seats) {
      const key = `${room.code}:${seat.id}`;
      if (!seat.bot || talkTimers.has(key)) continue;
      const w = minds.talkWindow(room, seat.id, bots);
      if (!w) continue;
      const said = talked.get(`${key}:${w.key}`) ?? 0;
      if (said >= w.max) continue;
      const wait = said === 0 ? 4000 + Math.random() * 16_000 : 22_000 + Math.random() * 25_000;
      talkTimers.set(key, setTimeout(() => {
        if (stopped || !store.rooms.has(room.code) || !room.game || room.pausedAt !== null) { talkTimers.delete(key); return; }
        const now_w = minds.talkWindow(room, seat.id, bots);
        if (!now_w || now_w.key !== w.key) { talkTimers.delete(key); scheduleTalk(room); return; }
        talked.set(`${key}:${w.key}`, said + 1);
        void minds.think(room, seat.id, 'talk').then((intents) => {
          talkTimers.delete(key);
          if (stopped || !store.rooms.has(room.code) || !room.game) return;
          let changed = false;
          for (const intent of intents ?? []) changed = gameIntent(room, { kind: 'player', seatId: seat.id }, intent, now()) || changed;
          if (changed) broadcast(room); else scheduleTalk(room);
        });
      }, wait));
    }
  }

  function send_views(room: Room) {
    const t = now();
    for (const c of clients) {
      if (c.conn.kind === 'host' && c.conn.code === room.code) {
        send(c, { t: 'view', view: hostView(room, joinUrlFor(c, room), GAMES, readsFor(room, opts.voice ?? null, t)), serverNow: t });
      } else if (c.conn.kind === 'player' && c.conn.code === room.code) {
        const seatId = c.conn.seatId;
        const seat = room.seats.find((s) => s.id === seatId);
        if (seat) send(c, { t: 'view', view: playerView(room, seat, GAMES), serverNow: t });
      }
    }
  }

  /** Recomputes who is connected from the open sockets, so a dropped socket shows as away. */
  function refreshPresence(room: Room) {
    room.hostConnected = [...clients].some((c) => c.conn.kind === 'host' && c.conn.code === room.code);
    for (const seat of room.seats) {
      seat.connected = !!seat.bot || [...clients].some((c) => c.conn.kind === 'player' && c.conn.code === room.code && c.conn.seatId === seat.id);
    }
  }

  /** One socket per role: a newer socket for the same host or seat replaces the older one. */
  function takeOver(c: Client, conn: Conn) {
    for (const other of clients) {
      if (other === c || other.conn.kind !== conn.kind) continue;
      const same = conn.kind === 'host'
        ? other.conn.kind === 'host' && other.conn.code === conn.code
        : conn.kind === 'player' && other.conn.kind === 'player' && other.conn.code === conn.code && other.conn.seatId === conn.seatId;
      if (same) { other.conn = { kind: 'none' }; other.ws.close(4000, 'replaced'); }
    }
    c.conn = conn;
  }

  function roomOf(c: Client): Room | undefined {
    return c.conn.kind === 'none' ? undefined : store.get(c.conn.code);
  }

  function isAdmin(c: Client, room: Room): boolean {
    if (c.conn.kind === 'host') return true;
    return c.conn.kind === 'player' && adminSeatId(room) === c.conn.seatId;
  }

  function handle(c: Client, msg: ClientMsg) {
    const t = now();
    switch (msg.t) {
      case 'ping': return send(c, { t: 'pong', serverNow: t });

      case 'host:create': {
        if (!createLimit.allow(c.ip, t)) return error(c, 'rate', 'Too many new rooms. Wait a minute.');
        const room = store.create(t);
        takeOver(c, { kind: 'host', code: room.code });
        send(c, { t: 'host:welcome', code: room.code, token: room.hostToken });
        refreshPresence(room);
        return broadcast(room);
      }

      case 'host:resume': {
        const room = store.get(String(msg.code ?? ''));
        if (!room || room.hostToken !== msg.token) return error(c, 'bad-token', 'That room has ended.');
        takeOver(c, { kind: 'host', code: room.code });
        send(c, { t: 'host:welcome', code: room.code, token: room.hostToken });
        refreshPresence(room);
        return broadcast(room);
      }

      case 'player:join': {
        if (!joinLimit.allow(c.ip, t)) return error(c, 'rate', 'Too many tries. Wait a minute.');
        const room = store.get(String(msg.code ?? ''));
        if (!room) return error(c, 'no-room', 'No room with that code. Check the TV.');
        if (!isBand(msg.band)) return error(c, 'bad-message', 'Pick an age.');
        const r = store.join(room, { name: msg.name, band: msg.band, avatar: msg.avatar }, t);
        if (!r.ok) return error(c, r.code, r.message);
        takeOver(c, { kind: 'player', code: room.code, seatId: r.value.id });
        send(c, { t: 'player:welcome', code: room.code, token: r.value.token, seatId: r.value.id });
        refreshPresence(room);
        syncRoom(room, t);
        cueJoin(room);
        return broadcast(room);
      }

      case 'player:resume': {
        if (!joinLimit.allow(c.ip, t)) return error(c, 'rate', 'Too many tries. Wait a minute.');
        const room = store.get(String(msg.code ?? ''));
        const seat = room && store.seatByToken(room, msg.token);
        if (!room || !seat) return error(c, 'bad-token', 'That seat is gone. Join again.');
        takeOver(c, { kind: 'player', code: room.code, seatId: seat.id });
        send(c, { t: 'player:welcome', code: room.code, token: seat.token, seatId: seat.id });
        refreshPresence(room);
        return broadcast(room);
      }

      case 'player:avatar': {
        const room = roomOf(c);
        if (!room || c.conn.kind !== 'player') return error(c, 'not-allowed', 'Join a room first.');
        const seatId = c.conn.seatId;
        const seat = room.seats.find((s) => s.id === seatId);
        if (seat && Number.isInteger(msg.avatar) && msg.avatar >= 0 && msg.avatar < 8) seat.avatar = msg.avatar;
        return broadcast(room);
      }

      case 'player:leave': {
        const room = roomOf(c);
        if (!room || c.conn.kind !== 'player') return;
        store.remove(room, c.conn.seatId, t);
        c.conn = { kind: 'none' };
        refreshPresence(room);
        syncRoom(room, t);
        return broadcast(room);
      }

      case 'admin:spice': {
        const room = roomOf(c);
        if (!room || !isAdmin(c, room)) return error(c, 'not-allowed', 'Only a grown-up can do that.');
        if (!isSpice(msg.spice)) return error(c, 'bad-message', 'Unknown spice level.');
        room.spiceChosen = msg.spice;
        // In the lobby Salty speaks again at the new level, so the room hears the change (owner's TV test, 2026-11-27).
        if (!room.game) room.salty.stageKey = '';
        syncRoom(room, t);
        return broadcast(room);
      }

      case 'admin:voice': {
        const room = roomOf(c);
        if (!room || !isAdmin(c, room)) return error(c, 'not-allowed', 'Only a grown-up can do that.');
        if (!isVoice(msg.voice)) return error(c, 'bad-message', 'Unknown voice.');
        room.voice = msg.voice;
        // In the lobby Salty says hello again, so the room hears the new voice.
        if (!room.game) room.salty.stageKey = '';
        syncRoom(room, t);
        return broadcast(room);
      }

      case 'admin:length': {
        const room = roomOf(c);
        if (!room || !isAdmin(c, room)) return error(c, 'not-allowed', 'Only a grown-up can do that.');
        if (!isLength(msg.length)) return error(c, 'bad-message', 'Unknown game length.');
        room.length = msg.length; // used by the next game that starts
        return broadcast(room);
      }

      case 'admin:drama': {
        const room = roomOf(c);
        if (!room || !isAdmin(c, room)) return error(c, 'not-allowed', 'Only a grown-up can do that.');
        if (!isDrama(msg.drama)) return error(c, 'bad-message', 'Unknown drama setting.');
        room.drama = msg.drama; // used by the next game that starts
        return broadcast(room);
      }

      case 'admin:pause': {
        const room = roomOf(c);
        if (!room || !isAdmin(c, room)) return error(c, 'not-allowed', 'Only a grown-up can do that.');
        if (msg.paused) pauseGame(room, t); else resumeGame(room, t);
        return broadcast(room);
      }

      case 'admin:bots': {
        const room = roomOf(c);
        if (!room || !isAdmin(c, room)) return error(c, 'not-allowed', 'Only a grown-up can do that.');
        if (room.game) return error(c, 'not-allowed', 'Add or remove bots in the lobby.');
        if (msg.add) {
          const r = store.addBot(room, t);
          if (!r.ok) return error(c, r.code, r.message);
          cueJoin(room);
        } else {
          for (const seat of room.seats.filter((x) => x.bot)) store.remove(room, seat.id, t);
        }
        return broadcast(room);
      }

      case 'admin:kick': {
        const room = roomOf(c);
        if (!room || !isAdmin(c, room)) return error(c, 'not-allowed', 'Only a grown-up can do that.');
        const seat = store.remove(room, String(msg.seatId), t);
        if (!seat) return;
        for (const other of clients) {
          if (other.conn.kind === 'player' && other.conn.code === room.code && other.conn.seatId === seat.id) {
            other.conn = { kind: 'none' };
            error(other, 'kicked', 'A grown-up took you out of the game.');
          }
        }
        refreshPresence(room);
        syncRoom(room, t);
        return broadcast(room);
      }

      case 'admin:start': {
        const room = roomOf(c);
        if (!room || !isAdmin(c, room)) return error(c, 'not-allowed', 'Only a grown-up can do that.');
        const game = findGame(msg.gameId);
        if (!game) return error(c, 'bad-message', 'Unknown game.');
        if (!game.ready) {
          room.notice = `${game.name} isn't built yet. Salty is "rehearsing".`;
          return broadcast(room);
        }
        const r = startGame(room, game.id, opts.db, t);
        if (!r.ok) { room.notice = r.message; broadcast(room); return error(c, r.code, r.message); }
        return broadcast(room);
      }

      case 'admin:next': {
        const room = roomOf(c);
        if (!room || !isAdmin(c, room)) return error(c, 'not-allowed', 'Only a grown-up can do that.');
        if (room.pausedAt !== null) return; // Next does nothing while paused
        skip(room, t);
        return broadcast(room);
      }

      case 'admin:end': {
        const room = roomOf(c);
        if (!room || !isAdmin(c, room)) return error(c, 'not-allowed', 'Only a grown-up can do that.');
        endGame(room);
        return broadcast(room);
      }

      case 'game:intent': {
        const room = roomOf(c);
        if (!room || c.conn.kind === 'none') return error(c, 'not-allowed', 'Join a room first.');
        const actor = c.conn.kind === 'host' ? { kind: 'host' as const } : { kind: 'player' as const, seatId: c.conn.seatId };
        if (gameIntent(room, actor, msg.intent, t)) broadcast(room);
        return;
      }

      default:
        return error(c, 'bad-message', 'Unknown message.');
    }
  }

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const origin = req.headers.origin;
    if (!originAllowed(origin, opts.allowedOrigins, req.headers.host)) { ws.close(4003, 'origin'); return; }
    const ip = clientAddress(req.headers, req.socket.remoteAddress, opts.trusted);
    const c: Client = { ws, ip, origin, conn: { kind: 'none' }, msgWindow: 0, msgCount: 0 };
    clients.add(c);

    ws.on('message', (data, isBinary) => {
      const t = now();
      if (t - c.msgWindow >= 1000) { c.msgWindow = t; c.msgCount = 0; }
      if (++c.msgCount > MAX_MSGS_PER_SEC) { ws.close(4008, 'too many messages'); return; }
      const size = Array.isArray(data) ? data.reduce((n, b) => n + b.length, 0) : (data as Buffer | ArrayBuffer).byteLength;
      if (isBinary || size > MAX_MSG_BYTES) return error(c, 'bad-message', 'Message too big.');
      let msg: ClientMsg;
      try { msg = JSON.parse(String(data)); } catch { return error(c, 'bad-message', 'Not JSON.'); }
      if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return error(c, 'bad-message', 'No message type.');
      handle(c, msg);
    });

    ws.on('close', () => {
      const room = roomOf(c);
      clients.delete(c);
      if (room) { refreshPresence(room); room.lastActive = now(); broadcast(room); }
    });
  });

  return {
    /** Salty fills a quiet lobby (salty.ts idleCue). Called every few seconds. */
    lobbyChatter() {
      if (stopped) return;
      const t = now();
      for (const room of store.rooms.values()) if (idleCue(room, t)) broadcast(room);
    },
    sweep() {
      const t = now();
      joinLimit.prune(t);
      createLimit.prune(t);
      pruneLimits(t);
      const gone = store.sweep(t);
      for (const code of gone) {
        clearTimeout(timers.get(code)); timers.delete(code);
        for (const [k, tm] of botTimers) if (k.startsWith(`${code}:`)) { clearTimeout(tm); botTimers.delete(k); }
        for (const [k, tm] of talkTimers) if (k.startsWith(`${code}:`)) { clearTimeout(tm); talkTimers.delete(k); }
        for (const k of talked.keys()) if (k.startsWith(`${code}:`)) talked.delete(k);
        minds?.forget(code);
      }
      return gone;
    },
    clientCount: () => clients.size,
    stop: () => {
      stopped = true;
      for (const tm of timers.values()) clearTimeout(tm);
      for (const tm of botTimers.values()) clearTimeout(tm);
      for (const tm of talkTimers.values()) clearTimeout(tm);
      timers.clear(); botTimers.clear(); talkTimers.clear();
    },
    normalizeCode,
  };
}
