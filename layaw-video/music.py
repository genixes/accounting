import numpy as np, wave
from scipy.signal import lfilter, butter
SR=44100; DUR=39.13; N=int(SR*DUR)+SR
BPM=104; beat=60/BPM
rng=np.random.default_rng(7)
L=np.zeros(N);R=np.zeros(N)
def add(buf,start,sig,g=1.0):
    i=int(start*SR);
    if i>=N:return
    e=min(N,i+len(sig));buf[i:e]+=sig[:e-i]*g
def mf(n):return 440*2**((n-69)/12)
def lp(x,fc,order=2):
    b,a=butter(order,fc/(SR/2));return lfilter(b,a,x)
def hp(x,fc):
    b,a=butter(2,fc/(SR/2),'high');return lfilter(b,a,x)
def env(n,a,d):
    t=np.arange(n)/SR;e=np.minimum(t/a,1)*np.exp(-t/d);return e
def pluck(f,dur=.5):
    n=int(SR*dur);t=np.arange(n)/SR
    s=np.sin(2*np.pi*f*t)+.4*np.sin(4*np.pi*f*t)*np.exp(-t*8)+.15*np.sin(6*np.pi*f*t)*np.exp(-t*14)
    return s*env(n,.004,.16)
def pad(freqs,dur):
    n=int(SR*dur);t=np.arange(n)/SR;s=np.zeros(n)
    for f in freqs:
        for d in(-.003,0,.003):
            ff=f*(1+d);s+=2*((ff*t)%1)-1  # saw
    s=lp(s,1400)/ (len(freqs)*3)
    e=np.minimum(t/.8,1)*np.minimum((dur-t)/.6,1);return s*e
def bass(f,dur=.45):
    n=int(SR*dur);t=np.arange(n)/SR
    return (np.sin(2*np.pi*f*t)+.3*np.sin(4*np.pi*f*t))*env(n,.01,.25)
def kick():
    n=int(SR*.35);t=np.arange(n)/SR;f=45+110*np.exp(-t*28)
    ph=2*np.pi*np.cumsum(f)/SR;return np.sin(ph)*np.exp(-t*9)
def hat(o=False):
    n=int(SR*(.22 if o else .06));x=hp(rng.standard_normal(n),7000);return x*np.exp(-np.arange(n)/SR/(.07 if o else .015))
def clap():
    n=int(SR*.25);x=lp(hp(rng.standard_normal(n),900),5000);t=np.arange(n)/SR
    return x*(np.exp(-t*22)+.6*np.exp(-((t-.012)**2)*8e4)*0+0)
chords=[(48,[60,64,67]),(43,[59,62,67]),(45,[60,64,69]),(41,[60,65,69])]  # C G Am F
arp_pat=[0,1,2,1,2,1,2,1]
bar=4*beat
bars=int(DUR/bar)+2
for b in range(bars):
    t0=b*bar;root,tri=chords[(b//2)%4]
    # pad
    p=pad([mf(n) for n in tri]+[mf(tri[0]-12)],bar+.5)*.5
    add(L,t0,p);add(R,t0,p*.95)
    sparse=t0<4.6
    full=t0>=19.0 and t0<33.4
    # arp 8ths (octave up in full)
    for k in range(8):
        n=tri[arp_pat[k]%3]+(12 if (k%4==0) else 12)
        s=pluck(mf(n+ (0 if not full else 0)),.6)*.30
        tt=t0+k*beat/2
        pan=.35+.3*np.sin(k+b);add(L,tt,s,1-pan);add(R,tt,s,pan)
        add(L,tt+beat*.75,s*.35,.3);add(R,tt+beat*.75,s*.35,.8)  # delay
    # bass
    if t0>=4.6:
        for k,(off,dur) in enumerate([(0,.9),(2.5,.45),(3,.45)]):
            s=bass(mf(root),.5)*.55;add(L,t0+off*beat,s);add(R,t0+off*beat,s)
    # drums
    if t0>=9.2 and (t0<33.4 or t0>=35.3):
        for k in range(4):
            tt=t0+k*beat;s=kick()*(.55 if full else .4);add(L,tt,s);add(R,tt,s)
            if t0>=9.2:
                for h in range(2):
                    th=tt+h*beat/2+(beat/2 if h else 0)*0
                    add(L,tt+beat/2,hat()*.12,.9);add(R,tt+beat/2,hat()*.12,.9)
            if full and k in(1,3):
                s=clap()*.28;add(L,tt,s);add(R,tt,s)
# riser into logo reveal (13.8 -> 15.7)
rn=int(SR*1.9);t=np.arange(rn)/SR;x=hp(rng.standard_normal(rn),1500)*(t/1.9)**2*.25
add(L,13.8,x);add(R,13.8,x)
def hit(t0,g=.5):
    n=int(SR*1.4);tt=np.arange(n)/SR
    s=np.sin(2*np.pi*55*tt)*np.exp(-tt*3)+.5*lp(rng.standard_normal(n),2500)*np.exp(-tt*5)
    add(L,t0,s*g);add(R,t0,s*g)
hit(15.7,.45);hit(33.65,.5);hit(35.38,.4)
# pop sfx at product card changes
for tp in (19.58,21.54,23.78,25.65):
    n=int(SR*.12);tt=np.arange(n)/SR;s=np.sin(2*np.pi*(500+900*tt*8)*tt)*np.exp(-tt*35)*.25
    add(L,tp,s);add(R,tp,s)
# master
fi=np.minimum(np.arange(N)/SR/1.2,1);fo=np.clip((DUR+.4-np.arange(N)/SR)/2.0,0,1)
L*=fi*fo;R*=fi*fo
m=max(abs(L).max(),abs(R).max());L/=m;R/=m
out=np.stack([L,R],1)[:int(SR*DUR)]*.9
w=wave.open('assets/music.wav','wb');w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR)
w.writeframes((out*32767).astype(np.int16).tobytes());w.close()
