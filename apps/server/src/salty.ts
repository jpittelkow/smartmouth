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
}

export const newSalty = (): SaltyState => ({ stageKey: '', cue: null, recent: [], pending: null, seq: 0 });

function tools(room: Room, bank: VoiceBank, now: number): SaltyTools {
  const spice = spiceState(room).effective;
  const st = room.salty;
  return {
    line(moment) {
      const line = bank.pick(moment, spice, new Set(st.recent));
      if (!line) return null;
      st.recent = [line.id, ...st.recent].slice(0, 12);
      return { text: line.text, clip: bank.lineAudio(line.id, now, room.voice) };
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
  if (g && a) {
    ({ text, clips } = a.say(g.state, t));
  } else if (lobbyMoment) {
    const line = t.line(lobbyMoment);
    text = line?.text ?? null;
    if (line?.clip) clips = [line.clip];
  }
  st.seq++;
  st.cue = { key: `${stageKey}#${st.seq}`, caption: text ? caption(text) : null, clips };
  return bank.clipsMs(clips);
}

/** A player joined the lobby: Salty says hello (in a game, the next stage's line covers it). */
export function cueJoin(room: Room): void {
  if (!room.game) room.salty.pending = 'join';
}
