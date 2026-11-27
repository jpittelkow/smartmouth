// Entry point. Settings come from the environment (.env.example lists them).
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_NAME } from '@smartmouth/protocol';
import { startServer } from './http.ts';
import { loadSeeds } from './seeds.ts';

const env = process.env;
const list = (s: string | undefined) => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const repo = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url));

const port = Number(env.PORT ?? 8470);
const dataDir = resolve(env.DATA_DIR ?? repo('data'));
const { server } = await startServer({
  port,
  publicUrl: env.PUBLIC_URL?.trim() || null,
  allowedOrigins: list(env.EXTRA_ORIGINS),
  adminPassword: env.ADMIN_PASSWORD,
  trustedProxies: list(env.TRUSTED_PROXIES),
  webDir: env.WEB_DIR ?? repo('apps/web/dist'),
  dbPath: join(dataDir, 'smartmouth.db'),
  onDb: (db) => {
    const { added, problems } = loadSeeds(db, repo('content/seed'), Date.now());
    if (added) console.log(`added ${added} seed questions`);
    for (const p of problems) console.warn(`seed problem: ${p}`);
  },
});
const addr = server.address();
console.log(`${APP_NAME} server listening on :${typeof addr === 'object' && addr ? addr.port : port}`);
