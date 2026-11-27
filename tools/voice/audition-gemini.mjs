// One-off delivery audition (owner, 2026-11-27: "the script is better. the delivery isn't that good").
// Same four jokes, many speech models. Writes DATA_DIR/media/voice/audition-delivery/ with an index.html.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const KEY = process.env.OPENROUTER_API_KEY;
const OUT = join(process.env.DATA_DIR || '/data', 'media', 'voice', 'audition-gemini-upbeat');
mkdirSync(OUT, { recursive: true });

const LINES = [
  { id: 'hello', label: 'Hello (Filthy)', text: "I'm Salty. Captain of jack shit, host of... this. [scoffs] Don't ask about the fucking ship." },
  { id: 'wrong', label: 'All wrong (Filthy)', text: 'Nobody. Not one. [scoffs] A group fucking faceplant. Beautifully coordinated.' },
  { id: 'think', label: 'Thinking (Hot)', text: 'That face. [deadpan] I made that face right before everything went to hell.' },
  { id: 'right', label: 'All right (Spicy)', text: 'Everyone got it. [scoffs] Disgusting— I mean wonderful. Hideous warmth.' },
];
const strip = (t) => t.replace(/\[[^\]]+\]\s*/g, '').trim();
const cues = (t) => [...t.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
const DIRECTION = 'A bright, upbeat, high-energy woman hosting a living-room game show, grinning the whole time, with a '
  + 'stand-up comic timing. The roasting is playful and cheerful, never bitter. Quick, punchy pace, never slow. Big dynamic '
  + 'range: a sly drop for the setup, then a bright snap on the punchline. Land each punchline with a tiny pause before the '
  + 'last words. Not a cartoon.';

const VOICES = [
  ['f','Zephyr','Bright'],['f','Kore','Firm'],['f','Leda','Youthful'],['f','Aoede','Breezy'],['f','Callirrhoe','Easy-going'],
  ['f','Autonoe','Bright'],['f','Despina','Smooth'],['f','Erinome','Clear'],['f','Laomedeia','Upbeat'],['f','Achernar','Soft'],
  ['f','Gacrux','Mature'],['f','Pulcherrima','Forward'],['f','Vindemiatrix','Gentle'],['f','Sulafat','Warm'],
  ['m','Puck','Upbeat'],['m','Charon','Informative'],['m','Fenrir','Excitable'],['m','Orus','Firm'],['m','Enceladus','Breathy'],
  ['m','Iapetus','Clear'],['m','Umbriel','Easy-going'],['m','Algieba','Smooth'],['m','Algenib','Gravelly'],['m','Rasalgethi','Informative'],
  ['m','Alnilam','Firm'],['m','Schedar','Even'],['m','Achird','Friendly'],['m','Zubenelgenubi','Casual'],['m','Sadachbia','Lively'],
  ['m','Sadaltager','Knowledgeable'],
];
const CAST = VOICES.map(([g, v, d]) => [`${g === 'f' ? 'Woman' : 'Man'} · ${v} (${d})`, 'google/gemini-3.8-flash-tts', v, g === 'f' ? 'directed' : 'directedM']);
function body(model, voice, how, text) {
  if (how === 'tags') return { model, voice, input: text, response_format: 'mp3' };
  if (how === 'drama') return { model, input: `[${DIRECTION}] ${text}`, response_format: 'mp3' };
  if (how === 'plain') return { model, voice, input: strip(text), response_format: 'mp3', speed: 1.08 };
  const dir = how === 'directedM' ? DIRECTION.replace('high-energy woman', 'high-energy man') : DIRECTION;
  return { model, voice, input: strip(text), instructions: `${dir} Delivery cues, in order: ${cues(text).join(', ')}.`, response_format: 'wav' };
}

const slug = (s) => s.replace(/[^\w]+/g, '_');
const made = {};
const errors = [];
for (const [label, model, voice, how] of CAST) {
  for (const l of LINES) {
    const ext = how.startsWith('directed') ? 'wav' : 'mp3';
    const file = `${slug(label)}-${l.id}.${ext}`;
    if (!existsSync(join(OUT, file))) {
      try {
        const r = await fetch('https://openrouter.ai/api/v1/audio/speech', {
          method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body(model, voice, how, l.text)), signal: AbortSignal.timeout(120_000),
        });
        if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 160)}`);
        writeFileSync(join(OUT, file), Buffer.from(await r.arrayBuffer()));
      } catch (e) { errors.push(`${label} / ${l.id}: ${e.message}`); console.error('failed', label, l.id, e.message); continue; }
    }
    made[`${label}|${l.id}`] = file;
    console.log('made', file);
  }
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
let html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Salty Gemini voices, upbeat</title>
<style>body{font:16px system-ui;background:#14111f;color:#fff6e6;margin:0;padding:16px}h1{margin:0 0 6px}p{color:#b9b1d6;max-width:80ch}
.wrap{overflow-x:auto}table{border-collapse:collapse;min-width:900px}th,td{border:1px solid #2b2450;padding:8px;text-align:left;vertical-align:top}
th{background:#1f1a36;font-size:13px;max-width:220px}td.v{font-weight:700;white-space:nowrap}audio{width:170px;height:34px}.err{color:#ff4f7b;font-size:12px}</style>
<h1>Salty on Gemini 3.8 Flash: every voice, upbeat</h1><p>Same four jokes, now directed bright and grinning (playful roast, quick and punchy); only the voice changes. Women first, then men. The word in brackets is Google's description.</p>
<div class="wrap"><table><tr><th>Voice</th>${LINES.map((l) => `<th>${esc(l.label)}<br><small>${esc(strip(l.text))}</small></th>`).join('')}</tr>`;
for (const [label] of CAST) {
  html += `<tr><td class="v">${esc(label)}</td>`;
  for (const l of LINES) { const f = made[`${label}|${l.id}`]; html += f ? `<td><audio controls preload="none" src="${esc(f)}"></audio></td>` : '<td class="err">failed</td>'; }
  html += '</tr>';
}
html += `</table></div>${errors.length ? `<p class="err">${errors.map(esc).join('<br>')}</p>` : ''}
<script>document.addEventListener('play',e=>{for(const a of document.querySelectorAll('audio'))if(a!==e.target)a.pause()},true)</script>`;
writeFileSync(join(OUT, 'index.html'), html);
console.log(`${Object.keys(made).length} clips, ${errors.length} failed`);
