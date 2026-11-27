// Admin API for pictures (owner, 2026-11-27). Runs only after the session check in http.ts.
//   GET  /api/admin/images/search?q=     Commons photos (free licenses only), each with a key
//   GET  /api/admin/images/preview/<key> its small preview, fetched through us (the page's CSP allows only our own images)
//   POST /api/admin/images/commons       { key, alt } → saves that photo with its credit → { image }
//   POST /api/admin/images/upload        { data: "data:image/...;base64,...", alt, credit } → { image }
//   POST /api/admin/images/suggest       { question } → plans, searches, picks → { image, revealImages, answers, log }
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { validateQuestion, type Question } from '@smartmouth/protocol';
import type { Chat } from './ai.ts';
import type { Db } from './db.ts';
import type { HttpTools } from './adminApi.ts';
import { fetchCommons, searchCommons, storeImage, wikimedia, type CommonsCandidate } from './images.ts';
import { picturesFor } from './imagePlanner.ts';

/** Search results, so the browser picks by key and never sends us a URL to fetch. */
const found = new Map<string, { c: CommonsCandidate; at: number }>();
const KEEP_MS = 30 * 60_000;

function remember(c: CommonsCandidate, now: number): string {
  for (const [k, v] of found) if (now - v.at > KEEP_MS) found.delete(k);
  const key = randomBytes(9).toString('base64url');
  found.set(key, { c, at: now });
  return key;
}

/** What a file's first bytes say it is (the extension and the data URL's type aren't trusted). */
function sniff(b: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

export async function handleImagesApi(
  req: IncomingMessage, res: ServerResponse, url: URL, db: Db, mediaDir: string | null, chat: Chat | null, now: number, t: HttpTools,
): Promise<boolean> {
  const path = url.pathname;
  if (!path.startsWith('/api/admin/images/')) return false;
  if (!mediaDir) { t.json(res, 503, { error: 'No media folder on this server.' }); return true; }
  const body = async (max: number) => {
    if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) throw new Error('Send JSON.');
    return (await t.readJson(req, max)) as Record<string, unknown>;
  };
  try {
    if (path === '/api/admin/images/search' && req.method === 'GET') {
      const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
      if (q.length < 2) { t.json(res, 400, { error: 'Type what the picture should show.' }); return true; }
      const results = (await searchCommons(q, 9)).map((c) => ({
        key: remember(c, now), title: c.title, license: c.license, author: c.author, width: c.width, height: c.height, pageUrl: c.pageUrl,
      }));
      t.json(res, 200, { results });
      return true;
    }
    const pm = /^\/api\/admin\/images\/preview\/([\w-]{6,40})$/.exec(path);
    if (pm && req.method === 'GET') {
      const hit = found.get(pm[1]!);
      if (!hit) { t.json(res, 404, { error: 'Search again.' }); return true; }
      const r = await wikimedia(hit.c.preview, fetch, 20_000);
      const type = r.headers.get('content-type') ?? '';
      if (!r.ok || !/^image\/(jpeg|png|webp)$/.test(type)) { t.json(res, 502, { error: 'Preview unavailable.' }); return true; }
      res.writeHead(200, { 'content-type': type, 'cache-control': 'private, max-age=600' });
      res.end(Buffer.from(await r.arrayBuffer()));
      return true;
    }
    if (path === '/api/admin/images/commons' && req.method === 'POST') {
      const b = await body(4096);
      const hit = found.get(String(b.key ?? ''));
      if (!hit) { t.json(res, 404, { error: 'That search has expired. Search again.' }); return true; }
      const image = await fetchCommons(db, mediaDir, hit.c, String(b.alt ?? hit.c.title).slice(0, 200));
      t.json(res, 200, { image });
      return true;
    }
    if (path === '/api/admin/images/upload' && req.method === 'POST') {
      const b = await body(9_000_000);
      const m = /^data:image\/[\w+.-]+;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.data ?? ''));
      if (!m) { t.json(res, 400, { error: 'Send a JPEG, PNG or WebP picture.' }); return true; }
      const bytes = Buffer.from(m[1]!, 'base64');
      const ext = sniff(bytes);
      if (!ext) { t.json(res, 400, { error: 'That isn’t a JPEG, PNG or WebP picture.' }); return true; }
      if (bytes.length > 6_000_000) { t.json(res, 413, { error: 'Keep pictures under 6 MB.' }); return true; }
      const alt = String(b.alt ?? '').slice(0, 200);
      const credit = String(b.credit ?? '').trim().slice(0, 200) || 'Our own photo';
      const image = storeImage(db, mediaDir, { bytes, ext, source: 'upload', title: alt || 'upload', author: '', license: '', pageUrl: '', alt, credit });
      t.json(res, 200, { image });
      return true;
    }
    if (path === '/api/admin/images/suggest' && req.method === 'POST') {
      if (!chat) { t.json(res, 503, { error: 'No OpenRouter key on the server (OPENROUTER_API_KEY).' }); return true; }
      const b = await body(64_000);
      const v = validateQuestion(b.question);
      if (!v.ok) { t.json(res, 422, { error: 'Fill in the question and its answers first.' }); return true; }
      const q = { ...v.value, id: 0 } as unknown as Question;
      const r = await picturesFor(db, mediaDir, chat, q);
      t.json(res, 200, { image: r.image, revealImages: r.revealImages, answers: r.answers, log: r.log, cost: r.cost });
      return true;
    }
    return false;
  } catch (e) {
    t.json(res, 400, { error: e instanceof Error ? e.message : 'That didn’t work.' });
    return true;
  }
}
