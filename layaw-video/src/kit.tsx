import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/700.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/700.css';
import '@fontsource/caveat/700.css';
import {C, FPS, GRAD_NAVY, HF, IF, PF, easeInOut, easeOut, hexPts, kf, pop, prog} from './theme';

// ---------------------------------------------------------------- hooks
export const useT = () => useCurrentFrame() / FPS;
export const useLayout = () => {
  const {width: W, height: H} = useVideoConfig();
  return {W, H, V: H > W};
};

// ---------------------------------------------------------------- backgrounds
export const HexGrid: React.FC<{color?: string; opacity?: number; size?: number; drift?: number}> = ({
  color = '#fff',
  opacity = 0.07,
  size = 74,
  drift = 7,
}) => {
  const t = useT();
  const {W, H} = useLayout();
  const w = Math.sqrt(3) * size;
  const rowH = 1.5 * size;
  const cols = Math.ceil(W / w) + 3;
  const rows = Math.ceil(H / rowH) + 3;
  const ox = -((t * drift) % w);
  const oy = -((t * drift * 0.6) % (rowH * 2));
  const cells: React.ReactNode[] = [];
  for (let r = -1; r < rows; r++) {
    for (let c = -1; c < cols; c++) {
      cells.push(
        <polygon
          key={`${r}_${c}`}
          points={hexPts(c * w + (r % 2 ? w / 2 : 0), r * rowH, size - 1)}
          fill="none"
          stroke={color}
          strokeWidth={1.2}
        />,
      );
    }
  }
  return (
    <svg width={W} height={H} style={{position: 'absolute', inset: 0, opacity}}>
      <g transform={`translate(${ox},${oy})`}>{cells}</g>
    </svg>
  );
};

export const NavyBg: React.FC<{glow?: 'tl' | 'br' | 'c'; grid?: boolean}> = ({glow = 'br', grid = true}) => {
  const pos = glow === 'tl' ? '10% 0%' : glow === 'c' ? '50% 50%' : '90% 100%';
  return (
    <AbsoluteFill style={{background: GRAD_NAVY}}>
      <AbsoluteFill style={{background: `radial-gradient(60% 55% at ${pos}, rgba(10,163,176,0.40), rgba(10,163,176,0) 70%)`}} />
      {grid && <HexGrid />}
    </AbsoluteFill>
  );
};

export const LightBg: React.FC<{tint?: boolean}> = ({tint = true}) => (
  <AbsoluteFill style={{background: tint ? `linear-gradient(160deg, #FFFFFF 0%, ${C.mist} 100%)` : '#fff'}}>
    <HexGrid color={C.teal} opacity={0.10} drift={5} />
  </AbsoluteFill>
);

// ---------------------------------------------------------------- scene shell with masked wipes
export type WipeKind = 'angle' | 'hex' | 'up' | 'none' | 'flash';

const clipFor = (kind: WipeKind, p: number, W: number, H: number, cx: number, cy: number) => {
  if (kind === 'angle') {
    const sl = H * 0.38;
    const X = -sl + p * (W + sl * 2);
    return `polygon(0px 0px, ${X}px 0px, ${X - sl}px ${H}px, 0px ${H}px)`;
  }
  if (kind === 'hex') {
    const R = p * 0.62 * Math.hypot(W, H);
    return `polygon(${hexPts(cx, cy, R).split(' ').map((s) => s.split(',').map((n) => n + 'px').join(' ')).join(', ')})`;
  }
  if (kind === 'up') {
    const y = H * (1 - p);
    const sl = H * 0.1;
    return `polygon(0px ${y + sl}px, ${W}px ${y}px, ${W}px ${H}px, 0px ${H}px)`;
  }
  return 'none';
};

export const Scene: React.FC<{
  start: number;
  end: number; // when the NEXT scene starts covering this one
  wipe?: WipeKind;
  wipeDur?: number;
  hexCenter?: [number, number]; // fraction of W,H
  accent?: boolean;
  children: React.ReactNode;
  z?: number;
}> = ({start, end, wipe = 'angle', wipeDur = 0.5, hexCenter = [0.5, 0.5], accent = true, children, z = 0}) => {
  const t = useT();
  const {W, H} = useLayout();
  const w0 = start - 0.16; // wipe begins just ahead of the word so the mid-point lands on the beat
  if (t < w0 || t > end + 0.7) return null;
  const p = wipe === 'none' || wipe === 'flash' ? 1 : prog(t, w0, wipeDur, easeInOut);
  const cx = W * hexCenter[0];
  const cy = H * hexCenter[1];
  const clip = clipFor(wipe, p, W, H, cx, cy);
  const clipAcc = clipFor(wipe, Math.min(1, p + 0.07), W, H, cx, cy);
  const slide = wipe === 'angle' ? (1 - p) * 70 : 0;
  const scale = wipe === 'hex' ? 1 + (1 - p) * 0.06 : 1;
  const flash = wipe === 'flash' ? Math.max(0, 1 - prog(t, start, 0.45, easeOut)) : 0;
  return (
    <AbsoluteFill style={{zIndex: z}}>
      {accent && p < 1 && wipe !== 'none' && wipe !== 'flash' && (
        <AbsoluteFill style={{background: `linear-gradient(135deg, ${C.cyan}, ${C.teal})`, clipPath: clipAcc}} />
      )}
      <AbsoluteFill style={{clipPath: clip === 'none' ? undefined : clip}}>
        <AbsoluteFill style={{transform: `translateX(${slide}px) scale(${scale})`}}>{children}</AbsoluteFill>
      </AbsoluteFill>
      {flash > 0 && <AbsoluteFill style={{background: '#fff', opacity: flash}} />}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- captions
export type CapWord = {w: string; hl?: boolean};
export type CapChunk = {t0: number; t1: number; words: CapWord[]};

export const Caption: React.FC<{chunks: CapChunk[]}> = ({chunks}) => {
  const t = useT();
  const {W, V} = useLayout();
  const ch = chunks.find((c) => t >= c.t0 && t < c.t1 + 0.06);
  if (!ch) return null;
  const a = pop(t, ch.t0, 260, 20);
  const fs = V ? 60 : 52;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: V ? 470 : 40,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          maxWidth: W * (V ? 0.86 : 0.78),
          padding: V ? '22px 36px 26px' : '16px 36px 20px',
          borderRadius: 26,
          background: 'rgba(3,28,56,0.82)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.28)',
          border: '1px solid rgba(45,224,236,0.25)',
          textAlign: 'center',
          fontFamily: PF,
          fontWeight: 700,
          fontSize: fs,
          lineHeight: 1.18,
          color: '#fff',
          transform: `scale(${0.9 + 0.1 * a}) translateY(${(1 - a) * 16}px)`,
          opacity: Math.min(1, a * 2),
        }}
      >
        {ch.words.map((w, i) => (
          <span key={i} style={{color: w.hl ? C.cyan : '#fff'}}>
            {w.w}
            {i < ch.words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- brand bits
export const LogoImg: React.FC<{size: number; style?: React.CSSProperties}> = ({size, style}) => (
  <Img src={staticFile('logo.png')} style={{width: size, height: size, objectFit: 'contain', ...style}} />
);

/** small white tile with the unmodified logo (used as watermark on dark scenes) */
export const LogoChip: React.FC<{size?: number}> = ({size = 84}) => {
  const {V} = useLayout();
  return (
    <div
      style={{
        position: 'absolute',
        top: V ? 230 : 44,
        left: V ? 56 : 56,
        width: size,
        height: size,
        borderRadius: 22,
        background: '#fff',
        boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <LogoImg size={size * 0.86} />
    </div>
  );
};

export const Hex: React.FC<{
  size: number;
  fill?: string;
  stroke?: string;
  sw?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({size, fill = 'none', stroke = 'none', sw = 2, style, children}) => (
  <div style={{position: 'relative', width: size, height: size, ...style}}>
    <svg width={size} height={size} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
      <polygon points={hexPts(size / 2, size / 2, size / 2 - sw)} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
    </svg>
    <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{children}</div>
  </div>
);

/** Product title lower-third, brand style */
export const TitleCard: React.FC<{start: number; name: string; sub: string; end?: number}> = ({start, name, sub}) => {
  const t = useT();
  const {V} = useLayout();
  const a = pop(t, start + 0.1, 150, 16);
  const wb = prog(t, start + 0.1, 0.5);
  const fs = V ? 54 : 46;
  return (
    <div
      style={{
        position: 'absolute',
        left: 168,
        top: V ? 226 : 46,
        transform: `translateX(${(1 - a) * -80}px)`,
        opacity: Math.min(1, a * 1.5),
        zIndex: 60,
      }}
    >
      <div style={{display: 'flex', alignItems: 'stretch'}}>
        <div style={{width: 10, background: `linear-gradient(${C.cyan}, ${C.teal2})`, borderRadius: 6, marginRight: 22, transform: `scaleY(${wb})`, transformOrigin: 'top'}} />
        <div>
          <div style={{fontFamily: PF, fontWeight: 700, fontSize: fs, color: '#fff', letterSpacing: -0.5, lineHeight: 1.05}}>
            <span style={{color: C.cyan}}>LAYAW</span> {name}
          </div>
          <div style={{fontFamily: PF, fontWeight: 400, fontSize: fs * 0.46, color: 'rgba(255,255,255,0.82)', marginTop: 8, letterSpacing: 0.6}}>{sub}</div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- UI window chrome
export const Win: React.FC<{
  w: number;
  h: number;
  title?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  dark?: boolean;
}> = ({w, h, title, children, style, dark}) => (
  <div
    style={{
      width: w,
      height: h,
      borderRadius: 26,
      background: dark ? '#0B1F36' : '#fff',
      boxShadow: '0 50px 120px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.14)',
      overflow: 'hidden',
      fontFamily: IF,
      position: 'relative',
      ...style,
    }}
  >
    <div style={{height: 52, background: dark ? '#0E2A47' : '#F1F5F8', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 9, borderBottom: '1px solid rgba(0,0,0,0.06)'}}>
      {['#FF6B5B', '#FFC857', '#3DDC97'].map((c) => (
        <div key={c} style={{width: 14, height: 14, borderRadius: 7, background: c}} />
      ))}
      <div style={{marginLeft: 16, fontWeight: 500, fontSize: 18, color: dark ? '#9FB6CC' : '#5B7388'}}>{title}</div>
    </div>
    <div style={{position: 'absolute', top: 52, left: 0, right: 0, bottom: 0}}>{children}</div>
  </div>
);

/** place a fixed-size design (dw x dh) fitted into the scene area */
export const Fit: React.FC<{dw: number; dh: number; children: React.ReactNode; cx?: number; cy?: number; maxW?: number; maxH?: number; scaleBoost?: number; rot?: [number, number, number]}> = ({
  dw,
  dh,
  children,
  cx,
  cy,
  maxW,
  maxH,
  scaleBoost = 1,
  rot = [0, 0, 0],
}) => {
  const {W, H, V} = useLayout();
  const mw = maxW ?? (V ? W * 0.94 : W * 0.78);
  const mh = maxH ?? (V ? H * 0.5 : H * 0.72);
  const k = Math.min(mw / dw, mh / dh) * scaleBoost;
  const x = cx ?? W / 2;
  const y = cy ?? (V ? 700 : H / 2 - 30);
  return (
    <div
      style={{
        position: 'absolute',
        left: x - dw / 2,
        top: y - dh / 2,
        width: dw,
        height: dh,
        transform: `perspective(2400px) rotateX(${rot[0]}deg) rotateY(${rot[1]}deg) rotateZ(${rot[2]}deg) scale(${k})`,
      }}
    >
      {children}
    </div>
  );
};

// ---------------------------------------------------------------- cursor (for UI micro interactions)
export const Cursor: React.FC<{path: [number, number, number][]; clicks?: number[]}> = ({path, clicks = []}) => {
  const t = useT();
  const x = kf(t, path.map(([tt, xx]) => [tt, xx]));
  const y = kf(t, path.map(([tt, , yy]) => [tt, yy]));
  const press = clicks.reduce((m, c) => Math.max(m, t >= c && t < c + 0.18 ? 1 - Math.abs((t - c - 0.09) / 0.09) : 0), 0);
  const ring = clicks.reduce((m, c) => (t >= c && t < c + 0.5 ? Math.max(m, prog(t, c, 0.5)) : m), -1);
  return (
    <div style={{position: 'absolute', left: x, top: y, zIndex: 40, pointerEvents: 'none'}}>
      {ring >= 0 && (
        <div style={{position: 'absolute', left: -34 + 0, top: -34, width: 68, height: 68, borderRadius: 40, border: `3px solid ${C.teal}`, opacity: 1 - ring, transform: `scale(${0.3 + ring})`}} />
      )}
      <svg width="46" height="46" viewBox="0 0 24 24" style={{transform: `scale(${1 - 0.12 * press})`, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.35))'}}>
        <path d="M4 2 L4 19 L8.5 15 L11.5 22 L14.2 20.8 L11.2 14 L17.5 14 Z" fill="#fff" stroke="#0B2A4A" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

// ---------------------------------------------------------------- icons (simple, geometric, brand-consistent)
export const Icon: React.FC<{name: string; size?: number; color?: string; sw?: number}> = ({name, size = 48, color = '#fff', sw = 2.4}) => {
  const p = {fill: 'none', stroke: color, strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const};
  const paths: Record<string, React.ReactNode> = {
    cup: (<><path d="M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" {...p} /><path d="M16 9h2a2.5 2.5 0 0 1 0 5h-2" {...p} /><path d="M8 3c0 1.5 1.5 1.5 1.5 3M12 3c0 1.5 1.5 1.5 1.5 3" {...p} /></>),
    court: (<><rect x="3" y="4" width="18" height="16" rx="1.5" {...p} /><path d="M12 4v16M3 12h18M7 4v16M17 4v16" {...p} strokeWidth={sw * 0.7} /></>),
    hardhat: (<><path d="M4 16a8 8 0 0 1 16 0z" {...p} /><path d="M2.5 16h19v2.5h-19zM12 8v8M9 9.5v6.5M15 9.5v6.5" {...p} /></>),
    doc: (<><path d="M7 3h7l4 4v14H7z" {...p} /><path d="M14 3v4h4M9.5 12h6M9.5 15.5h6" {...p} /></>),
    user: (<><circle cx="12" cy="8" r="3.6" {...p} /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" {...p} /></>),
    lock: (<><rect x="5" y="11" width="14" height="9.5" rx="2" {...p} /><path d="M8 11V8a4 4 0 0 1 8 0v3M12 15v2.2" {...p} /></>),
    check: (<path d="M4.5 12.5l5 5L19.5 7" {...p} />),
    pen: (<><path d="M4 20l1-4L16 5l3 3L8 19z" {...p} /><path d="M14 7l3 3" {...p} /></>),
    chat: (<><path d="M4 5h16v11H11l-4.5 4v-4H4z" {...p} /></>),
    sheet: (<><rect x="3.5" y="4" width="17" height="16" rx="1.5" {...p} /><path d="M3.5 9.5h17M3.5 14.5h17M9.5 4v16" {...p} /></>),
    battery: (<><rect x="3" y="7" width="16" height="10" rx="2" {...p} /><path d="M21 10.5v3" {...p} /></>),
    scan: (<><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16" {...p} /></>),
    merge: (<><path d="M5 5v5a4 4 0 0 0 4 4h6M19 5v5a4 4 0 0 1-4 4M12 14v6M9 17l3 3 3-3" {...p} /></>),
    cal: (<><rect x="3.5" y="5" width="17" height="15" rx="2" {...p} /><path d="M3.5 10h17M8 3v4M16 3v4" {...p} /></>),
    bars: (<><path d="M5 20V10M12 20V4M19 20v-7" {...p} /></>),
    gear: (<><circle cx="12" cy="12" r="3" {...p} /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" {...p} /></>),
    plane: (<><path d="M3 11l18-7-7 18-2.5-7.5z" {...p} /></>),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{display: 'block', overflow: 'visible'}}>
      {paths[name]}
    </svg>
  );
};

export {C, PF, IF, HF, hexPts, kf, pop, prog, easeOut, easeInOut};
