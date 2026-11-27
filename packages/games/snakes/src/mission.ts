// Missions (ADR 0022): short trivia rounds that fill the pot, with a target the Snakes quietly try to miss.
// Three formats rotate by round: everyone answers, the chain, and pairs. Reveals show totals only, never who was
// right (ADR 0023), so a wrong answer and the Snakes' Overboard can't be traced.
import { BANDS, bandRank, spiceAllows, type Band } from '@smartmouth/protocol';
import * as R from './rng.ts';
import type { MQuestion, MissionFormat, MissionState, SMissionPublic, SnakesPlayerView, SnakesState } from './types.ts';

export const MISSION_QUESTIONS = 6;
export const CHAIN_TURNS = 8;
export const TALLY_MS = 4_000;
export const MISSION_REVEAL_MS = 9_000;
/** A mission with nothing to ask (no questions for these ages) still passes, briefly. */
export const EMPTY_MISSION_MS = 4_000;
export const POT_PER_RIGHT = 100;
export const CHAIN_STEP = 50;
export const TARGET_BONUS = 500;
export const TARGET_SHARE = 0.75;

const FORMATS: MissionFormat[] = ['everyone', 'chain', 'pairs'];
/** This round's mission format: everyone, then the chain, then pairs, and round again. */
export const formatFor = (round: number): MissionFormat => FORMATS.at((round - 1) % FORMATS.length) as MissionFormat;

/** Seconds to answer: younger bands get longer (as in trivia). */
export function answerMs(bands: Band[]): number {
  if (bands.includes('kids')) return 30_000;
  if (bands.includes('tweens')) return 25_000;
  return 20_000;
}

type After = (s: SnakesState, now: number) => SnakesState;

/** Who answers in a mission: the living and the Ghosts (a Ghost's right answer still fills the pot). */
const answerers = (s: SnakesState) => s.order.filter((id) => s.players[id]?.status === 'alive' || s.players[id]?.status === 'ghost');

function take(s: SnakesState, band: Band): [MQuestion | null, SnakesState] {
  const q = [...(s.queues[band] ?? [])];
  while (q.length) {
    const next = q.shift() as MQuestion;
    if (spiceAllows(s.spice, next.spice) && next.kind !== 'picture') return [next, { ...s, queues: { ...s.queues, [band]: q } }];
  }
  return [null, { ...s, queues: { ...s.queues, [band]: q } }];
}

export function startMission(s0: SnakesState, now: number): SnakesState {
  let s: SnakesState = { ...s0, vote: null, banished: null, breakfast: null };
  for (const id of s.order) {
    const p = s.players[id];
    if (p) s = { ...s, players: { ...s.players, [id]: { ...p, missionRight: 0 } } };
  }
  const format = formatFor(s.round);
  const who = answerers(s);
  let rng = s.rng;
  let order: string[];
  [order, rng] = R.shuffle(rng, who);
  s = { ...s, rng };
  const pairs: Array<[string, string]> = [];
  if (format === 'pairs') {
    for (let i = 0; i + 1 < order.length; i += 2) pairs.push([order[i] as string, order[i + 1] as string]);
    // An odd one out pairs with the first player as well.
    if (order.length % 2 === 1 && order.length > 1) pairs.push([order.at(-1) as string, order[0] as string]);
  }
  const count = format === 'chain' ? CHAIN_TURNS : MISSION_QUESTIONS;
  const possible = format === 'chain' ? count : format === 'pairs' ? count * pairs.length : count * who.length;
  const m: MissionState = {
    format, index: 0, count, step: 'question', stepEnds: now, questions: {}, chainOrder: order, pairs, picks: {},
    overboard: null, overboardUsed: false, overboardSaid: false, right: 0, asked: 0, streak: 0, bonus: 0,
    target: Math.max(1, Math.ceil(possible * TARGET_SHARE)), potBefore: s.pot, result: null,
  };
  s = { ...s, mission: m, stage: 'mission', stageStart: now, stageEnds: null };
  const first = askStep(s, now);
  if (!first) return { ...s, mission: null, stageEnds: now + EMPTY_MISSION_MS };
  return first;
}

/** Hands out this step's question(s). Null when there's nothing left to ask. */
function askStep(s0: SnakesState, now: number): SnakesState | null {
  let s = s0;
  const m = s.mission as MissionState;
  const who = m.format === 'chain'
    ? [m.chainOrder.at(m.index % Math.max(1, m.chainOrder.length)) as string].filter(Boolean)
    : answerers(s).filter((id) => m.format !== 'pairs' || m.pairs.some(([a, b]) => a === id || b === id));
  const questions: Record<string, MQuestion> = {};
  for (const id of who) {
    const band = s.players[id]?.band as Band;
    let q: MQuestion | null;
    [q, s] = take(s, band);
    if (q) questions[id] = q;
  }
  if (Object.keys(questions).length === 0) return null;
  const bands = Object.keys(questions).map((id) => s.players[id]?.band as Band);
  return {
    ...s,
    mission: { ...m, step: 'question', questions, picks: {}, overboard: null, overboardSaid: false, stepEnds: now + answerMs(bands) },
  };
}

export function missionTick(s: SnakesState, now: number, after: After): SnakesState {
  const m = s.mission;
  if (!m) return s.stageEnds !== null && now >= s.stageEnds ? after(s, now) : s;
  if (now < m.stepEnds) return s;
  if (m.step === 'question') return tally(s, now);
  // The tally has been shown: the next question, or the mission is over.
  if (m.index + 1 < m.count) {
    const next = askStep({ ...s, mission: { ...m, index: m.index + 1 } }, now);
    if (next) return next;
  }
  return finishMission(s, now, after);
}

function tally(s0: SnakesState, now: number): SnakesState {
  let s = s0;
  const m = s.mission as MissionState;
  const rightNow: Record<string, boolean> = {};
  for (const [id, q] of Object.entries(m.questions)) {
    const pick = m.picks[id];
    const right = pick === q.correct;
    rightNow[id] = right;
    s = { ...s, log: [...s.log, { questionId: q.id, right, ms: null }] };
    if (right) {
      const p = s.players[id];
      if (p) s = { ...s, players: { ...s.players, [id]: { ...p, missionRight: p.missionRight + 1 } } };
    }
  }
  // The Overboard drops one answer from the count (a right one is lost; a wrong one changes nothing).
  const counted = { ...rightNow };
  if (m.overboard && m.overboard in counted) counted[m.overboard] = false;
  let right = 0;
  let asked = 0;
  let pot = s.pot;
  let streak = m.streak;
  let bonus = m.bonus;
  if (m.format === 'pairs') {
    for (const [a, b] of m.pairs) {
      if (!(a in m.questions) && !(b in m.questions)) continue;
      asked++;
      if (counted[a] && counted[b]) { right++; pot += POT_PER_RIGHT * 2; }
    }
  } else if (m.format === 'chain') {
    for (const id of Object.keys(m.questions)) {
      asked++;
      if (counted[id]) { right++; streak++; const add = POT_PER_RIGHT + CHAIN_STEP * (streak - 1); pot += add; bonus += add - POT_PER_RIGHT; }
      else streak = 0;
    }
  } else {
    for (const id of Object.keys(m.questions)) { asked++; if (counted[id]) { right++; pot += POT_PER_RIGHT; } }
  }
  return {
    ...s, pot,
    mission: {
      ...m, step: 'tally', stepEnds: now + TALLY_MS, right: m.right + right, asked: m.asked + asked, streak, bonus,
      overboardSaid: m.overboard !== null,
    },
  };
}

function finishMission(s0: SnakesState, now: number, after: After): SnakesState {
  let s = s0;
  const m = s.mission as MissionState;
  const hit = m.right >= m.target;
  let pot = s.pot + (hit ? TARGET_BONUS : 0);
  // The shield goes to the mission's top scorer among the living (ties at random). It's private.
  const alive = s.order.filter((id) => s.players[id]?.status === 'alive');
  const best = Math.max(0, ...alive.map((id) => s.players[id]?.missionRight ?? 0));
  let shieldTo: string | null = null;
  if (best > 0) {
    let rng = s.rng;
    let pick: string | undefined;
    [pick, rng] = R.pick(rng, alive.filter((id) => (s.players[id]?.missionRight ?? 0) === best));
    s = { ...s, rng };
    shieldTo = pick ?? null;
  }
  if (shieldTo) {
    const p = s.players[shieldTo];
    if (p) s = { ...s, players: { ...s.players, [shieldTo]: { ...p, shield: true } } };
  }
  const result = { hit, shieldTo, dagger: !hit, gained: pot - m.potBefore };
  s = { ...s, pot, daggers: s.daggers + (hit ? 0 : 1), mission: { ...m, result } };
  s = { ...s, history: [...s.history, { kind: 'mission', round: s.round, right: m.right, asked: m.asked, hit, overboard: m.overboardUsed }] };
  return after(s, now);
}

/** An answer, or the Snakes' Overboard. Everyone answering ends the step at once. */
export function missionIntent(
  s: SnakesState, id: string, i: { type: 'answer'; choice: number } | { type: 'overboard'; target: string }, now: number, _after: After,
): SnakesState {
  const m = s.mission;
  if (!m || m.step !== 'question' || now >= m.stepEnds) return s;
  if (i.type === 'overboard') {
    const p = s.players[id];
    if (!p || p.status !== 'alive' || p.role !== 'snake' || m.overboardUsed) return s;
    if (i.target === id || !(i.target in m.questions)) return s;
    return { ...s, mission: { ...m, overboard: i.target, overboardUsed: true } };
  }
  const q = m.questions[id];
  if (!q || id in m.picks || !Number.isInteger(i.choice) || i.choice < 0 || i.choice >= q.answers.length) return s;
  const picks = { ...m.picks, [id]: i.choice };
  const next = { ...s, mission: { ...m, picks } };
  const done = Object.keys(m.questions).every((x) => x in picks);
  return done ? tally(next, now) : next;
}

/** The question the TV shows: the oldest band's (everyone, pairs), or the chain player's. */
function tvQuestion(s: SnakesState, m: MissionState): MQuestion | null {
  const ids = Object.keys(m.questions);
  if (ids.length === 0) return null;
  const oldest = [...ids].sort((a, b) => bandRank(s.players[b]?.band as Band) - bandRank(s.players[a]?.band as Band))[0] as string;
  return m.questions[oldest] ?? null;
}

export function missionPublic(s: SnakesState): SMissionPublic {
  const m = s.mission as MissionState;
  const q = tvQuestion(s, m);
  const turn = m.format === 'chain' ? (Object.keys(m.questions)[0] ?? null) : null;
  return {
    format: m.format, index: m.index, count: m.count, step: m.step, deadline: m.stepEnds,
    question: q ? { prompt: q.prompt, answers: q.answers, category: q.category } : null,
    turn, pairs: m.pairs, locked: Object.keys(m.picks).length, answering: Object.keys(m.questions).length,
    right: m.right, asked: m.asked, target: m.target, streak: m.streak, bonus: m.bonus, overboardSaid: m.overboardSaid,
    result: m.result ? { hit: m.result.hit, gained: m.result.gained, dagger: m.result.dagger, shieldGiven: m.result.shieldTo !== null } : null,
  };
}

export function missionForPlayer(s: SnakesState, id: string): SnakesPlayerView['mission'] {
  const m = s.mission;
  const p = s.players[id];
  if (!m || !p) return null;
  const mine = m.questions[id];
  const tv = tvQuestion(s, m);
  const snake = p.role === 'snake' && p.status === 'alive';
  return {
    step: m.step, deadline: m.stepEnds,
    question: mine && m.step === 'question' ? { prompt: mine.prompt, answers: mine.answers } : null,
    showPrompt: !!mine && mine.id !== tv?.id,
    myTurn: !!mine,
    picked: m.picks[id] ?? null,
    overboard: snake ? { available: !m.overboardUsed && m.step === 'question', candidates: Object.keys(m.questions).filter((x) => x !== id) } : null,
    result: s.stage === 'missionReveal' ? { shield: p.shield } : null,
  };
}

/** Band names for the TV's "everyone's got their own question" strip. */
export const bandLabel = (b: Band) => BANDS.find((x) => x.id === b)?.label ?? b;
