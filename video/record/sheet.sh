#!/usr/bin/env bash
# Contact sheet: one frame 2.5 s into each voiceover line of a recorded role.
set -e
role=$1; cd "$(dirname "$0")/.."
mkdir -p out/sheet && rm -f out/sheet/$role-*.png
node -e "const t=require('./public/rec/$role.json');t.lines.forEach(l=>console.log(l.id,(l.t+2.5).toFixed(2)))" |
while read id t; do ffmpeg -nostdin -v error -y -ss $t -i public/rec/$role.mp4 -frames:v 1 -vf scale=560:-1 "out/sheet/$role-$id.png"; done
ffmpeg -v error -y -pattern_type glob -i "out/sheet/$role-*.png" -filter_complex "tile=4x3:padding=6" -frames:v 1 out/sheet/$role.png
echo out/sheet/$role.png
