// The question library and how each question is graded (ADR 0010). Shared by the server (which enforces it) and
// the admin page (which shows the same errors before saving).
import { BAND_IDS, bandRank, type Band } from './bands.ts';
import { SPICES, isSpice, spiceAllows, spiceCap, type Spice } from './spice.ts';

export const CATEGORIES = [
  'Animals', 'Nature & Science', 'Space', 'Human Body', 'Geography', 'History', 'Food & Drink', 'Sports',
  'Music', 'Movies & TV', 'Games & Toys', 'Books & Words', 'Math & Numbers', 'Colors & Shapes', 'Art',
  'Technology', 'Holidays', 'Current Events', 'Weird & Wonderful', 'House',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const KINDS = ['choice', 'truefalse', 'picture'] as const;
export type QuestionKind = (typeof KINDS)[number];
export const KIND_LABEL: Record<QuestionKind, string> = { choice: 'Multiple choice', truefalse: 'True or false', picture: 'Pictures (Little seat)' };

/** How long the answer stays true. */
export const FRESHNESS = ['evergreen', 'dated', 'current'] as const;
export type Freshness = (typeof FRESHNESS)[number];
export const FRESHNESS_LABEL: Record<Freshness, string> = {
  evergreen: 'Evergreen: always true',
  dated: 'Dated: true as of a date, may change',
  current: 'Current events: expires',
};

export const STATUSES = ['draft', 'review', 'live', 'retired'] as const;
export type QuestionStatus = (typeof STATUSES)[number];

export const SOURCES = ['seed', 'manual', 'ai', 'news'] as const;
export type QuestionSource = (typeof SOURCES)[number];

/** Who the question makes sense for. "House" questions are about the family and never leave the database. */
export const REGIONS = ['global', 'us', 'local', 'house'] as const;
export type Region = (typeof REGIONS)[number];
export const REGION_LABEL: Record<Region, string> = { global: 'Anywhere', us: 'United States', local: 'Our area', house: 'Our house' };

/** Seasonal questions get picked more near their season and rested the rest of the year. */
export const SEASONS = ['halloween', 'thanksgiving', 'winter-holidays', 'new-year', 'valentines', 'easter', 'summer', 'back-to-school'] as const;
export type Season = (typeof SEASONS)[number];

/** Whether a seasonal question fits today's date (month 1–12, day 1–31). Questions with no season always fit. */
export function inSeason(season: Season | null, date: string): boolean {
  if (!season) return true;
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  switch (season) {
    case 'halloween': return m === 10 || (m === 11 && d <= 2);
    case 'thanksgiving': return m === 11;
    case 'winter-holidays': return m === 12 || (m === 1 && d <= 6);
    case 'new-year': return (m === 12 && d >= 26) || (m === 1 && d <= 15);
    case 'valentines': return m === 2 && d <= 15;
    case 'easter': return m === 3 || m === 4;
    case 'summer': return m >= 6 && m <= 8;
    case 'back-to-school': return (m === 8 && d >= 10) || (m === 9 && d <= 20);
  }
}

/** What each difficulty level means, relative to the youngest age in the question's range. */
export const DIFFICULTY_HELP: Record<number, string> = {
  1: 'Gimme: nearly every player in the range gets it',
  2: 'Easy: most get it',
  3: 'Fair: about half get it',
  4: 'Hard: a few get it',
  5: 'Brutal: only the sharpest in the range',
};

/**
 * A picture the game shows (owner, 2026-11-27): a file on our server (`/media/images/...`) and its credit, shown small on
 * the TV (CC BY photos require it). Free sources only: Wikimedia Commons (public domain, CC0, CC BY, CC BY-SA), our own
 * uploads, or AI illustrations. Never a copied or look-alike picture of a franchise character.
 */
export interface ImageRef { url: string; alt: string; credit: string }

export interface Answer { text: string; image?: string | null; credit?: string }

export interface QuestionInput {
  prompt: string;
  kind: QuestionKind;
  answers: Answer[];
  correct: number;
  /** One line Salty can riff on after the reveal. */
  explain: string;
  ageMin: Band;
  ageMax: Band;
  difficulty: number;
  category: Category;
  tags: string[];
  freshness: Freshness;
  /** Dated: the date the answer was checked. Current: the date of the event. */
  asOf: string | null;
  /** Current events: the last day it may be asked. */
  expiresAt: string | null;
  season: Season | null;
  region: Region;
  spice: Spice;
  status: QuestionStatus;
  source: QuestionSource;
  /** Where it came from: an article URL, a model and prompt id, a book. */
  sourceRef: string;
  /** Grown-ups' notes; never shown in a game. */
  notes: string;
  /** Shown with the question; never gives the answer away. */
  image?: ImageRef | null;
  /** Up to three pictures shown at the reveal, with the fun fact (they may show the answer). */
  revealImages?: ImageRef[];
}

export interface QuestionStats {
  asked: number;
  correct: number;
  avgMs: number | null;
  lastAskedAt: string | null;
  /** Times a grown-up flagged it during a game ("bad question"). */
  flags: number;
}

export interface Question extends QuestionInput {
  id: number;
  seedKey: string | null;
  createdAt: string;
  updatedAt: string;
  stats: QuestionStats;
  /** Difficulty as it actually plays, once it has been asked enough (see measuredDifficulty). */
  playsAs: number | null;
  /** Reasons a grown-up should look at it again (stale, expired, flagged, plays harder or easier than graded). */
  needsCheck: string[];
}

export const PROMPT_MAX = 300;
export const ANSWER_MAX = 80;
export const MIN_PLAYS_TO_MEASURE = 8;
/** A dated answer older than this is due a re-check. */
export const DATED_RECHECK_DAYS = 365;

/** 1–5 from the share of players who got it right, once it has been asked enough. */
export function measuredDifficulty(asked: number, correct: number): number | null {
  if (asked < MIN_PLAYS_TO_MEASURE) return null;
  const p = correct / asked;
  return p > 0.85 ? 1 : p > 0.7 ? 2 : p > 0.5 ? 3 : p > 0.3 ? 4 : 5;
}

/** Why a question needs another look. `today` is YYYY-MM-DD. */
export function checkReasons(q: Pick<Question, 'freshness' | 'asOf' | 'expiresAt' | 'difficulty' | 'stats' | 'status'>, today: string): string[] {
  const why: string[] = [];
  if (q.status === 'retired') return why;
  if (q.freshness === 'current' && q.expiresAt && q.expiresAt < today) why.push('expired');
  if (q.freshness === 'dated' && q.asOf && daysBetween(q.asOf, today) > DATED_RECHECK_DAYS) why.push('answer not checked for over a year');
  if (q.stats.flags > 0) why.push(`flagged ${q.stats.flags}×`);
  const plays = measuredDifficulty(q.stats.asked, q.stats.correct);
  if (plays !== null && Math.abs(plays - q.difficulty) >= 2) why.push(`graded ${q.difficulty}, plays as ${plays}`);
  return why;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (s: unknown): s is string => typeof s === 'string' && DATE.test(s) && !Number.isNaN(Date.parse(s));
const str = (x: unknown, max: number) => (typeof x === 'string' ? x.trim().slice(0, max) : '');
const oneOf = <T extends string>(list: readonly T[], x: unknown): x is T => typeof x === 'string' && (list as readonly string[]).includes(x);

export type Validation =
  | { ok: true; value: QuestionInput; warnings: string[] }
  | { ok: false; errors: Partial<Record<keyof QuestionInput | 'form', string>>; warnings: string[] };

/** Checks and normalises a question from the admin page, an import file or the AI pipeline. */
/** A picture reference from outside: only our own media files, with a short alt text and credit. */
function imageRef(v: unknown): ImageRef | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const url = typeof o.url === 'string' ? o.url.trim() : '';
  if (!/^\/media\/images\/[\w.-]+$/.test(url)) return null;
  return { url, alt: str(o.alt, 200), credit: str(o.credit, 200) };
}

export function validateQuestion(raw: unknown): Validation {
  const x = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const errors: Partial<Record<keyof QuestionInput | 'form', string>> = {};
  const warnings: string[] = [];

  const prompt = str(x.prompt, PROMPT_MAX + 1);
  if (prompt.length < 3) errors.prompt = 'Write the question.';
  else if (prompt.length > PROMPT_MAX) errors.prompt = `Keep it under ${PROMPT_MAX} characters.`;

  const kind: QuestionKind = oneOf(KINDS, x.kind) ? x.kind : 'choice';
  const answersIn = Array.isArray(x.answers) ? x.answers : [];
  const answers: Answer[] = answersIn.map((a) => {
    const o = (a && typeof a === 'object' ? a : { text: a }) as Record<string, unknown>;
    const image = typeof o.image === 'string' && o.image.trim() ? o.image.trim().slice(0, 200) : null;
    const credit = typeof o.credit === 'string' && o.credit.trim() ? str(o.credit, 200) : undefined;
    return { text: str(o.text, ANSWER_MAX + 1), image, ...(credit ? { credit } : {}) };
  });
  const [lo, hi] = kind === 'truefalse' ? [2, 2] : kind === 'picture' ? [2, 3] : [2, 4];
  if (answers.length < lo || answers.length > hi) errors.answers = lo === hi ? `Needs exactly ${lo} answers.` : `Needs ${lo} to ${hi} answers.`;
  else if (answers.some((a) => !a.text)) errors.answers = 'Every answer needs text (pictures keep a word for the grown-ups).';
  else if (answers.some((a) => a.text.length > ANSWER_MAX)) errors.answers = `Keep answers under ${ANSWER_MAX} characters.`;
  else if (new Set(answers.map((a) => a.text.toLowerCase())).size !== answers.length) errors.answers = 'Two answers are the same.';

  const correct = typeof x.correct === 'number' && Number.isInteger(x.correct) ? x.correct : -1;
  if (correct < 0 || correct >= answers.length) errors.correct = 'Pick the right answer.';

  const ageMin: Band = oneOf(BAND_IDS, x.ageMin) ? x.ageMin : 'grownups';
  const ageMax: Band = oneOf(BAND_IDS, x.ageMax) ? x.ageMax : ageMin;
  if (!oneOf(BAND_IDS, x.ageMin)) errors.ageMin = 'Pick the youngest age it suits.';
  if (bandRank(ageMax) < bandRank(ageMin)) errors.ageMax = 'The oldest age must be at or above the youngest.';
  if (ageMin === 'little') {
    if (answers.length > 3) errors.answers = 'Little questions have 2 or 3 answers.';
    if (kind !== 'picture') warnings.push('Little players can\'t read yet: a picture question works best.');
  }
  if (kind === 'picture' && answers.some((a) => !a.image)) warnings.push('Picture answers have no pictures yet; it can\'t go live in the Little seat until they do.');

  const difficulty = typeof x.difficulty === 'number' && Number.isInteger(x.difficulty) ? x.difficulty : 0;
  if (difficulty < 1 || difficulty > 5) errors.difficulty = 'Grade it 1 to 5.';

  const category: Category = oneOf(CATEGORIES, x.category) ? x.category : 'Weird & Wonderful';
  if (!oneOf(CATEGORIES, x.category)) errors.category = 'Pick a category.';

  const tagsIn = Array.isArray(x.tags) ? x.tags : typeof x.tags === 'string' ? x.tags.split(',') : [];
  const tags = [...new Set(tagsIn.map((t) => str(t, 24).toLowerCase()).filter(Boolean))].slice(0, 10);

  const freshness: Freshness = oneOf(FRESHNESS, x.freshness) ? x.freshness : 'evergreen';
  const asOf = isDate(x.asOf) ? x.asOf : null;
  const expiresAt = isDate(x.expiresAt) ? x.expiresAt : null;
  if (freshness === 'dated' && !asOf) errors.asOf = 'Dated questions need the date the answer was checked.';
  if (freshness === 'current' && !expiresAt) errors.expiresAt = 'Current-events questions need an expiry date.';
  if (freshness === 'current' && asOf && expiresAt && expiresAt < asOf) errors.expiresAt = 'It expires before it happened.';
  if (freshness === 'current' && bandRank(ageMin) < bandRank('teens')) warnings.push('Current events are planned for Teens and up (ADR 0012).');

  const season: Season | null = oneOf(SEASONS, x.season) ? x.season : null;
  const region: Region = oneOf(REGIONS, x.region) ? x.region : 'global';

  const spice: Spice = isSpice(x.spice) ? x.spice : 'mild';
  if (!spiceAllows(spiceCap([ageMin]), spice)) {
    errors.spice = `Too spicy for its youngest age: ${ageMin === 'little' ? 'Little' : ageMin} rooms are capped at ${spiceCap([ageMin])}.`;
  }

  const status: QuestionStatus = oneOf(STATUSES, x.status) ? x.status : 'draft';
  const source: QuestionSource = oneOf(SOURCES, x.source) ? x.source : 'manual';

  const value: QuestionInput = {
    prompt, kind, answers, correct, explain: str(x.explain, 200), ageMin, ageMax, difficulty, category, tags,
    freshness, asOf, expiresAt: freshness === 'current' ? expiresAt : null, season, region, spice, status, source,
    sourceRef: str(x.sourceRef, 500), notes: str(x.notes, 1000),
    image: imageRef(x.image), revealImages: (Array.isArray(x.revealImages) ? x.revealImages : []).map(imageRef).filter((i): i is ImageRef => !!i).slice(0, 3),
  };
  return Object.keys(errors).length ? { ok: false, errors, warnings } : { ok: true, value, warnings };
}

export interface QuestionFilter {
  q?: string;
  band?: Band;
  difficulty?: number;
  category?: Category;
  freshness?: Freshness;
  status?: QuestionStatus;
  source?: QuestionSource;
  region?: Region;
  season?: Season;
  needsCheck?: boolean;
  sort?: 'updated' | 'created' | 'difficulty' | 'plays' | 'correctness';
  limit?: number;
  offset?: number;
}

export interface QuestionPage { total: number; items: Question[] }

export interface Coverage {
  /** Live questions per band (a question counts for every band in its range) and category. */
  byCategory: Record<Band, Partial<Record<Category, number>>>;
  /** Live questions per band and difficulty 1–5. */
  byDifficulty: Record<Band, number[]>;
  totals: Record<QuestionStatus, number>;
  needsCheck: number;
}

export { SPICES };
