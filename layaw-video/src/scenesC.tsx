import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {C, Hex, Icon, IF, LightBg, PF, NavyBg, HexGrid, easeInOut, easeOut, hexPts, kf, pop, prog, useLayout, useT} from './kit';
import {GRAD_TEAL, TM, easeIn, rnd} from './theme';

const artY = (V: boolean, H: number) => (V ? 760 : H / 2 - 20);

// 28.65 - 30.79  "Doing things a little differently? That's fine."
export const DifferentScene: React.FC = () => {
  const t = useT();
  const {W, H, V} = useLayout();
  const cy = artY(V, H);
  const fine = pop(t, TM.fine, 170, 13);
  const shapes = [
    {k: 'sq', col: C.navy2},
    {k: 'ci', col: C.teal},
    {k: 'tri', col: C.teal2},
    {k: 'pill', col: '#0E3A66'},
    {k: 'hex', col: C.cyan},
  ];
  const gap = V ? 190 : 270;
  const startX = W / 2 - gap * 2;
  const Shape: React.FC<{k: string; col: string; s: number}> = ({k, col, s}) => {
    if (k === 'sq') return <div style={{width: s, height: s, borderRadius: s * 0.18, background: col}} />;
    if (k === 'ci') return <div style={{width: s, height: s, borderRadius: s, background: col}} />;
    if (k === 'pill') return <div style={{width: s * 0.62, height: s * 1.2, borderRadius: s, background: col}} />;
    if (k === 'tri') return (<svg width={s} height={s}><polygon points={`${s / 2},${s * 0.06} ${s * 0.96},${s * 0.92} ${s * 0.04},${s * 0.92}`} fill={col} strokeLinejoin="round" stroke={col} strokeWidth={14} /></svg>);
    return (<svg width={s} height={s}><polygon points={hexPts(s / 2, s / 2, s / 2 - 2)} fill={col} /></svg>);
  };
  const s = V ? 150 : 170;
  return (
    <AbsoluteFill>
      <LightBg />
      <div style={{position: 'absolute', left: 0, right: 0, top: V ? 330 : 36, textAlign: 'center', fontFamily: PF, fontWeight: 700, fontSize: V ? 104 : 100, color: C.navy2, letterSpacing: -2, lineHeight: 1.05}}>
        {['a little', 'differently?'].map((w, i) => {
          const a = pop(t, 28.7 + i * 0.5, 200, 15);
          return <div key={w} style={{opacity: Math.min(1, a * 2), transform: `translateY(${(1 - a) * 50}px)`, color: i ? C.teal2 : C.navy2}}>{w}</div>;
        })}
      </div>
      {shapes.map((sh, i) => {
        const a = pop(t, 28.9 + i * 0.15, 150, 11);
        const x = (V ? W / 2 + (i - 2) * gap * 0.98 : startX + i * gap);
        const wob = Math.sin(t * 4 + i * 1.7) * 14 * (1 - fine);
        const yy = (V ? cy + 40 : 450) + (i % 2 ? -50 : 40) * (1 - fine) + wob;
        const ok = pop(t, TM.fine + 0.12 + i * 0.06, 200, 12);
        return (
          <div key={i} style={{position: 'absolute', left: x - s / 2, top: yy - s / 2, width: s, height: s, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${a}) rotate(${wob}deg)`}}>
            <Shape k={sh.k} col={sh.col} s={s} />
            <div style={{position: 'absolute', right: -14, top: -16, transform: `scale(${ok})`}}>
              <Hex size={68} fill="#14B87A" stroke="#fff" sw={4}><Icon name="check" size={34} color="#fff" sw={3.4} /></Hex>
            </div>
          </div>
        );
      })}
      <div style={{position: 'absolute', left: 0, right: 0, top: V ? cy + 270 : 590, textAlign: 'center', transform: `scale(${0.6 + 0.4 * fine})`, opacity: Math.min(1, fine * 2)}}>
        <span style={{fontFamily: PF, fontWeight: 700, fontSize: V ? 150 : 140, letterSpacing: -3, background: GRAD_TEAL, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent'}}>That's fine.</span>
      </div>
    </AbsoluteFill>
  );
};

// 30.79 - 33.65 "Just tell us how you work, and we'll build a system around you."
export const BuildAroundScene: React.FC = () => {
  const t = useT();
  const {W, H, V} = useLayout();
  const cy = artY(V, H);
  const bub = pop(t, 30.86, 170, 15);
  const typed = Math.floor(prog(t, 31.0, 0.9, (x) => x) * 24);
  const msg = "This is how we work...".padEnd(24, ' ').slice(0, typed);
  const cards = [['user', 'Clients'], ['doc', 'Quotations'], ['bars', 'Reports']];
  const cw = V ? 560 : 270;
  const ch = V ? 128 : 150;
  const hcy = V ? cy - 20 : cy + 60;
  const pos = (i: number): [number, number] => V ? [W / 2, cy - 20 + (i - 1) * 190] : i < 2 ? [W / 2 + (i ? 150 : -150), hcy - 80] : [W / 2, hcy + 100];
  const frame = prog(t, TM.build + 0.1, 0.9, easeInOut);
  const R = V ? 520 : 350;
  const glow = prog(t, 33.05, 0.5);
  const per = 6 * 2 * R * Math.sin(Math.PI / 6);
  return (
    <AbsoluteFill>
      <NavyBg glow="c" />
      {/* the owner's message */}
      <div style={{position: 'absolute', left: W / 2 - (V ? 420 : 330), top: V ? 250 : 70, width: V ? 840 : 660, transform: `scale(${bub}) translateY(${(1 - bub) * 40}px)`, transformOrigin: 'left center', opacity: Math.min(1, bub * 2), zIndex: 10}}>
        <div style={{padding: '24px 34px', borderRadius: '34px 34px 34px 8px', background: '#fff', fontFamily: IF, fontWeight: 700, fontSize: V ? 46 : 42, color: C.navy2, boxShadow: '0 20px 50px rgba(0,0,0,0.35)', minHeight: 100}}>
          {msg}<span style={{opacity: Math.floor(t * 3) % 2 ? 1 : 0, color: C.teal}}>|</span>
        </div>
      </div>
      {/* hexagon that gets built around the workflow */}
      <svg width={W} height={H} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        <defs>
          <linearGradient id="hg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={C.cyan} /><stop offset="1" stopColor={C.teal2} /></linearGradient>
        </defs>
        <polygon points={hexPts(W / 2, hcy, R)} fill={`rgba(10,163,176,${0.14 * glow})`} stroke="url(#hg)" strokeWidth={9} strokeLinejoin="round" strokeDasharray={per} strokeDashoffset={per * (1 - frame)} />
        <polygon points={hexPts(W / 2, hcy, R + 30)} fill="none" stroke={C.cyan} strokeOpacity={0.35 * frame} strokeWidth={2} strokeDasharray="10 14" />
      </svg>
      {cards.map(([ic, name], i) => {
        const a = pop(t, 31.45 + i * 0.22, 180, 15);
        const [x, y] = pos(i);
        return (
          <div key={name} style={{position: 'absolute', left: x - cw / 2, top: y - ch / 2, width: cw, height: ch, borderRadius: 26, background: '#fff', boxShadow: `0 24px 60px rgba(0,0,0,0.4), 0 0 ${60 * glow}px rgba(45,224,236,${0.7 * glow})`, display: 'flex', alignItems: V ? 'center' : 'center', flexDirection: V ? 'row' : 'column', justifyContent: 'center', gap: 18, transform: `scale(${a})`, opacity: Math.min(1, a * 2), fontFamily: IF}}>
            <Hex size={V ? 84 : 92} fill={C.navy2}><Icon name={ic} size={42} color="#fff" /></Hex>
            <div style={{fontWeight: 700, fontSize: V ? 44 : 36, color: C.navy2}}>{name}</div>
          </div>
        );
      })}
      {/* connectors */}
      {!V && (() => {
        const a = prog(t, 32.0, 0.4);
        const b = prog(t, 32.25, 0.4);
        const [x0, y0] = pos(0);
        const [x1] = pos(1);
        const [x2, y2] = pos(2);
        return (
          <>
            <div style={{position: 'absolute', left: x0 + cw / 2, top: y0 - 3, width: (x1 - x0 - cw) * a, height: 6, borderRadius: 3, background: C.cyan}} />
            <div style={{position: 'absolute', left: W / 2 - 3, top: y0 + ch / 2, width: 6, height: (y2 - ch / 2 - (y0 + ch / 2)) * b, borderRadius: 3, background: C.cyan}} />
          </>
        );
      })()}
    </AbsoluteFill>
  );
};

// 33.65 - 35.38  SIMPLE. SMART. SOLID.
export const TaglineScene: React.FC = () => {
  const t = useT();
  const {W, H, V} = useLayout();
  const cy = artY(V, H);
  const words = [['SIMPLE', TM.simple, 'doc'], ['SMART', TM.smart, 'gear'], ['SOLID', TM.solid, 'lock']] as [string, number, string][];
  const size = V ? 190 : 220;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{background: `linear-gradient(135deg, ${C.teal} 0%, ${C.teal2} 35%, ${C.navy2} 100%)`}} />
      <HexGrid opacity={0.12} />
      {words.map(([w, t0, ic], i) => {
        const a = pop(t, t0, 210, 12);
        const wipe = prog(t, t0, 0.22);
        const y = cy - (V ? 330 : 360) + i * (size * (V ? 1.28 : 1.12));
        const flash = Math.max(0, 1 - (t - t0) * 6);
        return (
          <div key={w} style={{position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 36, clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)`, transform: `translateX(${(1 - a) * -80}px) scale(${1 + 0.05 * flash})`}}>
            <div style={{fontFamily: PF, fontWeight: 700, fontSize: size, letterSpacing: -6, color: '#fff', lineHeight: 1}}>{w}<span style={{color: C.cyan}}>.</span></div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// 35.38 - 39.13  CTA
export const CTAScene: React.FC = () => {
  const t = useT();
  const {W, H, V} = useLayout();
  const cy = V ? 700 : H / 2 - 80;
  const L = V ? 560 : 500;
  const r = prog(t, TM.cta, 0.7, easeOut);
  const pp = 0.92 + 0.08 * pop(t, TM.cta, 120, 16);
  const wm = prog(t, TM.cta + 0.35, 0.5);
  const tag = prog(t, TM.cta + 0.7, 0.6);
  const url = pop(t, TM.url, 170, 14);
  const ul = prog(t, TM.url + 0.2, 0.6);
  const fade = prog(t, 38.75, 0.38, easeInOut);
  const idle = 1 + 0.012 * Math.sin(t * 2.2);
  return (
    <AbsoluteFill>
      <LightBg />
      <div style={{position: 'absolute', left: W / 2 - L / 2, top: cy - L / 2, width: L, height: L, transform: `scale(${pp * idle})`, clipPath: r < 1 ? `polygon(${hexPts(L / 2, L / 2, r * L * 0.62).split(' ').map((s) => s.split(',').map((n) => n + 'px').join(' ')).join(', ')})` : undefined}}>
        <Img src={staticFile('logo.png')} style={{width: L, height: L}} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: cy + L / 2 - 6, textAlign: 'center', opacity: wm, transform: `translateY(${(1 - wm) * 24}px)`}}>
        <span style={{fontFamily: PF, fontWeight: 700, fontSize: V ? 84 : 76, color: C.navy2, letterSpacing: '0.14em', paddingLeft: '0.14em'}}>LAYAW <span style={{color: C.teal2}}>SYSTEM</span></span>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: cy + L / 2 + (V ? 100 : 92), textAlign: 'center', opacity: tag, letterSpacing: `${0.34 - 0.16 * tag}em`}}>
        <span style={{fontFamily: PF, fontWeight: 400, fontSize: V ? 40 : 36, color: C.slate}}>SIMPLE. SMART. SOLID.</span>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: cy + L / 2 + (V ? 200 : 180), display: 'flex', justifyContent: 'center'}}>
        <div style={{position: 'relative', padding: V ? '24px 64px 32px' : '20px 64px 28px', borderRadius: 60, background: `linear-gradient(135deg, ${C.navy2}, ${C.navy})`, boxShadow: `0 24px 60px rgba(4,38,74,0.35), 0 0 0 ${6 * url}px rgba(10,163,176,0.25)`, transform: `scale(${0.6 + 0.4 * url})`, opacity: Math.min(1, url * 2)}}>
          <span style={{fontFamily: PF, fontWeight: 700, fontSize: V ? 68 : 62, color: '#fff', letterSpacing: -0.5}}>layawsystem<span style={{color: C.cyan}}>.com</span></span>
          <div style={{position: 'absolute', left: 64, bottom: 16, height: 5, width: `calc(${ul * 100}% - 128px)`, background: C.cyan, borderRadius: 3}} />
        </div>
      </div>
      <AbsoluteFill style={{background: '#fff', opacity: fade * 0.0}} />
    </AbsoluteFill>
  );
};

// thumbnail / title card (still)
export const ThumbScene: React.FC = () => {
  const {W, H, V} = useLayout();
  return (
    <AbsoluteFill>
      <NavyBg glow="br" />
      <div style={{position: 'absolute', left: V ? W / 2 - 230 : 110, top: V ? 170 : H / 2 - 230, width: 460, height: 460, borderRadius: 100, background: '#fff', boxShadow: '0 40px 100px rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <Img src={staticFile('logo.png')} style={{width: 400, height: 400}} />
      </div>
      <div style={{position: 'absolute', left: V ? 70 : 640, right: V ? 70 : 90, top: V ? 700 : H / 2 - 270, fontFamily: PF, fontWeight: 700, color: '#fff', letterSpacing: -3, lineHeight: 1.02, textAlign: V ? 'center' : 'left'}}>
        <div style={{fontSize: V ? 120 : 122}}>Software built</div>
        <div style={{fontSize: V ? 120 : 122, background: `linear-gradient(120deg, ${C.cyan}, ${C.teal})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>around you.</div>
        <div style={{fontSize: V ? 44 : 46, fontWeight: 400, letterSpacing: 6, marginTop: 40, color: 'rgba(255,255,255,0.85)'}}>SIMPLE. SMART. SOLID.</div>
        <div style={{display: 'inline-block', marginTop: 36, padding: '14px 44px', borderRadius: 50, background: C.teal, fontSize: V ? 52 : 50, letterSpacing: 0}}>layawsystem.com</div>
      </div>
    </AbsoluteFill>
  );
};
