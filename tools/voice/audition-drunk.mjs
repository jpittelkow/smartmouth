// Drunk Salty audition (owner, 2026-11-27): two lines from the start of a game, two from the middle, two from the end.
// Lines come from docs/design/drunk-salty-script.md. Each slurred line is made twice: once with the slurred spelling and
// once spelled normally with the stage direction alone, to see whether the spelling helps or turns her into a cartoon.
// Runs inside the container (holds OPENROUTER_API_KEY):
//   ssh root@192.168.1.4 "docker exec -i smartmouth node --input-type=module -" < tools/voice/audition-drunk.mjs
// Writes DATA_DIR/media/voice/audition-drunk/ with an index.html.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const KEY = process.env.OPENROUTER_API_KEY;
const OUT = join(process.env.DATA_DIR || '/data', 'media', 'voice', 'audition-drunk');
mkdirSync(OUT, { recursive: true });
const MODEL = 'google/gemini-3.8-flash-tts';
const VOICE = 'Laomedeia';

const BASE = 'A woman hosting a living-room game show, with a stand-up comic timing, the same bright comic host as always, but drinking. Not a cartoon. ';
const STAGE = {
  buzzed: 'One drink in. A little too loud, laughing at the jokes, consonants just starting to loosen. The timing is still sharp.',
  tipsy: 'Tipsy. A soft slur on the s sounds, words running together, sudden swings between soppy and snippy, landing a beat late, giggling mid-sentence.',
  hammered: 'Hammered. A heavy slur, the volume lurching around, hostile and suspicious, vowels dragged out, stumbling and restarting words, still trying to host.',
  gone: 'Barely conscious. Mumbling and slow, words smeared together and trailing off, long pauses, a sudden loud outburst and then fading again. Only the last swear word comes out clear.',
};

// slurred: the script's spelling. plain: the same words spelled normally (null when they're the same).
const LINES = [
  { id: 'b1', part: 'Beginning', stage: 'buzzed', moment: 'hello',
    slurred: "[laughs] Evening, you beautiful idiots! I'm Salty. The TV asks, your phone answers, and I drink every time somebody's wrong. So please be wrong. Here we go!", plain: null },
  { id: 'b2', part: 'Beginning', stage: 'buzzed', moment: 'mixed',
    slurred: 'Half right. Like my last marriage. ...I was the wrong half.', plain: null },
  { id: 'm1', part: 'Middle', stage: 'tipsy', moment: 'intro',
    slurred: 'Okay. Okay. Nexsht round. I love you guys. Not the one in last. Everybody elshe.',
    plain: 'Okay. Okay. Next round. I love you guys. Not the one in last. Everybody else.' },
  { id: 'm2', part: 'Middle', stage: 'hammered', moment: 'allWrong',
    slurred: "Wrong. All wrong. I've shlept with shmarter people. Not many. But shome.",
    plain: "Wrong. All wrong. I've slept with smarter people. Not many. But some." },
  { id: 'e1', part: 'End', stage: 'gone', moment: 'intro',
    slurred: "Nnnnext... round... roun'... [sighs] ...the fuck's a round.",
    plain: "Next... round... round... [sighs] ...the fuck's a round." },
  { id: 'e2', part: 'End', stage: 'gone', moment: 'final',
    slurred: "Game over. Over. Like my career at shea. [sighs] Winner, I'd kissh you, but there's two of you. Everyone elshe... call me a cab.",
    plain: "Game over. Over. Like my career at sea. [sighs] Winner, I'd kiss you, but there's two of you. Everyone else... call me a cab." },
];
const strip = (t) => t.replace(/\[[^\]]+\]\s*/g, '').trim();
const cues = (t) => [...t.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);

const takes = [];
for (const l of LINES) {
  takes.push({ l, kind: 'slurred', text: l.slurred });
  if (l.plain) takes.push({ l, kind: 'plain', text: l.plain });
}
const errors = [];
for (const t of takes) {
  t.file = `${t.l.id}-${t.kind}.wav`;
  if (existsSync(join(OUT, t.file))) { console.log('kept', t.file); continue; }
  const c = cues(t.text);
  const instructions = BASE + STAGE[t.l.stage] + (c.length ? ` Delivery cues, in order: ${c.join(', ')}.` : '');
  try {
    const r = await fetch('https://openrouter.ai/api/v1/audio/speech', {
      method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, voice: VOICE, input: strip(t.text), instructions, response_format: 'wav' }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 160)}`);
    writeFileSync(join(OUT, t.file), Buffer.from(await r.arrayBuffer()));
    console.log('made', t.file);
  } catch (e) { t.failed = true; errors.push(`${t.file}: ${e.message}`); console.error('failed', t.file, e.message); }
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const cell = (t) => !t ? '<td class="na">same words</td>'
  : t.failed ? '<td class="err">failed</td>'
  : `<td><audio controls preload="none" src="${esc(t.file)}"></audio><div class="tx">${esc(strip(t.text))}</div></td>`;
let html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Drunk Salty audition</title>
<style>body{font:16px system-ui;background:#14111f;color:#fff6e6;margin:0;padding:16px}h1{margin:0 0 6px}p{color:#b9b1d6;max-width:80ch}
.wrap{overflow-x:auto}table{border-collapse:collapse;min-width:760px}th,td{border:1px solid #2b2450;padding:10px;text-align:left;vertical-align:top}
th{background:#1f1a36;font-size:13px}td.l{max-width:180px}td.l b{display:block}td.l small{color:#b9b1d6}audio{width:260px;height:36px}
.tx{font-size:13px;color:#b9b1d6;margin-top:6px;max-width:300px}.na{color:#6d6491;font-size:13px}.err{color:#ff4f7b}</style>
<h1>Drunk Salty: audition</h1><p>Gemini 3.8 Flash · Laomedeia, with each stage's direction from the script. Two lines from the beginning of a game (Buzzed), two from the middle (Tipsy, Hammered), two from the end (Gone). Where the spelling is slurred, the right column is the same line spelled normally, so you can hear whether the spelling helps. No drinking sounds yet: those will be separate clips.</p>
<div class="wrap"><table><tr><th>Line</th><th>Slurred spelling</th><th>Normal spelling, direction only</th></tr>`;
for (const l of LINES) {
  const s = takes.find((t) => t.l === l && t.kind === 'slurred');
  const p = takes.find((t) => t.l === l && t.kind === 'plain');
  html += `<tr><td class="l"><b>${esc(l.part)}</b><small>${esc(l.stage)} · ${esc(l.moment)}</small></td>${cell(s)}${cell(p)}</tr>`;
}
html += `</table></div>${errors.length ? `<p class="err">${errors.map(esc).join('<br>')}</p>` : ''}
<script>document.addEventListener('play',e=>{for(const a of document.querySelectorAll('audio'))if(a!==e.target)a.pause()},true)</script>`;
writeFileSync(join(OUT, 'index.html'), html);
console.log(`${takes.length - errors.length} clips, ${errors.length} failed`);
