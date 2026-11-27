// The admin password (ADR 0015, owner's choice 2026-11-26: our own password, not Cloudflare Access).
// One shared password from ADMIN_PASSWORD; a login gets a random session token in an HttpOnly cookie.
// Sessions live in memory, so a server restart signs everyone out.
import { createHash, timingSafeEqual } from 'node:crypto';
import { makeToken } from './codes.ts';
import { RateLimit } from './limits.ts';

export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
export const COOKIE = 'sm_admin';

export type LoginResult = { ok: true; token: string } | { ok: false; code: 'off' | 'rate' | 'wrong' };

const digest = (s: string) => createHash('sha256').update(s, 'utf8').digest();

export class AdminAuth {
  passwordDigest: Buffer | null;
  sessions = new Map<string, number>();
  /** Five wrong guesses per address per 15 minutes. */
  limit = new RateLimit(5, 15 * 60 * 1000);
  /** And 50 wrong guesses in total per 15 minutes, whatever addresses they come from. */
  globalFails = new RateLimit(50, 15 * 60 * 1000);

  constructor(password: string | null | undefined) {
    const pw = password?.trim();
    this.passwordDigest = pw ? digest(pw) : null;
  }

  get enabled(): boolean { return this.passwordDigest !== null; }

  /**
   * `home` is true for a request straight from the home network: when the global cap is reached by guessers
   * elsewhere, the owner can still sign in from home (and existing sessions keep working everywhere).
   */
  login(password: unknown, ip: string, now: number, home = false): LoginResult {
    if (!this.passwordDigest) return { ok: false, code: 'off' };
    if (!this.limit.allow(ip, now)) return { ok: false, code: 'rate' };
    const g = this.globalFails.hits.get('all');
    if (!home && g && now - g.start < this.globalFails.windowMs && g.count >= this.globalFails.max) return { ok: false, code: 'rate' };
    // Compare digests so the comparison takes the same time whatever the length of the guess.
    const right = typeof password === 'string' && timingSafeEqual(digest(password), this.passwordDigest);
    if (!right) { this.globalFails.allow('all', now); return { ok: false, code: 'wrong' }; }
    this.limit.hits.delete(ip);
    const token = makeToken();
    this.sessions.set(token, now + SESSION_MS);
    return { ok: true, token };
  }

  check(token: string | undefined, now: number): boolean {
    if (!token) return false;
    const until = this.sessions.get(token);
    if (until === undefined) return false;
    if (until < now) { this.sessions.delete(token); return false; }
    return true;
  }

  logout(token: string | undefined): void {
    if (token) this.sessions.delete(token);
  }

  prune(now: number): void {
    for (const [t, until] of this.sessions) if (until < now) this.sessions.delete(t);
    this.limit.prune(now);
    this.globalFails.prune(now);
  }
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    // Tokens are base64url, so there is nothing to decode; a malformed value just doesn't match a session.
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

export function sessionCookie(token: string, secure: boolean, maxAgeMs = SESSION_MS): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(maxAgeMs / 1000)}${secure ? '; Secure' : ''}`;
}
