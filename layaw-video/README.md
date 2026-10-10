# LAYAW SYSTEM launch video (Remotion)

Deliverables are in `deliverables/`:

| File | What |
|---|---|
| `LAYAW_System_Launch_16x9.mp4` | Main cut, 1920x1080, 30 fps, H.264 + AAC, VO + music + SFX, about -14 LUFS |
| `LAYAW_System_Launch_9x16.mp4` | Vertical cut for Reels / TikTok / Shorts, 1080x1920, safe zones respected |
| `..._VoiceOver-Only.mp4` | Same visuals, narration only (no music, no sound design) |
| `LAYAW_Music_Only.wav` | Music + sound design stem (no narration) |
| `LAYAW_System_Thumbnail_*.png` | Thumbnail / title card |
| `LAYAW_Script_Map_and_Storyboard.md` | Timestamped script map, storyboard, assumptions, music licence |

## Rebuild

```bash
cd layaw-video && npm install
python3 audio/make_audio.py && (cd audio/build && ../master.sh mix_raw.wav master_mix.wav)
audio/stems.sh                                                                  # vo_only + music_only stems
scripts/render.sh Main16x9 out/silent_16x9.mp4      # ~11 min on 4 cores
scripts/render.sh Main9x16 out/silent_9x16.mp4
scripts/package.sh                                   # mux audio -> deliverables/
npx remotion studio src/index.ts                     # live preview
```

Captions live in `src/captions.ts`; narration timings in `src/theme.ts` (`TM`).
