// One-off, round 2 (owner: "the grok script needs some work. It needs context of what it's writing a line for").
const KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.MODEL || 'x-ai/grok-4.7';

const brief = `You write the host's lines for "Smartmouth", a party trivia game played in a living room. The game is on the TV;
everyone answers on their own phone. Ages 3 to adult can play together; each age gets questions its own size, and the
youngest kids (who can't read) get special picture turns where the grown-ups help with the TV remote.

THE HOST: "Salty", an original character (not based on any real person or film character): a former sea captain who now
hosts this trivia show, swaggering and theatrical, with a stand-up comic's timing. The delivery is UPBEAT: Salty is having a
great time, grinning while roasting. Playful snark, not bitter, not depressed. Lines may be voiced by a woman or a man, so
never assume Salty's gender (no "guy", "lady", "dude", "man" about Salty).

HOW THE LINES ARE USED. Each line is pre-recorded once and reused across many games, so it must NOT name a player, a
question, an answer, a number or a score. Here is exactly when each kind plays, what is on the TV, and what comes next:

- hello: the very first words of a game. The TV shows "Trivia" and "8 rounds. Phones out." Players have just joined.
  Salty introduces themself BY NAME ("I'm Salty"), says what's about to happen (questions on the TV, answer on your phone,
  fast answers score more), and hands off to the first question. 2 to 3 short sentences. RIGHT AFTER: question one appears.
- lobby: the TV shows the room code and a QR code; people are still joining. Salty tells them what to do (grab a phone,
  scan the code or type the letters) while joking. RIGHT AFTER: nothing; it plays while people join.
- join: a new player's character just appeared on the TV. Salty greets "the new one" (no name). One quick sentence.
- intro: the start of rounds 2 to 8. The TV shows "Round" and its number (Salty must not say the number). A quick bridge
  that keeps energy up and teases or hypes; under 12 words. RIGHT AFTER: Salty reads the next question aloud.
- question: rarely used: filler while players think, only when the question has no recording. Under 10 words.
- allRight: the correct answer just lit up on the TV and EVERY player got it. Salty reacts. RIGHT AFTER: Salty reads a
  one-sentence fun fact about the answer, so end the line so the fact can follow naturally. Under 14 words.
- allWrong: the correct answer just lit up and NOBODY got it. Same: react, then the fun fact follows. Under 14 words.
- mixed: the correct answer lit up; some players got it, some didn't. React to the split, then the fact. Under 14 words.
- final: the game is over; the final scoreboard is up with the winner on top. Congratulate the winner (no name), tease
  everyone else, sign off. 1 to 3 short sentences.

COMEDY RULES:
- Mostly about WHAT IS HAPPENING: the answers, the guessing, the phones, the speed, the scores, the confidence. At most
  one line in four may use Salty's backstory (the lost ship, the parrot that left, the couch, the snacks).
- Setup, beat, punch. Funniest word last. Short sentences. Use "..." for a beat and an em dash for a cut-off.
- Specific, surprising images. Misdirection. Escalation. Never the same joke shape twice in a row.
- Delivery tags in square brackets are allowed where the performance turns, at most one per line:
  [deadpan] [laughs] [whispers] [gasps] [sighs] [scoffs] [mischievously] [dramatically] [sarcastic].
- No real people, brands or celebrities. Nothing about race, religion, disability, bodies, or anyone's real life.

SPICE (the room picks; the youngest player caps it):
- mild: little kids are listening. Clean, silly, warm teasing. Kids should laugh.
- spicy: tweens. Sassy and cheeky, zero swearing.
- hot: teens. Mild swears (damn, hell, crap, ass), edgier.
- filthy: adults only. Real swearing (fuck, shit, bastards) where it makes the joke FUNNIER, adult themes like drinking and
  bad decisions, innuendo. Swearing is seasoning, not the joke. No slurs.

Write ${process.env.PER || 8} DIFFERENT lines for every kind at every spice level.
Return JSON only: {"lines":[{"moment":"hello","spice":"mild","text":"..."}, ...]}`;

const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: brief }], max_tokens: 24000, usage: { include: true },
    response_format: { type: 'json_object' } }),
  signal: AbortSignal.timeout(500_000),
});
const j = await r.json();
if (!r.ok) { console.error(JSON.stringify(j).slice(0, 500)); process.exit(1); }
const text = j.choices[0].message.content;
const out = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
console.error(`model ${MODEL}, ${out.lines.length} lines, $${j.usage?.cost}`);
console.log(JSON.stringify(out));
