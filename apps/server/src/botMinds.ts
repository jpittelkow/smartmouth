// The socket layer's handle on thinking bots. It says when a bot should ask the model (a vote, a Snake's night pick,
// a line at the table) and turns the room into the little the brain needs (names, spice). Anything that fails or is
// slow falls back to the simple rules, so a game never waits on the model.
import { rules, type SnakesState } from '@smartmouth/game-snakes';
import { BotBrain, type ThinkKind } from './botBrain.ts';
import { spiceState, type Room } from './rooms.ts';

export interface TalkWindow {
  /** Same key = same window: a bot speaks at most `max` times in it. */
  key: string;
  max: number;
}

export class BotMinds {
  private brain: BotBrain;
  constructor(brain: BotBrain) { this.brain = brain; }

  private snakes(room: Room): SnakesState | null {
    return room.game?.id === 'snakes' ? room.game.state as SnakesState : null;
  }

  /** A decision worth a model call right now, or null (the simple rules handle it). */
  decision(room: Room, seatId: string): ThinkKind | null {
    const s = this.snakes(room);
    if (!s) return null;
    const v = rules.playerView(s, seatId);
    if (v.vote?.canVote && !v.vote.mine) return 'vote';
    const n = v.night;
    if (n && !n.locked && n.grid.kind !== 'answer' && n.grid.picks.length === 0 && n.grid.candidates.length) return 'night';
    return null;
  }

  /** Whether this bot may speak at the table now, and how often in this stretch. */
  talkWindow(room: Room, seatId: string, bots: number): TalkWindow | null {
    const s = this.snakes(room);
    if (!s || !rules.canTalk(s, seatId)) return null;
    const max = s.stage === 'debate' ? (bots <= 6 ? 2 : 1) : s.stage === 'voteReveal' ? 0 : 1;
    return max ? { key: `${s.round}:${s.stage}:${s.endgame ? 'end' : ''}`, max } : null;
  }

  /** The model's intents, or null on any failure. */
  async think(room: Room, seatId: string, kind: ThinkKind): Promise<unknown[] | null> {
    const s = this.snakes(room);
    if (!s) return null;
    const names = Object.fromEntries(room.seats.map((x) => [x.id, x.name]));
    try {
      return await this.brain.think(room.code, s, seatId, kind, { names, spice: spiceState(room).effective });
    } catch (e) {
      console.warn(`bot ${seatId} in ${room.code} couldn't think (${kind}): ${(e as Error).message}`);
      return null;
    }
  }

  forget(code: string) { this.brain.forget(code); }
}
