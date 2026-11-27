// HTTP: the built web app, a health check, and the WebSocket upgrade at /ws (ADR 0015).
import { createServer, type Server } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { WebSocketServer } from 'ws';
import { APP_NAME } from '@smartmouth/protocol';
import { RoomStore } from './rooms.ts';
import { attachSockets } from './ws.ts';

export interface ServerConfig {
  port: number;
  publicUrl: string | null;
  allowedOrigins: string[];
  /** The built web app (apps/web/dist). Missing in development, where Vite serves it. */
  webDir: string;
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

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/api/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, app: APP_NAME, rooms: store.rooms.size }));
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

  const sweeper = setInterval(() => sockets.sweep(), 60_000);
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
