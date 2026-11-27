// Trivia's rules: a pure state machine (ADR 0004, 0006). No sockets, timers or I/O; the platform calls `tick`
// when `nextDeadline` passes and hands in the questions it picked from the library.
//
// A game is `rounds` rounds. Each round everyone except Little players answers a question sized to their own
// band (the TV shows the oldest band's question). Little players get a turn round on the TV every other round
// (ADR 0009): pictures, no timer, the TV remote or a phone in kid mode, and helpers can earn a little bonus.
import { BAND_IDS, BANDS, bandRank, spiceAllows, type Band, type GamePlayer, type Spice } from '@smartmouth/protocol';
import type {
  TPlayerStatus, TPublicQuestion, TQuestion, TriviaContent, TriviaHostView, TriviaIntent, TriviaPlayerView,
  TriviaSettings, TriviaState,
} from './types.ts';

export const INTRO_MS = 3500;
export const REVEAL_MS = 8000;
export const TURN_REVEAL_MS = 6000;
/** The drum roll before a reveal: answers are closed, the right one isn't shown yet. */
export const SUSPENSE_MS = 2200;
/** After the leaderboard the round card still covers the question this long; the timer starts when it's gone. */
export const CARD_COVER_MS = 1200;
/** The leaderboard between rounds (held longer while Salty talks). */
export const STANDINGS_MS = 6000;
/** A turn that nobody answers moves on after this, so a game can't stall. */
export const TURN_MAX_MS = 120_000;
export const BASE_POINTS = 100;
export const SPEED_BONUS = 50;
export const LITTLE_TRY_POINTS = 25;
export const HELPER_POINTS = 25;

/** Seconds to answer: younger bands get longer. */
export function answerMs(bands: Band[]): number {
  if (bands.includes('kids')) return 30_000;
  if (bands.includes('tweens')) return 25_000;
  return 20_000;
}

const multiplier = (b: Band) => BANDS.find((x) => x.id === b)?.multiplier ?? 1;
const getsSpeedBonus = (b: Band) => bandRank(b) >= bandRank('tweens');

export function init(players: readonly GamePlayer[], settings: TriviaSettings, content: TriviaContent, now: number): TriviaState {
  const state: TriviaState = {
    rounds: settings.rounds, round: 1, stage: 'intro', stageEnds: now + INTRO_MS, spice: settings.spice,
    players: Object.fromEntries(players.map((p) => [p.id, { band: p.band, score: 0 }])),
    queues: Object.fromEntries(BAND_IDS.map((b) => [b, [...(content[b] ?? [])]])) as TriviaContent,
    current: {}, tvBand: null, questionStart: 0, questionEnds: 0, picks: {}, gained: {}, turn: null, turnCount: 0, log: [],
  };
  return state;
}

/** Players joined or left between steps. New players start at zero; leavers drop out of the standings. */
export function setPlayers(s: TriviaState, players: readonly GamePlayer[], now: number): TriviaState {
  const next: TriviaState['players'] = {};
  for (const p of players) next[p.id] = s.players[p.id] ?? { band: p.band, score: 0 };
  let turn = s.turn;
  if (turn && !next[turn.playerId]) turn = null;
  const out = { ...s, players: next, turn };
  // The Little player whose turn it was left: move on rather than wait.
  if (s.stage === 'turn' && !turn) return nextRound(out, now);
  return out;
}

/** The room's spice changed (someone younger joined, or a grown-up turned it down). */
export function setSpice(s: TriviaState, spice: Spice): TriviaState {
  return { ...s, spice };
}

export function nextDeadline(s: TriviaState): number | null {
  return s.stageEnds;
}

/** Pauses that wait for Salty: he finishes talking before the game moves on (owner, 2026-11-27). */
const HOLDABLE = new Set(['intro', 'reveal', 'turnReveal', 'standings']);
/** Keeps the current pause going until `until`, never shortening it; question timers are never touched. */
export function holdStage(s: TriviaState, until: number): TriviaState {
  if (!HOLDABLE.has(s.stage) || s.stageEnds === null || until <= s.stageEnds) return s;
  return { ...s, stageEnds: until };
}

/** The game was paused for `ms`: every clock moves forward by that much. */
export function shiftTime(s: TriviaState, ms: number): TriviaState {
  if (ms <= 0) return s;
  return {
    ...s, stageEnds: s.stageEnds === null ? null : s.stageEnds + ms, questionStart: s.questionStart + ms, questionEnds: s.questionEnds + ms,
    turn: s.turn ? { ...s.turn, start: s.turn.start + ms } : null,
  };
}

export function isOver(s: TriviaState): boolean {
  return s.stage === 'final';
}

export function tick(s: TriviaState, now: number): TriviaState {
  if (s.stageEnds === null || now < s.stageEnds) return s;
  switch (s.stage) {
    case 'intro': return startQuestion(s, now);
    case 'question': return suspense(s, now);
    case 'suspense': return reveal(s, now);
    case 'reveal': return turnDue(s) ? startTurn(s, now) : nextRound(s, now);
    case 'turn': return nextRound({ ...s, turn: null }, now); // nobody picked in time
    case 'turnReveal': return nextRound(s, now);
    case 'standings': return startQuestion({ ...s, round: s.round + 1, turn: null }, now, CARD_COVER_MS);
    default: return s;
  }
}

export function intent(s: TriviaState, playerId: string, i: TriviaIntent, now: number): TriviaState {
  if (i.type === 'skip') return skip(s, now);
  if (i.type === 'answerFor') return s.turn && i.playerId === s.turn.playerId ? turnAnswer(s, i.playerId, i.choice, now) : s;
  if (s.stage === 'question') return answer(s, playerId, i.choice, now);
  if (s.stage === 'turn') return turnAnswer(s, playerId, i.choice, now);
  return s;
}

/** A grown-up pressed "next": end the wait now. */
function skip(s: TriviaState, now: number): TriviaState {
  if (s.stage === 'question') return suspense(s, now);
  if (s.stage === 'turn') return nextRound({ ...s, turn: null }, now);
  if (s.stage === 'final') return s;
  return tick({ ...s, stageEnds: now }, now);
}

const littles = (s: TriviaState) => Object.keys(s.players).filter((id) => s.players[id]?.band === 'little');
const answerers = (s: TriviaState) => Object.keys(s.players).filter((id) => s.players[id]?.band !== 'little');

/** The question the TV will show next round (the oldest answering band's next one), without taking it. */
function peekTvQuestion(s: TriviaState): TQuestion | null {
  const bands = [...new Set(answerers(s).map((id) => s.players[id]?.band as Band))].filter((b) => s.queues[b]?.some((q) => spiceAllows(s.spice, q.spice)));
  if (!bands.length) return null;
  const tv = bands.reduce((a, b) => (bandRank(b) > bandRank(a) ? b : a));
  return s.queues[tv]!.find((q) => spiceAllows(s.spice, q.spice)) ?? null;
}

function takeQuestion(s: TriviaState, band: Band): TQuestion | null {
  const q = s.queues[band];
  while (q.length) {
    const next = q.shift() as TQuestion;
    if (spiceAllows(s.spice, next.spice)) return next;
  }
  return null;
}

function startQuestion(s0: TriviaState, now: number, coverMs = 0): TriviaState {
  const s: TriviaState = { ...s0, queues: { ...s0.queues }, picks: {}, gained: {}, current: {}, turn: null, roundStartScores: scoresNow(s0) };
  for (const b of BAND_IDS) s.queues[b] = [...s0.queues[b]];
  const bands = [...new Set(answerers(s).map((id) => s.players[id]?.band as Band))];
  for (const b of bands) {
    const q = takeQuestion(s, b);
    if (q) s.current[b] = q;
  }
  const asked = Object.keys(s.current) as Band[];
  if (asked.length === 0) {
    // Only Little players here (or nothing left to ask): go straight to a turn, or finish.
    return littles(s).length && s.queues.little.length ? startTurn(s, now) : finish(s);
  }
  s.tvBand = asked.reduce((a, b) => (bandRank(b) > bandRank(a) ? b : a));
  // The timer starts once the round card is off the screen (owner, 2026-11-27: "start the question time later").
  s.questionStart = now + coverMs;
  s.questionEnds = s.questionStart + answerMs(asked);
  s.stage = 'question';
  s.stageEnds = s.questionEnds;
  return s;
}

function answer(s: TriviaState, playerId: string, choice: number, now: number): TriviaState {
  const p = s.players[playerId];
  if (!p || p.band === 'little' || s.picks[playerId] || now > s.questionEnds || now < s.questionStart) return s;
  const q = s.current[p.band];
  if (!q || !Number.isInteger(choice) || choice < 0 || choice >= q.answers.length) return s;
  const next = { ...s, picks: { ...s.picks, [playerId]: { choice, at: now } } };
  // Everyone who has a question has answered: reveal now.
  const waiting = answerers(next).filter((id) => next.current[next.players[id]?.band as Band] && !next.picks[id]);
  return waiting.length ? next : suspense(next, now);
}

/** Answers are closed; a drum roll before the reveal (owner, 2026-11-27: "build some suspense"). */
function suspense(s: TriviaState, now: number): TriviaState {
  return { ...s, stage: 'suspense', stageEnds: now + SUSPENSE_MS };
}

function reveal(s0: TriviaState, now: number): TriviaState {
  const s: TriviaState = { ...s0, players: { ...s0.players }, gained: {}, log: [...s0.log], stage: 'reveal', stageEnds: now + REVEAL_MS };
  const total = Math.max(1, s.questionEnds - s.questionStart);
  for (const id of answerers(s)) {
    const p = s.players[id] as TriviaState['players'][string];
    const q = s.current[p.band];
    if (!q) continue;
    const pick = s.picks[id];
    const right = !!pick && pick.choice === q.correct;
    let points = 0;
    if (right && pick) {
      points = BASE_POINTS * multiplier(p.band);
      if (getsSpeedBonus(p.band)) points += SPEED_BONUS * Math.max(0, (s.questionEnds - pick.at) / total);
      points = Math.round(points);
    }
    s.gained[id] = points;
    s.players[id] = { ...p, score: p.score + points };
    s.log.push({ questionId: q.id, right, ms: pick ? pick.at - s.questionStart : null });
  }
  return s;
}

function turnDue(s: TriviaState): boolean {
  return littles(s).length > 0 && s.round % 2 === 0;
}

function startTurn(s0: TriviaState, now: number): TriviaState {
  const ls = littles(s0);
  const s: TriviaState = { ...s0, queues: { ...s0.queues, little: [...s0.queues.little] }, gained: {} };
  const playerId = ls[s.turnCount % ls.length] as string;
  // Little rooms are always Mild (ADR 0014), so only Mild questions are used for a turn.
  const q = takeQuestion({ ...s, spice: 'mild' }, 'little');
  if (!q) return nextRound(s, now);
  return {
    ...s, stage: 'turn', stageEnds: now + TURN_MAX_MS, turnCount: s.turnCount + 1,
    turn: { playerId, question: q, start: now, pick: null, helpers: {} },
  };
}

function turnAnswer(s: TriviaState, playerId: string, choice: number, now: number): TriviaState {
  const t = s.turn;
  if (s.stage !== 'turn' || !t || !s.players[playerId]) return s;
  if (!Number.isInteger(choice) || choice < 0 || choice >= t.question.answers.length) return s;
  if (playerId !== t.playerId) {
    if (t.helpers[playerId]) return s;
    return { ...s, turn: { ...t, helpers: { ...t.helpers, [playerId]: { choice, at: now } } } };
  }
  const right = choice === t.question.correct;
  const players = { ...s.players };
  const gained: Record<string, number> = {};
  const little = players[playerId] as TriviaState['players'][string];
  gained[playerId] = right ? BASE_POINTS * multiplier('little') : LITTLE_TRY_POINTS;
  players[playerId] = { ...little, score: little.score + (gained[playerId] ?? 0) };
  for (const [hid, h] of Object.entries(t.helpers)) {
    const hp = players[hid];
    if (!hp || h.choice !== t.question.correct) continue;
    gained[hid] = HELPER_POINTS;
    players[hid] = { ...hp, score: hp.score + HELPER_POINTS };
  }
  return {
    ...s, players, gained, stage: 'turnReveal', stageEnds: now + TURN_REVEAL_MS,
    turn: { ...t, pick: { choice, at: now } },
    log: [...s.log, { questionId: t.question.id, right, ms: now - t.start }],
  };
}

/** After a round: the leaderboard, then the next round (or the final scores after the last one). */
function nextRound(s: TriviaState, now: number): TriviaState {
  if (s.round >= s.rounds) return finish(s);
  return { ...s, stage: 'standings', stageEnds: now + STANDINGS_MS, turn: null };
}

function scoresNow(s: TriviaState): Record<string, number> {
  return Object.fromEntries(Object.entries(s.players).map(([id, p]) => [id, p.score]));
}

/** Rank by score, best first; equal scores share a rank. */
function rankOf(scores: Record<string, number>): Record<string, number> {
  const sorted = Object.values(scores).sort((a, b) => b - a);
  return Object.fromEntries(Object.entries(scores).map(([id, sc]) => [id, sorted.indexOf(sc) + 1]));
}

function leaderboard(s: TriviaState): NonNullable<TriviaHostView['standings']> {
  const now = scoresNow(s);
  const before = { ...now, ...(s.roundStartScores ?? {}) };
  const rank = rankOf(now);
  const prev = rankOf(before);
  return Object.keys(now)
    .map((id) => ({ id, score: now[id]!, gained: now[id]! - (before[id] ?? now[id]!), rank: rank[id]!, prevRank: prev[id]! }))
    .sort((a, b) => a.rank - b.rank || b.gained - a.gained);
}

function finish(s: TriviaState): TriviaState {
  return { ...s, stage: 'final', stageEnds: null, turn: s.turn && s.stage === 'turnReveal' ? s.turn : null };
}

// ---- views ----

const publicQ = (q: TQuestion): TPublicQuestion => ({ prompt: q.prompt, kind: q.kind, answers: q.answers, category: q.category });

function standings(s: TriviaState) {
  const ids = Object.keys(s.players).sort((a, b) => (s.players[b]?.score ?? 0) - (s.players[a]?.score ?? 0));
  let rank = 0;
  let last = Number.NaN;
  return ids.map((id, i) => {
    const score = s.players[id]?.score ?? 0;
    if (score !== last) { rank = i + 1; last = score; }
    return { id, score, rank, superstar: s.players[id]?.band === 'little' };
  });
}

export function hostView(s: TriviaState): TriviaHostView {
  const showing = s.stage === 'question' || s.stage === 'suspense' || s.stage === 'reveal';
  const tvQ = s.tvBand ? s.current[s.tvBand] : undefined;
  const reveal = s.stage === 'reveal';
  const players: TPlayerStatus[] = Object.entries(s.players).map(([id, p]) => {
    const q = s.current[p.band];
    const answered = showing && p.band !== 'little' && !!q;
    return {
      id, score: p.score,
      locked: s.stage === 'question' || s.stage === 'suspense' ? !!s.picks[id] : s.stage === 'turn' ? !!s.turn?.helpers[id] : false,
      right: reveal && answered ? s.picks[id]?.choice === q?.correct : null,
      gained: reveal || s.stage === 'turnReveal' ? s.gained[id] ?? 0 : 0,
    };
  });
  const t = s.turn;
  return {
    stage: s.stage, round: s.round, rounds: s.rounds, deadline: s.stage === 'question' ? s.questionEnds : null, opensAt: s.stage === 'question' ? s.questionStart : null,
    question: showing && tvQ ? publicQ(tvQ) : null,
    splitBands: showing && Object.keys(s.current).length > 1,
    correct: reveal && tvQ ? tvQ.correct : null,
    explain: reveal && tvQ ? tvQ.explain || null : s.stage === 'turnReveal' && t ? t.question.explain || null : null,
    players,
    turn: t && (s.stage === 'turn' || s.stage === 'turnReveal') ? {
      playerId: t.playerId, question: publicQ(t.question),
      correct: s.stage === 'turnReveal' ? t.question.correct : null,
      picked: t.pick?.choice ?? null, helpers: Object.keys(t.helpers).length,
    } : null,
    standingsEnd: s.stage === 'standings' ? s.stageEnds : null,
    nextCategory: s.stage === 'standings' ? peekTvQuestion(s)?.category ?? null : null,
    standings: s.stage === 'standings' ? leaderboard(s) : null,
    final: s.stage === 'final' ? standings(s) : null,
  };
}

export function playerView(s: TriviaState, playerId: string): TriviaPlayerView {
  const p = s.players[playerId];
  const table = standings(s);
  const mine = table.find((r) => r.id === playerId);
  const base = {
    stage: s.stage, round: s.round, rounds: s.rounds, score: p?.score ?? 0, rank: mine?.rank ?? table.length + 1,
    deadline: s.stage === 'question' ? s.questionEnds : null, opensAt: s.stage === 'question' ? s.questionStart : null,
    question: null, showPrompt: false, picked: null, result: null, turn: null, final: null,
  } satisfies TriviaPlayerView;
  if (!p) return base;
  const q = s.current[p.band];
  const t = s.turn;
  const view: TriviaPlayerView = { ...base };
  if ((s.stage === 'question' || s.stage === 'suspense' || s.stage === 'reveal') && q && p.band !== 'little') {
    view.question = publicQ(q);
    view.showPrompt = p.band !== s.tvBand;
    view.picked = s.picks[playerId]?.choice ?? null;
    if (s.stage === 'reveal') {
      view.result = { right: s.picks[playerId]?.choice === q.correct, gained: s.gained[playerId] ?? 0, correctText: q.answers[q.correct]?.text ?? '' };
    }
  }
  if (t && (s.stage === 'turn' || s.stage === 'turnReveal')) {
    const isMe = t.playerId === playerId;
    view.turn = {
      isMe, playerId: t.playerId, question: publicQ(t.question),
      picked: isMe ? t.pick?.choice ?? null : t.helpers[playerId]?.choice ?? null,
      correct: s.stage === 'turnReveal' ? t.question.correct : null,
    };
    if (s.stage === 'turnReveal' && (isMe || s.gained[playerId])) {
      view.result = { right: isMe ? t.pick?.choice === t.question.correct : true, gained: s.gained[playerId] ?? 0, correctText: t.question.answers[t.question.correct]?.text ?? '' };
    }
  }
  if (s.stage === 'final' && mine) view.final = { rank: mine.rank, of: table.length, superstar: mine.superstar };
  return view;
}
