// Trivia's state and views (ADR 0006, 0008, 0009). Views are what the TV and each phone may see: a player view never
// carries the right answer before the reveal (ADR 0004).
import type { Band, Spice } from '@smartmouth/protocol';

export interface TImage { url: string; alt: string; credit: string }
export interface TAnswer { text: string; image: string | null; credit?: string }

/** A question as the game needs it; the platform picks these from the library. */
export interface TQuestion {
  id: number;
  prompt: string;
  kind: 'choice' | 'truefalse' | 'picture';
  answers: TAnswer[];
  correct: number;
  explain: string;
  category: string;
  spice: Spice;
  /** Shown with the question (never the answer). */
  image?: TImage | null;
  /** Shown at the reveal, with the fun fact. */
  revealImages?: TImage[];
}

/** Questions for each band, in the order to use them (with spares, so spice changes can skip some). */
export type TriviaContent = Record<Band, TQuestion[]>;

export interface TriviaSettings {
  rounds: number;
  spice: Spice;
}

/** `standings`: the leaderboard between rounds (owner, 2026-11-27). */
/** `suspense`: the drum roll between answers closing and the reveal (owner, 2026-11-27). */
export type Stage = 'intro' | 'question' | 'suspense' | 'reveal' | 'turn' | 'turnReveal' | 'standings' | 'final';

export interface TPlayer { band: Band; score: number }
interface Pick { choice: number; at: number }

export interface TriviaState {
  rounds: number;
  round: number;
  stage: Stage;
  /** When the current stage ends by itself (null: it waits for someone). */
  stageEnds: number | null;
  spice: Spice;
  players: Record<string, TPlayer>;
  queues: TriviaContent;
  /** This round's question for each band that has players answering. */
  current: Partial<Record<Band, TQuestion>>;
  /** The band whose question the TV shows. */
  tvBand: Band | null;
  questionStart: number;
  questionEnds: number;
  picks: Record<string, Pick>;
  /** Points each player got in the last reveal. */
  gained: Record<string, number>;
  turn: null | {
    playerId: string;
    question: TQuestion;
    start: number;
    pick: Pick | null;
    helpers: Record<string, Pick>;
  };
  turnCount: number;
  /** Everyone's score when this round began, so the leaderboard can show who moved. */
  roundStartScores?: Record<string, number>;
  /** Plays to record in the library's stats; the platform takes them after each step. */
  log: Array<{ questionId: number; right: boolean; ms: number | null; player?: string }>;
}

export interface TPublicQuestion {
  prompt: string;
  kind: TQuestion['kind'];
  answers: TAnswer[];
  category: string;
  image: TImage | null;
}

export interface TPlayerStatus {
  id: string;
  score: number;
  locked: boolean;
  right: boolean | null;
  gained: number;
}

export interface TriviaHostView {
  stage: Stage;
  round: number;
  rounds: number;
  deadline: number | null;
  /** When answering opens (the round card is still up until then); null outside a question. */
  opensAt: number | null;
  question: TPublicQuestion | null;
  /** Some players have their own (age-sized) question on their phones. */
  splitBands: boolean;
  correct: number | null;
  explain: string | null;
  players: TPlayerStatus[];
  turn: null | { playerId: string; question: TPublicQuestion; correct: number | null; picked: number | null; helpers: number };
  /** The reveal's pictures (with the fun fact), only once the answer is out. */
  revealImages: TImage[];
  /** The category of the question the TV will show next, so the round card can show it the whole time. */
  nextCategory: string | null;
  /** When the leaderboard ends (it waits for Salty, so this can move); the round card sweeps in just before. */
  standingsEnd: number | null;
  /** The leaderboard between rounds, best first, with where each player stood before this round. */
  standings: null | Array<{ id: string; score: number; gained: number; rank: number; prevRank: number }>;
  /** Final standings, best first; Little players are always superstars. */
  final: null | Array<{ id: string; score: number; rank: number; superstar: boolean }>;
}

export interface TriviaPlayerView {
  stage: Stage;
  round: number;
  rounds: number;
  deadline: number | null;
  /** When answering opens (the round card is still up until then); null outside a question. */
  opensAt: number | null;
  /** Your question this round (null: you sit this one out, or it's not a question stage). */
  question: TPublicQuestion | null;
  /** Show the question text on the phone: it differs from the one on the TV. */
  showPrompt: boolean;
  picked: number | null;
  result: null | { right: boolean; gained: number; correctText: string };
  turn: null | { isMe: boolean; playerId: string; question: TPublicQuestion; picked: number | null; correct: number | null };
  score: number;
  rank: number;
  final: null | { rank: number; of: number; superstar: boolean };
}

export type TriviaIntent =
  | { type: 'answer'; choice: number }
  /** The TV remote answering for the Little player whose turn it is (ADR 0009). */
  | { type: 'answerFor'; playerId: string; choice: number }
  | { type: 'skip' };
