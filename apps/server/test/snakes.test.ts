// Snake Manor's rules (ADR 0022, 0023), driven with a fake clock and seeded bots.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Band, GamePlayer } from '@smartmouth/protocol';
import { rules, type MQuestion, type SnakesContent, type SnakesPlayerView, type SnakesState } from '@smartmouth/game-snakes';

let qid = 1;
const q = (): MQuestion => ({
  id: qid++, prompt: `Q${qid}`, kind: 'choice', answers: [{ text: 'A', image: null }, { text: 'B', image: null }, { text: 'C', image: null }],
  correct: 1, explain: '', category: 'Test', spice: 'mild',
});
const content = (per = 80): SnakesContent => { qid = 1; return contentOf(per); };
const contentOf = (per: number): SnakesContent => Object.fromEntries((['kids', 'tweens', 'teens', 'grownups'] as Band[])
  .map((b) => [b, Array.from({ length: per }, q)]));

const seats = (n: number, bands: Band[] = []): GamePlayer[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, band: bands[i] ?? 'grownups' }));

const start = (n: number, seed = 7, bands: Band[] = [], drama: 'full' | 'quick' = 'full') =>
  rules.init(seats(n, bands), { spice: 'hot', seed, drama }, content(), 0);

const snakesOf = (s: SnakesState) => s.order.filter((id) => s.players[id]?.role === 'snake');
const step = (s: SnakesState) => rules.tick(s, rules.nextDeadline(s) ?? 0);
/** Ticks until the game reaches `stage` (or gives up). */
function until(s0: SnakesState, stage: SnakesState['stage'], max = 400): SnakesState {
  let s = s0;
  for (let i = 0; i < max && s.stage !== stage; i++) s = step(s);
  assert.equal(s.stage, stage, `reached ${stage}`);
  return s;
}

test('the deal: 1 Snake for 5–6 players, 2 for 7–9, 3 for 10; Kids are never Snakes', () => {
  for (const [n, k] of [[5, 1], [6, 1], [7, 2], [8, 2], [9, 2], [10, 3]] as const) {
    for (let seed = 1; seed <= 20; seed++) assert.equal(snakesOf(start(n, seed)).length, k, `${n} players, seed ${seed}`);
  }
  for (let seed = 1; seed <= 50; seed++) {
    const s = start(6, seed, ['kids', 'kids', 'kids', 'grownups', 'tweens', 'kids']);
    for (const id of snakesOf(s)) assert.notEqual(s.players[id]?.band, 'kids');
    assert.ok(s.order.filter((id) => s.players[id]?.band === 'kids').every((id) => s.players[id]?.kid));
  }
  assert.equal(start(5).endSize, 3);
  assert.equal(start(8).endSize, 4);
});

test('the same seed deals the same roles; different seeds deal differently', () => {
  assert.deepEqual(snakesOf(start(8, 42)), snakesOf(start(8, 42)));
  const deals = new Set(Array.from({ length: 30 }, (_, i) => snakesOf(start(8, i + 1)).join()));
  assert.ok(deals.size > 5, 'roles vary with the seed');
});

// ---------- seeded bots that play a whole game ----------

function bot(seed: number) {
  let x = seed >>> 0 || 1;
  return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
}
const any = <T>(r: () => number, xs: readonly T[]): T | undefined => xs.at(Math.floor(r() * xs.length));

/** Every player acts once on what their own view shows; then the clock moves to the next deadline. */
function playStep(s0: SnakesState, r: () => number, t: number): SnakesState {
  let s = s0;
  for (const id of s.order) {
    const v = rules.playerView(s, id);
    if (v.mission?.question && v.mission.picked === null) s = rules.intent(s, id, { type: 'answer', choice: Math.floor(r() * 3) }, t);
    if (v.mission?.overboard?.available && r() < 0.3) {
      const target = any(r, v.mission.overboard.candidates);
      if (target) s = rules.intent(s, id, { type: 'overboard', target }, t);
    }
    if (v.vote?.canVote && !v.vote.mine) {
      const target = any(r, v.vote.candidates);
      if (target) s = rules.intent(s, id, { type: 'vote', target }, t);
    }
    if (v.night) {
      if (v.night.grid.kind === 'answer') s = rules.intent(s, id, { type: 'offer', accept: r() < 0.6 }, t);
      else {
        const target = any(r, v.night.grid.candidates);
        if (target && v.night.grid.picks.length === 0) s = rules.intent(s, id, { type: 'pick', target }, t);
        if (v.night.daggers > 0 && r() < 0.5) s = rules.intent(s, id, { type: 'dagger', kind: any(r, ['double', 'silence', 'peek'] as const) ?? 'peek', target: any(r, v.night.grid.candidates) ?? null }, t);
        s = rules.intent(s, id, { type: 'say', text: 'a note' }, t);
        s = rules.intent(s, id, { type: 'lock' }, t);
      }
    }
    if (v.bet && v.bet.picks.length === 0) {
      const target = any(r, v.bet.candidates);
      if (target) s = rules.intent(s, id, { type: 'pick', target }, t);
    }
    if (v.endVote?.canVote && v.endVote.mine === null) s = rules.intent(s, id, { type: 'endVote', end: r() < 0.75 }, t);
  }
  return s;
}

function playOut(n: number, seed: number, check?: (s: SnakesState) => void): SnakesState {
  const r = bot(seed * 31 + n);
  let s = start(n, seed);
  let t = 0;
  for (let i = 0; i < 3000 && !rules.isOver(s); i++) {
    s = playStep(s, r, t);
    check?.(s);
    if (rules.isOver(s)) break;
    t = Math.max(t, rules.nextDeadline(s) ?? t);
    s = rules.tick(s, t);
    check?.(s);
  }
  return s;
}

test('bot games finish at every size from 5 to 10, with a winner and sane scores', () => {
  for (let n = 5; n <= 10; n++) {
    for (let seed = 1; seed <= 12; seed++) {
      const s = playOut(n, seed);
      assert.equal(s.stage, 'final', `${n} players, seed ${seed} finished`);
      const host = rules.hostView(s);
      assert.ok(host.final);
      const winners = host.final.winners;
      assert.ok(winners.every((id) => s.players[id]?.role === host.final?.winner && s.players[id]?.status === 'alive'));
      const sc = rules.scores(s);
      for (const id of winners) assert.ok((sc[id] ?? 0) >= Math.round(s.pot / winners.length));
    }
  }
});

test('across many games both sides win sometimes, and missions fill the pot', () => {
  const wins = { guest: 0, snake: 0 };
  let pots = 0;
  for (let n = 5; n <= 10; n++) for (let seed = 1; seed <= 15; seed++) {
    const s = playOut(n, seed);
    wins[rules.winner(s)]++;
    pots += s.pot;
    assert.ok(s.log.length > 0, 'questions were asked');
  }
  assert.ok(wins.guest > 0 && wins.snake > 0, JSON.stringify(wins));
  assert.ok(pots > 0);
});

test('a game replays exactly from its seed and the same intents', () => {
  for (const n of [5, 8, 10]) assert.deepEqual(playOut(n, 99), playOut(n, 99));
});

// ---------- ADR 0023: hidden information ----------

/** Roles a view lets this player know: their own, their fellow Snakes', and anything public. */
function assertNoLeak(s: SnakesState, id: string, v: SnakesPlayerView) {
  const me = s.players[id];
  for (const p of v.players) {
    if (p.role === null) continue;
    const pub = s.stage === 'final' || s.stage === 'unmask' || p.status !== 'alive';
    assert.ok(pub, `${id} sees ${p.id}'s role at ${s.stage}`);
  }
  if (me?.role === 'guest') {
    assert.deepEqual(v.fellows, [], 'a Guest is told no Snakes');
    if (v.night) assert.deepEqual(v.night.box.messages, [], 'a Guest never sees the Snake chat');
    if (v.night) assert.equal(v.night.daggers, 0);
  }
  const json = JSON.stringify(v);
  for (const other of s.order) {
    if (other === id) continue;
    // Murder picks and suspect votes never appear in someone else's view.
    assert.ok(!json.includes(`"${other}":["`), `${id}'s view carries ${other}'s picks`);
  }
}

test('no player view carries another player’s secret, and the host view shows roles only once public', () => {
  for (const n of [5, 7, 10]) {
    for (let seed = 1; seed <= 6; seed++) {
      playOut(n, seed, (s) => {
        for (const id of s.order) assertNoLeak(s, id, rules.playerView(s, id));
        const host = rules.hostView(s);
        for (const p of host.players) {
          if (p.role !== null) assert.ok(s.stage === 'final' || s.stage === 'unmask' || p.status !== 'alive', `TV shows ${p.id}'s role at ${s.stage}`);
        }
        if (s.stage === 'vote') assert.equal(host.vote?.reveal, null, 'votes stay sealed until the reveal');
        // The TV never sees the Snake chat, notes or picks.
        assert.ok(!JSON.stringify(host).includes('a note'));
      });
    }
  }
});

/** The shape of a value: keys and types, never contents (array items collapse to one shape). */
function shape(x: unknown): unknown {
  if (Array.isArray(x)) return ['array'];
  if (x && typeof x === 'object') return Object.fromEntries(Object.keys(x).sort().map((k) => [k, shape((x as Record<string, unknown>)[k])]));
  return x === null ? 'null-or-value' : typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean' ? 'null-or-value' : typeof x;
}

test('every living player’s night screen has the same shape and the same deadline', () => {
  for (const n of [5, 8, 10]) {
    for (let seed = 1; seed <= 8; seed++) {
      playOut(n, seed, (s) => {
        if (s.stage !== 'night') return;
        const views = s.order.filter((id) => s.players[id]?.status === 'alive').map((id) => rules.playerView(s, id));
        const shapes = new Set(views.map((v) => JSON.stringify(shape(v.night))));
        assert.equal(shapes.size, 1, 'one night-screen shape for Snakes and Guests');
        assert.equal(new Set(views.map((v) => v.deadline)).size, 1, 'one deadline for every phone');
        assert.ok(views.every((v) => v.night && v.night.chips.length > 0), 'everyone gets the same chips');
        assert.equal(new Set(views.map((v) => JSON.stringify(v.night?.chips))).size, 1);
      });
    }
  }
});

test('locking early never ends the night before its deadline', () => {
  let s = until(start(8, 3), 'night');
  const deadline = rules.nextDeadline(s);
  for (const id of s.order) s = rules.intent(s, id, { type: 'lock' }, 10);
  assert.equal(s.stage, 'night');
  assert.equal(rules.nextDeadline(s), deadline);
});

// ---------- specific rules ----------

test('no murder on the first night of a game of 6 or fewer', () => {
  let s = until(start(6, 5), 'night');
  assert.equal(s.night?.noMurder, true);
  s = until(s, 'breakfast');
  assert.deepEqual(s.breakfast?.murdered, []);
  assert.equal(s.breakfast?.quiet, true);
  let big = until(start(8, 5), 'night');
  assert.equal(big.night?.noMurder, false);
  big = until(big, 'breakfast');
  assert.equal(big.breakfast?.murdered.length, 1, 'an idle Snake still claims someone');
});

test('a shield saves its holder from the murder', () => {
  let s = until(start(8, 11), 'night');
  const guest = s.order.find((id) => s.players[id]?.role === 'guest' && s.players[id]?.status === 'alive') as string;
  s = { ...s, players: { ...s.players, [guest]: { ...s.players[guest]!, shield: true } } };
  for (const snake of snakesOf(s)) s = rules.intent(s, snake, { type: 'pick', target: guest }, 1);
  s = until(s, 'breakfast');
  assert.equal(s.players[guest]?.status, 'alive');
  assert.equal(s.breakfast?.saved, true);
  assert.equal(s.players[guest]?.shield, false, 'a shield lasts one night');
});

test('a tie goes to a revote between the tied; a second tie is settled at random', () => {
  let s = until(start(6, 2), 'vote');
  const [a, b, c, d, e, f] = s.order as [string, string, string, string, string, string];
  // Three for a, three for b.
  for (const [voter, target] of [[a, b], [b, a], [c, a], [d, b], [e, a], [f, b]] as const) s = rules.intent(s, voter, { type: 'vote', target }, 1);
  assert.equal(s.stage, 'vote');
  assert.equal(s.vote?.revote, true);
  assert.deepEqual([...(s.vote?.candidates ?? [])].sort(), [a, b].sort());
  for (const [voter, target] of [[c, a], [d, b], [e, a], [f, b], [a, b], [b, a]] as const) s = rules.intent(s, voter, { type: 'vote', target }, 2);
  assert.equal(s.stage, 'voteReveal');
  assert.ok(s.banished === a || s.banished === b);
});

test('banishing the last Snake with 5 or more left makes Salty recruit a new one; never a Kid', () => {
  let s = until(start(7, 4, ['kids', 'kids']), 'vote');
  // Banish both Snakes in turn by making it a one-Snake game first.
  const [first, second] = snakesOf(s) as [string, string];
  s = { ...s, players: { ...s.players, [second]: { ...s.players[second]!, role: 'guest' } } };
  for (const id of s.order) if (id !== first) s = rules.intent(s, id, { type: 'vote', target: first }, 1);
  s = rules.intent(s, first, { type: 'vote', target: s.order.find((x) => x !== first) as string }, 1);
  s = until(s, 'night');
  assert.equal(s.night?.recruit, 'forced');
  const chosen = s.night?.offer?.to as string;
  assert.equal(s.players[chosen]?.role, 'snake');
  assert.equal(s.players[chosen]?.kid, false);
  assert.equal(rules.playerView(s, chosen).night?.box.kind, 'chosen');
  s = until(s, 'breakfast');
  assert.equal(s.breakfast?.saltyRecruited, true);
  assert.deepEqual(s.breakfast?.murdered, []);
});

test('banishing the last Snake with 4 or fewer left: the Guests win', () => {
  let s = until(start(5, 8), 'vote');
  s = { ...s, players: Object.fromEntries(Object.entries(s.players).map(([id, p], i) => [id, i < 1 ? p : { ...p, status: i === 4 ? 'ghost' : p.status }])) };
  const snake = snakesOf(s)[0] as string;
  for (const id of rules.living(s)) s = rules.intent(s, id, { type: 'vote', target: id === snake ? rules.living(s).find((x) => x !== snake) as string : snake }, 1);
  s = until(s, 'final');
  assert.equal(rules.winner(s), 'guest');
});

test('the Snakes may recruit after one of them is banished; the offer can be refused', () => {
  let s = until(start(9, 6), 'vote');
  const [banishMe, keeper] = snakesOf(s) as [string, string];
  for (const id of rules.living(s)) s = rules.intent(s, id, { type: 'vote', target: id === banishMe ? keeper : banishMe }, 1);
  s = until(s, 'night');
  assert.equal(s.night?.recruit, 'offer');
  assert.equal(rules.playerView(s, keeper).night?.grid.kind, 'recruit');
  const target = rules.playerView(s, keeper).night?.grid.candidates[0] as string;
  s = rules.intent(s, keeper, { type: 'pick', target }, 5);
  s = rules.intent(s, keeper, { type: 'lock' }, 5);
  assert.equal(s.night?.offer?.to, target, 'the offer goes out once every Snake has locked');
  assert.equal(rules.playerView(s, target).night?.grid.kind, 'answer');
  s = rules.intent(s, target, { type: 'offer', accept: false }, 6);
  s = until(s, 'breakfast');
  assert.equal(s.players[target]?.role, 'guest');
  assert.equal(s.breakfast?.quiet, true, 'a recruitment night has no murder');
});

test('Daggers: Silence takes a vote away, Peek tells the Snakes about a shield, Double murders two', () => {
  let s = until(start(10, 12), 'night');
  const snake = snakesOf(s)[0] as string;
  const guests = rules.living(s).filter((id) => s.players[id]?.role === 'guest');
  s = { ...s, daggers: 2 };
  s = rules.intent(s, snake, { type: 'dagger', kind: 'silence', target: guests[0] as string }, 1);
  assert.equal(s.daggers, 1);
  s = rules.intent(s, snake, { type: 'dagger', kind: 'peek', target: guests[1] as string }, 1);
  assert.equal(s.daggers, 1, 'one Dagger a night');
  s = until(s, 'vote');
  assert.equal(rules.playerView(s, guests[0] as string).vote?.canVote, false, 'silenced at the next Round Table');

  let d = until(start(10, 13), 'night');
  const sn = snakesOf(d)[0] as string;
  d = { ...d, daggers: 1 };
  d = rules.intent(d, sn, { type: 'dagger', kind: 'double', target: null }, 1);
  assert.equal(rules.playerView(d, sn).night?.grid.max, 2);
  d = until(d, 'breakfast');
  assert.equal(d.breakfast?.murdered.length, 2);

  let p = until(start(8, 14), 'night');
  const ps = snakesOf(p)[0] as string;
  const g = rules.living(p).find((id) => p.players[id]?.role === 'guest') as string;
  p = { ...p, daggers: 1, players: { ...p.players, [g]: { ...p.players[g]!, shield: true } } };
  p = rules.intent(p, ps, { type: 'dagger', kind: 'peek', target: g }, 1);
  assert.deepEqual(p.peeks, [{ target: g, shield: true }]);
  assert.ok(rules.playerView(p, ps).night?.box.messages.some((m) => m.from === 'salty'));
});

test('the endgame: only a unanimous End ends it; otherwise one more Round Table', () => {
  let s = until(start(5, 21), 'night');
  // Down to 3: straight into the endgame after breakfast.
  const guests = rules.living(s).filter((id) => s.players[id]?.role === 'guest');
  s = { ...s, players: { ...s.players, [guests[0] as string]: { ...s.players[guests[0] as string]!, status: 'ghost' } } };
  s = until(s, 'endVote');
  const alive = rules.living(s);
  for (const [i, id] of alive.entries()) s = rules.intent(s, id, { type: 'endVote', end: i > 0 }, 1);
  assert.equal(s.stage, 'debate', 'one Banish again is enough to go on');
  s = until(s, 'endVote');
  for (const id of rules.living(s)) s = rules.intent(s, id, { type: 'endVote', end: true }, 2);
  assert.equal(s.stage, 'unmask');
  s = until(s, 'final');
});

test('Quick drama shortens staged reveals but never the debate, vote or night clocks', () => {
  const full = until(start(8, 30, [], 'full'), 'debate');
  const quick = until(start(8, 30, [], 'quick'), 'debate');
  assert.equal((full.stageEnds ?? 0) - full.stageStart, (quick.stageEnds ?? 0) - quick.stageStart);
  assert.equal(rules.staged(quick, 10_000), 6_000);
  assert.equal(rules.staged(full, 10_000), 10_000);
});

test('a player who leaves is out with their role shown; late joiners watch', () => {
  let s = until(start(6, 9), 'debate');
  const gone = s.order[2] as string;
  s = rules.setPlayers(s, seats(6).filter((p) => p.id !== gone).concat([{ id: 'late', band: 'grownups' }]), 1);
  assert.equal(s.players[gone]?.status, 'left');
  assert.notEqual(rules.hostView(s).players.find((p) => p.id === gone)?.role, null);
  assert.equal(rules.playerView(s, 'late').spectator, true);
});
