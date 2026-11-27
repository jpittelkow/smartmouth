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
 * The /media folder: recordings, plus the audition pages that tools/voice writes (inline style and script).
 * `sandbox` gives those pages an origin of their own, so even a bad file there can't use the admin cookie or call the API.
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
  'sandbox allow-scripts',
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
  };
  // Not on /media: a sandboxed audition page has an opaque origin, so same-origin CORP would block its own recordings
  // (found live 2026-11-27). The recordings are public anyway.
  if (!media) h['cross-origin-resource-policy'] = 'same-origin';
  // Only over HTTPS (through Cloudflare); a plain-HTTP visit on the home network must not be told to upgrade.
  if (https) h['strict-transport-security'] = 'max-age=31536000';
  return h;
}
