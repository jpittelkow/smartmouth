# Salty's face

The owner picked her on 2026-11-27 from five styles ("E", the 3D-animated lounge diva, take 11). Original character,
made on the local RTX 3090; not a likeness of anyone. The game uses the 12 frames in `apps/web/src/ui/salty/`:
`s<stage>-<closed|mid|open>.jpg`, stage 1 sober (Buzzed looks the same), 2 Tipsy, 3 Hammered, 4 Gone. The TV
(`apps/web/src/ui/SaltyFace.tsx`) flips the mouth frames while her voice plays and adds the lean from Hammered on.

How they were made (paths are arguments; outputs went to a scratch folder, not the repo):

1. `gen.py <out>`: Z-Image-Turbo portraits, 3 seeds per style (`STYLES` holds the last run, `OLD` the first). The pick
   was `3d-11.png` (seed 11).
2. `drunk.py <out>`: FLUX.1 Kontext [dev], 4-bit, edits of that same picture: one per Drunk stage (two seeds each; the
   seed-7 takes were picked), then a parted and an open mouth for each. The prompts keep the head still and ask for a
   soft blush; asking for "flushed red cheeks" drew red splatter that read as blood.
3. `talk.py <out>`: the same mouth edits for the sober picture (and, during the audition, the comic and photo styles).
4. `stages.py <out> <dst>`: splices each mouth onto its stage's own picture, only where the pixels changed below the
   nose (down through the neck, since the jaw drops when she talks; a smaller patch left her chin floating), then crops
   to the face at 256 px.

Run with the story-maker venv (diffusers + bitsandbytes): `HF_HUB_OFFLINE=1 <venv>/python -I drunk.py <out>`.
