// Salty isn't cut off (owner, 2026-11-27): a pause waits for his audio, measured from the files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rules, type TriviaState } from '@smartmouth/game-trivia';
import { VoiceBank } from '../src/voice.ts';

const LINES = fileURLToPath(new URL('../../../content/voice/lines.json', import.meta.url));

test('a pause is held until Salty finishes, never shortened, and question timers are left alone', () => {
  const reveal = { stage: 'reveal', stageEnds: 10_000 } as unknown as TriviaState;
  assert.equal(rules.holdStage(reveal, 15_000).stageEnds, 15_000);
  assert.equal(rules.holdStage(reveal, 5_000).stageEnds, 10_000);
  const question = { stage: 'question', stageEnds: 10_000 } as unknown as TriviaState;
  assert.equal(rules.holdStage(question, 15_000).stageEnds, 10_000);
  const final = { stage: 'final', stageEnds: null } as unknown as TriviaState;
  assert.equal(rules.holdStage(final, 15_000).stageEnds, null);
});

test('clip lengths come from file sizes: mp3 at 16 bytes a ms, wav at 48, missing files count as 0', () => {
  const media = mkdtempSync(join(tmpdir(), 'sm-media-'));
  mkdirSync(join(media, 'voice', 'v'), { recursive: true });
  writeFileSync(join(media, 'voice', 'v', 'a.mp3'), Buffer.alloc(16_000));
  writeFileSync(join(media, 'voice', 'v', 'b.wav'), Buffer.alloc(44 + 48_000));
  const bank = new VoiceBank(LINES, join(media, 'manifest.json'), media);
  assert.equal(bank.clipsMs(['/media/voice/v/a.mp3', '/media/voice/v/b.wav', '/media/voice/v/gone.mp3']), 2000);
  assert.equal(new VoiceBank(LINES, join(media, 'manifest.json')).clipsMs(['/media/voice/v/a.mp3']), 0);
});

test('a quiet lobby gets Salty talking, less often each time, and he stops after 15 quiet minutes', async () => {
  const { RoomStore } = await import('../src/rooms.ts');
  const { idleCue } = await import('../src/salty.ts');
  const store = new RoomStore();
  const room = store.create(0);
  room.hostConnected = true;
  room.lastActive = 0;
  assert.equal(idleCue(room, 10_000), false, 'not yet');
  assert.equal(idleCue(room, 31_000), true);
  assert.equal(room.salty.pending, 'lobbyEmpty', 'nobody here yet');
  room.salty.pending = null; room.salty.spokeAt = 31_000;
  assert.equal(idleCue(room, 31_000 + 40_000), false, 'the gap grows to 45 s');
  assert.equal(idleCue(room, 31_000 + 46_000), true);
  store.join(room, { name: 'One', band: 'grownups', avatar: 0 }, 77_000);
  room.lastActive = 0; room.salty.spokeAt = 0;
  assert.equal(idleCue(room, 16 * 60_000), false, 'quiet for 15 minutes: stops');
  room.lastActive = 15 * 60_000;
  assert.equal(idleCue(room, 16 * 60_000), true);
  assert.equal(room.salty.pending, 'lobbyWaiting', 'players in, nobody has started');
});
