#!/bin/bash
# usage: master.sh in.wav out.wav   (two-pass loudnorm to -14 LUFS / -1.5 dBTP)
set -e
IN=$1; OUT=$2
J=$(ffmpeg -hide_banner -nostats -i "$IN" -af "alimiter=limit=0.89:level=disabled,loudnorm=I=-14:TP=-1.5:LRA=9:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
mi=$(echo "$J"|python3 -c "import sys,json;print(json.load(sys.stdin)['input_i'])")
mt=$(echo "$J"|python3 -c "import sys,json;print(json.load(sys.stdin)['input_tp'])")
ml=$(echo "$J"|python3 -c "import sys,json;print(json.load(sys.stdin)['input_lra'])")
mth=$(echo "$J"|python3 -c "import sys,json;print(json.load(sys.stdin)['input_thresh'])")
mo=$(echo "$J"|python3 -c "import sys,json;print(json.load(sys.stdin)['target_offset'])")
ffmpeg -y -loglevel error -i "$IN" -af "alimiter=limit=0.89:level=disabled,loudnorm=I=-14:TP=-1.5:LRA=9:measured_I=$mi:measured_TP=$mt:measured_LRA=$ml:measured_thresh=$mth:offset=$mo:linear=true,aresample=48000" -ar 48000 -c:a pcm_s16le "$OUT"
