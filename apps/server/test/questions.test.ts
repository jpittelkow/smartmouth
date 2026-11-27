// The question library (ADR 0010): grading rules, the store, filters, coverage, seeds and the admin API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { checkReasons, measuredDifficulty, validateQuestion, type QuestionInput } from '@smartmouth/protocol';
import { openDb } from '../src/db.ts';
import { coverage, createQuestion, listQuestions, setStatus, updateQuestion, importSeeds } from '../src/questions.ts';
import { readSeeds } from '../src/seeds.ts';
import { startServer } from '../src/http.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const body = (r: Response): Promise<any> => r.json();

const NOW = Date.parse('2026-11-26T12:00:00Z');

const base = (over: Record<string, unknown> = {}) => ({
  prompt: 'What do bees make?', kind: 'choice', answers: ['Milk', 'Honey', 'Jam'], correct: 1, explain: '',
  ageMin: 'kids', ageMax: 'tweens', difficulty: 2, category: 'Animals', tags: ['Insects', 'insects', ' bugs '],
  freshness: 'evergreen', spice: 'mild', status: 'live', ...over,
});

const valid = (over: Record<string, unknown> = {}): QuestionInput => {
  const v = validateQuestion(base(over));
  if (!v.ok) throw new Error(JSON.stringify(v.errors));
  return v.value;
};

test('grading: a good question passes and is normalised', () => {
  const q = valid();
  assert.deepEqual(q.answers, [{ text: 'Milk', image: null }, { text: 'Honey', image: null }, { text: 'Jam', image: null }]);
  assert.deepEqual(q.tags, ['insects', 'bugs']);
  assert.equal(q.region, 'global');
});

test('grading: the rules that keep the library sane', () => {
  const bad = (over: Record<string, unknown>) => { const v = validateQuestion(base(over)); return v.ok ? {} : v.errors; };
  assert.ok(bad({ ageMin: 'teens', ageMax: 'kids' }).ageMax, 'age range backwards');
  assert.ok(bad({ difficulty: 6 }).difficulty, 'difficulty is 1–5');
  assert.ok(bad({ correct: 3 }).correct, 'correct answer must exist');
  assert.ok(bad({ answers: ['A', 'a'] }).answers, 'duplicate answers');
  assert.ok(bad({ category: 'Astrology' }).category, 'unknown category');
  assert.ok(bad({ kind: 'truefalse', answers: ['True', 'False', 'Maybe'] }).answers, 'true/false has 2 answers');
  assert.ok(bad({ ageMin: 'little', ageMax: 'little', kind: 'picture', answers: ['A', 'B', 'C', 'D'] }).answers, 'Little gets 3 at most');
  assert.ok(bad({ freshness: 'dated' }).asOf, 'dated needs the date it was checked');
  assert.ok(bad({ freshness: 'current', asOf: '2026-11-20' }).expiresAt, 'current needs an expiry');
  assert.ok(bad({ spice: 'filthy' }).spice, 'too spicy for its youngest age');
  assert.ok(!bad({ ageMin: 'grownups', ageMax: 'grownups', spice: 'filthy' }).spice, 'fine for grown-ups only');
  const little = validateQuestion(base({ ageMin: 'little', ageMax: 'little', kind: 'choice' }));
  assert.ok(little.ok && little.warnings.some((w) => w.includes('picture')), 'Little text questions get a warning, not an error');
});

test('difficulty as it plays, and reasons to re-check', () => {
  assert.equal(measuredDifficulty(5, 5), null, 'not enough plays yet');
  assert.equal(measuredDifficulty(20, 19), 1);
  assert.equal(measuredDifficulty(20, 5), 5);
  const stats = { asked: 20, correct: 19, avgMs: null, lastAskedAt: null, flags: 0 };
  assert.deepEqual(checkReasons({ freshness: 'evergreen', asOf: null, expiresAt: null, difficulty: 4, stats, status: 'live' }, '2026-11-26'),
    ['graded 4, plays as 1']);
  assert.ok(checkReasons({ freshness: 'dated', asOf: '2025-01-01', expiresAt: null, difficulty: 1, stats, status: 'live' }, '2026-11-26')[0]?.includes('year'));
  assert.deepEqual(checkReasons({ freshness: 'current', asOf: '2026-10-01', expiresAt: '2026-11-01', difficulty: 1, stats, status: 'live' }, '2026-11-26'), ['expired']);
});

test('store: create, update, filter by age band and the rest', () => {
  const db = openDb(':memory:');
  const a = createQuestion(db, valid(), NOW);
  createQuestion(db, valid({ prompt: 'Capital of France?', answers: ['Paris', 'Rome'], correct: 0, ageMin: 'tweens', ageMax: 'grownups', category: 'Geography', difficulty: 1 }), NOW);
  createQuestion(db, valid({ prompt: 'Tallest building?', answers: ['Burj Khalifa', 'Shanghai Tower'], correct: 0, ageMin: 'teens', ageMax: 'grownups', category: 'Geography', freshness: 'dated', asOf: '2024-01-01', status: 'review' }), NOW);

  assert.equal(listQuestions(db, {}, NOW).total, 3);
  assert.equal(listQuestions(db, { band: 'kids' }, NOW).total, 1, 'only the bees question suits kids');
  assert.equal(listQuestions(db, { band: 'tweens' }, NOW).total, 2, 'a range counts for every band inside it');
  assert.equal(listQuestions(db, { category: 'Geography', status: 'live' }, NOW).total, 1);
  assert.equal(listQuestions(db, { q: 'honey' }, NOW).total, 1, 'search looks in answers too');
  assert.equal(listQuestions(db, { q: '100%_' }, NOW).total, 0, 'search wildcards are literal');
  assert.equal(listQuestions(db, { needsCheck: true }, NOW).total, 1, 'the dated answer is over a year old');

  const edited = updateQuestion(db, a.id, valid({ difficulty: 4 }), NOW + 1000);
  assert.equal(edited?.difficulty, 4);
  assert.equal(setStatus(db, [a.id], 'retired', NOW), 1);
  assert.equal(listQuestions(db, { status: 'retired' }, NOW).items[0]?.id, a.id);
});

test('coverage counts live questions for every band in their range', () => {
  const db = openDb(':memory:');
  createQuestion(db, valid(), NOW); // kids–tweens, Animals, difficulty 2
  createQuestion(db, valid({ status: 'review' }), NOW);
  const c = coverage(db, NOW);
  assert.equal(c.byCategory.kids.Animals, 1);
  assert.equal(c.byCategory.tweens.Animals, 1);
  assert.equal(c.byCategory.teens.Animals, undefined);
  assert.deepEqual(c.byDifficulty.kids, [0, 1, 0, 0, 0]);
  assert.equal(c.totals.live, 1);
  assert.equal(c.totals.review, 1);
});

test('every seed question is valid, and seeding twice adds nothing', () => {
  const dir = fileURLToPath(new URL('../../../content/seed', import.meta.url));
  const { seeds, problems } = readSeeds(dir);
  assert.deepEqual(problems, []);
  assert.ok(seeds.length >= 30);
  const db = openDb(':memory:');
  assert.equal(importSeeds(db, seeds, NOW), seeds.length);
  assert.equal(importSeeds(db, seeds, NOW), 0);
  const bands = coverage(db, NOW).byCategory;
  for (const b of ['kids', 'tweens', 'teens', 'grownups'] as const) assert.ok(Object.keys(bands[b]).length > 0, `${b} has live seeds`);
});

test('admin API: needs a session, validates, lists, imports, exports without house questions', async () => {
  const srv = await startServer({ port: 0, publicUrl: null, allowedOrigins: [], webDir: '.', adminPassword: 'pw' });
  const url = `http://127.0.0.1:${(srv.server.address() as { port: number }).port}`;
  try {
    assert.equal((await fetch(`${url}/api/admin/questions`)).status, 401);
    const login = await fetch(`${url}/api/admin/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"password":"pw"}' });
    const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    const call = (path: string, init: RequestInit = {}) => fetch(`${url}${path}`, {
      ...init, headers: { cookie, 'content-type': 'application/json', ...(init.headers ?? {}) },
    });

    const badCreate = await call('/api/admin/questions', { method: 'POST', body: JSON.stringify(base({ difficulty: 9 })) });
    assert.equal(badCreate.status, 422);
    assert.ok((await body(badCreate)).errors.difficulty);

    const created = await call('/api/admin/questions', { method: 'POST', body: JSON.stringify(base()) });
    assert.equal(created.status, 201);
    const { question } = await body(created);

    const house = await call('/api/admin/questions', { method: 'POST', body: JSON.stringify(base({ prompt: 'What is the dog called?', region: 'house' })) });
    assert.equal(house.status, 201);

    const put = await call(`/api/admin/questions/${question.id}`, { method: 'PUT', body: JSON.stringify(base({ difficulty: 5 })) });
    assert.equal((await body(put)).question.difficulty, 5);

    const list = await body(await call('/api/admin/questions?band=kids&difficulty=5'));
    assert.equal(list.total, 1);

    const imp = await body(await call('/api/admin/questions/import', { method: 'POST', body: JSON.stringify({ questions: [base({ prompt: 'Imported?' }), { prompt: 'x' }] }) }));
    assert.equal(imp.added, 1);
    assert.equal(imp.errors[0].index, 1);
    const imported = await body(await call('/api/admin/questions?q=Imported'));
    assert.equal(imported.items[0].status, 'review', 'imports wait for review');

    const exp = await body(await call('/api/admin/questions/export'));
    assert.equal(exp.questions.length, 2, 'house questions stay home');
    assert.ok(exp.questions.every((q: { region: string }) => q.region !== 'house'));

    const del = await call(`/api/admin/questions/${question.id}`, { method: 'DELETE' });
    assert.equal(del.status, 200);
    assert.equal((await call(`/api/admin/questions/${question.id}`)).status, 404);

    const cov = await body(await call('/api/admin/questions/coverage'));
    assert.equal(cov.totals.review, 1);
  } finally {
    await srv.close();
  }
});
