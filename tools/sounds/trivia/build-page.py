import json, sys, html as H
S = sys.argv[1]
takes = json.load(open(S + '/trivia-sounds/takes.json', encoding='utf8'))
WHERE = {
 'join': 'On the TV when a player joins the lobby.', 'start': 'When a game starts, before Salty says hello.',
 'round': 'The transition into each new round.', 'lock': 'On the TV when someone locks in an answer.',
 'tick': 'Each of the last five seconds of the countdown.', 'timeup': 'When the countdown hits zero.',
 'reveal': 'Just before the right answer lights up.', 'right': 'The right answer lights up.',
 'allwrong': 'Nobody got it.', 'applause': 'Everybody got it.', 'slide': 'Leaderboard rows slide into place.',
 'count': 'Scores counting up on the leaderboard.', 'sparkle': "A Little's turn starts.", 'yay': 'A Little picks the right picture.',
}
CURRENT = {'tick': 'tick', 'timeup': 'buzz'}  # trivia's synthesized sounds today (apps/web/src/host/sfx.ts)
MUSIC = [
 ('lobby', 'Lobby', 'Loops under the lobby while people join.'),
 ('think', 'Thinking', 'Under each question while the countdown runs (quiet, ducked under Salty).'),
 ('leaderboard', 'Leaderboard', 'The leaderboard between rounds (the first few seconds).'),
 ('winner', 'Winner', 'The final scores.'),
]
data = {'fx': [dict(t, where=WHERE.get(t['id'], ''), current=CURRENT.get(t['id'])) for t in takes],
        'music': [dict(id=i, label=l, where=w, takes=[f'music/{i}-1.mp3', f'music/{i}-2.mp3']) for i, l, w in MUSIC]}
js = json.dumps(data, ensure_ascii=False).replace('<', '\\u003c')
page = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Trivia Sound Audition</title>
<style>
:root{--ink:#14111f;--stage:#1f1a36;--stage-2:#2b2450;--paper:#fff6e6;--muted:#b9b1d6;--spot:#ffd23f;--hot:#ff4f7b;--zap:#36dcb8;color-scheme:dark}
body{margin:0;background:var(--ink);color:var(--paper);font:16px/1.5 system-ui,sans-serif}
.wrap{max-width:920px;margin:0 auto;padding:24px 16px 80px}
h1{margin:0;font-size:34px}h2{margin:36px 0 8px;font-size:24px;color:var(--spot)}
p{color:var(--muted);max-width:70ch}
.cue{background:var(--stage);border-radius:14px;padding:14px 16px;margin:10px 0;display:grid;gap:10px}
.cue h3{margin:0;font-size:19px}.cue .where{color:var(--muted);font-size:14px}
.opts{display:flex;flex-wrap:wrap;gap:8px}
.opt{display:flex;align-items:center;gap:8px;background:var(--ink);border:2px solid var(--stage-2);border-radius:10px;padding:6px 10px;cursor:pointer;min-width:0}
.opt:has(input:checked){border-color:var(--zap)}
.opt input{accent-color:var(--zap)}
.opt small{color:var(--muted);display:block;font-size:12px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.opt small a{color:var(--muted)}
button.play{background:var(--spot);color:var(--ink);border:0;border-radius:8px;font-weight:700;padding:6px 10px;cursor:pointer}
button.play.on{background:var(--hot)}
.bar{position:sticky;top:0;background:var(--ink);padding:10px 0;border-bottom:1px solid var(--stage-2);display:flex;gap:10px;align-items:center;flex-wrap:wrap;z-index:2}
.bar button{background:var(--zap);color:var(--ink);border:0;border-radius:10px;font-weight:800;padding:10px 16px;cursor:pointer}
#status{color:var(--muted);font-size:14px}
textarea{width:100%;box-sizing:border-box;min-height:120px;background:var(--stage);color:var(--paper);border:1px solid var(--stage-2);border-radius:10px;padding:10px;font:13px ui-monospace,monospace}
</style></head><body><div class="wrap">
<h1>Trivia sound audition</h1>
<p>Pick one per moment, or <b>None</b> (silence, or the sound trivia has now where there is one). Effects are CC0 from
Freesound, trimmed and levelled; music beds are generated (Google Lyria 3), 30 seconds each, and will loop or be cut
to fit. Your picks are saved in this browser. When you're done, press <b>Copy my picks</b> and paste the text to Claude.</p>
<div class="bar"><button id="copy" type="button">Copy my picks</button><span id="status">Nothing picked yet.</span></div>
<h2>Music</h2><div id="music"></div>
<h2>Sound effects</h2><div id="fx"></div>
<h2>Your picks</h2><textarea id="out" readonly></textarea>
</div>
<script id="data" type="application/json">''' + js + '''</script>
<script>
const D = JSON.parse(document.getElementById('data').textContent);
const KEY = 'trivia-sound-picks';
let picks = {}; try { picks = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}
const audio = new Audio(); let playing = null;
function stopAll() { audio.pause(); document.querySelectorAll('button.play.on').forEach((b) => { b.classList.remove('on'); b.textContent = 'Play'; }); }
function playFile(btn, src) {
  if (playing === btn && !audio.paused) { stopAll(); playing = null; return; }
  stopAll(); audio.src = src; audio.currentTime = 0; audio.play().catch(() => {}); btn.classList.add('on'); btn.textContent = 'Stop'; playing = btn;
}
audio.addEventListener('ended', stopAll);
// The sounds trivia makes today, synthesized the same way the TV does (apps/web/src/host/sfx.ts).
let ctx = null;
function blip(f, ms, type, gain) { ctx ??= new AudioContext(); const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000); o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + ms / 1000 + 0.02); }
const SYNTH = { tick: () => blip(880, 90, 'square', 0.12), buzz: () => { blip(150, 450, 'sawtooth', 0.14); blip(155, 450, 'sawtooth', 0.1); } };
function el(tag, attrs = {}, kids = []) { const n = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'text') n.textContent = v; else n.setAttribute(k, v); } n.append(...kids); return n; }
function option(cueId, value, label, sub, play) {
  const id = `${cueId}-${value}`;
  const input = el('input', { type: 'radio', name: cueId, value, id });
  if (picks[cueId] === value) input.checked = true;
  input.addEventListener('change', () => { picks[cueId] = value; try { localStorage.setItem(KEY, JSON.stringify(picks)); } catch {} summary(); });
  const lab = el('label', { class: 'opt', for: id }, [input]);
  if (play) { const b = el('button', { class: 'play', type: 'button', text: 'Play' }); b.addEventListener('click', (e) => { e.preventDefault(); play(b); }); lab.append(b); }
  const t = el('span', {}, [document.createTextNode(label)]); if (sub) t.append(sub); lab.append(t);
  return lab;
}
function cue(root, c, opts) {
  const box = el('div', { class: 'cue' }, [el('h3', { text: c.label }), el('div', { class: 'where', text: c.where })]);
  box.append(el('div', { class: 'opts' }, opts)); root.append(box);
}
for (const m of D.music) cue(document.getElementById('music'), m, [
  ...m.takes.map((f, i) => option(m.id, `take ${i + 1}`, `Take ${i + 1}`, null, (b) => playFile(b, f))),
  option(m.id, 'none', 'None', null, null),
]);
for (const c of D.fx) {
  const opts = c.takes.map((t, i) => {
    const sub = el('small', {}, [el('a', { href: t.page, target: '_blank', rel: 'noreferrer', text: `${t.title} · ${t.author}` })]);
    return option(c.id, `take ${i + 1}`, `Take ${i + 1}`, sub, (b) => playFile(b, t.file));
  });
  if (c.current) opts.unshift(option(c.id, 'current', 'Current', el('small', { text: 'the synthesized one' }), () => { stopAll(); SYNTH[c.current](); }));
  opts.push(option(c.id, 'none', 'None', null, null));
  cue(document.getElementById('fx'), { label: c.label, where: c.where }, opts);
}
function summary() {
  const all = [...D.music.map((m) => [m.id, m.label]), ...D.fx.map((c) => [c.id, c.label])];
  const done = all.filter(([id]) => picks[id]).length;
  document.getElementById('status').textContent = `${done} of ${all.length} picked.`;
  document.getElementById('out').value = 'Trivia sound picks:\\n' + all.map(([id, l]) => `- ${l} (${id}): ${picks[id] || 'not picked'}`).join('\\n');
}
summary();
document.getElementById('copy').addEventListener('click', async () => {
  const t = document.getElementById('out');
  try { await navigator.clipboard.writeText(t.value); document.getElementById('status').textContent = 'Copied. Paste it to Claude.'; }
  catch { t.select(); document.getElementById('status').textContent = 'Select the text below and copy it.'; }
});
</script></body></html>'''
open(S + '/trivia-sounds/index.html', 'w', encoding='utf8', newline='\n').write(page)
print('page written')
