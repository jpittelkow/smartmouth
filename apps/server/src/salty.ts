// Decides what Salty says, when (ADR 0013). Called after every room change: when the room reaches a new moment
// (a new stage of the game, a player joining, the lobby) the game's adapter says what he says there, from lines at
// or below the room's spice level, and this builds the TV's cue: a caption and the audio clips to play in order.
import type { QuestionReads, SaltyCue } from '@smartmouth/protocol';
import { spiceState, type Room } from './rooms.ts';
import { caption, type Moment, type VoiceBank } from './voice.ts';
import { adapterFor } from './adapters/index.ts';
import type { SaltyTools } from './adapters/types.ts';

export interface SaltyState {
  /** The moment last spoken for, e.g. "lobby", "trivia:3:reveal". */
  stageKey: string;
  cue: SaltyCue | null;
  recent: string[];
  /** A one-off moment to say next (a player joined). */
  pending: Moment | null;
  seq: number;
  /** When Salty last started saying something. */
  spokeAt: number;
  /** Idle lobby lines said in a row (the gap grows with each). */
  idle: number;
}

export const newSalty = (): SaltyState => ({ stageKey: '', cue: null, recent: [], pending: null, seq: 0, spokeAt: 0, idle: 0 });

/** Lines for a quiet lobby (owner, 2026-11-27: "she should be talking more at the start screen while waiting"). */
export const IDLE_MOMENTS = new Set(['lobbyEmpty', 'lobbyWaiting']);
const IDLE_FIRST_MS = 30_000;
const IDLE_MAX_GAP_MS = 180_000;
/** A TV left on in an empty room: Salty goes quiet after this long without anything happening. */
const IDLE_GIVE_UP_MS = 15 * 60_000;

/**
 * A quiet lobby: if it's been long enough since Salty last spoke, he says an idle line (nobody here yet, or players
 * waiting to start). The gap grows (30 s, 45 s, 68 s... up to 3 min) and he stops after 15 quiet minutes.
 */
export function idleCue(room: Room, now: number): boolean {
  if (room.game || !room.hostConnected) return false;
  if (now - room.lastActive > IDLE_GIVE_UP_MS) return false;
  const st = room.salty;
  const gap = Math.min(IDLE_MAX_GAP_MS, IDLE_FIRST_MS * 1.5 ** st.idle);
  if (now - st.spokeAt < gap) return false;
  st.pending = room.seats.length ? 'lobbyWaiting' : 'lobbyEmpty';
  st.idle++;
  return true;
}

function tools(room: Room, bank: VoiceBank, now: number): SaltyTools {
  const spice = spiceState(room).effective;
  const st = room.salty;
  return {
    line(moment) {
      const line = bank.pick(moment, spice, new Set(st.recent), Math.random, (l) => !!bank.lineAudio(l.id, now, room.voice, l.text));
      if (!line) return null;
      st.recent = [line.id, ...st.recent].slice(0, 12);
      return { text: line.text, clip: bank.lineAudio(line.id, now, room.voice, line.text) };
    },
    reads: (questionId) => bank.reads(questionId, now, room.voice, spice),
  };
}

/** Recordings the TV may hold right now; everything else arrives in a cue at its moment. */
export function readsFor(room: Room, bank: VoiceBank | null, now: number): { question: QuestionReads | null; turn: QuestionReads | null } {
  const g = room.game;
  const a = g ? adapterFor(g.id) : null;
  if (!g || !a?.reads || !bank) return { question: null, turn: null };
  return a.reads(g.state, tools(room, bank, now));
}

/** Returns how long the new cue's audio runs (ms), or 0 when nothing new was said. */
export function updateSalty(room: Room, bank: VoiceBank | null, now: number): number {
  if (!bank) return 0;
  const st = room.salty;
  const g = room.game;
  const a = g ? adapterFor(g.id) : null;
  const stageKey = g && a ? `${g.id}:${a.stageKey(g.state)}` : 'lobby';
  let lobbyMoment: Moment | null = null;
  let changed = false;
  if (st.pending && !g) { lobbyMoment = st.pending; changed = true; }
  else if (stageKey !== st.stageKey) { changed = true; if (!g) lobbyMoment = 'lobby'; }
  st.pending = null;
  if (!changed) return 0;
  st.stageKey = stageKey;

  const t = tools(room, bank, now);
  let text: string | null = null;
  let clips: string[] = [];
  let parts: SaltyCue['parts'];
  if (g && a) {
    const said = a.say(g.state, t);
    ({ text, clips } = said);
    parts = said.parts?.map((p) => ({ at: p.at, caption: p.text ? caption(p.text) : null, clip: p.clip }));
  } else if (lobbyMoment) {
    // Until a moment has lines of its own (new idle moments), Salty falls back to a lobby line.
    const line = t.line(lobbyMoment) ?? (lobbyMoment !== 'lobby' ? t.line('lobby') : null);
    if (!IDLE_MOMENTS.has(lobbyMoment)) st.idle = 0;
    text = line?.text ?? null;
    if (line?.clip) clips = [line.clip];
  }
  st.seq++;
  st.spokeAt = now;
  if (g) st.idle = 0;
  st.cue = { key: `${stageKey}#${st.seq}`, caption: text ? caption(text) : null, clips, ...(parts ? { parts } : {}) };
  // A line in timed parts runs until its last part has been said.
  if (parts?.length) return Math.max(0, ...parts.map((p) => p.at - now + (p.clip ? bank.clipsMs([p.clip]) : 0)));
  return bank.clipsMs(clips);
}

/** A player joined the lobby: Salty says hello (in a game, the next stage's line covers it). */
export function cueJoin(room: Room): void {
  if (!room.game) room.salty.pending = 'join';
}
