// Trivia's music beds for the sound audition (design guide 4.1: Lyria for music only). Two takes each, into
// DATA_DIR/media/sounds/trivia/music/. Piped into the container, which holds the key. One request at a time.
// Prompts describe sounds and moods only: no artist, composer or existing work.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KEY = process.env.OPENROUTER_API_KEY;
const OUT = join(process.env.DATA_DIR || '/data', 'media', 'sounds', 'trivia', 'music');
const MAX_USD = Number(process.env.MAX_USD || 0.6);
const MUSIC = [
  { id: 'lobby', prompt: 'Upbeat, bouncy living-room game show waiting music: funky bass, hand claps, bright electric piano and playful brass stabs, cheeky and fun, medium tempo, loops cleanly. Instrumental.' },
  { id: 'think', prompt: 'Light, playful thinking music for a quiz countdown: a soft ticking pulse, plucked strings and marimba, gentle comic tension, steady tempo, never loud, loops cleanly. Instrumental.' },
  { id: 'leaderboard', prompt: 'Starts immediately with a punchy four-second game show sting: a snare fill into a bright brass hit, then a cheerful funky groove for a scoreboard. Instrumental.' },
  { id: 'winner', prompt: 'Triumphant, silly game show winner celebration: big brass fanfare, drum roll and cymbal crash, then a joyful bouncy victory groove with hand claps. Instrumental.' },
];

async function usage() {
  const r = await fetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${KEY}` } });
  const j = r.ok ? await r.json() : null;
  return typeof j?.data?.usage === 'number' ? j.data.usage : null;
}
async function lyria(prompt, seed) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'google/lyria-3-clip-preview', modalities: ['text', 'audio'], stream: true, seed, messages: [{ role: 'user', content: prompt }] }),
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

mkdirSync(OUT, { recursive: true });
const start = await usage();
for (const m of MUSIC) {
  for (let t = 1; t <= 2; t++) {
    const file = join(OUT, `${m.id}-${t}.mp3`);
    if (existsSync(file)) { console.log('kept', m.id, t); continue; }
    const now = await usage();
    if (start !== null && now !== null && now - start > MAX_USD) { console.error('stopping at the cap'); process.exit(0); }
    try { writeFileSync(file, await lyria(m.prompt, 1000 + t)); console.log('made', m.id, t); }
    catch (e) { console.error('failed', m.id, t, e.message); }
  }
}
const end = await usage();
console.log('spent', start !== null && end !== null ? '$' + (end - start).toFixed(3) : 'unknown');
