"""Drunk Salty audition: add the effect clips to the recorded lines and build the audition page.

  python -I tools/voice/drunk-mix.py <voice-dir> <sfx-dir> <sfx-meta.json> <out-dir>

voice-dir  has lines.json ({lines, bank}, or a plain list) + the wavs from audition-drunk.mjs (copied down from the server).
sfx-dir    has the processed effect candidates named in sfx-meta.json.
sfx-meta   lists the candidates: cue, file, title, and either user + id (Freesound) or credit (e.g. generated).
out-dir    gets mix-<id>.mp3, the effect files, and index.html; upload it to the audition folder on the server.

Draft 3: sips, gulps, slurps and hiccups are performed by the voice; only {clink} {toast} {pour} {slam} {bottle-roll}
are clips. The mixes use the first candidate for each cue, as a placeholder. The owner picks the real takes on the page.
"""
import html, json, re, shutil, subprocess, sys
from pathlib import Path

voice_dir, sfx_dir, meta_path, out_dir = map(Path, sys.argv[1:5])
out_dir.mkdir(parents=True, exist_ok=True)
data = json.loads((voice_dir / 'lines.json').read_text(encoding='utf-8'))
lines, bank = (data, []) if isinstance(data, list) else (data['lines'], data.get('bank', []))
meta = json.loads(meta_path.read_text(encoding='utf-8'))
CUE_FILE = {'bottle-roll': 'roll'}  # script marker -> cue id
LABEL = {'sip': 'Sip', 'hiccup': 'Hiccup', 'clink': 'Ice clink', 'toast': 'Cheers (two glasses)', 'pour': 'Pour',
         'slurp': 'Slurp', 'slam': 'Glass slammed down', 'roll': 'Bottle falls and rolls'}
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
        norm = 'loudnorm=I=-16:TP=-1.5:LRA=11,' if f == v else ''
        chains.append(f'[{i}:a]aresample=44100,aformat=channel_layouts=mono,{norm}volume={vol},adelay={int(start * 1000)}:all=1[a{i}]')
    mix = ''.join(f'[a{i}]' for i in range(len(parts)))
    fc = ';'.join(chains) + f';{mix}amix=inputs={len(parts)}:normalize=0:duration=longest,alimiter=limit=0.95'
    l['mix'] = f"mix-{l['id']}.mp3"
    subprocess.run(args + ['-filter_complex', fc, '-ac', '1', '-ar', '44100', '-b:a', '160k', str(out_dir / l['mix'])], check=True)
    print('mixed', l['mix'], f'{t:.1f}s', 'pre', pre, 'post', post)

for n in bank:  # copy the voiced noises next to the page
    if not n.get('failed'):
        shutil.copy(voice_dir / n['file'], out_dir / n['file'])

esc = lambda s: html.escape(str(s), quote=True)
caption = lambda t: esc(re.sub(r'\[[^\]]+\]\s*', '', t)).replace('{', '<span class="cue">').replace('}', '</span>')
rows = ''.join(
    f'<tr><td class="l"><b>{esc(l["part"])}</b><small>{esc(l["stage"])} · {esc(l["moment"])}</small></td>'
    f'<td><audio controls preload="none" src="{esc(l["mix"])}"></audio><div class="tx">{caption(l["text"])}</div></td>'
    f'<td><audio controls preload="none" src="{esc(l["file"])}"></audio></td></tr>' for l in lines)


def credit(m):
    if m.get('user'):
        link = f'https://freesound.org/people/{m["user"]}/sounds/{m["id"]}/'
        return f'by <a href="{esc(link)}" target="_blank" rel="noopener">{esc(m["user"])}</a>'
    return esc(m.get('credit', ''))


def fieldset(name, legend, opts, note=''):
    out = f'<fieldset><legend>{esc(legend)}</legend>{note}'
    for i, (value, file, title, small) in enumerate(opts):
        out += (f'<label><input type="radio" name="{esc(name)}" value="{esc(value)}"> <audio controls preload="none" src="{esc(file)}"></audio>'
                f' <span>{esc(title)} <small>{small}</small></span></label>')
    return out + f'<label class="none"><input type="radio" name="{esc(name)}" value="none"> none of these</label></fieldset>'


noises = ''
for nid in dict.fromkeys(n['id'] for n in bank):
    takes = [n for n in bank if n['id'] == nid and not n.get('failed')]
    if takes:
        noises += fieldset(f'voice-{nid}', f'{takes[0]["label"]} ({takes[0]["stage"]})',
                           [(f'take{n["take"]}', n['file'], f'Take {n["take"]}', '') for n in takes],
                           f'<small class="said">Text: “{esc(takes[0]["text"])}”</small>')
cues = ''
for cue in LABEL:
    opts = [m for m in meta if m['cue'] == cue]
    if opts:
        cues += fieldset(cue, LABEL[cue], [(m.get('id', m['file']), m['file'], m['title'],
                                             credit(m) + (' · in the mixes above' if i == 0 else '')) for i, m in enumerate(opts)])

page = f'''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Drunk Salty audition 3</title>
<style>body{{font:16px system-ui;background:#14111f;color:#fff6e6;margin:0;padding:16px}}h1{{margin:0 0 6px}}h2{{margin:28px 0 6px}}p{{color:#b9b1d6;max-width:80ch}}
.wrap{{overflow-x:auto}}table{{border-collapse:collapse;min-width:640px}}th,td{{border:1px solid #2b2450;padding:10px;text-align:left;vertical-align:top}}
th{{background:#1f1a36;font-size:13px}}td.l{{max-width:160px}}td.l b{{display:block}}td.l small{{color:#b9b1d6}}audio{{width:260px;height:36px;vertical-align:middle}}
.tx{{font-size:13px;color:#b9b1d6;margin-top:6px;max-width:320px}}.cue{{color:#ffb347;font-weight:600}}.cue::before{{content:"♪ "}}
fieldset{{border:1px solid #2b2450;border-radius:8px;margin:0 0 12px;padding:8px 12px;max-width:760px}}legend{{font-weight:700;padding:0 6px}}.said{{color:#b9b1d6;display:block;margin-bottom:4px}}
label{{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:4px 0}}label small{{color:#b9b1d6}}a{{color:#9ad1ff}}
button{{font:inherit;padding:8px 14px;border-radius:8px;border:0;background:#ffb347;color:#14111f;font-weight:700;cursor:pointer}}
textarea{{width:100%;max-width:760px;height:150px;margin-top:8px;background:#1f1a36;color:#fff6e6;border:1px solid #2b2450;border-radius:8px;font:13px ui-monospace,monospace}}</style>
<h1>Drunk Salty: audition 3</h1>
<p>The draft-3 lines: fewer “sexy”s, more actual dirty jokes. Sips, gulps, slurps and hiccups are now Salty herself, performed by the voice. The orange ♪ marks are the only effect clips (glass and bottle sounds a voice can’t make), generated with Stable Audio Open. The mixes use the first take of each effect as a placeholder.</p>
<div class="wrap"><table><tr><th>Line</th><th>With effects</th><th>Voice only</th></tr>{rows}</table></div>
<h2>Drinking noises in her voice, on their own</h2>
<p>For playing between lines. Three takes of each, because the voice comes out different every time.</p>
{noises}
<h2>Glass and bottle effects</h2>
<p>Generated with Stable Audio Open. Pick a take, or “none”, for each.</p>
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
