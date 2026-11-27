// Makes Salty's audition clips through OpenRouter speech (ADR 0013), the way Crayon Box makes its narrator:
// POST https://openrouter.ai/api/v1/audio/speech, one request at a time, MP3 back. Run it where the key is
// (inside the server's container, so the key never leaves the server), then copy the output folder back and open
// its audition.html to pick a voice by ear.
//
//   VOICES=voiceA,voiceB OUT=/tmp/salty node tools/voice/generate.mjs
//   DRY=1 node tools/voice/generate.mjs          # list what would be made; no key needed
//
// Voices must be stock or designed voices: never a clone or an imitation of a real person (ADR 0013, 0014).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const KEY = process.env.OPENROUTER_API_KEY;
const DRY = process.env.DRY === '1';
const MODEL = process.env.AI_VOICE_MODEL || 'elevenlabs/eleven-v4';
const VOICES = (process.env.VOICES ?? '').split(',').map((v) => v.trim()).filter(Boolean);
const OUT = process.env.OUT ?? '/tmp/salty';
const { lines } = JSON.parse(readFileSync(join(here, 'audition-lines.json'), 'utf8'));

if (!VOICES.length) { console.error('Set VOICES=a,b,c (voice names or ids for the model).'); process.exit(1); }
if (!KEY && !DRY) { console.error('OPENROUTER_API_KEY is not set.'); process.exit(1); }

async function speak(body) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch('https://openrouter.ai/api/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    const text = (await r.text()).slice(0, 300);
    if (r.status === 429 || r.status === 402 || r.status >= 500) { await new Promise((s) => setTimeout(s, 4000 * (attempt + 1))); continue; }
    throw new Error(`${r.status} ${text}`);
  }
  throw new Error('gave up after retries');
}

const made = [];
for (const voice of VOICES) {
  const dir = join(OUT, voice.replace(/[^\w.-]/g, '_'));
  if (!DRY) mkdirSync(dir, { recursive: true });
  for (const line of lines) {
    const file = join(dir, `${line.id}.mp3`);
    if (DRY) { console.log(`${voice}  ${line.spice.padEnd(6)}  ${line.id}: ${line.text}`); continue; }
    try {
      writeFileSync(file, await speak({ model: MODEL, voice, input: line.text, response_format: 'mp3' }));
      made.push({ voice, ...line, file: `${voice.replace(/[^\w.-]/g, '_')}/${line.id}.mp3` });
      console.log(`made ${voice}/${line.id}`);
    } catch (e) {
      console.error(`failed ${voice}/${line.id}: ${e.message}`);
    }
  }
}
if (DRY) process.exit(0);

// One page to compare voices line by line.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
let html = `<!doctype html><meta charset="utf-8"><title>Salty auditions</title>
<style>body{font:16px system-ui;background:#14111f;color:#fff6e6;padding:16px;max-width:1100px;margin:auto}
.line{border-top:1px solid #2b2450;padding:12px 0}.text{color:#b9b1d6;margin:4px 0 8px}.takes{display:flex;flex-wrap:wrap;gap:12px}
label{display:grid;gap:4px}audio{height:32px}</style><h1>Salty auditions (${esc(MODEL)})</h1>`;
for (const line of lines) {
  html += `<div class="line"><b>${esc(line.id)}</b> <small>${esc(line.spice)}</small><div class="text">${esc(line.text)}</div><div class="takes">`;
  for (const m of made.filter((x) => x.id === line.id)) html += `<label>${esc(m.voice)}<audio controls preload="none" src="${esc(m.file)}"></audio></label>`;
  html += '</div></div>';
}
html += `<script>document.addEventListener('play',e=>{for(const a of document.querySelectorAll('audio'))if(a!==e.target)a.pause()},true)</script>`;
writeFileSync(join(OUT, 'audition.html'), html);
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ model: MODEL, made }, null, 2));
console.log(`\nOpen ${join(OUT, 'audition.html')} to listen.`);
