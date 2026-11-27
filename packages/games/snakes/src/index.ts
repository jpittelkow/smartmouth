// Snake Manor: game two (ADR 0022). The manifest, the rules, and the view types the web app draws.
import type { GameManifest } from '@smartmouth/protocol';

export const manifest: GameManifest = {
  id: 'snakes',
  name: 'Snake Manor',
  pitch: 'Someone at this table is a Snake. Salty picked them. He regrets it.',
  minPlayers: 5,
  maxPlayers: 10,
  // Littles sit this one out; Kids play, always as Guests (ADR 0022).
  bands: ['kids', 'tweens', 'teens', 'grownups'],
  ready: true,
};

export * as rules from './server.ts';
export type * from './types.ts';
