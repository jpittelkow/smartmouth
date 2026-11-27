// OpenRouter chat for the server's AI jobs (ADR 0011). One key, OPENROUTER_API_KEY, held by the server only.
// Calls ask OpenRouter to report each call's cost, so a job can stop at its budget.

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

export interface ChatResult {
  text: string;
  /** US dollars, as OpenRouter reports it (0 when it doesn't). */
  cost: number;
  /** Web pages the model cited, when web search was on. */
  sources: Array<{ url: string; title: string }>;
}

export interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  /** A JSON schema the reply must follow (structured outputs). */
  schema?: { name: string; schema: Record<string, unknown> };
  /** Let the model search the web first (OpenRouter's web plugin). */
  web?: boolean;
  maxTokens?: number;
  timeoutMs?: number;
}

export type Chat = (o: ChatOptions) => Promise<ChatResult>;

export function openRouterChat(key: string, fetchFn: typeof fetch = fetch): Chat {
  return async (o) => {
    const body: Record<string, unknown> = {
      model: o.model,
      messages: o.messages,
      max_tokens: o.maxTokens ?? 8000,
      usage: { include: true },
    };
    if (o.schema) body.response_format = { type: 'json_schema', json_schema: { name: o.schema.name, strict: true, schema: o.schema.schema } };
    if (o.web) body.plugins = [{ id: 'web', max_results: 6 }];
    let last = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetchFn('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Smartmouth' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(o.timeoutMs ?? 180_000),
      });
      if (r.ok) {
        const j = await r.json() as {
          choices?: Array<{ message?: { content?: string; annotations?: Array<{ type?: string; url_citation?: { url?: string; title?: string } }> } }>;
          usage?: { cost?: number };
        };
        const msg = j.choices?.[0]?.message;
        const sources = (msg?.annotations ?? [])
          .filter((a) => a.type === 'url_citation' && a.url_citation?.url)
          .map((a) => ({ url: String(a.url_citation!.url), title: String(a.url_citation!.title ?? '') }));
        return { text: msg?.content ?? '', cost: Number(j.usage?.cost ?? 0) || 0, sources };
      }
      last = `${r.status} ${(await r.text()).slice(0, 300)}`;
      if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 3000 * (attempt + 1))); continue; }
      break;
    }
    throw new Error(`OpenRouter: ${last}`);
  };
}

/** The first JSON object in a reply (models sometimes wrap it in prose or a code fence). */
export function parseJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The model didn\'t return JSON.');
  return JSON.parse(text.slice(start, end + 1));
}
