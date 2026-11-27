// One-off: generate the whole drum roll ending in a crash as one sound (owner, 2026-11-27). Piped into the container.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const KEY = process.env.OPENROUTER_API_KEY;
const OUT = join(process.env.DATA_DIR || '/data', 'media', 'sounds', 'trivia', 'bang');
mkdirSync(OUT, { recursive: true });
const PROMPTS = [
  'Sound effect only, no voice, no speech, no music: a fast snare drum roll that starts quiet and builds louder for two seconds, then ends on one loud crash cymbal hit with a bass drum boom that rings out. The suspense before a game show answer.',
  'Sound effect only, no voice: a tense two-second snare drum roll crescendo, then a single big crash cymbal and kick drum hit, ringing for a second.',
  'Sound effect only, no voice: a game show drum roll, rapid snare rolling for about two seconds and getting louder, finished by a sharp cymbal crash.',
  'Sound effect only, no voice: a dramatic timpani and snare roll building for two seconds into a huge orchestral crash cymbal hit.',
];
async function usage() { const r = await fetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${KEY}` } }); const j = r.ok ? await r.json() : null; return j?.data?.usage ?? null; }
const start = await usage();
for (const [i, prompt] of PROMPTS.entries()) {
  try {
    const r = await fetch('https://openrouter.ai/api/v1/audio/speech', {
      method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'bytedance-seed/seed-audio-1-0', input: prompt, response_format: 'mp3' }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!r.ok) { console.log('failed', i + 1, r.status, (await r.text()).slice(0, 200)); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    writeFileSync(join(OUT, `roll-${i + 1}.mp3`), buf);
    console.log('made', i + 1, buf.length, 'bytes');
  } catch (e) { console.log('failed', i + 1, e.message); }
}
const end = await usage();
console.log('spent', start !== null && end !== null ? '$' + (end - start).toFixed(3) : 'unknown');
