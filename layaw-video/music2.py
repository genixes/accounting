"""Procedural music bed + reactive sound design for the Layaw System ad.
Everything is timed to the visual cue sheet in video2.html (seconds)."""
import numpy as np, wave
from scipy.signal import butter, lfilter, fftconvolve

SR = 44100
DUR = 39.13
N = int(SR * (DUR + 1.5))
rng = np.random.default_rng(3)
BEAT = (33.65 - 15.7) / 31          # 103.6 BPM, 31 beats from logo drop to final stinger
def bt(k): return 15.7 + k * BEAT   # beat grid anchored on the logo drop

def mf(n): return 440 * 2 ** ((n - 69) / 12)
def lp(x, fc, o=2): b, a = butter(o, min(fc, SR / 2 - 100) / (SR / 2)); return lfilter(b, a, x)
def hp(x, fc, o=2): b, a = butter(o, fc / (SR / 2), 'high'); return lfilter(b, a, x)
def bp(x, f1, f2): b, a = butter(2, [f1 / (SR / 2), min(f2, SR / 2 - 100) / (SR / 2)], 'band'); return lfilter(b, a, x)

class Bus:
    def __init__(self): self.L = np.zeros(N); self.R = np.zeros(N)
    def add(self, t0, sig, g=1.0, pan=0.0, send=None, sg=0.0):
        i = int(t0 * SR)
        if i < 0 or i >= N: return
        e = min(N, i + len(sig)); s = sig[:e - i]
        gl = g * np.cos((pan + 1) * np.pi / 4); gr = g * np.sin((pan + 1) * np.pi / 4)
        self.L[i:e] += s * gl * 1.414; self.R[i:e] += s * gr * 1.414
        sb = self.sendbus
        if send is not None and sg > 0:
            sb.L[i:e] += s * sg; sb.R[i:e] += s * sg

mus, sfx, rev, revS = Bus(), Bus(), Bus(), Bus()
mus.sendbus, sfx.sendbus = rev, revS

def env(n, a, d, hold=0):
    t = np.arange(n) / SR
    return np.minimum(t / max(a, 1e-4), 1) * np.exp(-np.maximum(t - hold, 0) / d)

# ---------- instruments ----------
def sine(f, dur, a=.005, d=.3, h=0):
    n = int(SR * dur); t = np.arange(n) / SR; return np.sin(2 * np.pi * f * t) * env(n, a, d, h)
def bell(f, dur=1.6, bright=1.0):
    n = int(SR * dur); t = np.arange(n) / SR
    m = bright * 2.2 * np.exp(-t * 4)
    return (np.sin(2 * np.pi * f * t + m * np.sin(2 * np.pi * f * 3.5 * t)) * .7 + .3 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t * 6)) * env(n, .002, .45)
def pluck(f, dur=.7):
    n = int(SR * dur); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + .5 * np.sin(4 * np.pi * f * t) * np.exp(-t * 9) + .2 * np.sin(6 * np.pi * f * t) * np.exp(-t * 16)
    return s * env(n, .003, .17)
def padsyn(freqs, dur, fc=1800, a=.8, r=.8):
    n = int(SR * dur); t = np.arange(n) / SR; s = np.zeros(n)
    for f in freqs:
        for d in (-.004, 0, .004):
            ph = (f * (1 + d) * t) % 1; s += 2 * ph - 1
    s = lp(s, fc) / (len(freqs) * 3)
    return s * np.minimum(t / a, 1) * np.minimum((dur - t) / r, 1).clip(0, 1)
def bass(f, dur=.4):
    n = int(SR * dur); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) + .35 * np.sin(4 * np.pi * f * t) * np.exp(-t * 8) + .1 * ((f * t) % 1 * 2 - 1)) * env(n, .006, .22)
def kick(g=1.0):
    n = int(SR * .4); t = np.arange(n) / SR; f = 46 + 130 * np.exp(-t * 30)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8) + .25 * np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 90)) * g
def hat(open_=False):
    n = int(SR * (.28 if open_ else .07)); x = hp(rng.standard_normal(n), 7500)
    return x * np.exp(-np.arange(n) / SR / (.09 if open_ else .018))
def clap():
    n = int(SR * .3); x = bp(rng.standard_normal(n), 900, 4500); t = np.arange(n) / SR
    e = np.exp(-t * 18) + .7 * np.exp(-((t % .012)) * 40) * (t < .03)
    return x * e
def snare(g=1):
    n = int(SR * .25); t = np.arange(n) / SR
    return (bp(rng.standard_normal(n), 1500, 7000) * np.exp(-t * 20) + .5 * np.sin(2 * np.pi * 190 * t) * np.exp(-t * 28)) * g
def boom(dur=2.2):
    n = int(SR * dur); t = np.arange(n) / SR; f = 34 + 70 * np.exp(-t * 6)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6) + .5 * lp(rng.standard_normal(n), 900) * np.exp(-t * 4)) * .9
def sweep(dur, f0, f1, gain=1.0, shape='up', q=1.0):
    """filtered-noise whoosh whose centre frequency glides from f0 to f1"""
    n = int(SR * dur); t = np.arange(n) / SR; x = rng.standard_normal(n)
    fc = np.exp(np.linspace(np.log(f0), np.log(f1), n))
    a = np.clip(2 * np.pi * fc / SR, 0, .95); y = np.zeros(n); lo = 0.0; lo2 = 0.0
    for i in range(n):
        lo += a[i] * (x[i] - lo); lo2 += a[i] * (lo - lo2); y[i] = lo - lo2
    y = hp(y, 80); y /= (np.abs(y).max() + 1e-9)
    p = t / dur
    e = np.sin(np.pi * np.clip(p, 0, 1)) ** (1.4 if shape == 'up' else 1.4)
    if shape == 'rise': e = p ** 2.2 * (1 - np.clip((p - .96) / .04, 0, 1))
    return y * e * gain
def ad(*xs):
    n = max(len(x) for x in xs); o = np.zeros(n)
    for x in xs: o[:len(x)] += x
    return o
def tick(f=2200, g=1.0):
    n = int(SR * .05); t = np.arange(n) / SR; x = np.sin(2 * np.pi * f * t) * np.exp(-t * 140) + .4 * hp(rng.standard_normal(n), 3000) * np.exp(-t * 200)
    return x * g
def pop(f=520, g=1.0):
    n = int(SR * .18); t = np.arange(n) / SR; fr = f * (1 + .9 * np.exp(-t * 55))
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 22) * g
def chime(notes, t0, bus=sfx, g=.5, gap=.07, send=True):
    for i, n in enumerate(notes):
        bus.add(t0 + i * gap, bell(mf(n), 1.8, .9), g, 0, rev, .7 if send else 0)
def shimmer(dur=2.4, base=88):
    n = int(SR * dur); t = np.arange(n) / SR; s = np.zeros(n)
    for k, off in enumerate([0, 4, 7, 12, 16, 19, 24]):
        f = mf(base + off); s += np.sin(2 * np.pi * f * t + k) * np.exp(-t * 1.5) * (.6 / (1 + k * .4)) * np.minimum(t / .05, 1)
    return s
def scratch(dur, g=1.0):
    n = int(SR * dur); t = np.arange(n) / SR
    x = bp(rng.standard_normal(n), 2500, 7000) * (.5 + .5 * np.sin(2 * np.pi * 14 * t) ** 2) * np.minimum(t / .03, 1) * np.minimum((dur - t) / .06, 1).clip(0, 1)
    return x * g

# ---------- music bed ----------
A = {'Am': (45, [57, 60, 64, 69]), 'F': (41, [53, 57, 60, 65]), 'Dm': (38, [50, 57, 62, 65]), 'E': (40, [52, 56, 59, 64]),
     'C': (36, [48, 55, 60, 64]), 'G': (43, [50, 55, 59, 62]), 'F2': (41, [53, 57, 60, 65])}
def play_pad(name, t0, dur, g=.5, fc=1600):
    r, ch = A[name]
    p = padsyn([mf(n) for n in ch] + [mf(r + 12)], dur, fc, a=.9, r=.9)
    mus.add(t0, p, g, 0, rev, .35)

# A) opening 0 - 4.7: dark pad + slow heartbeat
play_pad('Am', 0.0, 5.2, .55, 1200)
for k in range(0, 8):
    t = .06 + k * BEAT * 2
    if t < 4.6: mus.add(t, sine(46, .5, .01, .18) * 1.0, .55 + .05 * k)
for t, n in [(.5, 81), (2.1, 76), (3.3, 72)]:
    mus.add(t, bell(mf(n), 2.2, .6), .22, .3, rev, .8)

# B) tension 4.7 - 15.55
for i, (nm, t0) in enumerate([('Am', 4.7), ('F', 8.17), ('Dm', 11.65), ('E', 15.12)]):
    play_pad(nm, t0, 3.9, .6, 1100 + i * 300)
mus.add(4.7, sine(mf(33), 11.0, 1.5, 100, 9) * .5, .55)
k = 0; t = 4.7
while t < 15.5:
    prog = (t - 4.7) / 10.8
    mus.add(t, tick(1500 + 700 * prog, .5 + .6 * prog), .55 + .25 * prog, -.2 if k % 2 else .2)       # clock tick
    if t > 6.5: mus.add(t + BEAT / 2, sine(mf(33 if t < 11.6 else 35), .28, .004, .09) * 1.0, .4 + .2 * prog)   # 8th sub pulse
    t += BEAT; k += 1
mus.add(13.4, sweep(2.15, 300, 7000, 1.0, 'rise'), .7, 0, rev, .3)
mus.add(14.74, padsyn([mf(45), mf(46), mf(52), mf(58), mf(63)], 1.0, 900, .02, .3), .9, 0, rev, .3)  # dissonant cluster on "Exhausting."
mus.add(14.74, boom(1.0), .55)

# C) the drop 15.7 -> 33.55
mus.add(15.7, boom(2.6), 1.0, 0, rev, .25)
mus.add(15.7, shimmer(3.0, 84), .5, 0, rev, .9)
mus.add(15.7, sweep(1.6, 9000, 500, 1.0, 'up'), .5, 0, rev, .3)         # crash tail
prog = ['C', 'G', 'Am', 'F']
for ch_i in range(4):
    t0 = bt(ch_i * 8)
    if t0 >= 33.5: break
    play_pad(prog[ch_i % 4], t0, min(8 * BEAT + .6, 33.55 - t0), .55, 2400)
for k in range(0, 31):
    t = bt(k)
    if t >= 33.5: break
    chord = prog[(k // 8) % 4]; root, notes = A[chord]
    mus.add(t, kick(1.0) * 1.0, .9)
    mus.add(t + BEAT / 2, hat(True), .12, .3, rev, .1)
    if k % 2 == 1: mus.add(t, clap(), .38, 0, rev, .4)
    # sidechain-feel bass in 8ths
    mus.add(t, bass(mf(root + 12), BEAT * .45), .62)
    mus.add(t + BEAT / 2, bass(mf(root + (24 if k % 4 == 3 else 12)), BEAT * .4), .45)
    if t >= 17.5:
        for j, off in enumerate([0, .5]):
            n = notes[(k * 2 + j) % 4] + 12
            mus.add(t + off * BEAT, pluck(mf(n), .6), .30, -.3 + .6 * ((k + j) % 2), rev, .55)
    if t >= 19.58:
        for j in range(4):
            mus.add(t + j * BEAT / 4, hat(False), .05 + .03 * (j % 2 == 0), .3 * (1 if j % 2 else -1))
    if t >= 23.78 and k % 4 == 0:
        mus.add(t, bell(mf(notes[3] + 24), 2.0, .9), .22, .4, rev, .9)
# build 28.65 -> 33.55
mus.add(30.6, sweep(2.95, 400, 9500, 1.0, 'rise'), .65, 0, rev, .3)
t = 31.75; step = BEAT / 2
while t < 33.5:
    mus.add(t, snare(.8 + (t - 31.75) * .4), .45, 0, rev, .25)
    step = max(BEAT / 8, step * .86); t += step

# D) outro 33.65 -> 39.13
mus.add(33.65, boom(2.4), 1.0, 0, rev, .3)
mus.add(33.65, kick(1.1), .9)
for tt, root, notes in [(33.65, 36, [48, 55, 60, 64]), (35.38, 36, [48, 55, 60, 64, 71])]:
    p = padsyn([mf(n) for n in notes] + [mf(root + 12)], 5.6 if tt > 35 else 1.9, 2600, .02 if tt < 34 else .35, .8)
    mus.add(tt, p, .65 if tt > 35 else .5, 0, rev, .5)
for tt, n in [(33.65, 60), (34.24, 64), (34.79, 67)]:
    mus.add(tt, bell(mf(n + 12), 2.2, 1.0), .5, 0, rev, 1.0)
    mus.add(tt, kick(.9), .75)
mus.add(35.38, boom(2.0), .75, 0, rev, .3)
mus.add(35.38, shimmer(3.5, 91), .45, 0, rev, 1.0)
mus.add(35.38, sweep(1.4, 8000, 700, 1.0, 'up'), .35, 0, rev, .3)
k = 0; t = 35.38
while t < 38.6:
    n = [72, 76, 79, 83, 79, 76][k % 6]
    mus.add(t, pluck(mf(n), .8), .24, -.4 + .8 * (k % 2), rev, .6)
    if k % 2 == 0: mus.add(t, kick(.6), .45)
    mus.add(t, bass(mf(36), BEAT * .9), .4)
    t += BEAT / 2; k += 1

# ---------- reactive sound design (matches on-screen events) ----------
S = lambda t, sig, g=.5, pan=0.0, sg=.3: sfx.add(t, sig, g, pan, rev, sg)
# opening title + chat
S(0.06, sweep(.9, 200, 3000, 1.0, 'up'), .45)
S(0.99, pop(660, 1), .6, -.4); S(1.0, tick(1800, .5), .3, -.4)
S(2.5, pop(820, 1), .6, .4); S(2.52, tick(2400, .5), .3, .4)
for i in range(36):                                   # keyboard ticks while the reply types
    t = 3.0 + (i + .5) * (1.55 / 36); S(t, tick(1900 + 600 * ((i * 7) % 5), .8), .22, .2 * np.sin(i), 0)
S(3.3, sweep(.7, 300, 1800, 1.0, 'up'), .35)
S(3.6, bell(mf(76), 1.6, .6), .18, 0, .7)
for i in range(10): S(4.2 + i * .05, sine(70, .12, .003, .05) * 1.0, .35, 0, 0)   # notebook trembling
S(4.7, sweep(1.2, 6000, 300, 1.0, 'up'), .6)           # dissolve
for i in range(14): S(4.72 + i * .06 + rng.random() * .03, bell(mf(84 + int(rng.integers(0, 12))), .9, .5), .12, rng.uniform(-.8, .8), .9)
S(5.15, sine(mf(45), .7, .004, .25) * 1.0 + sine(mf(46), .7, .004, .25) * 1.0, .55, 0, .3)    # error bonk
S(5.15, tick(900, 1), .5)
S(6.5, boom(1.3), .35, 0, .3)
S(6.5, sweep(.9, 150, 1800, 1.0, 'up'), .3)
S(8.7, tick(1400, 1), .25)
# pain cards slam
for tc, pan in [(10.38, -.2), (11.08, .2), (12.23, -.1)]:
    S(tc - .12, sweep(.28, 2500, 300, 1.0, 'up'), .35, pan)
    _n = int(SR * .5); _th = lp(rng.standard_normal(_n), 1500) * np.exp(-np.arange(_n) / SR * 22)
    S(tc, sine(62, .5, .003, .14) * 1.0 + .5 * _th, .7, pan, .25)
S(13.0, bell(mf(57), 1.2, .5), .22, 0, .6)
S(14.74, boom(1.3), .5, 0, .35)
S(14.2, sweep(.55, 400, 6000, 1.0, 'rise'), .45)
# logo drop 15.0 -> 16.5
S(15.0, sweep(.7, 500, 9500, 1.0, 'rise'), .5)
for i in range(10): S(15.1 + i * .06, bell(mf(84 + i * 2), .7, .5), .09 * (i + 1) / 10, rng.uniform(-.7, .7), .9)
S(15.7, boom(2.4), .85, 0, .45)
S(15.7, sweep(1.7, 10000, 500, 1.0, 'up'), .55, 0, .4)
chime([72, 76, 79, 84, 88], 15.8, sfx, .3, .08)
S(16.5, sweep(.9, 400, 3500, 1.0, 'up'), .35); S(16.9, sweep(.55, 1500, 9000, 1.0, 'up'), .25)
chime([79, 84], 17.5, sfx, .3, .1)
# product transitions + UI reactions
for tt in (19.58, 21.54, 23.78, 25.65):
    S(tt - .2, sweep(.55, 300, 5000, 1.0, 'up'), .5, 0, .3); S(tt, pop(440, 1), .5, 0, .3)
S(28.4, sweep(.55, 4000, 300, 1.0, 'up'), .4, 0, .3)
# POS (19.58)
for i in range(6): S(19.66 + i * .07, pop(520 + 70 * i, 1), .28, -.4 + .16 * i, .2)
for tt, n in [(20.48, 76), (20.83, 79), (21.03, 83)]:
    S(tt, tick(1500, 1.2), .5); S(tt, bell(mf(n), 1.0, .6), .2, 0, .5); S(tt + .08, pop(900, 1), .22)
S(21.13, pop(700, 1), .35); S(21.13, sweep(.3, 800, 3000, 1.0, 'up'), .22)
chime([79, 83, 86, 91], 21.48, sfx, .34, .06)
# Booking (21.54)
for i in range(7): S(21.59 + i * .04 * 1.0, tick(1700 + 140 * i, 1), .18, -.6 + .2 * i, 0)
for i in range(8): S(21.74 + i * .04, tick(2300 + 120 * i, 1), .15, -.5 + .14 * i, 0)
S(22.34, tick(1300, 1.4), .5); S(22.34, bell(mf(79), 1.4, .7), .26, 0, .7); S(22.34, sweep(.3, 600, 4000, 1.0, 'up'), .2)
S(22.7, sweep(.5, 300, 3000, 1.0, 'up'), .38, 0, .3)
S(22.89, scratch(.4, .25), .5, 0, 0)
chime([79, 83, 86, 91, 95], 23.2, sfx, .32, .06)
# Project manager (23.78)
for i in range(3): S(23.83 + i * .08, pop(480 + 90 * i, 1), .26, -.4 + .4 * i, .25)
for i in range(18): S(24.0 + i * .075, tick(1400 + i * 55, 1), .10 + .005 * i, 0, 0)
for i in range(5): S(24.0 + .14 * i + .14, sweep(.3, 500 + 150 * i, 3500, 1.0, 'up'), .22, -.5 + .25 * i, .2)
S(24.0, sweep(1.3, 400, 4500, 1.0, 'up'), .22, .3, .3)
chime([72, 79, 84, 88], 25.35, sfx, .3, .07)
# PDF Pro (25.65)
for i in range(3): S(25.75 + i * .1, pop(500 + 110 * i, 1), .26, -.5 + .3 * i, .2)
S(26.05, sweep(.7, 1500, 6000, 1.0, 'up'), .3, 0, .1)          # highlighter swipe
S(26.8, tick(1500, 1.2), .4)
S(26.9, scratch(1.05, .5), .45, 0, 0)                           # signature pen
S(28.0, ad(sine(95, .35, .003, .1), tick(1000, 1)), .6, 0, .2)
chime([79, 83, 86, 91], 28.0, sfx, .34, .06)
# custom-system story
S(28.65, sweep(.7, 300, 3500, 1.0, 'up'), .35)
for i in range(5): S(29.2 + i * .1, pop(500 + 90 * i, 1), .3, -.6 + .3 * i, .3)
S(30.08, padsyn([mf(60), mf(64), mf(67), mf(72)], 1.6, 2000, .1, .8), .35, 0, .6)
S(30.79, tick(1500, 1), .25)
S(32.0, sweep(.9, 300, 6000, 1.0, 'up'), .5, 0, .3)
for i in range(5): S(32.45 + i * .08, tick(1200 + 250 * i, 1.4), .35, -.6 + .3 * i, .3)
S(32.3, pop(330, 1), .5); S(32.4, bell(mf(76), 1.8, .8), .28, 0, .8)
for i in range(5): S(32.8 + i * .08, sweep(.3, 800, 7000, 1.0, 'up'), .22, -.6 + .3 * i, .3)
chime([76, 79, 83, 88], 33.1, sfx, .28, .09)
# final stingers
for tt, n in [(33.65, 60), (34.24, 64), (34.79, 67)]:
    S(tt, sine(mf(n - 12), .5, .003, .2) * 1.0, .45, 0, .2); S(tt - .1, sweep(.2, 2000, 300, 1.0, 'up'), .3)
S(35.38 - .3, sweep(.8, 300, 9000, 1.0, 'rise'), .4)
S(35.38, boom(1.8), .55, 0, .4)
chime([79, 84, 88, 91, 96], 35.5, sfx, .3, .09)
S(35.75, sweep(.9, 400, 3500, 1.0, 'up'), .25); S(36.15, sweep(.7, 1500, 8000, 1.0, 'up'), .22)
S(36.6, pop(520, 1), .5); S(36.6, sweep(.5, 400, 6000, 1.0, 'up'), .35)
for i in range(7): S(36.62 + i * .07, bell(mf(84 + [0, 4, 7, 12, 16, 19, 24][i]), 1.2, .5), .13, -.7 + .23 * i, .9)
S(37.1, sweep(.7, 1500, 9000, 1.0, 'up'), .22, .3, .2)

# ---------- reverb + render ----------
def make_ir(sec=2.6):
    n = int(SR * sec); t = np.arange(n) / SR
    ir = [lp(hp(rng.standard_normal(n), 220), 7000) * np.exp(-t * 2.6) for _ in range(2)]
    ir[0][:int(.02 * SR)] *= np.linspace(0, 1, int(.02 * SR)); ir[1][:int(.02 * SR)] *= np.linspace(0, 1, int(.02 * SR))
    return ir
ir = make_ir()
rvL = fftconvolve(rev.L, ir[0])[:N] * .05; rvR = fftconvolve(rev.R, ir[1])[:N] * .05
rsL = fftconvolve(revS.L, ir[0])[:N] * .05; rsR = fftconvolve(revS.R, ir[1])[:N] * .05

def finish(bus, name, wl, wr):
    L = bus.L + wl; R = bus.R + wr
    n = int(DUR * SR)
    L, R = L[:n], R[:n]
    t = np.arange(n) / SR
    fi = np.clip(t / .6, 0, 1); fo = np.clip((DUR - t) / 1.5, 0, 1)
    L *= fi * fo; R *= fi * fo
    return L, R

# mute music right before the two drops for impact (tiny gap)
for g0, g1 in [(15.55, 15.7), (33.5, 33.65)]:
    i0, i1 = int(g0 * SR), int(g1 * SR)
    # soften the gap with a short fade so it doesn't click
    f = np.ones(N); f[i0:i1] = 0; f = lp(f, 400, 1)
    mus.L *= f; mus.R *= f
mL, mR = finish(mus, 'music', rvL, rvR)
_t = np.arange(len(mL)) / SR
_g = np.interp(_t, [0, 4.4, 5.0, 14.5, 15.6, 15.7, 33.5, 39.2], [1.08, 1.08, 2.3, 2.3, 1.0, 1.0, 1.0, 1.0])
mL = mL * _g; mR = mR * _g
sL, sR = finish(sfx, 'sfx', rsL, rsR)
def wavout(name, L, R, norm):
    m = max(np.abs(L).max(), np.abs(R).max()); k = norm / m
    out = np.stack([L * k, R * k], 1)
    w = wave.open(name, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((out * 32767).astype(np.int16).tobytes()); w.close()
wavout('assets/music2.wav', mL, mR, .85)
wavout('assets/sfx2.wav', sL, sR, .85)
print('ok')
