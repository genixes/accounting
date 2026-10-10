"""Upbeat corporate-pop soundtrack + subtle reactive UI sounds for the Layaw System ad.
Instruments are real sampled sounds (GM soundfont rendered with TinySoundFont); the arrangement,
mix, reverb and sidechain are done here. Everything is timed to the visual cue sheet in video2.html."""
import numpy as np, wave
import tinysoundfont as T
from scipy.signal import butter, lfilter, fftconvolve

SR = 44100; DUR = 39.13; N = int(SR * (DUR + 1.5))
SF = 'assets/TimGM6mb.sf2'
rng = np.random.default_rng(12)
B = (33.65 - 15.7) / 37                    # 123.7 BPM: exactly 37 beats from the logo lift to the final stinger
def tb(b): return 15.7 + b * B             # beat index (relative to logo lift) -> seconds
def mf(n): return 440 * 2 ** ((n - 69) / 12)

def lp(x, fc, o=2): b, a = butter(o, min(fc, SR / 2 - 100) / (SR / 2)); return lfilter(b, a, x, axis=0)
def hp(x, fc, o=2): b, a = butter(o, fc / (SR / 2), 'high'); return lfilter(b, a, x, axis=0)
def bp(x, f1, f2): b, a = butter(2, [f1 / (SR / 2), min(f2, SR / 2 - 100) / (SR / 2)], 'band'); return lfilter(b, a, x, axis=0)

# ---------------- sampled instruments ----------------
class Stem:
    def __init__(self, bank, prog, chan=0, human=.006):
        self.s = T.Synth(gain=0, samplerate=SR); sf = self.s.sfload(SF)
        self.s.program_select(chan, sf, bank, prog); self.ch = chan; self.ev = []; self.human = human
    def note(self, t, dur, key, vel=90, jitter=True):
        j = rng.uniform(-self.human, self.human) if jitter else 0
        v = int(np.clip(vel + rng.integers(-5, 6), 1, 127))
        self.ev.append((max(0, t + j), 1, int(key), v)); self.ev.append((max(0, t + j) + dur, 0, int(key), 0))
    def render(self):
        ev = sorted(self.ev, key=lambda e: (e[0], e[1])); out = np.zeros((N, 2), dtype=np.float32)
        BL = 128; i = 0
        for pos in range(0, N, BL):
            end = (pos + BL) / SR
            while i < len(ev) and ev[i][0] < end:
                _, on, key, vel = ev[i]
                (self.s.noteon(self.ch, key, vel) if on else self.s.noteoff(self.ch, key)); i += 1
            blk = np.frombuffer(self.s.generate(BL), dtype=np.float32).reshape(-1, 2)
            out[pos:pos + len(blk)] = blk[:N - pos]
        return out.astype(np.float64)

PIANO, EPIANO, GLOCK, MARIMBA, CELESTA = (0, 0), (0, 4), (0, 9), (0, 12), (0, 8)
GTR, MGTR, BASS, STRINGS, PIZZ, CELLO = (0, 27), (0, 28), (0, 33), (0, 48), (0, 45), (0, 42)
stems = {k: Stem(*p) for k, p in dict(piano=PIANO, epiano=EPIANO, glock=GLOCK, marimba=MARIMBA, celesta=CELESTA, gtr=GTR,
                                       bass=BASS, strings=STRINGS, pizz=PIZZ, cello=CELLO).items()}
stems['drums'] = Stem(128, 0, chan=9, human=.004)
for nm in ('sfx_marimba', 'sfx_glock', 'sfx_celesta', 'sfx_pizz', 'sfx_strings', 'sfx_cello'):
    base = nm[4:]; p = dict(marimba=MARIMBA, glock=GLOCK, celesta=CELESTA, pizz=PIZZ, strings=STRINGS, cello=CELLO)[base]
    stems[nm] = Stem(*p, human=0)
D = stems['drums']
KICK, SIDE, SNARE, CLAP, CHAT, OHAT, TAMB, CRASH, TOMLO = 36, 37, 38, 39, 42, 46, 54, 49, 45

# ---------------- harmony ----------------
CH = {'C': ([60, 64, 67], 36, [72, 76, 79]), 'G': ([59, 62, 67], 31, [71, 74, 79]), 'Am': ([57, 60, 64], 33, [69, 72, 76]),
      'F': ([57, 60, 65], 29, [69, 72, 77]), 'Dm': ([57, 62, 65], 38, [69, 74, 77]), 'E': ([56, 59, 64], 40, [68, 71, 76])}
def strum(stem, t, name, dur, vel=70, spread=.012, up=False):
    notes = CH[name][0] if not up else CH[name][2]
    for i, n in enumerate(notes): stem.note(t + i * spread, dur, n, vel - i * 2, jitter=False)

# ---------------- ARRANGEMENT ----------------
# 1) intro 0 - 4.7 : light, friendly e-piano (leaves room for the iMessage tones)
for i, nm in enumerate(['C', 'Am']):
    t0 = tb(-32 + i * 4)
    for k in range(8):
        n = CH[nm][2][[0, 1, 2, 1][k % 4]]
        stems['epiano'].note(t0 + k * B / 2, B * .9, n, 54 + (k % 2) * 6)
    stems['strings'].note(t0, 4 * B, CH[nm][0][0] - 12, 44); stems['strings'].note(t0, 4 * B, CH[nm][0][1] - 12, 40)
    D.note(t0, .1, CHAT, 40); D.note(t0 + 2 * B, .1, CHAT, 40)
# 2) the problem 4.06 - 15.55 : thoughtful minor, steady pulse, building tension
prob = ['Am', 'F', 'Dm', 'E', 'Am', 'E']
for i, nm in enumerate(prob):
    t0 = tb(-24 + i * 4); vel = 52 + i * 5
    for k in range(8):
        n = CH[nm][0][[0, 1, 2, 1, 0, 1, 2, 1][k]] + (0 if k % 2 == 0 else 12)
        stems['piano'].note(t0 + k * B / 2, B * .8, n, vel + (6 if k % 2 == 0 else 0))
    for n in CH[nm][0]: stems['strings'].note(t0, 4 * B + .1, n - 12, 48 + i * 4)
    stems['bass'].note(t0, 3.6 * B, CH[nm][1] + 12, 62)
    if i >= 2:
        D.note(t0, .1, KICK, 62); D.note(t0 + 2 * B, .1, KICK, 56)
    if i >= 3:
        for k in range(8): D.note(t0 + k * B / 2, .05, CHAT, 38 + (k % 2) * 10)
        D.note(t0 + B, .1, SIDE, 58); D.note(t0 + 3 * B, .1, SIDE, 58)
# snare-roll build 13.3 -> 15.55
t = 13.3; st = B / 2
while t < 15.5:
    D.note(t, .05, SNARE, int(np.interp(t, [13.3, 15.5], [34, 112])), jitter=False)
    st = max(B / 8, st * .93); t += st
# 3) the lift 15.7 -> 33.65 : upbeat energetic groove
D.note(15.7, 1.5, CRASH, 100, jitter=False)
for nm in ('piano', 'strings', 'bass'):
    pass
prog = ['C', 'G', 'Am', 'F']
HOOK = [  # (beat in 4-beat bar, note, dur) over C | G | Am | F
    [(0, 76, 1), (1, 79, .5), (1.5, 76, .5), (2, 74, 1), (3, 72, 1)],
    [(0, 71, 1), (1, 74, .5), (1.5, 79, .5), (2, 79, 1), (3, 74, 1)],
    [(0, 72, 1), (1, 76, .5), (1.5, 81, .5), (2, 79, 1), (3, 76, 1)],
    [(0, 81, 1.5), (1.5, 79, .5), (2, 77, 1), (3, 76, .5), (3.5, 72, .5)]]
for bar in range(10):
    t0 = tb(bar * 4); nm = prog[bar % 4]; tri, root, hi = CH[nm]
    last = bar == 9
    nb = 1 if last else 4
    if t0 >= 33.6: continue
    # drums
    for b0 in ([0, 1.5, 2, 3.5] if not last else [0]):
        D.note(t0 + b0 * B, .1, KICK, 100 if b0 in (0, 2) else 80)
    if not last:
        for b0 in (1, 3):
            D.note(t0 + b0 * B, .1, SNARE, 92); D.note(t0 + b0 * B, .1, CLAP, 70)
        for k in range(8): D.note(t0 + k * B / 2, .05, CHAT, 62 if k % 2 == 0 else 48)
        D.note(t0 + 3.5 * B, .2, OHAT, 62)
        if t0 >= tb(0) + 3.9:
            for k in range(8): D.note(t0 + k * B / 2 + B / 4, .05, TAMB, 40)
    # bass: driving
    if not last:
        for b0, d, o in [(0, .9, 0), (1.5, .4, 0), (2, .9, 0), (3, .4, 7), (3.5, .45, 12)]:
            stems['bass'].note(t0 + b0 * B, d * B, root + o + (12 if o != 12 else 12) - (0 if o == 12 else 0), 90 if b0 in (0, 2) else 75)
    # piano chord stabs (pop comping)
    for b0, d in ([(0, .9), (1.5, .45), (2.5, .45), (3.5, .45)] if not last else [(0, .8)]):
        for i, n in enumerate(tri): stems['piano'].note(t0 + b0 * B + i * .004, d * B, n, 72 if b0 == 0 else 60)
    # clean guitar off-beat chops
    if t0 >= tb(4):
        for b0 in (.5, 1.5, 2.5, 3.5):
            if not last: strum(stems['gtr'], t0 + b0 * B, nm, .25 * B, 66 if b0 != 2.5 else 58, spread=.01)
    # strings sustain
    if t0 >= tb(4) or bar >= 1:
        for n in tri: stems['strings'].note(t0, 4 * B, n, 58)
    # hook (marimba + glock) from product section on
    if t0 >= 19.5 - 1.5 and not last:
        for (b0, n, d) in HOOK[bar % 4]:
            stems['marimba'].note(t0 + b0 * B, d * B * .9, n, 70)
            stems['glock'].note(t0 + b0 * B, d * B * .9, n + 12, 52)
    elif not last and bar >= 1:
        for k in range(4): stems['celesta'].note(t0 + k * B, B * .8, hi[k % 3] + 12, 48)
# drop the kick for tension 31.7 -> 33.6 then roll
t = 32.0; st = B / 2
while t < 33.6:
    D.note(t, .05, SNARE, int(np.interp(t, [32.0, 33.6], [48, 118])), jitter=False)
    st = max(B / 8, st * .9); t += st
# 4) stinger + finale
D.note(33.65, 1.6, CRASH, 112, jitter=False)
for n in (48, 55, 60, 64, 72): stems['piano'].note(33.65, 1.7, n, 100, jitter=False)
for n in (60, 64, 67): stems['strings'].note(33.65, 1.7, n, 78, jitter=False)
stems['bass'].note(33.65, 1.6, 36, 100, jitter=False)
for tt, n in [(33.65, 72), (34.24, 76), (34.79, 79)]:
    stems['glock'].note(tt, .6, n + 12, 100, jitter=False); stems['piano'].note(tt, .5, n, 92, jitter=False)
D.note(34.24, .1, CLAP, 85, jitter=False); D.note(34.79, .1, CLAP, 90, jitter=False)
F0 = 35.38
D.note(F0, 2.0, CRASH, 105, jitter=False)
for n in (36, 48, 60, 64, 67, 71, 76): stems['piano'].note(F0, 2.6, n, 98, jitter=False)
for n in (60, 64, 67, 72): stems['strings'].note(F0, 3.7, n, 82, jitter=False)
strum(stems['gtr'], F0, 'C', 1.2, 84, .018)
stems['bass'].note(F0, 1.8, 36, 100, jitter=False)
for bar in range(2):
    t0 = F0 + 1.85 + bar * 4 * B * 0 + bar * 4 * B
    nm = ['G', 'Am'][bar] if False else ['C', 'G'][bar]
    for b0 in (0, 2): D.note(t0 + b0 * B, .1, KICK, 85)
    for b0 in (1, 3): D.note(t0 + b0 * B, .1, CLAP, 65)
    for k in range(8): D.note(t0 + k * B / 2, .05, CHAT, 52 if k % 2 == 0 else 40)
    for k in range(8):
        n = CH[nm][2][[0, 1, 2, 1][k % 4]]
        stems['piano'].note(t0 + k * B / 2, B * .7, n, 66); stems['glock'].note(t0 + k * B / 2, B * .5, n + 12, 42)
    stems['bass'].note(t0, 3.6 * B, CH[nm][1] + 12, 80)

# ---------------- REACTIVE UI SOUNDS (subtle, musical, in C major) ----------------
PENTA = [72, 74, 76, 79, 81, 84, 86, 88]
def pent(i): return PENTA[i % len(PENTA)] + 12 * (i // len(PENTA))
def sfx_note(stem, t, key, vel=70, dur=.5): stems[stem].note(t, dur, key, vel, jitter=False)
def imsg_received(t, vel=96):          # iMessage "Note"-style: two quick mallet tones
    sfx_note('sfx_glock', t, 91, vel, .5); sfx_note('sfx_glock', t + .13, 98, vel - 6, .7)
    sfx_note('sfx_celesta', t, 91, vel - 20, .5); sfx_note('sfx_celesta', t + .13, 98, vel - 26, .7)
def arp_up(t, vel=80, base=0, n=4, step=.065, stem='sfx_glock'):
    for i in range(n): sfx_note(stem, t + i * step, pent(base + i * 1 + (1 if i > 1 else 0)), vel - i * 2, .8)
def pop_n(t, i, vel=66, stem='sfx_marimba'): sfx_note(stem, t, pent(i), vel, .22)
def tick_n(t, i=5, vel=52): sfx_note('sfx_marimba', t, pent(i) + 12, vel, .1)

# air sweeps / paper textures (very quiet, high-passed so they never mask the voice)
def sweep(dur, f0, f1, shape='up'):
    n = int(SR * dur); x = rng.standard_normal(n); fc = np.exp(np.linspace(np.log(f0), np.log(f1), n))
    a = np.clip(2 * np.pi * fc / SR, 0, .95); y = np.zeros(n); l1 = 0.0; l2 = 0.0
    for i in range(n):
        l1 += a[i] * (x[i] - l1); l2 += a[i] * (l1 - l2); y[i] = l1 - l2
    y = hp(y, 600, 1); y /= (np.abs(y).max() + 1e-9); p = np.arange(n) / n
    return y * (np.sin(np.pi * p) ** 1.5 if shape == 'up' else p ** 2.2)
air = np.zeros((N, 2)); airs = []
def whoosh(t, dur=.5, f0=500, f1=4500, g=.5, pan=0, shape='up'):
    s = sweep(dur, f0, f1, shape) * g; i = int(t * SR); e = min(N, i + len(s))
    air[i:e, 0] += s[:e - i] * (1 - max(pan, 0)); air[i:e, 1] += s[:e - i] * (1 + min(pan, 0))
def thud(t, g=.5, f=200):
    n = int(SR * .18); tt = np.arange(n) / SR; s = lp(rng.standard_normal(n), f * 3) * np.exp(-tt * 28) * g
    i = int(t * SR); air[i:i + n, 0] += s; air[i:i + n, 1] += s

# --- intro chat ---
whoosh(0.06, .8, 300, 3000, .25)
imsg_received(0.99)
whoosh(2.50, .35, 800, 5000, .28, .3)                       # "sent" swoosh
sfx_note('sfx_glock', 2.62, 95, 40, .3)
whoosh(3.30, .6, 300, 2000, .15)
for i in range(12): sfx_note('sfx_celesta', 4.72 + i * .07, pent(3 + int(rng.integers(0, 6))) + 12, 48, .8)   # notebook dissolves
whoosh(4.70, 1.0, 5000, 300, .20)
sfx_note('sfx_marimba', 5.15, 57, 80, .5); sfx_note('sfx_marimba', 5.32, 52, 80, .6); sfx_note('sfx_pizz', 5.15, 45, 70, .6)   # "not found"
whoosh(6.50, .8, 200, 1800, .2)
tick_n(8.7, 6, 50)
# --- pain cards drop in ---
for tc, k in [(10.38, 45), (11.08, 43), (12.23, 40)]:
    whoosh(tc - .12, .26, 2500, 500, .22); sfx_note('sfx_pizz', tc, k, 90, .5); thud(tc, .35)
tick_n(13.0, 4, 56)
for n in (45, 46, 52): sfx_note('sfx_strings', 14.74, n, 46, 1.0)    # tense swell on "Exhausting."
# --- brand reveal ---
arp_up(15.80, 84, 0, 5, .07)
whoosh(16.50, .8, 400, 3500, .25); whoosh(16.90, .5, 1500, 8000, .18)
arp_up(17.50, 66, 2, 2, .1)
# --- products ---
for tt in (19.58, 21.54, 23.78, 25.65):
    whoosh(tt - .18, .5, 300, 4500, .3); sfx_note('sfx_marimba', tt, 76, 68, .3)
whoosh(28.40, .5, 4000, 300, .25)
for i in range(6): pop_n(19.66 + i * .07, i + 1, 54)                          # POS tiles
for tt, i in [(20.48, 4), (20.83, 5), (21.03, 6)]: sfx_note('sfx_glock', tt, pent(i), 80, .7); tick_n(tt, 5, 54)
pop_n(21.13, 3, 66); arp_up(21.48, 86, 1, 4, .06)
for i in range(7): tick_n(21.59 + i * .04, 3 + i % 4, 40)                      # Booking
for i in range(8): tick_n(21.74 + i * .04, 4 + i % 4, 36)
sfx_note('sfx_glock', 22.34, 88, 84, .7); whoosh(22.70, .4, 400, 3000, .22)
for i in range(5): sfx_note('sfx_celesta', 22.89 + i * .09, pent(i + 2), 52, .6)
arp_up(23.20, 88, 2, 4, .06)
for i in range(3): pop_n(23.83 + i * .08, i + 2, 56)                           # Project Manager
for i in range(16): tick_n(24.0 + i * .08, 2 + i // 2, 40)
for i in range(5): whoosh(24.14 + .14 * i, .3, 500 + 150 * i, 3500, .12, -.5 + .25 * i)
arp_up(25.35, 84, 1, 4, .07)
for i in range(3): pop_n(25.75 + i * .1, i + 1, 56)                            # PDF Pro
whoosh(26.05, .7, 1500, 6000, .16); tick_n(26.8, 6, 60)
whoosh(26.90, 1.05, 3000, 6500, .10)
sfx_note('sfx_marimba', 28.0, 62, 80, .3); arp_up(28.0, 88, 2, 4, .06)
# --- system story ---
whoosh(28.65, .7, 300, 3000, .25)
for i in range(5): pop_n(29.2 + i * .1, i + 1, 62)
for n in (60, 64, 67, 72): sfx_note('sfx_strings', 30.08, n, 40, 1.4)          # warm "That's fine."
tick_n(30.79, 5, 50)
whoosh(32.0, .9, 300, 5500, .3)
for i in range(5): tick_n(32.45 + i * .08, 3 + i, 60)
sfx_note('sfx_glock', 32.3, 84, 80, .8)
for i in range(5): whoosh(32.8 + i * .08, .28, 800, 6000, .11, -.6 + .3 * i)
arp_up(33.1, 70, 1, 4, .09)
# --- finale ---
for tt in (33.65, 34.24, 34.79): whoosh(tt - .1, .2, 2000, 400, .18)
whoosh(35.1, .8, 300, 7000, .3); arp_up(35.55, 84, 0, 5, .09)
whoosh(35.75, .9, 400, 3500, .2); whoosh(36.15, .7, 1500, 8000, .16)
pop_n(36.6, 4, 70); whoosh(36.6, .5, 400, 5000, .2)
for i in range(7): sfx_note('sfx_celesta', 36.62 + i * .07, pent(i + 1) + 12, 52, 1.0)
whoosh(37.1, .7, 1500, 8000, .14, .3)

# ---------------- RENDER + MIX ----------------
rendered = {k: v.render() for k, v in stems.items()}
def ir(sec):
    n = int(SR * sec); t = np.arange(n) / SR
    return [lp(hp(rng.standard_normal(n), 250), 6500) * np.exp(-t * (6.0 / sec)) for _ in range(2)]
IRH, IRR = ir(2.2), ir(.7)
def pan_(x, p): return x * np.array([np.cos((p + 1) * np.pi / 4), np.sin((p + 1) * np.pi / 4)]) * 1.414
def bus(names, g, pan=0, rv=0.0, lo=None, hi=None, sc=None):
    x = sum(rendered[n] for n in names)
    if lo: x = hp(x, lo)
    if hi: x = lp(x, hi)
    x = pan_(x, pan) * g
    if sc is not None: x = x * sc[:, None]
    return x, rv
# sidechain envelope from the kick (breathing pads/strings)
sc = np.ones(N)
for ev in D.ev:
    if ev[1] == 1 and ev[2] == KICK:
        i = int(ev[0] * SR); n = int(.28 * SR); tt = np.arange(min(n, N - i)) / SR
        sc[i:i + len(tt)] = np.minimum(sc[i:i + len(tt)], 1 - .45 * np.exp(-tt * 14))
sc = np.convolve(sc, np.ones(64) / 64, 'same')
mix_dry = np.zeros((N, 2)); wet_h = np.zeros((N, 2)); wet_r = np.zeros((N, 2))
def put(x, rv_h=0, rv_r=0):
    global mix_dry, wet_h, wet_r
    mix_dry += x; wet_h += x * rv_h; wet_r += x * rv_r
put(rendered['drums'] * 1.0, 0, .10)
put(pan_(hp(rendered['bass'], 40), 0) * 1.1, 0, 0)
put(pan_(hp(rendered['piano'], 120), -.15) * .9, .22, 0)
put(pan_(hp(rendered['epiano'], 120), .1) * .9, .25, 0)
put(pan_(hp(rendered['gtr'], 180), .35) * .7, .2, 0)
put(pan_(hp(lp(rendered['strings'], 7000), 150), 0) * .55 * sc[:, None], .35, 0)
put(pan_(rendered['marimba'], -.25) * .6, .25, 0)
put(pan_(rendered['glock'], .3) * .45, .35, 0)
put(pan_(rendered['celesta'], .2) * .45, .35, 0)
rv = fftconvolve(wet_h, np.stack([IRH[0], IRH[1]], 1)[:, :1], axes=0)[:N] if False else None
def conv2(x, irs): return np.stack([fftconvolve(x[:, 0], irs[0])[:N], fftconvolve(x[:, 1], irs[1])[:N]], 1)
music = mix_dry + conv2(wet_h, IRH) * .14 + conv2(wet_r, IRR) * .10
# glue: gentle tanh saturation + master fade
music = np.tanh(music * 1.15) / 1.15
t_ = np.arange(N) / SR
fade = np.clip(t_ / .4, 0, 1) * np.clip((DUR + .2 - t_) / 1.2, 0, 1)
music = music * fade[:, None]
# hard-mute the tiny gaps right before the two big hits
for g0, g1 in [(15.58, 15.7), (33.52, 33.65)]:
    f = np.ones(N); f[int(g0 * SR):int(g1 * SR)] = 0; f = np.convolve(f, np.ones(300) / 300, 'same'); music *= f[:, None]
# ---- sfx bus
sfx = np.zeros((N, 2)); sfx_wet = np.zeros((N, 2))
for k in ('sfx_marimba', 'sfx_glock', 'sfx_celesta', 'sfx_pizz', 'sfx_strings', 'sfx_cello'):
    x = hp(rendered[k], 200); sfx += x; sfx_wet += x * (.35 if k != 'sfx_pizz' else .15)
sfx += air * 1.0
sfx = sfx + conv2(sfx_wet, IRH) * .16
sfx *= fade[:, None]
def save(name, x, norm):
    n = int(DUR * SR); x = x[:n]; k = norm / (np.abs(x).max() + 1e-9)
    w = wave.open(name, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(x * k, -1, 1) * 32767).astype(np.int16).tobytes()); w.close(); return k
km = save('assets/music4.wav', music, .85)
# sfx saved with a fixed gain (not peak-normalised) so relative levels between events stay as designed
ks = save('assets/sfx4.wav', sfx, .85)
print('ok', km, ks)
