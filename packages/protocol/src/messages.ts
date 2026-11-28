// Every message on the socket (ADR 0004). Clients send intents; the server sends views.
import type { Band } from './bands.ts';
import type { Spice } from './spice.ts';
import type { Drama, GameLength, GameManifest, QuestionLevel, SetupView } from './game.ts';

export const MAX_PLAYERS = 10;
export const NAME_MAX = 16;
export const AVATAR_COUNT = 8;
/** The longest typed text a game accepts in one message (ADR 0023): the Snake chat, a Guest's note. */
export const TEXT_MAX = 140;

/** Salty comes in two voices; a grown-up picks one per room (owner, 2026-11-27). Each has its own recordings. */
export const VOICES = ['male', 'female'] as const;
export type VoiceId = (typeof VOICES)[number];
export const VOICE_LABEL: Record<VoiceId, string> = { male: 'His voice', female: 'Her voice' };
export const isVoice = (v: unknown): v is VoiceId => (VOICES as readonly unknown[]).includes(v);

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
  | { t: 'admin:voice'; voice: VoiceId }
  /** Full drama or Quick for staged reveals (ADR 0024). */
  | { t: 'admin:drama'; drama: Drama }
  /** Short, Medium or Long, for the next game. */
  | { t: 'admin:length'; length: GameLength }
  /** The TV sets up a game: pick it, pick the question difficulty, Ready (then phones ready up), or Back. */
  | { t: 'setup:pick'; gameId: string }
  | { t: 'setup:level'; level: QuestionLevel }
  | { t: 'setup:ready' }
  | { t: 'setup:back' }
  /** A phone taps Ready (or un-readies) while the TV waits for everyone. */
  | { t: 'player:ready'; ready: boolean }
  | { t: 'admin:kick'; seatId: string }
  /** Pause or resume the game: every clock stops while paused. */
  | { t: 'admin:pause'; paused: boolean }
  /** Add one house bot to the room, or remove them all (lobby only). */
  | { t: 'admin:bots'; add: boolean }
  | { t: 'admin:start'; gameId: string }
  /** End the current wait (reveal, intro, a stalled turn). */
  | { t: 'admin:next' }
  /** Back to the lobby; a finished game's scores are added to the night's totals. */
  | { t: 'admin:end' }
  /** A game's own intent; the game module checks it (ADR 0006). */
  | { t: 'game:intent'; intent: unknown }
  | { t: 'ping' };

// ---- server → client ----
export type ErrorCode = 'no-room' | 'room-full' | 'bad-name' | 'bad-token' | 'bad-message' | 'rate' | 'kicked' | 'not-allowed' | 'not-ready' | 'no-questions';

export type ServerMsg =
  | { t: 'host:welcome'; code: string; token: string }
  | { t: 'player:welcome'; code: string; token: string; seatId: string }
  | { t: 'view'; view: HostView | PlayerView; serverNow: number }
  | { t: 'error'; code: ErrorCode; message: string }
  | { t: 'pong'; serverNow: number };

// ---- views ----
/** What Salty says now (ADR 0013): a caption (bleeped) and audio clips to play in order. `key` changes per line. */
export interface SaltyCue {
  key: string;
  caption: string | null;
  clips: string[];
  /**
   * A line said in timed parts (ADR 0024): each part's caption shows and its clip plays at `at` (server time). The
   * game, not the recording, sets the pause between them. When present, `clips` and `caption` hold the first part.
   */
  parts?: Array<{ at: number; caption: string | null; clip: string | null }>;
  /** At Drunk, how drunk she is (1 Buzzed, 2 Tipsy, 3 Hammered, 4 Gone): the TV shows her face to match. */
  drunk?: number;
}

/** Recordings for a question: the prompt read aloud, each answer (picture questions), the follow-up line. */
export interface QuestionReads { prompt: string | null; answers: Array<string | null>; explain: string | null }

export interface PublicSeat {
  id: string;
  name: string;
  band: Band;
  avatar: number;
  color: string;
  score: number;
  connected: boolean;
  isAdmin: boolean;
  /** A house bot the server plays, for testing a game solo. */
  isBot: boolean;
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
  voice: VoiceId;
  drama: Drama;
  length: GameLength;
  games: GameManifest[];
  /** A game being set up on the TV (null: still picking). */
  setup: SetupView | null;
  /** Seats that have tapped Ready (bots always are); a phone can ready up before the TV is ready. */
  ready: string[];
  notice: string | null;
  salty: SaltyCue | null;
}

export interface PlayerLobbyView {
  role: 'player';
  phase: 'lobby';
  code: string;
  you: PublicSeat;
  playerCount: number;
  spice: SpiceState;
  voice: VoiceId;
  drama: Drama;
  length: GameLength;
  games: GameManifest[];
  /** A game being set up on the TV (null: still picking). */
  setup: SetupView | null;
  /** Seats that have tapped Ready (bots always are); a phone can ready up before the TV is ready. */
  ready: string[];
  notice: string | null;
}

/** A game in progress. `game` is that game's own view (for trivia, TriviaHostView / TriviaPlayerView). */
export interface HostGameView {
  role: 'host';
  phase: 'game';
  gameId: string;
  code: string;
  joinUrl: string;
  players: PublicSeat[];
  spice: SpiceState;
  voice: VoiceId;
  drama: Drama;
  length: GameLength;
  /** A grown-up paused the game: every clock is stopped. */
  paused: boolean;
  game: unknown;
  salty: SaltyCue | null;
  /** Recordings for the TV's question and the Little turn's question (answers are read as focus moves). */
  reads: { question: QuestionReads | null; turn: QuestionReads | null };
}

export interface PlayerGameView {
  role: 'player';
  phase: 'game';
  gameId: string;
  code: string;
  you: PublicSeat;
  playerCount: number;
  players: PublicSeat[];
  spice: SpiceState;
  voice: VoiceId;
  drama: Drama;
  length: GameLength;
  paused: boolean;
  game: unknown;
}

export type HostView = HostLobbyView | HostGameView;
export type PlayerView = PlayerLobbyView | PlayerGameView;
