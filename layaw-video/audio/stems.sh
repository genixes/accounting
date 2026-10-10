#!/bin/bash
# Voice-over-only and music-only stems (run after make_audio.py)
cd "$(dirname "$0")/build"
ffmpeg -y -loglevel error -i music.wav -af "afade=t=in:d=0.2,loudnorm=I=-16:TP=-1.5:LRA=11" -ar 48000 music_only.wav
ffmpeg -y -loglevel error -i vo_st.wav -af "loudnorm=I=-14:TP=-1.5:LRA=7" -ar 48000 vo_only.wav
