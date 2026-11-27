# Drunk Salty: script (draft 1)

_Draft 2026-11-27. Not built and not voiced. Source idea: `future.drunk` in `content/voice/brief.json` (owner, 2026-11-27)._

Drunk mode is a spice level above Filthy, for adults only. Salty starts the game one drink in and gets worse as it goes.
Each stage is slurrier, crankier, more suspicious of the players and dirtier than the one before, with drinking sounds
between the lines. By the final scores Salty can barely get a word out, apart from the swear words.

All the normal rules in `brief.json` still apply. No names, numbers or scores. Every line makes literal sense, even if it's
mumbled. The funniest word goes last. Salty's gender is never stated. No real people or brands, and nothing about bodies.
A room with any Kid or Little in it can't choose Drunk (ADR 0014).

## How the stages advance

The stage comes from how far through the game the room is: questions asked ÷ game length (Short 10 / Medium 30 / Long 50).

| Stage | Progress | Salty | Slur in the text | Sound between lines |
|---|---|---|---|---|
| 1 Buzzed | 0–25 % | Too loud, laughs at the jokes before finishing them, very pleased with everyone | none | an ice clink or a sip after about 1 line in 4 |
| 2 Tipsy | 25–55 % | Soppy one second and snippy the next, loses words, a beat late on the timing | light: `s` turns into `sh` on stressed words | sips, and a hiccup before about 1 line in 3 |
| 3 Hammered | 55–85 % | Hostile and paranoid, says the leader is cheating, restarts words, the swearing gets louder | heavy: `sh` all over, dropped endings | a bottle clinks on a glass, a long pour, a loud slurp |
| 4 Gone | 85 % to the end | Mumbling and nodding off, then a sudden shout, then fading out again. The last swear word comes out clear | very heavy, words run together | the glass slammed down, a bottle tipping over and rolling, a hiccup in the middle of a line |

**Suggestion (owner's call):** keep the stage going across back-to-back games in the same room, like a bar tab. If the
second game started back at Buzzed, the drunk act would fall apart. Stage 4 would stay at 4. The "Hello" lines below
already allow for a second game.

**Sounds** are separate clips, not part of the speech. In this script, `{sip}`, `{hiccup}`, `{clink}`, `{pour}`,
`{slurp}`, `{slam}` and `{bottle-roll}` mark where the player plays one. The voice tool never reads them. Get the clips from
CC0 libraries first (the Freesound CC0 filter, Sonniss packs). The generated Seed Audio clips are the fallback.
`[tags]` are the usual delivery cues, at most one per line.

## Direction for the recorder, per stage

Each stage is added to the Laomedeia direction:

1. **Buzzed:** "One drink in. A little too loud, laughing at the jokes, consonants just starting to loosen. The timing is still sharp."
2. **Tipsy:** "Tipsy. A soft slur on the s sounds, words running together, sudden swings between soppy and snippy, landing a beat late, giggling mid-sentence."
3. **Hammered:** "Hammered. A heavy slur, the volume lurching around, hostile and suspicious, vowels dragged out, stumbling and restarting words, still trying to host."
4. **Gone:** "Barely conscious. Mumbling and slow, words smeared together and trailing off, long pauses, a sudden loud outburst and then fading again. Only the last swear word comes out clear."

**Audition first:** record a few lines from each stage twice, once spelled normally with the direction alone and once
with the slurred spelling below. The slurred spelling might make the voice sound like a cartoon. Keep whichever version
sounds drunk instead of silly. The captions show the slurred spelling either way, because it's funny on the TV. The
captions are still bleeped.

---

## Stage 1: Buzzed

**hello**
- Hello, everybody! I'm Salty, and I started the party without you. Rude of me. Questions on the TV, answers on your phone, fastest wins. Let's fucking go!
- [laughs] Evening, you beautiful idiots! I'm Salty. The TV asks, your phone answers, and I drink every time somebody's wrong. So please be wrong. Here we go! `{sip}`
- Hi! Hi, everybody! I'm Salty, and I've had... one. A big one. Questions on the TV, answers on your phone. Everyone ready?!

**intro**
- Next round! Drink up. I already did. `{clink}`
- Look at that leaderboard. Wow. I'm gonna need a refill for this.
- [mischievously] New round, new drink. That's the rule. I just made it up.

**question**
- Tap something. I'm getting another drink.
- The clock's ticking. So is my bar tab.

**allRight**
- Everybody got it! Ugh. Now I've got no excuse to drink. Drinking anyway. `{sip}`
- All of you? Fine. Cheers, you smug bastards.

**allWrong**
- Nobody! [laughs] Fantastic. That's a drink for me. Here's what it was.
- All wrong! Oh, tonight is gonna be wonderful for my liver.

**mixed**
- Some of you got it. The rest of you, drink. I'll join you. To be supportive.
- Half right. Like my last marriage. ...I was the wrong half.

**drink** _(new moment: plays once each time the stage goes up)_
- `{sip}` Ahh. That's the stuff. Okay. Where were we?
- `{pour}` Don't look at me. You're the ones making me do this.

---

## Stage 2: Tipsy

**hello** _(second game)_
- Hello again, everybody! Still Salty. Shaltier. TV, phone, you know the drill. I forgot the drill. Here we go!
- `{hiccup}` Welcome back! I'm Salty. I've been here the whole time. Drinking. Questions on the TV, answers on your phone. Lesh go!

**intro**
- Okay. Okay. Nexsht round. I love you guys. Not the one in last. Everybody elshe.
- Look at the leaderboard. [sighs] It's beautiful. I'm gonna cry. Or order a pizza.
- New round. I'm fine. Thish is my fine voice.

**question**
- Pick one. Any one. Pick the shiny one.
- Hurry up. My drink'sh getting warm. ...Is that my drink?

**allRight**
- Everybody?! That'sh... that's teamwork. I'm so proud. Who are you people again?
- You all got it. Shmart. Too shmart. I don't trusht it.

**allWrong**
- `{hiccup}` Nobody got it! [laughs] Me neither, and I've got the answer right here. Lemme read it.
- All of you. Wrong. I'm not judging. I'm drinking. Shame thing. ...Same thing.

**mixed**
- Shome of you got it. The resht of you... I shtill love you. Lesh. Less.
- Half and half. Like my drink. Half vodka... and half more vodka.

**drink**
- `{clink}` Thish one's for the losers. I mean... thish one's for me.
- `{sip}` Hydrating. Vodka is mostly water. Look it up. Don't look it up.

---

## Stage 3: Hammered

**hello** _(third game)_
- Hello! Hello. Who invited all you people? Oh. Me. I'm Shalty. Phones. TV. Fucking... go.

**lobbyWaiting** _(between games)_
- Shtart the game. Shomebody. Pressh the button, or I'm pressing charges.
- Why is nobody pressing shtart? I've been shtanding here for— I'm shitting. When did I shit down. ...Sit. Sit down.

**intro**
- Nexsht round. And whoever'sh winning... I see you. I shee your phone. Cheater.
- [annoyed] Who moved the leaderboard? Shomebody touched it. Put it back.
- Shhh. Shut up. It'sh a round. Go.

**question**
- Pick shomething. Or don't. I'm not your mother. Where's my drink?
- Tap it. Tap the thing. Tap it like you mean it, shweetheart.

**allRight**
- Everybody got it. Of course you did. You looked it up, you lying little shits.
- Oh, now everyone's a fucking geniush. Where was thish attitude earlier?

**allWrong**
- Nobody?! Not ONE of you?! I'm the drunk one here! [scoffs] Here. Read it yourshelves.
- Wrong. All wrong. I've shlept with shmarter people. Not many. But shome.

**mixed**
- Shome of you got it. Shome of you are dead to me. You know who you are. I don't. But you do.
- Half of you got it. The other half can kissh my ass. Lovingly.

**drink**
- `{pour}` `{slurp}` Don't you dare judge me. You're all on your phones. At a party.
- `{clink}` Thish bottle'sh my besht friend. It never picks the wrong answer.

---

## Stage 4: Gone

**intro**
- Nnnnext... round... roun'... [sighs] ...the fuck's a round.
- Whooo'sh winning? Doeshn't... doesn' matter. Nothing mattersh. Shnacks matter.
- I'm not drunk. You're drunk. Thish whole... couch ish drunk.

**question**
- Mmmph... pick the... the one. Wi' the... words on it.
- Tap... tappy tap... I'm gonna lie down on the... the... floor'sh nice.

**allRight**
- Y'all got it? [laughs] ...good f'you. Good... fuck. I mean... f'you.
- Everybody... ev'ry... I love... where'sh the parrot. PARROT. ...He left.

**allWrong**
- Wrong! Wrooong. All of ya. [laughs] ...me too. I'm wrong. I'm a wrong boat.
- Nobody... nobody got... [sighs] I losht a whole ship once. Thish ish worse.

**mixed**
- Shome... shome of you... `{hiccup}` ...shit. Forgot what I wash shaying. Shome of you.
- Half... half the... look. Look at me. ...Fuck all of you. Lovingly.

**drink**
- `{bottle-roll}` ...Thatsh fine. Thatsh fine. There's another one in the couch.
- `{slam}` I'M AWAKE. ...I'm awake. [whispers] Who's winning.

**final** _(the end of every Drunk game is always stage 4)_
- We have a... we have a winner! Sho proud. Everybody elshe... losherrrs. Go home. Thish is my couch now. Night, fuckers.
- [laughs] Shomebody won. Congrats... whoever. I can't shee the TV. Best night of my life. Don't tell anyone. G'night.
- Game over. Over. Like my career at shea. [sighs] Winner, I'd kissh you, but there's two of you. Everyone elshe... call me a cab.
- Okay. Okay. Winner. Proud. Everybody elshe... wha'sh the word... shit. You're shit. Love you. Bye. `{bottle-roll}`

---

## What building it needs (not done)
- A `drunk` spice level above `filthy` in `packages/protocol`, a grown-up-only pick, and the server rule that a room
  with a Kid or Little can't use it, plus a test.
- A `stage` (1–4) on each line, and `salty.ts` choosing lines by stage from game progress (and the bar-tab carry-over, if the owner wants it).
- A new `drink` moment in `brief.json` that plays when the stage goes up.
- `voice.mjs` taking each stage's direction, with `{…}` sound markers removed before recording and played as separate clips.
- About 20 sound clips (4–5 for each of sip, hiccup, clink/pour, slurp, slam, bottle-roll), from CC0 libraries first.
- Owner review of these lines before anything is voiced (ADR 0011).
