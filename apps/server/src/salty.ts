// Decides what Salty says, when (ADR 0013). Called after every room change: when the room reaches a new moment
// (a new stage of the game, a player joining, the lobby) it picks a line at or below the room's spice level and
// builds the TV's cue: a caption and the audio clips to play in order.
import { rules } from '@smartmouth/game-trivia';
import type { QuestionReads, SaltyCue } from '@smartmouth/protocol';
import { spiceState, type Room } from './rooms.ts';
import { caption, type Moment, type VoiceBank } from './voice.ts';

export interface SaltyState {
  /** The moment last spoken for, e.g. "lobby", "3:reveal". */
  stageKey: string;
  cue: SaltyCue | null;
  recent: string[];
  /** A one-off moment to say next (a player joined). */
  pending: Moment | null;
  seq: number;
}

export const newSalty = (): SaltyState => ({ stageKey: '', cue: null, recent: [], pending: null, seq: 0 });

/**
 * Recordings the TV may hold right now. Only a Little turn's picture names go out ahead of time (they're read as the
 * remote moves); everything else is handed over in a cue at its moment, so nothing reveals an answer early.
 */
export function readsFor(room: Room, bank: VoiceBank | null, now: number): { question: QuestionReads | null; turn: QuestionReads | null } {
  const s = room.game?.state;
  if (!s || !bank || s.stage !== 'turn' || !s.turn) return { question: null, turn: null };
  const r = bank.reads(s.turn.question.id, now, room.voice, spiceState(room).effective);
  return { question: null, turn: { prompt: null, answers: r.answers, explain: null } };
}

export function updateSalty(room: Room, bank: VoiceBank | null, now: number): void {
  if (!bank) return;
  const st = room.salty;
  const s = room.game?.state;
  const stageKey = s ? `${s.round}:${s.stage}` : 'lobby';
  let moment: Moment | null = null;
  if (st.pending && !s) moment = st.pending;
  else if (stageKey !== st.stageKey) moment = s ? momentOf(room) : 'lobby';
  st.pending = null;
  if (!moment) return;
  st.stageKey = stageKey;

  const spice = spiceState(room).effective;
  const line = bank.pick(moment, spice, new Set(st.recent));
  if (line) st.recent = [line.id, ...st.recent].slice(0, 12);
  const lineClip = line ? bank.lineAudio(line.id, now, room.voice) : null;
  const tvId = s && s.tvBand ? s.current[s.tvBand]?.id : undefined;
  const reads = { question: tvId !== undefined ? bank.reads(tvId, now, room.voice, spice) : null, turn: s?.turn ? bank.reads(s.turn.question.id, now, room.voice, spice) : null };
  const clips: string[] = [];
  let text = line?.text ?? null;

  if (s && moment === 'question') {
    // The question is on screen; Salty reads it if there's a recording, else shows a filler caption.
    const tvQ = s.tvBand ? s.current[s.tvBand] : undefined;
    if (reads.question?.prompt && tvQ) { clips.push(reads.question.prompt); text = tvQ.prompt; }
  } else if (s && (moment === 'allRight' || moment === 'allWrong' || moment === 'mixed')) {
    if (lineClip) clips.push(lineClip);
    const tvQ = s.tvBand ? s.current[s.tvBand] : undefined;
    if (tvQ?.explain) {
      text = [line?.text, tvQ.explain].filter(Boolean).join(' ');
      if (reads.question?.explain) clips.push(reads.question.explain);
    }
  } else if (s && moment === 'turn') {
    if (lineClip) clips.push(lineClip);
    if (reads.turn?.prompt) clips.push(reads.turn.prompt);
    if (s.turn) text = [line?.text, s.turn.question.prompt].filter(Boolean).join(' ');
  } else if (s && (moment === 'littleRight' || moment === 'littleWrong')) {
    if (lineClip) clips.push(lineClip);
    if (s.turn?.question.explain) {
      text = [line?.text, s.turn.question.explain].filter(Boolean).join(' ');
      if (reads.turn?.explain) clips.push(reads.turn.explain);
    }
  } else if (lineClip) {
    clips.push(lineClip);
  }
  st.seq++;
  st.cue = { key: `${stageKey}#${st.seq}`, caption: text ? caption(text) : null, clips };
}

/** A player joined the lobby: Salty says hello (in a game, the next stage's line covers it). */
export function cueJoin(room: Room): void {
  if (!room.game) room.salty.pending = 'join';
}

function momentOf(room: Room): Moment {
  const s = room.game!.state;
  switch (s.stage) {
    case 'intro': return 'intro';
    case 'question': return 'question';
    case 'reveal': {
      const graded = rules.hostView(s).players.filter((p) => p.right !== null);
      const right = graded.filter((p) => p.right).length;
      return right === graded.length ? 'allRight' : right === 0 ? 'allWrong' : 'mixed';
    }
    case 'turn': return 'turn';
    case 'turnReveal': return s.turn && s.turn.pick?.choice === s.turn.question.correct ? 'littleRight' : 'littleWrong';
    default: return 'final';
  }
}
