// HTTP: the built web app, a health check, and the WebSocket upgrade at /ws (ADR 0015).
import { createServer, type Server } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, isAbsolute, join, normalize, relative, resolve } from 'node:path';
import { WebSocketServer } from 'ws';
import { APP_NAME } from '@smartmouth/protocol';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { RoomStore } from './rooms.ts';
import { attachSockets } from './ws.ts';
import { AdminAuth, COOKIE, readCookie, sessionCookie } from './admin.ts';
import { clientAddress, fromHomeNetwork, trustedProxies } from './limits.ts';
import { openDb, type Db } from './db.ts';
import { handleQuestionsApi } from './adminApi.ts';
import { handleGeneratorApi } from './generatorApi.ts';
import { handleImagesApi } from './imagesApi.ts';
import type { Chat } from './ai.ts';
import { securityHeaders } from './headers.ts';
import type { Generator } from './generator.ts';
import type { VoiceRunner } from './voiceRunner.ts';
import type { BotMinds } from './botMinds.ts';
import type { VoiceBank } from './voice.ts';

export interface ServerConfig {
  port: number;
  publicUrl: string | null;
  allowedOrigins: string[];
  /** The built web app (apps/web/dist). Missing in development, where Vite serves it. */
  webDir: string;
  /** ADMIN_PASSWORD. Without it the admin area stays locked. */
  adminPassword?: string | null;
  /** TRUSTED_PROXIES: exact addresses allowed to vouch for the client's address (the tunnel). */
  trustedProxies?: string[];
  /** The SQLite file (ADR 0010). Tests use ':memory:', the default. */
  dbPath?: string;
  /** Runs once the database is open, before the server listens (main.ts imports the seed questions here). */
  onDb?: (db: Db) => void;
  /** Salty's line bank and recordings (voice.ts). */
  voice?: VoiceBank | null;
  /** Thinking house bots (botMinds.ts); null keeps the simple rules. */
  minds?: BotMinds | null;
  /** The question generator, made once the database is open (generator.ts). */
  makeGenerator?: (db: Db) => Generator | null;
  /** Records Salty reading new questions (voiceRunner.ts). */
  voiceRunner?: VoiceRunner | null;
  /** Where recordings and pictures live (DATA_DIR/media), served at /media. */
  mediaDir?: string | null;
  /** OpenRouter, for the admin's "Find pictures for me" (imagePlanner.ts); null hides it. */
  chat?: Chat | null;
  now?: () => number;
}

/** Files in media/sounds/game named `<cue>.<version>.mp3`; for each cue, the newest version wins. */
export async function gameSounds(mediaDir: string): Promise<Record<string, string>> {
  const out: Record<string, { url: string; mtime: number }> = {};
  let names: string[] = [];
  try { names = await readdir(join(mediaDir, 'sounds', 'game')); } catch { return {}; }
  for (const name of names) {
    const m = /^([a-z0-9-]+)\.[a-z0-9]+\.mp3$/.exec(name);
    if (!m) continue;
    const cue = m[1] as string;
    const mtime = (await stat(join(mediaDir, 'sounds', 'game', name))).mtimeMs;
    if (!out[cue] || mtime > (out[cue]?.mtime ?? 0)) out[cue] = { url: `/media/sounds/game/${name}`, mtime };
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.url]));
}

function json(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

/** Reads a JSON body; anything over `maxBytes` or not JSON is refused. */
function readJson(req: IncomingMessage, maxBytes = 2048): Promise<unknown> {
  return new Promise((ok, bad) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > maxBytes) { bad(new Error('too big')); req.destroy(); } else chunks.push(c);
    });
    req.on('end', () => { try { ok(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { bad(e); } });
    req.on('error', bad);
  });
}


/** Behind the tunnel the app sees plain HTTP; Cloudflare says the original scheme in X-Forwarded-Proto. */
function isHttps(req: IncomingMessage): boolean {
  return req.headers['x-forwarded-proto'] === 'https';
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
};

/** Routes the single-page app answers. */
const APP_ROUTES = new Set(['/', '/host', '/play', '/admin']);

export function startServer(cfg: ServerConfig): Promise<{ server: Server; store: RoomStore; db: Db; close: () => Promise<void> }> {
  const store = new RoomStore();
  const db = openDb(cfg.dbPath ?? ':memory:');
  cfg.onDb?.(db);
  const generator = cfg.makeGenerator?.(db) ?? null;
  const webRoot = resolve(cfg.webDir);
  const now = cfg.now ?? Date.now;
  const admin = new AdminAuth(cfg.adminPassword);
  const trusted = trustedProxies(cfg.trustedProxies ?? []);
  const clientIp = (req: IncomingMessage) => clientAddress(req.headers, req.socket.remoteAddress, trusted);

  // Any unexpected error answers 500 instead of leaving a rejected promise behind.
  const server = createServer((req, res) => {
    handle(req, res).catch((e: unknown) => {
      console.error('request failed:', e instanceof Error ? e.message : e);
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
      res.end();
    });
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://x');
    for (const [k, v] of Object.entries(securityHeaders(url.pathname, isHttps(req)))) res.setHeader(k, v);
    if (url.pathname === '/api/health') {
      json(res, 200, { ok: true, app: APP_NAME, rooms: store.rooms.size });
      return;
    }

    // The game's picked sounds and music (tools/sounds): cue -> URL, newest file per cue. Not cached, so a new pick
    // shows up at once; the files themselves are versioned by name, so Cloudflare's long cache stays safe.
    if (url.pathname === '/api/sounds') {
      json(res, 200, { sounds: cfg.mediaDir ? await gameSounds(cfg.mediaDir) : {} });
      return;
    }

    // ---- admin area (ADR 0015) ----
    if (url.pathname.startsWith('/api/admin/')) {
      const token = readCookie(req.headers.cookie, COOKIE);
      const route = `${req.method} ${url.pathname}`;
      if (route === 'GET /api/admin/me') {
        json(res, 200, { enabled: admin.enabled, signedIn: admin.check(token, now()) });
        return;
      }
      if (route === 'POST /api/admin/login') {
        if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) { json(res, 415, { error: 'Send JSON.' }); return; }
        let body: unknown;
        try { body = await readJson(req); } catch { json(res, 400, { error: 'Bad request.' }); return; }
        const r = admin.login((body as { password?: unknown } | null)?.password, clientIp(req), now(),
          fromHomeNetwork(req.headers, req.socket.remoteAddress));
        if (r.ok) { json(res, 200, { signedIn: true }, { 'set-cookie': sessionCookie(r.token, isHttps(req)) }); return; }
        const status = r.code === 'rate' ? 429 : r.code === 'off' ? 503 : 401;
        const error = r.code === 'rate' ? 'Too many wrong tries. Wait 15 minutes.'
          : r.code === 'off' ? 'No admin password is set on the server (ADMIN_PASSWORD).' : 'Wrong password.';
        json(res, status, { error });
        return;
      }
      if (route === 'POST /api/admin/logout') {
        admin.logout(token);
        json(res, 200, { signedIn: false }, { 'set-cookie': sessionCookie('', isHttps(req), 0) });
        return;
      }
      // Every other admin route needs a session.
      if (!admin.check(token, now())) { json(res, 401, { error: 'Sign in first.' }); return; }
      if (await handleQuestionsApi(req, res, url, db, now(), { json, readJson })) return;
      if (await handleGeneratorApi(req, res, url, generator, cfg.voiceRunner ?? null, { json, readJson })) return;
      if (await handleImagesApi(req, res, url, db, cfg.mediaDir ?? null, cfg.chat ?? null, now(), { json, readJson })) return;
      json(res, 404, { error: 'Not found.' });
      return;
    }
    // Recordings and pictures from the data folder (ADR 0013). Paths must stay inside the media folder.
    if (url.pathname.startsWith('/media/') && cfg.mediaDir) {
      const root = resolve(cfg.mediaDir);
      let rel: string;
      try { rel = decodeURIComponent(url.pathname.slice('/media/'.length)); } catch { res.writeHead(400).end(); return; }
      const file = normalize(join(root, rel));
      const inside = relative(root, file);
      if (!inside || inside.startsWith('..') || isAbsolute(inside) || rel.includes(String.fromCharCode(0))) { res.writeHead(400).end(); return; }
      // Data files are never served from here, even if one lands in the folder.
      if (extname(file).toLowerCase() === '.json') { res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found'); return; }
      try {
        const st = await stat(file);
        if (!st.isFile()) throw new Error('not a file');
        res.writeHead(200, {
          'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'content-length': st.size,
          // Recordings never change (their names come from their content); pages like the audition do.
          'cache-control': ['.mp3', '.wav'].includes(extname(file)) ? 'public, max-age=31536000, immutable' : 'no-cache',
          'x-content-type-options': 'nosniff',
        });
        res.end(await readFile(file));
      } catch {
        res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
      }
      return;
    }
    // Static files. Paths are resolved and must stay inside webRoot.
    const path = APP_ROUTES.has(url.pathname) ? '/index.html' : url.pathname;
    const file = normalize(join(webRoot, decodeURIComponent(path)));
    if (!file.startsWith(webRoot)) { res.writeHead(400).end(); return; }
    try {
      const st = await stat(file);
      if (!st.isFile()) throw new Error('not a file');
      const body = await readFile(file);
      const immutable = file.includes(`${join('assets', '')}`);
      res.writeHead(200, {
        'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
        'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    }
  }

  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
  const sockets = attachSockets(wss, store, {
    publicUrl: cfg.publicUrl,
    trusted,
    db,
    voice: cfg.voice ?? null,
    minds: cfg.minds ?? null,
    allowedOrigins: new Set([...(cfg.publicUrl ? [new URL(cfg.publicUrl).origin] : []), ...cfg.allowedOrigins]),
  });
  server.on('upgrade', (req, socket, head) => {
    if (new URL(req.url ?? '/', 'http://x').pathname !== '/ws') { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  const sweeper = setInterval(() => { sockets.sweep(); admin.prune(now()); }, 60_000);
  const chatter = setInterval(() => sockets.lobbyChatter(), 5_000);
  sweeper.unref();

  return new Promise((ok) => {
    server.listen(cfg.port, () => ok({
      server, store, db,
      close: () => new Promise<void>((done) => {
        clearInterval(sweeper);
        clearInterval(chatter);
        sockets.stop();
        for (const c of wss.clients) c.terminate();
        wss.close();
        server.close(() => { db.close(); done(); });
      }),
    }));
  });
}
