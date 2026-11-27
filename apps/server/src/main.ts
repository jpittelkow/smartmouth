// Entry point. Settings come from the environment (.env.example lists them).
import { fileURLToPath } from 'node:url';
import { APP_NAME } from '@smartmouth/protocol';
import { startServer } from './http.ts';

const env = process.env;
const list = (s: string | undefined) => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);

const port = Number(env.PORT ?? 8470);
const { server } = await startServer({
  port,
  publicUrl: env.PUBLIC_URL?.trim() || null,
  allowedOrigins: list(env.EXTRA_ORIGINS),
  webDir: env.WEB_DIR ?? fileURLToPath(new URL('../../web/dist', import.meta.url)),
});
const addr = server.address();
console.log(`${APP_NAME} server listening on :${typeof addr === 'object' && addr ? addr.port : port}`);
