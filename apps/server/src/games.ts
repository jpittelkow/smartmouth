// The games on the lobby's picker (ADR 0006), from the adapters' manifests.
import type { GameManifest } from '@smartmouth/protocol';
import { ADAPTERS } from './adapters/index.ts';

export const GAMES: GameManifest[] = ADAPTERS.map((a) => a.manifest);

export function findGame(id: unknown): GameManifest | undefined {
  return GAMES.find((g) => g.id === id);
}
