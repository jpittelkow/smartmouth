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
