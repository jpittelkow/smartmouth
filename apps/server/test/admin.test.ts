// The admin password (ADR 0015): login, session cookie, wrong-guess limit, logout, and locked when unset.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AdminAuth, readCookie, sessionCookie } from '../src/admin.ts';
import { startServer } from '../src/http.ts';

test('the right password signs in; wrong ones are limited to five per 15 minutes', () => {
  const auth = new AdminAuth('correct horse');
  assert.ok(!auth.login('nope', 'a', 0).ok);
  const ok = auth.login('correct horse', 'a', 0);
  assert.ok(ok.ok);
  if (ok.ok) assert.ok(auth.check(ok.token, 1));
  for (let i = 0; i < 5; i++) auth.login('wrong', 'b', 0);
  const blocked = auth.login('correct horse', 'b', 0);
  assert.ok(!blocked.ok && blocked.code === 'rate', 'even the right password waits after five misses');
  assert.ok(auth.login('correct horse', 'b', 15 * 60 * 1000).ok, 'and works again after the window');
});

test('sessions expire and log out', () => {
  const auth = new AdminAuth('pw');
  const r = auth.login('pw', 'a', 0);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.ok(!auth.check(r.token, 31 * 24 * 60 * 60 * 1000), 'expired after 30 days');
  const r2 = auth.login('pw', 'a', 0);
  if (!r2.ok) return assert.fail();
  auth.logout(r2.token);
  assert.ok(!auth.check(r2.token, 1));
});

test('no password set means the admin area stays locked', () => {
  const auth = new AdminAuth('  ');
  assert.equal(auth.enabled, false);
  const r = auth.login('', 'a', 0);
  assert.ok(!r.ok && r.code === 'off');
});

test('cookies are HttpOnly, SameSite=Strict, and Secure behind https', () => {
  const c = sessionCookie('abc', true);
  assert.match(c, /HttpOnly/);
  assert.match(c, /SameSite=Strict/);
  assert.match(c, /Secure/);
  assert.doesNotMatch(sessionCookie('abc', false), /Secure/);
  assert.equal(readCookie('a=1; sm_admin=xyz; b=2', 'sm_admin'), 'xyz');
});

test('over HTTP: admin routes need the session cookie', async () => {
  const srv = await startServer({ port: 0, publicUrl: null, allowedOrigins: [], webDir: '.', adminPassword: 'pw' });
  const base = `http://127.0.0.1:${(srv.server.address() as { port: number }).port}`;
  try {
    assert.equal((await fetch(`${base}/api/admin/anything`)).status, 401);
    const me0 = await (await fetch(`${base}/api/admin/me`)).json();
    assert.deepEqual(me0, { enabled: true, signedIn: false });

    const bad = await fetch(`${base}/api/admin/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"password":"no"}' });
    assert.equal(bad.status, 401);

    const good = await fetch(`${base}/api/admin/login`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-proto': 'https' }, body: '{"password":"pw"}',
    });
    assert.equal(good.status, 200);
    const cookie = good.headers.get('set-cookie') ?? '';
    assert.match(cookie, /Secure/);
    const pair = cookie.split(';')[0] ?? '';
    const me = await (await fetch(`${base}/api/admin/me`, { headers: { cookie: pair } })).json();
    assert.deepEqual(me, { enabled: true, signedIn: true });
    assert.equal((await fetch(`${base}/api/admin/anything`, { headers: { cookie: pair } })).status, 404, 'signed in: past the gate');

    await fetch(`${base}/api/admin/logout`, { method: 'POST', headers: { cookie: pair } });
    assert.equal((await fetch(`${base}/api/admin/anything`, { headers: { cookie: pair } })).status, 401);
  } finally {
    await srv.close();
  }
});
