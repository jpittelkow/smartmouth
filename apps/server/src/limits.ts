// Simple abuse limits for a public server (ADR 0015).

/** A fixed-window counter per key: at most `max` hits per `windowMs`. */
export class RateLimit {
  max: number;
  windowMs: number;
  hits = new Map<string, { start: number; count: number }>();

  constructor(max: number, windowMs: number) {
    this.max = max;
    this.windowMs = windowMs;
  }

  allow(key: string, now: number): boolean {
    const h = this.hits.get(key);
    if (!h || now - h.start >= this.windowMs) {
      this.hits.set(key, { start: now, count: 1 });
      return true;
    }
    h.count++;
    return h.count <= this.max;
  }

  prune(now: number): void {
    for (const [k, h] of this.hits) if (now - h.start >= this.windowMs) this.hits.delete(k);
  }
}

export function originAllowed(origin: string | undefined, allowed: ReadonlySet<string>, requestHost?: string): boolean {
  // Browsers always send Origin on a WebSocket; tools and tests don't. Only a browser can be tricked into
  // connecting from another site, so a missing Origin is fine.
  if (!origin) return true;
  if (allowed.has(origin)) return true;
  // A page this server served itself (same host as the socket request) is always allowed. Behind the tunnel the
  // Host header is the public name, so this also covers play.<domain>.
  try { return !!requestHost && new URL(origin).host === requestHost; } catch { return false; }
}
