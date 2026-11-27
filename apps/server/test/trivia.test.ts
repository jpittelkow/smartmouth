// Trivia's rules (ADR 0008, 0009), driven with a fake clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Band } from '@smartmouth/protocol';
import { rules, type TQuestion, type TriviaContent, type TriviaState } from '@smartmouth/game-trivia';

let nextId = 1;
const q = (over: Partial<TQuestion> = {}): TQuestion => ({
  id: nextId++, prompt: `Q${nextId}`, kind: 'choice', answers: [{ text: 'A', image: null }, { text: 'B', image: null }, { text: 'C', image: null }],
  correct: 1, explain: 'Because.', category: 'Animals', spice: 'mild', ...over,
});
const content = (per = 12): TriviaContent => Object.fromEntries((['little', 'kids', 'tweens', 'teens', 'grownups'] as Band[])
  .map((b) => [b, Array.from({ length: per }, () => q(b === 'little' ? { kind: 'picture' } : {}))])) as TriviaContent;

const start = (players: Array<[string, Band]>, rounds = 4, c = content()) =>
  rules.init(players.map(([id, band]) => ({ id, band })), { rounds, spice: 'spicy' }, c, 0);

const toQuestion = (s: TriviaState) => rules.tick(s, s.stageEnds as number);

test('everyone gets a question for their own band; the TV shows the oldest band', () => {
  let s = toQuestion(start([['g', 'grownups'], ['k', 'kids']]));
  assert.equal(s.stage, 'question');
  assert.equal(s.tvBand, 'grownups');
  const kidView = rules.playerView(s, 'k');
  const grownView = rules.playerView(s, 'g');
  assert.ok(kidView.question && grownView.question);
  assert.notEqual(kidView.question.prompt, grownView.question.prompt);
  assert.equal(kidView.showPrompt, true, 'the kid’s question isn’t on the TV, so the phone shows it');
  assert.equal(grownView.showPrompt, false);
  assert.equal(s.questionEnds - s.questionStart, 30_000, 'kids get longer');
});

test('no player view (or host view) leaks the right answer before the reveal', () => {
  const s = toQuestion(start([['g', 'grownups'], ['t', 'teens']]));
  const before = JSON.stringify([rules.hostView(s), rules.playerView(s, 'g'), rules.playerView(s, 't')]);
  assert.ok(!before.includes('"correct":1'), before);
  assert.ok(!before.includes('Because.'), 'the explanation waits too');
});

test('answers: one each, in time; everyone answering reveals at once; scores are handicapped', () => {
  let s = toQuestion(start([['g', 'grownups'], ['k', 'kids']]));
  const t0 = s.questionStart;
  s = rules.intent(s, 'g', { type: 'answer', choice: 1 }, t0 + 1000);
  s = rules.intent(s, 'g', { type: 'answer', choice: 0 }, t0 + 1500); // second answer ignored
  assert.equal(s.stage, 'question');
  s = rules.intent(s, 'k', { type: 'answer', choice: 1 }, t0 + 5000);
  assert.equal(s.stage, 'reveal', 'all in: reveal straight away');
  assert.equal(s.gained.k, 200, 'kids ×2, no speed bonus');
  assert.ok((s.gained.g ?? 0) > 100 && (s.gained.g ?? 0) <= 150, 'grown-ups ×1 plus a speed bonus');
  assert.equal(s.log.length, 2);
  assert.equal(rules.playerView(s, 'k').result?.right, true);
});

test('late answers are refused by the rules, not the phone', () => {
  let s = toQuestion(start([['g', 'grownups'], ['t', 'teens']]));
  s = rules.intent(s, 'g', { type: 'answer', choice: 1 }, s.questionEnds + 1);
  assert.equal(s.picks.g, undefined);
  s = rules.tick(s, s.questionEnds);
  assert.equal(s.stage, 'reveal');
  assert.equal(s.gained.g, 0);
  assert.deepEqual(s.log.map((l) => l.ms), [null, null], 'unanswered plays are logged without a time');
});

test('a Little player gets a turn every other round, can answer by the TV remote, and helpers earn a bonus', () => {
  let s = start([['g', 'grownups'], ['l', 'little']], 4);
  s = toQuestion(s); // round 1
  assert.equal(rules.playerView(s, 'l').question, null, 'Little players don’t get the phone question');
  s = rules.intent(s, 'g', { type: 'answer', choice: 1 }, s.questionStart + 1);
  s = rules.tick(s, s.stageEnds as number); // reveal → round 2
  assert.equal(s.round, 2);
  s = rules.intent(s, 'g', { type: 'answer', choice: 1 }, s.questionStart + 1);
  s = rules.tick(s, s.stageEnds as number); // reveal → turn
  assert.equal(s.stage, 'turn');
  assert.equal(s.turn?.playerId, 'l');
  assert.equal(s.stageEnds !== null && s.stageEnds - (s.turn?.start ?? 0) >= 60_000, true, 'no real timer for a Little');
  s = rules.intent(s, 'g', { type: 'answer', choice: 1 }, 10); // grown-up helps
  s = rules.intent(s, 'tv', { type: 'answerFor', playerId: 'l', choice: 1 }, 20); // the remote answers for the Little
  assert.equal(s.stage, 'turnReveal');
  assert.equal(s.gained.l, 300, 'Little ×3');
  assert.equal(s.gained.g, 25, 'helper bonus');
});

test('a wrong Little pick still earns a try point, and the final always crowns Littles superstars', () => {
  let s = start([['g', 'grownups'], ['l', 'little']], 2);
  s = toQuestion(s);
  s = rules.intent(s, 'g', { type: 'answer', choice: 1 }, s.questionStart + 1);
  s = rules.tick(s, s.stageEnds as number);
  s = rules.intent(s, 'g', { type: 'answer', choice: 1 }, s.questionStart + 1);
  s = rules.tick(s, s.stageEnds as number);
  s = rules.intent(s, 'l', { type: 'answer', choice: 0 }, 5);
  assert.equal(s.gained.l, 25);
  s = rules.tick(s, s.stageEnds as number);
  assert.equal(s.stage, 'final');
  const final = rules.hostView(s).final;
  assert.ok(final?.find((r) => r.id === 'l')?.superstar);
  assert.equal(final?.[0]?.id, 'g');
});

test('only Little players: every round is a turn', () => {
  let s = start([['l', 'little']], 2);
  s = toQuestion(s);
  assert.equal(s.stage, 'turn');
});

test('spice turned down mid-game skips spicier questions', () => {
  const c = content(3);
  c.grownups = [q({ spice: 'filthy', prompt: 'rude' }), q({ prompt: 'clean' })];
  let s = rules.init([{ id: 'g', band: 'grownups' }], { rounds: 2, spice: 'filthy' }, c, 0);
  s = rules.setSpice(s, 'mild'); // a Little walked in
  s = toQuestion(s);
  assert.equal(s.current.grownups?.prompt, 'clean');
});

test('skip ends a wait; running out of questions ends the game', () => {
  let s = toQuestion(start([['g', 'grownups']], 8, content(1)));
  s = rules.intent(s, 'g', { type: 'skip' }, s.questionStart + 1);
  assert.equal(s.stage, 'reveal');
  s = rules.intent(s, 'g', { type: 'skip' }, s.questionStart + 2);
  assert.equal(s.stage, 'final', 'one question per band: nothing left to ask');
});
