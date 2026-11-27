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
const MOMENTS: Moment[] = ['hello', 'lobby', 'join', 'intro', 'question', 'allRight', 'allWrong', 'mixed', 'turn', 'littleRight', 'littleWrong', 'final'];

test('a line is never picked above the room’s spice level, for every moment and level', () => {
  const bank = new VoiceBank(LINES, join(tmpdir(), 'no-manifest.json'));
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
  const bank = new VoiceBank(LINES, join(tmpdir(), 'no-manifest.json'));
  const strong = /\b(fuck|shit|bastard|damn|hell|ass)\b/i;
  for (const l of bank.lines.filter((x) => x.spice === 'mild')) assert.ok(!strong.test(l.text), l.id);
  for (const l of bank.lines.filter((x) => ['turn', 'littleRight', 'littleWrong'].includes(x.moment))) assert.equal(l.spice, 'mild', l.id);
  assert.equal(new Set(bank.lines.map((l) => l.id)).size, bank.lines.length, 'line ids are unique');
});

test('the room’s exact level is preferred, and recent lines are avoided', () => {
  const bank = new VoiceBank(LINES, join(tmpdir(), 'no-manifest.json'));
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
  writeFileSync(join(media, 'voice', 'manifest.json'), '{}');
  const srv = await startServer({ port: 0, publicUrl: null, allowedOrigins: [], webDir: '.', mediaDir: media });
  const base = `http://127.0.0.1:${(srv.server.address() as { port: number }).port}`;
  try {
    const ok = await fetch(`${base}/media/voice/a.mp3`);
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('content-type'), 'audio/mpeg');
    assert.equal((await fetch(`${base}/media/voice/manifest.json`)).status, 404, 'data files are never served');
    for (const bad of ['/media/..%2f..%2fetc%2fpasswd', '/media/voice/..%2f..%2fsecret', '/media/%00', '/media/']) {
      const r = await fetch(base + bad);
      assert.ok(r.status === 400 || r.status === 404, `${bad} → ${r.status}`);
    }
  } finally {
    await srv.close();
  }
});

test('the TV gets Salty’s cues: a lobby line, a hello on join, Mild only once a Little is in', async () => {
  const { WebSocket } = await import('ws');
  const voice = new VoiceBank(LINES, join(tmpdir(), 'no-manifest.json'));
  const srv = await startServer({ port: 0, publicUrl: null, allowedOrigins: [], webDir: '.', voice });
  const port = (srv.server.address() as { port: number }).port;
  const open = (ws: InstanceType<typeof WebSocket>) => new Promise((r) => ws.on('open', r));
  type V = { t: string; code?: string; view?: { role: string; salty: { key: string; caption: string | null } | null } };
  const inbox: V[] = [];
  try {
    const host = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    host.on('message', (d) => inbox.push(JSON.parse(String(d))));
    await open(host);
    host.send(JSON.stringify({ t: 'host:create' }));
    await new Promise((r) => setTimeout(r, 100));
    const code = inbox.find((m) => m.t === 'host:welcome')?.code as string;
    const first = inbox.filter((m) => m.t === 'view').at(-1)?.view?.salty;
    assert.ok(first?.caption, 'a lobby line');
    const lobbyIds = voice.lines.filter((l) => l.moment === 'lobby').map((l) => caption(l.text));
    assert.ok(lobbyIds.includes(first.caption as string));

    const kid = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await open(kid);
    kid.send(JSON.stringify({ t: 'player:join', code, name: 'Blue Blob', band: 'little', avatar: 0 }));
    await new Promise((r) => setTimeout(r, 100));
    const afterJoin = inbox.filter((m) => m.t === 'view').at(-1)?.view?.salty;
    assert.notEqual(afterJoin?.key, first.key, 'a new cue for the join');
    const mildJoins = voice.lines.filter((l) => l.moment === 'join' && l.spice === 'mild').map((l) => caption(l.text));
    assert.ok(mildJoins.includes(afterJoin?.caption as string), 'a Little in the room: Mild only');
    host.close(); kid.close();
  } finally {
    await srv.close();
  }
});

test('each room voice has its own recordings, falls back to the other, and Mild gets the nice reading', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sm-voices-'));
  const base = join(dir, 'manifest.json');
  const bank = new VoiceBank(LINES, base);
  const q = (tag: string) => ({ prompt: `${tag}-q.mp3`, explain: `${tag}-x.mp3` });
  writeFileSync(bank.fileFor('male'), JSON.stringify({ voice: 'm', model: 'm', lines: { a: 'm-a.mp3' }, questions: { 7: { ...q('m'), nice: q('mn') } } }));
  // Only the male voice exists yet: a female room still hears him.
  assert.equal(bank.lineAudio('a', 0, 'female'), '/media/voice/m-a.mp3');
  writeFileSync(bank.fileFor('female'), JSON.stringify({ voice: 'f', model: 'f', lines: { a: 'f-a.mp3' }, questions: { 7: q('f') } }));
  assert.equal(bank.lineAudio('a', 20_000, 'female'), '/media/voice/f-a.mp3');
  assert.equal(bank.lineAudio('a', 20_000, 'male'), '/media/voice/m-a.mp3');
  assert.equal(bank.reads(7, 20_000, 'male', 'mild').prompt, '/media/voice/mn-q.mp3');
  assert.equal(bank.reads(7, 20_000, 'male', 'hot').prompt, '/media/voice/m-q.mp3');
  // No nice reading recorded: Mild falls back to the only one.
  assert.equal(bank.reads(7, 20_000, 'female', 'mild').prompt, '/media/voice/f-q.mp3');
});
