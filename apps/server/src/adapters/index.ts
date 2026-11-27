// The fixed list of games the server can run (ADR 0006). Add a game by writing its adapter and listing it here.
import type { GameAdapter } from './types.ts';
import { trivia } from './trivia.ts';
import { snakes } from './snakes.ts';

export const ADAPTERS: ReadonlyArray<GameAdapter<any>> = [trivia, snakes];

export function adapterFor(id: string): GameAdapter<any> {
  const a = ADAPTERS.find((x) => x.manifest.id === id);
  if (!a) throw new Error(`No game adapter for "${id}"`);
  return a;
}
