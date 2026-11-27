# Salty's voice

Salty's voice is made through OpenRouter speech (ADR 0013), not Piper. The default model is `elevenlabs/eleven-v4`.

## Picking a voice (build step 4)
1. Choose a few candidate voices for the model. They must be stock or designed voices, never a clone or an
   imitation of a real person (ADR 0014).
2. Preview what will be made, without a key: `DRY=1 VOICES=a,b node tools/voice/generate.mjs`.
3. Make the clips where the key lives (inside the server's container):
   `VOICES=a,b,c OUT=/tmp/salty node tools/voice/generate.mjs`.
4. Copy `/tmp/salty` back and open `audition.html`. Every candidate reads the same 12 lines, across all four spice levels.
5. Record the pick in an ADR (it supersedes the open voice choice in ADR 0013), and note the voice's retirement
   date, if it has one.

The test lines are in [audition-lines.json](audition-lines.json). The line bank, question reads and levelling come later (ADR 0019 step 4).
