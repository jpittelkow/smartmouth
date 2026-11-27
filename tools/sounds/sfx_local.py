"""Snake Manor's sound effects, generated locally with Stable Audio Open (design guide 4.1: download first, generate
second). Reads sfx-cues.json, makes TAKES takes of each cue on the GPU, levels them with ffmpeg (loudnorm I=-18) and
writes them with an audition page into OUT_DIR, ready to copy to the server's media/sounds/<dir>/.

Needs: an NVIDIA GPU (written on an RTX 3090), a Python env with torch (CUDA), diffusers, soundfile and ffmpeg on
PATH, and a Hugging Face login whose account has accepted the stabilityai/stable-audio-open-1.0 license (it's gated).
    python tools/sounds/sfx_local.py out/sfx-gen [--takes 3] [--only envelope,dagger] [--cues tools/sounds/sfx-hiss.json]
A cue may carry its own `negative` (the shared one says "hiss noise", which fights a snake's hiss).
"""
import argparse, html, json, pathlib, subprocess, sys, time

HERE = pathlib.Path(__file__).parent
MODEL = 'stabilityai/stable-audio-open-1.0'


def generate(out: pathlib.Path, takes: int, only: set[str] | None, cues: pathlib.Path) -> list[dict]:
    import torch, soundfile as sf
    from diffusers import StableAudioPipeline
    spec = json.loads(cues.read_text(encoding='utf-8'))
    pipe = StableAudioPipeline.from_pretrained(MODEL, torch_dtype=torch.float16).to('cuda')
    sr = pipe.vae.sampling_rate
    out.mkdir(parents=True, exist_ok=True)
    made = []
    for cue in spec['cues']:
        if only and cue['id'] not in only:
            continue
        for t in range(1, takes + 1):
            final = out / f"{cue['id']}-gen{t}.mp3"
            if final.exists():
                made.append({**cue, 'take': t, 'file': final.name}); continue
            t0 = time.time()
            g = torch.Generator('cuda').manual_seed(1000 * t + len(cue['id']))
            audio = pipe(cue['prompt'], negative_prompt=cue.get('negative', spec['negative']), num_inference_steps=100,
                         audio_end_in_s=max(1.0, float(cue['seconds'])), num_waveforms_per_prompt=1, generator=g).audios[0]
            wav = out / f"{cue['id']}-gen{t}.wav"
            sf.write(wav, audio.T.float().cpu().numpy(), sr)
            fade = min(0.8, cue['seconds'] / 4)
            af = (f"silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,atrim=0:{cue['seconds']},"
                  f"asetpts=N/SR/TB,loudnorm=I=-18:TP=-2:LRA=11,afade=t=in:d=0.01,afade=t=out:st={max(0, cue['seconds'] - fade)}:d={fade}")
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav), '-af', af, '-ar', '44100', '-ac', '2', '-b:a', '160k', str(final)], check=True)
            wav.unlink()
            made.append({**cue, 'take': t, 'file': final.name})
            print(f"made {final.name} in {time.time() - t0:.1f}s", flush=True)
    return made


def page(made: list[dict], takes: int, stamp: str) -> str:
    by = {}
    for m in made:
        by.setdefault(m['id'], {'cue': m, 'files': {}})['files'][m['take']] = m['file']
    rows = []
    for cid, d in by.items():
        c = d['cue']
        cells = ''.join(
            f'<td><audio controls preload="none" src="{d["files"][t]}?v={stamp}"></audio><label><input type="radio" name="{cid}" value="gen{t}"> Take {t}</label></td>'
            if t in d['files'] else '<td class="none">not made</td>' for t in range(1, takes + 1))
        rows.append(f'<tr><th scope="row">{html.escape(cid)}<small>{html.escape(c["use"])}</small><details><summary>prompt</summary>{html.escape(c["prompt"])}</details></th>'
                    f'{cells}<td><label><input type="radio" name="{cid}" value="neither"> None of these</label></td></tr>')
    heads = ''.join(f'<th>Take {t}</th>' for t in range(1, takes + 1))
    return f"""<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Snake Manor Generated Effects</title>
<style>
:root{{--stone:#14110e;--stone2:#1f1a15;--stone3:#2c251e;--vellum:#e8dbbd;--gold:#c9a24a;--gules:#a3302a;--pale:#cfc5b0;--muted:#9a8d77;color-scheme:dark}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--stone);color:var(--pale);font:17px/1.5 Georgia,serif;padding:24px max(16px,env(safe-area-inset-left)) 60px}}
h1{{font-size:40px;margin:0;color:var(--vellum);font-weight:400}}p{{max-width:78ch;margin:6px 0}}.muted{{color:var(--muted)}}
.wrap{{overflow-x:auto}}table{{border-collapse:collapse;min-width:900px;width:100%}}th,td{{border:1px solid var(--stone3);padding:10px;text-align:left;vertical-align:top}}
thead th{{background:var(--stone2);font-size:14px;color:var(--muted)}}tbody th{{width:300px;color:var(--vellum);font-weight:600}}tbody th small{{display:block;color:var(--pale);font-weight:400;font-size:15px}}
details{{font-weight:400;font-size:13px;color:var(--muted);margin-top:6px}}summary{{cursor:pointer}}audio{{width:200px;height:34px;display:block;margin-bottom:6px}}label{{display:block;font-size:15px;cursor:pointer}}
.none{{color:var(--muted);font-style:italic}}.bar{{position:sticky;bottom:0;background:var(--stone2);border-top:1px solid #5a4a2a;padding:12px;margin-top:24px;display:flex;gap:12px;align-items:center}}
.bar button{{background:var(--gules);color:var(--vellum);border:0;border-radius:4px;padding:10px 16px;font:600 15px Georgia,serif;cursor:pointer}}
button:focus-visible{{outline:2px solid var(--gold);outline-offset:2px}}textarea{{width:100%;min-height:90px;background:var(--stone);color:var(--pale);border:1px solid var(--stone3);font:13px ui-monospace,monospace;margin-top:8px}}
</style>
<h1>Snake Manor: generated effects</h1>
<p>Made on our own GPU with Stable Audio Open from a prompt that says what each sound is for. Each row says where the sound plays in the game; open "prompt" to see exactly what the generator was asked for. Pick a take or none, then copy your picks and paste them to Claude.</p>
<p class="muted">Takes are trimmed and levelled. A cue you skip keeps the game's current sound.</p>
<div class="wrap"><table><thead><tr><th>Cue, and what it's for</th>{heads}<th>Or</th></tr></thead><tbody>
{chr(10).join(rows)}
</tbody></table></div>
<div class="bar"><button type="button" id="copy">Copy my picks</button><span id="count" class="muted"></span></div>
<textarea id="out" readonly hidden></textarea>
<script>
document.addEventListener('play', (e) => {{ for (const a of document.querySelectorAll('audio')) if (a !== e.target) a.pause(); }}, true);
const KEY = 'snake-manor-generated-picks';
let picks = {{}};
try {{ picks = JSON.parse(localStorage.getItem(KEY) || '{{}}'); }} catch {{}}
for (const [cue, v] of Object.entries(picks)) {{ const r = document.querySelector('input[name="' + cue + '"][value="' + v + '"]'); if (r) r.checked = true; }}
const count = () => {{ document.getElementById('count').textContent = Object.keys(picks).length + ' of {len(by)} picked'; }};
count();
document.addEventListener('change', (e) => {{ if (e.target.type !== 'radio') return; picks[e.target.name] = e.target.value; try {{ localStorage.setItem(KEY, JSON.stringify(picks)); }} catch {{}} count(); }});
document.getElementById('copy').addEventListener('click', async () => {{
  const text = 'Snake Manor generated effect picks: ' + JSON.stringify(picks);
  const out = document.getElementById('out'); out.hidden = false; out.value = text;
  try {{ await navigator.clipboard.writeText(text); document.getElementById('count').textContent = 'Copied.'; }} catch {{ out.select(); }}
}});
</script></html>"""


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('out')
    ap.add_argument('--takes', type=int, default=3)
    ap.add_argument('--only', default='')
    ap.add_argument('--cues', default=str(HERE / 'sfx-cues.json'), help='cue list (default sfx-cues.json)')
    a = ap.parse_args()
    out = pathlib.Path(a.out)
    made = generate(out, a.takes, set(filter(None, a.only.split(','))) or None, pathlib.Path(a.cues))
    (out / 'index.html').write_text(page(made, a.takes, format(int(time.time()), 'x')), encoding='utf-8')
    print(f'page: {out / "index.html"} · {len(made)} takes', flush=True)
    sys.exit(0)
