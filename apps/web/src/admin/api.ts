// Small fetch helpers for the admin API. Errors come back as { error } or { errors, warnings }.
export class ApiError extends Error {
  status: number;
  body: { error?: string; errors?: Record<string, string>; warnings?: string[] };
  constructor(status: number, body: ApiError['body']) {
    super(body.error ?? `Request failed (${status})`);
    this.status = status;
    this.body = body;
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const r = await fetch(path, {
    method: init.method ?? 'GET',
    headers: init.body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, body);
  return body as T;
}
