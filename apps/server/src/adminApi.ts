// Admin API for the question library (ADR 0010). Every route here runs only after the session check in http.ts.
//   GET    /api/admin/questions              list, with filters (see filterFrom)
//   POST   /api/admin/questions              create
//   GET    /api/admin/questions/coverage     live counts per age band × category and × difficulty
//   GET    /api/admin/questions/export       everything except "house" questions, as JSON
//   POST   /api/admin/questions/import       { questions: [...] }, each validated
//   POST   /api/admin/questions/status       { ids: [...], status }
//   GET    /api/admin/questions/:id
//   PUT    /api/admin/questions/:id
//   DELETE /api/admin/questions/:id
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  BAND_IDS, CATEGORIES, FRESHNESS, REGIONS, SEASONS, SOURCES, STATUSES, validateQuestion,
  type QuestionFilter, type QuestionInput,
} from '@smartmouth/protocol';
import type { Db } from './db.ts';
import {
  coverage, createQuestion, deleteQuestion, getQuestion, listQuestions, setStatus, updateQuestion,
} from './questions.ts';

export interface HttpTools {
  json: (res: ServerResponse, status: number, body: unknown) => void;
  readJson: (req: IncomingMessage, maxBytes: number) => Promise<unknown>;
}

const pick = <T extends string>(list: readonly T[], v: string | null): T | undefined =>
  v !== null && (list as readonly string[]).includes(v) ? (v as T) : undefined;

export function filterFrom(sp: URLSearchParams): QuestionFilter {
  const num = (k: string) => { const n = Number(sp.get(k)); return Number.isFinite(n) && sp.get(k) !== null ? n : undefined; };
  const d = num('difficulty');
  return {
    q: sp.get('q')?.trim().slice(0, 100) || undefined,
    band: pick(BAND_IDS, sp.get('band')),
    difficulty: d && d >= 1 && d <= 5 ? Math.round(d) : undefined,
    category: pick(CATEGORIES, sp.get('category')),
    freshness: pick(FRESHNESS, sp.get('freshness')),
    status: pick(STATUSES, sp.get('status')),
    source: pick(SOURCES, sp.get('source')),
    region: pick(REGIONS, sp.get('region')),
    season: pick(SEASONS, sp.get('season')),
    needsCheck: sp.get('needsCheck') === '1',
    sort: pick(['updated', 'created', 'difficulty', 'plays', 'correctness'] as const, sp.get('sort')),
    limit: num('limit'),
    offset: num('offset'),
  };
}

/** Returns false when the route isn't one of these, so the caller can answer 404. */
export async function handleQuestionsApi(
  req: IncomingMessage, res: ServerResponse, url: URL, db: Db, now: number, t: HttpTools,
): Promise<boolean> {
  const path = url.pathname;
  const method = req.method ?? 'GET';
  if (!path.startsWith('/api/admin/questions')) return false;
  const isJson = String(req.headers['content-type'] ?? '').startsWith('application/json');
  const body = async (max = 16_384) => {
    if (!isJson) throw new BadRequest('Send JSON.');
    try { return await t.readJson(req, max); } catch { throw new BadRequest('That request body isn\'t valid JSON (or is too big).'); }
  };

  try {
    if (path === '/api/admin/questions' && method === 'GET') {
      t.json(res, 200, listQuestions(db, filterFrom(url.searchParams), now));
      return true;
    }
    if (path === '/api/admin/questions' && method === 'POST') {
      const v = validateQuestion(await body());
      if (!v.ok) { t.json(res, 422, { errors: v.errors, warnings: v.warnings }); return true; }
      t.json(res, 201, { question: createQuestion(db, v.value, now), warnings: v.warnings });
      return true;
    }
    if (path === '/api/admin/questions/coverage' && method === 'GET') {
      t.json(res, 200, coverage(db, now));
      return true;
    }
    if (path === '/api/admin/questions/export' && method === 'GET') {
      // "House" questions are about the family; they stay in the database and its backup (ADR 0016).
      const all = listQuestions(db, { limit: 200, offset: 0 }, now);
      const items = [...all.items];
      for (let off = 200; off < all.total; off += 200) items.push(...listQuestions(db, { limit: 200, offset: off }, now).items);
      const out = items.filter((q) => q.region !== 'house').map(({ id, createdAt, updatedAt, stats, playsAs, needsCheck, ...rest }) => rest);
      t.json(res, 200, { exportedAt: new Date(now).toISOString(), questions: out });
      return true;
    }
    if (path === '/api/admin/questions/import' && method === 'POST') {
      const b = (await body(2_000_000)) as { questions?: unknown } | unknown[];
      const list = Array.isArray(b) ? b : Array.isArray((b as { questions?: unknown }).questions) ? (b as { questions: unknown[] }).questions : null;
      if (!list) throw new BadRequest('Send { "questions": [...] }.');
      if (list.length > 2000) throw new BadRequest('At most 2000 questions per import.');
      const good: QuestionInput[] = [];
      const errors: Array<{ index: number; errors: Record<string, string> }> = [];
      list.forEach((raw, index) => {
        const v = validateQuestion(raw);
        // Imports land in review unless the file says draft: nothing goes live without a look (ADR 0011).
        if (v.ok) good.push({ ...v.value, status: v.value.status === 'draft' ? 'draft' : 'review' });
        else errors.push({ index, errors: v.errors as Record<string, string> });
      });
      db.exec('BEGIN');
      try { for (const q of good) createQuestion(db, q, now); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
      t.json(res, 200, { added: good.length, errors });
      return true;
    }
    if (path === '/api/admin/questions/status' && method === 'POST') {
      const b = (await body()) as { ids?: unknown; status?: unknown };
      const status = pick(STATUSES, typeof b.status === 'string' ? b.status : null);
      const ids = Array.isArray(b.ids) ? b.ids.filter((x): x is number => Number.isInteger(x)).slice(0, 1000) : [];
      if (!status || !ids.length) throw new BadRequest('Send ids and a status.');
      t.json(res, 200, { changed: setStatus(db, ids, status, now) });
      return true;
    }
    const m = /^\/api\/admin\/questions\/(\d+)$/.exec(path);
    if (m) {
      const id = Number(m[1]);
      if (method === 'GET') {
        const q = getQuestion(db, id, now);
        if (q) t.json(res, 200, { question: q }); else t.json(res, 404, { error: 'No such question.' });
        return true;
      }
      if (method === 'PUT') {
        const v = validateQuestion(await body());
        if (!v.ok) { t.json(res, 422, { errors: v.errors, warnings: v.warnings }); return true; }
        const q = updateQuestion(db, id, v.value, now);
        if (q) t.json(res, 200, { question: q, warnings: v.warnings }); else t.json(res, 404, { error: 'No such question.' });
        return true;
      }
      if (method === 'DELETE') {
        if (deleteQuestion(db, id)) t.json(res, 200, { deleted: id }); else t.json(res, 404, { error: 'No such question.' });
        return true;
      }
    }
    return false;
  } catch (e) {
    if (e instanceof BadRequest) { t.json(res, 400, { error: e.message }); return true; }
    throw e;
  }
}

class BadRequest extends Error {}
