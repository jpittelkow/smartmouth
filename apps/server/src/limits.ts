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

/** Loopback and private-range addresses: where the Cloudflare tunnel (cloudflared) reaches us from. */
export function isPrivateAddress(addr: string | undefined): boolean {
  if (!addr) return false;
  const a = addr.replace(/^::ffff:/, '');
  return a === '127.0.0.1' || a === '::1' || /^10\./.test(a) || /^192\.168\./.test(a)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(a) || /^f[cd][0-9a-f]{2}:/i.test(a);
}

/**
 * The client's address for rate limits. CF-Connecting-IP is believed only when the connection itself comes from a
 * private address (the tunnel); Cloudflare overwrites that header, so a visitor through the tunnel can't fake it.
 * X-Forwarded-For is never used: anyone can set it.
 */
export function clientAddress(
  headers: Record<string, string | string[] | undefined>, remote: string | undefined, trusted: (addr: string | undefined) => boolean = isPrivateAddress,
): string {
  const cf = headers['cf-connecting-ip'];
  if (trusted(remote) && typeof cf === 'string' && cf.length > 0 && cf.length < 64) return cf;
  return remote ?? '?';
}

/**
 * Which peers may vouch for the client's address. TRUSTED_PROXIES (exact addresses, e.g. the cloudflared
 * container's) narrows it; unset, any home-network address is trusted, so only a device already on the home
 * network could fake an address (accepted 2026-11-26, ADR 0015).
 */
export function trustedProxies(list: readonly string[]): (addr: string | undefined) => boolean {
  if (list.length === 0) return isPrivateAddress;
  const set = new Set(list.map((a) => a.replace(/^::ffff:/, '')));
  return (addr) => !!addr && set.has(addr.replace(/^::ffff:/, ''));
}

/** A request straight from the home network, not through the tunnel. */
export function fromHomeNetwork(headers: Record<string, string | string[] | undefined>, remote: string | undefined): boolean {
  return isPrivateAddress(remote) && headers['cf-connecting-ip'] === undefined;
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
