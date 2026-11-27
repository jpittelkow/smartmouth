// Drives the real server over real sockets (ADR 0018): create, join, reconnect, kick, origin check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import type { ClientMsg, ServerMsg } from '@smartmouth/protocol';
import { startServer } from '../src/http.ts';

type Msg = ServerMsg;

function client(port: number, origin?: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, origin ? { origin } : {});
  const inbox: Msg[] = [];
  const waiters: Array<{ pred: (m: Msg) => boolean; ok: (m: Msg) => void }> = [];
  ws.on('message', (d) => {
    const m = JSON.parse(String(d)) as Msg;
    const i = waiters.findIndex((w) => w.pred(m));
    if (i >= 0) waiters.splice(i, 1)[0]?.ok(m); else inbox.push(m);
  });
  const open = new Promise<void>((ok, bad) => { ws.on('open', () => ok()); ws.on('error', bad); });
  return {
    ws,
    open,
    send: (m: ClientMsg) => ws.send(JSON.stringify(m)),
    next(pred: (m: Msg) => boolean, ms = 2000): Promise<Msg> {
      const i = inbox.findIndex(pred);
      if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0] as Msg);
      return new Promise((ok, bad) => {
        const timer = setTimeout(() => bad(new Error('timed out waiting for a message')), ms);
        waiters.push({ pred, ok: (m) => { clearTimeout(timer); ok(m); } });
      });
    },
    close: () => ws.close(),
  };
}

const isView = (m: Msg) => m.t === 'view';

test('host creates a room, players join, reconnect and get kicked', async () => {
  const srv = await startServer({ port: 0, publicUrl: 'https://play.example.com', allowedOrigins: [], webDir: '.' });
  const port = (srv.server.address() as { port: number }).port;
  try {
    const host = client(port);
    await host.open;
    host.send({ t: 'host:create' });
    const welcome = await host.next((m) => m.t === 'host:welcome');
    assert.ok(welcome.t === 'host:welcome');
    const code = welcome.code;
    const lobby = await host.next(isView);
    assert.ok(lobby.t === 'view' && lobby.view.role === 'host');
    if (lobby.t === 'view' && lobby.view.role === 'host') assert.equal(lobby.view.joinUrl, `https://play.example.com/play?code=${code}`);

    const grown = client(port);
    await grown.open;
    grown.send({ t: 'player:join', code: code.toLowerCase(), name: 'Captain Test', band: 'grownups', avatar: 2 });
    const gw = await grown.next((m) => m.t === 'player:welcome');
    assert.ok(gw.t === 'player:welcome');

    const kid = client(port);
    await kid.open;
    kid.send({ t: 'player:join', code, name: 'Blue Blob', band: 'little', avatar: 1 });
    const kw = await kid.next((m) => m.t === 'player:welcome');
    assert.ok(kw.t === 'player:welcome');

    // The host sees both, and the room is Mild because a little one is in.
    const both = await host.next((m) => m.t === 'view' && m.view.role === 'host' && m.view.players.length === 2);
    assert.ok(both.t === 'view' && both.view.spice.effective === 'mild');

    // The kid can't change the spice; the grown-up (admin) can.
    kid.send({ t: 'admin:spice', spice: 'filthy' });
    const denied = await kid.next((m) => m.t === 'error');
    assert.ok(denied.t === 'error' && denied.code === 'not-allowed');

    // The kid's phone drops and reconnects with its token: same seat.
    kid.close();
    await host.next((m) => m.t === 'view' && m.view.role === 'host' && m.view.players.some((p) => p.name === 'Blue Blob' && !p.connected));
    const kid2 = client(port);
    await kid2.open;
    kid2.send({ t: 'player:resume', code, token: kw.token });
    const again = await kid2.next((m) => m.t === 'player:welcome');
    assert.ok(again.t === 'player:welcome' && again.seatId === kw.seatId);
    await host.next((m) => m.t === 'view' && m.view.role === 'host' && m.view.players.every((p) => p.connected));

    // A bad token is refused.
    const stranger = client(port);
    await stranger.open;
    stranger.send({ t: 'player:resume', code, token: 'nope' });
    const bad = await stranger.next((m) => m.t === 'error');
    assert.ok(bad.t === 'error' && bad.code === 'bad-token');

    // The admin kicks the kid.
    grown.send({ t: 'admin:kick', seatId: kw.seatId });
    const kicked = await kid2.next((m) => m.t === 'error');
    assert.ok(kicked.t === 'error' && kicked.code === 'kicked');
    await host.next((m) => m.t === 'view' && m.view.role === 'host' && m.view.players.length === 1);

    // With only grown-ups left, the admin can raise the spice.
    grown.send({ t: 'admin:spice', spice: 'filthy' });
    await host.next((m) => m.t === 'view' && m.view.role === 'host' && m.view.spice.effective === 'filthy');

    // The TV reloads and resumes as host.
    host.close();
    const host2 = client(port);
    await host2.open;
    host2.send({ t: 'host:resume', code, token: welcome.token });
    await host2.next((m) => m.t === 'host:welcome');

    for (const c of [grown, kid2, stranger, host2]) c.close();
  } finally {
    await srv.close();
  }
});

test('sockets from other sites are refused', async () => {
  const srv = await startServer({ port: 0, publicUrl: 'https://play.example.com', allowedOrigins: [], webDir: '.' });
  const port = (srv.server.address() as { port: number }).port;
  try {
    const evil = client(port, 'https://evil.example.net');
    await evil.open;
    const code = await new Promise<number>((ok) => evil.ws.on('close', (c) => ok(c)));
    assert.equal(code, 4003);
    const good = client(port, 'https://play.example.com');
    await good.open;
    good.send({ t: 'ping' });
    assert.equal((await good.next((m) => m.t === 'pong')).t, 'pong');
    good.close();
    // A page this server served itself (same host) is allowed even when it isn't the public URL.
    const self = client(port, `http://127.0.0.1:${port}`);
    await self.open;
    self.send({ t: 'ping' });
    assert.equal((await self.next((m) => m.t === 'pong')).t, 'pong');
    self.close();
  } finally {
    await srv.close();
  }
});
