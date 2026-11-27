// House bots that think (Snake Manor): a model reads one bot's own view (its role, fellow Snakes if it's one, the
// public record and this round's table talk) and decides what it says and does. It is given nothing a person in that
// seat wouldn't know (ADR 0023). Every line is checked before it reaches the table: length, the room's spice level,
// and that a Snake bot never names its own partner.
import { spiceRank, type Spice } from '@smartmouth/protocol';
import { rules, type HistoryEvent, type SnakesPlayerView, type SnakesState } from '@smartmouth/game-snakes';
import type { Chat } from './ai.ts';
import { parseJsonObject } from './ai.ts';
import { cleanText } from './gameRuntime.ts';

export type ThinkKind = 'talk' | 'vote' | 'night';

/** A cheap, fast model is plenty for a line of table talk (about $0.0002 a call, 2026-11-27). */
export const DEFAULT_BOT_MODEL = 'anthropic/claude-haiku-5.5';
/** No room spends more than this many model calls on its bots. */
export const MAX_CALLS_PER_ROOM = 200;

/** Each bot plays the table its own way, so they argue instead of agreeing (picked from the seat id). */
export const TEMPERS = [
  'blunt and impatient: you pick one suspect and push hard',
  'paranoid: you notice odd votes and small contradictions',
  'charming and reasonable: you defend people who are piled on, and ask good questions',
  'theatrical: you love an accusation and a dramatic flourish',
  'cool and logical: you argue from the record (votes, missions), never from feelings',
  'contrary: you distrust whatever the table agrees on and say so',
];
const temperOf = (seatId: string) => TEMPERS[[...seatId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TEMPERS.length]!;

const STRONG = /\b(fuck\w*|shit\w*|bastards?|bitch\w*|assholes?|dicks?|piss\w*|damn\w*|hell|ass)\b/i;

export interface BrainContext {
  /** Seat id -> the name the room sees. */
  names: Record<string, string>;
  spice: Spice;
}

export class BotBrain {
  private chat: Chat;
  private model: string;
  private calls = new Map<string, number>();

  constructor(chat: Chat, model = DEFAULT_BOT_MODEL) {
    this.chat = chat;
    this.model = model;
  }

  /** The bot's intents for this decision, or null (no budget, a bad answer): the caller falls back to simple rules. */
  async think(roomCode: string, s: SnakesState, seatId: string, kind: ThinkKind, ctx: BrainContext): Promise<unknown[] | null> {
    const used = this.calls.get(roomCode) ?? 0;
    if (used >= MAX_CALLS_PER_ROOM) return null;
    this.calls.set(roomCode, used + 1);
    const v = rules.playerView(s, seatId);
    if (!v.me) return null;
    const prompt = buildPrompt(v, seatId, kind, ctx);
    const r = await this.chat({
      model: this.model, maxTokens: 200, timeoutMs: 12_000,
      messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
      schema: { name: `snake_${kind}`, schema: prompt.schema },
    });
    const json = parseJsonObject(r.text) as Record<string, unknown>;
    return toIntents(v, seatId, kind, json, ctx);
  }

  forget(roomCode: string) { this.calls.delete(roomCode); }
}

const nameOf = (ctx: BrainContext, id: string) => ctx.names[id] ?? 'someone';

function recordLines(history: HistoryEvent[], ctx: BrainContext): string[] {
  const n = (id: string) => nameOf(ctx, id);
  return history.map((h) => {
    switch (h.kind) {
      case 'mission': return `Round ${h.round} mission: ${h.right} of ${h.asked} right, target ${h.hit ? 'hit' : 'missed'}${h.overboard ? '; one right answer was secretly sunk by a Snake' : ''}.`;
      case 'votes': return `Round ${h.round} votes: ${h.votes.map((x) => `${n(x.from)} voted ${n(x.to)}`).join('; ')}.`;
      case 'banished': return `${n(h.id)} was voted out and was a ${h.role === 'snake' ? 'Snake' : 'Guest'}.`;
      case 'morning': return h.murdered.length ? `Night ${h.round}: ${h.murdered.map(n).join(' and ')} was murdered (a Guest, now a Ghost).` : h.saved ? `Night ${h.round}: a shield saved the Snakes' target.` : `Night ${h.round}: nobody died.`;
      case 'left': return `${n(h.id)} left the game and was a ${h.role === 'snake' ? 'Snake' : 'Guest'}.`;
      default: return '';
    }
  }).filter(Boolean);
}

/** The model's whole world: this bot's view, in plain words. Nothing hidden from this seat is ever included. */
export function buildPrompt(v: SnakesPlayerView, seatId: string, kind: ThinkKind, ctx: BrainContext) {
  const me = v.me!;
  const snake = me.role === 'snake';
  const alive = v.players.filter((p) => p.status === 'alive' && p.id !== seatId).map((p) => p.id);
  const cleanSpice = spiceRank(ctx.spice) < spiceRank('hot');
  const system = [
    `You are ${nameOf(ctx, seatId)}, a player in Snake Manor, a living-room party game like a hidden-traitor game show.`,
    'Most players are Guests; a few secret Snakes try to survive. Guests win if every Snake is voted out; Snakes win if one survives to the end.',
    snake
      ? `You are secretly a SNAKE. ${v.fellows.length ? `Your fellow Snake${v.fellows.length > 1 ? 's are' : ' is'} ${v.fellows.map((f) => nameOf(ctx, f)).join(', ')}.` : 'You are the only Snake left.'} Never reveal that you or they are Snakes. Act like a suspicious, helpful Guest. Steer suspicion toward Guests.`
      : 'You are a GUEST. You do not know who the Snakes are. Work it out from the record: who voted for whom, who sank missions, who was revealed.',
    `Your style at the table: ${temperOf(seatId)}.`,
    'Talk like a player at a table: short, punchy, specific, about the game only (votes, missions, who seems shifty). One sentence of 20 words or fewer.',
    'Don’t just agree with the last speaker or repeat a point already made. Bring your own read, and name names.',
    'Never insult anyone personally, never mention real people, politics or religion.',
    cleanSpice ? 'Keep it family friendly: no swearing at all; children may be playing.' : 'Mild swearing is allowed but not needed.',
  ].join('\n');
  const record = recordLines(v.history, ctx);
  const talk = v.talk.map((t) => `${nameOf(ctx, t.from)}: "${t.text}"`);
  const user = [
    `Players still in the game (besides you): ${alive.map((id) => nameOf(ctx, id)).join(', ')}.`,
    `What everyone has seen so far:\n${record.length ? record.map((l) => `- ${l}`).join('\n') : '- Nothing yet; this is the first round.'}`,
    `Said at the table this round:\n${talk.length ? talk.join('\n') : '(nothing yet)'}`,
    kind === 'talk' ? 'Say your next line at the table. Accuse, defend, or answer someone who just spoke.'
      : kind === 'vote' ? 'Vote out one player now (not yourself). Pick the name you most want gone.'
      : snake ? `It is night. Pick one Guest to murder from: ${(v.night?.grid.candidates ?? []).map((id) => nameOf(ctx, id)).join(', ')}. Also write a short private message to your fellow Snakes.`
      : 'It is night. Write a short private note about who you suspect, and pick your top suspect.',
  ].join('\n\n');
  const names = (kind === 'night' ? (v.night?.grid.candidates ?? alive) : kind === 'vote' ? (v.vote?.candidates ?? alive) : alive).map((id) => nameOf(ctx, id));
  const schema = {
    type: 'object', additionalProperties: false,
    required: kind === 'talk' ? ['line'] : kind === 'vote' ? ['target'] : ['target', 'line'],
    properties: {
      ...(kind !== 'vote' ? { line: { type: 'string', description: 'One sentence, 20 words or fewer.' } } : {}),
      ...(kind !== 'talk' ? { target: { type: 'string', enum: names.length ? names : ['none'] } } : {}),
    },
  };
  return { system, user, schema };
}

/** Checks a line before it reaches the table. Null drops it. */
export function checkLine(raw: unknown, v: SnakesPlayerView, ctx: BrainContext): string | null {
  const line = cleanText(typeof raw === 'string' ? fit(raw) : raw);
  if (!line) return null;
  if (spiceRank(ctx.spice) < spiceRank('hot') && STRONG.test(line)) return null;
  // A Snake bot must never out its partner, or itself.
  if (v.me?.role === 'snake') {
    if (/\bi(?:'m| am)\b.{0,12}\bsnake\b/i.test(line)) return null;
    for (const f of v.fellows) {
      const n = nameOf(ctx, f);
      if (n && new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(line) && /\b(snake|partner|team|ours?|ally|allies)\b/i.test(line)) return null;
    }
  }
  return line;
}

/** Too long for the table: cut at a word, never mid-word. */
function fit(s: string, max = 140): string {
  const t = s.trim();
  if ([...t].length <= max) return t;
  const cut = [...t].slice(0, max - 1).join('');
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max / 2)).replace(/[\s,;:–—-]+$/, '')}…`;
}

function toIntents(v: SnakesPlayerView, seatId: string, kind: ThinkKind, json: Record<string, unknown>, ctx: BrainContext): unknown[] | null {
  const idOf = (name: unknown) => Object.keys(ctx.names).find((id) => ctx.names[id] === name && id !== seatId);
  if (kind === 'talk') {
    const line = checkLine(json.line, v, ctx);
    return line ? [{ type: 'talk', text: line }] : null;
  }
  if (kind === 'vote') {
    const target = idOf(json.target);
    return target && v.vote?.candidates.includes(target) ? [{ type: 'vote', target }] : null;
  }
  const target = idOf(json.target);
  if (!target || !v.night?.grid.candidates.includes(target)) return null;
  const line = checkLine(json.line, v, ctx);
  return [{ type: 'pick', target }, ...(line ? [{ type: 'say', text: line }] : []), { type: 'lock' }];
}
