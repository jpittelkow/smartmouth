// Snake Manor's state and views (ADR 0022, 0023). A view is what one screen may see: a player view carries only
// that player's own secrets (and a Snake's fellow Snakes); the host view carries only public facts.
import type { Band, Drama, Spice } from '@smartmouth/protocol';

export type Role = 'guest' | 'snake';
/** alive: in the game · ghost: murdered, plays on for side points · banished: voted out · left: left the room. */
export type Status = 'alive' | 'ghost' | 'banished' | 'left';

export type Stage =
  | 'deal' | 'mission' | 'missionReveal' | 'debate' | 'vote' | 'voteReveal' | 'banish'
  | 'night' | 'breakfast' | 'endVote' | 'unmask' | 'final';

export type DaggerKind = 'double' | 'silence' | 'peek';

export interface MAnswer { text: string; image: string | null }

/** A question as a mission needs it; the platform picks these from the library (the same shape trivia uses). */
export interface MQuestion {
  id: number;
  prompt: string;
  kind: 'choice' | 'truefalse' | 'picture';
  answers: MAnswer[];
  correct: number;
  explain: string;
  category: string;
  spice: Spice;
}

/** Questions per band, in order (with spares). */
export type SnakesContent = Partial<Record<Band, MQuestion[]>>;

export interface SnakesSettings {
  spice: Spice;
  seed: number;
  drama: Drama;
}

export interface SPlayer {
  band: Band;
  role: Role;
  status: Status;
  /** Kids 6–8 are always Guests, and everyone is told so (ADR 0022). */
  kid: boolean;
  /** Safe from murder tonight (a mission's top scorer). */
  shield: boolean;
  /** Can't vote at the next Round Table (a Dagger). */
  silenced: boolean;
  /** Last night's note (a Guest's suspicion), shown back at the Round Table. */
  note: string | null;
  /** Round Tables voted at, and how many of those votes named a Snake (the "sharp eye" bonus). */
  votes: number;
  snakeVotes: number;
  /** A Ghost's bet on who the Snakes are. */
  bet: string[];
  /** Correct answers this mission (for the shield). */
  missionRight: number;
}

export type MissionFormat = 'everyone' | 'chain' | 'pairs';

export interface MissionState {
  format: MissionFormat;
  /** Question number in this mission, from 0. */
  index: number;
  count: number;
  /** 'question' while answering, 'tally' while the TV shows this question's total. */
  step: 'question' | 'tally';
  stepEnds: number;
  /** Each answering player's question this step (everyone / pairs), or the one player's (chain). */
  questions: Record<string, MQuestion>;
  /** Chain: whose turn it is. Pairs: the pairs. */
  chainOrder: string[];
  pairs: Array<[string, string]>;
  picks: Record<string, number>;
  /** The Snakes' Overboard: whose answer is dropped from the count this step (once a mission). */
  overboard: string | null;
  overboardUsed: boolean;
  /** Overboard landed on this step (said aloud at the tally, never who). */
  overboardSaid: boolean;
  right: number;
  asked: number;
  /** The chain's current run of correct answers. */
  streak: number;
  bonus: number;
  target: number;
  potBefore: number;
  /** After the mission: target hit, the shield's holder (private), a Dagger earned. */
  result: null | { hit: boolean; shieldTo: string | null; dagger: boolean; gained: number };
}

export interface ChatMessage { from: string | 'salty'; text: string }

export interface NightState {
  number: number;
  /** No murder tonight: the first night of a small game, or a recruitment night. */
  noMurder: boolean;
  recruit: 'none' | 'offer' | 'forced';
  /** Snake picks (murder, or the recruit when recruit = offer), suspect votes, Ghost bets. */
  picks: Record<string, string[]>;
  locked: Record<string, boolean>;
  /** The recruitment offer once it has gone out, and the answer. */
  offer: null | { to: string; answer: boolean | null };
  /** When the Snakes' recruit pick closes and the offer goes out. */
  offerAt: number | null;
  dagger: null | { kind: DaggerKind; target: string | null };
}

export interface BreakfastState {
  murdered: string[];
  /** A shield stopped the murder. */
  saved: boolean;
  /** Salty recruited a new Snake in the night (the room is told only that). */
  saltyRecruited: boolean;
  /** Most Guests naming the same suspect last night (a hint, never who). */
  sameSuspect: number;
  /** A recruitment night: nobody died. */
  quiet: boolean;
}

export interface VoteState {
  /** Who can be voted for (a revote narrows it to the tied). */
  candidates: string[];
  revote: boolean;
  votes: Record<string, string>;
  order: string[];
}

export interface SnakesState {
  seed: number;
  rng: number;
  drama: Drama;
  spice: Spice;
  /** Players at the start, for the endgame size. */
  startCount: number;
  endSize: number;
  stage: Stage;
  stageStart: number;
  stageEnds: number | null;
  round: number;
  players: Record<string, SPlayer>;
  /** Seats in join order. */
  order: string[];
  pot: number;
  daggers: number;
  /** Peeks the Snakes have made: who, and whether they held a shield. */
  peeks: Array<{ target: string; shield: boolean }>;
  chat: ChatMessage[];
  queues: SnakesContent;
  mission: MissionState | null;
  vote: VoteState | null;
  banished: string | null;
  night: NightState | null;
  breakfast: BreakfastState | null;
  /** True while the endgame loop runs (End or Banish again). */
  endgame: boolean;
  endVotes: Record<string, boolean>;
  /** Salty must recruit a Snake at the next night (the last Snake was banished with 5+ left). */
  forceRecruit: boolean;
  /** A Snake was banished: the next night the Snakes may recruit. */
  mayRecruit: boolean;
  unmasked: number;
  log: Array<{ questionId: number; right: boolean; ms: number | null }>;
  /** The public record: what everyone in the room has seen happen, in order. Never anything only a phone knows. */
  history: HistoryEvent[];
  /** What players said at the table (public speech, typed on a phone or a bot's line). */
  talk: TalkLine[];
}

export interface TalkLine { from: string; text: string; round: number }

export type HistoryEvent =
  | { kind: 'mission'; round: number; right: number; asked: number; hit: boolean; overboard: boolean }
  | { kind: 'votes'; round: number; votes: Array<{ from: string; to: string }> }
  | { kind: 'banished'; round: number; id: string; role: Role }
  | { kind: 'morning'; round: number; murdered: string[]; saved: boolean; saltyRecruited: boolean }
  | { kind: 'left'; round: number; id: string; role: Role };

// ---- views ----

export interface SPublicPlayer {
  id: string;
  status: Status;
  /** Only once it's public: banished or left (revealed), a Ghost (always a Guest), or the final unmasking. */
  role: Role | null;
  kid: boolean;
}

/** Words that change with the spice level (ADR 0022). */
export interface Words { murdered: string; banished: string }

export interface SMissionPublic {
  format: MissionFormat;
  index: number;
  count: number;
  step: 'question' | 'tally';
  deadline: number;
  /** The question on the TV: the oldest band's (everyone, pairs) or the turn player's (chain). */
  question: { prompt: string; answers: MAnswer[]; category: string } | null;
  /** Chain: whose turn. */
  turn: string | null;
  pairs: Array<[string, string]>;
  locked: number;
  answering: number;
  /** Totals only, never who (ADR 0023). */
  right: number;
  asked: number;
  target: number;
  streak: number;
  bonus: number;
  overboardSaid: boolean;
  result: null | { hit: boolean; gained: number; dagger: boolean; shieldGiven: boolean };
}

export interface SnakesHostView {
  stage: Stage;
  round: number;
  deadline: number | null;
  stageStart: number;
  drama: Drama;
  words: Words;
  players: SPublicPlayer[];
  pot: number;
  endSize: number;
  mission: SMissionPublic | null;
  vote: null | {
    candidates: string[];
    revote: boolean;
    sealed: number;
    voters: number;
    /** Only at the reveal: who voted for whom, in the order cast. */
    reveal: Array<{ from: string; to: string }> | null;
  };
  banished: null | { id: string; role: Role };
  night: null | { number: number; noMurder: boolean };
  breakfast: BreakfastState | null;
  endVote: null | { sealed: number; voters: number };
  unmask: null | { shown: Array<{ id: string; role: Role }>; total: number };
  final: null | { winner: Role; winners: string[]; pot: number; roles: Array<{ id: string; role: Role }> };
  /** What the table knows so far (for the debate, and for anyone who missed it). */
  history: HistoryEvent[];
  /** This round's table talk. */
  talk: TalkLine[];
}

/** The night screen: one shape for every living player (ADR 0023); only its contents differ. */
export interface NightScreen {
  box: { kind: 'chat' | 'note' | 'offer' | 'chosen'; messages: ChatMessage[]; note: string | null; prompt: string };
  grid: { kind: 'murder' | 'suspect' | 'recruit' | 'answer' | 'none'; candidates: string[]; picks: string[]; max: number };
  chips: string[];
  locked: boolean;
  /** Snakes only (empty for everyone else, so the shape stays the same). */
  daggers: number;
  peeks: Array<{ target: string; shield: boolean }>;
  noMurder: boolean;
}

export interface SnakesPlayerView {
  stage: Stage;
  round: number;
  deadline: number | null;
  words: Words;
  /** Not seated when the game began: watching. */
  spectator: boolean;
  me: null | { role: Role; status: Status; kid: boolean; shield: boolean; silenced: boolean };
  /** A Snake's fellow Snakes (empty for a Guest). */
  fellows: string[];
  players: SPublicPlayer[];
  pot: number;
  mission: null | {
    step: 'question' | 'tally';
    deadline: number;
    question: { prompt: string; answers: MAnswer[] } | null;
    /** Show the question text: it isn't the one on the TV. */
    showPrompt: boolean;
    myTurn: boolean;
    picked: number | null;
    /** Snakes: the Overboard is still unused this mission; who it can hit. */
    overboard: null | { available: boolean; candidates: string[] };
    result: null | { shield: boolean };
  };
  vote: null | { candidates: string[]; mine: string | null; canVote: boolean; note: string | null };
  night: NightScreen | null;
  /** A Ghost's bet (at night). */
  bet: null | { candidates: string[]; picks: string[]; max: number };
  endVote: null | { mine: boolean | null; canVote: boolean };
  final: null | { won: boolean; winner: Role; points: number };
  history: HistoryEvent[];
  /** This round's table talk, and whether you can add to it now (the Round Table, while you're alive). */
  talk: TalkLine[];
  canTalk: boolean;
}

export type SnakesIntent =
  | { type: 'answer'; choice: number }
  | { type: 'overboard'; target: string }
  | { type: 'vote'; target: string }
  | { type: 'pick'; target: string }
  | { type: 'lock' }
  | { type: 'say'; text: string }
  | { type: 'offer'; accept: boolean }
  | { type: 'dagger'; kind: DaggerKind; target: string | null }
  | { type: 'endVote'; end: boolean }
  /** Say something at the table (typed on a phone, or a bot's line). */
  | { type: 'talk'; text: string }
  | { type: 'skip' };
