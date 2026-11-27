// Snake Manor's sound and music audition (ADR 0024, design guide §8.5). Makes two takes of each music bed and sound
// effect with Google Lyria 3 through OpenRouter, into DATA_DIR/media/sounds/audition/, with a page that plays each
// take beside the game's current synthesized version so a grown-up can pick by ear.
//
// Runs inside the server's container, which holds OPENROUTER_API_KEY and the data folder (the key never leaves the
// server). Without a deploy, pipe it in:
//   ssh root@192.168.1.4 "docker exec -i -e MAX_USD=1.5 smartmouth node --input-type=module -" < tools/sounds/sounds.mjs
// After a deploy: docker exec -e MAX_USD=1.5 smartmouth node tools/sounds/sounds.mjs
//
// Lyria 3 clips are 30 s, instrumental, mp3, $0.04 each (2026-11-27). Takes that already exist are kept, so a re-run
// only makes what's missing. One request at a time (the shared key's in-flight budget, docs/memory/gotchas.md).
// Prompts describe sounds and moods only: no artist, composer or existing work is named or imitated.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KEY = process.env.OPENROUTER_API_KEY;
const DATA = process.env.DATA_DIR || '/data';
const OUT = join(DATA, 'media', 'sounds', 'audition');
const MAX_USD = Number(process.env.MAX_USD || 1.5);
const TAKES = Number(process.env.TAKES || 2);
const MODEL = 'google/lyria-3-clip-preview';
/**
 * Added to each clip's link. Cloudflare keeps /media files for a year, headers included, so a page written after a
 * header change must ask for fresh copies (found 2026-11-27: a cached copy with the old CORP header wouldn't play).
 */
const STAMP = Date.now().toString(36);

/** Each cue: where it plays in the game, the synthesized sound it would replace, and the prompt. */
const MUSIC = [
  { id: 'theme', where: 'Title and the deal', synth: 'flourish', prompt: 'Theatrical, mischievous medieval chamber piece: harpsichord, lute and pizzicato strings play a sly, sneaky melody, answered by a pompous little brass flourish. A grand but cowardly host welcoming guests to a crumbling country manor. Playful with a sinister edge. Instrumental.' },
  { id: 'mission', where: 'Under a mission', synth: null, prompt: 'Light, bustling medieval puzzle music: recorder, lute and tambourine, quick and curious, a little nervous underneath, steady tempo, loops cleanly. Instrumental.' },
  { id: 'table', where: 'The Round Table debate', synth: 'drone', prompt: 'Tense underscore for an argument around a table in candlelight: low cello ostinato, soft frame drum pulse, sustained dissonant strings slowly building suspicion. Restrained, never loud. Instrumental.' },
  { id: 'night', where: 'Night falls', synth: 'drone', prompt: 'Night in a dark stone manor: a low organ drone and bowed cello, distant wind, a slow soft timpani like a heartbeat, very sparse and eerie but not horror, suitable with children in the room. Instrumental.' },
  { id: 'breakfast', where: 'Breakfast', synth: 'birds', prompt: 'An uneasy morning in an old manor: gentle solo lute and soft harp over light birdsong, a wistful melody with one nervous wrong-feeling note. Instrumental.' },
  { id: 'reveal', where: 'Under the banishment build', synth: 'heartbeat', prompt: 'A dramatic build for a big reveal: low strings and wordless choir swell in one long crescendo over a pounding timpani, rising tension, then a sudden stop into silence. Instrumental.' },
  { id: 'guests-win', where: 'The Guests win', synth: 'finale', prompt: 'Triumphant medieval celebration: bright brass fanfare, full wordless choir and pealing bells, joyful, grand and a little silly. Instrumental.' },
  { id: 'snakes-win', where: 'The Snakes win', synth: 'finale', prompt: 'A sinister victory: minor-key wordless choir and low brass in a slow, menacing, swaggering march, with a sly harpsichord line on top. Instrumental.' },
];
const SFX = [
  { id: 'bell', where: 'A banishment lands; three tolls at nightfall', synth: 'bell', prompt: 'Sound effect only, no music, no melody: a single great iron church bell tolls once in a cold stone hall, with a long natural decay.' },
  { id: 'heartbeat', where: 'The held silence before a reveal', synth: 'heartbeat', prompt: 'Sound effect only, no music: a deep, close human heartbeat, slow at first and steadily speeding up, nothing else.' },
  { id: 'hiss', where: 'A Snake is revealed', synth: 'hiss', prompt: 'Sound effect only, no music: one long, close, menacing snake hiss that swells and fades.' },
  { id: 'seal', where: 'Each vote seal breaks', synth: 'thud', prompt: 'Foley sound effect only, no music: a heavy wax seal pressed onto thick parchment with a dull thud, then a quill pen scratching quickly.' },
  { id: 'wind', where: 'The night ambience', synth: 'drone', prompt: 'Ambience only, no music: wind moaning around an old stone manor at night, a shutter knocking softly, distant creaking timbers.' },
  { id: 'candles', where: 'A Guest is revealed: the candles go out', synth: 'snuff', prompt: 'Sound effect only, no music: candles being snuffed out one after another in a quiet room, soft puffs, then silence.' },
];

if (!KEY) { console.error('OPENROUTER_API_KEY is not set.'); process.exit(1); }

async function usage() {
  const r = await fetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${KEY}` } });
  if (!r.ok) return null;
  const j = await r.json();
  return typeof j?.data?.usage === 'number' ? j.data.usage : null;
}

/** One Lyria clip. Audio comes back only when asked for and streamed: base64 mp3 in choices[0].delta.audio.data. */
async function lyria(prompt, seed) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, modalities: ['text', 'audio'], stream: true, seed, messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(240_000),
    });
    if (!r.ok) {
      const msg = (await r.text()).slice(0, 300);
      if (r.status === 429 || r.status === 402 || r.status >= 500) { await new Promise((s) => setTimeout(s, 5000 * (attempt + 1))); continue; }
      throw new Error(`${r.status} ${msg}`);
    }
    const chunks = [];
    for (const line of (await r.text()).split('\n')) {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
      try { const d = JSON.parse(line.slice(6)).choices?.[0]?.delta; if (d?.audio?.data) chunks.push(Buffer.from(d.audio.data, 'base64')); } catch { /* keep-alive */ }
    }
    if (chunks.length) return Buffer.concat(chunks);
    throw new Error('no audio in the response');
  }
  throw new Error('gave up after retries');
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

async function main() {
  mkdirSync(OUT, { recursive: true });
  const start = await usage();
  const errors = [];
  let stopped = false;
  for (const cue of [...MUSIC, ...SFX]) {
    for (let t = 1; t <= TAKES; t++) {
      const file = `${cue.id}-${t}.mp3`;
      if (existsSync(join(OUT, file))) continue;
      const now = await usage();
      if (start !== null && now !== null && now - start >= MAX_USD) { stopped = true; break; }
      try {
        writeFileSync(join(OUT, file), await lyria(cue.prompt, 1000 + t * 17));
        console.log(`made ${file}`);
      } catch (e) { errors.push(`${file}: ${e.message}`); console.error(`failed ${file}: ${e.message}`); }
    }
    if (stopped) break;
  }
  const end = await usage();
  const spent = start !== null && end !== null ? `$${(end - start).toFixed(2)}` : 'unknown';
  writeFileSync(join(OUT, 'index.html'), page(spent, errors, stopped));
  console.log(`\naudition page: /media/sounds/audition/index.html · spent ${spent}${stopped ? ` · stopped at MAX_USD=${MAX_USD}` : ''} · ${errors.length} failed`);
}

function rows(list, kind) {
  return list.map((c) => {
    const takes = Array.from({ length: TAKES }, (_, i) => i + 1).map((t) => {
      const f = `${c.id}-${t}.mp3`;
      return existsSync(join(OUT, f))
        ? `<td><audio controls preload="none" src="${f}?v=${STAMP}"></audio><label><input type="radio" name="${c.id}" value="take ${t}"> Take ${t}</label></td>`
        : '<td class="none">not made</td>';
    }).join('');
    const synth = c.synth
      ? `<td><button type="button" class="play" data-synth="${c.synth}">Play</button><label><input type="radio" name="${c.id}" value="current"> Keep</label></td>`
      : '<td class="none">nothing yet</td>';
    return `<tr><th scope="row">${esc(c.id)}<small>${esc(c.where)}</small><details><summary>prompt</summary>${esc(c.prompt)}</details></th>${synth}${takes}
<td><label><input type="radio" name="${c.id}" value="library"> From a library</label><label><input type="radio" name="${c.id}" value="neither"> None</label></td></tr>`;
  }).join('\n');
}

function page(spent, errors, stopped) {
  const takeHeads = Array.from({ length: TAKES }, (_, i) => `<th>Lyria take ${i + 1}</th>`).join('');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Snake Manor Sounds</title>
<style>
:root{--stone:#14110e;--stone2:#1f1a15;--stone3:#2c251e;--vellum:#e8dbbd;--gold:#c9a24a;--gules:#a3302a;--pale:#cfc5b0;--muted:#9a8d77;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--stone);color:var(--pale);font:17px/1.5 Georgia,'Times New Roman',serif;padding:24px max(16px,env(safe-area-inset-left)) 60px}
h1{font-size:40px;margin:0;color:var(--vellum);font-weight:400}h2{font:600 15px Georgia,serif;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin:34px 0 10px;border-top:1px solid #5a4a2a;padding-top:14px}
p{max-width:78ch;margin:6px 0}.muted{color:var(--muted)}a{color:var(--gold)}
.wrap{overflow-x:auto}table{border-collapse:collapse;min-width:900px;width:100%}
th,td{border:1px solid var(--stone3);padding:10px;text-align:left;vertical-align:top}thead th{background:var(--stone2);font-size:14px;letter-spacing:.06em;color:var(--muted)}
tbody th{width:240px;color:var(--vellum);font-weight:600}tbody th small{display:block;color:var(--muted);font-weight:400;font-size:14px}
details{font-weight:400;font-size:13px;color:var(--muted);margin-top:6px}summary{cursor:pointer}
audio{width:200px;height:34px;display:block;margin-bottom:6px}label{display:block;font-size:15px;cursor:pointer}
.play{background:var(--stone3);color:var(--vellum);border:1px solid #5a4a2a;border-radius:4px;padding:6px 14px;font:inherit;cursor:pointer;margin-bottom:6px}
.play:focus-visible,button:focus-visible{outline:2px solid var(--gold);outline-offset:2px}.none{color:var(--muted);font-style:italic}
.bar{position:sticky;bottom:0;background:var(--stone2);border-top:1px solid #5a4a2a;padding:12px;margin-top:24px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.bar button{background:var(--gules);color:var(--vellum);border:0;border-radius:4px;padding:10px 16px;font:600 15px Georgia,serif;cursor:pointer}
textarea{width:100%;min-height:90px;background:var(--stone);color:var(--pale);border:1px solid var(--stone3);font:13px ui-monospace,monospace;margin-top:8px}
.err{color:#e0604f}
</style>
<h1>Snake Manor sounds</h1>
<p>Pick by ear for each cue: keep the game's current sound (synthesized on the TV), one of the Lyria takes, or mark it to find in a sound library. Picks are remembered in this browser. When you're done, copy your picks and paste them to Claude.</p>
<p class="muted">Lyria 3 clips are 30 seconds and instrumental; when a pick is wired in, an effect is cut to its best few seconds and a music bed is looped or faded. Made ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC with ${MODEL}. Cost ${spent}.${stopped ? ' Stopped early at the spending limit.' : ''}</p>
<p class="muted">Libraries for anything that doesn't work here: <a href="https://sonniss.com/gameaudiogdc" target="_blank" rel="noopener">Sonniss GDC bundle</a> (royalty-free, no credit), <a href="https://freesound.org/search/?f=license:%22Creative+Commons+0%22" target="_blank" rel="noopener">Freesound, CC0 only</a>, <a href="https://pixabay.com/sound-effects/" target="_blank" rel="noopener">Pixabay sound effects</a>.</p>
<h2>Music</h2>
<div class="wrap"><table><thead><tr><th>Cue</th><th>Now (synthesized)</th>${takeHeads}<th>Or</th></tr></thead><tbody>
${rows(MUSIC, 'music')}
</tbody></table></div>
<h2>Sound effects</h2>
<div class="wrap"><table><thead><tr><th>Cue</th><th>Now (synthesized)</th>${takeHeads}<th>Or</th></tr></thead><tbody>
${rows(SFX, 'sfx')}
</tbody></table></div>
${errors.length ? `<p class="err">${errors.map(esc).join('<br>')}</p>` : ''}
<div class="bar"><button type="button" id="copy">Copy my picks</button><span id="count" class="muted"></span></div>
<textarea id="out" readonly hidden></textarea>
<script>
// Only one clip plays at a time.
document.addEventListener('play', (e) => { for (const a of document.querySelectorAll('audio')) if (a !== e.target) a.pause(); }, true);
// Picks, remembered in this browser.
const KEY = 'snake-manor-sound-picks';
let picks = {};
try { picks = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}
for (const [cue, v] of Object.entries(picks)) { const r = document.querySelector('input[name="' + cue + '"][value="' + v + '"]'); if (r) r.checked = true; }
const count = () => { document.getElementById('count').textContent = Object.keys(picks).length + ' of ${MUSIC.length + SFX.length} picked'; };
count();
document.addEventListener('change', (e) => {
  if (e.target.type !== 'radio') return;
  picks[e.target.name] = e.target.value;
  try { localStorage.setItem(KEY, JSON.stringify(picks)); } catch {}
  count();
});
document.getElementById('copy').addEventListener('click', async () => {
  const text = 'Snake Manor sound picks: ' + JSON.stringify(picks);
  const out = document.getElementById('out');
  out.hidden = false; out.value = text;
  try { await navigator.clipboard.writeText(text); document.getElementById('count').textContent = 'Copied.'; } catch { out.select(); }
});
// The game's current sounds, synthesized the same way the TV does (apps/web/src/games/snakes/sound.ts).
let ctx;
const A = () => { ctx ??= new AudioContext(); if (ctx.state === 'suspended') ctx.resume(); return ctx; };
const env = (g, t, peak, a, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
function tone(f, type, vol, a, d, delay = 0) { const c = A(), t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f; env(g, t, vol, a, d); o.connect(g).connect(c.destination); o.start(t); o.stop(t + a + d + .05); }
function burst(sec, type, f, vol, delay = 0) { const c = A(), t = c.currentTime + delay, b = c.createBuffer(1, Math.ceil(c.sampleRate * sec), c.sampleRate), dd = b.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1; const n = c.createBufferSource(); n.buffer = b; const fl = c.createBiquadFilter(), g = c.createGain(); fl.type = type; fl.frequency.value = f; env(g, t, vol, Math.min(.3, sec / 4), sec * .7); n.connect(fl).connect(g).connect(c.destination); n.start(t); n.stop(t + sec); }
function beat(delay) { const c = A(); for (const [off, vol] of [[0, .9], [.16, .55]]) { const t = c.currentTime + delay + off, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(42, t + .14); env(g, t, vol, .008, .22); o.connect(g).connect(c.destination); o.start(t); o.stop(t + .3); } }
const SYNTH = {
  bell: () => { for (const [m, v, d] of [[1, .5, 7], [2, .25, 5], [2.4, .22, 4.5], [3, .14, 3.5], [4.2, .1, 2.5], [5.4, .06, 1.8]]) tone(146.8 * m, 'sine', v, .01, d); burst(.08, 'highpass', 2000, .3); },
  heartbeat: () => { let t = 0; for (let i = 0; i < 8; i++) { beat(t); t += 60 / (62 + i * 10); } },
  hiss: () => burst(2.2, 'highpass', 4200, .3),
  thud: () => { for (let i = 0; i < 6; i++) burst(.12, 'bandpass', 3800, .16, i * .15); tone(70, 'sine', .7, .005, .25, 1); burst(.08, 'lowpass', 600, .25, 1); },
  snuff: () => { for (let i = 0; i < 7; i++) burst(.15, 'lowpass', 900, .12, .2 + i * .25); },
  birds: () => { for (let i = 0; i < 8; i++) tone(2400 + Math.random() * 1400, 'sine', .05, .01, .12, i * .21); },
  flourish: () => [523.3, 659.3, 784, 1046.5].forEach((hz, i) => tone(hz, 'triangle', .15, .005, .5, i * .09)),
  finale: () => [196, 246.9, 293.7, 392].forEach((hz) => { tone(hz, 'sawtooth', .05, .6, 2.6); tone(hz * 2, 'sine', .05, .6, 2.6); }),
  drone: () => { const c = A(), g = c.createGain(), f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 340; g.gain.value = .0001; f.connect(g).connect(c.destination); const t = c.currentTime; g.gain.exponentialRampToValueAtTime(.2, t + 1.2); g.gain.setValueAtTime(.2, t + 4); g.gain.exponentialRampToValueAtTime(.0001, t + 5); [55, 82.4, 110.3].forEach((hz, i) => { const o = c.createOscillator(); o.type = i === 1 ? 'sawtooth' : 'triangle'; o.frequency.value = hz; o.connect(f); o.start(t); o.stop(t + 5.1); }); },
};
for (const b of document.querySelectorAll('.play')) b.addEventListener('click', () => { for (const a of document.querySelectorAll('audio')) a.pause(); SYNTH[b.dataset.synth]?.(); });
</script></html>`;
}

await main();
