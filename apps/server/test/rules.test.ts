import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectiveSpice, spiceAllows, spiceCap } from '@smartmouth/protocol';
import { CODE_ALPHABET, makeCode, normalizeCode } from '../src/codes.ts';
import { IDLE_MS, RoomStore, adminSeatId, cleanName, hostView, playerView } from '../src/rooms.ts';

test('room codes use only the safe alphabet and avoid taken codes', () => {
  const seq = [0, 0, 0, 0, 1, 1, 1, 1];
  let i = 0;
  const code = makeCode((c) => c === 'BBBB', () => seq[i++] ?? 0);
  assert.equal(code, 'CCCC');
  for (let n = 0; n < 200; n++) assert.match(makeCode(() => false), new RegExp(`^[${CODE_ALPHABET}]{4}$`));
  assert.ok(!/[AEIOUY]/.test(CODE_ALPHABET), 'no vowels, so codes cannot spell words');
  assert.equal(normalizeCode(' wx-yz '), 'WXYZ');
});

test('spice is capped by the youngest player (ADR 0014)', () => {
  assert.equal(spiceCap([]), 'mild');
  assert.equal(spiceCap(['grownups', 'grownups']), 'filthy');
  assert.equal(spiceCap(['grownups', 'teens']), 'hot');
  assert.equal(spiceCap(['grownups', 'tweens', 'kids']), 'spicy');
  assert.equal(spiceCap(['grownups', 'little']), 'mild');
  assert.equal(effectiveSpice('filthy', ['grownups', 'little']), 'mild');
  assert.equal(effectiveSpice('mild', ['grownups']), 'mild');
  assert.ok(spiceAllows('hot', 'spicy'));
  assert.ok(!spiceAllows('spicy', 'filthy'));
});

test('a little one joining an R-rated room turns it down to Mild at once', () => {
  const store = new RoomStore();
  const room = store.create(0);
  store.join(room, { name: 'Captain Test', band: 'grownups', avatar: 0 }, 0);
  room.spiceChosen = 'filthy';
  assert.equal(hostView(room, '', []).spice.effective, 'filthy');
  store.join(room, { name: 'Blue Blob', band: 'little', avatar: 1 }, 0);
  assert.equal(hostView(room, '', []).spice.effective, 'mild');
  assert.equal(room.spiceChosen, 'filthy', 'the choice is kept for when the little one leaves');
});

test('names are cleaned, de-duplicated and capped at 16 characters', () => {
  assert.equal(cleanName('  Blue​   Blob\n'), 'Blue Blob');
  assert.equal(cleanName('   '), null);
  assert.equal(cleanName(42), null);
  const store = new RoomStore();
  const room = store.create(0);
  const a = store.join(room, { name: 'Blob', band: 'kids', avatar: 0 }, 0);
  const b = store.join(room, { name: 'blob', band: 'kids', avatar: 0 }, 0);
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) assert.deepEqual([a.value.name, b.value.name], ['Blob', 'blob 2']);
  const long = store.join(room, { name: 'x'.repeat(40), band: 'kids', avatar: 0 }, 0);
  assert.ok(long.ok && long.value.name.length === 16);
});

test('a room holds 10 players, each with their own colour', () => {
  const store = new RoomStore();
  const room = store.create(0);
  for (let n = 0; n < 10; n++) assert.ok(store.join(room, { name: `P${n}`, band: 'teens', avatar: 0 }, 0).ok);
  assert.equal(new Set(room.seats.map((s) => s.color)).size, 10);
  const full = store.join(room, { name: 'One more', band: 'teens', avatar: 0 }, 0);
  assert.ok(!full.ok && full.code === 'room-full');
});

test('the first grown-up is admin, and admin moves on when they leave', () => {
  const store = new RoomStore();
  const room = store.create(0);
  store.join(room, { name: 'Kid', band: 'kids', avatar: 0 }, 0);
  assert.equal(adminSeatId(room), null);
  const g1 = store.join(room, { name: 'G1', band: 'grownups', avatar: 0 }, 0);
  const g2 = store.join(room, { name: 'G2', band: 'grownups', avatar: 0 }, 0);
  assert.ok(g1.ok && g2.ok);
  if (!g1.ok || !g2.ok) return;
  assert.equal(adminSeatId(room), g1.value.id);
  store.remove(room, g1.value.id, 0);
  assert.equal(adminSeatId(room), g2.value.id);
});

test('views never carry seat tokens', () => {
  const store = new RoomStore();
  const room = store.create(0);
  const s = store.join(room, { name: 'Blue Blob', band: 'kids', avatar: 0 }, 0);
  assert.ok(s.ok);
  if (!s.ok) return;
  const all = JSON.stringify([hostView(room, 'x', []), playerView(room, s.value, [])]);
  assert.ok(!all.includes(s.value.token));
  assert.ok(!all.includes(room.hostToken));
});

test('empty rooms are deleted after 15 minutes, busy ones are kept', () => {
  const store = new RoomStore();
  const idle = store.create(0);
  const busy = store.create(0);
  busy.hostConnected = true;
  assert.deepEqual(store.sweep(IDLE_MS - 1), []);
  assert.deepEqual(store.sweep(IDLE_MS + 1), [idle.code]);
  assert.ok(store.rooms.has(busy.code));
});
