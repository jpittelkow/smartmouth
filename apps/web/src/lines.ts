// Placeholder lobby captions until the voiced line bank exists (ADR 0013). The level comes from the server's
// effective spice, so a little one in the room always gets Mild.
import type { Spice } from '@smartmouth/protocol';

export const LOBBY_LINES: Record<Spice, string[]> = {
  mild: [
    "[sighs] Oh good, more contestants. Don't touch anything shiny. That's mine.",
    "Ahoy! I mean... welcome! I'm a game-show host now. It's fine. I'm fine.",
    "Hurry up and join, my couch is getting cold. Couches do that. Probably.",
  ],
  spicy: [
    "Look at you all. A room full of geniuses. Allegedly.",
    "I used to have a ship. Now I have a remote control. Think about that.",
    "Join already. I've been rehearsing my disappointed face all week.",
  ],
  hot: [
    "Oh, we've got a crowd. Great. Who's here to lose to a guy with no ship?",
    "Every week I tell myself this'll be the night someone's smart. Every week. Damn optimism.",
    "Grab your phones, you beautiful disasters. Let's get this over with.",
  ],
  filthy: [
    "Welcome, you magnificent ★★★★-ups. Phones out, dignity in the bin.",
    "I've hosted wakes with more energy than this room. Join the ★★★★ game.",
    "Somebody pour me a drink. Somebody pour YOU a drink. We're gonna need it.",
  ],
};

export function pickLine(spice: Spice, seed: number): string {
  const lines = LOBBY_LINES[spice];
  return lines[seed % lines.length] ?? '';
}

/** Audio tags like [sighs] are for the voice model; captions drop them. */
export function captionText(line: string): string {
  return line.replace(/\[[^\]]+\]\s*/g, '');
}

// Game captions until the voiced line bank exists (ADR 0013). Picked by moment and the room's effective spice.
type Moment = 'intro' | 'question' | 'allRight' | 'allWrong' | 'mixed' | 'turn' | 'littleRight' | 'littleWrong' | 'final';

const GAME_LINES: Record<Moment, Record<Spice, string[]>> = {
  intro: {
    mild: ['Okay, okay. Phones ready. Brains... we\'ll see.'],
    spicy: ['Trivia time. Try not to embarrass me. That\'s my job.'],
    hot: ['Here we go. Eight rounds of you lot disappointing me.'],
    filthy: ['Alright, you degenerates. Let\'s see what\'s rattling around in there.'],
  },
  question: {
    mild: ['Take your time. Not too much time.', 'Ooh, this one\'s tricky. I think.'],
    spicy: ['Think hard. Or guess. Guessing worked for me.', 'Tick tock, geniuses.'],
    hot: ['Come on. My grandmother could do this, and she was a seagull.', 'Any day now. Damn.'],
    filthy: ['Lock it in before I lose what\'s left of my ★★★★ mind.', 'Clock\'s ticking, you magnificent idiots.'],
  },
  allRight: {
    mild: ['Everybody got it! Show-offs.'],
    spicy: ['All of you? Fine. Fine! I\'m happy. Can\'t you tell?'],
    hot: ['Everyone got it. Great. Now I look like the dumb one.'],
    filthy: ['Every last one of you. Who leaked the ★★★★ answers?'],
  },
  allWrong: {
    mild: ['Nobody! Not one! That\'s okay. I didn\'t know either.'],
    spicy: ['Wrong. All of you. Beautifully, confidently wrong.'],
    hot: ['Zero for everybody. That\'s the most impressive thing I\'ve seen all night.'],
    filthy: ['Holy ★★★★. Not one of you. I\'m calling your teachers.'],
  },
  mixed: {
    mild: ['Some of you got it! The rest of you... nice try!'],
    spicy: ['Half right. Half... let\'s call it creative.'],
    hot: ['Some of you nailed it. Some of you need a nap.'],
    filthy: ['Some of you are geniuses. The rest of you? Holy ★★★★.'],
  },
  turn: {
    mild: ['Ooh, it\'s a special turn! Take all the time you want, buddy.'],
    spicy: ['Little one\'s up! Everyone else, hush. This is serious business.'],
    hot: ['Little one\'s up! Everyone else, hush. This is serious business.'],
    filthy: ['Little one\'s up! Everyone else, hush. This is serious business.'],
  },
  littleRight: {
    mild: ['YES! You got it! [gasps] You\'re smarter than me! That\'s not hard, but still!'],
    spicy: ['YES! You got it! [gasps] You\'re smarter than me! That\'s not hard, but still!'],
    hot: ['YES! You got it! [gasps] You\'re smarter than me! That\'s not hard, but still!'],
    filthy: ['YES! You got it! [gasps] You\'re smarter than me! That\'s not hard, but still!'],
  },
  littleWrong: {
    mild: ['Ooh, so close! It was THIS one! You\'ll get the next one.'],
    spicy: ['Ooh, so close! It was THIS one! You\'ll get the next one.'],
    hot: ['Ooh, so close! It was THIS one! You\'ll get the next one.'],
    filthy: ['Ooh, so close! It was THIS one! You\'ll get the next one.'],
  },
  final: {
    mild: ['That\'s the game! Everybody\'s a winner. Except me. I lost. Again.'],
    spicy: ['That\'s the game! The winner gets... my respect. Briefly.'],
    hot: ['That\'s it. Winner, enjoy it. Losers, there\'s always next time. Probably.'],
    filthy: ['That\'s the game, you magnificent ★★★★★. Go home. Hydrate. Think about what you did.'],
  },
};

interface GameLike {
  stage: string;
  round: number;
  players: Array<{ right: boolean | null }>;
  turn: null | { correct: number | null; picked: number | null };
}

export function gameLine(g: GameLike, spice: Spice, players: Array<{ band: string }>): string {
  let moment: Moment;
  if (g.stage === 'intro') moment = 'intro';
  else if (g.stage === 'question') moment = 'question';
  else if (g.stage === 'reveal') {
    const graded = g.players.filter((p) => p.right !== null);
    const right = graded.filter((p) => p.right).length;
    moment = right === graded.length ? 'allRight' : right === 0 ? 'allWrong' : 'mixed';
  } else if (g.stage === 'turn') moment = 'turn';
  else if (g.stage === 'turnReveal') moment = g.turn && g.turn.picked === g.turn.correct ? 'littleRight' : 'littleWrong';
  else moment = 'final';
  // A Little in the room always gets Mild (ADR 0014); the server's effective spice already says so.
  const level = players.some((p) => p.band === 'little') ? 'mild' : spice;
  const lines = GAME_LINES[moment][level];
  return lines[g.round % lines.length] ?? '';
}
