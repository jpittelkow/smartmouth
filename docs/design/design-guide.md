# Smartmouth design guide

How Smartmouth looks, sounds and behaves. The rules here are the design half of the ADRs: [ADR 0017](../adr/0017-design-language.md)
adopts this guide, [ADR 0013](../adr/0013-host-voice-openrouter-tts-as-files.md) and [ADR 0014](../adr/0014-host-persona-and-spice-levels.md)
cover the voice and the spice levels. Mockups: [mockups/index.html](mockups/index.html) (also a private artifact:
https://claude.ai/artifact/6bYMCkkDVZXgHaprtxxiR6).

_Status: Proposed, 2026-11-26. "Smartmouth" and "Salty" are working names ([open questions](../memory/open-questions.md))._

---

## 1. The idea in one line

**A washed-up rogue hosts a trivia night from your couch and thinks he's too good for all of you, and a four-year-old
beats him anyway.**

Everything should come back to that line. The host is the one being roasted most. Players win, he loses gracefully,
badly, and loudly.

## 2. Brand

### Name
- **Smartmouth** is the working product name. It says the two things the game is about: being smart, and having a mouth on you.
- The URL is `play.<domain>` (domain to come). The TV always shows the URL with a QR code.
- The wordmark is lowercase **smartmouth** in the display font at weight 800, with the `o` replaced by the host's grin
  (the logo mark below). On dark backgrounds it's paper-coloured; on light it's ink.

### Logo mark: "the grin"
A lopsided grin: a wide crescent mouth, one gold tooth, one eyebrow-like slash above it at an angle. No face, no
eyes, no hat. It works as a single colour at 24 px and animates on the TV (the mouth moves while the host talks).

### Things the brand never does
- No copying of any existing party-game look: no Jackbox-style typography, no Kahoot shape/colour answer grid
  (red triangle, blue diamond and the rest). Our answer slots are their own set (§5.2). On phones, answers are
  full-width stacked rows, never a 2×2 grid of colour blocks.
- No real people. The host is an original character (§3). He isn't a parody of a named actor or comedian, doesn't
  use their catchphrases, and his voice isn't a clone of anyone.
- No pirate-theme overload: no skulls, parrots or treasure maps as decoration. The rogue is in the host's attitude, not the wallpaper.

## 3. The host: Salty

### Who he is
**Salty** is a former sea captain who claims he lost his ship in a card game, then a lawsuit, then "a misunderstanding
with a harbour authority". Now he hosts a trivia show from a couch, and he's furious about it. He's an original
character with two halves:

| Half | What it brings | How it shows |
|---|---|---|
| **The slippery rogue** | swagger, theatrical flourish, a lazy drawl that suddenly speeds up, contradicting himself mid-sentence, claiming credit for everything | "I knew that. I *invented* that. Don't look it up." |
| **The exasperated working-class comic** | a rant that builds, blunt honesty, mock outrage at tiny things, punchlines that land on himself | "Who writes these questions? Me. I write them. I hate me." |

He's a **total candy-ass**: he brags, then folds. He threatens, then begs. He's scared of the kids. When he
loses to a toddler he takes it personally and theatrically.

### His rules (these hold at every spice level)
1. **Punch up, or punch himself.** He roasts wrong answers, slow answers, bad team names and himself. He never mocks
   a player's looks, body, intelligence as a person, family, background or anything else about who they are.
2. **Kids always win against him.** In Little and Kids bands he's never mean to a child. The joke is always that
   *he* got beaten, embarrassed or out-smarted.
3. **Short.** A line is one breath, 2–6 seconds. He never stops a player from answering and never talks over the timer's last 5 seconds.
4. **Skippable.** OK on the remote, or the host's skip button on the admin phone, cuts him off.
5. **No real people as targets**, no politics, no religion, no slurs, ever. Current events questions are about the
   event, not a dunk on a person or side.

### Spice levels
The room has a **spice level**, capped by the youngest player in it ([ADR 0014](../adr/0014-host-persona-and-spice-levels.md)).

| Level | Rating | Who can turn it on | What Salty can say | Example (a wrong answer) |
|---|---|---|---|---|
| **Mild** | G | always on when a Little (3–5) is playing | silly, grumpy, self-deprecating; "oh barnacles"; never teases the kid | "[gasps] Not the PURPLE one! ...Okay, fine, purple's nice. Don't tell anyone I said that." |
| **Spicy** | PG | youngest player 6+ | gentle teasing of *answers* (never the person), "butt", "dang", "barnacles" | "Wrong. Beautifully, confidently wrong. I respect it." |
| **Hot** | PG-13 | youngest player 13+ | sarcasm, real roasts of answers, "hell", "damn", "ass", "candy-ass" | "That answer was so bad my eye patch fell off. I don't even wear an eye patch." |
| **Filthy** | R | every player is a Grown-up (18+), and a grown-up turns it on | full profanity and innuendo; still no slurs, no sexual content about players, no punching down; swearing is aimed at the situation or at himself, not at a player | "Holy ★★★★. Four of you, four different answers, and not one of them is a country." |

- The room's level is the lowest of: the cap from the youngest player, and the level the host chose.
- When the youngest player leaves, the cap lifts by itself, back up to the level the host chose (never higher).
- The level is named for heat, not for the host: "Salty" is only ever the host.
- A grown-up can turn the level down any time from the admin phone, and it applies immediately: lines already queued at a higher level are dropped.
- Every line in the voice bank carries a level. The server only ever picks lines at or below the room's level, and a test checks this.

### Writing Salty's lines
- Write for the ear: contractions, short words, one idea per line, the punchline at the end.
- Use ElevenLabs v4 audio tags for delivery: `[sighs]`, `[scoffs]`, `[gasps]`, `[laughs]`, `[whispers]`,
  `[sarcastic]`, `[muttering]`. One or two per line, never more.
- He refers to players as "you", "this one" or by team colour. He only uses a name when names are allowed to reach the voice model ([ADR 0016](../adr/0016-privacy-and-names.md)).
- Example kinds of line: intro, game pick, a question read, "time's almost up", everyone right, everyone wrong,
  one person right, a comeback, a Little wins, the final scores, idle in the lobby, someone joined, someone left.

## 4. Sound
- **Voice:** Salty, through OpenRouter speech ([ADR 0013](../adr/0013-host-voice-openrouter-tts-as-files.md)), made ahead of time
  and played from files. Picking the voice is done by ear on an audition page, the way Crayon Box did it.
- **Music:** a short loopable game-show bed for the lobby and a "thinking" loop, ducked 8 dB under Salty. Sourced
  as CC0 or made by AI, and listed in `CREDITS.md`.
- **Stings:** join pop, right ding, wrong honk (cartoonish, never harsh), drumroll, crowd cheer for the winner.
- Everything is levelled to one loudness. The TV is the only thing that plays sound; phones stay silent
  apart from an optional tap click.

## 5. Visual system

### 5.1 Two screens, two jobs
| | TV (host screen) | Phone (controller) |
|---|---|---|
| Job | show the room: the question, the drama, the scores | answer, quickly, without looking down for long |
| Seen from | 2–4 m, ten-foot UI | 30 cm, held in one hand |
| Frame | 1920 × 1080 (16:9), 5% safe margin | 390 × 844 portrait reference, works at 320 wide |
| Input | the TV remote (D-pad, OK, Back) for the Little seat and the menus | thumb |
| Text | lots of it, huge | as little as possible: "look at the TV" is a fine screen |

### 5.2 Colour tokens
Dark stage by default, because it's a TV in a living room at night. CSS custom properties use these names.

| Token | Value | Use |
|---|---|---|
| `--ink` | `#14111f` | stage background, text on light |
| `--stage` | `#1f1a36` | raised panels on the stage |
| `--stage-2` | `#2b2450` | cards, player tiles |
| `--paper` | `#fff6e6` | text on dark, light cards |
| `--muted` | `#b9b1d6` | secondary text on dark |
| `--spot` | `#ffd23f` | the spotlight: main action, the current thing, the timer |
| `--hot` | `#ff4f7b` | Salty's colour: his mouth, wrong answers, warnings |
| `--zap` | `#36dcb8` | correct, success, joined |
| `--sky` | `#5aa8ff` | info, links |
| `--grape` | `#a77bff` | accents, the Kids band |

**Answer slots** each have a colour and a shape, so colour is never the only signal:

| Slot | Colour | Shape |
|---|---|---|
| 1 | `--spot` yellow | star |
| 2 | `--hot` pink | heart |
| 3 | `--zap` teal | moon |
| 4 | `--sky` blue | bolt |

**Player colours** (one per seat, max 10): yellow, pink, teal, blue, purple, orange `#ff9a3c`, lime `#a6e34f`,
red `#ff5a4e`, cyan `#3fd0f0`, white `#f4f0ff`. A player's colour follows them onto their phone's background tint.

Light mode exists only for the admin page. The TV and controllers are always dark (it's a show).

### 5.3 Type
| Role | Font | Notes |
|---|---|---|
| Display: question text, the wordmark, scores, room code | **Bricolage Grotesque** 700–800 | chunky, slightly wonky, has character |
| Body: answers, labels, phone UI | **Atkinson Hyperlegible Next** 400–700 | built for legibility; good for new readers |

Both are OFL, self-hosted in the web app (no font CDN at play time). Sizes are in px at the reference frame:

| | TV | Phone |
|---|---|---|
| Question | 64–88 (auto-fit, never below 56) | — (the phone doesn't show the question by default) |
| Answer | 44–56 | 22–28 |
| Room code | 160, letter-spaced 0.12em | 40 |
| Body / labels | 32 minimum | 17 minimum |

### 5.4 Shapes and components
- **The stage panel.** Ink outlines and ink shadows vanish on an ink background, so on the TV the safe area is one big
  `--stage` panel and cards sit on it. The 5% margin around it stays `--ink`. On phones the background is the
  player's tint (80% `--ink`, 20% player colour), which is light enough for ink shadows to read.
- **Cards** have 28 px corners on TV and 18 px on phone, a 4 px `--ink` outline, and a hard 8 px / 5 px offset shadow
  in `--ink`. It's a cartoon game-show look: flat, chunky, no gradients and no glassmorphism.
- **Pressable things** (phone answer buttons, Little picture buttons, TV menu items) have the outline and the
  offset shadow. A press moves them down onto the shadow. Panels don't get a shadow.
- **Focus on TV** (D-pad): a 6 px `--spot` ring plus a 1.08 scale-up. Colour alone is never the signal.
- **Timer:** a fat ring on the TV that drains, `--spot` going to `--hot` in the last 5 seconds. The phone gets a
  thin bar at the top.
- **Player tile:** avatar blob in the player's colour, name, and score. On the TV, tiles sit along the bottom edge:
  one row of up to 6, and two rows of 5 for 7–10 players, so a name always gets its 32 px. Names that don't fit are
  cut with an ellipsis. Empty seats collapse into one dashed "+N seats" tile.
- **Avatars:** simple blob creatures with googly eyes (original art) in the player's colour. Picked on join.
- **Icons:** inline SVG, rounded 3 px strokes, no emoji in the UI.

### 5.5 Motion
- Things arrive with a quick overshoot (`cubic-bezier(.34,1.56,.64,1)`, 250–400 ms). Scores count up.
- Salty's grin animates while he talks (mouth open/close driven by the audio level).
- Respect `prefers-reduced-motion` on phones: no bounces, just fades.
- The TV never animates something the players need to read. The question appears and stays put.

## 6. UX rules

### TV
1. **Always show how to join.** The URL, the room code and a QR code are on every lobby screen. During a game a
   small join chip stays in a corner for latecomers.
2. **One thing on screen at a time:** the question, then the answers, then the reveal, then the scores.
3. **Everything is readable from the couch.** Nothing under 32 px, and 4.5:1 contrast at minimum.
4. **The remote can run the whole show:** start, pick a game, next, pause and quit. The D-pad focus order follows the visual order.
5. **Back is safe.** Back opens a pause menu (Resume, Spice level, Captions on/off, End game). It never quits mid-game.
6. **Salty's lines are spoken and captioned on the TV only.** A phone shows a line's text only on its own result
   screen ("you were right / wrong"), and never plays audio.

### Phone
1. **Join in one screen:** room code (pre-filled from the QR), name, age, done. Picking an avatar comes next and can be skipped.
2. **Age is asked as a picture choice, not a birthday:** "3–5", "6–8", "9–12", "13–17", "Grown-up". Each choice
   has an icon, and the answer is stored on that phone only.
3. **Look at the TV.** The phone shows only what the player needs to act on: answer buttons, "locked in", "you
   were right". The question lives on the TV (the "big screen, small remote" model).
4. **Locked in is obvious:** big tick, colour flood, a buzz where vibration is supported.
5. **Reconnect is invisible:** reload the page, or lock and unlock the phone, and you're back in your seat with your score.
6. **One grown-up runs the room:** the first person to join with "Grown-up" picked is the room's admin phone,
   with skip, pause, spice level, kick and end game. The TV remote can do the same.

### The Little seat (ages 3–5)
For players who can't read yet ([ADR 0009](../adr/0009-the-little-seat.md)). The rules are the same on the TV and on a phone in kid mode:
1. **No reading needed.** Salty reads everything aloud: the question and every answer as it gets focus.
2. **Two or three big picture answers**, never four. Each one is a picture on a card about 28% of the screen width
   (three cards, gaps and the focus scale-up must fit inside the safe area).
3. **No timer pressure.** The question waits for the kid. A Little's question is its own turn on the TV: older
   players watch (and can lock in a helper guess), and the round doesn't move on until the Little picks.
4. **Every answer gets a cheer.** A right answer gets a big cheer. A wrong one gets "ooh, so close! It was THIS one!", and the right card bounces.
5. **No losing screens.** Final scores celebrate the Little player whatever happened. Scores in the Little band are scaled by handicap ([ADR 0008](../adr/0008-age-bands-per-player.md)).
6. **Three ways to play:** on the TV remote (left/right to pick, OK to choose), on a grown-up's phone in kid
   mode (pictures only, no way out without a long press), or on a tablet.

### Admin page (`/admin`)
The plain grown-up tool for the question bank, review queue, voice lines, settings and spend. It's light/dark,
dense and boring on purpose, and it sits behind Cloudflare Access.

## 7. Accessibility checklist
- Contrast 4.5:1 for text, 3:1 for large display text and focus rings.
- Answers are never shown by colour alone (shape + text or picture).
- Every voiced line has its text in a caption strip on the TV, which can be turned off.
- Phone buttons are at least 64 px tall, with 12 px gaps.
- Respects reduced motion. No flashing faster than 3 Hz.
