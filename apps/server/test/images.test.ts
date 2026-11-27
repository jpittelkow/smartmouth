// Pictures (owner, 2026-11-27): only free licenses, every picture carries its credit, and a question keeps its pictures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateQuestion } from '@smartmouth/protocol';
import { openDb } from '../src/db.ts';
import { creditFor, freeLicense, storeImage } from '../src/images.ts';
import { createQuestion, getQuestion } from '../src/questions.ts';

test('only licenses we may show with a credit pass', () => {
  for (const ok of ['Public domain', 'CC0', 'CC BY 4.0', 'CC BY-SA 3.0', 'CC BY 2.0']) assert.ok(freeLicense(ok), ok);
  for (const no of ['CC BY-NC 2.0', 'CC BY-ND 4.0', 'CC BY-NC-SA 4.0', 'Fair use', 'GFDL', 'All rights reserved', '']) assert.ok(!freeLicense(no), no);
  assert.equal(creditFor({ author: 'Jane Doe', license: 'CC BY-SA 4.0' }), 'Jane Doe · CC BY-SA 4.0 · Wikimedia Commons');
  assert.equal(creditFor({ author: 'Unknown', license: 'Public domain' }), 'Public domain · Wikimedia Commons');
});

test('a stored picture is a file with its credit, and a question keeps its pictures; outside URLs are refused', () => {
  const media = mkdtempSync(join(tmpdir(), 'sm-img-'));
  const db = openDb(':memory:');
  const pic = storeImage(db, media, { bytes: Buffer.from('jpg'), ext: 'jpg', source: 'upload', title: 'Red fire truck!', author: 'Me',
    license: 'Ours', pageUrl: '', alt: 'A red fire truck', credit: 'Our own photo' });
  assert.match(pic.url, /^\/media\/images\/\d+-red-fire-truck\.jpg$/);
  assert.ok(existsSync(join(media, 'images', pic.url.split('/').pop()!)));
  const v = validateQuestion({
    prompt: 'Which one is red?', kind: 'choice', answers: [{ text: 'Truck', image: pic.url, credit: pic.credit }, { text: 'Sky' }], correct: 0,
    ageMin: 'kids', ageMax: 'kids', difficulty: 1, category: 'Colors & Shapes', image: pic,
    revealImages: [pic, { url: 'https://evil.example/x.jpg', alt: '', credit: '' }],
  });
  assert.ok(v.ok);
  assert.equal(v.value.revealImages?.length, 1, 'only our own media files');
  const q = createQuestion(db, v.value, Date.now());
  const back = getQuestion(db, q.id, Date.now())!;
  assert.deepEqual(back.image, pic);
  assert.equal(back.answers[0]?.credit, 'Our own photo');
  db.close();
});

test('admin pictures API: needs a session, checks uploads by their bytes, serves what it stored', async () => {
  const media = mkdtempSync(join(tmpdir(), 'sm-imgapi-'));
  const { startServer } = await import('../src/http.ts');
  const srv = await startServer({ port: 0, publicUrl: null, allowedOrigins: [], webDir: '.', adminPassword: 'pw', mediaDir: media });
  const url = `http://127.0.0.1:${(srv.server.address() as { port: number }).port}`;
  try {
    const post = (path: string, b: unknown, cookie = '') => fetch(`${url}${path}`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(b) });
    assert.equal((await post('/api/admin/images/upload', {})).status, 401);
    const login = await post('/api/admin/login', { password: 'pw' });
    const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    // A 1×1 PNG.
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const fake = Buffer.from('<svg onload=alert(1)>').toString('base64');
    assert.equal((await post('/api/admin/images/upload', { data: `data:image/png;base64,${fake}` }, cookie)).status, 400, 'not really a picture');
    const ok = await post('/api/admin/images/upload', { data: `data:image/png;base64,${png}`, alt: 'a dot', credit: '' }, cookie);
    assert.equal(ok.status, 200);
    const { image } = (await ok.json()) as { image: { url: string; credit: string } };
    assert.match(image.url, /^\/media\/images\/\d+-a-dot\.png$/);
    assert.equal(image.credit, 'Our own photo');
    assert.equal((await fetch(`${url}${image.url}`)).status, 200);
    const preview = await fetch(`${url}/api/admin/images/preview/nosuchkey`, { headers: { cookie } });
    assert.equal(preview.status, 404, 'previews only for our own search results');
    assert.equal((await post('/api/admin/images/suggest', { question: {} }, cookie)).status, 503, 'no AI key, no picture finder');
  } finally {
    await srv.close();
  }
});
