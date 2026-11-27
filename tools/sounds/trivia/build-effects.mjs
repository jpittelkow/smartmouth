// Downloads the approved CC0 Freesound previews (slowly), then trims and levels each with ffmpeg (design guide 4.1:
// silence off the front, length capped per cue, loudnorm I=-18 TP=-2, short fades, 44.1 kHz 160 kbps mp3).
// Usage: node sfx-build.mjs <candidates.json> <download dir> <output dir>
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [listFile, dlDir, outDir] = process.argv.slice(2);
const cues = JSON.parse(readFileSync(listFile, 'utf8'));
mkdirSync(dlDir, { recursive: true });
mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const manifest = [];
for (const c of cues) {
  const takes = [];
  for (const [i, x] of c.candidates.entries()) {
    const raw = join(dlDir, `${x.id}.mp3`);
    if (!existsSync(raw)) {
      const r = await fetch(x.preview, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!r.ok) { console.error('download failed', x.id, r.status); continue; }
      writeFileSync(raw, Buffer.from(await r.arrayBuffer()));
      await sleep(1500);
    }
    const file = `${c.id}-${i + 1}.mp3`;
    const cap = Math.max(0.3, c.max);
    const fadeOut = Math.min(0.25, cap / 4);
    // Trim leading silence, cap the length, fade the tail, level it.
    const filter = `silenceremove=start_periods=1:start_threshold=-45dB,atrim=0:${cap},afade=t=in:d=0.005,`
      + `afade=t=out:st=${Math.max(0, cap - fadeOut)}:d=${fadeOut},loudnorm=I=-18:TP=-2:LRA=11`;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-af', filter, '-ar', '44100', '-b:a', '160k', join(outDir, file)]);
    takes.push({ file, title: x.title, author: x.author, page: x.page, seconds: x.seconds });
    console.log('made', file, x.title);
  }
  manifest.push({ id: c.id, label: c.label, takes });
}
writeFileSync(join(outDir, 'takes.json'), JSON.stringify(manifest, null, 1));
console.log('done', manifest.reduce((n, c) => n + c.takes.length, 0), 'takes');
