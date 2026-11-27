// Drafts new Salty lines from content/voice/brief.json, the single source for how Salty writes and sounds (owner,
// 2026-11-27: "nice prompts to send to grok for consistent results"). For every moment and spice level below its target:
//   1. the writer (Grok) drafts about 2x the lines still needed, given the persona, the owner's rules, the keepers
//      and the lines already in that cell (so it doesn't repeat them);
//   2. the judge (another model family) scores every draft against the same rules and keeps the best (6/10 or more) to fill the gap.
// Nothing goes into lines.json from here: the drafts go on the review page, and the owner's Keep/Cut/Fix decides.
//
// Runs inside the server's container (the key never leaves it):
//   docker exec smartmouth node tools/voice/draft-lines.mjs                 every cell below target
//   docker exec -e MOMENTS=hello,lobby -e SPICES=filthy smartmouth node tools/voice/draft-lines.mjs
// Writes DATA_DIR/voice/drafts/<moment>-<spice>.json and prints a summary. MAX_USD stops the run (default 2).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const KEY = process.env.OPENROUTER_API_KEY;
const OUT = join(process.env.DATA_DIR || '/data', 'voice', 'drafts');
const WRITER = process.env.WRITER || 'x-ai/grok-4.7';
const JUDGE = process.env.JUDGE || 'anthropic/claude-sonnet-5.5';
const MAX_USD = Number(process.env.MAX_USD || 2);
const MIN_SCORE = Number(process.env.MIN_SCORE || 6);
const pickList = (v) => (v ? v.split(',').map((x) => x.trim()).filter(Boolean) : null);
const ONLY_MOMENTS = pickList(process.env.MOMENTS);
const ONLY_SPICES = pickList(process.env.SPICES);

const brief = JSON.parse(readFileSync(join(repo, 'content', 'voice', 'brief.json'), 'utf8'));
const { lines } = JSON.parse(readFileSync(join(repo, 'content', 'voice', 'lines.json'), 'utf8'));
const keepers = brief.keepers.ids.map((id) => lines.find((l) => l.id === id)).filter(Boolean);

let spent = 0;
async function chat(model, prompt, maxTokens = 8000) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      // Low reasoning effort: with a high one, Grok spent the whole budget thinking and returned nothing (2026-11-27).
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, reasoning: { effort: 'low' }, usage: { include: true }, response_format: { type: 'json_object' } }),
      signal: AbortSignal.timeout(300_000),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      spent += Number(j.usage?.cost ?? 0) || 0;
      const t = j.choices?.[0]?.message?.content ?? '';
      if (!t.includes('{')) throw new Error(`${model} returned no JSON (finish: ${j.choices?.[0]?.finish_reason ?? '?'})`);
      return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
    }
    if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 4000 * (attempt + 1))); continue; }
    throw new Error(`${model}: ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  }
  throw new Error(`${model}: gave up`);
}

/** The shared part of both prompts: everything the brief says about Salty and how lines are written. */
function common(m, spice) {
  return [
    `GAME: ${brief.game}`,
    `HOST: ${brief.persona}`,
    `RULES (from the owner's reviews):\n${brief.rules.map((r) => `- ${r}`).join('\n')}`,
    `SPICE LEVEL "${spice}": ${brief.spice[spice]}`,
    `THE MOMENT "${m.id}" (${m.label}):\n- When it plays: ${m.when}\n- On the TV: ${m.tv}\n- Right after: ${m.after}\n- The line's job: ${m.job}\n- At most ${m.maxWords} words.`,
    `LINES THE OWNER KEPT (the standard to beat; other moments, same voice):\n${keepers.map((k) => `- (${k.moment}, ${k.spice}) ${k.text}`).join('\n')}`,
  ].join('\n\n');
}

mkdirSync(OUT, { recursive: true });
const summary = [];
for (const m of brief.moments) {
  if (ONLY_MOMENTS && !ONLY_MOMENTS.includes(m.id)) continue;
  for (const spice of m.spices) {
    if (ONLY_SPICES && !ONLY_SPICES.includes(spice)) continue;
    const have = lines.filter((l) => l.moment === m.id && l.spice === spice);
    const need = m.target - have.length;
    if (need <= 0) continue;
    if (spent > MAX_USD) { console.error(`stopping at the cap ($${spent.toFixed(2)})`); break; }
    // Resumable: a section already drafted is skipped (FORCE=1 redoes it).
    if (!process.env.FORCE && existsSync(join(OUT, `${m.id}-${spice}.json`))) { console.log(`${m.id}/${spice}: already drafted`); continue; }
    const ask = Math.ceil(need * 2);
    try {
      // 1. Write.
      const drafted = await chat(WRITER, `You write lines for the host of a party game. Read everything, then write.\n\n${common(m, spice)}\n\n`
        + `ALREADY WRITTEN FOR THIS MOMENT AND LEVEL (don't repeat these jokes or their shapes):\n${have.map((l) => `- ${l.text}`).join('\n') || '- (none)'}\n\n`
        + `Write ${ask} NEW, DIFFERENT lines for "${m.id}" at "${spice}". Vary the joke shapes; no two lines with the same setup.\n`
        + 'Return JSON only: {"lines": ["...", "..."]}', 24000);
      const cands = [...new Set((drafted.lines ?? []).map((t) => String(t).trim()).filter(Boolean))];
      // 2. Judge.
      const judged = await chat(JUDGE, `You are the comedy editor for a party game host. Score each candidate line 1 to 10 against the brief below: `
        + `does it make literal sense, fit this exact moment and what comes after it, follow every rule, sit at the right spice level, and is it actually funny `
        + `(an everyday situation with one specific, unexpected twist, punch at the end)? Mark any rule break.\n\n${common(m, spice)}\n\n`
        + `CANDIDATES:\n${cands.map((c, i) => `${i}. ${c}`).join('\n')}\n\n`
        + 'Return JSON only: {"scores": [{"n": 0, "score": 7, "why": "one short reason"}]}', 16000);
      const scores = new Map((judged.scores ?? []).map((x) => [x.n, x]));
      const ranked = cands.map((text, n) => ({ text, score: Number(scores.get(n)?.score ?? 0), why: String(scores.get(n)?.why ?? '') }))
        .sort((a, b) => b.score - a.score);
      // Only lines the judge scored 6 or more: better a section a little short than weak lines on the review page.
      const chosen = ranked.filter((x) => x.score >= MIN_SCORE).slice(0, need);
      writeFileSync(join(OUT, `${m.id}-${spice}.json`), JSON.stringify({ moment: m.id, spice, need, writer: WRITER, judge: JUDGE, chosen, rest: ranked.slice(need) }, null, 1));
      summary.push(`${m.id}/${spice}: drafted ${cands.length}, kept ${chosen.length} (scores ${chosen.at(-1)?.score ?? '-'} to ${chosen[0]?.score ?? '-'})`);
      console.log(summary.at(-1));
    } catch (e) {
      console.error(`${m.id}/${spice}: ${e.message}`);
    }
  }
}
console.log(`\n${summary.length} cells drafted, spent $${spent.toFixed(3)}. Drafts in ${OUT}.`);
