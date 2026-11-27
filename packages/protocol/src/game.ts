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
