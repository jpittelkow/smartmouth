// What the platform needs from each game (ADR 0006). A game's rules package stays pure; its adapter here is the
// server-side glue: picking content, checking a client's raw intent, and choosing what Salty says at each stage.
import type { Drama, ErrorCode, GameLength, QuestionLevel, GameManifest, GamePlayer, QuestionReads, Spice } from '@smartmouth/protocol';
import type { Db } from '../db.ts';
import type { Moment } from '../voice.ts';

export type Actor = { kind: 'host' } | { kind: 'player'; seatId: string };
export type Fail = { ok: false; code: ErrorCode; message: string };

export interface StartInput {
  players: GamePlayer[];
  spice: Spice;
  seed: number;
  drama: Drama;
  /** Short, Medium or Long (each game decides what that means). */
  length: GameLength;
  /** How hard the questions should be (trivia). */
  level: QuestionLevel;
  db: Db;
  /** Questions already asked in this room tonight. */
  exclude: ReadonlySet<number>;
  now: number;
}

/** One question played, for the library's stats (per question, never per person: ADR 0016). */
export interface Play {
  questionId: number; right: boolean; ms: number | null;
  /** Who played it: a house bot's plays don't count in the library's stats (they'd skew how hard a question looks). */
  player?: string;
}

/** What Salty can use when a game decides what he says (salty.ts supplies these). */
export interface SaltyTools {
  /** A line for a moment at or below the room's spice, avoiding recent ones; with its recording, if any. */
  line(moment: Moment): { text: string; clip: string | null } | null;
  /** Recordings for a question. */
  reads(questionId: number): QuestionReads;
}

/** What Salty says now: the caption text (before bleeping) and the clips to play in order. */
export interface Say {
  text: string | null;
  clips: string[];
  /** Timed parts (ADR 0024): each said at `at` (server time). */
  parts?: Array<{ at: number; text: string | null; clip: string | null }>;
}

export interface GameAdapter<S = unknown> {
  manifest: GameManifest;
  start(input: StartInput): { ok: true; state: S } | Fail;
  /** A raw intent from a socket, checked here. Returns the same state object when nothing changed. */
  intent(state: S, actor: Actor, raw: unknown, now: number): S;
  /** A grown-up pressed Next: end the current wait. */
  skip(state: S, now: number): S;
  tick(state: S, now: number): S;
  deadline(state: S): number | null;
  /** Players joined or left, or the spice changed. */
  sync(state: S, players: GamePlayer[], spice: Spice, now: number): S;
  hostView(state: S): unknown;
  playerView(state: S, seatId: string): unknown;
  isOver(state: S): boolean;
  /** Points each seat earned, added to the night's totals when the game ends. */
  scores(state: S): Record<string, number>;
  /** Every question played so far (the platform records the new ones). */
  plays(state: S): readonly Play[];
  /**
   * Whether this game's plays count in the library's stats and freshness. Only trivia's do: Snake Manor borrows questions
   * for its missions, and its (often bot-filled) test games made the library think 100 questions had just been asked
   * (2026-11-27). Plays still keep the night from repeating a question either way.
   */
  countsStats?: boolean;
  /** Questions on screen now, so the library can mark them shown the moment they appear (optional). */
  shown?(state: S): number[];
  /** Move every clock in the state forward by `ms` (the game was paused that long). */
  shift?(state: S, ms: number): S;
  /** Keep the current pause going until `until` (Salty is still talking). Optional; never shortens a wait. */
  hold?(state: S, until: number): S;
  /**
   * A house bot's moves right now (raw intents, as a phone would send them), decided only from that bot's own
   * player view, so a bot knows no more than a person in its seat. Empty when it has nothing to do.
   */
  bot?(state: S, seatId: string, rand: () => number): unknown[];
  /** Changes whenever Salty should say something new. */
  stageKey(state: S): string;
  /** What Salty says at the current stage. */
  say(state: S, tools: SaltyTools): Say;
  /** Recordings the TV may hold ahead of their moment (trivia's Little turn). */
  reads?(state: S, tools: SaltyTools): { question: QuestionReads | null; turn: QuestionReads | null };
}
