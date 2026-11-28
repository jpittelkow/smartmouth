// Drunk mode (2026-11-27, docs/design/drunk-salty-script.md): the stages follow the game, the bar tab carries into the
// next game, lines are picked by stage, the drinking sounds play around a line, and captions never show the markers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from '../src/db.ts';
import { RoomStore } from '../src/rooms.ts';
import { endGame, startGame } from '../src/gameRuntime.ts';
import { DRUNK_SOUNDS, drunkStage, lobbyStage, markers } from '../src/drunk.ts';
import { currentDrunkStage, updateSalty } from '../src/salty.ts';
import { VoiceBank, caption } from '../src/voice.ts';

const LINES = fileURLToPath(new URL('../../../content/voice/lines.json', import.meta.url));
const SEEDS = fileURLToPath(new URL('../../../content/seed', import.meta.url));
const bank = () => new VoiceBank(LINES, join(tmpdir(), 'no-manifest.json'));

test('the stage follows the game, and the bar tab moves each next game on a stage', () => {
  assert.deepEqual([0, 0.2, 0.3, 0.6, 0.9, 1].map((p) => drunkStage(p, 0)), [1, 1, 2, 3, 4, 4]);
  assert.equal(drunkStage(0, 1), 2, 'game 2 starts Tipsy');
  assert.equal(drunkStage(0, 2), 3, 'game 3 starts Hammered');
  assert.equal(drunkStage(0, 5), 4, 'never past Gone');
  assert.equal(lobbyStage(0), 1);
  assert.equal(lobbyStage(1), 3, 'between games she is still well gone');
});

test('every drunk line has a stage, and only known sounds at its start or end', () => {
  const drunk = bank().lines.filter((l) => l.spice === 'drunk');
  assert.ok(drunk.length >= 60);
  for (const l of drunk) {
    assert.ok([1, 2, 3, 4].includes(l.stage ?? 0), `${l.id} has a stage`);
    const m = markers(l.text);
    for (const x of [...m.before, ...m.after]) assert.ok(DRUNK_SOUNDS[x], `${l.id}: unknown sound {${x}}`);
    const inner = l.text.replace(/^(\{[^}]+\}\s*)+/, '').replace(/(\s*\{[^}]+\})+\s*$/, '');
    assert.ok(!/\{/.test(inner), `${l.id}: a sound in the middle of the line`);
    assert.ok(!/\{|\}/.test(caption(l.text)), `${l.id}: the caption shows a marker`);
  }
  assert.ok(drunk.some((l) => l.moment === 'drink'), 'there are drink lines');
});

test('a drunk room gets the line for its stage, an earlier stage when that stage has none, or a Filthy one', () => {
  const b = bank();
  for (const stage of [1, 2, 3, 4]) {
    for (let i = 0; i < 20; i++) {
      const l = b.pick('intro', 'drunk', new Set(), Math.random, undefined, stage);
      assert.equal(l?.spice, 'drunk'); assert.equal(l?.stage, stage);
    }
  }
  const hello4 = b.pick('hello', 'drunk', new Set(), Math.random, undefined, 4);
  assert.equal(hello4?.stage, 4, 'the fourth-game hello');
  const wait1 = b.pick('lobbyWaiting', 'drunk', new Set(), Math.random, undefined, 1);
  assert.equal(wait1?.spice, 'filthy', 'never a drunker stage than she is: back to Filthy');
  const wait4 = b.pick('lobbyWaiting', 'drunk', new Set(), Math.random, undefined, 4);
  assert.equal(wait4?.stage, 3, 'nearest earlier stage');
  for (let i = 0; i < 50; i++) assert.notEqual(b.pick('intro', 'filthy', new Set())?.spice, 'drunk', 'Filthy never gets a drunk line');
});

test('captions drop the sound markers and still bleep', () => {
  assert.equal(caption("{pour} {gulp} Thish bottle'sh my besht friend. Night, fuckers. {bottle-roll}"), "Thish bottle'sh my besht friend. Night, ★★★★.");
  assert.deepEqual(markers('{slam} I’m awake. {hiccup}'), { before: ['slam'], after: ['hiccup'] });
});

test('a drunk trivia game: Salty starts Buzzed, plays drinking sounds, ends Gone, and the bar tab carries over', async () => {
  const { loadSeeds } = await import('../src/seeds.ts');
  const db = openDb(':memory:');
  loadSeeds(db, SEEDS, 0);
  const store = new RoomStore();
  const room = store.create(0);
  store.join(room, { name: 'Blue Blob', band: 'grownups', avatar: 0 }, 0);
  store.join(room, { name: 'Green Blob', band: 'grownups', avatar: 1 }, 0);
  room.spiceChosen = 'drunk';
  const b = bank();
  assert.equal(startGame(room, 'trivia', db, 0, 7).ok, true);
  assert.equal(currentDrunkStage(room), 1);
  updateSalty(room, b, 0);
  assert.ok(room.salty.cue?.caption, 'a hello');
  assert.ok(!/[{}]/.test(room.salty.cue?.caption ?? ''));

  // Hammer through the game: every stage of Salty's, with a sound now and then.
  let sounds = 0;
  const seen = new Set<number>();
  for (let t = 1; t < 400 && room.game; t++) {
    const { adapterFor } = await import('../src/adapters/index.ts');
    const a = adapterFor(room.game.id);
    room.game.state = a.skip(room.game.state, t * 1000);
    seen.add(currentDrunkStage(room) ?? 0);
    updateSalty(room, b, t * 1000);
    sounds += room.salty.cue?.clips.filter((c) => c.startsWith('/media/sounds/drunk/')).length ?? 0;
    // The TV's face follows the stage the line was said at.
    if (room.salty.cue) assert.equal(room.salty.cue.drunk, currentDrunkStage(room));
    if (a.isOver(room.game.state)) { updateSalty(room, b, t * 1000 + 1); break; }
  }
  assert.deepEqual([...seen].filter((x) => x).sort(), [1, 2, 3, 4], 'all four stages');
  assert.ok(sounds > 0, 'drinking sounds played');
  assert.equal(currentDrunkStage(room), 4, 'Gone at the end');
  endGame(room);
  assert.equal(room.drunkGames, 1);
  assert.equal(currentDrunkStage(room), 3, 'still drunk in the lobby');
  assert.equal(startGame(room, 'trivia', db, 500_000, 8).ok, true);
  assert.equal(currentDrunkStage(room), 2, 'the next game starts Tipsy');
  endGame(room);
  assert.equal(room.drunkGames, 1, 'a game quit early doesn’t add to the tab');

  // A kid joins: no more Drunk, and the tab is cleared at the next game.
  store.join(room, { name: 'Red Blob', band: 'kids', avatar: 2 }, 600_000);
  assert.equal(currentDrunkStage(room), null);
  assert.equal(startGame(room, 'trivia', db, 600_000, 9).ok, true);
  assert.equal(room.drunkGames, 0);
  updateSalty(room, b, 600_001);
  assert.equal(room.salty.cue?.drunk, undefined, 'sober face below Drunk');
  db.close();
});
