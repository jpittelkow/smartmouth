// Drunk Salty audition, draft 4 (owner, 2026-11-27: "some of the slurps say 'slurp' instead of having a slurp").
// Noises are no longer spelled inside the lines: each one is its own clip in her voice, picked by ear (audition 3 picks
// in docs/design/drunk-salty-script.md), and drunk-mix.py splices them in at the {markers}. This records the six lines
// clean, plus new attempts at the gulp (audition 3's gulps and chug were all rejected), spelled so there's no word to read.
// Runs inside the container (holds OPENROUTER_API_KEY):
//   ssh root@192.168.1.4 "docker exec -i smartmouth node --input-type=module -" < tools/voice/audition-drunk.mjs
// Writes DATA_DIR/media/voice/audition-drunk-4/: voice-<id>.wav, noise-<id>-<take>.wav, lines.json.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const KEY = process.env.OPENROUTER_API_KEY;
const OUT = join(process.env.DATA_DIR || '/data', 'media', 'voice', 'audition-drunk-4');
mkdirSync(OUT, { recursive: true });
const MODEL = 'google/gemini-3.8-flash-tts';
const VOICE = 'Laomedeia';

// Copied from the script's "Direction for the recorder" section; keep the two in step.
const BASE = 'A woman hosting a living-room game show, with a stand-up comic timing, the same bright comic host as always, but drinking. Not a cartoon. ';
const NOISES = ' This is not speech. The letters spell the sound of her throat gulping down a big drink, one hard swallow per syllable, then a satisfied gasp at the end. Make the real gulping noises; never say a word.';
const STAGE = {
  buzzed: 'One drink in, and the loudest woo girl at the party. Too loud, shrieking WOO, laughing at the jokes, swearing like it\'s a compliment, consonants just starting to loosen. The timing is still sharp.',
  tipsy: 'Tipsy and flirty. A soft slur on the s sounds, words running together, a purring, flirty voice that turns snippy without warning, landing a beat late, giggling mid-sentence.',
  hammered: 'Hammered, horny and spoiling for a fight. A heavy slur, the volume lurching around, a low suggestive purr one moment and shouting the next, vowels dragged out, stumbling and restarting words, still trying to host.',
  gone: 'Barely conscious. Mumbling and slow, words smeared together and trailing off, long pauses, a sudden loud outburst and then fading again, a sloppy, sleepy flirt. Only the swear words come out clear.',
};

// text keeps the script's {sound} markers; they're stripped before recording and placed by drunk-mix.py.
const LINES = [
  { id: 'b1', part: 'Beginning', stage: 'buzzed', moment: 'hello',
    text: "WOOO! Hello, you filthy fuckers! I'm Salty, I'm one drink in, and I'm already picking who I'm going home with. TV asks, phone answers. Let's fucking GO! {sip}" },
  { id: 'b2', part: 'Beginning', stage: 'buzzed', moment: 'allRight',
    text: 'Everybody got it! WOO! Brains get me so wet. ...My drink. My drink got wet. Cheers! {toast}' },
  { id: 'm1', part: 'Middle', stage: 'tipsy', moment: 'intro',
    text: "{hiccup} Whoever'sh winning... call me. Sheriously. I'm shingle, and I'm shit-faced. WOO!" },
  { id: 'm2', part: 'Middle', stage: 'hammered', moment: 'drink',
    text: "{pour} {slurp} Thish bottle'sh my besht friend. It never picksh the wrong answer. And it puts out." },
  { id: 'e1', part: 'End', stage: 'gone', moment: 'drink',
    text: "{slam} I'M AWAKE. ...I'm awake. [whispers] Who wants to make out. {hiccup}" },
  { id: 'e2', part: 'End', stage: 'gone', moment: 'final',
    text: "We have a... we have a winner! Sho proud. Winner gets a drink... and maybe a little shomething elshe. Everybody elshe... loshers. Go home. Thish is my couch now. Night, fuckers. {hiccups} {bottle-roll}" },
];
// Gulp, retried: no real word anywhere in the text, so there's nothing to read out.
const BANK = [
  { id: 'gulpA', label: 'Gulps: "Ngk. Ngk. Ngk."', stage: 'tipsy', text: 'Ngk. Ngk. Ngk. ...Haaah!' },
  { id: 'gulpB', label: 'Gulps: "Mmf. Mmf. Mmf."', stage: 'tipsy', text: 'Mmf. Mmf. Mmf. Mmf. ...Ahhh.' },
  { id: 'gulpC', label: 'Gulps: "Gk... gk... gk..."', stage: 'tipsy', text: 'Gk... gk... gk... gk... aaahhh.' },
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
