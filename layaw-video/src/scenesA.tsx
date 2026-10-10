import React from 'react';
import {AbsoluteFill} from 'remotion';
import {
  C, HF, Hex, IF, Icon, NavyBg, PF, easeInOut, easeOut, hexPts, kf, pop, prog, useLayout, useT,
} from './kit';
import {TM, easeIn, rnd} from './theme';

// =========================================================================================
// shared helpers
// =========================================================================================
const KWord: React.FC<{t0: number; size: number; color?: string; style?: React.CSSProperties; children: React.ReactNode}> = ({t0, size, color = '#fff', style, children}) => {
  const t = useT();
  const a = pop(t, t0, 200, 15);
  return (
    <span
      style={{
        display: 'inline-block',
        fontFamily: PF,
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1.04,
        letterSpacing: -2,
        color,
        opacity: Math.min(1, a * 3),
        transform: `translateY(${(1 - a) * 60}px) scale(${0.85 + 0.15 * a})`,
        marginRight: size * 0.22,
        ...style,
      }}
    >
      {children}
    </span>
  );
};

const artY = (V: boolean, H: number) => (V ? 760 : H / 2 - 20);

// =========================================================================================
// 1. HOOK  (0.0 - 3.0)  "Quick question. Is the court booked for Saturday?"
// =========================================================================================
const CourtLines: React.FC<{w: number; progress: number; color?: string}> = ({w, progress, color = '#fff'}) => {
  const h = w * 0.5;
  const len = 4000;
  const dash = {strokeDasharray: len, strokeDashoffset: len * (1 - progress)};
  return (
    <svg width={w} height={h} viewBox="0 0 600 300" fill="none" stroke={color} strokeWidth={4} strokeLinejoin="round">
      <rect x="6" y="6" width="588" height="288" {...dash} />
      <path d="M300 6V294" {...dash} />
      <path d="M6 150H594" {...dash} strokeWidth={3} />
      <path d="M170 6V294M430 6V294" {...dash} strokeWidth={3} />
      <path d="M170 150H6M430 150H594" {...dash} strokeWidth={3} />
    </svg>
  );
};

export const HookScene: React.FC = () => {
  const t = useT();
  const {W, H, V} = useLayout();
  const cy = artY(V, H);
  const qExit = prog(t, 0.86, 0.24, easeIn);
  const qSize = V ? 150 : 176;
  const sat = pop(t, TM.saturday, 170, 13);
  const courtW = V ? H * 0.92 : W * 0.9;
  const courtP = prog(t, 0.9, 1.4, easeInOut);
  const shake = t > 2.95 ? Math.sin(t * 90) * 6 : 0;
  return (
    <AbsoluteFill>
      <NavyBg glow="c" />
      {/* court line drawing: rotated in vertical so it fills the frame */}
      <div style={{position: 'absolute', left: W / 2 - courtW / 2, top: cy - courtW * 0.25, opacity: 0.2 + 0.1 * Math.sin(t * 5), transform: V ? `rotate(90deg) scale(${0.62})` : 'none'}}>
        <CourtLines w={courtW} progress={courtP} color={C.cyan} />
      </div>
      {/* "Quick question." */}
      <div style={{position: 'absolute', left: 0, right: 0, top: cy - qSize * 1.1, textAlign: 'center', opacity: 1 - qExit, transform: `translateY(${-qExit * 200}px) scale(${1 - qExit * 0.5})`}}>
        <KWord t0={0.06} size={qSize}>Quick</KWord>
        <KWord t0={0.3} size={qSize} color={C.cyan} style={{marginRight: 0}}>question.</KWord>
      </div>
      {/* the question */}
      <div style={{position: 'absolute', left: 0, right: 0, top: cy - (V ? 330 : 230), textAlign: 'center', padding: V ? '0 50px' : '0 200px', transform: `translateX(${shake}px)`}}>
        <div>
          <KWord t0={0.99} size={V ? 120 : 132}>Is the</KWord>
          <KWord t0={TM.court} size={V ? 120 : 132} color={C.cyan} style={{marginRight: 0}}>court</KWord>
        </div>
        <div>
          <KWord t0={1.68} size={V ? 120 : 132}>booked</KWord>
          <KWord t0={2.06} size={V ? 120 : 132} style={{marginRight: 0}}>for</KWord>
        </div>
        <div style={{position: 'relative', display: 'inline-block'}}>
          <KWord t0={TM.saturday} size={V ? 150 : 168} color="#fff" style={{marginRight: 0}}>Saturday?</KWord>
          <div style={{position: 'absolute', left: 0, bottom: -4, height: 12, width: `${prog(t, TM.saturday + 0.1, 0.5) * 100}%`, background: `linear-gradient(90deg, ${C.cyan}, ${C.teal})`, borderRadius: 6}} />
        </div>
      </div>
      {/* calendar tile flip */}
      <div style={{position: 'absolute', right: V ? 80 : 150, top: V ? 300 : 120, width: 150, height: 170, borderRadius: 22, background: '#fff', boxShadow: '0 20px 50px rgba(0,0,0,0.4)', overflow: 'hidden', transform: `scale(${sat}) rotate(${(1 - sat) * 20 + 6}deg)`, fontFamily: PF}}>
        <div style={{background: C.teal, color: '#fff', textAlign: 'center', fontWeight: 700, fontSize: 30, padding: '10px 0'}}>SAT</div>
        <div style={{textAlign: 'center', fontWeight: 700, fontSize: 84, color: C.navy2, lineHeight: 1.1}}>?</div>
      </div>
    </AbsoluteFill>
  );
};

// =========================================================================================
// 2. NOTEBOOK (3.0 - 4.7) and 3. MISSING (4.7 - 6.45)
// =========================================================================================
const Desk: React.FC = () => {
  const {W, H} = useLayout();
  return (
    <AbsoluteFill style={{background: 'linear-gradient(160deg,#16456f 0%,#0B2A4A 100%)'}}>
      <svg width={W} height={H} style={{position: 'absolute', inset: 0, opacity: 0.1}}>
        {Array.from({length: 30}, (_, i) => (
          <path key={i} d={`M0 ${i * 70 + 20} Q ${W / 2} ${i * 70 + (i % 2 ? 50 : -10)} ${W} ${i * 70 + 20}`} stroke="#fff" strokeWidth={2} fill="none" />
        ))}
      </svg>
    </AbsoluteFill>
  );
};

const scribbles: string[][] = [
  ['BOOKINGS', 'Sat 4pm - Court 2 (Ben)', 'Sat 5pm - Court 1 ???', 'Sun 9am - Ate Joy', 'Tonyo - cancel?'],
  ['Sat 4pm - Court 2', 'Sat 4pm - Court 2 (Mica)', 'double booked?!', 'Fri - rentals?', 'call back Sir Dan'],
  ['Saturday??', 'down payment - na ba?', 'Court 3 -> maintenance', 'Sun 7am ??', 'ask Ate Joy'],
];

const Notebook: React.FC<{flipAt: number[]; stamp?: boolean}> = ({flipAt, stamp}) => {
  const t = useT();
  const w = 760;
  const h = 560;
  const Page: React.FC<{i: number}> = ({i}) => (
    <div style={{position: 'absolute', inset: 0, background: C.paper, borderRadius: '8px 18px 18px 8px', boxShadow: '0 20px 50px rgba(0,0,0,0.35)', padding: '44px 40px 0 92px', overflow: 'hidden'}}>
      {Array.from({length: 11}, (_, k) => (
        <div key={k} style={{position: 'absolute', left: 0, right: 0, top: 64 + k * 46, height: 2, background: 'rgba(30,90,160,0.18)'}} />
      ))}
      <div style={{position: 'absolute', left: 78, top: 0, bottom: 0, width: 2, background: 'rgba(220,80,80,0.35)'}} />
      {scribbles[i].map((s, k) => (
        <div key={k} style={{fontFamily: HF, fontWeight: 700, fontSize: k === 0 && i < 2 ? 60 : 44, color: i === 1 ? '#1d3a8a' : '#23303f', lineHeight: '46px', height: 46, marginTop: k === 0 ? 16 : 0, transform: `rotate(${(rnd(i * 9 + k) - 0.5) * 2.4}deg)`, textDecoration: k === 2 && i === 0 ? 'line-through' : 'none', whiteSpace: 'nowrap'}}>
          {s}
        </div>
      ))}
      {/* coffee ring */}
      <div style={{position: 'absolute', right: 70 + i * 30, bottom: 50, width: 120, height: 120, borderRadius: 60, border: '6px solid rgba(120,70,30,0.22)'}} />
    </div>
  );
  return (
    <div style={{width: w, height: h, position: 'relative', perspective: 2200}}>
      <div style={{position: 'absolute', inset: -10, left: -26, width: 36, background: 'transparent', zIndex: 5}}>
        {Array.from({length: 11}, (_, k) => (
          <div key={k} style={{position: 'absolute', left: 0, top: 38 + k * 46, width: 62, height: 12, borderRadius: 6, background: 'linear-gradient(#dfe7ee,#8ea2b4)', boxShadow: '0 2px 4px rgba(0,0,0,0.3)'}} />
        ))}
      </div>
      {[2, 1, 0].map((i) => {
        const fl = flipAt[i] ?? 99;
        const p = prog(t, fl, 0.28, easeInOut);
        return (
          <div key={i} style={{position: 'absolute', inset: 0, transformOrigin: 'left center', transform: `rotateY(${-p * 178}deg)`, opacity: p > 0.98 ? 0 : 1, zIndex: 10 - i, backfaceVisibility: 'hidden'}}>
            <Page i={i} />
          </div>
        );
      })}
      {stamp && (
        <svg width={w} height={h} style={{position: 'absolute', inset: 0, zIndex: 20}} viewBox={`0 0 ${w} ${h}`}>
          <path d="M86 84 C 84 40, 330 34, 338 80 C 342 122, 100 126, 90 88" stroke={C.teal} strokeWidth={9} fill="none" strokeLinecap="round" strokeDasharray={1500} strokeDashoffset={1500 * (1 - prog(t, 3.98, 0.4))} />
        </svg>
      )}
    </div>
  );
};

export const NotebookScene: React.FC = () => {
  const t = useT();
  const {W, H, V} = useLayout();
  const cy = artY(V, H);
  const enter = prog(t, 3.0, 0.5);
  const sc = V ? 1.3 : 1.5;
  return (
    <AbsoluteFill>
      <Desk />
      <div style={{position: 'absolute', left: W / 2 - 380, top: cy - 300, transform: `translateX(${(1 - enter) * 900}px) rotate(${-4 + (1 - enter) * 10}deg) scale(${sc})`}}>
        <Notebook flipAt={[3.62, 4.12]} stamp />
      </div>
    </AbsoluteFill>
  );
};

export const MissingScene: React.FC = () => {
  const t = useT();
  const {W, H, V} = useLayout();
  const cy = artY(V, H);
  const sc = V ? 1.3 : 1.5;
  const yank = prog(t, 4.95, 0.35, easeIn);
  const st = pop(t, TM.missingWord, 230, 12);
  const sh = t > TM.missingWord && t < TM.missingWord + 0.3 ? Math.sin(t * 120) * 12 * (1 - (t - TM.missingWord) / 0.3) : 0;
  const ghost = prog(t, 5.1, 0.4);
  return (
    <AbsoluteFill style={{transform: `translate(${sh}px, ${sh * 0.6}px)`}}>
      <Desk />
      {/* where the notebook was: dashed outline + coffee ring */}
      <div style={{position: 'absolute', left: W / 2 - 380 * sc, top: cy - 300 + 280 - 280 * sc, width: 760 * sc, height: 560 * sc, border: `5px dashed rgba(255,255,255,${0.5 * ghost})`, borderRadius: 24, transform: 'rotate(-4deg)'}}>
        <div style={{position: 'absolute', right: 90, bottom: 70, width: 120 * sc * 0.8, height: 120 * sc * 0.8, borderRadius: 100, border: '7px solid rgba(200,150,90,0.28)', opacity: ghost}} />
      </div>
      <div style={{position: 'absolute', left: W / 2 - 380, top: cy - 300, transform: `translateX(${yank * 1900}px) rotate(${-4 + yank * 18}deg) scale(${sc})`, opacity: 1 - yank * 0.2}}>
        <Notebook flipAt={[3.62, 4.12]} />
      </div>
      <div style={{position: 'absolute', left: W / 2 - (V ? 440 : 760), top: cy + (V ? 360 : 250), width: 360, height: 22, borderRadius: 11, background: 'linear-gradient(#2d8bd0,#12456f)', transform: 'rotate(-24deg)', boxShadow: '0 10px 20px rgba(0,0,0,0.35)', opacity: ghost}} />
      {/* sticky note with a question mark */}
      <div style={{position: 'absolute', left: W / 2 + (V ? 120 : 360), top: cy - (V ? 380 : 330), width: 190, height: 190, background: '#FFD966', boxShadow: '0 14px 30px rgba(0,0,0,0.35)', transform: `rotate(8deg) scale(${pop(t, 5.3, 200, 14)})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: HF, fontWeight: 700, fontSize: 130, color: '#5b4a10'}}>?</div>
      {/* MISSING stamp */}
      <div style={{position: 'absolute', left: 0, right: 0, top: cy - 90, display: 'flex', justifyContent: 'center', transform: `scale(${2.4 - 1.4 * st}) rotate(-7deg)`, opacity: Math.min(1, st * 3)}}>
        <div style={{padding: '8px 44px 14px', border: `12px solid ${C.warn}`, borderRadius: 18, color: C.warn, fontFamily: PF, fontWeight: 700, fontSize: V ? 130 : 156, letterSpacing: 6, background: 'rgba(3,28,56,0.55)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)'}}>MISSING</div>
      </div>
    </AbsoluteFill>
  );
};

// =========================================================================================
// 4. "Sound familiar? You're not alone."  (6.47 - 8.66)
// =========================================================================================
export const FamiliarScene: React.FC = () => {
  const t = useT();
  const {W, H, V} = useLayout();
  const cy = artY(V, H);
  const r = V ? 92 : 96; // hex radius
  const dx = Math.sqrt(3) * r;
  const dy = 1.5 * r;
  const cols = V ? 7 : 11;
  const rows = V ? 9 : 6;
  const gx = W / 2 - ((cols - 1) * dx) / 2;
  const gy = cy - ((rows - 1) * dy) / 2;
  const cells: React.ReactNode[] = [];
  const ci = Math.floor(cols / 2);
  const cj = Math.floor(rows / 2);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = gx + i * dx + (j % 2 ? dx / 2 : 0);
      const y = gy + j * dy;
      const dist = Math.hypot(i + (j % 2 ? 0.5 : 0) - ci, (j - cj) * 0.9);
      const on = prog(t, 7.15 + dist * 0.11, 0.3);
      const appear = pop(t, 6.6 + dist * 0.03, 160, 16);
      cells.push(
        <div key={`${i}_${j}`} style={{position: 'absolute', left: x - r, top: y - r, transform: `scale(${appear * 0.92})`}}>
          <Hex size={r * 2} fill={on > 0 ? `rgba(10,163,176,${0.18 + 0.75 * on})` : 'rgba(255,255,255,0.05)'} stroke={on > 0 ? C.cyan : 'rgba(255,255,255,0.18)'} sw={2.5}>
            <Icon name="user" size={r * 0.8} color={on > 0 ? '#fff' : 'rgba(255,255,255,0.35)'} />
          </Hex>
        </div>,
      );
    }
  }
  const a1 = 1 - prog(t, 7.55, 0.15);
  const a2 = pop(t, TM.alone, 190, 15);
  return (
    <AbsoluteFill>
      <NavyBg glow="c" />
      {cells}
      <AbsoluteFill style={{background: 'radial-gradient(46% 26% at 50% 50%, rgba(3,28,56,0.96) 40%, rgba(3,28,56,0) 100%)'}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: cy - (V ? 100 : 90), textAlign: 'center'}}>
        <div style={{opacity: a1 * Math.min(1, pop(t, TM.familiar, 220, 14) * 2), transform: `scale(${0.8 + 0.2 * pop(t, TM.familiar, 220, 14)})`, display: 'inline-block'}}>
          <span style={{fontFamily: PF, fontWeight: 700, fontSize: V ? 130 : 150, color: '#fff', letterSpacing: -3}}>Sound </span>
          <span style={{fontFamily: PF, fontWeight: 700, fontSize: V ? 130 : 150, color: C.cyan, letterSpacing: -3}}>familiar?</span>
        </div>
        <div style={{position: 'absolute', left: 0, right: 0, top: 0, opacity: Math.min(1, a2 * 2), transform: `scale(${0.7 + 0.3 * a2})`}}>
          <span style={{fontFamily: PF, fontWeight: 700, fontSize: V ? 118 : 140, color: '#fff', letterSpacing: -3}}>You're not </span>
          <span style={{fontFamily: PF, fontWeight: 700, fontSize: V ? 118 : 140, color: C.cyan, letterSpacing: -3}}>alone.</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// =========================================================================================
// 5. PAIN MONTAGE (8.66 - 15.7)
// =========================================================================================
export const PainIntro: React.FC = () => {
  // 8.66 - 10.28  "A lot of businesses still run on..."
  const t = useT();
  const {W, H, V} = useLayout();
  const cy = artY(V, H);
  const icons = ['cup', 'court', 'hardhat', 'doc'];
  const size = V ? 190 : 220;
  const fall = prog(t, 9.78, 0.4, easeIn);
  return (
    <AbsoluteFill>
      <NavyBg glow="tl" />
      <div style={{position: 'absolute', left: 0, right: 0, top: cy - size * (V ? 1.3 : 0.9), display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: V ? 26 : 40, padding: V ? '0 70px' : 0, transform: `translateY(${fall * 500}px)`, opacity: 1 - fall}}>
        {icons.map((n, i) => {
          const a = pop(t, 8.72 + i * 0.12, 190, 14);
          return (
            <div key={n} style={{transform: `scale(${a}) translateY(${Math.sin(t * 3 + i) * 6}px)`}}>
              <Hex size={size} fill="rgba(10,163,176,0.22)" stroke={C.cyan} sw={3}>
                <Icon name={n} size={size * 0.46} color="#fff" />
              </Hex>
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: cy + (V ? 90 : 120), textAlign: 'center', fontFamily: PF, fontWeight: 700, fontSize: V ? 110 : 120, color: '#fff', letterSpacing: -2, opacity: prog(t, 9.1, 0.3)}}>
        still run on<span style={{color: C.cyan}}>{'.'.repeat(1 + (Math.floor(t * 4) % 3))}</span>
      </div>
    </AbsoluteFill>
  );
};

export const PaperScene: React.FC = () => {
  // 10.28 - 10.9 "paper,"
  const t = useT();
  const {W, H, V} = useLayout();
  const cy = artY(V, H);
  const word = pop(t, 10.3, 220, 12);
  const sheets = Array.from({length: 9}, (_, i) => {
    const t0 = 10.24 + i * 0.045;
    const a = prog(t, t0, 0.3);
    const ang = (rnd(i + 3) - 0.5) * 50;
    const x = W / 2 + (rnd(i + 11) - 0.5) * (V ? 700 : 1300);
    const y = cy + (rnd(i + 21) - 0.5) * (V ? 900 : 560);
    return (
      <div key={i} style={{position: 'absolute', left: x - 170, top: y - 220 - (1 - a) * 800, width: 340, height: 440, background: C.paper, borderRadius: 6, boxShadow: '0 18px 40px rgba(0,0,0,0.35)', transform: `rotate(${ang * a}deg)`, opacity: Math.min(1, a * 3), overflow: 'hidden'}}>
        {Array.from({length: 9}, (_, k) => (
          <div key={k} style={{position: 'absolute', left: 24, right: 24, top: 50 + k * 40, height: 3, background: `rgba(35,48,63,${0.25 + 0.2 * rnd(i * 7 + k)})`, width: `${50 + 40 * rnd(i * 3 + k)}%`}} />
        ))}
      </div>
    );
  });
  return (
    <AbsoluteFill>
      <NavyBg glow="br" />
      {sheets}
      <div style={{position: 'absolute', left: 0, right: 0, top: cy - 100, textAlign: 'center', transform: `scale(${2 - word}) rotate(-3deg)`, opacity: Math.min(1, word * 3)}}>
        <span style={{fontFamily: PF, fontWeight: 700, fontSize: V ? 210 : 260, color: '#fff', letterSpacing: -5, textShadow: '0 10px 50px rgba(3,28,56,0.9), 0 0 0 #000', background: 'rgba(3,28,56,0.55)', padding: '0 40px', borderRadius: 30}}>PAPER</span>
      </div>
    </AbsoluteFill>
  );
};

const bubbles = [
  {n: 'Staff GC', m: 'Sir, available pa ba Sat?', c: '#2d8bd0', side: 0},
  {n: 'Mang Tonyo', m: 'Asa na ang resibo?', c: '#6b5bd6', side: 1},
  {n: 'Ate Joy', m: 'pa-check po ng stock', c: '#c2437b', side: 0},
  {n: 'Boss', m: 'Unsa na?', c: '#e08a1e', side: 1},
  {n: 'GC - Project', m: 'nawala yung file', c: '#0f9d77', side: 0},
  {n: 'Staff GC', m: 'see attached (FINAL_v3)', c: '#2d8bd0', side: 1},
];

export const ChatsScene: React.FC = () => {
  const t = useT();
  const {W, H, V} = useLayout();
  const cy = artY(V, H);
  const bw = V ? 760 : 780;
  const word = pop(t, TM.chats, 200, 14);
  const badge = Math.floor(prog(t, 10.95, 0.9, easeOut) * 99);
  return (
    <AbsoluteFill>
      <NavyBg glow="tl" />
      <div style={{position: 'absolute', left: V ? 0 : 110, right: V ? 0 : W - 880, top: V ? 250 : cy - 170, textAlign: V ? 'center' : 'left', transform: `scale(${0.7 + 0.3 * word})`, transformOrigin: V ? 'center' : 'left center', opacity: Math.min(1, word * 3)}}>
        <span style={{fontFamily: PF, fontWeight: 700, fontSize: V ? 104 : 170, color: '#fff', letterSpacing: -3, lineHeight: 1, display: V ? 'inline' : 'block'}}>GROUP </span>
        <span style={{fontFamily: PF, fontWeight: 700, fontSize: V ? 104 : 170, color: C.cyan, letterSpacing: -3, lineHeight: 1, display: V ? 'inline' : 'block'}}>CHATS</span>
      </div>
      <div style={{position: 'absolute', left: V ? W / 2 - 450 : 960, top: V ? 470 : cy - 380, width: V ? 900 : 860}}>
        {bubbles.map((b, i) => {
          const a = pop(t, 10.93 + i * 0.16, 220, 15);
          return (
            <div key={i} style={{display: 'flex', justifyContent: b.side ? 'flex-end' : 'flex-start', marginBottom: 20, transform: `translateY(${(1 - a) * 80}px) scale(${0.6 + 0.4 * a})`, opacity: Math.min(1, a * 2)}}>
              <div style={{maxWidth: '78%', background: '#fff', borderRadius: 26, padding: '16px 26px', boxShadow: '0 12px 30px rgba(0,0,0,0.3)', fontFamily: IF}}>
                <div style={{fontWeight: 700, fontSize: 22, color: b.c}}>{b.n}</div>
                <div style={{fontWeight: 500, fontSize: 32, color: '#16293d'}}>{b.m}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', right: V ? 36 : W - 830, top: V ? 246 : cy - 230, minWidth: 120, height: 82, padding: '0 26px', borderRadius: 41, background: C.warn, color: '#fff', fontFamily: PF, fontWeight: 700, fontSize: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${pop(t, 11.0, 240, 12)})`}}>
        {badge >= 99 ? '99+' : badge}
      </div>
    </AbsoluteFill>
  );
};

export const SheetScene: React.FC = () => {
  // 11.98 - 12.75 "a spreadsheet"
  const t = useT();
  const {W, H, V} = useLayout();
  const cy = artY(V, H);
  const cols = V ? 6 : 9;
  const rows = V ? 10 : 7;
  const cw = V ? 150 : 170;
  const rh = V ? 72 : 76;
  const gw = cols * cw;
  const errs = [[2, 3], [4, 5], [1, 7], [5, 2]];
  const a = pop(t, 12.0, 160, 17);
  const word = pop(t, 12.02, 200, 14);
  return (
    <AbsoluteFill>
      <NavyBg glow="br" />
      <div style={{position: 'absolute', left: W / 2 - gw / 2, top: cy - (rows * rh) / 2 + (V ? 60 : 40), width: gw, borderRadius: 18, overflow: 'hidden', background: '#fff', boxShadow: '0 40px 100px rgba(0,0,0,0.5)', transform: `scale(${0.85 + 0.15 * a}) rotate(${(1 - a) * -4}deg)`, opacity: Math.min(1, a * 2), fontFamily: IF}}>
        <div style={{height: 56, background: '#107C41', color: '#fff', fontWeight: 700, fontSize: 24, display: 'flex', alignItems: 'center', padding: '0 22px'}}>
          Sales_FINAL_v3(2).xlsx
        </div>
        <div style={{height: 50, background: '#f3f6f8', borderBottom: '1px solid #d5dde3', display: 'flex', alignItems: 'center', padding: '0 20px', fontWeight: 500, fontSize: 24, color: '#2b3a47'}}>
          fx &nbsp;=SUM(B2:B47)/IFERROR(D9,#REF!)
        </div>
        {Array.from({length: rows}, (_, r) => (
          <div key={r} style={{display: 'flex', height: rh}}>
            {Array.from({length: cols}, (_, c) => {
              const err = errs.some(([ec, er]) => ec === c && er === r);
              const filled = t > 12.0 + (r * cols + c) * 0.004;
              return (
                <div key={c} style={{width: cw, borderRight: '1px solid #e1e8ed', borderBottom: '1px solid #e1e8ed', background: err ? '#FFE3DF' : r === 0 ? '#f3f6f8' : '#fff', display: 'flex', alignItems: 'center', padding: '0 14px', fontWeight: err ? 700 : 500, fontSize: 24, color: err ? C.warn : '#51606d'}}>
                  {filled && (err ? '#REF!' : r === 0 ? 'ABCDEFGHI'[c] : <div style={{height: 14, borderRadius: 7, background: '#d9e2e8', width: `${35 + 55 * rnd(r * 13 + c)}%`}} />)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: V ? 250 : 30, textAlign: 'center', transform: `scale(${0.7 + 0.3 * word})`, opacity: Math.min(1, word * 3)}}>
        <span style={{fontFamily: PF, fontWeight: 700, fontSize: V ? 104 : 96, color: '#fff', letterSpacing: -2, background: 'rgba(3,28,56,0.8)', padding: '6px 34px', borderRadius: 24}}>SPREAD<span style={{color: C.cyan}}>SHEET</span></span>
      </div>
    </AbsoluteFill>
  );
};

export const OnePersonScene: React.FC = () => {
  // 12.75 - 14.54 "that only one person understands"
  const t = useT();
  const {W, H, V} = useLayout();
  const cy = artY(V, H);
  const n = 7;
  const r = V ? 100 : 118;
  const lit = pop(t, 13.35, 140, 15);
  const spot = prog(t, 12.85, 0.5);
  const positions = Array.from({length: n}, (_, i) => {
    if (V) {
      const row = i < 3 ? 0 : i < 6 ? 1 : 2;
      const col = i < 3 ? i : i < 6 ? i - 3 : 1;
      return [W / 2 + (col - 1) * 250, cy - 140 + row * 250 - 100] as [number, number];
    }
    const row = i < 4 ? 0 : 1;
    const col = i < 4 ? i : i - 4;
    return [W / 2 + (col - (row ? 1 : 1.5)) * 280, cy - 90 + row * 250] as [number, number];
  });
  const target = V ? 4 : 5;
  return (
    <AbsoluteFill>
      <NavyBg glow="c" />
      {positions.map(([x, y], i) => {
        const a = pop(t, 12.8 + i * 0.05, 180, 15);
        const isT = i === target;
        const k = isT ? lit : 0;
        return (
          <div key={i} style={{position: 'absolute', left: x - r, top: y - r, transform: `scale(${a * (1 + 0.28 * k)})`, zIndex: isT ? 5 : 1, opacity: isT ? 1 : 1 - 0.6 * spot}}>
            <Hex size={r * 2} fill={isT ? `rgba(10,163,176,${0.2 + 0.7 * k})` : 'rgba(255,255,255,0.06)'} stroke={isT ? C.cyan : 'rgba(255,255,255,0.2)'} sw={3}>
              <Icon name={isT ? 'user' : 'user'} size={r * 0.85} color={isT ? '#fff' : 'rgba(255,255,255,0.4)'} />
            </Hex>
            {!isT && (
              <div style={{position: 'absolute', right: -6, top: -14, width: 54, height: 54, borderRadius: 27, background: 'rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.7)', fontFamily: PF, fontWeight: 700, fontSize: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: prog(t, 13.1, 0.3)}}>?</div>
            )}
            {isT && (
              <div style={{position: 'absolute', left: r * 1.15, top: -r * 0.2, opacity: prog(t, 13.5, 0.3), transform: `scale(${pop(t, 13.5, 200, 14)})`}}>
                <Hex size={92} fill="#fff" stroke={C.teal} sw={3}><Icon name="sheet" size={44} color={C.teal2} /></Hex>
              </div>
            )}
          </div>
        );
      })}
      <div style={{position: 'absolute', left: 0, right: 0, top: V ? 240 : 70, textAlign: 'center', transform: `scale(${0.8 + 0.2 * pop(t, 12.8, 200, 14)})`}}>
        <span style={{fontFamily: PF, fontWeight: 700, fontSize: V ? 104 : 108, color: '#fff', letterSpacing: -2}}>ONLY </span>
        <span style={{fontFamily: PF, fontWeight: 700, fontSize: V ? 104 : 108, color: C.cyan, letterSpacing: -2}}>ONE PERSON</span>
      </div>
    </AbsoluteFill>
  );
};

export const ExhaustingScene: React.FC = () => {
  // 14.54 - 15.7 "It gets exhausting."
  const t = useT();
  const {W, H, V} = useLayout();
  const cy = artY(V, H);
  const word = 'EXHAUSTING';
  const size = V ? 118 : 190;
  const bat = kf(t, [[14.5, 0.62], [15.6, 0.04]]);
  const shake = t > 14.54 && t < 14.8 ? Math.sin(t * 110) * 10 * (1 - (t - 14.54) / 0.26) : 0;
  const pile = [
    ['doc', 0], ['chat', 1], ['sheet', 2], ['doc', 3], ['chat', 4], ['sheet', 5], ['doc', 6], ['chat', 7],
  ] as [string, number][];
  return (
    <AbsoluteFill style={{transform: `translate(${shake}px, ${shake * 0.5}px)`}}>
      <NavyBg glow="br" />
      {pile.map(([ic, i]) => {
        const a = prog(t, 14.55 + i * 0.06, 0.45, easeIn);
        const x = W * (0.12 + 0.76 * rnd(i + 5));
        const yEnd = H - 120 - (i % 3) * 70;
        return (
          <div key={i} style={{position: 'absolute', left: x - 70, top: -200 + (yEnd + 200) * a, opacity: Math.min(1, a * 4), transform: `rotate(${(rnd(i) - 0.5) * 70}deg)`}}>
            <Hex size={150} fill="rgba(255,107,91,0.25)" stroke={C.warn} sw={3}><Icon name={ic} size={70} color="#fff" /></Hex>
          </div>
        );
      })}
      <div style={{position: 'absolute', left: 0, right: 0, top: cy - (V ? 230 : 190), textAlign: 'center', display: 'flex', justifyContent: 'center'}}>
        {word.split('').map((ch, i) => {
          const t0 = 14.58 + i * 0.045;
          const a = pop(t, t0, 130, 9);
          const sag = prog(t, 15.2, 0.4) * (i % 2 ? 14 : 4);
          return (
            <span key={i} style={{fontFamily: PF, fontWeight: 700, fontSize: size, letterSpacing: -2, color: i < 2 ? C.warn : '#fff', display: 'inline-block', transform: `translateY(${(1 - a) * -420 + sag}px) rotate(${sag * 0.4}deg)`, opacity: t > t0 ? 1 : 0, textShadow: '0 10px 40px rgba(0,0,0,0.5)'}}>
              {ch}
            </span>
          );
        })}
      </div>
      <div style={{position: 'absolute', left: W / 2 - 150, top: cy + (V ? 40 : 60), width: 300, height: 140, opacity: prog(t, 14.8, 0.3)}}>
        <svg width="300" height="140" viewBox="0 0 24 11.2" style={{overflow: 'visible'}}>
          <rect x="1" y="1" width="19" height="9.2" rx="2" fill="none" stroke="#fff" strokeWidth="0.7" />
          <rect x="20.8" y="3.8" width="1.6" height="3.6" rx="0.6" fill="#fff" />
          <rect x="1.8" y="1.8" width={17.4 * bat} height="7.6" rx="1.2" fill={bat < 0.3 ? C.warn : C.cyan} />
        </svg>
      </div>
      <AbsoluteFill style={{background: `radial-gradient(70% 70% at 50% 50%, rgba(3,28,56,0) 40%, rgba(3,10,24,${0.35 + 0.5 * prog(t, 14.6, 1.0)}) 100%)`}} />
    </AbsoluteFill>
  );
};
