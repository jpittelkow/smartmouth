// Trivia on the platform: questions from the library, intents from sockets, and Salty's lines per stage.
import { DEFAULT_ROUNDS, manifest, rules, type TriviaContent, type TriviaIntent, type TriviaState } from '@smartmouth/game-trivia';
import { pickForGame } from '../questions.ts';
import type { Moment } from '../voice.ts';
import type { GameAdapter } from './types.ts';

export const trivia: GameAdapter<TriviaState> = {
  manifest,

  start({ players, spice, db, exclude, now }) {
    // Spares beyond the rounds let the rules skip questions if the spice goes down mid-game.
    const content = pickForGame(db, { spice, exclude, perBand: DEFAULT_ROUNDS + 4 }, now) as TriviaContent;
    const bands = new Set(players.map((p) => p.band));
    const short = [...bands].filter((b) => content[b].length === 0);
    if (short.length === bands.size) {
      return { ok: false, code: 'no-questions', message: 'There are no live questions for these ages yet. Add some in the admin page.' };
    }
    return { ok: true, state: rules.init(players, { rounds: DEFAULT_ROUNDS, spice }, content, now) };
  },

  /** The TV (host) may only answer for a Little's turn, or skip. */
  intent(state, actor, raw, now) {
    if (!raw || typeof raw !== 'object') return state;
    const x = raw as Record<string, unknown>;
    const choice = typeof x.choice === 'number' && Number.isInteger(x.choice) ? x.choice : -1;
    let intent: TriviaIntent;
    if (x.type === 'answer' && actor.kind === 'player') intent = { type: 'answer', choice };
    else if (x.type === 'answerFor' && actor.kind === 'host' && typeof x.playerId === 'string') intent = { type: 'answerFor', playerId: x.playerId, choice };
    else return state;
    return rules.intent(state, actor.kind === 'player' ? actor.seatId : 'host', intent, now);
  },

  skip: (state, now) => rules.intent(state, 'host', { type: 'skip' }, now),
  tick: (state, now) => rules.tick(state, now),
  hold: (state, until) => rules.holdStage(state, until),
  shift: (state, ms) => rules.shiftTime(state, ms),
  deadline: (state) => rules.nextDeadline(state),
  sync: (state, players, spice, now) => rules.setSpice(rules.setPlayers(state, players, now), spice),
  hostView: (state) => rules.hostView(state),
  playerView: (state, seatId) => rules.playerView(state, seatId),
  isOver: (state) => rules.isOver(state),
  scores: (state) => Object.fromEntries(Object.entries(state.players).map(([id, p]) => [id, p.score])),
  plays: (state) => state.log,
  stageKey: (s) => `${s.round}:${s.stage}`,

  /** A bot answers its own question at random. */
  bot(s, seatId, rand) {
    const v = rules.playerView(s, seatId);
    if (v.stage !== 'question' || !v.question || v.picked !== null) return [];
    return [{ type: 'answer', choice: Math.floor(rand() * v.question.answers.length) }];
  },

  say(s, tools) {
    const moment = momentOf(s);
    const line = tools.line(moment);
    const tvQ = s.tvBand ? s.current[s.tvBand] : undefined;
    const qReads = tvQ ? tools.reads(tvQ.id) : null;
    const tReads = s.turn ? tools.reads(s.turn.question.id) : null;
    const clips: string[] = [];
    let text = line?.text ?? null;

    if (moment === 'question') {
      // The question is on screen; Salty reads it if there's a recording, else shows a filler caption.
      if (qReads?.prompt && tvQ) { clips.push(qReads.prompt); text = tvQ.prompt; }
    } else if (moment === 'allRight' || moment === 'allWrong' || moment === 'mixed') {
      if (line?.clip) clips.push(line.clip);
      if (tvQ?.explain) {
        text = [line?.text, tvQ.explain].filter(Boolean).join(' ');
        if (qReads?.explain) clips.push(qReads.explain);
      }
    } else if (moment === 'turn') {
      if (line?.clip) clips.push(line.clip);
      if (tReads?.prompt) clips.push(tReads.prompt);
      if (s.turn) text = [line?.text, s.turn.question.prompt].filter(Boolean).join(' ');
    } else if (moment === 'littleRight' || moment === 'littleWrong') {
      if (line?.clip) clips.push(line.clip);
      if (s.turn?.question.explain) {
        text = [line?.text, s.turn.question.explain].filter(Boolean).join(' ');
        if (tReads?.explain) clips.push(tReads.explain);
      }
    } else if (line?.clip) {
      clips.push(line.clip);
    }
    return { text, clips };
  },

  /** Only a Little turn's picture names go out ahead of time (they're read as the remote moves). */
  reads(s, tools) {
    if (s.stage !== 'turn' || !s.turn) return { question: null, turn: null };
    const r = tools.reads(s.turn.question.id);
    return { question: null, turn: { prompt: null, answers: r.answers, explain: null } };
  },
};

function momentOf(s: TriviaState): Moment {
  switch (s.stage) {
    // The first round's intro is Salty introducing himself (owner, 2026-11-27).
    case 'intro': return s.round === 1 ? 'hello' : 'intro';
    case 'question': return 'question';
    case 'reveal': {
      const graded = rules.hostView(s).players.filter((p) => p.right !== null);
      const right = graded.filter((p) => p.right).length;
      return right === graded.length ? 'allRight' : right === 0 ? 'allWrong' : 'mixed';
    }
    case 'turn': return 'turn';
    case 'turnReveal': return s.turn && s.turn.pick?.choice === s.turn.question.correct ? 'littleRight' : 'littleWrong';
    // The leaderboard between rounds is where the next round is introduced.
    case 'standings': return 'intro';
    default: return 'final';
  }
}
