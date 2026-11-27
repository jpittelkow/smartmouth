// Entry point. Settings come from the environment (.env.example lists them).
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_NAME } from '@smartmouth/protocol';
import { startServer } from './http.ts';
import { loadSeeds } from './seeds.ts';
import { VoiceBank } from './voice.ts';
import { openRouterChat } from './ai.ts';
import { DEFAULT_CHECKER, DEFAULT_WRITER, Generator } from './generator.ts';
import { VoiceRunner } from './voiceRunner.ts';
import { BotBrain, DEFAULT_BOT_MODEL } from './botBrain.ts';
import { BotMinds } from './botMinds.ts';

const env = process.env;
const list = (s: string | undefined) => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const repo = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url));

const port = Number(env.PORT ?? 8470);
const dataDir = resolve(env.DATA_DIR ?? repo('data'));
const key = env.OPENROUTER_API_KEY?.trim() || null;
const voiceRunner = key ? new VoiceRunner(repo('tools/voice/voice.mjs'), VoiceRunner.parse(env.SALTY_VOICES)) : null;
const { server } = await startServer({
  port,
  publicUrl: env.PUBLIC_URL?.trim() || null,
  allowedOrigins: list(env.EXTRA_ORIGINS),
  adminPassword: env.ADMIN_PASSWORD,
  trustedProxies: list(env.TRUSTED_PROXIES),
  webDir: env.WEB_DIR ?? repo('apps/web/dist'),
  dbPath: join(dataDir, 'smartmouth.db'),
  mediaDir: join(dataDir, 'media'),
  voiceRunner,
  minds: key && env.BOT_AI !== 'off' ? new BotMinds(new BotBrain(openRouterChat(key), env.BOT_MODEL?.trim() || DEFAULT_BOT_MODEL)) : null,
  makeGenerator: (db) => new Generator(db, {
    chat: key ? openRouterChat(key) : null,
    writerModel: env.AI_TEXT_MODEL?.trim() || DEFAULT_WRITER,
    checkerModel: env.AI_CHECK_MODEL?.trim() || DEFAULT_CHECKER,
    budget: Number(env.AI_JOB_BUDGET_USD) || 1,
    onPublished: () => voiceRunner?.request(),
  }),
  voice: new VoiceBank(repo('content/voice/lines.json'), join(dataDir, 'voice', 'manifest.json'), join(dataDir, 'media')),
  onDb: (db) => {
    const { added, problems } = loadSeeds(db, repo('content/seed'), Date.now());
    if (added) console.log(`added ${added} seed questions`);
    for (const p of problems) console.warn(`seed problem: ${p}`);
  },
});
const addr = server.address();
console.log(`${APP_NAME} server listening on :${typeof addr === 'object' && addr ? addr.port : port}`);
