// The live socket: turns client intents into room changes and sends every client its own view (ADR 0004).
import type { IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { isBand, isSpice, type ClientMsg, type ErrorCode, type ServerMsg } from '@smartmouth/protocol';
import { RoomStore, hostView, playerView, adminSeatId, type Room } from './rooms.ts';
import { GAMES, findGame } from './games.ts';
import { RateLimit, clientAddress, originAllowed } from './limits.ts';
import { normalizeCode } from './codes.ts';

export interface SocketOptions {
  /** The address phones use, shown on the TV. Falls back to the host page's own origin. */
  publicUrl: string | null;
  allowedOrigins: ReadonlySet<string>;
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

  function broadcast(room: Room) {
    const t = now();
    for (const c of clients) {
      if (c.conn.kind === 'host' && c.conn.code === room.code) {
        send(c, { t: 'view', view: hostView(room, joinUrlFor(c, room), GAMES), serverNow: t });
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
      seat.connected = [...clients].some((c) => c.conn.kind === 'player' && c.conn.code === room.code && c.conn.seatId === seat.id);
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
        return broadcast(room);
      }

      case 'admin:spice': {
        const room = roomOf(c);
        if (!room || !isAdmin(c, room)) return error(c, 'not-allowed', 'Only a grown-up can do that.');
        if (!isSpice(msg.spice)) return error(c, 'bad-message', 'Unknown spice level.');
        room.spiceChosen = msg.spice;
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
        return broadcast(room);
      }

      case 'admin:pickGame': {
        const room = roomOf(c);
        if (!room || !isAdmin(c, room)) return error(c, 'not-allowed', 'Only a grown-up can do that.');
        const game = findGame(msg.gameId);
        if (!game) return error(c, 'bad-message', 'Unknown game.');
        if (!game.ready) {
          room.notice = `${game.name} isn't built yet. Salty is "rehearsing".`;
          return broadcast(room);
        }
        return error(c, 'not-ready', 'Starting games comes in build step 2.');
      }

      default:
        return error(c, 'bad-message', 'Unknown message.');
    }
  }

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const origin = req.headers.origin;
    if (!originAllowed(origin, opts.allowedOrigins, req.headers.host)) { ws.close(4003, 'origin'); return; }
    const ip = clientAddress(req.headers, req.socket.remoteAddress);
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
    sweep() {
      const t = now();
      joinLimit.prune(t);
      createLimit.prune(t);
      return store.sweep(t);
    },
    clientCount: () => clients.size,
    normalizeCode,
  };
}
