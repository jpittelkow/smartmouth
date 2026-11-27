// Makes Salty's recordings through OpenRouter speech (ADR 0013). Run it inside the server's container, where the
// key and the data folder are, so the key never leaves the server:
//
//   docker exec -e VOICES=... smartmouth node tools/voice/voice.mjs audition
//   docker exec -e VOICE=... -e MAX_USD=5 smartmouth node tools/voice/voice.mjs bank
//
// A voice is "<model>:<voice>", e.g. "elevenlabs/eleven-v4:callum", "google/gemini-2.5-pro-tts:Algenib" or
// "fish-audio/s2.1-pro:default" (default = the model's own voice). ElevenLabs takes delivery tags like [sighs] in the
// text and returns mp3. Gemini (wav) and Fish Audio (mp3) take written directions; tags are removed from their text,
// or they'd read them out.
//
// audition: the owner's format (2026-11-26): every voice in VOICES says the line in audition-styles.json in five
//           styles, into DATA_DIR/media/voice/audition/, with a voices x styles page at
//           /media/voice/audition/index.html.
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
/** The character, for auditions; each style adds how to deliver the line. */
const AUDITION_BASE = 'You are Salty, the host of a living-room trivia game show: a washed-up former sea captain with a '
  + 'gravelly, slightly hoarse middle-aged male voice and quick comic timing. Not a cartoon pirate accent.';
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
  const directed = gemini || model.startsWith('fish-audio/');
  return { spec, model, voice, gemini, directed, ext: gemini ? 'wav' : 'mp3', slug: spec.replace(/[^\w.-]+/g, '_') };
}

const stripTags = (t) => t.replace(/\[[^\]]+\]\s*/g, '').trim();

async function usage() {
  if (DRY) return 0;
  const r = await fetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${KEY}` } });
  if (!r.ok) return null;
  const j = await r.json();
  return typeof j?.data?.usage === 'number' ? j.data.usage : null;
}

/** `style` steers directed models (Gemini, Fish Audio); `tag` (e.g. "[sarcastic]") goes in front for ElevenLabs. */
async function speak(v, text, style, tag, script) {
  const body = v.directed
    ? { model: v.model, input: stripTags(text), instructions: style, response_format: v.ext }
    : { model: v.model, voice: v.voice, input: script || (tag ? `${tag} ${text}` : text), response_format: 'mp3' };
  if (v.directed && v.voice !== 'default') body.voice = v.voice;
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

/** ElevenLabs' own descriptions of its stock voices (the ones OpenRouter offers), for the audition page. */
const EL_VOICES = {
  callum: ['male', 'Husky trickster', 'characters'], bill: ['male', 'Wise, mature, balanced', 'narration'],
  brian: ['male', 'Deep, resonant, comforting', 'narration'], george: ['male', 'Warm, captivating storyteller', 'narration'],
  roger: ['male', 'Laid-back, casual, resonant', 'conversational'], charlie: ['male', 'Deep, confident, energetic', 'conversational'],
  chris: ['male', 'Charming, down-to-earth', 'conversational'], harry: ['male', 'Fierce warrior', 'characters'],
  daniel: ['male', 'Steady broadcaster', 'news'], adam: ['male', 'Dominant, firm', 'social media'],
  eric: ['male', 'Smooth, trustworthy', 'conversational'], liam: ['male', 'Energetic social-media creator', 'social media'],
  will: ['male', 'Relaxed optimist', 'conversational'],
  jessica: ['female', 'Playful, bright, warm', 'conversational'], laura: ['female', 'Enthusiast, quirky attitude', 'social media'],
  sarah: ['female', 'Mature, reassuring, confident', 'entertainment'], lily: ['female', 'Velvety actress', 'narration'],
  matilda: ['female', 'Knowledgeable, professional', 'informative'], alice: ['female', 'Clear, engaging educator', 'informative'],
  bella: ['female', 'Professional, bright, warm', 'informative'],
  river: ['neutral', 'Relaxed, neutral, informative', 'conversational'],
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

async function audition() {
  const voices = (process.env.VOICES || '').split(',').map((x) => x.trim()).filter(Boolean).map(parseVoice);
  if (!voices.length) { console.error('Set VOICES=model:voice,model:voice'); process.exit(1); }
  const { line, styles } = JSON.parse(readFileSync(join(here, 'audition-styles.json'), 'utf8'));
  const dir = process.env.AUDITION_DIR || 'audition';
  const out = join(MEDIA, dir);
  const start = await usage();
  const made = {};
  const errors = [];
  for (const v of voices) {
    mkdirSync(join(out, v.slug), { recursive: true });
    for (const st of styles) {
      const file = `${v.slug}/${st.id}.${v.ext}`;
      if (DRY) { console.log(v.spec, st.id); continue; }
      try {
        if (!existsSync(join(out, file))) writeFileSync(join(out, file), await speak(v, line, `${AUDITION_BASE} ${st.instruction}`, st.tag, st.script));
        made[`${v.spec}|${st.id}`] = file;
        console.log(`made ${file}`);
      } catch (e) { errors.push(`${v.spec} ${st.id}: ${e.message}`); console.error(`failed ${v.spec} ${st.id}: ${e.message}`); }
    }
  }
  if (DRY) return;
  const end = await usage();
  const spent = start !== null && end !== null ? '$' + (end - start).toFixed(3) : 'unknown';
  let html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Salty auditions</title><style>
body{font:16px system-ui;background:#14111f;color:#fff6e6;margin:0;padding:16px}
h1{margin:0 0 6px;font-size:28px}p{color:#b9b1d6;max-width:80ch;margin:4px 0 14px}
.wrap{overflow-x:auto}table{border-collapse:collapse;min-width:900px}
th,td{border:1px solid #2b2450;padding:8px;text-align:left;vertical-align:top}
th{background:#1f1a36;font-size:14px}td.v{font-weight:700;white-space:nowrap}td.v small{display:block;color:#b9b1d6;font-weight:400}
audio{width:170px;height:34px}th.g{background:#2b2450;font-size:13px;text-transform:uppercase;letter-spacing:.08em}.err{color:#ff4f7b;font-size:12px}</style>
<h1>Salty auditions</h1>
<p>One line in five styles, every voice: &ldquo;${esc(line)}&rdquo;</p>
<p>Gemini and Fish Audio act from a written description of Salty plus the style. ElevenLabs acts from delivery tags
placed through the line (hover a style heading to see its script). ElevenLabs' stock voices retire on 2026-12-31; files already made keep working.
Made ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. Cost ${spent}.</p>
<div class="wrap"><table><tr><th>Voice</th>${styles.map((x) => `<th title="${esc(x.script || x.tag)}">${esc(x.label)}</th>`).join('')}</tr>`;
  const order = { male: 0, female: 1, neutral: 2 };
  const info = (v) => (v.model.startsWith('elevenlabs/') && EL_VOICES[v.voice]) || null;
  const sorted = [...voices].sort((a, b) => (order[info(a)?.[0]] ?? 3) - (order[info(b)?.[0]] ?? 3));
  let group = null;
  for (const v of sorted) {
    const i = info(v);
    if (i && i[0] !== group) { group = i[0]; html += `<tr><th colspan="${styles.length + 1}" class="g">${esc(group[0].toUpperCase() + group.slice(1))} voices</th></tr>`; }
    const sub = i ? `${i[1]} &middot; ${i[2]}` : esc(v.model);
    html += `<tr><td class="v">${esc(v.voice === 'default' ? 'default voice' : v.voice)}<small>${sub}</small></td>`;
    for (const st of styles) {
      const f = made[`${v.spec}|${st.id}`];
      html += f ? `<td><audio controls preload="none" src="${esc(f)}"></audio></td>` : '<td class="err">failed</td>';
    }
    html += '</tr>';
  }
  html += `</table></div>${errors.length ? `<p class="err">${errors.map(esc).join('<br>')}</p>` : ''}
<script>document.addEventListener('play',e=>{for(const a of document.querySelectorAll('audio'))if(a!==e.target)a.pause()},true)</script>`;
  writeFileSync(join(out, 'index.html'), html);
  console.log(`\naudition page: /media/voice/${dir}/index.html · ${Object.keys(made).length} clips · ${errors.length} failed · spent ${spent}`);
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
  // Little moments get the warm kids' direction. For directed models, tags like [whispers] become part of the
  // direction (they're stripped from the text so they aren't read out).
  const KID_MOMENTS = new Set(['turn', 'littleRight', 'littleWrong']);
  for (const l of lines) {
    const base = KID_MOMENTS.has(l.moment) ? KIDS_STYLE : STYLE;
    const tags = [...l.text.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
    const style = v.directed && tags.length ? `${base} Delivery cues for this line: ${tags.join(', ')}.` : base;
    jobs.push({ text: l.text, style, put: (f) => { manifest.lines[l.id] = f; } });
  }
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
