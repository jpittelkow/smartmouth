// HTTP: the built web app, a health check, and the WebSocket upgrade at /ws (ADR 0015).
import { createServer, type Server } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { WebSocketServer } from 'ws';
import { APP_NAME } from '@smartmouth/protocol';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { RoomStore } from './rooms.ts';
import { attachSockets } from './ws.ts';
import { AdminAuth, COOKIE, readCookie, sessionCookie } from './admin.ts';

export interface ServerConfig {
  port: number;
  publicUrl: string | null;
  allowedOrigins: string[];
  /** The built web app (apps/web/dist). Missing in development, where Vite serves it. */
  webDir: string;
  /** ADMIN_PASSWORD. Without it the admin area stays locked. */
  adminPassword?: string | null;
  now?: () => number;
}

function json(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

/** Reads a small JSON body; anything over 2 KB or not JSON is refused. */
function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((ok, bad) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > 2048) { bad(new Error('too big')); req.destroy(); } else chunks.push(c);
    });
    req.on('end', () => { try { ok(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { bad(e); } });
    req.on('error', bad);
  });
}

function clientIp(req: IncomingMessage): string {
  const cf = req.headers['cf-connecting-ip'];
  const fwd = req.headers['x-forwarded-for'];
  return (typeof cf === 'string' && cf) || (typeof fwd === 'string' && fwd.split(',')[0]?.trim()) || req.socket.remoteAddress || '?';
}

/** Behind the tunnel the app sees plain HTTP; Cloudflare says the original scheme in X-Forwarded-Proto. */
function isHttps(req: IncomingMessage): boolean {
  return req.headers['x-forwarded-proto'] === 'https';
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json',
  '.mp3': 'audio/mpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
};

/** Routes the single-page app answers. */
const APP_ROUTES = new Set(['/', '/host', '/play', '/admin']);

export function startServer(cfg: ServerConfig): Promise<{ server: Server; store: RoomStore; close: () => Promise<void> }> {
  const store = new RoomStore();
  const webRoot = resolve(cfg.webDir);
  const now = cfg.now ?? Date.now;
  const admin = new AdminAuth(cfg.adminPassword);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/api/health') {
      json(res, 200, { ok: true, app: APP_NAME, rooms: store.rooms.size });
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
        const r = admin.login((body as { password?: unknown } | null)?.password, clientIp(req), now());
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
      // Every other admin route needs a session. None exist yet (milestone 2).
      if (!admin.check(token, now())) { json(res, 401, { error: 'Sign in first.' }); return; }
      json(res, 404, { error: 'Not found.' });
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
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
  const sockets = attachSockets(wss, store, {
    publicUrl: cfg.publicUrl,
    allowedOrigins: new Set([...(cfg.publicUrl ? [new URL(cfg.publicUrl).origin] : []), ...cfg.allowedOrigins]),
  });
  server.on('upgrade', (req, socket, head) => {
    if (new URL(req.url ?? '/', 'http://x').pathname !== '/ws') { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  const sweeper = setInterval(() => { sockets.sweep(); admin.prune(now()); }, 60_000);
  sweeper.unref();

  return new Promise((ok) => {
    server.listen(cfg.port, () => ok({
      server, store,
      close: () => new Promise<void>((done) => {
        clearInterval(sweeper);
        for (const c of wss.clients) c.terminate();
        wss.close();
        server.close(() => done());
      }),
    }));
  });
}
