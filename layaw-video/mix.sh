#!/bin/bash
# usage: mix.sh musicGain ratio threshold  -> mix2.wav (+ /tmp/mo.wav ducked music only for analysis)
ffmpeg -y -loglevel error -i assets/voice_norm.wav -i assets/music2.wav -i assets/sfx2.wav -filter_complex \
"[0:a]asplit=2[v1][v2];[1:a]volume=$1[m];[m][v1]sidechaincompress=threshold=$3:ratio=$2:attack=15:release=300:makeup=1,asplit=2[md1][md2];[2:a]volume=0.8[fx];[md1][v2][fx]amix=inputs=3:duration=longest:normalize=0,alimiter=limit=0.89,apad=whole_dur=39.133[a]" \
-map "[a]" -t 39.133 mix2.wav -map "[md2]" -t 39.133 /tmp/mo.wav
