// Security headers (headers.ts): strict policy on the app's pages and API, a sandboxed one on /media, HSTS only over HTTPS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startServer } from '../src/http.ts';

test('every response carries the security headers; /media pages are sandboxed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sm-headers-'));
  const web = join(dir, 'web'), media = join(dir, 'media');
  mkdirSync(web); mkdirSync(join(media, 'voice'), { recursive: true });
  writeFileSync(join(web, 'index.html'), '<!doctype html><title>t</title>');
  writeFileSync(join(media, 'voice', 'index.html'), '<!doctype html><title>a</title>');
  const srv = await startServer({ port: 0, publicUrl: null, allowedOrigins: [], webDir: web, mediaDir: media });
  const addr = srv.server.address();
  const base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
  try {
    for (const path of ['/host', '/api/health', '/api/admin/me', '/nope']) {
      const r = await fetch(`${base}${path}`);
      const csp = r.headers.get('content-security-policy') ?? '';
      assert.match(csp, /script-src 'self'(;|$)/, path);
      assert.match(csp, /frame-ancestors 'none'/, path);
      assert.equal(r.headers.get('x-frame-options'), 'DENY', path);
      assert.equal(r.headers.get('x-content-type-options'), 'nosniff', path);
      assert.equal(r.headers.get('strict-transport-security'), null, `${path}: no HSTS over plain HTTP`);
    }
    const page = await fetch(`${base}/media/voice/index.html`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-security-policy') ?? '', /sandbox allow-scripts/);
    const https = await fetch(`${base}/play`, { headers: { 'x-forwarded-proto': 'https' } });
    assert.match(https.headers.get('strict-transport-security') ?? '', /max-age=\d+/);
  } finally {
    await srv.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
