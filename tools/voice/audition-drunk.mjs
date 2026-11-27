// Drunk Salty audition, draft 3 (owner, 2026-11-27: "too much use of the word sexy vs sexual things to say, all the sound
// effects were terrible" / "can we generate the sound effects of her drinking with her voice?"). Six lines from
// docs/design/drunk-salty-script.md, slurred spelling, with the sips, gulps, slurps and hiccups spelled out in the text
// for the voice to perform. Also a bank of drinking noises on their own, three takes each.
// {clink} {toast} {pour} {slam} {bottle-roll} stay clips; tools/voice/drunk-mix.py adds them and builds the page.
// Runs inside the container (holds OPENROUTER_API_KEY):
//   ssh root@192.168.1.4 "docker exec -i smartmouth node --input-type=module -" < tools/voice/audition-drunk.mjs
// Writes DATA_DIR/media/voice/audition-drunk-3/: voice-<id>.wav, noise-<id>-<take>.wav, lines.json.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const KEY = process.env.OPENROUTER_API_KEY;
const OUT = join(process.env.DATA_DIR || '/data', 'media', 'voice', 'audition-drunk-3');
mkdirSync(OUT, { recursive: true });
const MODEL = 'google/gemini-3.8-flash-tts';
const VOICE = 'Laomedeia';

// Copied from the script's "Direction for the recorder" section; keep the two in step.
const BASE = 'A woman hosting a living-room game show, with a stand-up comic timing, the same bright comic host as always, but drinking. Not a cartoon. ';
const NOISES = ' The drinking noises written in the text are performed as real sounds from her mouth, not read as words: "hic" is a real hiccup, "sluurp" is a loud wet slurp, "glug" is real gulping, "ahhh" is a satisfied exhale after a drink, "mm" is a sip with lips on the glass.';
const STAGE = {
  buzzed: 'One drink in, and the loudest woo girl at the party. Too loud, shrieking WOO, laughing at the jokes, swearing like it\'s a compliment, consonants just starting to loosen. The timing is still sharp.',
  tipsy: 'Tipsy and flirty. A soft slur on the s sounds, words running together, a purring, flirty voice that turns snippy without warning, landing a beat late, giggling mid-sentence.',
  hammered: 'Hammered, horny and spoiling for a fight. A heavy slur, the volume lurching around, a low suggestive purr one moment and shouting the next, vowels dragged out, stumbling and restarting words, still trying to host.',
  gone: 'Barely conscious. Mumbling and slow, words smeared together and trailing off, long pauses, a sudden loud outburst and then fading again, a sloppy, sleepy flirt. Only the swear words come out clear.',
};

// text keeps the script's {sound} markers; they're stripped before recording and placed by drunk-mix.py.
const LINES = [
  { id: 'b1', part: 'Beginning', stage: 'buzzed', moment: 'hello',
    text: "WOOO! Hello, you filthy fuckers! I'm Salty, I'm one drink in, and I'm already picking who I'm going home with. TV asks, phone answers. Let's fucking GO! ...Mm. Sluuurp. Ahhh!" },
  { id: 'b2', part: 'Beginning', stage: 'buzzed', moment: 'allRight',
    text: 'Everybody got it! WOO! Brains get me so wet. ...My drink. My drink got wet. Cheers! {toast}' },
  { id: 'm1', part: 'Middle', stage: 'tipsy', moment: 'intro',
    text: "Hic! Whoever'sh winning... call me. Sheriously. I'm shingle, and I'm shit-faced. Hic! WOO!" },
  { id: 'm2', part: 'Middle', stage: 'hammered', moment: 'drink',
    text: "{pour} Glug, glug, glug, glug... ahhhh. Thish bottle'sh my besht friend. It never picksh the wrong answer. And it puts out." },
  { id: 'e1', part: 'End', stage: 'gone', moment: 'drink',
    text: "{slam} I'M AWAKE. ...I'm awake. Hic. [whispers] Who wants to make out." },
  { id: 'e2', part: 'End', stage: 'gone', moment: 'final',
    text: "We have a... we have a winner! Sho proud. Winner gets a drink... and maybe a little shomething elshe. Everybody elshe... loshers. Go home. Thish is my couch now. Hic... night, fuckers. {bottle-roll}" },
];
// Drinking noises on their own, for playing between lines. Three takes each (the voice varies call to call).
const BANK = [
  { id: 'sip', label: 'Sip and ahh', stage: 'buzzed', text: 'Mm. Sluurp. ...Ahhh.' },
  { id: 'gulp', label: 'Big gulps', stage: 'tipsy', text: 'Glug, glug, glug, glug... ahhhh!' },
  { id: 'hic', label: 'Hiccup', stage: 'tipsy', text: 'Hic!' },
  { id: 'hics', label: 'Hiccups, sloppy', stage: 'gone', text: 'Hic. ...hic. Hic!' },
  { id: 'slurp', label: 'Slurping the last drops', stage: 'hammered', text: 'Sluuuuurrrp. Sluurp. ...Mm.' },
  { id: 'chug', label: 'Chugging, then a woo', stage: 'buzzed', text: 'Glug, glug, glug, glug, glug... ahhh! WOO!' },
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
  const instructions = BASE + STAGE[l.stage] + NOISES + (c.length ? ` Delivery cues, in order: ${c.join(', ')}.` : '');
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
        body: JSON.stringify({ model: MODEL, voice: VOICE, input: n.text, instructions: BASE + STAGE[n.stage] + NOISES + ' Make only the noises, no other words.', response_format: 'wav' }),
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
