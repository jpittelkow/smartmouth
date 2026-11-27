// Pictures for questions (owner, 2026-11-27). Free sources only:
//   - Wikimedia Commons, filtered to public domain, CC0, CC BY and CC BY-SA, credited on screen;
//   - our own uploads (admin);
//   - AI illustrations (later; only where Commons has nothing).
// Never a copied or look-alike picture of a franchise character: a question about one shows a real-world thing instead.
// Files live in DATA_DIR/media/images/ (served at /media/images/), with their credits in the `images` table; each question
// carries its pictures as {url, alt, credit}.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ImageRef } from '@smartmouth/protocol';
import type { Db } from './db.ts';

/** Wikimedia asks automated clients for a descriptive User-Agent (no personal details here). */
const UA = 'SmartmouthTrivia/0.1 (private family party game; images credited on screen)';

/**
 * Every request to Wikimedia goes through here: one at a time, at least 1.2 s apart, and on 429 (slow down) a wait of
 * 5, 15, then 45 s before trying again (the first run, 2026-11-27, was rate-limited after a few questions).
 */
let lastCall = 0;
let queue: Promise<unknown> = Promise.resolve();
export function wikimedia(url: string, fetchFn: typeof fetch = fetch, timeoutMs = 30_000): Promise<Response> {
  const run = async () => {
    for (let attempt = 0; ; attempt++) {
      const wait = lastCall + 1200 - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastCall = Date.now();
      const r = await fetchFn(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(timeoutMs) });
      if (r.status !== 429 || attempt >= 3) return r;
      await new Promise((ok) => setTimeout(ok, 5000 * 3 ** attempt));
    }
  };
  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  return p;
}

export interface CommonsCandidate {
  title: string;
  /** About 1280 px wide: what we download and show on the TV. */
  url: string;
  /** About 400 px wide: for a vision model to look at. */
  preview: string;
  license: string;
  author: string;
  pageUrl: string;
  description: string;
  width: number;
  height: number;
}

/** Licenses we may show with a credit. No NC (non-commercial) or ND (no derivatives), no fair use. */
export function freeLicense(name: string): boolean {
  const n = name.trim();
  if (/\b(NC|ND)\b|non-?commercial|no derivatives|fair use/i.test(n)) return false;
  return /^(public domain|pd\b|cc0|cc[- ]by(-sa)?[- ]?\d|cc[- ]by(-sa)?$)/i.test(n);
}

const strip = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&#39;/g, "'").replace(/\s+/g, ' ').trim();

/** Commons photos for a search: free licenses only, landscape-ish, big enough for a TV. */
export async function searchCommons(query: string, limit = 8, fetchFn: typeof fetch = fetch): Promise<CommonsCandidate[]> {
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: '6',
    gsrsearch: `${query} filetype:bitmap`, gsrlimit: String(Math.min(30, limit * 3)),
    prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1280',
  });
  const r = await wikimedia(url, fetchFn, 20_000);
  if (!r.ok) throw new Error(`Commons search: ${r.status}`);
  const j = await r.json() as { query?: { pages?: Record<string, { title: string; index?: number; imageinfo?: Array<Record<string, unknown>> }> } };
  const pages = Object.values(j.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const out: CommonsCandidate[] = [];
  for (const p of pages) {
    const i = p.imageinfo?.[0];
    if (!i) continue;
    const meta = (i.extmetadata ?? {}) as Record<string, { value?: string }>;
    const license = strip(meta.LicenseShortName?.value ?? '');
    const mime = String(i.mime ?? '');
    const width = Number(i.width ?? 0), height = Number(i.height ?? 0);
    // Free license, a photo format, big enough, and landscape (the TV and the answer cards are wide).
    if (!freeLicense(license) || !/^image\/(jpeg|png|webp)$/.test(mime) || width < 640 || height < 360 || width < height * 1.15) continue;
    const thumb = String(i.thumburl ?? i.url ?? '');
    out.push({
      title: p.title.replace(/^File:/, '').replace(/\.\w+$/, ''),
      // 330 px is one of Wikimedia's standard (cached) thumbnail widths; odd sizes are rate-limited.
      url: thumb, preview: thumb.replace(/\/\d+px-/, '/330px-'),
      license, author: strip(meta.Artist?.value ?? '').slice(0, 80) || 'Unknown',
      pageUrl: String(i.descriptionurl ?? ''), description: strip(meta.ImageDescription?.value ?? '').slice(0, 300),
      width, height,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** The on-screen credit: "Author · License · Wikimedia Commons" (public domain needs no author, but we show it if known). */
export function creditFor(c: { author: string; license: string }, source = 'Wikimedia Commons'): string {
  const author = c.author && c.author !== 'Unknown' ? `${c.author} · ` : '';
  return `${author}${c.license} · ${source}`.slice(0, 200);
}

/** Saves a picture file and its credit; returns what a question stores. */
export function storeImage(db: Db, mediaDir: string, img: {
  bytes: Buffer; ext: 'jpg' | 'png' | 'webp'; source: 'commons' | 'upload' | 'ai'; title: string; author: string;
  license: string; pageUrl: string; alt: string; width?: number; height?: number; credit: string;
}, now = Date.now()): ImageRef {
  const dir = join(mediaDir, 'images');
  mkdirSync(dir, { recursive: true });
  const slug = img.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'image';
  const row = db.prepare(`INSERT INTO images (file, source, title, author, license, page_url, alt, width, height, created_at)
    VALUES ('', ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(img.source, img.title, img.author, img.license, img.pageUrl, img.alt,
    img.width ?? null, img.height ?? null, new Date(now).toISOString());
  const file = `${row.lastInsertRowid}-${slug}.${img.ext}`;
  writeFileSync(join(dir, file), img.bytes);
  db.prepare('UPDATE images SET file = ? WHERE id = ?').run(file, row.lastInsertRowid);
  return { url: `/media/images/${file}`, alt: img.alt.slice(0, 200), credit: img.credit };
}

/** Downloads a Commons candidate at TV size and stores it. */
export async function fetchCommons(db: Db, mediaDir: string, c: CommonsCandidate, alt: string, fetchFn: typeof fetch = fetch): Promise<ImageRef> {
  const r = await wikimedia(c.url, fetchFn);
  if (!r.ok) throw new Error(`Commons download: ${r.status}`);
  const type = r.headers.get('content-type') ?? '';
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
  return storeImage(db, mediaDir, {
    bytes: Buffer.from(await r.arrayBuffer()), ext, source: 'commons', title: c.title, author: c.author, license: c.license,
    pageUrl: c.pageUrl, alt, width: c.width, height: c.height, credit: creditFor(c),
  });
}
