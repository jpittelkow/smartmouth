// The question generator (ADR 0011): checked questions publish, doubted ones wait in review, duplicates are skipped,
// and the admin routes need a session.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.ts';
import { Generator, checkRequest, clean, isDuplicate } from '../src/generator.ts';
import type { Chat, ChatOptions } from '../src/ai.ts';
import { listQuestions } from '../src/questions.ts';
import { startServer } from '../src/http.ts';

const WRITTEN = {
  questions: [
    { band: 'little', prompt: 'Which pup drives the fire truck?', kind: 'picture', answers: ['Marshall', 'Chase', 'Skye'], correct: 0,
      explain: 'Marshall is the fire pup!', difficulty: 1, category: 'Movies & TV', tags: ['paw patrol'], dated: false },
    { band: 'little', prompt: 'Which pup flies a helicopter?', kind: 'picture', answers: ['Rubble', 'Skye'], correct: 1,
      explain: 'Skye loves to fly.', difficulty: 1, category: 'Movies & TV', tags: ['paw patrol'], dated: false },
    { band: 'kids', prompt: 'What is the name of the boy who leads the PAW Patrol?', kind: 'choice', answers: ['Ryder', 'Rocky', 'Zuma'], correct: 0,
      explain: 'Ryder is ten years old.', difficulty: 2, category: 'Movies & TV', tags: ['paw patrol'], dated: false },
    // A duplicate of the first one, which must be skipped.
    { band: 'kids', prompt: 'Which pup drives the fire truck?', kind: 'choice', answers: ['Marshall', 'Chase', 'Skye'], correct: 0,
      explain: 'Fire pup.', difficulty: 1, category: 'Movies & TV', tags: [], dated: false },
  ],
};
// The checker agrees with the first and third, and answers the second differently.
const CHECKS = { checks: [
  { n: 0, answer: 0, confidence: 0.95, clear: true, ageFit: true, issue: '' },
  { n: 1, answer: 0, confidence: 0.6, clear: true, ageFit: true, issue: 'Not sure which pup flies.' },
  { n: 2, answer: 0, confidence: 0.9, clear: true, ageFit: true, issue: '' },
  { n: 3, answer: 0, confidence: 0.9, clear: true, ageFit: true, issue: '' },
] };

function fakeChat(calls: ChatOptions[]): Chat {
  return async (o) => {
    calls.push(o);
    const isWriter = !!o.web;
    return { text: JSON.stringify(isWriter ? WRITTEN : CHECKS), cost: 0.01, sources: isWriter ? [{ url: 'https://example.org/paw', title: 'Paw' }] : [] };
  };
}

test('a batch publishes what the checker agrees with, sends the rest to review, and skips duplicates', async () => {
  const db = openDb(':memory:');
  const calls: ChatOptions[] = [];
  const published: number[][] = [];
  const gen = new Generator(db, { chat: fakeChat(calls), writerModel: 'w', checkerModel: 'c', budget: 1, onPublished: (ids) => published.push(ids) });
  const { job, done } = gen.start({ topic: 'Paw Patrol', bands: ['little', 'kids'], perBand: 2, spice: 'mild', publish: true });
  await done;
  assert.equal(job.state, 'done', job.error ?? '');
  assert.equal(calls.length, 2);
  assert.equal(calls[0]!.web, true, 'the writer researches on the web');
  assert.equal(calls[1]!.web, undefined, 'the checker answers blind, without search');
  assert.ok(!String(calls[1]!.messages.at(-1)!.content).includes('correct'), 'the checker is not told the answer');
  assert.deepEqual(job.results.map((r) => r.status), ['live', 'review', 'live']);
  assert.match(job.results[1]!.note, /Rubble/);
  assert.equal(job.skipped.length, 1);
  assert.equal(published.length, 1);
  assert.equal(published[0]!.length, 2);
  const all = listQuestions(db, { limit: 50, offset: 0 }, Date.now()).items;
  assert.equal(all.length, 3);
  assert.ok(all.every((q) => q.source === 'ai' && q.tags.includes('ai') && q.sourceRef.includes('example.org')));
  assert.equal(all.find((q) => q.prompt.startsWith('What is the name'))!.ageMax, 'tweens');
  assert.ok(Math.abs(job.cost - 0.02) < 1e-9);
});

test('with publish off, everything waits in review; only one batch runs at a time', async () => {
  const db = openDb(':memory:');
  const gen = new Generator(db, { chat: fakeChat([]), writerModel: 'w', checkerModel: 'c', budget: 1 });
  const first = gen.start({ topic: 'Paw Patrol', bands: ['little', 'kids'], perBand: 2, spice: 'mild', publish: false });
  assert.throws(() => gen.start({ topic: 'x', bands: ['kids'], perBand: 1, spice: 'mild', publish: false }), /already/);
  await first.done;
  assert.ok(first.job.results.every((r) => r.status === 'review'));
});

test('requests are checked, and near-identical prompts count as duplicates', () => {
  assert.equal(checkRequest({ topic: '', bands: ['kids'] }).ok, false);
  assert.equal(checkRequest({ topic: 'Space', bands: [] }).ok, false);
  assert.equal(checkRequest({ topic: 'Space', bands: ['kids'], perBand: 99 }).ok, false);
  const ok = checkRequest({ topic: '  Space  ', bands: ['kids', 'nope', 'kids'] });
  assert.ok(ok.ok && ok.value.topic === 'Space' && ok.value.bands.length === 1 && ok.value.publish === true);
  const words = (s: string) => new Set(s.toLowerCase().split(/\W+/).filter((w) => w.length > 2));
  assert.equal(isDuplicate('Which pup drives the big fire truck?', [words('Which pup drives the fire truck?')]), true);
  assert.equal(isDuplicate('Which planet is the biggest?', [words('Which pup drives the fire truck?')]), false);
});

test('the generator routes need an admin session', async () => {
  const s = await startServer({ port: 0, publicUrl: null, allowedOrigins: [], webDir: '.', adminPassword: 'pw',
    makeGenerator: (db) => new Generator(db, { chat: fakeChat([]), writerModel: 'w', checkerModel: 'c', budget: 1 }) });
  const addr = s.server.address();
  const base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
  try {
    assert.equal((await fetch(`${base}/api/admin/generate`)).status, 401);
    const login = await fetch(`${base}/api/admin/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'pw' }) });
    const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0]!;
    const r = await fetch(`${base}/api/admin/generate`, { method: 'POST', headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ topic: 'Paw Patrol', bands: ['little'], perBand: 2 }) });
    assert.equal(r.status, 202);
    const g = await (await fetch(`${base}/api/admin/generate`, { headers: { cookie } })).json() as { enabled: boolean; jobs: unknown[] };
    assert.equal(g.enabled, true);
    assert.equal(g.jobs.length, 1);
  } finally {
    await s.close();
  }
});

test('citations the web search leaves behind are removed before Salty reads them', () => {
  assert.equal(clean('Ryder is 10 years old. [simple.wikipedia.org](https://simple.wikipedia.org/wiki/Paw_Patrol)'), 'Ryder is 10 years old.');
  assert.equal(clean('Zuma is a Lab ([wikipedia.org](https://en.wikipedia.org/x)) and loves water [2].'), 'Zuma is a Lab and loves water.');
  assert.equal(clean('See https://example.org/page for more!'), 'See for more!');
});
