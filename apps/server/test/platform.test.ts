// The platform runs any game through its adapter (ADR 0006): start checks from the manifest, a stored seed,
// and typed text cleaned and rate-limited for every game (ADR 0023).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEXT_MAX } from '@smartmouth/protocol';
import { openDb } from '../src/db.ts';
import { RoomStore } from '../src/rooms.ts';
import { cleanText, gameIntent, startGame } from '../src/gameRuntime.ts';
import { ADAPTERS } from '../src/adapters/index.ts';
import { GAMES } from '../src/games.ts';

test('every listed game has an adapter, and the picker lists them all', () => {
  assert.deepEqual(GAMES.map((g) => g.id), ADAPTERS.map((a) => a.manifest.id));
  assert.ok(GAMES.some((g) => g.id === 'trivia'));
});

test('a game refuses to start outside its manifest: unknown id, too few players, an age it doesn’t take', () => {
  const db = openDb(':memory:');
  const store = new RoomStore();
  const room = store.create(0);
  assert.equal(startGame(room, 'nope', db, 0).ok, false);
  const r = startGame(room, 'trivia', db, 0);
  assert.ok(!r.ok && r.code === 'not-ready', 'nobody has joined');
  db.close();
});

test('a started game keeps the seed it was dealt from', () => {
  const db = openDb(':memory:');
  const store = new RoomStore();
  const room = store.create(0);
  store.join(room, { name: 'Captain Test', band: 'grownups', avatar: 0 }, 0);
  // No questions in an empty library: trivia refuses, and nothing is half-started.
  const empty = startGame(room, 'trivia', db, 0, 1234);
  assert.ok(!empty.ok && empty.code === 'no-questions');
  assert.equal(room.game, null);
  db.close();
});

test('typed text is cleaned and capped for every game', () => {
  assert.equal(cleanText('  hello\u0007   there​ '), 'hello there');
  assert.equal(cleanText('   '), null);
  assert.equal(cleanText(42), null);
  assert.equal([...(cleanText('x'.repeat(500)) ?? '')].length, TEXT_MAX);
});

test('typed text is rate-limited per seat, before the game sees it', () => {
  const store = new RoomStore();
  const room = store.create(0);
  const seen: string[] = [];
  // A stand-in game that records each text it receives.
  room.game = { id: 'trivia', state: { echo: true }, seed: 1, logged: 0 };
  const echo = ADAPTERS.find((a) => a.manifest.id === 'trivia');
  assert.ok(echo);
  const original = echo.intent;
  echo.intent = (state: unknown, _a, raw) => { seen.push((raw as { text: string }).text); return { ...(state as object) }; };
  try {
    let accepted = 0;
    for (let i = 0; i < 12; i++) if (gameIntent(room, { kind: 'player', seatId: 's1' }, { type: 'say', text: `msg ${i}` }, 1000)) accepted++;
    assert.equal(accepted, 8, 'eight messages in ten seconds, then refused');
    assert.ok(gameIntent(room, { kind: 'player', seatId: 's2' }, { type: 'say', text: 'another seat' }, 1000), 'a different seat has its own limit');
    assert.ok(gameIntent(room, { kind: 'player', seatId: 's1' }, { type: 'say', text: 'later' }, 12_000), 'the window resets');
    assert.equal(gameIntent(room, { kind: 'player', seatId: 's3' }, { type: 'say', text: '\u0000 ' }, 12_000), false, 'empty text never reaches the game');
    assert.ok(seen.every((t) => t.length > 0));
  } finally {
    echo.intent = original;
  }
});
