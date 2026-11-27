// Finds pictures for a question (owner, 2026-11-27), in three steps:
//   1. plan: a text model says what each picture should show (the question's, never giving the answer away; one or two
//      for the reveal; one per answer for a Little picture question), as Commons search terms. A franchise question gets
//      a real-world thing (a fire truck, not the character);
//   2. search Wikimedia Commons (free licenses, landscape, TV-sized);
//   3. a vision model looks at the candidates and picks the best fit, or none. For the question picture it also checks
//      the photo doesn't show the answer.
// Used by the backfill (imageBackfill.ts) and the generator.
import type { ImageRef, Question } from '@smartmouth/protocol';
import type { Chat, ChatPart } from './ai.ts';
import { parseJsonObject } from './ai.ts';
import type { Db } from './db.ts';
import { fetchCommons, searchCommons, type CommonsCandidate } from './images.ts';

export const PLAN_MODEL = 'anthropic/claude-sonnet-5.5';
export const LOOK_MODEL = 'anthropic/claude-sonnet-5.5';

interface Slot { query: string; shows: string }
export interface PicturePlan { question: Slot | null; reveal: Slot[]; answers: Array<Slot | null> }

export async function planPictures(chat: Chat, q: Question): Promise<{ plan: PicturePlan; cost: number }> {
  const little = q.kind === 'picture';
  const right = q.answers[q.correct]?.text ?? '';
  const r = await chat({
    model: PLAN_MODEL,
    messages: [{ role: 'user', content: `You choose photos for a family trivia game on a TV. The photos come from Wikimedia Commons, so describe
real, photographable things as short Commons search terms (2 to 5 words, e.g. "red fire truck", "Mount Everest summit").

QUESTION: ${q.prompt}
ANSWERS: ${q.answers.map((a, i) => `${i === q.correct ? '(right) ' : ''}${a.text}`).join(' | ')}
FUN FACT SHOWN AT THE REVEAL: ${q.explain || '(none)'}
AGE: ${q.ageMin}${little ? ' (a 3 to 5 year old picks between picture cards)' : ''}

Plan:
- "question": one photo shown WITH the question. It must NOT show or hint at the right answer ("${right}"): show the topic
  or setting instead. Use null if any photo would give it away.
- "reveal": one or two photos shown at the reveal with the fun fact. These may show the answer.
${little ? '- "answers": one photo per answer, in order, each clearly showing that answer so a small child can recognise it.\n' : ''}- Never a cartoon, TV, film or game character or logo (they're owned): show the real-world thing instead (a Dalmatian dog,
  a police car). No real private people.
Return JSON only: {"question": {"query": "...", "shows": "what the photo should show"} | null, "reveal": [{"query": "...", "shows": "..."}]${little ? ', "answers": [{"query": "...", "shows": "..."}]' : ''}}` }],
    maxTokens: 2000,
  });
  const j = parseJsonObject(r.text) as Partial<PicturePlan>;
  const slot = (s: unknown): Slot | null => (s && typeof s === 'object' && typeof (s as Slot).query === 'string' ? { query: (s as Slot).query, shows: String((s as Slot).shows ?? '') } : null);
  return {
    plan: { question: slot(j.question), reveal: (j.reveal ?? []).map(slot).filter((s): s is Slot => !!s).slice(0, 2), answers: little ? (j.answers ?? []).map(slot) : [] },
    cost: r.cost,
  };
}

/** Loads a small preview as a data URL, so the vision model sees exactly what we'd show. */
async function preview(c: CommonsCandidate): Promise<string | null> {
  try {
    const r = await fetch(c.preview, { headers: { 'User-Agent': 'SmartmouthTrivia/0.1 (private family party game)' }, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return null;
    const type = r.headers.get('content-type') ?? 'image/jpeg';
    return `data:${type};base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`;
  } catch { return null; }
}

/** A vision model picks the best candidate for a slot, or none. `mustNotShow` guards the question picture. */
export async function choosePicture(chat: Chat, slot: Slot, candidates: CommonsCandidate[], mustNotShow: string | null): Promise<{ pick: CommonsCandidate | null; cost: number }> {
  const shown: Array<{ c: CommonsCandidate; data: string }> = [];
  for (const c of candidates.slice(0, 6)) { const d = await preview(c); if (d) shown.push({ c, data: d }); }
  if (!shown.length) return { pick: null, cost: 0 };
  const parts: ChatPart[] = [{ type: 'text', text: `Pick the photo that best shows: "${slot.shows}" (searched as "${slot.query}"), for a family trivia game on a TV.
It must be a clear, good-looking photo of that thing, fine for children, with no text that matters, no watermark and no logo.${mustNotShow ? `
It must NOT show or hint at "${mustNotShow}" (it appears before the answer is revealed).` : ''}
If none is good enough, answer -1. Photos follow, numbered from 0.` }];
  shown.forEach((s, i) => { parts.push({ type: 'text', text: `Photo ${i}: ${s.c.title}` }); parts.push({ type: 'image_url', image_url: { url: s.data } }); });
  parts.push({ type: 'text', text: 'Return JSON only: {"pick": <number>, "why": "short reason"}' });
  const r = await chat({ model: LOOK_MODEL, messages: [{ role: 'user', content: parts }], maxTokens: 600 });
  const n = Number((parseJsonObject(r.text) as { pick?: unknown }).pick);
  return { pick: Number.isInteger(n) && n >= 0 && n < shown.length ? shown[n]!.c : null, cost: r.cost };
}

/** Plans, searches, picks and stores pictures for one question; returns what to save on it. */
export async function picturesFor(db: Db, mediaDir: string, chat: Chat, q: Question): Promise<{
  image: ImageRef | null; revealImages: ImageRef[]; answers: Question['answers']; cost: number; log: string[];
}> {
  let cost = 0;
  const log: string[] = [];
  const { plan, cost: c0 } = await planPictures(chat, q);
  cost += c0;
  const right = q.answers[q.correct]?.text ?? null;
  const find = async (slot: Slot | null, guard: string | null, what: string): Promise<ImageRef | null> => {
    if (!slot) return null;
    const cands = await searchCommons(slot.query, 8);
    if (!cands.length) { log.push(`${what}: nothing on Commons for "${slot.query}"`); return null; }
    const { pick, cost: c } = await choosePicture(chat, slot, cands, guard);
    cost += c;
    if (!pick) { log.push(`${what}: no good match for "${slot.query}"`); return null; }
    log.push(`${what}: ${pick.title} (${pick.license})`);
    return fetchCommons(db, mediaDir, pick, slot.shows || slot.query);
  };
  const image = await find(plan.question, right, 'question');
  const revealImages: ImageRef[] = [];
  for (const s of plan.reveal) { const r = await find(s, null, 'reveal'); if (r) revealImages.push(r); }
  const answers = [...q.answers];
  for (let i = 0; i < plan.answers.length && i < answers.length; i++) {
    const r = await find(plan.answers[i] ?? null, null, `answer ${i + 1}`);
    if (r) answers[i] = { ...answers[i]!, image: r.url, credit: r.credit };
  }
  return { image, revealImages, answers, cost, log };
}
