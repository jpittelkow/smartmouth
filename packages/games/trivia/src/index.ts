// Trivia's manifest. The rules (server.ts), Host.tsx and Controller.tsx come in build step 2 (ADR 0006, 0019).
import { BAND_IDS, type GameManifest } from '@smartmouth/protocol';

export const manifest: GameManifest = {
  id: 'trivia',
  name: 'Trivia',
  pitch: 'Everyone gets a question their size. Salty gets none right.',
  minPlayers: 1,
  maxPlayers: 10,
  bands: BAND_IDS,
  ready: false,
};
