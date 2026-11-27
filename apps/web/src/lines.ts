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
