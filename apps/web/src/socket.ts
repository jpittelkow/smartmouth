// One socket per page, reconnecting with backoff. The page says what to send on (re)connect.
import { useEffect, useRef, useState } from 'react';
import type { ClientMsg, ServerMsg } from '@smartmouth/protocol';

export type SocketStatus = 'connecting' | 'open' | 'closed';

// The server keeps the clock (ADR 0004): every view carries the server's time, and countdowns use it.
let clockOffset = 0;
export const serverNow = () => Date.now() + clockOffset;

export function useSocket(onOpen: () => ClientMsg | null, onMessage: (m: ServerMsg) => void) {
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  // Keep the latest callbacks without reconnecting when they change.
  const handlers = useRef({ onOpen, onMessage });
  handlers.current = { onOpen, onMessage };

  useEffect(() => {
    let stopped = false;
    let opened = false;
    let delay = 500;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      wsRef.current = ws;
      setStatus('connecting');
      ws.onopen = () => {
        // A reconnect usually means the server restarted for a deploy: load the new version if there is one.
        if (opened) void reloadIfStale();
        opened = true;
        delay = 500;
        setStatus('open');
        const hello = handlers.current.onOpen();
        if (hello) ws.send(JSON.stringify(hello));
      };
      ws.onmessage = (e) => {
        let m: ServerMsg;
        try { m = JSON.parse(String(e.data)) as ServerMsg; } catch { return; }
        if ((m.t === 'view' || m.t === 'pong') && typeof m.serverNow === 'number') clockOffset = m.serverNow - Date.now();
        handlers.current.onMessage(m);
      };
      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        setStatus('closed');
        if (stopped) return;
        timer = setTimeout(connect, delay);
        delay = Math.min(delay * 2, 8000);
      };
    };
    connect();
    // A phone coming back from the lock screen: reconnect now rather than waiting out the backoff.
    const wake = () => {
      if (document.visibilityState !== 'visible') return;
      // The TV app keeps its page alive in the background for hours: check for a newer version on the way back.
      void reloadIfStale();
      if (!wsRef.current) { clearTimeout(timer); connect(); }
    };
    document.addEventListener('visibilitychange', wake);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', wake);
      wsRef.current?.close();
    };
  }, []);

  const send = (m: ClientMsg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
  };
  return { status, send };
}

export function store(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
export function save(key: string, value: string | null) {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* private mode */ }
}

/**
 * Reloads the page when the server now serves a different build (its script name changes with every build). Found on
 * the office TV, 2026-11-27: the TV app's page stayed on an hour-old version after several deploys. A reload is safe
 * mid-game: the host and phones resume their seats from their saved tokens.
 */
let checking = false;
export async function reloadIfStale(): Promise<void> {
  if (checking) return;
  const mine = document.querySelector('script[type="module"][src*="/assets/"]')?.getAttribute('src');
  if (!mine) return; // the dev server: nothing to compare
  checking = true;
  try {
    const r = await fetch(location.pathname, { cache: 'no-store' });
    if (r.ok && !(await r.text()).includes(mine)) location.reload();
  } catch { /* offline: try again next time */ } finally {
    checking = false;
  }
}
