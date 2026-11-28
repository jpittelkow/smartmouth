# Salty's face

The owner picked her on 2026-11-27 from five styles ("E", the 3D-animated lounge diva, take 11). Original character,
made on the local RTX 3090; not a likeness of anyone. The game uses `apps/web/src/ui/salty/`: `s<stage>.jpg`, her still picture, and `talk-s<stage>.mp4`, a 12-second
loop of her whole face talking (stage 1 sober, which Buzzed shares; 2 Tipsy, 3 Hammered, 4 Gone). The TV
(`apps/web/src/ui/SaltyFace.tsx`) fades the loop in while her voice plays and adds the lean from Hammered on.

How they were made (paths are arguments; outputs went to a scratch folder, not the repo):

1. `gen.py <out>`: Z-Image-Turbo portraits, 3 seeds per style (`STYLES` holds the last run, `OLD` the first). The pick
   was `3d-11.png` (seed 11).
2. `drunk.py <out>`: FLUX.1 Kontext [dev], 4-bit, edits of that same picture, one per Drunk stage (two seeds each; the
   seed-7 takes were picked). Ask for a soft pink blush: "flushed red cheeks" drew red splatter that read as blood. (It
   also makes mouth edits; those aren't used.)
3. `loops.sh <out> <dst>`: LivePortrait animates each stage's picture from its sample talking clip, then crops, loops
   and encodes. Setup notes are in the script.

Mouth frames were tried first and dropped (owner: "her jaw still dislocates"): each still is drawn on its own, so the
face drifts a few pixels between them and flipping 7 times a second reads as the jaw jumping. Splicing only the lips
kept the jaw still but the mouths came out small. A motion model keeps one face consistent from frame to frame.
