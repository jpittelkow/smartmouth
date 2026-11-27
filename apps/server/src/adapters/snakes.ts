// Snake Manor on the platform (ADR 0022–0024): mission questions from the library, intents from sockets, and what
// Salty says at each stage. His line choices never read hidden roles (ADR 0023): they depend only on public facts.
import { manifest, rules, type SnakesContent, type SnakesIntent, type SnakesState } from '@smartmouth/game-snakes';
import { pickForGame } from '../questions.ts';
import type { Moment } from '../voice.ts';
import type { GameAdapter, Say, SaltyTools } from './types.ts';

/** Every moment Salty has Snake Manor lines for (content/voice/lines.json), at every spice level. */
export const SM_MOMENTS: readonly Moment[] = [
  'sm-deal', 'sm-mission', 'sm-overboard', 'sm-target-hit', 'sm-target-miss', 'sm-table', 'sm-vote', 'sm-revote', 'sm-seals',
  'sm-no-votes', 'sm-reveal-setup', 'sm-reveal-snake', 'sm-reveal-guest', 'sm-night', 'sm-murder', 'sm-saved', 'sm-quiet',
  'sm-recruited', 'sm-morning', 'sm-final-vote', 'sm-unmask', 'sm-guests-win', 'sm-snakes-win',
];

/** Three missions of up to eight questions each, with spares for spice changes. */
const PER_BAND = 40;

export const snakes: GameAdapter<SnakesState> = {
  manifest,

  start({ players, spice, seed, drama, db, exclude, now }) {
    const picked = pickForGame(db, { spice, exclude, perBand: PER_BAND }, now);
    const content: SnakesContent = {};
    for (const p of players) content[p.band] = picked[p.band] as SnakesContent[typeof p.band];
    const bands = new Set(players.map((p) => p.band));
    if ([...bands].every((b) => (content[b]?.length ?? 0) === 0)) {
      return { ok: false, code: 'no-questions', message: 'There are no live questions for these ages yet, so there are no missions. Add some in the admin page.' };
    }
    if (!players.some((p) => rules.canBeSnake(p.band))) {
      return { ok: false, code: 'not-ready', message: 'Snake Manor needs at least one player aged 9 or older to be a Snake.' };
    }
    return { ok: true, state: rules.init(players, { spice, seed, drama }, content, now) };
  },

  intent(state, actor, raw, now) {
    if (actor.kind !== 'player') return state; // the TV only skips, through admin:next
    const i = parse(raw);
    return i ? rules.intent(state, actor.seatId, i, now) : state;
  },

  skip: (state, now) => rules.intent(state, 'host', { type: 'skip' }, now),
  tick: (state, now) => rules.tick(state, now),
  hold: (state, until) => rules.holdStage(state, until),
  deadline: (state) => rules.nextDeadline(state),
  sync: (state, players, spice, now) => rules.setSpice(rules.setPlayers(state, players, now), spice),
  hostView: (state) => rules.hostView(state),
  playerView: (state, seatId) => rules.playerView(state, seatId),
  isOver: (state) => rules.isOver(state),
  scores: (state) => rules.scores(state),
  plays: (state) => state.log,

  stageKey(s) {
    const m = s.mission;
    const sub = s.stage === 'mission' && m ? `${m.index}:${m.step}` : s.stage === 'unmask' ? String(s.unmasked) : s.stage === 'vote' && s.vote?.revote ? 'revote' : '';
    return `${s.round}:${s.stage}:${sub}`;
  },

  say: (s, tools) => sayFor(s, tools),
};

const str = (x: unknown): x is string => typeof x === 'string' && x.length > 0 && x.length <= 64;

/** A client's raw intent, checked field by field. The rules check whether it's allowed now. */
function parse(raw: unknown): SnakesIntent | null {
  if (!raw || typeof raw !== 'object') return null;
  const x = raw as Record<string, unknown>;
  switch (x.type) {
    case 'answer': return Number.isInteger(x.choice) ? { type: 'answer', choice: x.choice as number } : null;
    case 'overboard': return str(x.target) ? { type: 'overboard', target: x.target } : null;
    case 'vote': return str(x.target) ? { type: 'vote', target: x.target } : null;
    case 'pick': return str(x.target) ? { type: 'pick', target: x.target } : null;
    case 'lock': return { type: 'lock' };
    case 'say': return typeof x.text === 'string' ? { type: 'say', text: x.text } : null;
    case 'offer': return typeof x.accept === 'boolean' ? { type: 'offer', accept: x.accept } : null;
    case 'dagger':
      return x.kind === 'double' || x.kind === 'silence' || x.kind === 'peek'
        ? { type: 'dagger', kind: x.kind, target: str(x.target) ? x.target : null } : null;
    case 'endVote': return typeof x.end === 'boolean' ? { type: 'endVote', end: x.end } : null;
    default: return null;
  }
}

/**
 * The moment for Salty's line, from public facts only: the stage, the mission's totals, whether a shield was used,
 * and a banished player's role, which is public from the moment the TV reveals it.
 */
export function momentFor(s: SnakesState): Moment | null {
  const host = rules.hostView(s);
  switch (s.stage) {
    case 'deal': return 'sm-deal';
    case 'mission': {
      const m = host.mission;
      if (!m) return 'sm-mission';
      if (m.step === 'tally') return m.overboardSaid ? 'sm-overboard' : null;
      return m.index === 0 ? 'sm-mission' : null;
    }
    case 'missionReveal': return host.mission?.result?.hit ? 'sm-target-hit' : 'sm-target-miss';
    case 'debate': return 'sm-table';
    case 'vote': return host.vote?.revote ? 'sm-revote' : 'sm-vote';
    case 'voteReveal': return host.vote?.reveal?.length ? 'sm-seals' : 'sm-no-votes';
    case 'banish': return 'sm-reveal-setup';
    case 'night': return 'sm-night';
    case 'breakfast': {
      const b = host.breakfast;
      if (!b) return 'sm-morning';
      if (b.saltyRecruited) return 'sm-recruited';
      if (b.murdered.length) return 'sm-murder';
      if (b.saved) return 'sm-saved';
      return 'sm-quiet';
    }
    case 'endVote': return 'sm-final-vote';
    case 'unmask': return s.unmasked === 0 ? 'sm-unmask' : null;
    case 'final': return host.final?.winner === 'snake' ? 'sm-snakes-win' : 'sm-guests-win';
    default: return null;
  }
}

function sayFor(s: SnakesState, tools: SaltyTools): Say {
  const moment = momentFor(s);
  if (!moment) return { text: null, clips: [] };
  const line = tools.line(moment);
  const text = line?.text ?? null;
  const clips = line?.clip ? [line.clip] : [];
  if (s.stage === 'banish' && s.banished) {
    // The reveal in two parts (ADR 0024): the setup as "was a…" appears, the payoff just after the role lands.
    // The pause between them is the game's, so Quick drama shortens it.
    const payoff = tools.line(s.players[s.banished]?.role === 'snake' ? 'sm-reveal-snake' : 'sm-reveal-guest');
    const length = rules.staged(s, rules.BANISH_MS);
    const parts = [
      { at: s.stageStart + Math.round(rules.BANISH_BEATS.was * length), text, clip: line?.clip ?? null },
      { at: s.stageStart + Math.round(rules.BANISH_BEATS.land * length) + 400, text: payoff?.text ?? null, clip: payoff?.clip ?? null },
    ];
    return { text, clips, parts };
  }
  return { text, clips };
}
