// What each rules card says (ADR 0025): the TV's card and the phone's copy read the same words, so a player can
// follow along on either. Salty's spoken version is in content/voice/lines.json (moments sm-brief-*).
import type { BriefId, SnakesHostView } from '@smartmouth/game-snakes';

export interface Brief {
  title: string;
  steps: [string, string, string];
  /** How you win or lose at this. */
  stakes: string;
  /** One small worked example or catch. */
  note: string;
  /** The fine print, when the steps can't hold every rule. */
  fine?: string[];
  /** The stage the card leads into, for the round track and the music. */
  leads: 'deal' | 'mission' | 'debate' | 'night' | 'endVote';
}

export const BRIEFS: Record<BriefId, Brief> = {
  game: {
    title: 'Snake Manor',
    steps: ['Most of you are Guests. A few are secret Snakes, and the Snakes know each other.', 'Each round: a trivia mission fills the pot, the Round Table votes someone out, then night.', 'At night the Snakes make someone vanish. The vanished become Ghosts.'],
    stakes: 'Guests win if every Snake is banished. Snakes win if one survives to the end. The winners split the pot.',
    note: 'Your secret role is on your phone next. Keep a straight face.',
    leads: 'deal',
  },
  'mission-everyone': {
    title: 'The Mission',
    steps: ['Six questions. Each of you gets your own on your phone, with about 20 seconds to answer.', 'Every right answer adds 100 crowns to the pot. Everyone’s answers count together.', 'Get 3 in 4 right (the target, up top) for a 500-crown bonus. Miss it and the Snakes earn a Dagger.'],
    stakes: 'The Snakes want you to miss: a Dagger gives them a dirty trick at night.',
    note: 'Watch who misses the easy ones.',
    fine: [
      'A Snake can answer wrong on purpose.',
      'Once a mission, a Snake can secretly sink someone else’s right answer. Salty says it happened, never whose.',
      'The top scorer gets a secret shield: nobody can make them vanish tonight.',
    ],
    leads: 'mission',
  },
  'mission-chain': {
    title: 'The Chain',
    steps: ['One player at a time. The TV shows whose turn it is.', 'Each right answer in a row pays more than the last.', 'One wrong answer snaps the chain back to the start.'],
    stakes: 'A long chain fills the pot. A Snake can snap it on purpose.',
    note: 'If someone fumbles an easy one, remember who.',
    leads: 'mission',
  },
  'mission-pairs': {
    title: 'Pairs',
    steps: ['Your partner’s name is on your phone and on the TV.', 'You both get the same question.', 'A pair scores only if both of you are right.'],
    stakes: 'Both right: the pot grows. One wrong: nothing.',
    note: 'A Snake can sink a pair with one wrong tap.',
    leads: 'mission',
  },
  table: {
    title: 'The Round Table',
    steps: ['Talk it out loud (or type on your phone): who sank the mission? Who is lying?', 'Then vote on your phone, in secret. Each vote is a sealed letter.', 'The letters open one by one. The most votes leaves the manor.'],
    stakes: 'Whoever leaves shows what they were: catch a Snake, or lose a Guest.',
    note: 'A tie means a revote between the tied players.',
    leads: 'debate',
  },
  night: {
    title: 'Night',
    steps: ['The TV goes dark. Every phone looks the same, so peeking won’t help.', 'Snakes pick a Guest to vanish. Guests write who they suspect.', 'Ghosts bet on who the Snakes are. Then everyone locks in.'],
    stakes: 'At breakfast we find out who’s gone.',
    note: 'A shield from the mission keeps its owner safe tonight.',
    leads: 'night',
  },
  endgame: {
    title: 'The Last Table',
    steps: ['End the game now, or banish one more?', 'It ends only if every one of you picks End.', 'Then the masks come off: who was who.'],
    stakes: 'A Snake still at the table when it ends: the Snakes win. All gone: the Guests win.',
    note: 'One holdout and it’s back to the Round Table.',
    leads: 'endVote',
  },
};

export const ROMAN = ['I', 'II', 'III'];

/** The stage a view is in, counting a rules card as the stage it leads into. */
export function leadStage(g: Pick<SnakesHostView, 'stage' | 'brief'>): SnakesHostView['stage'] {
  return g.stage === 'briefing' && g.brief ? BRIEFS[g.brief].leads : g.stage;
}
