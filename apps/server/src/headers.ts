// Security headers on every response (pen test, 2026-11-27). The app is all same-origin: its own scripts, styles,
// fonts, recordings and the /ws socket ('self' covers ws:/wss: to the same host). The QR code is a data: image.
// Inline styles stay allowed because React and a library set some; inline and foreign scripts don't.

const PAGE_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/**
 * The /media folder: recordings, plus the audition pages that tools/voice and tools/sounds write (inline style and
 * script). `default-src 'none'` leaves them no fetch, XHR or socket, so a page there can't call the API.
 * Not `sandbox`: it blocks localStorage, which the sounds page keeps its picks in (found live 2026-11-27).
 */
const MEDIA_CSP = [
  "default-src 'none'",
  "media-src 'self'",
  "img-src 'self' data:",
  "style-src 'unsafe-inline'",
  "script-src 'unsafe-inline'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

export function securityHeaders(pathname: string, https: boolean): Record<string, string> {
  const media = pathname.startsWith('/media/');
  const h: Record<string, string> = {
    'content-security-policy': media ? MEDIA_CSP : PAGE_CSP,
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-resource-policy': 'same-origin',
  };
  // Only over HTTPS (through Cloudflare); a plain-HTTP visit on the home network must not be told to upgrade.
  if (https) h['strict-transport-security'] = 'max-age=31536000';
  return h;
}
