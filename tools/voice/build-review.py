import json, sys
repo, out = sys.argv[1], sys.argv[2]
lines = [l for l in json.load(open(repo + '/content/voice/lines.json', encoding='utf8'))['lines'] if not l['moment'].startswith('sm-')]

MOMENTS = [
 ('hello', 'Hello', 'The first words of a game (round 1).', 'Trivia · 8 rounds. Phones out.', 'Question one appears and Salty reads it.'),
 ('lobby', 'Lobby', 'While people are joining.', 'The room code and QR code.', 'Nothing. It plays while people join.'),
 ('join', 'Someone joined', 'A new player just joined in the lobby.', 'Their character pops onto the TV.', 'Nothing.'),
 ('intro', 'New round', 'The start of rounds 2 to 8.', '“Round 3” (Salty never says the number).', 'Salty reads the next question.'),
 ('question', 'Thinking', 'Rare: filler while players think, only when a question has no recording.', 'The question and its answers.', 'The countdown runs.'),
 ('allRight', 'Everyone right', 'Reveal: every player got it.', 'The right answer lights up.', 'Salty reads the fun fact, e.g. “Marshall is a Dalmatian who drives a red fire truck.”'),
 ('allWrong', 'Everyone wrong', 'Reveal: nobody got it.', 'The right answer lights up.', 'Salty reads the fun fact.'),
 ('mixed', 'Some right', 'Reveal: some got it, some didn’t.', 'The right answer lights up.', 'Salty reads the fun fact.'),
 ('final', 'Game over', 'The end of the game.', 'Final scores, winner on top.', 'Back to the lobby.'),
 ('turn', 'Little turn', 'A Little’s turn starts (ages 3–5). Always Mild, always warm.', 'Two or three big picture cards.', 'Salty reads the question; the remote picks.'),
 ('littleRight', 'Little got it', 'The Little picked right.', 'Their card lights up.', 'Salty reads the fun fact.'),
 ('littleWrong', 'Little missed', 'The Little picked wrong.', 'The right card lights up.', 'Salty reads the fun fact.'),
]
data = {'moments': [dict(id=m, label=a, when=b, tv=c, after=d) for m, a, b, c, d in MOMENTS], 'lines': lines}
js = json.dumps(data, ensure_ascii=False).replace('<', '\\u003c')

html = r'''<title>Salty Line Review</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Atkinson+Hyperlegible+Next:wght@400;700&display=swap">
<style>
/* Layout: one reading column of moments in game order; a sticky bar with progress and filters. Smartmouth's own stage
   palette (the game is a dark TV show), kept as one deliberate dark look. */
:root {
  --ink: #14111f; --stage: #1f1a36; --stage-2: #2b2450; --paper: #fff6e6; --muted: #b9b1d6;
  --spot: #ffd23f; --hot: #ff4f7b; --zap: #36dcb8; --sky: #5aa8ff; --grape: #a77bff;
  --keep: #36dcb8; --cut: #ff4f7b; --fix: #ffd23f;
  --display: 'Bricolage Grotesque', system-ui, sans-serif;
  --body: 'Atkinson Hyperlegible Next', system-ui, sans-serif;
  color-scheme: dark;
}
body { background: var(--ink); color: var(--paper); font: 16px/1.5 var(--body); }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--ink); }
.wrap { max-width: 920px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 24px 80px; }
h1, h2 { font-family: var(--display); font-weight: 800; letter-spacing: -0.01em; text-wrap: balance; margin: 0; }
h1 { font-size: clamp(30px, 6vw, 44px); }
h1 span { color: var(--hot); }
.lede { color: var(--muted); max-width: 65ch; margin: 8px 0 0; }
.bar { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--ink); border-bottom: 1px solid var(--stage-2);
  margin: 20px 0 8px; padding-block: 12px; display: grid; gap: 10px; }
.progress { display: flex; flex-wrap: wrap; gap: 8px 16px; font-variant-numeric: tabular-nums; color: var(--muted); font-size: 15px; }
.progress b { color: var(--paper); }
.progress .k b { color: var(--keep); } .progress .c b { color: var(--cut); } .progress .f b { color: var(--fix); }
.meter { height: 6px; background: var(--stage-2); border-radius: 99px; overflow: hidden; display: flex; }
.meter i { display: block; height: 100%; }
.filters { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { border: 1px solid var(--stage-2); background: var(--stage); color: var(--paper); border-radius: 99px; padding: 6px 12px; font: 700 14px var(--body); cursor: pointer; }
.chip[aria-pressed="true"] { background: var(--paper); color: var(--ink); border-color: var(--paper); }
.chip:focus-visible, .v:focus-visible, textarea:focus-visible, input:focus-visible { outline: 2px solid var(--spot); outline-offset: 2px; }
.save { font-size: 13px; color: var(--muted); margin-left: auto; }
.save.bad { color: var(--hot); }
section.m { margin-top: 36px; }
.mhead { display: grid; gap: 6px; }
.mhead h2 { font-size: 28px; }
.ctx { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; font-size: 14px; color: var(--muted); }
.ctx dt { font-weight: 700; color: var(--paper); text-transform: uppercase; letter-spacing: .06em; font-size: 12px; padding-top: 2px; }
.ctx dd { margin: 0; min-width: 0; }
.spice { margin-top: 14px; }
.spice h3 { margin: 0 0 6px; font: 700 12px var(--body); letter-spacing: .1em; text-transform: uppercase; }
.sp-mild { color: var(--zap); } .sp-spicy { color: var(--spot); } .sp-hot { color: #ff9a3c; } .sp-filthy { color: var(--hot); }
.line { background: var(--stage); border-radius: 14px; padding: 12px 14px; display: grid; gap: 10px; margin-bottom: 8px; border-left: 4px solid transparent; }
.line[data-v="keep"] { border-left-color: var(--keep); } .line[data-v="cut"] { border-left-color: var(--cut); opacity: .72; } .line[data-v="fix"] { border-left-color: var(--fix); }
.text { font-size: 18px; line-height: 1.45; min-width: 0; overflow-wrap: anywhere; }
.line[data-v="cut"] .text { text-decoration: line-through; text-decoration-color: var(--cut); }
.tag { display: inline-block; font: 700 12px var(--body); color: var(--grape); background: var(--stage-2); border-radius: 6px; padding: 1px 6px; margin: 0 2px; vertical-align: 2px; }
.row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.v { border: 1px solid var(--stage-2); background: var(--ink); color: var(--paper); border-radius: 8px; padding: 6px 12px; font: 700 14px var(--body); cursor: pointer; min-height: 36px; }
.v.keep[aria-pressed="true"] { background: var(--keep); color: var(--ink); border-color: var(--keep); }
.v.cut[aria-pressed="true"] { background: var(--cut); color: var(--ink); border-color: var(--cut); }
.v.fix[aria-pressed="true"] { background: var(--fix); color: var(--ink); border-color: var(--fix); }
.note { flex: 1 1 220px; min-width: 0; background: var(--ink); color: var(--paper); border: 1px solid var(--stage-2); border-radius: 8px; padding: 7px 10px; font: 15px var(--body); }
.note::placeholder, textarea::placeholder { color: #8a83a8; }
.ideas { margin-top: 12px; }
.ideas label { display: block; font: 700 13px var(--body); color: var(--muted); margin-bottom: 4px; }
textarea { width: 100%; box-sizing: border-box; min-height: 70px; background: var(--stage); color: var(--paper); border: 1px solid var(--stage-2); border-radius: 10px; padding: 10px; font: 15px var(--body); resize: vertical; }
.empty { color: var(--muted); font-size: 14px; padding: 8px 0; }
.general { margin-top: 40px; }
@media (prefers-reduced-motion: no-preference) { .line { transition: opacity .15s, border-color .15s; } }
</style>

<div class="wrap">
  <h1>Salty <span>line review</span></h1>
  <p class="lede">Every trivia line Salty can say, in the order they come up in a game. Mark each one <b>Keep</b>, <b>Cut</b> or <b>Fix</b>, and say what's wrong in the note. Each moment has a box for ideas. Everything saves as you go, and Claude reads it back before anything is recorded. Delivery cues like <span class="tag">deadpan</span> aren't spoken aloud.</p>

  <div class="bar" id="bar">
    <div class="progress" id="progress"></div>
    <div class="meter" id="meter" aria-hidden="true"></div>
    <div class="filters" role="group" aria-label="Filters">
      <button class="chip" data-spice="all" aria-pressed="true">All spice</button>
      <button class="chip" data-spice="mild" aria-pressed="false">Mild</button>
      <button class="chip" data-spice="spicy" aria-pressed="false">Spicy</button>
      <button class="chip" data-spice="hot" aria-pressed="false">Hot</button>
      <button class="chip" data-spice="filthy" aria-pressed="false">Filthy</button>
      <span style="width:8px"></span>
      <button class="chip" data-show="all" aria-pressed="true">Everything</button>
      <button class="chip" data-show="open" aria-pressed="false">Not marked yet</button>
      <button class="chip" data-show="problems" aria-pressed="false">Cut or fix</button>
      <span class="save" id="save" role="status">Connecting…</span>
    </div>
  </div>

  <div id="moments"></div>

  <section class="general">
    <h2>Anything else?</h2>
    <div class="ideas"><label for="general-notes">Notes for the whole script: tone, running jokes to drop, things Salty should say more.</label>
      <textarea id="general-notes" data-doc="moments/general" placeholder="e.g. Fewer couch jokes. More about the phones."></textarea></div>
  </section>
</div>

<script id="data" type="application/json">''' + js + r'''</script>
<script>
(() => {
  const DATA = JSON.parse(document.getElementById('data').textContent);
  const SPICES = ['mild', 'spicy', 'hot', 'filthy'];
  const verdicts = {};   // line id -> {verdict, note}
  const ideas = {};      // moment id -> text
  let db = null;
  let filters = { spice: 'all', show: 'all' };

  const el = (tag, attrs = {}, kids = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else n.setAttribute(k, v);
    }
    for (const k of kids) n.append(k);
    return n;
  };
  // Spoken text with delivery cues shown as chips.
  function renderText(t) {
    const out = el('div', { class: 'text' });
    for (const part of t.split(/(\[[^\]]+\])/)) {
      if (!part) continue;
      const m = /^\[([^\]]+)\]$/.exec(part);
      out.append(m ? el('span', { class: 'tag', text: m[1] }) : document.createTextNode(part));
    }
    return out;
  }

  // ---- saving: one write at a time per document ----
  const queue = new Map(); const busy = new Set();
  function save(path, body) {
    if (!db) return;
    queue.set(path, body);
    if (!busy.has(path)) flush(path);
  }
  async function flush(path) {
    busy.add(path);
    while (queue.has(path)) {
      const body = queue.get(path); queue.delete(path);
      setSave('Saving…');
      try { await db.doc(path).set(body); setSave('Saved'); }
      catch (e) { setSave(e && e.code === 'invalid_argument' ? 'You can view this page but not mark it.' : 'Couldn’t save. Check your connection.', true); }
    }
    busy.delete(path);
  }
  function setSave(t, bad = false) { const s = document.getElementById('save'); s.textContent = t; s.classList.toggle('bad', bad); }

  function setVerdict(line, verdict, note) {
    const cur = verdicts[line.id] || { verdict: null, note: '' };
    const next = { verdict: verdict === undefined ? cur.verdict : verdict, note: note === undefined ? cur.note : note };
    verdicts[line.id] = next;
    save('verdicts/' + line.id, { verdict: next.verdict, note: next.note, text: line.text, moment: line.moment, spice: line.spice, at: new Date().toISOString() });
    paintLine(line.id); paintProgress(); applyFilters();
  }

  // ---- build ----
  const lineEls = {};
  function build() {
    const root = document.getElementById('moments');
    for (const m of DATA.moments) {
      const lines = DATA.lines.filter((l) => l.moment === m.id);
      if (!lines.length) continue;
      const sec = el('section', { class: 'm', id: 'm-' + m.id });
      sec.append(el('div', { class: 'mhead' }, [
        el('h2', { text: m.label }),
        el('dl', { class: 'ctx' }, [el('dt', { text: 'When' }), el('dd', { text: m.when }), el('dt', { text: 'On the TV' }), el('dd', { text: m.tv }), el('dt', { text: 'Right after' }), el('dd', { text: m.after })]),
      ]));
      for (const sp of SPICES) {
        const group = lines.filter((l) => l.spice === sp);
        if (!group.length) continue;
        const g = el('div', { class: 'spice', 'data-spice': sp }, [el('h3', { class: 'sp-' + sp, text: sp })]);
        for (const l of group) {
          const card = el('div', { class: 'line', 'data-id': l.id });
          card.append(renderText(l.text));
          const row = el('div', { class: 'row' });
          for (const [v, label] of [['keep', 'Keep'], ['cut', 'Cut'], ['fix', 'Fix']]) {
            const b = el('button', { class: 'v ' + v, 'aria-pressed': 'false', text: label, type: 'button' });
            b.addEventListener('click', () => setVerdict(l, (verdicts[l.id] && verdicts[l.id].verdict) === v ? null : v));
            row.append(b);
          }
          const note = el('input', { class: 'note', id: 'note-' + l.id, type: 'text', placeholder: 'What’s wrong, or a better version', 'aria-label': 'Note' });
          let t; note.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => setVerdict(l, undefined, note.value), 700); });
          note.addEventListener('blur', () => { clearTimeout(t); if ((verdicts[l.id] || {}).note !== note.value) setVerdict(l, undefined, note.value); });
          row.append(note);
          card.append(row);
          g.append(card);
          lineEls[l.id] = card;
        }
        sec.append(g);
      }
      const ta = el('textarea', { id: 'ideas-' + m.id, 'data-doc': 'moments/' + m.id, placeholder: 'A line you want here, or what this moment needs' });
      sec.append(el('div', { class: 'ideas' }, [el('label', { for: 'ideas-' + m.id, text: 'Ideas for “' + m.label + '”' }), ta]));
      sec.append(el('p', { class: 'empty', hidden: '', text: 'Nothing matches the filters here.' }));
      root.append(sec);
    }
    document.querySelectorAll('textarea[data-doc]').forEach((ta) => {
      const id = ta.dataset.doc.split('/')[1];
      let t; const go = () => { if (ideas[id] === ta.value) return; ideas[id] = ta.value; save(ta.dataset.doc, { text: ta.value, at: new Date().toISOString() }); };
      ta.addEventListener('input', () => { clearTimeout(t); t = setTimeout(go, 900); });
      ta.addEventListener('blur', () => { clearTimeout(t); go(); });
    });
  }

  function paintLine(id) {
    const card = lineEls[id]; if (!card) return;
    const v = verdicts[id] || {};
    card.dataset.v = v.verdict || '';
    card.querySelectorAll('.v').forEach((b) => b.setAttribute('aria-pressed', String(b.classList.contains(v.verdict))));
    const n = card.querySelector('.note'); if (document.activeElement !== n && v.note !== undefined) n.value = v.note || '';
  }
  function paintProgress() {
    const total = DATA.lines.length;
    const c = { keep: 0, cut: 0, fix: 0 };
    for (const l of DATA.lines) { const v = (verdicts[l.id] || {}).verdict; if (v) c[v]++; }
    const open = total - c.keep - c.cut - c.fix;
    const p = document.getElementById('progress');
    p.replaceChildren(
      el('span', { class: 'k' }, [el('b', { text: String(c.keep) }), document.createTextNode(' keep')]),
      el('span', { class: 'c' }, [el('b', { text: String(c.cut) }), document.createTextNode(' cut')]),
      el('span', { class: 'f' }, [el('b', { text: String(c.fix) }), document.createTextNode(' fix')]),
      el('span', {}, [el('b', { text: String(open) }), document.createTextNode(' not marked, of ' + total)]),
    );
    const meter = document.getElementById('meter');
    meter.replaceChildren(...[['keep', 'var(--keep)'], ['fix', 'var(--fix)'], ['cut', 'var(--cut)']].map(([k, col]) => {
      const i = el('i'); i.style.width = (100 * c[k] / total) + '%'; i.style.background = col; return i;
    }));
  }
  function applyFilters() {
    for (const sec of document.querySelectorAll('section.m')) {
      let shown = 0;
      for (const g of sec.querySelectorAll('.spice')) {
        let gs = 0;
        for (const card of g.querySelectorAll('.line')) {
          const v = (verdicts[card.dataset.id] || {}).verdict;
          const ok = (filters.spice === 'all' || g.dataset.spice === filters.spice)
            && (filters.show === 'all' || (filters.show === 'open' ? !v : (v === 'cut' || v === 'fix')));
          card.hidden = !ok; if (ok) gs++;
        }
        g.hidden = gs === 0; shown += gs;
      }
      sec.querySelector('.empty').hidden = shown > 0;
    }
  }
  document.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
    const key = b.dataset.spice ? 'spice' : 'show';
    filters[key] = b.dataset[key];
    document.querySelectorAll(`.chip[data-${key}]`).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    applyFilters();
  }));

  build(); paintProgress(); applyFilters();

  // ---- the store ----
  (async () => {
    const timer = setTimeout(() => setSave('Can’t reach saved marks yet.', true), 10000);
    db = window.claude && window.claude.use ? await window.claude.use('db') : null;
    if (!db) { clearTimeout(timer); setSave('Marks can’t be saved here. Open it on claude.ai, signed in.', true); return; }
    db.collection('verdicts').onSnapshot((snap) => {
      clearTimeout(timer);
      for (const d of snap.docs) { const x = d.data() || {}; verdicts[d.id] = { verdict: x.verdict || null, note: x.note || '' }; paintLine(d.id); }
      paintProgress(); applyFilters();
      if (!snap.metadata.fromCache) setSave('Saved marks load here');
    }, () => { clearTimeout(timer); setSave('Couldn’t load saved marks.', true); });
    db.collection('moments').onSnapshot((snap) => {
      for (const d of snap.docs) {
        const x = d.data() || {}; ideas[d.id] = x.text || '';
        const ta = document.querySelector(`textarea[data-doc="moments/${d.id}"]`);
        if (ta && document.activeElement !== ta) ta.value = ideas[d.id];
      }
    }, () => {});
  })();
})();
</script>
'''
open(out, 'w', encoding='utf8', newline='\n').write(html)
print(len(lines), 'lines into', out)
