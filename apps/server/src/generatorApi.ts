// Admin API for the question generator (generator.ts). Runs only after the session check in http.ts.
//   GET  /api/admin/generate   { enabled, models, jobs, voice }
//   POST /api/admin/generate   { topic, bands, perBand, spice, publish } → { job }
import type { IncomingMessage, ServerResponse } from 'node:http';
import { checkRequest, type Generator } from './generator.ts';
import type { HttpTools } from './adminApi.ts';
import type { VoiceRunner } from './voiceRunner.ts';

export async function handleGeneratorApi(
  req: IncomingMessage, res: ServerResponse, url: URL, gen: Generator | null, voices: VoiceRunner | null, t: HttpTools,
): Promise<boolean> {
  if (url.pathname !== '/api/admin/generate') return false;
  if (req.method === 'GET') {
    t.json(res, 200, {
      enabled: !!gen?.enabled, models: gen?.models ?? null, jobs: gen?.jobs ?? [],
      voice: voices ? { enabled: voices.enabled, busy: voices.busy, lastRun: voices.lastRun } : null,
    });
    return true;
  }
  if (req.method === 'POST') {
    if (!gen?.enabled) { t.json(res, 503, { error: 'No OpenRouter key on the server (OPENROUTER_API_KEY).' }); return true; }
    if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) { t.json(res, 415, { error: 'Send JSON.' }); return true; }
    let raw: unknown;
    try { raw = await t.readJson(req, 4096); } catch { t.json(res, 400, { error: 'Bad request.' }); return true; }
    const v = checkRequest(raw);
    if (!v.ok) { t.json(res, 400, { error: v.error }); return true; }
    try {
      t.json(res, 202, { job: gen.start(v.value).job });
    } catch (e) {
      t.json(res, 409, { error: e instanceof Error ? e.message : 'Busy.' });
    }
    return true;
  }
  return false;
}
