// The question library store (ADR 0010). Grading rules live in @smartmouth/protocol so the admin page and the
// server agree; this file only stores, filters and counts.
import {
  BANDS, BAND_IDS, CATEGORIES, SPICES, STATUSES, bandRank, checkReasons, measuredDifficulty, spiceRank,
  type Band, type Category, type Coverage, type Question, type QuestionFilter, type QuestionInput, type QuestionPage,
  type QuestionStatus,
} from '@smartmouth/protocol';
import type { Db } from './db.ts';

type Row = Record<string, unknown>;

const today = (now: number) => new Date(now).toISOString().slice(0, 10);

function toQuestion(r: Row, now: number): Question {
  const stats = {
    asked: Number(r.asked), correct: Number(r.correct_count),
    avgMs: Number(r.asked) > 0 ? Math.round(Number(r.total_ms) / Number(r.asked)) : null,
    lastAskedAt: (r.last_asked_at as string | null) ?? null, flags: Number(r.flags),
  };
  const q: Question = {
    id: Number(r.id), seedKey: (r.seed_key as string | null) ?? null,
    prompt: String(r.prompt), kind: r.kind as Question['kind'], answers: JSON.parse(String(r.answers)),
    correct: Number(r.correct), explain: String(r.explain),
    ageMin: BAND_IDS[Number(r.age_min)] as Band, ageMax: BAND_IDS[Number(r.age_max)] as Band,
    difficulty: Number(r.difficulty), category: r.category as Category, tags: JSON.parse(String(r.tags)),
    freshness: r.freshness as Question['freshness'], asOf: (r.as_of as string | null) ?? null,
    expiresAt: (r.expires_at as string | null) ?? null, season: (r.season as Question['season']) ?? null,
    region: r.region as Question['region'], spice: SPICES[Number(r.spice)] ?? 'mild',
    status: r.status as QuestionStatus, source: r.source as Question['source'], sourceRef: String(r.source_ref),
    notes: String(r.notes), createdAt: String(r.created_at), updatedAt: String(r.updated_at),
    stats, playsAs: measuredDifficulty(stats.asked, stats.correct), needsCheck: [],
  };
  q.needsCheck = checkReasons(q, today(now));
  return q;
}

function params(q: QuestionInput) {
  return {
    prompt: q.prompt, kind: q.kind, answers: JSON.stringify(q.answers), correct: q.correct, explain: q.explain,
    age_min: bandRank(q.ageMin), age_max: bandRank(q.ageMax), difficulty: q.difficulty, category: q.category,
    tags: JSON.stringify(q.tags), freshness: q.freshness, as_of: q.asOf, expires_at: q.expiresAt, season: q.season,
    region: q.region, spice: spiceRank(q.spice), status: q.status, source: q.source, source_ref: q.sourceRef, notes: q.notes,
  };
}

const COLS = 'prompt, kind, answers, correct, explain, age_min, age_max, difficulty, category, tags, freshness, as_of, expires_at, season, region, spice, status, source, source_ref, notes';
const VALS = COLS.split(', ').map((c) => `:${c}`).join(', ');
const SETS = COLS.split(', ').map((c) => `${c} = :${c}`).join(', ');

export function createQuestion(db: Db, q: QuestionInput, now: number, seedKey: string | null = null): Question {
  const at = new Date(now).toISOString();
  const r = db.prepare(`INSERT INTO questions (seed_key, ${COLS}, created_at, updated_at) VALUES (:seed_key, ${VALS}, :at, :at)`)
    .run({ ...params(q), seed_key: seedKey, at });
  return getQuestion(db, Number(r.lastInsertRowid), now) as Question;
}

export function updateQuestion(db: Db, id: number, q: QuestionInput, now: number): Question | null {
  const r = db.prepare(`UPDATE questions SET ${SETS}, updated_at = :at WHERE id = :id`)
    .run({ ...params(q), at: new Date(now).toISOString(), id });
  return r.changes ? getQuestion(db, id, now) : null;
}

export function getQuestion(db: Db, id: number, now: number): Question | null {
  const r = db.prepare('SELECT * FROM questions WHERE id = ?').get(id) as Row | undefined;
  return r ? toQuestion(r, now) : null;
}

export function deleteQuestion(db: Db, id: number): boolean {
  return db.prepare('DELETE FROM questions WHERE id = ?').run(id).changes > 0;
}

export function setStatus(db: Db, ids: number[], status: QuestionStatus, now: number): number {
  const at = new Date(now).toISOString();
  const stmt = db.prepare('UPDATE questions SET status = ?, updated_at = ? WHERE id = ?');
  let n = 0;
  db.exec('BEGIN');
  try {
    for (const id of ids) n += Number(stmt.run(status, at, id).changes);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return n;
}

const SORTS: Record<NonNullable<QuestionFilter['sort']>, string> = {
  updated: 'updated_at DESC, id DESC',
  created: 'created_at DESC, id DESC',
  difficulty: 'difficulty ASC, age_min ASC, id ASC',
  plays: 'asked DESC, id DESC',
  correctness: 'CASE WHEN asked = 0 THEN 2 ELSE 1.0 * correct_count / asked END ASC, id ASC',
};

export function listQuestions(db: Db, f: QuestionFilter, now: number): QuestionPage {
  const where: string[] = [];
  const p: Record<string, string | number> = {};
  if (f.q) {
    where.push("(prompt LIKE :q ESCAPE '\\' OR answers LIKE :q ESCAPE '\\' OR tags LIKE :q ESCAPE '\\' OR notes LIKE :q ESCAPE '\\')");
    p.q = `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  }
  if (f.band) { where.push(':band BETWEEN age_min AND age_max'); p.band = bandRank(f.band); }
  if (f.difficulty) { where.push('difficulty = :difficulty'); p.difficulty = f.difficulty; }
  if (f.category) { where.push('category = :category'); p.category = f.category; }
  if (f.freshness) { where.push('freshness = :freshness'); p.freshness = f.freshness; }
  if (f.status) { where.push('status = :status'); p.status = f.status; }
  if (f.source) { where.push('source = :source'); p.source = f.source; }
  if (f.region) { where.push('region = :region'); p.region = f.region; }
  if (f.season) { where.push('season = :season'); p.season = f.season; }
  const sql = `FROM questions${where.length ? ` WHERE ${where.join(' AND ')}` : ''}`;
  const order = SORTS[f.sort ?? 'updated'] ?? SORTS.updated;
  const limit = Math.min(Math.max(f.limit ?? 50, 1), 200);
  const offset = Math.max(f.offset ?? 0, 0);

  if (f.needsCheck) {
    // Reasons are computed in code (dates, play stats), so filter after reading. The library is thousands of rows at most.
    const all = (db.prepare(`SELECT * ${sql} ORDER BY ${order}`).all(p) as Row[]).map((r) => toQuestion(r, now)).filter((q) => q.needsCheck.length);
    return { total: all.length, items: all.slice(offset, offset + limit) };
  }
  const total = Number((db.prepare(`SELECT COUNT(*) AS n ${sql}`).get(p) as { n: number }).n);
  const items = (db.prepare(`SELECT * ${sql} ORDER BY ${order} LIMIT :limit OFFSET :offset`).all({ ...p, limit, offset }) as Row[])
    .map((r) => toQuestion(r, now));
  return { total, items };
}

export function coverage(db: Db, now: number): Coverage {
  const byCategory = Object.fromEntries(BANDS.map((b) => [b.id, {}])) as Coverage['byCategory'];
  const byDifficulty = Object.fromEntries(BANDS.map((b) => [b.id, [0, 0, 0, 0, 0]])) as Coverage['byDifficulty'];
  const t = today(now);
  const live = db.prepare(`SELECT age_min, age_max, category, difficulty FROM questions
    WHERE status = 'live' AND (expires_at IS NULL OR expires_at >= ?)`).all(t) as Row[];
  for (const r of live) {
    for (let rank = Number(r.age_min); rank <= Number(r.age_max); rank++) {
      const band = BAND_IDS[rank] as Band;
      const cat = r.category as Category;
      byCategory[band][cat] = (byCategory[band][cat] ?? 0) + 1;
      const d = byDifficulty[band];
      d[Number(r.difficulty) - 1] = (d[Number(r.difficulty) - 1] ?? 0) + 1;
    }
  }
  const totals = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Coverage['totals'];
  for (const r of db.prepare('SELECT status, COUNT(*) AS n FROM questions GROUP BY status').all() as Row[]) {
    totals[r.status as QuestionStatus] = Number(r.n);
  }
  const needsCheck = listQuestions(db, { needsCheck: true, limit: 1 }, now).total;
  return { byCategory, byDifficulty, totals, needsCheck };
}

/** Adds seed questions that aren't in the database yet (matched by seed key). Edits made in admin are kept. */
export function importSeeds(db: Db, seeds: Array<{ key: string; question: QuestionInput }>, now: number): number {
  const has = db.prepare('SELECT 1 FROM questions WHERE seed_key = ?');
  let added = 0;
  for (const s of seeds) {
    if (has.get(s.key)) continue;
    createQuestion(db, { ...s.question, source: 'seed' }, now, s.key);
    added++;
  }
  return added;
}

export { CATEGORIES };
