// How many lines Salty has for every moment and spice level, against the targets in content/voice/brief.json.
//   node tools/voice/coverage.mjs            the table
//   node tools/voice/coverage.mjs --short    only the cells below target
// A moment's lines count at their own spice level (a Mild line can also play in a Filthy room, but each level gets
// its own target so every room has variety at its exact level).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const brief = JSON.parse(readFileSync(join(repo, 'content', 'voice', 'brief.json'), 'utf8'));
const { lines } = JSON.parse(readFileSync(join(repo, 'content', 'voice', 'lines.json'), 'utf8'));
const SPICES = ['mild', 'spicy', 'hot', 'filthy', 'drunk'];
const short = process.argv.includes('--short');

const count = {};
for (const l of lines) ((count[l.moment] ??= {})[l.spice] = (count[l.moment]?.[l.spice] ?? 0) + 1);

const rows = [];
let need = 0;
for (const m of brief.moments) {
  const cells = SPICES.map((s) => {
    if (!m.spices.includes(s)) return '   ·  ';
    const n = count[m.id]?.[s] ?? 0;
    need += Math.max(0, m.target - n);
    return `${String(n).padStart(3)}/${m.target}`.padEnd(6);
  });
  const low = m.spices.some((s) => (count[m.id]?.[s] ?? 0) < m.target);
  if (!short || low) rows.push(`${m.id.padEnd(13)} ${m.game.padEnd(9)} ${cells.join(' ')}`);
}
console.log(`${'moment'.padEnd(13)} ${'game'.padEnd(9)} ${SPICES.map((s) => s.padEnd(6)).join(' ')}`);
console.log(rows.join('\n'));
console.log(`\n${need} lines short of the targets.`);
const others = Object.keys(count).filter((id) => !brief.moments.some((m) => m.id === id));
if (others.length) console.log(`Not in the brief yet (no target): ${others.join(', ')}`);
console.log(`Voice: ${brief.voice.spec} (${brief.voice.slot}).`);
