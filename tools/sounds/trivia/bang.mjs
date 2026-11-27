// One-off: try generating the drum roll's ending bang with a prompted audio model (OpenRouter has no dedicated
// effects model). Piped into the container, which holds the key. Writes DATA_DIR/media/sounds/trivia/bang/.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const KEY = process.env.OPENROUTER_API_KEY;
const OUT = join(process.env.DATA_DIR || '/data', 'media', 'sounds', 'trivia', 'bang');
mkdirSync(OUT, { recursive: true });
const PROMPTS = [
  'Sound effect only, no voice, no speech, no music: a single loud crash cymbal hit together with a deep bass drum boom, the big hit at the end of a game show drum roll, ringing out for two seconds.',
  'Sound effect only, no voice: one huge orchestral hit, timpani boom and crash cymbal at the same instant, then a short shimmering decay.',
  'Sound effect only, no voice: a punchy drum kit ending, a snare rimshot and crash cymbal hit together, bright and celebratory, with a quick decay.',
  'Sound effect only, no voice: a dramatic gong-like cymbal crash with a low boom underneath, like a big reveal on a TV quiz show.',
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
    writeFileSync(join(OUT, `gen-${i + 1}.mp3`), buf);
    console.log('made', i + 1, buf.length, 'bytes');
  } catch (e) { console.log('failed', i + 1, e.message); }
}
const end = await usage();
console.log('spent', start !== null && end !== null ? '$' + (end - start).toFixed(3) : 'unknown');
