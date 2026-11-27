"""Drunk Salty audition, draft 2: add the drinking sounds to the recorded lines and build the audition page.

  python -I tools/voice/drunk-mix.py <voice-dir> <sfx-dir> <freesound-meta.json> <out-dir>

voice-dir  has lines.json + voice-<id>.wav from audition-drunk.mjs (copied down from the server).
sfx-dir    has the processed candidates, <cue>-<freesoundId>.mp3 (trimmed, loudnorm -18).
meta.json  lists the candidates: cue, id, title, user (for credits).
out-dir    gets mix-<id>.mp3, the sfx files, and index.html; upload it to DATA_DIR/media/voice/audition-drunk-2/.

The mixes use the first candidate for each cue, as a placeholder. The owner picks the real takes on the page.
"""
import html, json, re, shutil, subprocess, sys
from pathlib import Path

voice_dir, sfx_dir, meta_path, out_dir = map(Path, sys.argv[1:5])
out_dir.mkdir(parents=True, exist_ok=True)
lines = json.loads((voice_dir / 'lines.json').read_text(encoding='utf-8'))
meta = json.loads(meta_path.read_text(encoding='utf-8'))
CUE_FILE = {'bottle-roll': 'roll'}  # script marker -> file prefix
LABEL = {'sip': 'Sip', 'hiccup': 'Hiccup', 'clink': 'Ice clink', 'pour': 'Pour', 'slurp': 'Slurp',
         'slam': 'Glass slammed down', 'roll': 'Bottle falls and rolls'}
first = {}
for m in meta:
    first.setdefault(m['cue'], m)
    shutil.copy(sfx_dir / m['file'], out_dir / m['file'])


def dur(p):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(p)]).strip())


GAP = 0.12  # seconds between a sound and the words
for l in lines:
    head = re.match(r'^((?:\{[^}]+\}\s*)*)', l['text']).group(1)
    tail = re.search(r'((?:\s*\{[^}]+\})*)\s*$', l['text']).group(1)
    pre = [CUE_FILE.get(c, c) for c in re.findall(r'\{([^}]+)\}', head)]
    post = [CUE_FILE.get(c, c) for c in re.findall(r'\{([^}]+)\}', tail)]
    parts, t = [], 0.0  # (file, start, volume)
    for c in pre:
        f = sfx_dir / first[c]['file']
        parts.append((f, t, 0.8)); t += dur(f) + GAP
    v = voice_dir / l['file']
    parts.append((v, t, 1.0)); t += dur(v) + GAP
    for c in post:
        f = sfx_dir / first[c]['file']
        parts.append((f, t, 0.8)); t += dur(f) + GAP
    args, chains = ['ffmpeg', '-v', 'error', '-y'], []
    for i, (f, start, vol) in enumerate(parts):
        args += ['-i', str(f)]
        ms = int(start * 1000)
        norm = 'loudnorm=I=-16:TP=-1.5:LRA=11,' if f == v else ''
        chains.append(f'[{i}:a]aresample=44100,aformat=channel_layouts=mono,{norm}volume={vol},adelay={ms}:all=1[a{i}]')
    mix = ''.join(f'[a{i}]' for i in range(len(parts)))
    fc = ';'.join(chains) + f';{mix}amix=inputs={len(parts)}:normalize=0:duration=longest,alimiter=limit=0.95'
    l['mix'] = f"mix-{l['id']}.mp3"
    subprocess.run(args + ['-filter_complex', fc, '-ac', '1', '-ar', '44100', '-b:a', '160k', str(out_dir / l['mix'])], check=True)
    print('mixed', l['mix'], f'{t:.1f}s', 'pre', pre, 'post', post)

esc = lambda s: html.escape(str(s), quote=True)
caption = lambda t: esc(re.sub(r'\[[^\]]+\]\s*', '', t)).replace('{', '<span class="cue">').replace('}', '</span>')
rows = ''.join(
    f'<tr><td class="l"><b>{esc(l["part"])}</b><small>{esc(l["stage"])} · {esc(l["moment"])}</small></td>'
    f'<td><audio controls preload="none" src="{esc(l["mix"])}"></audio><div class="tx">{caption(l["text"])}</div></td>'
    f'<td><audio controls preload="none" src="{esc(l["file"])}"></audio></td></tr>' for l in lines)
cues = ''
for cue in LABEL:
    opts = [m for m in meta if m['cue'] == cue]
    if not opts:
        continue
    cues += f'<fieldset><legend>{LABEL[cue]}</legend>'
    for i, m in enumerate(opts):
        link = f'https://freesound.org/people/{m["user"]}/sounds/{m["id"]}/'
        cues += (f'<label><input type="radio" name="{cue}" value="{m["id"]}"> <audio controls preload="none" src="{esc(m["file"])}"></audio>'
                 f' <span>{esc(m["title"])} <small>by <a href="{esc(link)}" target="_blank" rel="noopener">{esc(m["user"])}</a>'
                 f'{" · in the mixes above" if i == 0 else ""}</small></span></label>')
    cues += f'<label class="none"><input type="radio" name="{cue}" value="none"> none of these</label></fieldset>'

page = f'''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Drunk Salty audition 2</title>
<style>body{{font:16px system-ui;background:#14111f;color:#fff6e6;margin:0;padding:16px}}h1{{margin:0 0 6px}}h2{{margin:28px 0 6px}}p{{color:#b9b1d6;max-width:80ch}}
.wrap{{overflow-x:auto}}table{{border-collapse:collapse;min-width:640px}}th,td{{border:1px solid #2b2450;padding:10px;text-align:left;vertical-align:top}}
th{{background:#1f1a36;font-size:13px}}td.l{{max-width:160px}}td.l b{{display:block}}td.l small{{color:#b9b1d6}}audio{{width:260px;height:36px;vertical-align:middle}}
.tx{{font-size:13px;color:#b9b1d6;margin-top:6px;max-width:320px}}.cue{{color:#ffb347;font-weight:600}}.cue::before{{content:"♪ "}}
fieldset{{border:1px solid #2b2450;border-radius:8px;margin:0 0 12px;padding:8px 12px;max-width:760px}}legend{{font-weight:700;padding:0 6px}}
label{{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:4px 0}}label small{{color:#b9b1d6}}a{{color:#9ad1ff}}
button{{font:inherit;padding:8px 14px;border-radius:8px;border:0;background:#ffb347;color:#14111f;font-weight:700;cursor:pointer}}
textarea{{width:100%;max-width:760px;height:110px;margin-top:8px;background:#1f1a36;color:#fff6e6;border:1px solid #2b2450;border-radius:8px;font:13px ui-monospace,monospace}}</style>
<h1>Drunk Salty: audition 2</h1>
<p>The draft-2 lines (more swearing, woo girl, flirty and horny), slurred spelling, Laomedeia with each stage's direction. Two lines from the beginning, two from the middle, two from the end. The orange ♪ marks are drinking sounds. The mixes use the first take of each sound as a placeholder. Pick the real ones below.</p>
<div class="wrap"><table><tr><th>Line</th><th>With drinking sounds</th><th>Voice only</th></tr>{rows}</table></div>
<h2>Drinking sounds: pick one of each</h2>
<p>Free CC0 recordings from Freesound, trimmed and levelled. Pick a take, or "none", for each cue, then copy your picks and paste them back to Claude.</p>
{cues}
<button id="copy">Copy my picks</button><textarea id="out" readonly placeholder="Your picks appear here"></textarea>
<script>
document.addEventListener('play',e=>{{for(const a of document.querySelectorAll('audio'))if(a!==e.target)a.pause()}},true);
const out=document.getElementById('out');
function picks(){{return [...document.querySelectorAll('fieldset')].map(f=>{{const r=f.querySelector('input:checked');return f.querySelector('legend').textContent+': '+(r?r.value:'(not picked)')}}).join('\\n')}}
document.addEventListener('change',()=>{{out.value=picks()}});
document.getElementById('copy').onclick=async()=>{{out.value=picks();out.select();try{{await navigator.clipboard.writeText(out.value)}}catch(e){{document.execCommand('copy')}}}};
</script>'''
(out_dir / 'index.html').write_text(page, encoding='utf-8')
print('page', out_dir / 'index.html')
