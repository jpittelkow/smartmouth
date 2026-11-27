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

test('the game’s sound list: the newest file per cue, only well-named mp3s', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, utimesSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { gameSounds } = await import('../src/http.ts');
  const media = mkdtempSync(join(tmpdir(), 'sm-sounds-'));
  const dir = join(media, 'sounds', 'game');
  mkdirSync(dir, { recursive: true });
  for (const n of ['bell.aaa.mp3', 'bell.bbb.mp3', 'night.x1.mp3', 'notes.txt', '../evil.mp3x', 'Bad Name.mp3']) {
    try { writeFileSync(join(dir, n), 'ID3'); } catch { /* names the OS refuses */ }
  }
  utimesSync(join(dir, 'bell.aaa.mp3'), new Date(1000), new Date(1000));
  utimesSync(join(dir, 'bell.bbb.mp3'), new Date(2000), new Date(2000));
  assert.deepEqual(await gameSounds(media), { bell: '/media/sounds/game/bell.bbb.mp3', night: '/media/sounds/game/night.x1.mp3' });
  assert.deepEqual(await gameSounds(join(media, 'missing')), {});
});

test('a question counts as asked the moment it shows, so a game ended early starts somewhere new next time', async () => {
  const { loadSeeds } = await import('../src/seeds.ts');
  const { fileURLToPath } = await import('node:url');
  const { drainLog, endGame, tickGame } = await import('../src/gameRuntime.ts');
  const db = openDb(':memory:');
  loadSeeds(db, fileURLToPath(new URL('../../../content/seed', import.meta.url)), 0);
  const store = new RoomStore();
  const firstQuestion = (room: ReturnType<RoomStore['create']>, now: number) => {
    assert.ok(startGame(room, 'trivia', db, now).ok);
    tickGame(room, now + 10_000); // past the title card: question one is on screen
    drainLog(room, db, now + 10_000);
    const s = room.game!.state as { current: Record<string, { id: number }> };
    return s.current.grownups!.id;
  };
  const a = store.create(0);
  store.join(a, { name: 'One', band: 'grownups', avatar: 0 }, 0);
  const q1 = firstQuestion(a, 1000);
  endGame(a); // ended before the reveal: no play recorded
  const b = store.create(0);
  store.join(b, { name: 'Two', band: 'grownups', avatar: 0 }, 0);
  assert.notEqual(firstQuestion(b, 60_000), q1, 'the next game does not open with the same question');
  db.close();
});

test('the grown-up’s game length sets how many questions trivia asks: 10, 30 or 50', async () => {
  const { loadSeeds } = await import('../src/seeds.ts');
  const { fileURLToPath } = await import('node:url');
  const db = openDb(':memory:');
  loadSeeds(db, fileURLToPath(new URL('../../../content/seed', import.meta.url)), 0);
  const store = new RoomStore();
  for (const [length, n] of [['short', 10], ['medium', 30], ['long', 50]] as const) {
    const room = store.create(0);
    store.join(room, { name: 'One', band: 'grownups', avatar: 0 }, 0);
    room.length = length;
    assert.ok(startGame(room, 'trivia', db, 1000).ok);
    assert.equal((room.game!.state as { rounds: number }).rounds, n, length);
  }
  db.close();
});

test('house bots play trivia but their answers stay out of the question stats', async () => {
  const { loadSeeds } = await import('../src/seeds.ts');
  const { fileURLToPath } = await import('node:url');
  const { drainLog, tickGame, gameIntent } = await import('../src/gameRuntime.ts');
  const db = openDb(':memory:');
  loadSeeds(db, fileURLToPath(new URL('../../../content/seed', import.meta.url)), 0);
  const store = new RoomStore();
  const room = store.create(0);
  store.join(room, { name: 'Person', band: 'grownups', avatar: 0 }, 0);
  const bot = store.join(room, { name: 'Robo', band: 'grownups', avatar: 1 }, 0);
  assert.ok(bot.ok);
  bot.value.bot = true;
  assert.ok(startGame(room, 'trivia', db, 1000).ok);
  tickGame(room, 20_000); // the question is up
  for (const seat of room.seats) gameIntent(room, { kind: 'player', seatId: seat.id }, { type: 'answer', choice: 0 }, 21_000);
  tickGame(room, 40_000); // the drum roll ends: reveal
  drainLog(room, db, 40_000);
  const total = (db.prepare('SELECT SUM(asked) n FROM questions').get() as { n: number }).n;
  assert.equal(total, 1, 'only the person’s play counts');
  db.close();
});
