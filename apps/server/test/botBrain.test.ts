// Thinking house bots (botBrain.ts): the model sees only what the bot's seat may know (ADR 0023), its answers are
// checked before they reach the table, and every failure falls back to the simple rules. No network: chat is mocked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Band } from '@smartmouth/protocol';
import { rules, type MQuestion, type SnakesState } from '@smartmouth/game-snakes';
import { BotBrain, MAX_CALLS_PER_ROOM, buildPrompt, checkLine, fit, type BrainContext } from '../src/botBrain.ts';
import { botMoves } from '../src/adapters/snakes.ts';
import type { Chat, ChatOptions } from '../src/ai.ts';

let qid = 1;
const q = (): MQuestion => ({
  id: qid++, prompt: 'Q', kind: 'choice', answers: [{ text: 'A', image: null }, { text: 'B', image: null }], correct: 1, explain: '', category: 'T', spice: 'mild',
});
const NAMES = ['Agnes', 'Bartholomew', 'Cordelia', 'Dunstan', 'Edith', 'Fenwick'];
const ctx = (spice: BrainContext['spice'] = 'mild'): BrainContext => ({ names: Object.fromEntries(NAMES.map((n, i) => [`p${i + 1}`, n])), spice });

/** A six-player game played by the simple rules up to the given stage. */
function at(stage: SnakesState['stage'], seed = 5): SnakesState {
  let s = rules.init(NAMES.map((_, i) => ({ id: `p${i + 1}`, band: 'grownups' as Band })), { spice: 'hot', seed, drama: 'full' }, { grownups: Array.from({ length: 60 }, q) }, 0);
  let x = seed;
  const rand = () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
  let t = 0;
  for (let i = 0; i < 400 && s.stage !== stage; i++) {
    for (const id of s.order) for (const intent of botMoves(s, id, rand)) { s = rules.intent(s, id, intent as never, t); if (s.stage === stage) return s; }
    t = Math.max(t, rules.nextDeadline(s) ?? t);
    s = rules.tick(s, t);
  }
  assert.equal(s.stage, stage);
  return s;
}
const roleOf = (s: SnakesState, id: string) => s.players[id]!.role;
const guests = (s: SnakesState) => s.order.filter((id) => roleOf(s, id) === 'guest');
const snakesOf = (s: SnakesState) => s.order.filter((id) => roleOf(s, id) === 'snake');

test('a Guest bot’s prompt is the same whoever the Snakes are (it never sees a hidden role)', () => {
  const s = at('debate');
  const g = guests(s)[0]!;
  const a = buildPrompt(rules.playerView(s, g), g, 'talk', ctx());
  // Make a different (living) Guest the Snake instead: this bot's prompt must not change.
  const other = guests(s).find((id) => id !== g && s.players[id]!.status === 'alive')!;
  const sn = snakesOf(s)[0]!;
  const swapped: SnakesState = { ...s, players: { ...s.players, [other]: { ...s.players[other]!, role: 'snake' }, [sn]: { ...s.players[sn]!, role: 'guest' } } };
  const b = buildPrompt(rules.playerView(swapped, g), g, 'talk', ctx());
  assert.deepEqual(a, b);
  assert.match(a.system, /You are a GUEST/);
});

test('a Snake bot knows its partners, and is told never to give them away', () => {
  const s = at('debate');
  const sn = snakesOf(s)[0]!;
  const p = buildPrompt(rules.playerView(s, sn), sn, 'talk', ctx());
  assert.match(p.system, /secretly a SNAKE/);
  for (const f of snakesOf(s).filter((id) => id !== sn)) assert.ok(p.system.includes(ctx().names[f]!), 'partner named');
});

test('lines are checked: spice, length, and a Snake never outs a partner', () => {
  const s = at('debate');
  const g = guests(s)[0]!;
  const gv = rules.playerView(s, g);
  assert.equal(checkLine('What the hell, Agnes?', gv, ctx('mild')), null);
  assert.equal(checkLine('What the hell, Agnes?', gv, ctx('hot')), 'What the hell, Agnes?');
  assert.ok(checkLine('x'.repeat(400), gv, ctx())!.length <= 140);
  const long = checkLine('word '.repeat(60), gv, ctx())!;
  assert.ok(long.length <= 140 && long.endsWith('word…'), long);
  const sn = snakesOf(s)[0]!;
  const partner = snakesOf(s).find((id) => id !== sn);
  const sv = rules.playerView(s, sn);
  assert.equal(checkLine("Fine, I'm a snake.", sv, ctx()), null);
  if (partner) {
    assert.equal(checkLine(`${ctx().names[partner]} is on my team, trust them.`, sv, ctx()), null);
    assert.ok(checkLine(`${ctx().names[partner]} went quiet in the mission.`, sv, ctx()), 'naming a partner without outing them is fine');
  }
});

test('a long line is cut at a sentence or a clause, so it never reads as cut off', () => {
  assert.equal(fit('Dunstan, you keep pushing everyone but never say who you think sank it. Bertram, finish your Edith point or drop it, because we are out of time.'),
    'Dunstan, you keep pushing everyone but never say who you think sank it.');
  assert.equal(fit('Dunstan and Cecily keep trading accusations without naming a suspect, so I will say it plainly: Tester never named a bot, and that vagueness worries me most of all.'),
    'Dunstan and Cecily keep trading accusations without naming a suspect, so I will say it plainly: Tester never named a bot.');
  assert.equal(fit('Short and sweet.'), 'Short and sweet.');
});

test('table talk: only the living speak, only at the table, and the feed keeps this round’s lines', () => {
  const s = at('debate');
  const id = s.order.find((x) => s.players[x]!.status === 'alive')!;
  const s2 = rules.intent(s, id, { type: 'talk', text: '  Watch Edith.  ' }, 1);
  assert.deepEqual(s2.talk.at(-1), { from: id, text: 'Watch Edith.', round: s.round });
  assert.equal(rules.hostView(s2).talk.length, 1);
  assert.equal(rules.playerView(s2, id).canTalk, true);
  const dead = s.order.find((x) => s.players[x]!.status !== 'alive');
  if (dead) assert.equal(rules.intent(s, dead, { type: 'talk', text: 'Boo' }, 1).talk.length, 0);
  const night = at('night');
  assert.equal(rules.intent(night, night.order[0]!, { type: 'talk', text: 'Hi' }, 1).talk.length, night.talk.length);
});

function mock(reply: (o: ChatOptions) => string): { chat: Chat; calls: ChatOptions[] } {
  const calls: ChatOptions[] = [];
  return { calls, chat: async (o) => { calls.push(o); return { text: reply(o), cost: 0, sources: [] }; } };
}

test('a vote by name becomes a vote intent; a made-up name gives null (the simple rules fill in)', async () => {
  const s = at('vote');
  const voter = s.order.find((id) => rules.playerView(s, id).vote?.canVote)!;
  const target = rules.playerView(s, voter).vote!.candidates[0]!;
  const ok = mock(() => JSON.stringify({ target: ctx().names[target] }));
  assert.deepEqual(await new BotBrain(ok.chat).think('ROOM', s, voter, 'vote', ctx()), [{ type: 'vote', target }]);
  assert.ok(ok.calls[0]!.schema, 'asks for structured output');
  const bad = mock(() => JSON.stringify({ target: 'Nobody Real' }));
  assert.equal(await new BotBrain(bad.chat).think('ROOM', s, voter, 'vote', ctx()), null);
});

test('a Snake’s night: pick, a private line, then lock', async () => {
  const s = at('night');
  const sn = snakesOf(s).find((id) => s.players[id]!.status === 'alive' && rules.playerView(s, id).night?.grid.kind !== 'answer')!;
  const cand = rules.playerView(s, sn).night!.grid.candidates[0]!;
  const m = mock(() => JSON.stringify({ target: ctx().names[cand], line: 'Quiet one first.' }));
  assert.deepEqual(await new BotBrain(m.chat).think('ROOM', s, sn, 'night', ctx()), [{ type: 'pick', target: cand }, { type: 'say', text: 'Quiet one first.' }, { type: 'lock' }]);
});

test('each room has a call budget', async () => {
  const s = at('debate');
  const id = s.order[0]!;
  const m = mock(() => JSON.stringify({ line: 'Hmm.' }));
  const brain = new BotBrain(m.chat);
  for (let i = 0; i < MAX_CALLS_PER_ROOM; i++) await brain.think('ROOM', s, id, 'talk', ctx());
  assert.equal(await brain.think('ROOM', s, id, 'talk', ctx()), null);
  assert.equal(m.calls.length, MAX_CALLS_PER_ROOM);
  assert.ok(await brain.think('OTHER', s, id, 'talk', ctx()), 'another room has its own budget');
});
