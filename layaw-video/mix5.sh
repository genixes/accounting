#!/bin/bash
# usage: mix5.sh musicGain sfxGain  -> mix5.wav   (music has a per-section level curve)
ffmpeg -y -loglevel error -i assets/voice_norm.wav -i assets/music5.wav -i assets/sfx5.wav -filter_complex \
"[0:a]asplit=2[v1][v2];[1:a]volume=$1,volume='if(lt(t,4.7),2.2,if(lt(t,15.6),0.79,if(lt(t,33.6),0.52,0.69)))':eval=frame[m];[m][v1]sidechaincompress=threshold=0.08:ratio=1.5:attack=20:release=300:makeup=1[md];[2:a]volume=$2[fx];[md][v2][fx]amix=inputs=3:duration=longest:normalize=0,alimiter=limit=0.89,apad=whole_dur=39.133[a]" \
-map "[a]" -t 39.133 mix5.wav
