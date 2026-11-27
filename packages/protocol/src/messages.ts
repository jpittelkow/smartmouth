// Every message on the socket (ADR 0004). Clients send intents; the server sends views.
import type { Band } from './bands.ts';
import type { Spice } from './spice.ts';
import type { GameManifest } from './game.ts';

export const MAX_PLAYERS = 10;
export const NAME_MAX = 16;
export const AVATAR_COUNT = 8;

export const PLAYER_COLORS = [
  '#ffd23f', '#ff4f7b', '#36dcb8', '#5aa8ff', '#a77bff',
  '#ff9a3c', '#a6e34f', '#ff5a4e', '#3fd0f0', '#f4f0ff',
] as const;

// ---- client → server ----
export type ClientMsg =
  | { t: 'host:create' }
  | { t: 'host:resume'; code: string; token: string }
  | { t: 'player:join'; code: string; name: string; band: Band; avatar: number }
  | { t: 'player:resume'; code: string; token: string }
  | { t: 'player:avatar'; avatar: number }
  | { t: 'player:leave' }
  | { t: 'admin:spice'; spice: Spice }
  | { t: 'admin:kick'; seatId: string }
  | { t: 'admin:pickGame'; gameId: string }
  | { t: 'ping' };

// ---- server → client ----
export type ErrorCode = 'no-room' | 'room-full' | 'bad-name' | 'bad-token' | 'bad-message' | 'rate' | 'kicked' | 'not-allowed' | 'not-ready';

export type ServerMsg =
  | { t: 'host:welcome'; code: string; token: string }
  | { t: 'player:welcome'; code: string; token: string; seatId: string }
  | { t: 'view'; view: HostView | PlayerView; serverNow: number }
  | { t: 'error'; code: ErrorCode; message: string }
  | { t: 'pong'; serverNow: number };

// ---- views ----
export interface PublicSeat {
  id: string;
  name: string;
  band: Band;
  avatar: number;
  color: string;
  score: number;
  connected: boolean;
  isAdmin: boolean;
}

export interface SpiceState {
  chosen: Spice;
  cap: Spice;
  effective: Spice;
}

export interface HostLobbyView {
  role: 'host';
  phase: 'lobby';
  code: string;
  joinUrl: string;
  players: PublicSeat[];
  spice: SpiceState;
  games: GameManifest[];
  notice: string | null;
}

export interface PlayerLobbyView {
  role: 'player';
  phase: 'lobby';
  code: string;
  you: PublicSeat;
  playerCount: number;
  spice: SpiceState;
  games: GameManifest[];
  notice: string | null;
}

export type HostView = HostLobbyView;
export type PlayerView = PlayerLobbyView;
