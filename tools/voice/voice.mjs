// Makes Salty's recordings through OpenRouter speech (ADR 0013). Run it inside the server's container, where the
// key and the data folder are, so the key never leaves the server:
//
//   docker exec -e VOICES=... smartmouth node tools/voice/voice.mjs audition
//   docker exec -e VOICE=... -e MAX_USD=5 smartmouth node tools/voice/voice.mjs bank
//
// A voice is "<model>:<voice>", e.g. "elevenlabs/eleven-v4:callum" or "google/gemini-3.8-flash-tts:Fenrir".
// ElevenLabs takes delivery tags like [sighs] in the text and returns mp3. Gemini takes the written direction below
// (tags are removed from its text, or it would read them out) and returns wav.
//
// audition: every voice in VOICES reads audition-lines.json into DATA_DIR/media/voice/audition/, with an index.html
//           to compare them (served at /media/voice/audition/index.html).
// bank:     VOICE reads every line in content/voice/lines.json, and every live question's prompt, its answers
//           (picture questions) and its follow-up line, into DATA_DIR/media/voice/<voice>/, then writes
//           DATA_DIR/voice/manifest.json (outside the served folder), which the server picks up within seconds. Existing files are kept,
//           so a re-run only makes what's new. MAX_USD stops it when the key's usage has grown by that much.
//
// Voices must be stock or designed voices: never a clone or an imitation of a real person (ADR 0013, 0014).
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const KEY = process.env.OPENROUTER_API_KEY;
const DATA = process.env.DATA_DIR || '/data';
const MEDIA = join(DATA, 'media', 'voice');
// Not served: the manifest maps questions to recordings, and the salt keeps file names unguessable from the text.
const PRIVATE = join(DATA, 'voice');
const MAX_USD = Number(process.env.MAX_USD || 5);
const DRY = process.env.DRY === '1';
const mode = process.argv[2];

/** Salty, for models that take written directions. An original character; no real person is named or imitated. */
export const STYLE = 'You are Salty, a washed-up former sea captain who now hosts a living-room trivia game show and is '
  + 'furious about it. Speak in a gravelly, slightly hoarse middle-aged male voice with swagger and theatrical '
  + 'flourish: a lazy drawl that suddenly speeds up into an exasperated rant, mock outrage at tiny things, quick '
  + 'comic timing, and a cowardly wobble when he backs down. Sarcastic but warm underneath. Not a cartoon pirate '
  + 'accent. Keep it snappy, like a stand-up comic hosting.';
const KIDS_STYLE = 'You are Salty, a grumpy but loving game-show host talking to a three-year-old. Gravelly male '
  + 'voice, but warm, slow, clear and delighted. Big friendly energy, no sarcasm.';

if (!['audition', 'bank'].includes(mode)) { console.error('usage: voice.mjs audition|bank'); process.exit(1); }
if (!KEY && !DRY) { console.error('OPENROUTER_API_KEY is not set.'); process.exit(1); }

function parseVoice(spec) {
  const i = spec.lastIndexOf(':');
  if (i < 1) throw new Error(`voice "${spec}" should be model:voice`);
  const model = spec.slice(0, i);
  const voice = spec.slice(i + 1);
  const gemini = model.startsWith('google/');
  return { spec, model, voice, gemini, ext: gemini ? 'wav' : 'mp3', slug: spec.replace(/[^\w.-]+/g, '_') };
}

const stripTags = (t) => t.replace(/\[[^\]]+\]\s*/g, '').trim();

async function usage() {
  if (DRY) return 0;
  const r = await fetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${KEY}` } });
  if (!r.ok) return null;
  const j = await r.json();
  return typeof j?.data?.usage === 'number' ? j.data.usage : null;
}

async function speak(v, text, style) {
  const body = v.gemini
    ? { model: v.model, voice: v.voice, input: stripTags(text), instructions: style, response_format: 'wav' }
    : { model: v.model, voice: v.voice, input: text, response_format: 'mp3' };
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch('https://openrouter.ai/api/v1/audio/speech', {
      method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(120_000),
    });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    const msg = (await r.text()).slice(0, 300);
    if (r.status === 429 || r.status === 402 || r.status >= 500) { await new Promise((s) => setTimeout(s, 4000 * (attempt + 1))); continue; }
    throw new Error(`${r.status} ${msg}`);
  }
  throw new Error('gave up after retries');
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

async function audition() {
  const voices = (process.env.VOICES || '').split(',').map((s) => s.trim()).filter(Boolean).map(parseVoice);
  if (!voices.length) { console.error('Set VOICES=model:voice,model:voice'); process.exit(1); }
  const { lines } = JSON.parse(readFileSync(join(here, 'audition-lines.json'), 'utf8'));
  const out = join(MEDIA, 'audition');
  const start = await usage();
  const made = [];
  for (const v of voices) {
    mkdirSync(join(out, v.slug), { recursive: true });
    for (const line of lines) {
      const file = `${v.slug}/${line.id}.${v.ext}`;
      if (DRY) { console.log(v.spec, line.id); continue; }
      try {
        if (!existsSync(join(out, file))) writeFileSync(join(out, file), await speak(v, line.text, STYLE));
        made.push({ voice: v.spec, id: line.id, file });
        console.log(`made ${file}`);
      } catch (e) { console.error(`failed ${v.spec} ${line.id}: ${e.message}`); }
    }
  }
  if (DRY) return;
  let html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Salty auditions</title><style>body{font:16px system-ui;background:#14111f;color:#fff6e6;padding:16px;max-width:1200px;margin:auto}
h1{margin:0 0 4px}p{color:#b9b1d6}.line{border-top:1px solid #2b2450;padding:12px 0}.text{color:#b9b1d6;margin:4px 0 8px}
.takes{display:flex;flex-wrap:wrap;gap:14px}label{display:grid;gap:4px;font-size:14px}audio{height:34px;max-width:260px}
.spice{font-size:12px;padding:1px 8px;border-radius:99px;background:#2b2450;margin-left:6px}</style>
<h1>Salty auditions</h1><p>Every voice reads the same lines. ElevenLabs voices act from tags in the text; Gemini voices
act from a written description of Salty. ElevenLabs' stock voices retire on 2026-12-31 (files already made keep working).</p>`;
  for (const line of lines) {
    html += `<div class="line"><b>${esc(line.id)}</b><span class="spice">${esc(line.spice)}</span><div class="text">${esc(line.text)}</div><div class="takes">`;
    for (const m of made.filter((x) => x.id === line.id)) html += `<label>${esc(m.voice)}<audio controls preload="none" src="${esc(m.file)}"></audio></label>`;
    html += '</div></div>';
  }
  html += `<script>document.addEventListener('play',e=>{for(const a of document.querySelectorAll('audio'))if(a!==e.target)a.pause()},true)</script>`;
  writeFileSync(join(out, 'index.html'), html);
  const end = await usage();
  console.log(`\naudition page: /media/voice/audition/index.html · ${made.length} clips · spent ${start !== null && end !== null ? '$' + (end - start).toFixed(3) : 'unknown'}`);
}

async function bank() {
  const v = parseVoice(process.env.VOICE || '');
  const { lines } = JSON.parse(readFileSync(join(repo, 'content', 'voice', 'lines.json'), 'utf8'));
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(join(DATA, 'smartmouth.db'), { readOnly: true });
  const questions = db.prepare("SELECT id, prompt, kind, answers, explain, age_min FROM questions WHERE status = 'live'").all();
  const dir = join(MEDIA, v.slug);
  mkdirSync(dir, { recursive: true });
  mkdirSync(PRIVATE, { recursive: true });
  const saltFile = join(PRIVATE, 'salt');
  if (!existsSync(saltFile)) writeFileSync(saltFile, randomBytes(16).toString('hex'), { mode: 0o600 });
  const salt = readFileSync(saltFile, 'utf8').trim();
  const manifestFile = join(PRIVATE, 'manifest.json');
  const manifest = { voice: v.spec, model: v.model, made: new Date().toISOString(), lines: {}, questions: {} };

  const jobs = [];
  for (const l of lines) jobs.push({ text: l.text, style: STYLE, put: (f) => { manifest.lines[l.id] = f; } });
  for (const q of questions) {
    const little = Number(q.age_min) === 0;
    const style = little ? KIDS_STYLE : STYLE;
    const entry = (manifest.questions[String(q.id)] ??= {});
    jobs.push({ text: q.prompt, style, put: (f) => { entry.prompt = f; } });
    if (q.kind === 'picture') {
      const answers = JSON.parse(q.answers);
      entry.answers = answers.map(() => null);
      answers.forEach((a, i) => jobs.push({ text: `${a.text}!`, style, put: (f) => { entry.answers[i] = f; } }));
    }
    if (q.explain) jobs.push({ text: q.explain, style, put: (f) => { entry.explain = f; } });
  }
  const chars = jobs.reduce((n, j) => n + j.text.length, 0);
  console.log(`${jobs.length} clips, ${chars} characters, voice ${v.spec}, cap $${MAX_USD}`);
  if (DRY) return;

  const start = await usage();
  let made = 0, kept = 0, failed = 0;
  for (const [i, job] of jobs.entries()) {
    const name = createHash('sha256').update(`${salt}|${v.spec}|${job.style}|${job.text}`).digest('hex').slice(0, 24) + '.' + v.ext;
    const file = join(dir, name);
    if (existsSync(file)) { kept++; job.put(`${v.slug}/${name}`); continue; }
    if (made % 20 === 0 && start !== null) {
      const now = await usage();
      if (now !== null && now - start > MAX_USD) { console.error(`stopping: spent $${(now - start).toFixed(2)} (cap $${MAX_USD})`); break; }
    }
    try {
      writeFileSync(file, await speak(v, job.text, job.style));
      job.put(`${v.slug}/${name}`);
      made++;
      if (made % 25 === 0) console.log(`${i + 1}/${jobs.length}`);
    } catch (e) { failed++; console.error(`failed: ${job.text.slice(0, 40)}: ${e.message}`); }
  }
  // Write the manifest atomically: the server reads it while games run.
  writeFileSync(manifestFile + '.tmp', JSON.stringify(manifest, null, 1));
  renameSync(manifestFile + '.tmp', manifestFile);
  const end = await usage();
  console.log(`made ${made}, kept ${kept}, failed ${failed}; spent ${start !== null && end !== null ? '$' + (end - start).toFixed(3) : 'unknown'}`);
}

await (mode === 'audition' ? audition() : bank());
