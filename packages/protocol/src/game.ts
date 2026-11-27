// The interface every game module implements (ADR 0006). Pure: no sockets, timers or I/O.
import type { Band } from './bands.ts';
import type { Spice } from './spice.ts';

export interface GameManifest {
  id: string;
  name: string;
  pitch: string;
  minPlayers: number;
  maxPlayers: number;
  bands: readonly Band[];
  /** False while a game is listed but can't be started yet. */
  ready: boolean;
}

export interface GamePlayer {
  id: string;
  band: Band;
}

export interface GameSettings {
  spice: Spice;
  /**
   * The platform's random seed for this game (ADR 0023). Anything random in the rules (dealing roles, breaking ties)
   * comes from it, so a game replays exactly from its seed and its intents.
   */
  seed: number;
  /** How long a game's staged reveals run (ADR 0024). Games without reveals ignore it. */
  drama: Drama;
}

/** Full drama, or Quick: every held pause cut to a third (ADR 0024). */
export type Drama = 'full' | 'quick';
export const DRAMAS: readonly Drama[] = ['full', 'quick'];
export const isDrama = (v: unknown): v is Drama => v === 'full' || v === 'quick';

/** How long a game runs, set by a grown-up (owner, 2026-11-27). For trivia: questions, with the leaderboard after each. */
export type GameLength = 'short' | 'medium' | 'long';
export const LENGTHS: readonly GameLength[] = ['short', 'medium', 'long'];
export const LENGTH_QUESTIONS: Record<GameLength, number> = { short: 10, medium: 30, long: 50 };
export const LENGTH_LABEL: Record<GameLength, string> = { short: 'Short', medium: 'Medium', long: 'Long' };
export const isLength = (v: unknown): v is GameLength => v === 'short' || v === 'medium' || v === 'long';

/** How hard the questions are, picked on the TV before a game (owner, 2026-11-27). Ranges are question difficulty 1-5. */
export type QuestionLevel = 'mixed' | 'easy' | 'medium' | 'hard';
export const LEVELS: readonly QuestionLevel[] = ['mixed', 'easy', 'medium', 'hard'];
export const LEVEL_LABEL: Record<QuestionLevel, string> = { mixed: 'Mixed', easy: 'Easy', medium: 'Medium', hard: 'Hard' };
export const LEVEL_RANGE: Record<QuestionLevel, [number, number]> = { mixed: [1, 5], easy: [1, 2], medium: [2, 4], hard: [3, 5] };
export const isLevel = (v: unknown): v is QuestionLevel => v === 'mixed' || v === 'easy' || v === 'medium' || v === 'hard';

/**
 * Setting up a game on the TV (owner, 2026-11-27): pick the game, pick the question difficulty, press Ready; then
 * everyone taps Ready on their phone, and a countdown starts it. `ready` lists the seats that are ready (bots always are).
 */
export interface SetupView {
  gameId: string;
  step: 'options' | 'waiting' | 'countdown';
  /** The game uses question difficulty (trivia does; Snake Manor doesn't ask). */
  asksLevel: boolean;
  level: QuestionLevel;
  ready: string[];
  /** When the countdown ends and the game starts. */
  startsAt: number | null;
}

export interface GameModule<State, Intent, HostView, PlayerView> {
  manifest: GameManifest;
  init(players: readonly GamePlayer[], settings: GameSettings, now: number): State;
  intent(state: State, playerId: string, intent: Intent, now: number): State;
  /** Called when `nextDeadline(state)` passes. */
  tick(state: State, now: number): State;
  nextDeadline(state: State): number | null;
  hostView(state: State): HostView;
  playerView(state: State, playerId: string): PlayerView;
  isOver(state: State): boolean;
}
