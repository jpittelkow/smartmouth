// Drunk Salty audition, draft 2 (owner, 2026-11-27: "slurred spelling is better, add the drinking sounds. add a LOT of
// profanity. She gets a little 'woo girl' and flirty / horny sexual"). Two lines from the start of a game, two from the
// middle, two from the end, from docs/design/drunk-salty-script.md, slurred spelling only (draft 1 settled that).
// This records the voice only. tools/voice/drunk-mix.py then adds the drinking sounds and builds the page.
// Runs inside the container (holds OPENROUTER_API_KEY):
//   ssh root@192.168.1.4 "docker exec -i smartmouth node --input-type=module -" < tools/voice/audition-drunk.mjs
// Writes DATA_DIR/media/voice/audition-drunk-2/voice-<id>.wav and lines.json.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const KEY = process.env.OPENROUTER_API_KEY;
const OUT = join(process.env.DATA_DIR || '/data', 'media', 'voice', 'audition-drunk-2');
mkdirSync(OUT, { recursive: true });
const MODEL = 'google/gemini-3.8-flash-tts';
const VOICE = 'Laomedeia';

// Copied from the script's "Direction for the recorder" section; keep the two in step.
const BASE = 'A woman hosting a living-room game show, with a stand-up comic timing, the same bright comic host as always, but drinking. Not a cartoon. ';
const STAGE = {
  buzzed: 'One drink in, and the loudest woo girl at the party. Too loud, shrieking WOO, laughing at the jokes, swearing like it\'s a compliment, consonants just starting to loosen. The timing is still sharp.',
  tipsy: 'Tipsy and flirty. A soft slur on the s sounds, words running together, a purring, flirty voice that turns snippy without warning, landing a beat late, giggling mid-sentence.',
  hammered: 'Hammered, horny and spoiling for a fight. A heavy slur, the volume lurching around, a low suggestive purr one moment and shouting the next, vowels dragged out, stumbling and restarting words, still trying to host.',
  gone: 'Barely conscious. Mumbling and slow, words smeared together and trailing off, long pauses, a sudden loud outburst and then fading again, a sloppy, sleepy flirt. Only the swear words come out clear.',
};

// text keeps the script's {sound} markers; they're stripped before recording and placed by drunk-mix.py.
const LINES = [
  { id: 'b1', part: 'Beginning', stage: 'buzzed', moment: 'hello',
    text: "WOOO! Hello, you sexy fuckers! I'm Salty, I'm one drink in, and I'm already the best part of this party. TV asks, phone answers. Let's fucking GO! {sip}" },
  { id: 'b2', part: 'Beginning', stage: 'buzzed', moment: 'allRight',
    text: 'Everybody got it! WOO! Look at you smart, sexy bastards. Cheers! {clink}' },
  { id: 'm1', part: 'Middle', stage: 'tipsy', moment: 'intro',
    text: "{hiccup} Whoever'sh winning... call me. Sheriously. I'm shingle, and I'm shit-faced. WOO!" },
  { id: 'm2', part: 'Middle', stage: 'hammered', moment: 'drink',
    text: "{pour} {slurp} Thish bottle'sh my besht friend. It never picksh the wrong answer. And it puts out." },
  { id: 'e1', part: 'End', stage: 'gone', moment: 'drink',
    text: "{slam} I'M AWAKE. ...I'm awake. [whispers] Who wants to make out." },
  { id: 'e2', part: 'End', stage: 'gone', moment: 'final',
    text: "We have a... we have a winner! Sho proud. Shexy fuckin' winner. Everybody elshe... loshers. Go home. Thish is my couch now. Night, fuckers. {bottle-roll}" },
];
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
writeFileSync(join(OUT, 'lines.json'), JSON.stringify(LINES, null, 1));
console.log(`${LINES.length - failed} clips, ${failed} failed`);
