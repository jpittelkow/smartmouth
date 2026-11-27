// Snake Manor's rules: a pure state machine (ADR 0004, 0006, 0022, 0023). No sockets, timers or I/O: the platform
// calls `tick` when `nextDeadline` passes, and everything random comes from the seed in the state.
//
// A round: Mission (trivia for the pot) → Round Table (debate, then a secret vote, revealed one seal at a time) →
// Banishment → Night (identical phone screens; the Snakes murder) → Breakfast → the next Mission. Near the end,
// the living vote: End, or Banish again.
import { bandRank, type Band, type GamePlayer, type Spice } from '@smartmouth/protocol';
import * as R from './rng.ts';
import { missionIntent, missionTick, startMission as runMission, missionPublic, missionForPlayer, formatFor, tvQuestion, MISSION_REVEAL_MS } from './mission.ts';
import type {
  BreakfastState, DaggerKind, NightScreen, Role, SPlayer, SPublicPlayer, SnakesContent, SnakesHostView, SnakesIntent,
  SnakesPlayerView, SnakesSettings, SnakesState, Stage, Words,
  BriefId,
} from './types.ts';

export const DEAL_MS = 15_000;
/** A rules card stays up at least this long, and until Salty finishes explaining (ADR 0025). */
export const BRIEF_MS = 12_000;
export const BRIEFS: readonly BriefId[] = ['game', 'mission-everyone', 'mission-chain', 'mission-pairs', 'table', 'night', 'endgame'];
export const DEBATE_MS = 180_000;
export const VOTE_MS = 45_000;
export const REVEAL_PER_VOTE_MS = 2_500;
export const REVEAL_TAIL_MS = 4_000;
export const BANISH_MS = 15_000;
/**
 * The banishment's beats as shares of its length (ADR 0024 beat sheet; Full drama: 15 s). The TV draws them and the
 * server times Salty's two-part line to them: the setup at `was`, the payoff just after the role lands.
 */
export const BANISH_BEATS = { dark: 0, name: 3.5 / 15, push: 5 / 15, was: 8 / 15, hold: 9.5 / 15, land: 11 / 15 } as const;
export const NIGHT_MS = 60_000;
/** On a recruitment night the Snakes' pick closes this far in, and the offer goes out. */
export const OFFER_AT_MS = 30_000;
export const BREAKFAST_MS = 12_000;
export const ENDVOTE_MS = 45_000;
export const UNMASK_PER_MS = 5_000;
export const UNMASK_TAIL_MS = 6_000;
/** Quick drama: staged reveals run at this share of their Full length (ADR 0024). */
export const QUICK_SHARE = 0.6;
export const GHOST_BET_POINTS = 150;
export const SHARP_EYE_POINTS = 200;
export const CHAT_MAX = 60;
/** The same tap chips on every night screen (ADR 0023): set phrases; player names are added by the phone. */
export const CHIPS = ['I’m sure', 'Not sure', 'Too quiet', 'Watch them', 'Tonight', 'Trust me'];

/** How many Snakes for a starting player count (ADR 0022). */
export const snakeCount = (n: number) => (n <= 6 ? 1 : n <= 9 ? 2 : 3);
/** The endgame starts when this many are left. */
export const endSizeFor = (n: number) => (n <= 7 ? 3 : 4);
/** Kids 6–8 are always Guests (ADR 0022); Tweens and older can be either. */
export const canBeSnake = (b: Band) => bandRank(b) >= bandRank('tweens');

export function words(spice: Spice): Words {
  return spice === 'mild' || spice === 'spicy'
    ? { murdered: 'vanished in the night', banished: 'shown the door' }
    : { murdered: 'murdered', banished: 'banished' };
}

// ---------- setup ----------

export function init(players: readonly GamePlayer[], settings: SnakesSettings, content: SnakesContent, now: number): SnakesState {
  let rng = (settings.seed >>> 0) || 1;
  const order = players.map((p) => p.id);
  const eligible = players.filter((p) => canBeSnake(p.band)).map((p) => p.id);
  let shuffled: string[];
  [shuffled, rng] = R.shuffle(rng, eligible);
  const snakes = new Set(shuffled.slice(0, Math.min(snakeCount(players.length), shuffled.length)));
  const ps: Record<string, SPlayer> = {};
  for (const p of players) {
    ps[p.id] = {
      band: p.band, role: snakes.has(p.id) ? 'snake' : 'guest', status: 'alive', kid: !canBeSnake(p.band),
      shield: false, silenced: false, note: null, votes: 0, snakeVotes: 0, bet: [], missionRight: 0,
    };
  }
  return {
    seed: settings.seed, rng, drama: settings.drama, spice: settings.spice, startCount: players.length,
    endSize: endSizeFor(players.length), stage: 'briefing', stageStart: now, stageEnds: now + BRIEF_MS, round: 1,
    players: ps, order, pot: 0, daggers: 0, peeks: [], chat: [], queues: content, mission: null, vote: null,
    banished: null, night: null, breakfast: null, endgame: false, endVotes: {}, forceRecruit: false, mayRecruit: false,
    unmasked: 0, log: [], history: [], talk: [], brief: 'game', briefed: [],
  };
}

// ---------- helpers ----------

export const living = (s: SnakesState) => s.order.filter((id) => s.players[id]?.status === 'alive');
const ghosts = (s: SnakesState) => s.order.filter((id) => s.players[id]?.status === 'ghost');
const role = (s: SnakesState, id: string): Role | undefined => s.players[id]?.role;
const aliveSnakes = (s: SnakesState) => living(s).filter((id) => role(s, id) === 'snake');
const aliveGuests = (s: SnakesState) => living(s).filter((id) => role(s, id) === 'guest');
const recruitable = (s: SnakesState) => aliveGuests(s).filter((id) => !s.players[id]?.kid);

export const staged = (s: SnakesState, ms: number) => (s.drama === 'quick' ? Math.round(ms * QUICK_SHARE) : ms);

function to(s: SnakesState, stage: Stage, now: number, ms: number | null): SnakesState {
  return { ...s, stage, stageStart: now, stageEnds: ms === null ? null : now + ms };
}

function setPlayer(s: SnakesState, id: string, patch: Partial<SPlayer>): SnakesState {
  const p = s.players[id];
  return p ? { ...s, players: { ...s.players, [id]: { ...p, ...patch } } } : s;
}

/** The most-picked of `ids` (ties broken at random), up to `n` of them. */
function topPicks(s: SnakesState, picks: string[], n: number): [string[], SnakesState] {
  const count = new Map<string, number>();
  for (const id of picks) count.set(id, (count.get(id) ?? 0) + 1);
  let rng = s.rng;
  let ranked: string[];
  [ranked, rng] = R.shuffle(rng, [...count.keys()]);
  ranked.sort((a, b) => (count.get(b) ?? 0) - (count.get(a) ?? 0));
  return [ranked.slice(0, n), { ...s, rng }];
}

// ---------- the loop ----------

export function nextDeadline(s: SnakesState): number | null {
  if (s.stage === 'night' && s.night?.offerAt != null && s.stageEnds !== null) return Math.min(s.night.offerAt, s.stageEnds);
  if (s.stage === 'mission' && s.mission) return s.mission.stepEnds;
  return s.stageEnds;
}

/** Reveal stages wait for Salty to finish talking. The debate, vote and night clocks never move (ADR 0023). */
const HOLDABLE: ReadonlySet<Stage> = new Set(['deal', 'briefing', 'missionReveal', 'voteReveal', 'banish', 'breakfast', 'unmask']);
export function holdStage(s: SnakesState, until: number): SnakesState {
  if (!HOLDABLE.has(s.stage) || s.stageEnds === null || s.stageEnds >= until) return s;
  return { ...s, stageEnds: until };
}

/** The game was paused for `ms`: every clock moves forward by that much. */
export function shiftTime(s: SnakesState, ms: number): SnakesState {
  if (ms <= 0) return s;
  return {
    ...s, stageStart: s.stageStart + ms, stageEnds: s.stageEnds === null ? null : s.stageEnds + ms,
    mission: s.mission ? { ...s.mission, stepEnds: s.mission.stepEnds + ms } : null,
    night: s.night ? { ...s.night, offerAt: s.night.offerAt === null ? null : s.night.offerAt + ms } : null,
  };
}

export function isOver(s: SnakesState): boolean {
  return s.stage === 'final';
}

export function tick(s: SnakesState, now: number): SnakesState {
  if (s.stage === 'mission') return missionTick(s, now, afterMission);
  if (s.stage === 'night' && s.night?.offerAt != null && now >= s.night.offerAt) return sendOffer(s);
  if (s.stageEnds === null || now < s.stageEnds) return s;
  return advance(s, now);
}

/** The current stage's wait is over (by the clock, or a grown-up pressed Next). */
function advance(s: SnakesState, now: number): SnakesState {
  switch (s.stage) {
    case 'deal': return startMission(s, now);
    case 'briefing': return afterBrief(s, now);
    case 'missionReveal': return startDebate(s, now);
    case 'debate': return startVote(s, living(s), false, now);
    case 'vote': return closeVote(s, now);
    case 'voteReveal': return s.banished ? to(setPlayer(s, s.banished, { status: 'banished' }), 'banish', now, staged(s, BANISH_MS)) : afterTable(s, now);
    case 'banish': return afterTable(s, now);
    case 'night': return resolveNight(s, now);
    case 'breakfast': return afterBreakfast(s, now);
    case 'endVote': return closeEndVote(s, now);
    case 'unmask': {
      const total = living(s).length;
      if (s.unmasked < total) {
        const unmasked = s.unmasked + 1;
        return { ...s, unmasked, stageEnds: now + staged(s, unmasked < total ? UNMASK_PER_MS : UNMASK_TAIL_MS) };
      }
      return finish(s, now);
    }
    default: return s;
  }
}

// ---------- briefings (ADR 0025) ----------

/**
 * Before the table first meets something, a rules card: the `briefing` stage, no clock but its own. When it ends,
 * the stage it was explaining starts fresh, so no question timer runs while Salty talks.
 */
function briefFirst(s: SnakesState, id: BriefId, now: number, go: (s: SnakesState) => SnakesState): SnakesState {
  if (s.briefed.includes(id)) return go(s);
  return to({ ...s, brief: id }, 'briefing', now, BRIEF_MS);
}

function afterBrief(s0: SnakesState, now: number): SnakesState {
  const id = s0.brief;
  const s = { ...s0, brief: null, briefed: id ? [...s0.briefed, id] : s0.briefed };
  switch (id) {
    case 'game': return to(s, 'deal', now, DEAL_MS);
    case 'table': return startDebate(s, now);
    case 'night': return startNight(s, now);
    case 'endgame': return startEndVote(s, now);
    default: return startMission(s, now);
  }
}

function startMission(s: SnakesState, now: number): SnakesState {
  return briefFirst(s, `mission-${formatFor(s.round)}`, now, (x) => runMission(x, now));
}

/** The question on the TV now (the one Salty reads), if a mission question is up. */
export function missionQuestion(s: SnakesState) {
  return s.stage === 'mission' && s.mission?.step === 'question' ? tvQuestion(s, s.mission) : null;
}

function afterMission(s: SnakesState, now: number): SnakesState {
  return to(s, 'missionReveal', now, staged(s, MISSION_REVEAL_MS));
}

function startDebate(s0: SnakesState, now: number): SnakesState {
  return briefFirst(s0, 'table', now, (s) => to({ ...s, vote: null, banished: null }, 'debate', now, DEBATE_MS));
}

function startVote(s: SnakesState, candidates: string[], revote: boolean, now: number): SnakesState {
  return to({ ...s, vote: { candidates, revote, votes: {}, order: [] } }, 'vote', now, VOTE_MS);
}

const voters = (s: SnakesState) => living(s).filter((id) => !s.players[id]?.silenced);

function closeVote(s0: SnakesState, now: number): SnakesState {
  const v = s0.vote;
  if (!v) return afterTable(s0, now);
  const cast = v.order.map((id) => v.votes[id]).filter((x): x is string => !!x && s0.players[x]?.status === 'alive');
  if (cast.length === 0) return to({ ...s0, banished: null }, 'voteReveal', now, staged(s0, REVEAL_TAIL_MS));
  const count = new Map<string, number>();
  for (const id of cast) count.set(id, (count.get(id) ?? 0) + 1);
  const top = Math.max(...count.values());
  const tied = [...count.keys()].filter((id) => count.get(id) === top);
  let s = s0;
  let target: string | undefined;
  if (tied.length > 1 && !v.revote) {
    // A tie: a revote between the tied players only.
    return startVote(s, tied, true, now);
  }
  if (tied.length > 1) {
    let rng = s.rng;
    [target, rng] = R.pick(rng, tied);
    s = { ...s, rng };
  } else {
    target = tied[0];
  }
  // The sharp-eye bonus counts each deciding vote a Guest casts.
  for (const voter of v.order) {
    const p = s.players[voter];
    const choice = v.votes[voter];
    if (!p || !choice || p.role !== 'guest') continue;
    s = setPlayer(s, voter, { votes: p.votes + 1, snakeVotes: p.snakeVotes + (role(s, choice) === 'snake' ? 1 : 0) });
  }
  const votes = v.order.map((from) => ({ from, to: v.votes[from] as string }));
  s = { ...s, history: [...s.history, { kind: 'votes', round: s.round, votes }] };
  return to({ ...s, banished: target ?? null }, 'voteReveal', now, staged(s, v.order.length * REVEAL_PER_VOTE_MS + REVEAL_TAIL_MS));
}

/** After the Round Table: the banished player is out. What's next: the night, the endgame, or the end. */
function afterTable(s0: SnakesState, now: number): SnakesState {
  let s = s0;
  for (const id of s.order) if (s.players[id]?.silenced) s = setPlayer(s, id, { silenced: false });
  const wasSnake = s.banished !== null && role(s, s.banished) === 'snake';
  if (s.banished) s = { ...s, history: [...s.history, { kind: 'banished', round: s.round, id: s.banished, role: role(s, s.banished) as Role }] };
  const alive = living(s).length;
  if (aliveSnakes(s).length === 0) {
    // The last Snake is out. With 5 or more left, Salty recruits a new one tonight; otherwise the Guests win.
    if (!s.endgame && alive >= 5 && recruitable(s).length > 0) return startNight({ ...s, forceRecruit: true }, now);
    return finish(s, now);
  }
  if (wasSnake) s = { ...s, mayRecruit: true };
  if (s.endgame) return alive <= 2 ? startUnmask(s, now) : startEndVote(s, now);
  if (alive <= s.endSize) return startEndVote({ ...s, endgame: true }, now);
  return startNight(s, now);
}

function startNight(s1: SnakesState, now: number): SnakesState {
  if (!s1.briefed.includes('night')) return briefFirst(s1, 'night', now, (x) => x);
  let s = s1;
  const number = s.round;
  let recruit: 'none' | 'offer' | 'forced' = s.forceRecruit ? 'forced' : s.mayRecruit && recruitable(s).length > 0 ? 'offer' : 'none';
  let offer: { to: string; answer: boolean | null } | null = null;
  if (recruit === 'forced') {
    let chosen: string | undefined;
    let rng = s.rng;
    [chosen, rng] = R.pick(rng, recruitable(s));
    s = { ...s, rng };
    if (chosen) {
      s = setPlayer(s, chosen, { role: 'snake' });
      s = { ...s, chat: [...s.chat, { from: 'salty', text: 'Salty chose you. You’re a Snake now. The manor insists.' }] };
      offer = { to: chosen, answer: true };
    } else {
      recruit = 'none';
    }
  }
  const noMurder = (number === 1 && s.startCount <= 6) || recruit !== 'none';
  s = {
    ...s, forceRecruit: false, mayRecruit: false,
    night: { number, noMurder, recruit, picks: {}, locked: {}, offer, offerAt: recruit === 'offer' ? now + OFFER_AT_MS : null, dagger: null },
  };
  return to(s, 'night', now, NIGHT_MS);
}

/** A recruitment night: the Snakes' pick closes and the offer goes to that Guest. */
function sendOffer(s0: SnakesState): SnakesState {
  const n = s0.night;
  if (!n || n.offer || n.recruit !== 'offer') return s0.night ? { ...s0, night: { ...s0.night, offerAt: null } } : s0;
  const pool = recruitable(s0);
  const picks = aliveSnakes(s0).flatMap((id) => n.picks[id] ?? []).filter((id) => pool.includes(id));
  let [chosen, s] = topPicks(s0, picks, 1);
  if (chosen.length === 0) {
    let rng = s.rng;
    let any: string | undefined;
    [any, rng] = R.pick(rng, pool);
    s = { ...s, rng };
    chosen = any ? [any] : [];
  }
  const target = chosen[0];
  return { ...s, night: { ...n, offerAt: null, offer: target ? { to: target, answer: null } : null } };
}

function resolveNight(s0: SnakesState, now: number): SnakesState {
  let s = s0.night?.offerAt != null ? sendOffer(s0) : s0;
  const n = s.night;
  if (!n) return startMission(s, now);
  if (n.offer?.answer === true && n.recruit === 'offer') s = setPlayer(s, n.offer.to, { role: 'snake' });

  const murdered: string[] = [];
  let saved = false;
  if (!n.noMurder) {
    const count = n.dagger?.kind === 'double' ? 2 : 1;
    const pool = aliveGuests(s);
    const picks = aliveSnakes(s).flatMap((id) => n.picks[id] ?? []).filter((id) => pool.includes(id));
    let [targets, s1] = topPicks(s, picks, count);
    s = s1;
    // Nobody picked: the night still claims someone (a game can't stall on an idle Snake).
    let rng = s.rng;
    let rest = pool.filter((id) => !targets.includes(id));
    while (targets.length < count && rest.length) {
      let extra: string | undefined;
      [extra, rng] = R.pick(rng, rest);
      if (!extra) break;
      targets = [...targets, extra];
      rest = rest.filter((id) => id !== extra);
    }
    s = { ...s, rng };
    for (const id of targets) {
      if (s.players[id]?.shield) saved = true;
      else { s = setPlayer(s, id, { status: 'ghost' }); murdered.push(id); }
    }
  }
  if (n.dagger?.kind === 'silence' && n.dagger.target) s = setPlayer(s, n.dagger.target, { silenced: true });

  // Hints from the Guests' suspect votes (never who), and the Ghosts' bets.
  const suspectCounts = new Map<string, number>();
  for (const id of s.order) {
    const p = s.players[id];
    const pick = n.picks[id]?.[0];
    if (p?.status === 'alive' && p.role === 'guest' && pick && !(n.offer?.to === id)) suspectCounts.set(pick, (suspectCounts.get(pick) ?? 0) + 1);
    if (p?.status === 'ghost' && n.picks[id]) s = setPlayer(s, id, { bet: n.picks[id] ?? [] });
  }
  const same = Math.max(0, ...suspectCounts.values());
  for (const id of s.order) if (s.players[id]?.shield) s = setPlayer(s, id, { shield: false });

  const breakfast: BreakfastState = {
    murdered, saved, saltyRecruited: n.recruit === 'forced', sameSuspect: same >= 2 ? same : 0,
    quiet: n.noMurder,
  };
  const morning = { kind: 'morning' as const, round: s.round, murdered, saved, saltyRecruited: breakfast.saltyRecruited };
  return to({ ...s, night: null, breakfast, round: s.round + 1, history: [...s.history, morning] }, 'breakfast', now, staged(s, BREAKFAST_MS));
}

function afterBreakfast(s: SnakesState, now: number): SnakesState {
  if (aliveSnakes(s).length === 0) return finish(s, now);
  if (living(s).length <= s.endSize) return startEndVote({ ...s, endgame: true }, now);
  return startMission(s, now);
}

function startEndVote(s0: SnakesState, now: number): SnakesState {
  if (!s0.briefed.includes('endgame')) return briefFirst(s0, 'endgame', now, (x) => x);
  const s = s0;
  return to({ ...s, endVotes: {} }, 'endVote', now, ENDVOTE_MS);
}

function closeEndVote(s: SnakesState, now: number): SnakesState {
  const alive = living(s);
  const unanimous = alive.length > 0 && alive.every((id) => s.endVotes[id] === true);
  return unanimous ? startUnmask(s, now) : startDebate(s, now);
}

function startUnmask(s: SnakesState, now: number): SnakesState {
  return to({ ...s, unmasked: 0 }, 'unmask', now, staged(s, UNMASK_PER_MS));
}

function finish(s: SnakesState, now: number): SnakesState {
  return to({ ...s, night: null, vote: null }, 'final', now, null);
}

/** The winning side, once the game is over: any Snake alive at the end means the Snakes win. */
export function winner(s: SnakesState): Role {
  return aliveSnakes(s).length > 0 ? 'snake' : 'guest';
}

export function scores(s: SnakesState): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(s.order.map((id) => [id, 0]));
  if (s.stage !== 'final') return out;
  const w = winner(s);
  const winners = living(s).filter((id) => role(s, id) === w);
  const share = winners.length ? Math.round(s.pot / winners.length) : 0;
  for (const id of winners) out[id] = (out[id] ?? 0) + share;
  const snakes = new Set(s.order.filter((id) => role(s, id) === 'snake'));
  for (const id of s.order) {
    const p = s.players[id];
    if (!p) continue;
    out[id] = (out[id] ?? 0) + p.bet.filter((b) => snakes.has(b)).length * GHOST_BET_POINTS;
    if (p.role === 'guest' && p.votes > 0 && p.votes === p.snakeVotes) out[id] = (out[id] ?? 0) + SHARP_EYE_POINTS;
  }
  return out;
}

// ---------- intents ----------

export function intent(s: SnakesState, playerId: string, i: SnakesIntent, now: number): SnakesState {
  if (i.type === 'skip') return skip(s, now);
  const p = s.players[playerId];
  if (!p) return s; // a spectator
  switch (i.type) {
    case 'answer':
    case 'overboard':
      return s.stage === 'mission' ? missionIntent(s, playerId, i, now, afterMission) : s;
    case 'vote': return castVote(s, playerId, i.target, now);
    case 'pick': return nightPick(s, playerId, i.target);
    case 'lock': return nightLock(s, playerId);
    case 'say': return say(s, playerId, i.text);
    case 'offer': return answerOffer(s, playerId, i.accept);
    case 'dagger': return useDagger(s, playerId, i.kind, i.target);
    case 'endVote': return castEndVote(s, playerId, i.end, now);
    case 'talk': return talk(s, playerId, i.text);
    default: return s;
  }
}

/** A grown-up pressed Next: end the current wait now. */
function skip(s: SnakesState, now: number): SnakesState {
  if (s.stage === 'final') return s;
  if (s.stage === 'mission') return missionTick({ ...s, mission: s.mission ? { ...s.mission, stepEnds: now } : null }, now, afterMission);
  if (s.stage === 'unmask') return finish(s, now);
  return advance(s, now);
}

function castVote(s: SnakesState, voter: string, target: string, now: number): SnakesState {
  const v = s.vote;
  if (s.stage !== 'vote' || !v || v.votes[voter] || !voters(s).includes(voter)) return s;
  if (target === voter || !v.candidates.includes(target) || s.players[target]?.status !== 'alive') return s;
  const vote = { ...v, votes: { ...v.votes, [voter]: target }, order: [...v.order, voter] };
  const next = { ...s, vote };
  return voters(next).every((id) => vote.votes[id]) ? closeVote(next, now) : next;
}

/** Who a living player's night grid lists, and how many they may pick. */
function nightGrid(s: SnakesState, id: string): NightScreen['grid'] {
  const n = s.night;
  const p = s.players[id];
  const picks = n?.picks[id] ?? [];
  if (!n || !p || p.status !== 'alive') return { kind: 'none', candidates: [], picks: [], max: 0 };
  if (p.role === 'snake') {
    if (n.recruit === 'offer' && !n.offer) return { kind: 'recruit', candidates: recruitable(s), picks, max: 1 };
    return { kind: 'murder', candidates: aliveGuests(s), picks, max: n.dagger?.kind === 'double' ? 2 : 1 };
  }
  if (n.offer?.to === id && n.offer.answer === null && n.recruit === 'offer') return { kind: 'answer', candidates: ['yes', 'no'], picks: [], max: 1 };
  return { kind: 'suspect', candidates: living(s).filter((x) => x !== id), picks, max: 1 };
}

function nightPick(s: SnakesState, id: string, target: string): SnakesState {
  const n = s.night;
  const p = s.players[id];
  if (s.stage !== 'night' || !n || !p || n.locked[id]) return s;
  let candidates: string[];
  let max: number;
  if (p.status === 'ghost') {
    candidates = s.order.filter((x) => x !== id && s.players[x]?.status !== 'ghost');
    max = snakeCount(s.startCount);
  } else {
    const g = nightGrid(s, id);
    if (g.kind === 'answer' || g.kind === 'none') return s;
    candidates = g.candidates;
    max = g.max;
  }
  if (!candidates.includes(target)) return s;
  const cur = n.picks[id] ?? [];
  const next = cur.includes(target) ? cur.filter((x) => x !== target) : [...cur, target].slice(-max);
  return { ...s, night: { ...n, picks: { ...n.picks, [id]: next } } };
}

function nightLock(s: SnakesState, id: string): SnakesState {
  const n = s.night;
  if (s.stage !== 'night' || !n || n.locked[id]) return s;
  const locked = { ...n.locked, [id]: true };
  const next = { ...s, night: { ...n, locked } };
  // A recruitment night: once every Snake has locked their pick, the offer goes out at once.
  if (n.recruit === 'offer' && !n.offer && aliveSnakes(next).every((x) => locked[x])) return sendOffer(next);
  return next;
}

function say(s: SnakesState, id: string, text: string): SnakesState {
  const p = s.players[id];
  if (s.stage !== 'night' || !s.night || !p || p.status !== 'alive' || typeof text !== 'string' || !text) return s;
  if (p.role === 'snake') return { ...s, chat: [...s.chat, { from: id, text }].slice(-CHAT_MAX) };
  return setPlayer(s, id, { note: text });
}

function answerOffer(s: SnakesState, id: string, accept: boolean): SnakesState {
  const n = s.night;
  if (s.stage !== 'night' || !n?.offer || n.offer.to !== id || n.offer.answer !== null) return s;
  return { ...s, night: { ...n, offer: { ...n.offer, answer: accept === true } } };
}

function useDagger(s: SnakesState, id: string, kind: DaggerKind, target: string | null): SnakesState {
  const n = s.night;
  const p = s.players[id];
  if (s.stage !== 'night' || !n || !p || p.status !== 'alive' || p.role !== 'snake' || s.daggers < 1 || n.dagger) return s;
  if (kind === 'double') {
    if (n.noMurder) return s;
    return { ...s, daggers: s.daggers - 1, night: { ...n, dagger: { kind, target: null } } };
  }
  if (!target || target === id || s.players[target]?.status !== 'alive') return s;
  if (kind === 'silence') return { ...s, daggers: s.daggers - 1, night: { ...n, dagger: { kind, target } } };
  if (kind === 'peek') {
    const shield = !!s.players[target]?.shield;
    return {
      ...s, daggers: s.daggers - 1, night: { ...n, dagger: { kind, target } }, peeks: [...s.peeks, { target, shield }],
      chat: [...s.chat, { from: 'salty', text: shield ? 'The Peek: they hold a shield tonight.' : 'The Peek: no shield.' }].slice(-CHAT_MAX),
    };
  }
  return s;
}

/** Table talk: the living can speak during the Round Table and the last table. Public, like saying it out loud. */
export const TALK_STAGES: ReadonlySet<Stage> = new Set(['debate', 'vote', 'voteReveal', 'endVote']);
export const TALK_MAX = 60;
export const canTalk = (s: SnakesState, id: string) => TALK_STAGES.has(s.stage) && s.players[id]?.status === 'alive';

function talk(s: SnakesState, id: string, text: string): SnakesState {
  if (!canTalk(s, id) || typeof text !== 'string' || !text.trim()) return s;
  return { ...s, talk: [...s.talk, { from: id, text: text.trim(), round: s.round }].slice(-TALK_MAX) };
}

function castEndVote(s: SnakesState, id: string, end: boolean, now: number): SnakesState {
  if (s.stage !== 'endVote' || s.players[id]?.status !== 'alive' || id in s.endVotes) return s;
  const next = { ...s, endVotes: { ...s.endVotes, [id]: end === true } };
  return living(next).every((x) => x in next.endVotes) ? closeEndVote(next, now) : next;
}

// ---------- the room changes ----------

/** Players who left are out (their role is public). Players who joined after the start watch. */
export function setPlayers(s0: SnakesState, players: readonly GamePlayer[], _now: number): SnakesState {
  const here = new Set(players.map((p) => p.id));
  let s = s0;
  for (const id of s.order) {
    const p = s.players[id];
    if (p && !here.has(id) && (p.status === 'alive' || p.status === 'ghost')) {
      s = setPlayer(s, id, { status: 'left' });
      s = { ...s, history: [...s.history, { kind: 'left', round: s.round, id, role: p.role }] };
    }
  }
  return s;
}

export function setSpice(s: SnakesState, spice: Spice): SnakesState {
  return { ...s, spice };
}

// ---------- views ----------

function publicPlayer(s: SnakesState, id: string): SPublicPlayer {
  const p = s.players[id] as SPlayer;
  const revealed = s.stage === 'final' || p.status === 'banished' || p.status === 'left' || p.status === 'ghost'
    || (s.stage === 'unmask' && living(s).slice(0, s.unmasked).includes(id));
  return { id, status: p.status, role: revealed ? p.role : null, kid: p.kid };
}

export function hostView(s: SnakesState): SnakesHostView {
  const v = s.vote;
  const alive = living(s);
  return {
    stage: s.stage, brief: s.brief, round: s.round, deadline: nextDeadline(s), stageStart: s.stageStart, drama: s.drama, words: words(s.spice),
    players: s.order.map((id) => publicPlayer(s, id)), pot: s.pot, endSize: s.endSize,
    mission: s.mission ? missionPublic(s) : null,
    vote: v && (s.stage === 'vote' || s.stage === 'voteReveal' || s.stage === 'banish') ? {
      candidates: v.candidates, revote: v.revote, sealed: v.order.length, voters: voters(s).length,
      reveal: s.stage === 'vote' ? null : v.order.map((from) => ({ from, to: v.votes[from] as string })),
    } : null,
    banished: s.banished && s.stage === 'banish' ? { id: s.banished, role: s.players[s.banished]?.role as Role } : null,
    night: s.night ? { number: s.night.number, noMurder: s.night.noMurder } : null,
    breakfast: s.stage === 'breakfast' ? s.breakfast : null,
    endVote: s.stage === 'endVote' ? { sealed: Object.keys(s.endVotes).length, voters: alive.length } : null,
    unmask: s.stage === 'unmask' ? {
      shown: alive.slice(0, s.unmasked).map((id) => ({ id, role: s.players[id]?.role as Role })), total: alive.length,
    } : null,
    final: s.stage === 'final' ? {
      winner: winner(s), winners: alive.filter((id) => role(s, id) === winner(s)), pot: s.pot,
      roles: s.order.map((id) => ({ id, role: s.players[id]?.role as Role })),
    } : null,
    history: s.history,
    talk: s.talk.filter((t) => t.round === s.round),
  };
}

function nightScreen(s: SnakesState, id: string): NightScreen {
  const n = s.night;
  const p = s.players[id] as SPlayer;
  const snake = p.role === 'snake';
  const grid = nightGrid(s, id);
  let box: NightScreen['box'];
  if (snake && n?.recruit === 'forced' && n.offer?.to === id) {
    box = { kind: 'chosen', messages: s.chat, note: null, prompt: 'Salty chose you. You’re a Snake now.' };
  } else if (snake) {
    box = { kind: 'chat', messages: s.chat, note: null, prompt: 'The other Snakes' };
  } else if (grid.kind === 'answer') {
    box = { kind: 'offer', messages: [], note: null, prompt: 'A letter under your door: the Snakes want you. Join them?' };
  } else {
    box = { kind: 'note', messages: [], note: p.note, prompt: 'Who’s lying? Write it down.' };
  }
  return {
    box, grid, chips: CHIPS, locked: !!n?.locked[id], daggers: snake ? s.daggers : 0, peeks: snake ? s.peeks : [],
    noMurder: !!n?.noMurder,
  };
}

export function playerView(s: SnakesState, id: string): SnakesPlayerView {
  const p = s.players[id];
  const base = {
    stage: s.stage, brief: s.brief, round: s.round, deadline: nextDeadline(s), words: words(s.spice),
    players: s.order.map((x) => publicPlayer(s, x)), pot: s.pot,
  };
  if (!p) {
    return { ...base, spectator: true, me: null, fellows: [], mission: null, vote: null, night: null, bet: null, endVote: null, final: null, history: s.history, talk: s.talk.filter((t) => t.round === s.round), canTalk: false };
  }
  const v = s.vote;
  const alive = p.status === 'alive';
  const fellows = p.role === 'snake' ? s.order.filter((x) => x !== id && role(s, x) === 'snake') : [];
  const sc = scores(s);
  return {
    ...base, spectator: false,
    me: { role: p.role, status: p.status, kid: p.kid, shield: p.shield, silenced: p.silenced },
    fellows,
    mission: s.stage === 'mission' || s.stage === 'missionReveal' ? missionForPlayer(s, id) : null,
    vote: s.stage === 'vote' && v ? {
      candidates: v.candidates.filter((x) => x !== id), mine: v.votes[id] ?? null, canVote: alive && !p.silenced, note: p.note,
    } : null,
    night: s.stage === 'night' && alive ? nightScreen(s, id) : null,
    bet: s.stage === 'night' && p.status === 'ghost' ? {
      candidates: s.order.filter((x) => x !== id && s.players[x]?.status !== 'ghost'), picks: s.night?.picks[id] ?? [], max: snakeCount(s.startCount),
    } : null,
    endVote: s.stage === 'endVote' ? { mine: id in s.endVotes ? (s.endVotes[id] as boolean) : null, canVote: alive } : null,
    final: s.stage === 'final' ? { won: alive && p.role === winner(s), winner: winner(s), points: sc[id] ?? 0 } : null,
    history: s.history,
    talk: s.talk.filter((t) => t.round === s.round),
    canTalk: canTalk(s, id),
  };
}
