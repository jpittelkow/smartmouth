// Trivia: game one (ADR 0006, 0008, 0009). The manifest, the rules, and the view types the web app draws.
import { BAND_IDS, type GameManifest } from '@smartmouth/protocol';

export const manifest: GameManifest = {
  id: 'trivia',
  name: 'Trivia',
  pitch: 'Everyone gets a question their size. Salty gets none right.',
  minPlayers: 1,
  maxPlayers: 10,
  bands: BAND_IDS,
  ready: true,
};

export const DEFAULT_ROUNDS = 8;

export * as rules from './server.ts';
export type * from './types.ts';
