#!/usr/bin/env python3
"""
LAYAW SYSTEM launch video: original music + sound design, synthesized from scratch with
numpy/scipy (no samples, no third-party music => no licensing issues), then ducked under
the narration and mastered to about -14 LUFS.

Outputs (audio/build/):
  music.wav        music only (undcked, full-length)
  sfx.wav          sound design only
  music_ducked.wav music after sidechain ducking
  mix_raw.wav      VO + ducked music + sfx (pre-master)
"""
import json, os, subprocess, sys
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "build")
os.makedirs(OUT, exist_ok=True)
VO = os.path.join(HERE, "voiceover.mp3")

BPM = 120.0
BEAT = 60.0 / BPM          # 0.5 s
BAR = 4 * BEAT             # 2.0 s
OFFSET = 0.5               # bar grid offset: bar 8 starts at 16.5 s = logo reveal
rng = np.random.default_rng(26)

# ---------- decode VO ----------
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", VO, "-ar", str(SR), "-ac", "1",
                os.path.join(OUT, "vo.wav")], check=True)
_, vo = wavfile.read(os.path.join(OUT, "vo.wav"))
vo = vo.astype(np.float64) / 32768.0
DUR = len(vo) / SR
N = len(vo)
T = np.arange(N) / SR
print("VO duration", DUR)

# ---------- helpers ----------
def adsr_env(n, a=0.005, d=0.1, s=0.0, r=0.05):
    e = np.zeros(n)
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    na = max(na, 1)
    e[:na] = np.linspace(0, 1, na)
    nd = min(nd, n - na)
    if nd > 0:
        e[na:na + nd] = np.linspace(1, s, nd)
    e[na + nd:] = s
    if nr > 0 and nr < n:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e

def lp(x, fc, order=2):
    sos = signal.butter(order, min(fc, SR / 2 - 100), "low", fs=SR, output="sos")
    return signal.sosfilt(sos, x)

def hp(x, fc, order=2):
    sos = signal.butter(order, fc, "high", fs=SR, output="sos")
    return signal.sosfilt(sos, x)

def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], "band", fs=SR, output="sos")
    return signal.sosfilt(sos, x)

def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)

def saw(f, n, phase=0.0):
    t = np.arange(n) / SR
    return 2.0 * ((f * t + phase) % 1.0) - 1.0

def put(buf, x, t0, gain=1.0, pan=0.0):
    """mix mono x into stereo buf at time t0 with constant-power pan"""
    i = int(t0 * SR)
    if i >= buf.shape[0] or i + len(x) <= 0:
        return
    if i < 0:
        x = x[-i:]
        i = 0
    j = min(i + len(x), buf.shape[0])
    x = x[: j - i]
    if x.ndim == 2:   # already stereo
        buf[i:j] += x * gain
        return
    l = np.cos((pan + 1) * np.pi / 4)
    r = np.sin((pan + 1) * np.pi / 4)
    buf[i:j, 0] += x * gain * l
    buf[i:j, 1] += x * gain * r

def reverb_ir(sec=1.8, decay=3.2, damp=6000):
    n = int(sec * SR)
    ir = rng.standard_normal((n, 2)) * np.exp(-np.arange(n)[:, None] / SR * decay * 2.2)
    ir[:, 0] = lp(ir[:, 0], damp)
    ir[:, 1] = lp(ir[:, 1], damp)
    ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))[:, None]
    return ir / np.sqrt((ir ** 2).sum())

IR = reverb_ir()
def reverb(buf, wet=0.25, ir=IR):
    out = np.zeros_like(buf)
    for c in range(2):
        out[:, c] = signal.fftconvolve(buf[:, c], ir[:, c])[: buf.shape[0]]
    return buf * (1 - wet * 0.5) + out * wet

# ---------- instruments ----------
def kick(vel=1.0):
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 48 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t * 7.5)
    x += 0.35 * hp(rng.standard_normal(n), 2000) * np.exp(-t * 220)
    return np.tanh(x * 1.6) * vel

def hat(vel=1.0, open_=False):
    n = int((0.22 if open_ else 0.05) * SR)
    t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 7000) * np.exp(-t * (18 if open_ else 90))
    return x * vel

def clap(vel=1.0):
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    x = bp(rng.standard_normal(n), 1200, 3800)
    e = np.zeros(n)
    for k, off in enumerate([0, 0.012, 0.024]):
        i = int(off * SR)
        e[i:] += np.exp(-(t[: n - i]) * 90) * (0.6 if k < 2 else 1.0)
    e += 0.5 * np.exp(-t * 22)
    return x * e * vel

def pluck(m, dur=0.35, bright=4500, sq=0.0):
    n = int(dur * SR)
    f = mtof(m)
    x = saw(f, n) * (1 - sq) + np.sign(saw(f, n, 0.25)) * sq
    x += 0.6 * saw(f * 1.004, n)
    env = np.exp(-np.arange(n) / SR * 11)
    sweep = lp(x, bright)
    return sweep * env * 0.5

def bass_note(m, dur):
    n = int(dur * SR)
    f = mtof(m)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.45 * lp(saw(f, n), 420)
    return x * adsr_env(n, 0.006, 0.12, 0.7, 0.05) * 0.8

def pad_chord(ms, dur, bright=1800, swell=0.4):
    n = int(dur * SR)
    out = np.zeros(n)
    for m in ms:
        for det in (-0.09, 0.0, 0.11):
            f = mtof(m) * 2 ** (det / 12)
            out += saw(f, n, rng.random())
    out = lp(out / (len(ms) * 3), bright, 2)
    return out * adsr_env(n, swell, 0.2, 0.9, 0.35)

def bell(m, dur=2.2, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = mtof(m)
    x = (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t * 3)
         + 0.35 * np.sin(2 * np.pi * f * 3.01 * t) * np.exp(-t * 5)
         + 0.2 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 9))
    return x * np.exp(-t * 2.2) * adsr_env(n, 0.002, 0.01, 1.0, 0.1) * vel

# ---------- music arrangement ----------
# chord = (bass midi, [pad/arp pitches])
C  = (36, [60, 64, 67, 72])
G  = (43, [59, 62, 67, 71])
Am = (45, [57, 60, 64, 69])
F  = (41, [57, 60, 65, 69])
PROG_MINOR = [Am, F, C, G]      # tension / curiosity
PROG_MAJOR = [C, G, Am, F]      # uplift

def bar_chord(bar):
    return PROG_MINOR[bar % 4] if bar < 8 else PROG_MAJOR[bar % 4]

music_L = np.zeros((N, 2))
kicks_t = []          # kick times for sidechain pumping of pads
def build_music():
    buf = np.zeros((N, 2))
    pads = np.zeros((N, 2))
    nbars = int((DUR - OFFSET) / BAR) + 2
    for bar in range(nbars):
        t0 = OFFSET + bar * BAR
        if t0 >= DUR:
            break
        bass, notes = bar_chord(bar)
        sec = t0
        # ---- section flags
        intro = sec < 4.5
        problem = 4.5 <= sec < 16.0
        drop_gap = 15.55 <= sec + 0 < 16.5   # not used per bar (bar granular)
        lift = 16.5 <= sec < 30.5
        warm = 30.5 <= sec < 33.5
        tagline = 33.5 <= sec < 35.4
        outro = sec >= 35.4

        # pads (always under everything)
        pad_g = 0.26 if intro else 0.30 if problem else 0.30 if (lift or outro) else 0.34
        pad_b = 1100 if (intro or problem) else 2400
        if tagline:
            pad_b = 1500
        put(pads, pad_chord(notes, BAR + 0.3, bright=pad_b, swell=0.5 if not lift else 0.05), t0, pad_g)

        # arp (16th plucks)
        arp_on = (sec >= 2.5) and not tagline or outro
        if arp_on:
            order = [0, 1, 2, 3, 2, 1, 2, 3]
            cut = 1200 + 3500 * np.clip((sec - 2.5) / 13.5, 0, 1) if sec < 16.5 else 5200
            if warm:
                cut = 3200
            step = BEAT / 2 if not (intro or problem) else BEAT / 2
            g = (0.12 + 0.08 * np.clip((sec - 2.5) / 14, 0, 1)) if sec < 16.5 else (0.16 if not warm else 0.17)
            for k in range(8):
                tt = t0 + k * step
                note = notes[order[k % 8]] + (12 if (lift and k % 2) else 0)
                put(buf, pluck(note, 0.32, cut), tt, g * (1.0 if k % 2 == 0 else 0.75), pan=-0.35 if k % 2 == 0 else 0.35)

        # kick / hats / clap / bass
        has_kick = (sec >= 8.5 and sec < 15.5) or (lift) or tagline or (sec >= 35.4)
        soft = (8.5 <= sec < 15.5)
        if warm:
            has_kick = False
        for beat in range(4):
            tb = t0 + beat * BEAT
            if has_kick:
                put(buf, kick(0.55 if soft else 0.9), tb, 0.55)
                kicks_t.append(tb)
        if lift or outro:
            for beat in range(4):
                tb = t0 + beat * BEAT
                if beat in (1, 3):
                    put(buf, clap(0.5), tb, 0.35, pan=0.1)
                put(buf, hat(0.5, open_=True), tb + BEAT / 2, 0.30, pan=0.25)
                put(buf, hat(0.3), tb, 0.18, pan=-0.2)
                put(buf, hat(0.22), tb + BEAT / 4, 0.12, pan=0.2)
                put(buf, hat(0.22), tb + 3 * BEAT / 4, 0.12, pan=-0.1)
        elif 4.5 <= sec < 16.0 and sec >= 10.5:
            for beat in range(4):
                tb = t0 + beat * BEAT
                put(buf, hat(0.45), tb + BEAT / 2, 0.16, pan=0.2)
        if sec < 4.5 or (problem and sec < 8.5):
            # soft ticking pulse = curiosity / notebook clock
            for k in range(8):
                tb = t0 + k * BEAT / 2
                click = hp(rng.standard_normal(int(0.012 * SR)), 3500) * np.exp(-np.arange(int(0.012 * SR)) / SR * 400)
                put(buf, click, tb, 0.55 if k % 2 == 0 else 0.25, pan=0.3)
        # bass (8ths, pumped later)
        if (lift or tagline or outro) or (8.5 <= sec < 15.9):
            bg = 0.38 if (lift or tagline or outro) else 0.28
            for k in range(8):
                tb = t0 + k * BEAT / 2
                m = bass + (12 if k in (3, 7) and lift else 0)
                put(buf, bass_note(m, BEAT / 2 * 0.9), tb, bg)
        elif sec < 8.5:
            put(buf, bass_note(bass, BAR * 0.95), t0, 0.45)
        if warm:
            # warm rhodes-ish bell on the chord tones
            for k, m in enumerate(notes[:3]):
                put(buf, bell(m + 12, 1.6, 0.35), t0 + k * BEAT, 0.30, pan=(-0.4, 0, 0.4)[k])
    # pre-drop gap: duck everything 15.62..16.48 except riser (handled by sfx), then restore
    gap = (T >= 15.55) & (T < 16.48)
    g = np.ones(N)
    g[gap] = 0.0
    g = lp(g, 40, 1)   # smooth edges
    buf_g = buf * g[:, None]
    # sidechain pumping on pads
    pump = np.ones(N)
    for kt in kicks_t:
        i = int(kt * SR)
        L = int(0.28 * SR)
        j = min(N, i + L)
        pump[i:j] = np.minimum(pump[i:j], 1 - 0.55 * np.exp(-np.arange(j - i) / SR * 14))
    pads_p = pads * pump[:, None] * g[:, None]
    # lead hook in the lift (simple pentatonic call/response), bars from 16.5 to 30.5
    lead = np.zeros((N, 2))
    hook = [(0, 76), (1.0, 79), (1.5, 76), (2.5, 72), (3.0, 74)]  # beats in 4-beat cell (E5 G5 E5 C5 D5)
    t = 16.5
    bar = 0
    while t < 30.5 - 0.1:
        if bar % 2 == 0:
            for b, m in hook:
                put(lead, pluck(m, 0.45, 6000, sq=0.3), t + b * BEAT, 0.11, pan=0.15)
        t += BAR
        bar += 1
    # tail hits
    mus = buf_g + pads_p + lead
    # final resolved chord (C major add9) at 35.4 held then faded
    fin = np.zeros((N, 2))
    for m in (48, 55, 60, 64, 67, 72, 74):
        n = int((DUR - 35.4 + 0.5) * SR)
        x = (saw(mtof(m), n) + saw(mtof(m) * 1.003, n)) * 0.5
        x = lp(x, 3000) * adsr_env(n, 0.01, 1.2, 0.5, 0.3)
        put(fin, x, 35.4, 0.07, pan=(m % 7 - 3) / 4)
    put(fin, bell(84, 3.0, 1.0), 35.45, 0.12, pan=0.3)
    put(fin, bell(79, 3.0, 1.0), 35.6, 0.10, pan=-0.3)
    mus += fin
    mus = reverb(mus, 0.22)
    # global fade-out for the end
    fo = np.clip((DUR - T) / 1.8, 0, 1) ** 1.5
    # mild intro fade-in
    fi = np.clip(T / 0.35, 0, 1)
    mus *= (fo * fi)[:, None]
    # high-pass the sub rumble, gentle limiter
    for c in range(2):
        mus[:, c] = hp(mus[:, c], 30)
    return mus

music = build_music()

# ---------- sound design ----------
def whoosh(dur=0.6, up=True, f0=300, f1=6000, vel=1.0):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    t = np.linspace(0, 1, n)
    fc = f0 * (f1 / f0) ** (t if up else 1 - t)
    out = np.zeros(n)
    # time-varying bandpass: chunked
    ch = 512
    for i in range(0, n, ch):
        c = fc[min(i, n - 1)]
        sos = signal.butter(2, [max(80, c * 0.6), min(c * 1.5, SR / 2 - 200)], "band", fs=SR, output="sos")
        out[i:i + ch] = signal.sosfilt(sos, x[i:i + ch])  # chunk state reset acceptable for noise
    env = np.sin(np.pi * t) ** 1.5 if True else 1
    return out * env * vel

def riser(dur=2.0, vel=1.0):
    n = int(dur * SR)
    t = np.linspace(0, 1, n)
    x = rng.standard_normal(n)
    out = np.zeros(n)
    ch = 1024
    for i in range(0, n, ch):
        c = 300 * (9000 / 300) ** t[min(i, n - 1)]
        sos = signal.butter(2, [c * 0.5, min(c * 1.6, SR / 2 - 300)], "band", fs=SR, output="sos")
        out[i:i + ch] = signal.sosfilt(sos, x[i:i + ch])
    tone = np.sin(2 * np.pi * np.cumsum(200 * (8 ** t)) / SR) * 0.5
    return (out * 0.9 + tone * 0.4) * t ** 2.2 * vel

def impact(vel=1.0, dur=1.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sub = np.sin(2 * np.pi * np.cumsum(70 * np.exp(-t * 2.5) + 38) / SR) * np.exp(-t * 2.6)
    noise = lp(rng.standard_normal(n), 5000) * np.exp(-t * 6)
    return (sub * 1.1 + noise * 0.5) * vel

def sting(vel=1.0):
    """bright logo sting: rising arpeggio of bells ending on a C major add9 shimmer"""
    out = np.zeros((int(3.0 * SR), 2))
    for k, m in enumerate([72, 76, 79, 84]):
        put(out, bell(m, 2.6, 1.0), k * 0.07, 0.35 * vel, pan=(-0.3, 0.3, -0.15, 0.15)[k])
    put(out, bell(88, 2.6, 1.0), 0.32, 0.22 * vel, pan=0.0)
    return out

def click(vel=1.0, f=2400):
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) * np.exp(-t * 110) + 0.4 * hp(rng.standard_normal(n), 3000) * np.exp(-t * 200)) * vel

def pop(vel=1.0, f=620):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    fr = f * (1 + 1.2 * np.exp(-t * 40))
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 32) * vel

def chime(m=84, vel=1.0):
    return bell(m, 1.2, vel)

def paper(vel=1.0, dur=0.28):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = bp(rng.standard_normal(n), 2500, 9000) * np.exp(-t * 16)
    x *= (0.5 + 0.5 * np.sin(2 * np.pi * 38 * t) ** 2)
    return x * vel

def stab(m_list, vel=1.0, dur=0.7):
    n = int(dur * SR)
    out = np.zeros(n)
    for m in m_list:
        out += saw(mtof(m), n) + saw(mtof(m) * 1.006, n)
    out = lp(out / (len(m_list) * 2), 3500) * adsr_env(n, 0.004, 0.25, 0.25, 0.25)
    return out * vel

def keytype(vel=1.0):
    return click(vel * 0.5, f=float(rng.choice([1800, 2100, 2600])))

sfx = np.zeros((N, 2))
cuts = [3.0, 4.68, 6.45, 8.65, 10.27, 10.88, 11.98, 12.74, 14.52]
for t_ in cuts:
    put(sfx, whoosh(0.45, True, 400, 5000), t_ - 0.22, 0.20, pan=0.0)
# paper rustles / chat pings / key sounds for the problem montage
for t_ in (3.05, 3.4, 3.8, 4.15):
    put(sfx, paper(0.6), t_, 0.24, pan=-0.3)
put(sfx, impact(0.5, 0.9), 5.88, 0.35)                   # "missing" stamp
put(sfx, pop(1.0, 400), 7.0, 0.22); put(sfx, pop(1.0, 520), 7.35, 0.2)
for k, t_ in enumerate(np.arange(7.7, 8.5, 0.1)):         # people lighting up
    put(sfx, pop(0.7, 500 + 40 * k), t_, 0.12, pan=((k % 5) - 2) / 3)
for t_ in (10.3, 10.45, 10.6, 10.75):
    put(sfx, paper(0.9), t_, 0.26, pan=0.2)
for k, t_ in enumerate((10.9, 11.1, 11.3, 11.5)):
    put(sfx, pop(1.0, 700 + 90 * k), t_, 0.25, pan=-0.4 + 0.25 * k)
for t_ in np.arange(12.02, 12.6, 0.07):
    put(sfx, keytype(), t_, 0.35, pan=0.2)
put(sfx, pop(1.0, 330), 12.8, 0.28)
put(sfx, impact(0.6, 1.2), 14.55, 0.4)                    # exhausting thud
put(sfx, whoosh(0.8, False, 5000, 300), 14.9, 0.22)
put(sfx, riser(0.95, 1.0), 15.52, 0.42)                   # build into logo
# LOGO: impact + sting at 16.5
put(sfx, impact(1.0, 1.8), 16.5, 0.85)
put(sfx, sting(1.0), 16.5, 0.9)
put(sfx, whoosh(0.55, True, 500, 9000), 16.2, 0.25)
# product section transitions + micro interactions
for t_ in (17.46, 19.54, 21.52, 23.76, 25.63, 28.63, 30.77, 33.63):
    put(sfx, whoosh(0.5, True, 500, 7000), t_ - 0.25, 0.20)
    put(sfx, impact(0.35, 0.6), t_ + 0.0, 0.22)
# POS
for t_ in (19.9, 20.2, 20.5): put(sfx, pop(1.0, 520 + 110 * (t_ - 19.9) / 0.3), t_, 0.2)
put(sfx, click(1.0), 20.95, 0.35); put(sfx, chime(88, 0.8), 21.1, 0.18)
# booking
put(sfx, click(1.0), 21.9, 0.3); put(sfx, click(1.0), 22.25, 0.3); put(sfx, pop(1.0, 700), 22.6, 0.25)
put(sfx, chime(91, 1.0), 23.05, 0.22)
# gantt
for k, t_ in enumerate((23.95, 24.2, 24.45, 24.7, 24.95)):
    put(sfx, whoosh(0.22, True, 800, 3500), t_, 0.12, pan=-0.3 + 0.15 * k)
put(sfx, chime(86, 0.8), 25.2, 0.16)
# pdf
for t_ in (25.9, 26.25): put(sfx, click(1.0, 1800), t_, 0.3)
put(sfx, whoosh(0.35, True, 1500, 6000), 26.5, 0.16)
put(sfx, chime(93, 0.7), 27.7, 0.15)
put(sfx, pop(1.0, 460), 28.0, 0.2)
# differently / that's fine
put(sfx, pop(1.0, 520), 29.2, 0.2); put(sfx, pop(1.0, 650), 29.55, 0.2)
put(sfx, chime(84, 0.9), 30.1, 0.2)
# system building
for k, t_ in enumerate(np.arange(31.0, 31.9, 0.15)):
    put(sfx, keytype(), t_, 0.3, pan=-0.2)
for k, t_ in enumerate((32.15, 32.45, 32.75, 33.05)):
    put(sfx, pop(1.0, 500 + 70 * k), t_, 0.22, pan=-0.3 + 0.2 * k)
put(sfx, riser(0.6, 1.0), 33.0, 0.22)
# SIMPLE. SMART. SOLID.
for t_, ms in ((33.65, [60, 67, 72]), (34.24, [62, 69, 74]), (34.79, [64, 71, 76])):
    put(sfx, stab(ms, 1.0, 0.7), t_, 0.30)
    put(sfx, impact(0.7, 0.9), t_, 0.5)
# CTA
put(sfx, impact(1.0, 2.2), 35.4, 0.7)
put(sfx, sting(0.7), 35.4, 0.6)
put(sfx, whoosh(0.5, True, 800, 9000), 35.1, 0.2)
put(sfx, chime(96, 0.8), 36.62, 0.18)
put(sfx, click(1.0, 3000), 37.0, 0.25)
sfx = reverb(sfx, 0.12)

# ---------- ducking ----------
# VO RMS envelope -> duck gain (~ -14 dB while she is speaking, back up in pauses)
win = int(0.040 * SR)
rms = np.sqrt(np.convolve(vo ** 2, np.ones(win) / win, mode="same"))
thr = 0.12 * np.percentile(rms, 95)
gate = np.clip((rms - thr * 0.6) / (thr * 0.8), 0, 1)
# attack 25 ms (instant), release 380 ms
def smooth_ar(x, a, r):
    y = np.zeros_like(x)
    ca = np.exp(-1 / (a * SR)); cr = np.exp(-1 / (r * SR))
    s = 0.0
    for i, v in enumerate(x):
        c = ca if v > s else cr
        s = c * s + (1 - c) * v
        y[i] = s
    return y
# do smoothing at 1/8 rate for speed
g8 = gate[::8]
sr8 = SR / 8
ca = np.exp(-1 / (0.025 * sr8)); cr = np.exp(-1 / (0.38 * sr8))
y = np.zeros_like(g8); s = 0.0
for i, v in enumerate(g8):
    c = ca if v > s else cr
    s = c * s + (1 - c) * v
    y[i] = s
gate_full = np.interp(np.arange(N), np.arange(len(y)) * 8, y)
DUCK_DB = -14.0
duck_db = DUCK_DB * gate_full
duck_gain = 10 ** (duck_db / 20)

# music base level relative to VO: VO peak-normalized, music sits -9 dB under VO RMS before ducking
vo_rms_speech = np.sqrt(np.mean(vo[rms > thr] ** 2))
mus_rms = np.sqrt(np.mean(music ** 2))
MUSIC_BASE = vo_rms_speech * 10 ** (-7.0 / 20) / mus_rms
music_ducked = music * MUSIC_BASE * duck_gain[:, None]
# gentle "swell" in pauses (+2 dB) for life
pause_swell = 1 + 0.25 * (1 - gate_full)
music_ducked *= pause_swell[:, None]

SFX_BASE = vo_rms_speech * 10 ** (-4.0 / 20) / (np.sqrt(np.mean(sfx ** 2)) + 1e-9) * 0.55
sfx_m = sfx * SFX_BASE * (0.55 + 0.45 * (1 - 0.5 * gate_full))[:, None]

vo_st = np.stack([vo, vo], axis=1)
mix = vo_st + music_ducked + sfx_m

def wr(name, x):
    x = np.clip(x, -1.0, 1.0)
    wavfile.write(os.path.join(OUT, name), SR, (x * 32767).astype(np.int16))
wr("music.wav", music * MUSIC_BASE)
wr("sfx.wav", sfx_m)
wr("music_ducked.wav", music_ducked)
wr("vo_st.wav", vo_st)
# mix_raw may exceed 1.0 before mastering: write float32
wavfile.write(os.path.join(OUT, "mix_raw.wav"), SR, (mix * 0.7).astype(np.float32))
print("peak mix", np.abs(mix).max(), "music/vo db",
      20 * np.log10(np.sqrt(np.mean(music_ducked ** 2)) / vo_rms_speech))
json.dump({"duration": DUR, "bpm": BPM, "duck_db": DUCK_DB}, open(os.path.join(OUT, "meta.json"), "w"))
