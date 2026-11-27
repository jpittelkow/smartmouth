// The question generator (ADR 0011, owner's ask 2026-11-27): "make a group of kids questions based on Paw Patrol".
// A job runs in the background:
//   1. research + write: the writer model searches the web for the topic and writes questions per age band (JSON);
//   2. check: a second model, from another family, answers each one blind and judges its clarity and age fit;
//   3. de-duplicate against the library;
//   4. save: questions the checker agrees with go live when "publish" is on (the owner's choice); the rest go to review
//      with the checker's note. Then Salty records the new ones (VoiceRunner).
import {
  BANDS, CATEGORIES, bandRank, spiceAllows, spiceCap, validateQuestion,
  type Band, type QuestionInput, type Spice,
} from '@smartmouth/protocol';
import { parseJsonObject, type Chat } from './ai.ts';
import type { Db } from './db.ts';
import { createQuestion } from './questions.ts';

export interface GenerateRequest {
  topic: string;
  bands: Band[];
  /** Questions per band. */
  perBand: number;
  spice: Spice;
  /** Put checked questions straight into games (else everything waits in review). */
  publish: boolean;
}

export interface JobResult { id: number; prompt: string; ageMin: Band; status: 'live' | 'review'; note: string }

export interface Job {
  id: string;
  request: GenerateRequest;
  state: 'running' | 'done' | 'failed';
  startedAt: number;
  finishedAt: number | null;
  log: string[];
  results: JobResult[];
  skipped: Array<{ prompt: string; reason: string }>;
  sources: Array<{ url: string; title: string }>;
  cost: number;
  error: string | null;
}

export interface GeneratorConfig {
  chat: Chat | null;
  writerModel: string;
  checkerModel: string;
  /** Dollars one job may spend. */
  budget: number;
  /** Called with the new live questions' ids, so Salty can record them. */
  onPublished?: (ids: number[]) => void;
}

export const DEFAULT_WRITER = 'anthropic/claude-sonnet-5.5';
export const DEFAULT_CHECKER = 'openai/gpt-5.6-terra';
export const MAX_PER_BAND = 15;

const BAND_RULES: Record<Band, string> = {
  little: 'Ages 3-5, cannot read. kind "picture", 2 or 3 answers, each answer one or two simple words a small child would '
    + 'recognise as a picture (a character, an animal, a colour, a thing). The host reads the question aloud: keep it '
    + 'under 12 words, e.g. "Which pup drives the fire truck?". difficulty 1-2.',
  kids: 'Ages 6-8, early readers. kind "choice" with 3 short answers, or "truefalse" with answers ["True","False"]. '
    + 'Prompt under 15 words, everyday words. difficulty 1-3.',
  tweens: 'Ages 9-12. kind "choice" with 4 answers (or "truefalse"). Prompt under 25 words. difficulty 2-4.',
  teens: 'Ages 13-17. kind "choice" with 4 answers. Can be clever or specific. difficulty 2-5.',
  grownups: 'Adults. kind "choice" with 4 answers. Deep cuts welcome. difficulty 2-5.',
};

const QUESTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['band', 'prompt', 'kind', 'answers', 'correct', 'explain', 'difficulty', 'category', 'tags', 'dated'],
        properties: {
          band: { type: 'string', enum: BANDS.map((b) => b.id) },
          prompt: { type: 'string' },
          kind: { type: 'string', enum: ['choice', 'truefalse', 'picture'] },
          answers: { type: 'array', items: { type: 'string' } },
          correct: { type: 'integer' },
          explain: { type: 'string' },
          difficulty: { type: 'integer' },
          category: { type: 'string', enum: CATEGORIES.filter((c) => c !== 'House') },
          tags: { type: 'array', items: { type: 'string' } },
          dated: { type: 'boolean' },
        },
      },
    },
  },
};

const CHECK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['checks'],
  properties: {
    checks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['n', 'answer', 'confidence', 'clear', 'ageFit', 'issue'],
        properties: {
          n: { type: 'integer' },
          answer: { type: 'integer' },
          confidence: { type: 'number' },
          clear: { type: 'boolean' },
          ageFit: { type: 'boolean' },
          issue: { type: 'string' },
        },
      },
    },
  },
};

interface Draft {
  band: Band; prompt: string; kind: string; answers: string[]; correct: number; explain: string;
  difficulty: number; category: string; tags: string[]; dated: boolean;
}

/** Web search leaves citations in the text ("[site](url)", bare links, [1]); Salty would read them out. */
export function clean(s: string): string {
  return String(s ?? '')
    .replace(/\(?\[([^\]]*)\]\((https?:[^)]*)\)\)?/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\[\d+\]/g, '')
    .replace(/\s+([.,!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2));

/** Near-identical prompts (most of the same words) count as duplicates. */
export function isDuplicate(prompt: string, existing: Array<Set<string>>): boolean {
  const a = words(prompt);
  if (!a.size) return false;
  return existing.some((b) => {
    let both = 0;
    for (const w of a) if (b.has(w)) both++;
    return both / (a.size + b.size - both) >= 0.75;
  });
}

export function checkRequest(raw: unknown): { ok: true; value: GenerateRequest } | { ok: false; error: string } {
  const x = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const topic = typeof x.topic === 'string' ? x.topic.trim().replace(/\s+/g, ' ').slice(0, 300) : '';
  if (topic.length < 2) return { ok: false, error: 'Say what the questions should be about.' };
  const ids = BANDS.map((b) => b.id) as string[];
  const bands = Array.isArray(x.bands) ? [...new Set(x.bands.filter((b): b is Band => typeof b === 'string' && ids.includes(b)))].sort((a, b) => bandRank(a) - bandRank(b)) : [];
  if (!bands.length) return { ok: false, error: 'Pick at least one age.' };
  const perBand = Math.round(Number(x.perBand ?? 5));
  if (!(perBand >= 1 && perBand <= MAX_PER_BAND)) return { ok: false, error: `Ask for 1 to ${MAX_PER_BAND} per age.` };
  const spice = (['mild', 'spicy', 'hot', 'filthy'] as const).find((s) => s === x.spice) ?? 'mild';
  return { ok: true, value: { topic, bands, perBand, spice, publish: x.publish !== false } };
}

export class Generator {
  jobs: Job[] = [];
  private seq = 0;
  private db: Db;
  private cfg: GeneratorConfig;
  private now: () => number;
  constructor(db: Db, cfg: GeneratorConfig, now: () => number = Date.now) {
    this.db = db; this.cfg = cfg; this.now = now;
  }

  get enabled(): boolean { return !!this.cfg.chat; }
  get models() { return { writer: this.cfg.writerModel, checker: this.cfg.checkerModel, budget: this.cfg.budget }; }

  /** Starts a job and returns it at once; `done` resolves when it finishes (tests wait on it). */
  start(request: GenerateRequest): { job: Job; done: Promise<void> } {
    if (this.jobs.some((j) => j.state === 'running')) throw new Error('A batch is already being written. Wait for it to finish.');
    const job: Job = {
      id: `${this.now().toString(36)}-${++this.seq}`, request, state: 'running', startedAt: this.now(), finishedAt: null,
      log: [], results: [], skipped: [], sources: [], cost: 0, error: null,
    };
    this.jobs = [job, ...this.jobs].slice(0, 20);
    const done = this.run(job).catch((e: unknown) => {
      job.state = 'failed';
      job.error = e instanceof Error ? e.message : String(e);
      job.log.push(`Failed: ${job.error}`);
    }).finally(() => { job.finishedAt = this.now(); });
    return { job, done };
  }

  private async run(job: Job): Promise<void> {
    const chat = this.cfg.chat;
    if (!chat) throw new Error('No OpenRouter key on the server (OPENROUTER_API_KEY).');
    const { topic, bands, perBand, spice, publish } = job.request;
    const today = new Date(this.now()).toISOString().slice(0, 10);

    // 1. Research and write.
    job.log.push(`Researching "${topic}" and writing ${perBand} question${perBand === 1 ? '' : 's'} for ${bands.map(label).join(', ')}…`);
    const written = await chat({
      model: this.cfg.writerModel,
      web: true,
      schema: { name: 'questions', schema: QUESTION_SCHEMA },
      messages: [
        { role: 'system', content: writerSystem(today, spice) },
        { role: 'user', content: `Topic: ${topic}\n\nWrite exactly ${perBand} questions for each of these age bands:\n`
          + bands.map((b) => `- ${b}: ${BAND_RULES[b]}`).join('\n')
          + '\n\nSearch the web first so every fact is right and current. Spread the questions over different facts; no two may '
          + 'have the same answer. Return JSON only.' },
      ],
    });
    job.cost += written.cost;
    job.sources = written.sources.slice(0, 12);
    const drafts = ((parseJsonObject(written.text) as { questions?: Draft[] }).questions ?? []).filter((d) => bands.includes(d.band));
    job.log.push(`Wrote ${drafts.length}. ${written.sources.length ? `Read ${written.sources.length} web page${written.sources.length === 1 ? '' : 's'}.` : 'No web pages cited.'}`);
    if (!drafts.length) throw new Error('The writer returned no questions.');
    if (job.cost > this.cfg.budget) throw new Error(`Stopped at the budget ($${this.cfg.budget}).`);

    // 2. Check: answered blind by a different model.
    job.log.push('Checking every answer with a second AI…');
    const checked = await chat({
      model: this.cfg.checkerModel,
      schema: { name: 'checks', schema: CHECK_SCHEMA },
      messages: [
        { role: 'system', content: 'You fact-check trivia questions for a family party game. For each numbered question, choose the '
          + 'correct answer yourself (0-based index into its answers), say how sure you are (0 to 1), whether the question is '
          + 'clear and has exactly one right answer, and whether it suits the stated age band. "issue" is one short sentence '
          + 'when something is wrong, else "". Return JSON only.' },
        { role: 'user', content: drafts.map((d, n) => `${n}. [${d.band}: ${BAND_AGES[d.band]}] ${d.prompt}\n`
          + d.answers.map((a, i) => `   ${i}: ${a}`).join('\n')).join('\n') },
      ],
    });
    job.cost += checked.cost;
    const checks = new Map(((parseJsonObject(checked.text) as { checks?: Array<{ n: number; answer: number; confidence: number; clear: boolean; ageFit: boolean; issue: string }> }).checks ?? [])
      .map((c) => [c.n, c]));

    // 3 + 4. De-duplicate and save.
    const existing = (this.db.prepare('SELECT prompt FROM questions').all() as Array<{ prompt: string }>).map((r) => words(r.prompt));
    const ids: number[] = [];
    drafts.forEach((d, n) => {
      if (isDuplicate(d.prompt, existing)) { job.skipped.push({ prompt: d.prompt, reason: 'Already in the library.' }); return; }
      const c = checks.get(n);
      const agrees = !!c && c.answer === d.correct && c.confidence >= 0.7 && c.clear && c.ageFit;
      const note = !c ? 'The checker skipped it.'
        : c.answer !== d.correct ? `The checker answered "${d.answers[c.answer] ?? '?'}" instead.${c.issue ? ' ' + c.issue : ''}`
        : !agrees ? (c.issue || `The checker wasn't sure (${Math.round(c.confidence * 100)}%).`) : '';
      const status = publish && agrees ? 'live' : 'review';
      const input = toInput(d, { spice, status, today, topic, model: this.cfg.writerModel, note, sources: written.sources });
      const v = validateQuestion(input);
      if (!v.ok) { job.skipped.push({ prompt: d.prompt, reason: Object.values(v.errors).join(' ') }); return; }
      const q = createQuestion(this.db, v.value, this.now());
      existing.push(words(q.prompt));
      job.results.push({ id: q.id, prompt: q.prompt, ageMin: q.ageMin, status, note });
      if (status === 'live') ids.push(q.id);
    });
    const live = job.results.filter((r) => r.status === 'live').length;
    job.log.push(`Saved ${job.results.length}: ${live} live, ${job.results.length - live} to review${job.skipped.length ? `, ${job.skipped.length} skipped` : ''}. Spent $${job.cost.toFixed(3)}.`);
    job.state = 'done';
    if (ids.length) this.cfg.onPublished?.(ids);
  }
}

const BAND_AGES = Object.fromEntries(BANDS.map((b) => [b.id, `ages ${b.ages}`])) as Record<Band, string>;
const label = (b: Band) => BANDS.find((x) => x.id === b)?.label ?? b;

function writerSystem(today: string, spice: Spice): string {
  return `You write trivia questions for Smartmouth, a living-room party game where small kids and adults play together. `
    + `Today is ${today}. Rules:\n`
    + `- Every fact must be correct; check it on the web. One answer is clearly right; the wrong answers are plausible but clearly wrong.\n`
    + `- "answers" are the options; "correct" is the 0-based index of the right one. Vary where the right answer sits.\n`
    + `- "explain" is one short, fun sentence the host says after the reveal (a fact, not a joke at anyone's expense), under 150 characters.\n`
    + `- Plain text only in every field: no links, citations or markdown (the host reads them aloud).
`
    + `- When the topic is a show, film, book, game, toy or other franchise, name it in EVERY prompt so it makes sense on its own in a mixed game, e.g. "In Paw Patrol, which pup drives the fire truck?" (owner, 2026-11-27).
`
    + `- "category" is the closest of the given list. "tags" are 1-4 lowercase words (include the topic's name).\n`
    + `- "dated" is true when the answer could change over time (records, "latest", "current", counts).\n`
    + `- Tone: ${spice === 'mild' ? 'clean, family friendly' : spice === 'spicy' ? 'cheeky but clean' : 'adult humour allowed for adult bands only'}. `
    + `Questions for kids are always clean and kind.\n`
    + `- Never ask about real private people. Public figures and fictional characters are fine.`;
}

function toInput(d: Draft, o: { spice: Spice; status: 'live' | 'review'; today: string; topic: string; model: string; note: string; sources: Array<{ url: string }> }): QuestionInput {
  const kind = (['choice', 'truefalse', 'picture'] as const).find((k) => k === d.kind) ?? 'choice';
  // A question suits its band and the one above it (a Little question is fine for Kids too).
  const ageMax = BANDS[Math.min(BANDS.length - 1, bandRank(d.band) + 1)]!.id;
  const cap = spiceCap([d.band]);
  return {
    prompt: clean(d.prompt), kind, answers: d.answers.map((text) => ({ text: clean(text), image: null })), correct: d.correct,
    explain: clean(d.explain), ageMin: d.band, ageMax, difficulty: Math.min(5, Math.max(1, Math.round(d.difficulty))),
    category: (CATEGORIES as readonly string[]).includes(d.category) ? d.category as QuestionInput['category'] : 'Weird & Wonderful',
    tags: [...d.tags, 'ai'], freshness: d.dated ? 'dated' : 'evergreen', asOf: d.dated ? o.today : null, expiresAt: null,
    season: null, region: 'global', spice: spiceAllows(cap, o.spice) ? o.spice : cap, status: o.status, source: 'ai',
    sourceRef: [`${o.model}, topic "${o.topic}"`, ...o.sources.slice(0, 4).map((s) => s.url)].join(' · ').slice(0, 500),
    notes: o.note ? `AI check: ${o.note}` : 'AI check: agreed.',
  };
}
