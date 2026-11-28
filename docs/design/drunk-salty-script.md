# Drunk Salty: script (draft 2)

_Draft 1 2026-11-27. Draft 3 2026-11-27: "too much use of the word sexy vs sexual things to say" (most 'sexy's swapped for actual innuendo), and the drinking noises are now in Salty's own voice (below). Draft 2 2026-11-27, after the owner heard the first audition: "slurred spelling is better, add the
drinking sounds. add a LOT of profanity. She gets a little 'woo girl' and flirty / horny sexual." Not built.
Source idea: `future.drunk` in `content/voice/brief.json`._

Drunk mode is a spice level above Filthy, for adults only. Salty starts the game one drink in and gets worse as it goes.
Each stage is slurrier, louder, swears more, and is hornier and more belligerent than the one before, with drinking sounds
between the lines. Salty starts as the loudest WOO at the party, gets flirty, then gets handsy with words and picks fights,
and ends the game slumped on the couch, mumbling, swearing and asking who wants to make out.

Most of the normal rules in `brief.json` still apply. No names, numbers or scores. Every line makes literal sense, even
when it's mumbled. The funniest word goes last. No real people or brands, and no slurs. **What changes at Drunk** (owner):
swearing is now the texture, not just the seasoning; sexual innuendo and horny flirting with the room are in; and the
voice plays a "woo girl", so this level says what Salty's gender is. The flirting is aimed at "the room" or "whoever's
winning", never at one named player, and it never describes anyone's body. A room with any Kid or Little in it can't choose
Drunk (ADR 0014).

## How the stages advance

The stage comes from how far through the game the room is: questions asked ÷ game length (Short 10 / Medium 30 / Long 50).

| Stage | Progress | Salty | Slur in the text | Sound between lines |
|---|---|---|---|---|
| 1 Buzzed | 0–25 % | WOO energy, too loud, laughs at the jokes, swears like it's a compliment | none | an ice clink or a sip after about 1 line in 4 |
| 2 Tipsy | 25–55 % | Soppy and flirty ("call me"), snippy a second later, a beat late | light: `s` turns into `sh` on stressed words | sips, and a hiccup before about 1 line in 3 |
| 3 Hammered | 55–85 % | Belligerent and horny at once, says the leader is cheating ("it's kinda hot"), restarts words | heavy: `sh` everywhere, dropped endings | a pour, a loud slurp, a bottle on the glass |
| 4 Gone | 85 % to the end | Slumped, mumbling and nodding off, then a shout. Offers to make out with the room. The swear word is always the clear part | very heavy, words run together | the glass slammed down, a bottle falling over and rolling, hiccups mid-line |

**Spelling: slurred (owner, 2026-11-27).** The first audition compared the slurred spelling against normal spelling with
the direction alone. The slurred spelling won. Lines are recorded exactly as written here, and the captions show the same
spelling, bleeped.

**Suggestion (owner's call):** keep the stage going across back-to-back games in the same room, like a bar tab. If the
second game started back at Buzzed, the drunk act would fall apart. Stage 4 would stay at 4. The "Hello" lines below
already allow for a second game.

**Drinking noises in her own voice (owner, 2026-11-27).** The sips, slurps and hiccups are Salty's own voice. They're
recorded **once each as separate clips** and picked by ear, then played at the `{…}` markers like any other sound.
Writing them into the line text was tried in audition 3, and the voice sometimes said the word ("slurp") instead of making
the noise, so lines never spell noises out. Owner's picks (audition 3):

| Marker | Clip | Text it was recorded from |
|---|---|---|
| `{sip}` | `noise-sip-2` | "Mm. Sluurp. ...Ahhh." |
| `{hiccup}` | `noise-hic-1` | "Hic!" |
| `{hiccups}` | `noise-hics-2` (stage 4) | "Hic. ...hic. Hic!" |
| `{slurp}` | `noise-slurp-3` | "Sluuuuurrrp. Sluurp. ...Mm." |
| `{gulp}` | none yet: both gulp takes and the chug were rejected; retried in audition 4 | |
| `{clink}` | `clink-gen3` | Stable Audio Open |
| `{toast}` | `toast-gen1` | Stable Audio Open |
| `{pour}` | `pour-gen1` | Stable Audio Open |
| `{slam}` | `slam-gen1` | Stable Audio Open |
| `{bottle-roll}` | `roll-gen1` | Stable Audio Open |

The 22 CC0 Freesound candidates were all rejected.

**Sounds** are separate clips, not part of the speech. In this script, `{sip}`, `{hiccup}`, `{clink}`, `{pour}`,
`{slurp}`, `{slam}` and `{bottle-roll}` mark where the player plays one. The voice tool never reads them. Candidates are
CC0 recordings from Freesound (draft 2 audition, credits in `CREDITS.md` once the owner picks). `[tags]` are the usual
delivery cues, at most one per line.

## Direction for the recorder, per stage

Each stage is added to the base: "A woman hosting a living-room game show, with a stand-up comic timing, the same bright comic host as always, but drinking. Not a cartoon."

1. **Buzzed:** "One drink in, and the loudest woo girl at the party. Too loud, shrieking WOO, laughing at the jokes, swearing like it's a compliment, consonants just starting to loosen. The timing is still sharp."
2. **Tipsy:** "Tipsy and flirty. A soft slur on the s sounds, words running together, a purring, flirty voice that turns snippy without warning, landing a beat late, giggling mid-sentence."
3. **Hammered:** "Hammered, horny and spoiling for a fight. A heavy slur, the volume lurching around, a low suggestive purr one moment and shouting the next, vowels dragged out, stumbling and restarting words, still trying to host."
4. **Gone:** "Barely conscious. Mumbling and slow, words smeared together and trailing off, long pauses, a sudden loud outburst and then fading again, a sloppy, sleepy flirt. Only the swear words come out clear."

---

## Stage 1: Buzzed

**hello**
- WOOO! Hello, you filthy fuckers! I'm Salty, I'm one drink in, and I'm already picking who I'm going home with. TV asks, phone answers. Let's fucking GO!
- [laughs] Evening, you beautiful idiots! I'm Salty. The TV asks, your phone answers, and I drink every time some dumbass is wrong. So please be fucking wrong. Here we go! `{sip}`
- Hi! Hi, bitches! I'm Salty, and I've had... one. A big fucking one. Questions on the TV, answers on your phone. Who's ready to get weird?! WOO!

**intro**
- Next round! WOO! Drink up, assholes. I already did. `{clink}`
- Look at that leaderboard. Holy shit. I need a refill for this.
- [mischievously] New round, new drink. That's the rule. I just made it up, and it's fucking genius.

**question**
- Tap something, sweetie. I need another fucking drink.
- The clock's ticking. So is my bar tab. Hurry the fuck up.

**allRight**
- Everybody got it! WOO! Brains get me so wet. ...My drink. My drink got wet. Cheers! `{toast}`
- All of you? Ugh. Now I've got no excuse to drink. Drinking anyway, bitches. `{sip}`

**allWrong**
- Nobody! [laughs] Dumb as shit, all of you. I love it. That's a drink for me. Here's what it was.
- All wrong! Oh, tonight is gonna be fucking wonderful for my liver.

**mixed**
- Some of you got it. The rest of you, drink. I'll join you. Supportively. WOO!
- Half right. Like my last marriage. ...I was the wrong fucking half.

**drink** _(new moment: plays once each time the stage goes up)_
- `{sip}` Ahh. That's the shit. Okay. Where the fuck were we?
- `{pour}` Don't look at me like that. You're the ones making me do this. ...WOO!

---

## Stage 2: Tipsy

**hello** _(second game)_
- Hello again, gorgeoush! Still Salty. Shaltier. TV, phone, you know the fucking drill. I forgot the drill. WOOO!
- `{hiccup}` Welcome back, bitches! I'm Salty. I've been here the whole time. Drinking. And having very dirty thoughts about the couch. Lesh fucking go!

**intro**
- Okay. Okay. Nexsht round. I love you guys. Not the one in last. Everybody elshe.
- Whoever'sh winning... call me. Sheriously. I'm shingle, and I'm shit-faced. WOO!
- New round. I'm fine. Thish is my fine fucking voice.

**question**
- Pick one. Any one. Go with your gut. That'sh how I pick who I shleep with.
- Hurry up, baby. My drink'sh getting warm. ...Ish that my drink?

**allRight**
- Everybody?! WOOO! That'sh teamwork. I'd make out with every shingle one of you. Who are you people again?
- You all got it. Shmart people turn me on. And you're all fucking geniushes. ...Thish ish a problem.

**allWrong**
- `{hiccup}` Nobody got it! [laughs] Me neither, and I've got the fucking answer right here. Lemme read it.
- All of you. Wrong. I'm not judging. I'm drinking. Shame thing. ...Same thing.

**mixed**
- Shome of you got it. The resht of you... I shtill wanna take you home. Lesh. ...Less.
- Half and half. Like my drink. Half vodka... and half more fucking vodka.

**drink**
- `{clink}` Thish one'sh for the losers. I mean... thish one's for me. WOO!
- `{sip}` Hydrating. Vodka is moshtly water. Look it up. Don't fucking look it up.

---

## Stage 3: Hammered

**hello** _(third game)_
- Hello! Hello. Who invited all you fuckers? Oh. Me. I'm Shalty, and I'm not wearing any... shoes. Phones. TV. Fucking... go.

**lobbyWaiting** _(between games)_
- Shtart the game. Shomebody. Pressh the fucking button, or I'm pressing charges.
- Why ish nobody pressing shtart? I've been shtanding here for— I'm shitting. When did I shit down. ...Sit. Fuck.

**intro**
- Nexsht round. And whoever'sh winning... I shee your phone, you cheating shit. ...It'sh kinda hot.
- [annoyed] Who moved the fucking leaderboard? Shomebody touched it. Put it back, asshole.
- Shhh. Shut up. Shut the fuck up. It'sh a round. Go.

**question**
- Pick shomething. Or don't. I'm not your fucking mother. Where'sh my drink?
- Tap it. Tap the thing. Tap it like you mean it, baby. Harder. ...Yeah.

**allRight**
- Everybody got it. Of course you did. You looked it up, you lying little shits.
- Oh, now everyone'sh a fucking geniush. Shmart people make me sho horny. Shtop it.

**allWrong**
- Nobody?! Not ONE of you?! I'm the drunk one here! [scoffs] Here. Read it yourshelves, dumbasshes.
- Wrong. All wrong. I've shlept with shmarter people. Not many. But shome.

**mixed**
- Shome of you got it. Shome of you are dead to me. You know who you are. I don't. But you fucking do.
- Half of you got it. The other half can kissh my ass. Shlowly. ...With tongue.

**drink**
- `{pour}` `{slurp}` Don't you dare judge me. You're all on your phonesh. At a fucking party.
- `{clink}` Thish bottle'sh my besht friend. It never picksh the wrong answer. And it puts out.

---

## Stage 4: Gone

**intro**
- Nnnnext... round... roun'... [sighs] ...the fuck'sh a round.
- Whooo'sh winning? Doeshn't... doesn' matter. Nothing mattersh. Shex matters. Shnacks matter.
- I'm not drunk. You're drunk. Thish whole fuckin'... couch ish drunk.

**question**
- Mmmph... pick the... the one. Wi' the... words on it. Fuck.
- Tap... tappy tap... I'm gonna lie down on the... floor'sh nice. Shomebody join me. ...Anybody.

**allRight**
- Y'all got it? [laughs] ...good f'you. Good... fuck. I mean... f'you. Fuck you. Wooo.
- Everybody... ev'ry... I love... where'sh the parrot. PARROT. ...He left. Fuckin' bird.

**allWrong**
- Wrong! Wrooong. All of ya. [laughs] ...me too. I'm wrong. I'm a wrong fuckin' boat.
- Nobody... nobody got... [sighs] I losht a whole ship once. Thish ish worse. Shit.

**mixed**
- Shome... shome of you... `{hiccup}` ...shit. Forgot what I wash shaying. Shome of you are hot.
- Half... half the... look. Look at me. ...Fuck all of you. Lovingly. With tongue.

**drink**
- `{bottle-roll}` ...Thatsh fine. Thatsh fine. There'sh another one in the couch.
- `{slam}` I'M AWAKE. ...I'm awake. [whispers] Who wants to make out.

**final** _(the end of every Drunk game is always stage 4)_
- We have a... we have a winner! Sho proud. Winner gets a drink... and maybe a little shomething elshe. Everybody elshe... loshers. Go home. Thish is my couch now. Night, fuckers. `{bottle-roll}`
- [laughs] Shomebody won. Congrats... whoever. I can't shee the TV. Best night of my fuckin' life. Don't tell anyone. WOOO... g'night.
- Game over. Over. Like my career at shea. [sighs] Winner, I'd kissh you, but there's two of you. ...Fine. Both of you. Everyone elshe... call me a cab.
- Okay. Okay. Winner. Proud. Everybody elshe... wha'sh the word... shit. You're shit. Love you. Bye. `{bottle-roll}`

---

## What building it needs (not done)
- A `drunk` spice level above `filthy` in `packages/protocol`, a grown-up-only pick, and the server rule that a room
  with a Kid or Little can't use it, plus a test.
- A `stage` (1–4) on each line, and `salty.ts` choosing lines by stage from game progress (and the bar-tab carry-over, if the owner wants it).
- A new `drink` moment in `brief.json` that plays when the stage goes up, and the Drunk exceptions to the rules (above) written into the brief.
- `voice.mjs` taking each stage's direction, with `{…}` sound markers removed before recording and played as separate clips.
- The owner's picks from the sound audition, processed with loudnorm, shipped as versioned files and credited in `CREDITS.md`.
- Owner review of these lines before anything is voiced in bulk (ADR 0011).
