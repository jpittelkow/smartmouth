// Salty's lines (ADR 0013, 0014): the spice rule is enforced by the server, captions are bleeped, and the media
// folder can't be escaped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPICES, spiceAllows } from '@smartmouth/protocol';
import { VoiceBank, caption, type Moment } from '../src/voice.ts';
import { startServer } from '../src/http.ts';

const LINES = fileURLToPath(new URL('../../../content/voice/lines.json', import.meta.url));
const MOMENTS: Moment[] = ['lobby', 'join', 'intro', 'question', 'allRight', 'allWrong', 'mixed', 'turn', 'littleRight', 'littleWrong', 'final'];

test('a line is never picked above the room’s spice level, for every moment and level', () => {
  const bank = new VoiceBank(LINES, tmpdir());
  for (const moment of MOMENTS) {
    for (const spice of SPICES) {
      for (let i = 0; i < 40; i++) {
        const line = bank.pick(moment, spice, new Set());
        assert.ok(line, `${moment} at ${spice} has a line`);
        assert.ok(spiceAllows(spice, line.spice), `${line.id} (${line.spice}) picked for a ${spice} room`);
      }
    }
  }
});

test('Mild lines never swear, and Little moments only have Mild lines', () => {
  const bank = new VoiceBank(LINES, tmpdir());
  const strong = /\b(fuck|shit|bastard|damn|hell|ass)\b/i;
  for (const l of bank.lines.filter((x) => x.spice === 'mild')) assert.ok(!strong.test(l.text), l.id);
  for (const l of bank.lines.filter((x) => ['turn', 'littleRight', 'littleWrong'].includes(x.moment))) assert.equal(l.spice, 'mild', l.id);
  assert.equal(new Set(bank.lines.map((l) => l.id)).size, bank.lines.length, 'line ids are unique');
});

test('the room’s exact level is preferred, and recent lines are avoided', () => {
  const bank = new VoiceBank(LINES, tmpdir());
  for (let i = 0; i < 20; i++) assert.equal(bank.pick('intro', 'filthy', new Set())?.spice, 'filthy');
  const all = bank.lines.filter((l) => l.moment === 'intro' && l.spice === 'hot').map((l) => l.id);
  const recent = new Set(all.slice(1));
  assert.equal(bank.pick('intro', 'hot', recent)?.id, all[0]);
});

test('captions drop delivery tags and bleep strong words as four stars', () => {
  assert.equal(caption('[sighs] Holy shit, people showed up.'), 'Holy ★★★★, people showed up.');
  assert.equal(caption("That's a fucking full house."), "That's a ★★★★ full house.");
  assert.equal(caption('Damn optimism.'), 'Damn optimism.', 'Hot-level words stay');
});

test('/media serves recordings and refuses paths outside the media folder', async () => {
  const media = mkdtempSync(join(tmpdir(), 'sm-media-'));
  mkdirSync(join(media, 'voice'));
  writeFileSync(join(media, 'voice', 'a.mp3'), 'ID3');
  const srv = await startServer({ port: 0, publicUrl: null, allowedOrigins: [], webDir: '.', mediaDir: media });
  const base = `http://127.0.0.1:${(srv.server.address() as { port: number }).port}`;
  try {
    const ok = await fetch(`${base}/media/voice/a.mp3`);
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('content-type'), 'audio/mpeg');
    for (const bad of ['/media/..%2f..%2fetc%2fpasswd', '/media/voice/..%2f..%2fsecret', '/media/%00', '/media/']) {
      const r = await fetch(base + bad);
      assert.ok(r.status === 400 || r.status === 404, `${bad} → ${r.status}`);
    }
  } finally {
    await srv.close();
  }
});
