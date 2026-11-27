// One socket per page, reconnecting with backoff. The page says what to send on (re)connect.
import { useEffect, useRef, useState } from 'react';
import type { ClientMsg, ServerMsg } from '@smartmouth/protocol';

export type SocketStatus = 'connecting' | 'open' | 'closed';

export function useSocket(onOpen: () => ClientMsg | null, onMessage: (m: ServerMsg) => void) {
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  // Keep the latest callbacks without reconnecting when they change.
  const handlers = useRef({ onOpen, onMessage });
  handlers.current = { onOpen, onMessage };

  useEffect(() => {
    let stopped = false;
    let delay = 500;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      wsRef.current = ws;
      setStatus('connecting');
      ws.onopen = () => {
        delay = 500;
        setStatus('open');
        const hello = handlers.current.onOpen();
        if (hello) ws.send(JSON.stringify(hello));
      };
      ws.onmessage = (e) => {
        try { handlers.current.onMessage(JSON.parse(String(e.data)) as ServerMsg); } catch { /* ignore junk */ }
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
    const wake = () => { if (document.visibilityState === 'visible' && !wsRef.current) { clearTimeout(timer); connect(); } };
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
