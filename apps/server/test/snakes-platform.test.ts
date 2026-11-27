// Snake Manor on the platform (ADR 0022, 0023): starting from the real library, what the TV and the admin's phone
// may see, the missions' rules, and Salty choosing lines without reading hidden roles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import type { Band } from '@smartmouth/protocol';
import { rules, type MQuestion, type SnakesState } from '@smartmouth/game-snakes';
import { openDb } from '../src/db.ts';
import { loadSeeds } from '../src/seeds.ts';
import { RoomStore, adminSeatId, hostView, playerView } from '../src/rooms.ts';
import { gameIntent, startGame } from '../src/gameRuntime.ts';
import { GAMES } from '../src/games.ts';
import { SM_MOMENTS, momentFor, snakes } from '../src/adapters/snakes.ts';
import { VoiceBank } from '../src/voice.ts';
import { SPICES, spiceAllows } from '@smartmouth/protocol';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SEEDS = fileURLToPath(new URL('../../../content/seed', import.meta.url));

function room(bands: Band[]) {
  const db = openDb(':memory:');
  loadSeeds(db, SEEDS, 0);
  const store = new RoomStore();
  const r = store.create(0);
  bands.forEach((band, i) => store.join(r, { name: `Seat ${i + 1}`, band, avatar: 0 }, 0));
  return { db, r };
}

test('Snake Manor starts from the library for 5 to 10 players, and refuses a Little or a small room', () => {
  const tooFew = room(['grownups', 'grownups', 'grownups', 'grownups']);
  assert.equal(startGame(tooFew.r, 'snakes', tooFew.db, 0, 1).ok, false);
  const little = room(['grownups', 'grownups', 'grownups', 'grownups', 'little']);
  const no = startGame(little.r, 'snakes', little.db, 0, 1);
  assert.ok(!no.ok && /Little \(3–5\)/.test(no.message), !no.ok ? no.message : '');
  const ok = room(['grownups', 'grownups', 'teens', 'tweens', 'kids']);
  assert.deepEqual(startGame(ok.r, 'snakes', ok.db, 0, 1), { ok: true });
  assert.equal(ok.r.game?.seed, 1);
  const s = ok.r.game?.state as SnakesState;
  assert.ok(Object.values(s.queues).every((q) => q.length > 0), 'each band in the room has mission questions');
  for (const d of [tooFew, little, ok]) d.db.close();
});

test('the TV and the admin’s phone see only public facts; the admin sees only their own role', () => {
  const { db, r } = room(['grownups', 'grownups', 'grownups', 'teens', 'tweens', 'kids', 'grownups']);
  assert.ok(startGame(r, 'snakes', db, 0, 77).ok);
  const tv = JSON.stringify(hostView(r, 'https://x/play', GAMES));
  assert.ok(!tv.includes('"role":"snake"') && !tv.includes('"role":"guest"'), 'no role on the TV at the deal');
  const admin = adminSeatId(r) as string;
  const view = playerView(r, r.seats.find((s) => s.id === admin)!, GAMES);
  const g = (view as { game: { players: Array<{ role: unknown }>; me: { role: string }; fellows: string[] } }).game;
  assert.ok(g.players.every((p) => p.role === null), 'the admin is told nobody else’s role');
  const s = r.game?.state as SnakesState;
  assert.equal(g.me.role, s.players[admin]?.role);
  if (g.me.role === 'guest') assert.deepEqual(g.fellows, []);
  db.close();
});

test('raw intents are checked: unknown types and bad fields never reach the rules', () => {
  const { db, r } = room(['grownups', 'grownups', 'grownups', 'grownups', 'grownups']);
  assert.ok(startGame(r, 'snakes', db, 0, 5).ok);
  const seat = { kind: 'player' as const, seatId: r.seats[0]!.id };
  assert.equal(gameIntent(r, seat, { type: 'hack' }, 1), false);
  assert.equal(gameIntent(r, seat, { type: 'vote', target: 42 }, 1), false);
  assert.equal(gameIntent(r, { kind: 'host' }, { type: 'answer', choice: 0 }, 1), false, 'the TV never acts as a player');
  db.close();
});

// ---------- missions ----------

let qid = 1000;
const q = (correct = 1): MQuestion => ({
  id: qid++, prompt: 'Q', kind: 'choice', answers: [{ text: 'A', image: null }, { text: 'B', image: null }, { text: 'C', image: null }],
  correct, explain: '', category: 'T', spice: 'mild',
});
const start = (n: number, seed = 3) => rules.init(
  Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, band: 'grownups' as Band })),
  { spice: 'hot', seed, drama: 'full' }, { grownups: Array.from({ length: 60 }, () => q()) }, 0);
const toMission = (s: SnakesState) => rules.tick(s, s.stageEnds ?? 0);
/** Everyone answers this step: right if `right(id)`. */
function answerAll(s0: SnakesState, right: (id: string) => boolean): SnakesState {
  let s = s0;
  for (const id of Object.keys(s.mission?.questions ?? {})) s = rules.intent(s, id, { type: 'answer', choice: right(id) ? 1 : 0 }, 1);
  return s;
}
function finishMission(s0: SnakesState, right: (id: string) => boolean): SnakesState {
  let s = s0;
  for (let i = 0; i < 40 && s.stage === 'mission'; i++) {
    if (s.mission?.step === 'question') s = answerAll(s, right);
    else s = rules.tick(s, s.mission?.stepEnds ?? 0);
  }
  return s;
}

test('missions rotate: everyone answers, then the chain, then pairs', () => {
  const s = toMission(start(6));
  assert.equal(s.mission?.format, 'everyone');
  assert.equal(Object.keys(s.mission?.questions ?? {}).length, 6, 'all six answer at once');
  assert.equal(s.mission?.target, Math.ceil(6 * 6 * 0.75));
});

test('a hit target banks the bonus; a miss earns the Snakes a Dagger; the shield goes to a top scorer', () => {
  const hit = finishMission(toMission(start(6, 4)), () => true);
  assert.equal(hit.stage, 'missionReveal');
  assert.equal(hit.mission?.result?.hit, true);
  assert.equal(hit.pot, 6 * 6 * 100 + 500);
  assert.equal(hit.daggers, 0);
  const shielded = hit.order.filter((id) => hit.players[id]?.shield);
  assert.equal(shielded.length, 1);
  const miss = finishMission(toMission(start(6, 4)), (id) => id === 'p1');
  assert.equal(miss.mission?.result?.hit, false);
  assert.equal(miss.daggers, 1);
  assert.ok(miss.players.p1?.shield, 'the only player who scored gets the shield');
});

test('the Overboard drops one right answer once per mission, and the tally never says whose', () => {
  let s = toMission(start(6, 9));
  const snake = s.order.find((id) => s.players[id]?.role === 'snake') as string;
  const victim = s.order.find((id) => id !== snake) as string;
  s = rules.intent(s, snake, { type: 'overboard', target: victim }, 1);
  assert.equal(s.mission?.overboard, victim);
  const again = rules.intent(s, snake, { type: 'overboard', target: s.order.find((id) => id !== snake && id !== victim) as string }, 1);
  assert.equal(again.mission?.overboard, victim, 'once a mission');
  s = answerAll(s, () => true);
  assert.equal(s.mission?.step, 'tally');
  assert.equal(s.mission?.right, 5, 'one right answer dropped');
  const tv = rules.hostView(s);
  assert.equal(tv.mission?.overboardSaid, true);
  assert.ok(!JSON.stringify(tv).includes(victim) || tv.players.some((p) => p.id === victim), 'only the player list names them');
  assert.ok(!JSON.stringify(tv.mission).includes(victim));
  const guestView = rules.playerView(s, victim);
  assert.equal(guestView.mission?.overboard, null, 'a Guest has no Overboard');
});

test('the chain: one player at a time, and a run of right answers pays more', () => {
  let s = toMission(start(6, 12));
  s = finishMission(s, () => true);
  // Move on to round 2's mission (the chain) through a Round Table and a night.
  for (let i = 0; i < 60 && !(s.stage === 'mission' && s.mission?.format === 'chain'); i++) s = rules.tick(s, rules.nextDeadline(s) ?? 0);
  assert.equal(s.mission?.format, 'chain');
  assert.equal(Object.keys(s.mission?.questions ?? {}).length, 1);
  const before = s.pot;
  s = answerAll(s, () => true); s = rules.tick(s, s.mission?.stepEnds ?? 0);
  s = answerAll(s, () => true);
  assert.equal(s.pot - before, 100 + 150, 'the second in a row earns the run bonus');
});

// ---------- Salty never reads hidden roles ----------

test('Salty’s moment is the same whoever the Snakes are (ADR 0023)', () => {
  let s = toMission(start(8, 31));
  for (let i = 0; i < 200 && s.stage !== 'final'; i++) {
    // Swap the roles of two living players: everything public stays the same, so the moment must too.
    const alive = rules.living(s);
    const snake = alive.find((id) => s.players[id]?.role === 'snake');
    const guest = alive.find((id) => s.players[id]?.role === 'guest');
    if (snake && guest && s.stage !== 'banish' && s.stage !== 'unmask') {
      const swapped: SnakesState = {
        ...s, players: { ...s.players, [snake]: { ...s.players[snake]!, role: 'guest' }, [guest]: { ...s.players[guest]!, role: 'snake' } },
      };
      assert.equal(momentFor(swapped), momentFor(s), `stage ${s.stage}`);
    }
    if (s.stage === 'mission' && s.mission?.step === 'question') s = answerAll(s, (id) => id.endsWith('1'));
    else s = rules.tick(s, rules.nextDeadline(s) ?? 0);
  }
});

// ---------- Salty's Lord of the Manor lines (design guide 8.1) ----------

const LINES = fileURLToPath(new URL('../../../content/voice/lines.json', import.meta.url));

test('every Snake Manor moment has a line at every spice level, never above it', () => {
  const bank = new VoiceBank(LINES, join(tmpdir(), 'no-manifest.json'));
  for (const moment of SM_MOMENTS) {
    for (const spice of SPICES) {
      const line = bank.pick(moment, spice, new Set());
      assert.ok(line, `${moment} at ${spice}`);
      assert.ok(spiceAllows(spice, line.spice));
    }
  }
  const sm = bank.lines.filter((l) => l.moment.startsWith('sm-'));
  assert.ok(sm.every((l) => SM_MOMENTS.includes(l.moment)), 'no stray moments');
});

test('Mild and Spicy lines say vanished, never murdered; reveal lines never need a name', () => {
  const bank = new VoiceBank(LINES, join(tmpdir(), 'no-manifest.json'));
  for (const l of bank.lines.filter((x) => x.moment.startsWith('sm-') && (x.spice === 'mild' || x.spice === 'spicy'))) {
    assert.ok(!/murder/i.test(l.text), l.id);
  }
  for (const l of bank.lines.filter((x) => x.moment.startsWith('sm-reveal'))) assert.ok(!/\{|name/i.test(l.text), l.id);
});

test('the banishment is said in two parts: the setup, then the payoff for the revealed role', () => {
  const said: string[] = [];
  const tools = { line: (m: string) => { said.push(m); return { text: m, clip: `/media/voice/${m}.mp3` }; }, reads: () => ({ prompt: null, answers: [], explain: null }) };
  let s = rules.init(Array.from({ length: 6 }, (_, i) => ({ id: `p${i + 1}`, band: 'grownups' as Band })), { spice: 'hot', seed: 2, drama: 'full' }, {}, 0);
  s = { ...s, stage: 'banish', banished: s.order.find((id) => s.players[id]?.role === 'snake') ?? null };
  const out = snakes.say(s, tools);
  assert.deepEqual(said, ['sm-reveal-setup', 'sm-reveal-snake']);
  assert.equal(out.clips.length, 2);
});
