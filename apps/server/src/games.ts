// The fixed list of games (ADR 0006). Add a game by importing its manifest here.
import type { GameManifest } from '@smartmouth/protocol';
import { manifest as trivia } from '@smartmouth/game-trivia';

export const GAMES: GameManifest[] = [trivia];

export function findGame(id: unknown): GameManifest | undefined {
  return GAMES.find((g) => g.id === id);
}
