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
