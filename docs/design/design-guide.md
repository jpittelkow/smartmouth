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

### How she looks (owner, 2026-11-27)
The voice became a woman's on 2026-11-27, and Salty got a face to match: a 3D-animated lounge diva with purple hair
swept to one side, a gold star pin, green eyes with winged liner and gold hoops (picked from five styles). She sits in
the TV's top bar at 96 px, round, with the ink outline. While her voice plays (not during drinking noises) a
loop of her whole face talking fades in over her still picture. At Drunk her face follows the stage: Tipsy blushes, Hammered has heavy lids and leans, Gone has
her eyes shut and sways. The logo grin stays the logo. Art and how it was made: `tools/art/salty/README.md`.

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
- In live lines he uses players' names (on by default; a grown-up can turn it off, [ADR 0016](../adr/0016-privacy-and-names.md)).
  Pre-made lines say "you", "this one" or the team colour.
- **Captions bleep swearing.** At Filthy the voice swears for real, and the caption shows each swear word as a `--hot`
  pill of exactly four ★ ([ADR 0014](../adr/0014-host-persona-and-spice-levels.md)).
- Example kinds of line: intro, game pick, a question read, "time's almost up", everyone right, everyone wrong,
  one person right, a comeback, a Little wins, the final scores, idle in the lobby, someone joined, someone left.

## 4. Sound
- **Voice:** Salty, through OpenRouter speech ([ADR 0013](../adr/0013-host-voice-openrouter-tts-as-files.md)), made ahead of time
  and played from files. Picking the voice is done by ear on an audition page, the way Crayon Box did it.
- **Music:** a short loopable game-show bed for the lobby and a "thinking" loop, ducked 8 dB under Salty. Sourced
  as CC0 or made by AI (§4.1), and listed in [`CREDITS.md`](../../CREDITS.md).
- **Stings:** join pop, right ding, wrong honk (cartoonish, never harsh), drumroll, crowd cheer for the winner.
- Everything is levelled to one loudness. The TV is the only thing that plays sound; phones stay silent
  apart from an optional tap click.

### 4.1 Getting sounds and music: the recipe
How every effect and music bed is sourced, from Snake Manor's first round (2026-11-27). **Download first, generate
second** (owner, 2026-11-27).

1. **Download first.** Look in free libraries before making anything:
   - Freesound, CC0 only (search with `f=license:"Creative Commons 0"`).
   - The Sonniss GDC bundle (royalty-free, no credit needed).
   - Pixabay sound effects and music.

   Skip anything non-commercial, tagged as AI-made, or with music or voices in an effect. Freesound previews (the
   `-hq.mp3` link on each search result) are good enough for the TV. Its search rate-limits fast callers (429), so
   leave about 7 seconds between searches. **Downloads need the owner's OK first**: list each file, its source and the
   total size.
2. **Generate second**, only for what the libraries don't have:
   - **Music:** Google Lyria 3 through OpenRouter (`tools/sounds/sounds.mjs`): 30-second clips at $0.04, two takes a
     cue, with a `MAX_USD` stop. It returns audio only with `modalities` and `stream` set (gotchas).
   - **Effects:** never from a music model. Lyria turned every effect into a song. A dedicated effects generator
     (for example ElevenLabs' sound effects, which needs its own key) is the option if a library has nothing.
3. **Synthesized sound is a placeholder only.** Web Audio tones sound like MIDI (owner, 2026-11-27). They stay as the
   fallback when a file is missing and for tiny UI blips, never as the final sound for a big moment.
4. **Pick by ear.** Every candidate goes on an audition page (`/media/sounds/...`): the current sound, two or three
   takes, and "none". Picks are copied back as text. The owner chooses; Claude never picks for them.
5. **Process every pick** with ffmpeg: trim leading silence, cap the length to what the moment needs, and level it
   (`loudnorm`: beds I=-20, effects I=-18, true peak -2). Add short fades, and save as 44.1 kHz, 160 kbps mp3. A
   one-take recording that has to change speed (the heartbeat) gets a playback-rate ramp in the game rather than a
   second file.
6. **Ship as files on the server, not in the repo.** Put them in `DATA_DIR/media/sounds/game/<cue>.<version>.mp3`.
   The version is in the name because Cloudflare keeps `/media` files for a year, headers and all. `/api/sounds` lists
   the newest file per cue, and the game falls back to its synthesized sound when a cue has none.
7. **Credit everything** in `CREDITS.md`: author, link and license, even for CC0. Generated music is credited to its
   model and prompts.
8. **Wire it like the drama rules say** (ADR 0024): every sound with its visual, beds ducked about 8 dB under Salty,
   a caption for every sound that carries meaning, and silence where silence is the point.

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
- Salty's face talks while her voice plays (a LivePortrait loop over her still; §3 "How she looks").
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
6. **Salty's lines are spoken on the TV only, with no caption** (owner, 2026-11-27: the caption row is better spent on
   the game; Snake Manor's herald still shows its rules text). A phone shows a line's text only on its own result
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
dense and boring on purpose, and it sits behind the admin password (ADR 0015).

## 7. Accessibility checklist
- Contrast 4.5:1 for text, 3:1 for large display text and focus rings.
- Answers are never shown by colour alone (shape + text or picture).
- Every voiced line has its text in a caption strip on the TV, which can be turned off.
- Phone buttons are at least 64 px tall, with 12 px gaps.
- Respects reduced motion. No flashing faster than 3 Hz.

## 8. Snake Manor

Game #2 ([ADR 0022](../adr/0022-game-two-snake-manor.md)) has its own world: a candlelit manor at night, medieval
and much less cartoonish than trivia. Everything in §1–§7 still holds (sizes, contrast, safe areas, accessibility,
Salty's rules). This section only replaces the look and the host's persona. Mockups:
[mockups/snake-manor.html](mockups/snake-manor.html) (private artifact: https://claude.ai/artifact/UR6VZ46KUoY3fcriACf42k).
Rules for hidden screens: [ADR 0023](../adr/0023-hidden-information.md). Drama and sound:
[ADR 0024](../adr/0024-drama-sequences.md).

_Status: Proposed, 2026-11-27._

### 8.1 Salty as Lord of the Manor
Salty keeps the same voice, snark and spine (none). He has come into a crumbling country manor, won in the only card
game he has ever won, and the deed is written on a napkin. He wears a velvet smoking jacket two sizes too big, swishes
a cape he can't stop swishing, and carries a candelabra everywhere. He's the host with the most: booming welcomes,
long dramatic pauses, toasts to himself. Underneath he's the same candy-ass. He picked the Snakes himself and regrets
it, he sucks up to everyone in case they're one, he sleeps in a wardrobe, and he faints at murders.

- **He never leaks a role** ([ADR 0023](../adr/0023-hidden-information.md)). In character he "picked the Snakes" but has
  "forgotten who, on purpose, for his own safety".
- **Reveal lines are in two parts and never say a typed name** ([ADR 0024](../adr/0024-drama-sequences.md)).
- **Words by spice:** at Spicy a murder is "vanished in the night" and a banishment is "shown the door"; at Hot and
  above, "murdered" and "banished".
- **New line moments:** welcome, roles dealt, mission start, target hit, target missed, overboard, shield given,
  Round Table opens, debate almost up, each vote revealed, Guest banished, Snake banished, night falls, breakfast
  murder, breakfast shield save, breakfast hint, recruitment night, final vote, Guests win, Snakes win.

### 8.2 Colour
A single dark look, like the rest of the TV and phone UI.

| Token | Value | Use |
|---|---|---|
| `--stone` | `#14110e` | stage ground |
| `--stone-2` / `--stone-3` | `#1f1a15` / `#2c251e` | panels, cards on stone |
| `--vellum` | `#e8dbbd` | parchment: questions, role cards, the murdered player's card |
| `--ink` | `#2a1f14` | text on vellum |
| `--gold` | `#c9a24a` | gold leaf: the current thing, the timer, the pot |
| `--gules` | `#a3302a` | oxblood: Salty, danger, the red initial letter |
| `--vert` | `#5b8a63` | verdigris: the Snakes, and only once one is revealed |
| `--candle` | `#f4c66a` | candle flames, the night clock |

### 8.3 Type
| Role | Font | Notes |
|---|---|---|
| Big reveals: roles, banishments, night, morning, the title | **Uncial Antiqua** | used sparingly. Blackletter was tried and dropped on 2026-11-27, because the owner read its S as a G |
| Names, labels, scores, the clock | **Cinzel** 500–700 | inscription capitals, letter-spaced |
| Questions, answers, Salty's captions | **EB Garamond** 400–600 | replaces Atkinson Hyperlegible in this game only (Tweens and up). Test it at 3 m on the office TV |

Sizes follow §5.3: nothing on the TV under 32 px except the quietest labels.

### 8.4 Shapes and components
- **No cartoon outlines or hard offset shadows.** Cards are vellum with a thin double gold rule, and panels are flat stone.
- **Players bear arms.** The 10 seat colours become 10 heraldic tinctures (or, argent, gules, azure, vert, purpure,
  sable, tenné, sanguine, murrey). Each has a fixed charge (fess, pall, chevron, bend, chief, cross, pale, saltire,
  bordure, quarterly), so colour is never the only signal.
- **Answer marks:** crown, key, rose and sword, each with a Roman numeral (I–IV). Trivia keeps its star, heart, moon and bolt.
- **Salty's seal** replaces the grin in this game: a red wax seal with his initial that pulses while he talks.
- **The timer** is a candle that burns down and flares oxblood in the last 5 seconds. The phone gets a thin bar at the top.
- **Votes** land as wax seals stamped with the accused's name. The pot is counted in crowns.
- **At night** phones drop the seat tint and go dim, and every role shares one layout ([ADR 0023](../adr/0023-hidden-information.md)).

### 8.5 Sound and motion
Every reveal is a timed sequence where each sound has its picture: heartbeat and light, quill and ink, silence and
frozen flames, bell and ring, hiss and serpent, puff and snuffed candle ([ADR 0024](../adr/0024-drama-sequences.md)). The
palette is a low organ and cello drone, heartbeat, quill, wax-seal thud, a great bell, a serpent's hiss, guttering
candles, a lute, wind, a creaking door, birdsong, a harpsichord, a cracked fanfare, and a choir for the finale. The
word players must read always lands still.
