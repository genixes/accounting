"""Upbeat, energetic, clear electronic corporate-pop soundtrack + subtle reactive UI tones.
Reference vibe: ~120 BPM four-on-the-floor, offbeat hats, pumping bass, tense build -> drop -> bright groove.
Original composition and sound design (no samples, no copying). Timed to the cue sheet in video2.html."""
import numpy as np, wave
from scipy.signal import butter, lfilter, fftconvolve, resample_poly

SR = 44100; DUR = 39.13; N = int(SR * (DUR + 1.5))
rng = np.random.default_rng(21)
B = (33.65 - 15.7) / 36                      # 120.3 BPM: exactly 36 beats from the logo lift to the final stinger
def tb(b): return 15.7 + b * B
def mf(n): return 440.0 * 2 ** ((np.asarray(n, dtype=float) - 69) / 12)

def _f(x, fc, kind, o=2):
    b, a = butter(o, np.clip(fc, 20, SR / 2 - 200) / (SR / 2), kind); return lfilter(b, a, x, axis=0)
def lp(x, fc, o=2): return _f(x, fc, 'low', o)
def hp(x, fc, o=2): return _f(x, fc, 'high', o)
def bp(x, f1, f2):
    b, a = butter(2, [f1 / (SR / 2), min(f2, SR / 2 - 200) / (SR / 2)], 'band'); return lfilter(b, a, x, axis=0)
def env_ad(n, a, d):
    t = np.arange(n) / SR; return np.minimum(t / max(a, 1e-4), 1) * np.exp(-t / d)

# ======================= stereo bus =======================
class Bus:
    def __init__(self): self.x = np.zeros((N, 2))
    def add(self, t, sig, g=1.0, pan=0.0):
        i = int(round(t * SR))
        if i < 0 or i >= N: return
        e = min(N, i + len(sig)); s = sig[:e - i]
        if s.ndim == 1:
            self.x[i:e, 0] += s * g * np.cos((pan + 1) * np.pi / 4) * 1.414; self.x[i:e, 1] += s * g * np.sin((pan + 1) * np.pi / 4) * 1.414
        else: self.x[i:e] += s * g

# ======================= synth voices =======================
def osc(f, n, shape='saw', ph=0.0):
    """band-limited-ish oscillator (generated at 2x then decimated)"""
    t = np.arange(n * 2) / (SR * 2); p = (f * t + ph) % 1
    if shape == 'saw': y = 2 * p - 1
    elif shape == 'sqr': y = np.where(p < .5, 1.0, -1.0)
    else: y = np.sin(2 * np.pi * p)
    return resample_poly(y, 1, 2)[:n]

def kick(vel=1.0, tone=52, punch=1.0):
    n = int(SR * .42); t = np.arange(n) / SR
    f = tone + 150 * np.exp(-t * 38) * punch
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    click = hp(rng.standard_normal(n), 1800) * np.exp(-t * 220) * .35
    return np.tanh((body * 1.6 + click)) * vel
def clap(vel=1.0):
    n = int(SR * .38); t = np.arange(n) / SR; x = np.zeros(n)
    for k, d in enumerate([0, .011, .022, .034]):
        i = int(d * SR); m = n - i; x[i:] += rng.standard_normal(m) * np.exp(-np.arange(m) / SR * (200 if k < 3 else 24))
    return bp(x, 900, 5200) * vel * .6
def hat(open_=False, vel=1.0):
    n = int(SR * (.30 if open_ else .07)); t = np.arange(n) / SR
    fr = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0]; x = sum(np.sign(np.sin(2 * np.pi * f * 2.9 * t)) for f in fr)
    x = hp(x + .3 * rng.standard_normal(n) * len(fr) / 3, 7500)
    return x * np.exp(-t / (.085 if open_ else .014)) * vel * .16
def shaker(vel=1.0):
    n = int(SR * .08); return bp(rng.standard_normal(n), 5500, 12000) * np.exp(-np.arange(n) / SR / .025) * vel * .5
def snare(vel=1.0):
    n = int(SR * .22); t = np.arange(n) / SR
    return (bp(rng.standard_normal(n), 1500, 8000) * np.exp(-t * 26) + .6 * np.sin(2 * np.pi * 185 * t) * np.exp(-t * 32)) * vel
def crash(dur=2.4, g=1.0):
    n = int(SR * dur); t = np.arange(n) / SR
    fr = [3141, 4217, 5309, 6127, 7411, 8803]; x = sum(np.sign(np.sin(2 * np.pi * f * t)) for f in fr) + 2 * rng.standard_normal(n)
    return hp(x, 4500) * np.exp(-t * 2.0) * np.minimum(t / .004, 1) * g * .09
def noise_riser(dur, f0, f1, g=1.0):
    n = int(SR * dur); x = rng.standard_normal(n); fc = np.exp(np.linspace(np.log(f0), np.log(f1), n))
    a = np.clip(2 * np.pi * fc / SR, 0, .9); y = np.zeros(n); l1 = l2 = 0.0
    for i in range(n):
        l1 += a[i] * (x[i] - l1); l2 += a[i] * (l1 - l2); y[i] = x[i] - l2 * 1.0   # high-pass sweeping up
    y = hp(y, 300); y /= np.abs(y).max() + 1e-9
    return y * (np.arange(n) / n) ** 2.2 * g
def pluck(f, dur=.35, bright=1.0, vel=1.0):
    n = int(SR * dur); t = np.arange(n) / SR
    s = .6 * osc(f, n, 'saw') + .4 * osc(f * 1.003, n, 'sqr')
    b = lp(s, min(9000, 3000 * bright + f * 3)) * np.exp(-t / .07)       # bright snap
    d = lp(s, min(3200, 900 + f * 2)) * np.exp(-t / (dur * .35))          # darker body
    return (b * .7 + d * .55) * np.minimum(t / .002, 1) * np.minimum((dur - t) / .03, 1).clip(0, 1) * vel
def pad(freqs, dur, fc=2600, a=.25, r=.5):
    n = int(SR * dur); t = np.arange(n) / SR; L = np.zeros(n); R = np.zeros(n)
    for f in freqs:
        for k, d in enumerate([-.13, -.06, 0, .07, .14]):
            v = osc(float(mf(f)) * 2 ** (d / 12), n, 'saw', ph=rng.random())
            pan = (k - 2) / 4
            L += v * (1 - max(pan, 0) * .7); R += v * (1 + min(pan, 0) * .7)
    sc = 1 / (len(freqs) * 3)
    e = np.minimum(t / a, 1) * np.minimum((dur - t) / r, 1).clip(0, 1)
    return np.stack([lp(L * sc, fc) * e, lp(R * sc, fc) * e], 1)
def bass_note(f, dur=.22, vel=1.0):
    n = int(SR * dur); t = np.arange(n) / SR
    sub = np.sin(2 * np.pi * np.cumsum(np.full(n, f)) / SR)
    s = (lp(osc(f, n, "saw"), 1100) * np.exp(-t * 14) + lp(osc(f, n, "saw"), 380) * (1 - np.exp(-t * 14))) * .55
    return np.tanh((sub * .9 + s) * 1.4) * np.minimum(t / .003, 1) * np.minimum((dur - t) / .02, 1).clip(0, 1) * vel * .8
def mallet(f, dur=.7, vel=1.0, bright=1.0):
    n = int(SR * dur); t = np.arange(n) / SR
    idx = bright * 2.4 * np.exp(-t * 9)
    x = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * 3.5 * t)) * np.exp(-t * 5.5)
    x += .25 * np.sin(2 * np.pi * f * 4.1 * t) * np.exp(-t * 18)
    return x * np.minimum(t / .001, 1) * vel * .6
def soft_bell(f, dur=1.0, vel=1.0):
    n = int(SR * dur); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) + .3 * np.sin(2 * np.pi * f * 2.01 * t) * np.exp(-t * 4)) * np.exp(-t * 3.2) * np.minimum(t / .003, 1) * vel * .5
def lowstrings(f, dur=1.0, vel=1.0):
    n = int(SR * dur); t = np.arange(n) / SR
    return lp(osc(f, n, 'saw') + osc(f * 1.004, n, 'saw'), 1200) * np.minimum(t / .25, 1) * np.minimum((dur - t) / .4, 1).clip(0, 1) * vel * .3

# ======================= buses =======================
drums, bass, pads, arps, lead, fxm, kickb = Bus(), Bus(), Bus(), Bus(), Bus(), Bus(), Bus()
sfx_tone, sfx_air = Bus(), Bus()
kick_times = []
def K(t, v=1.0, tone=52, punch=1.0): kickb.add(t, kick(v, tone, punch), 1.0); kick_times.append((t, v))

# ======================= HARMONY =======================
CH = {'C': dict(pad=[48, 52, 55], root=36, arp=[72, 76, 79, 84]), 'G': dict(pad=[43, 50, 55], root=31, arp=[71, 74, 79, 83]),
      'Am': dict(pad=[45, 52, 57], root=33, arp=[69, 72, 76, 81]), 'F': dict(pad=[41, 48, 57], root=29, arp=[69, 72, 77, 81]),
      'Dm': dict(pad=[38, 50, 57], root=26, arp=[69, 74, 77, 81]), 'E': dict(pad=[40, 52, 56], root=28, arp=[68, 71, 76, 80])}
def padchord(nm, t0, dur, g=.5, fc=2600, a=.25):
    c = CH[nm]; pads.add(t0, pad(c['pad'] + [c['pad'][0] + 12, c['pad'][2] + 12], dur, fc, a, .4), g)
def arp_run(nm, t0, step, count, g=.4, pattern=(0, 1, 2, 3, 2, 1, 2, 3), octave=0, bright=1.0, pan_w=.5):
    c = CH[nm]['arp']
    for i in range(count):
        n = c[pattern[i % len(pattern)]] + octave
        arps.add(t0 + i * step, pluck(float(mf(n)), .28, bright, 1.0), g * (1.0 if i % 4 == 0 else .72), pan_w * np.sin(i * 1.7))

# ======================= ARRANGEMENT =======================
# ---- 1. intro (0 - 4.7): light, friendly, leaves room for the chat tones
for i, nm in enumerate(['C', 'Am']):
    t0 = max(0, tb(-32 + i * 4)) if i else 0.0
    padchord(nm, t0, 4 * B + .3, .22, 1800, .5)
    arp_run(nm, t0 + .02, B / 2, 8, .16, (0, 1, 2, 1), 0, .6)
    for k in range(4): drums.add(t0 + k * B + B / 2, hat(False, .6), .8)
# ---- 2. the problem (4.7 - 15.55): tense minor, building
prob = ['Am', 'F', 'Dm', 'E', 'Am', 'E']
for i, nm in enumerate(prob):
    t0 = tb(-24 + i * 4)
    if t0 + 4 * B < 4.7: continue
    padchord(nm, t0, 4 * B + .2, .26 + .02 * i, 1500 + 250 * i, .5)
    root = CH[nm]['root']
    for k in range(8):
        tt = t0 + k * B / 2 + (0 if k % 2 == 0 else 0)
        if tt < 4.7: continue
        bass.add(tt, bass_note(float(mf(root + 12)) / 1.0, B * .42, .30 + .03 * i), 1.0)
    arp_run(nm, max(t0, 4.7), B / 2, 8, .15 + .02 * i, (0, 2, 1, 3, 2, 1, 3, 2), 0, .5)
    if i >= 2:                                   # soft kick pulse enters
        for k in range(4):
            if t0 + k * B >= 4.7: K(t0 + k * B, .55 + .08 * i, 48, .6)
    if i >= 3:
        for k in range(4):
            drums.add(t0 + k * B + B / 2, hat(True, .5 + .06 * i), 1.0); drums.add(t0 + k * B, hat(False, .35), 1.0)
for k in range(11): drums.add(4.7 + k * B, shaker(.5), .5)
fxm.add(12.4, noise_riser(3.15, 400, 9000, 1.0), .5)
t = 13.6; st = B / 2
while t < 15.5:
    drums.add(t, snare(float(np.interp(t, [13.6, 15.5], [.25, .95]))), 1.0); st = max(B / 8, st * .9); t += st
# ---- 3. THE DROP (15.7 - 33.65): bright, energetic four-on-the-floor groove
drums.add(15.7, crash(2.6, 1.0), 1.0)
bass.add(15.7, bass_note(float(mf(24)), 1.2, 1.0), .7)
prog = ['C', 'G', 'Am', 'F']
HOOK = [[(0, 84, 1), (1, 88, .5), (1.5, 84, .5), (2, 83, 1), (3, 79, 1)],
        [(0, 79, 1), (1, 83, .5), (1.5, 86, .5), (2, 88, 1), (3, 83, 1)],
        [(0, 81, 1), (1, 84, .5), (1.5, 88, .5), (2, 86, 1), (3, 84, 1)],
        [(0, 88, 1.5), (1.5, 86, .5), (2, 84, 1), (3, 83, .5), (3.5, 79, .5)]]
for bar in range(9):
    t0 = tb(bar * 4); nm = prog[bar % 4]; c = CH[nm]
    padchord(nm, t0, 4 * B + .15, .50, 3000, .02)
    for k in range(4):
        K(t0 + k * B, 1.0)
        drums.add(t0 + k * B + B / 2, hat(True, 1.0), 1.0)
        drums.add(t0 + k * B + B / 4, shaker(.7), .6); drums.add(t0 + k * B + 3 * B / 4, shaker(.9), .6)
        drums.add(t0 + k * B, hat(False, .5), 1.0)
    for b0 in (1, 3): drums.add(t0 + b0 * B, clap(1.0), 1.0)
    if t0 >= 28.5: drums.add(t0 + 1.5 * B, snare(.5), .6)
    for k in range(4):                           # offbeat pumping bass (octave jump on the last)
        n = c['root'] + (12 if k == 3 else 0)
        bass.add(t0 + k * B + B / 2, bass_note(float(mf(n + 12)) / 1.0, B * .42, 1.0), 1.0)
    bass.add(t0, bass_note(float(mf(c['root'] + 12)), B * .22, .9), .8)
    arp_run(nm, t0, B / 4, 16, .24 if t0 < 19.5 else .20, (0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 2, 1), 0, 1.0)
    if t0 >= 19.4:                                # catchy hook (pluck lead, dotted echo added later)
        for (b0, n, d) in HOOK[bar % 4]:
            lead.add(t0 + b0 * B, pluck(float(mf(n)), d * B * .95 + .08, 1.3, 1.0), .34, .15)
# build-up before the final stinger: kick drops out, riser + roll
fxm.add(30.4, noise_riser(3.2, 500, 10000, 1.0), .55)
t = 32.0; st = B / 2
while t < 33.55:
    drums.add(t, snare(float(np.interp(t, [32, 33.6], [.35, 1.0]))), 1.0); st = max(B / 8, st * .9); t += st
# ---- 4. stinger + finale
drums.add(33.65, crash(2.4, 1.0), 1.0); K(33.65, 1.0, 50, 1.2)
bass.add(33.65, bass_note(float(mf(24)), 1.4, 1.0), .8)
padchord('C', 33.65, 1.75, .55, 3200, .01)
for tt, n in [(33.65, 84), (34.24, 88), (34.79, 91)]:
    lead.add(tt, pluck(float(mf(n)), .6, 1.3, 1.0), .5, 0)
    lead.add(tt, mallet(float(mf(n + 12)), .9, .6), .4, .3)
drums.add(34.24, clap(1.0), 1.0); drums.add(34.79, clap(1.0), 1.0)
F0 = 35.38
drums.add(F0, crash(2.8, 1.0), 1.0); K(F0, 1.0, 50, 1.2)
bass.add(F0, bass_note(float(mf(24)), 1.4, 1.0), .8)
pads.add(F0, pad([48, 52, 55, 59, 60, 64, 67, 71], 3.8, 3600, .02, 1.2), .6)
for i, n in enumerate([72, 76, 79, 83, 88]): lead.add(F0 + .02 + i * .06, pluck(float(mf(n)), .9, 1.2, 1.0), .34, -.3 + .15 * i)
t0 = F0 + 1.9
for bar, nm in enumerate(['C', 'G']):
    tb0 = t0 + bar * 4 * B
    if tb0 > 38.4: break
    padchord(nm, tb0, 4 * B + .1, .40, 3000, .02)
    for k in range(4):
        K(tb0 + k * B, .85); drums.add(tb0 + k * B + B / 2, hat(True, .8), 1.0); drums.add(tb0 + k * B, hat(False, .4), 1.0)
        bass.add(tb0 + k * B + B / 2, bass_note(float(mf(CH[nm]['root'] + 12)), B * .42, .9), 1.0)
    for b0 in (1, 3): drums.add(tb0 + b0 * B, clap(.8), 1.0)
    arp_run(nm, tb0, B / 4, 16, .16, (0, 1, 2, 3, 2, 1, 2, 3), 0, 1.0)

# ======================= REACTIVE UI TONES (subtle, tonal, in key) =======================
PENTA = [72, 74, 76, 79, 81, 84, 86, 88]
def pent(i): return PENTA[i % len(PENTA)] + 12 * (i // len(PENTA))
def tone(t, key, kind='mallet', vel=.7, dur=.5, pan=0.0):
    f = float(mf(key))
    s = {'mallet': lambda: mallet(f, dur, vel), 'bell': lambda: soft_bell(f, dur + .5, vel),
         'pluck': lambda: pluck(f, dur, 1.0, vel) * .8, 'low': lambda: pluck(f, dur, .5, vel) * 1.1, 'str': lambda: lowstrings(f, dur, vel)}[kind]()
    sfx_tone.add(t, s, 1.0, pan)
def whoosh(t, dur=.5, f0=500, f1=4500, g=.5, pan=0.0, shape='up'):
    n = int(SR * dur); x = rng.standard_normal(n); fc = np.exp(np.linspace(np.log(f0), np.log(f1), n))
    a = np.clip(2 * np.pi * fc / SR, 0, .95); y = np.zeros(n); l1 = l2 = 0.0
    for i in range(n):
        l1 += a[i] * (x[i] - l1); l2 += a[i] * (l1 - l2); y[i] = l1 - l2
    y = hp(y, 600, 1); y /= np.abs(y).max() + 1e-9; p = np.arange(n) / n
    sfx_air.add(t, y * np.sin(np.pi * p) ** 1.5 * g, 1.0, pan)
def thud(t, g=.4, f=200):
    n = int(SR * .18); tt = np.arange(n) / SR; sfx_air.add(t, lp(rng.standard_normal(n), f * 3) * np.exp(-tt * 28) * g, 1.0)
def imsg_received(t, v=.95):                 # iMessage "Note"-style two quick mallet tones
    tone(t, 91, 'mallet', v, .5); tone(t + .13, 98, 'mallet', v * .9, .7)
def arp_up(t, v=.7, base=0, n=4, step=.065):
    for i in range(n): tone(t + i * step, pent(base + i + (1 if i > 1 else 0)), 'bell', v - i * .03, .6)
def pop_n(t, i, v=.55): tone(t, pent(i), 'mallet', v, .22)
def tick_n(t, i=5, v=.45): tone(t, pent(i) + 12, 'mallet', v, .1)

whoosh(0.06, .8, 300, 3000, .2)
imsg_received(0.99)
whoosh(2.50, .35, 800, 5000, .25, .3); tone(2.62, 95, 'bell', .35, .3)
whoosh(3.30, .6, 300, 2000, .12)
for i in range(12): tone(4.72 + i * .07, pent(3 + int(rng.integers(0, 6))) + 12, 'bell', .35, .5, rng.uniform(-.6, .6))
whoosh(4.70, 1.0, 5000, 300, .16)
tone(5.15, 57, 'mallet', .7, .5); tone(5.32, 52, 'mallet', .7, .6); tone(5.15, 45, 'low', .6, .5)
whoosh(6.50, .8, 200, 1800, .16); tick_n(8.7, 6, .4)
for tc, k in [(10.38, 45), (11.08, 43), (12.23, 40)]:
    whoosh(tc - .12, .26, 2500, 500, .18); tone(tc, k, 'low', .8, .4); thud(tc, .3)
tick_n(13.0, 4, .45)
for n in (45, 46, 52): tone(14.74, n, 'str', .5, 1.0)
arp_up(15.80, .7, 0, 5, .07); whoosh(16.50, .8, 400, 3500, .2); whoosh(16.90, .5, 1500, 8000, .15); arp_up(17.50, .55, 2, 2, .1)
for tt in (19.58, 21.54, 23.78, 25.65):
    whoosh(tt - .18, .5, 300, 4500, .25); tone(tt, 76, 'mallet', .55, .3)
whoosh(28.40, .5, 4000, 300, .2)
for i in range(6): pop_n(19.66 + i * .07, i + 1, .45)
for tt, i in [(20.48, 4), (20.83, 5), (21.03, 6)]: tone(tt, pent(i), 'bell', .65, .6); tick_n(tt, 5, .42)
pop_n(21.13, 3, .55); arp_up(21.48, .7, 1, 4, .06)
for i in range(7): tick_n(21.59 + i * .04, 3 + i % 4, .32)
for i in range(8): tick_n(21.74 + i * .04, 4 + i % 4, .28)
tone(22.34, 88, 'bell', .7, .7); whoosh(22.70, .4, 400, 3000, .18)
for i in range(5): tone(22.89 + i * .09, pent(i + 2), 'bell', .4, .5)
arp_up(23.20, .7, 2, 4, .06)
for i in range(3): pop_n(23.83 + i * .08, i + 2, .45)
for i in range(16): tick_n(24.0 + i * .08, 2 + i // 2, .32)
for i in range(5): whoosh(24.14 + .14 * i, .3, 500 + 150 * i, 3500, .1, -.5 + .25 * i)
arp_up(25.35, .65, 1, 4, .07)
for i in range(3): pop_n(25.75 + i * .1, i + 1, .45)
whoosh(26.05, .7, 1500, 6000, .14); tick_n(26.8, 6, .5); whoosh(26.90, 1.05, 3000, 6500, .08)
tone(28.0, 62, 'mallet', .65, .3); arp_up(28.0, .7, 2, 4, .06)
whoosh(28.65, .7, 300, 3000, .2)
for i in range(5): pop_n(29.2 + i * .1, i + 1, .5)
for n in (60, 64, 67, 72): tone(30.08, n, 'str', .35, 1.4)
tick_n(30.79, 5, .4); whoosh(32.0, .9, 300, 5500, .25)
for i in range(5): tick_n(32.45 + i * .08, 3 + i, .5)
tone(32.3, 84, 'bell', .65, .8)
for i in range(5): whoosh(32.8 + i * .08, .28, 800, 6000, .09, -.6 + .3 * i)
arp_up(33.1, .55, 1, 4, .09)
for tt in (33.65, 34.24, 34.79): whoosh(tt - .1, .2, 2000, 400, .14)
whoosh(35.1, .8, 300, 7000, .25); arp_up(35.55, .7, 0, 5, .09)
whoosh(35.75, .9, 400, 3500, .16); whoosh(36.15, .7, 1500, 8000, .13)
pop_n(36.6, 4, .6); whoosh(36.6, .5, 400, 5000, .16)
for i in range(7): tone(36.62 + i * .07, pent(i + 1) + 12, 'bell', .4, 1.0)
whoosh(37.1, .7, 1500, 8000, .12, .3)

# ======================= MIX =======================
def reverb_ir(sec, decay):
    n = int(SR * sec); t = np.arange(n) / SR
    irs = [lp(hp(rng.standard_normal(n), 250), 7000) * np.exp(-t * decay) for _ in range(2)]
    return [i / np.sqrt((i ** 2).sum()) * 4.0 for i in irs]
IRH, IRR = reverb_ir(2.0, 3.2), reverb_ir(.5, 11)
def conv(x, irs): return np.stack([fftconvolve(x[:, 0], irs[0])[:N], fftconvolve(x[:, 1], irs[1])[:N]], 1)
def pingpong(x, delay, fb=.4, taps=3):
    out = np.zeros_like(x); d = int(delay * SR)
    for k in range(1, taps + 1):
        s = np.roll(x, d * k, axis=0) * (fb ** k); s[:d * k] = 0
        s = s[:, ::-1] if k % 2 else s; out += s
    return out
# sidechain (pumping) from kicks
sc = np.ones(N)
for t, v in kick_times:
    i = int(t * SR); n = int(.32 * SR); tt = np.arange(min(n, N - i)) / SR
    sc[i:i + len(tt)] = np.minimum(sc[i:i + len(tt)], 1 - .72 * v * np.exp(-tt * 11))
sc = lfilter(*butter(2, 120 / (SR / 2)), sc)
scc = sc[:, None]
pads_x = pads.x * scc
bass_x = bass.x * (1 - .85 * (1 - scc))
arps_x = arps.x * (1 - .5 * (1 - scc))
lead_x = lead.x
dry = kickb.x * .38 + drums.x * 1.5 + bass_x * .32 + pads_x * 1.0 + arps_x * 1.4 + lead_x * 1.2 + fxm.x * 1.0
send_h = pads_x * .30 + arps_x * .35 + lead_x * .35 + drums.x * .04 + fxm.x * .3
send_d = arps_x * .22 + lead_x * .40
music = dry + conv(send_h, IRH) * .55 + pingpong(send_d, 3 * B / 4) * .7
# glue + clarity (carve the voice region a little, soft clip)
music = music - .22 * bp(music, 1200, 3500)
def comp(x, thr=.28, ratio=2.6):
    e = np.abs(x).max(1); e = lfilter(*butter(1, 25 / (SR / 2)), np.maximum.accumulate(e * 0 + e) if False else e)
    g = np.where(e > thr, (e / thr) ** (1 / ratio - 1), 1.0); g = lfilter(*butter(1, 40 / (SR / 2)), g)
    return x * g[:, None]
music = comp(music); music = np.tanh(music * 1.25) / 1.25
t_ = np.arange(N) / SR
fade = np.clip(t_ / .3, 0, 1) * np.clip((DUR + .15 - t_) / 1.3, 0, 1)
music *= fade[:, None]
for g0, g1 in [(15.575, 15.7), (33.525, 33.65)]:          # micro-gaps before the two big hits
    f = np.ones(N); f[int(g0 * SR):int(g1 * SR)] = 0; f = np.convolve(f, np.ones(250) / 250, 'same'); music *= f[:, None]
sfx = sfx_tone.x + conv(sfx_tone.x * .5, IRH) * .6 + hp(sfx_air.x, 500)
sfx *= fade[:, None]

def save(name, x, norm):
    n = int(DUR * SR); x = x[:n]; k = norm / (np.abs(x).max() + 1e-9)
    w = wave.open(name, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(x * k, -1, 1) * 32767).astype(np.int16).tobytes()); w.close(); return k
print('ok', save('assets/music5.wav', music, .85), save('assets/sfx5.wav', sfx, .85))
