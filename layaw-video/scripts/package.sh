#!/bin/bash
# Mux rendered silent videos with the mastered audio and collect deliverables in ./deliverables
set -e
cd "$(dirname "$0")/.."
D=deliverables; mkdir -p $D
A=audio/build
for fmt in 16x9 9x16; do
  [ -s out/silent_$fmt.mp4 ] || continue
  # final: voice over + music + sound design, mastered ~ -14 LUFS
  ffmpeg -y -loglevel error -i out/silent_$fmt.mp4 -i $A/master_mix.wav -map 0:v -map 1:a -c:v copy -af apad=whole_dur=39.1333 -t 39.1333 -c:a aac -b:a 320k -movflags +faststart $D/LAYAW_System_Launch_$fmt.mp4
  # voice-over only (no music, no sound design)
  ffmpeg -y -loglevel error -i out/silent_$fmt.mp4 -i $A/vo_only.wav -map 0:v -map 1:a -c:v copy -af apad=whole_dur=39.1333 -t 39.1333 -c:a aac -b:a 320k -movflags +faststart $D/LAYAW_System_Launch_${fmt}_VoiceOver-Only.mp4
done
cp $A/music_only.wav $D/LAYAW_Music_Only.wav
