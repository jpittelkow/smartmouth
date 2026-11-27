#!/usr/bin/env bash
# Ships the owner's trivia sound picks (2026-11-27) as versioned files the game lists at /api/sounds.
# Picked effects play every time; moments the owner marked "none" ("I actually like all of them") rotate every take.
set -euo pipefail
S="$1"
FF=/c/Users/jpitt_6932a9v/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg
V=t1a
OUT="$S/ship"
mkdir -p "$OUT" "$S/music-raw"
# Picked: one file, played every time.
for pair in start:3 round:3 lock:2 tick:2 reveal:3 right:1 allwrong:2 applause:3 slide:3 sparkle:2; do
  cue=${pair%%:*}; n=${pair##*:}
  cp "$S/trivia-sounds/$cue-$n.mp3" "$OUT/trivia-$cue.$V.mp3"
done
# Rotating: every take.
for pair in join:3 timeup:3 count:3 yay:2; do
  cue=${pair%%:*}; n=${pair##*:}
  for i in $(seq 1 "$n"); do cp "$S/trivia-sounds/$cue-$i.mp3" "$OUT/trivia-$cue-$i.$V.mp3"; done
done
# Music beds, both takes, levelled for beds (I=-20) with soft fades so they loop.
scp -q "root@192.168.1.4:/mnt/apps/appdata/smartmouth/data/media/sounds/trivia/music/*.mp3" "$S/music-raw/"
for bed in lobby think leaderboard winner; do
  for i in 1 2; do
    "$FF" -y -loglevel error -i "$S/music-raw/$bed-$i.mp3" -af "afade=t=in:d=0.4,areverse,afade=t=in:d=1.5,areverse,loudnorm=I=-20:TP=-2:LRA=11" -ar 44100 -b:a 160k "$OUT/trivia-$bed-$i.$V.mp3"
  done
done
ls "$OUT" | wc -l
scp -q "$OUT"/*.mp3 root@192.168.1.4:/mnt/apps/appdata/smartmouth/data/media/sounds/game/
ssh root@192.168.1.4 'chown 1000:1000 /mnt/apps/appdata/smartmouth/data/media/sounds/game/trivia-*; ls /mnt/apps/appdata/smartmouth/data/media/sounds/game/ | grep -c "^trivia-"'
