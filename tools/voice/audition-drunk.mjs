// Drunk Salty audition, round 5 (owner, 2026-11-27: "In the slurp i picked, she says 'slurp'"). The six lines from
// round 4 are kept as they are (their noises are spliced in by drunk-mix.py, so nothing in them changes); this round only
// records slurp attempts spelled with no real word, under a direction that says it isn't speech, as the gulp did.
// Earlier rounds' lines and banks are in git history (rounds 1-4, docs/journal/2026-11-27.md).
// Runs inside the container (holds OPENROUTER_API_KEY):
//   ssh root@192.168.1.4 "docker exec -i smartmouth node --input-type=module -" < tools/voice/audition-drunk.mjs
// Writes DATA_DIR/media/voice/audition-drunk-5/: noise-<id>-<take>.wav, lines.json.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const KEY = process.env.OPENROUTER_API_KEY;
const OUT = join(process.env.DATA_DIR || '/data', 'media', 'voice', 'audition-drunk-5');
mkdirSync(OUT, { recursive: true });
const MODEL = 'google/gemini-3.8-flash-tts';
const VOICE = 'Laomedeia';

// Copied from the script's "Direction for the recorder" section; keep the two in step.
const BASE = 'A woman hosting a living-room game show, with a stand-up comic timing, the same bright comic host as always, but drinking. Not a cartoon. ';
const NOISES = ' This is not speech. The letters spell the sound of her slurping the last drops of a drink loudly through a straw, wet and rude, then a small satisfied hum. Make the real slurping noise with her lips; never say a word.';
const STAGE = {
  buzzed: 'One drink in, and the loudest woo girl at the party. Too loud, shrieking WOO, laughing at the jokes, swearing like it\'s a compliment, consonants just starting to loosen. The timing is still sharp.',
  tipsy: 'Tipsy and flirty. A soft slur on the s sounds, words running together, a purring, flirty voice that turns snippy without warning, landing a beat late, giggling mid-sentence.',
  hammered: 'Hammered, horny and spoiling for a fight. A heavy slur, the volume lurching around, a low suggestive purr one moment and shouting the next, vowels dragged out, stumbling and restarting words, still trying to host.',
  gone: 'Barely conscious. Mumbling and slow, words smeared together and trailing off, long pauses, a sudden loud outburst and then fading again, a sloppy, sleepy flirt. Only the swear words come out clear.',
};

// text keeps the script's {sound} markers; they're stripped before recording and placed by drunk-mix.py.
const LINES = []; // round 4's lines are reused
const BANK = [
  { id: 'slurpA', label: 'Slurp: "Shhhllllrrrp."', stage: 'hammered', text: 'Shhhllllrrrp.' },
  { id: 'slurpB', label: 'Slurp: "Ffshhhllp... shllp."', stage: 'hammered', text: 'Ffshhhllp... shllp.' },
  { id: 'slurpC', label: 'Slurp: "Ssssssllllllp... mm."', stage: 'hammered', text: 'Ssssssllllllp... mm.' },
];
const TAKES = 3;
const spoken = (t) => t.replace(/\{[^}]+\}\s*/g, '').replace(/\[[^\]]+\]\s*/g, '').trim();
const cues = (t) => [...t.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);

let failed = 0;
for (const l of LINES) {
  l.file = `voice-${l.id}.wav`;
  l.spoken = spoken(l.text);
  if (existsSync(join(OUT, l.file))) { console.log('kept', l.file); continue; }
  const c = cues(l.text);
  const instructions = BASE + STAGE[l.stage] + (c.length ? ` Delivery cues, in order: ${c.join(', ')}.` : '');
  try {
    const r = await fetch('https://openrouter.ai/api/v1/audio/speech', {
      method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, voice: VOICE, input: l.spoken, instructions, response_format: 'wav' }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 160)}`);
    writeFileSync(join(OUT, l.file), Buffer.from(await r.arrayBuffer()));
    console.log('made', l.file);
  } catch (e) { failed++; l.failed = e.message; console.error('failed', l.file, e.message); }
}
const bank = [];
for (const n of BANK) {
  for (let t = 1; t <= TAKES; t++) {
    const file = `noise-${n.id}-${t}.wav`;
    bank.push({ ...n, take: t, file });
    if (existsSync(join(OUT, file))) continue;
    try {
      const r = await fetch('https://openrouter.ai/api/v1/audio/speech', {
        method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, voice: VOICE, input: n.text, instructions: BASE + STAGE[n.stage] + NOISES, response_format: 'wav' }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 160)}`);
      writeFileSync(join(OUT, file), Buffer.from(await r.arrayBuffer()));
      console.log('made', file);
    } catch (e) { failed++; bank.at(-1).failed = e.message; console.error('failed', file, e.message); }
  }
}
writeFileSync(join(OUT, 'lines.json'), JSON.stringify({ lines: LINES, bank }, null, 1));
console.log(`${LINES.length + bank.length - failed} clips, ${failed} failed`);
