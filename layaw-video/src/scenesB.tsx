import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {
  C, Cursor, Fit, Hex, IF, Icon, LightBg, LogoChip, NavyBg, PF, TitleCard, Win,
  easeInOut, easeOut, hexPts, kf, pop, prog, useLayout, useT,
} from './kit';
import {TM, easeIn, rnd} from './theme';

const artY = (V: boolean, H: number) => (V ? 760 : H / 2 - 20);

// =========================================================================================
// REVEAL  (15.7 - 19.55)  suck-in -> logo reveal on white -> "We make software for real businesses."
// =========================================================================================
const KW: React.FC<{t0: number; size: number; grad?: boolean; style?: React.CSSProperties; children: React.ReactNode}> = ({t0, size, grad, style, children}) => {
  const t = useT();
  const a = pop(t, t0, 200, 15);
  return (
    <span
      style={{
        display: 'inline-block',
        fontFamily: PF,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: -2.5,
        lineHeight: 1.05,
        color: C.navy2,
        opacity: Math.min(1, a * 3),
        transform: `translateY(${(1 - a) * 50}px) scale(${0.88 + 0.12 * a})`,
        marginRight: size * 0.2,
        ...(grad ? {background: `linear-gradient(120deg, ${C.teal} 0%, ${C.teal2} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent'} : {}),
        ...style,
      }}
    >
      {children}
    </span>
  );
};

export const RevealScene: React.FC = () => {
  const t = useT();
  const {W, H, V} = useLayout();
  const cy = artY(V, H);
  // ---- phase 1: chaos is pulled into the centre (15.7 - 16.5)
  const suck = prog(t, 15.7, 0.78, easeIn);
  const frags = Array.from({length: 12}, (_, i) => {
    const ang = rnd(i + 1) * Math.PI * 2;
    const dist = (V ? 650 : 820) * (0.55 + 0.5 * rnd(i + 7));
    const x0 = W / 2 + Math.cos(ang) * dist;
    const y0 = cy + Math.sin(ang) * dist * (V ? 1 : 0.65);
    const spin = (1 - suck) * 0 + suck * 540 * (rnd(i + 3) > 0.5 ? 1 : -1);
    const x = x0 + (W / 2 - x0) * suck;
    const y = y0 + (cy - y0) * suck;
    const ic = ['doc', 'chat', 'sheet', 'doc', 'chat', 'sheet'][i % 6];
    return (
      <div key={i} style={{position: 'absolute', left: x - 55, top: y - 55, transform: `rotate(${spin}deg) scale(${1 - suck * 0.85})`, opacity: 1 - prog(t, 16.3, 0.2)}}>
        <Hex size={110} fill="rgba(255,107,91,0.22)" stroke={C.warn} sw={3}><Icon name={ic} size={52} color="#fff" /></Hex>
      </div>
    );
  });
  // ---- phase 2: white hex flood + logo
  const flood = prog(t, TM.logo - 0.02, 0.55, easeOut);
  const R = flood * 0.62 * Math.hypot(W, H);
  const floodClip = `polygon(${hexPts(W / 2, cy, R).split(' ').map((s) => s.split(',').map((n) => n + 'px').join(' ')).join(', ')})`;
  // logo geometry: centre -> corner at 17.48
  const L0 = V ? 600 : 560;
  const m = prog(t, TM.weMake - 0.05, 0.55, easeInOut);
  const cornerX = V ? 116 : 116;
  const cornerY = V ? 290 : 108;
  const size = L0 + (130 - L0) * m;
  const lx = W / 2 + (cornerX - W / 2) * m;
  const ly = cy - 40 + (cornerY - (cy - 40)) * m;
  const hexR = prog(t, TM.logo, 0.7, easeOut) * L0 * 0.62;
  const logoPop = 0.9 + 0.1 * pop(t, TM.logo, 120, 16);
  const shine = prog(t, 16.95, 0.6, easeInOut);
  const wm = prog(t, 16.82, 0.6, easeOut);
  const wmFade = 1 - prog(t, 17.38, 0.2);
  const ring = prog(t, TM.logo, 0.9, easeOut);
  return (
    <AbsoluteFill>
      <NavyBg glow="c" />
      {frags}
      <AbsoluteFill style={{clipPath: floodClip}}>
        <LightBg />
        {/* expanding ring pulses on the beat */}
        <div style={{position: 'absolute', left: W / 2 - 500 * ring, top: cy - 40 - 500 * ring, width: 1000 * ring, height: 1000 * ring, opacity: (1 - ring) * 0.6}}>
          <svg width={1000 * ring} height={1000 * ring} style={{overflow: 'visible'}}>
            <polygon points={hexPts(500 * ring, 500 * ring, 498 * ring)} fill="none" stroke={C.teal} strokeWidth={6} />
          </svg>
        </div>
        {/* logo with hexagon mask reveal */}
        <div style={{position: 'absolute', left: lx - size / 2, top: ly - size / 2, width: size, height: size, transform: `scale(${logoPop})`}}>
          <div style={{width: size, height: size, clipPath: m > 0 ? 'none' : `polygon(${hexPts(size / 2, size / 2, hexR * (size / L0)).split(' ').map((s) => s.split(',').map((n) => n + 'px').join(' ')).join(', ')})`, position: 'relative'}}>
            <Img src={staticFile('logo.png')} style={{width: size, height: size}} />
            {m === 0 && (
              <div style={{position: 'absolute', inset: 0, background: `linear-gradient(105deg, rgba(255,255,255,0) ${shine * 140 - 40}%, rgba(255,255,255,0.75) ${shine * 140 - 25}%, rgba(255,255,255,0) ${shine * 140 - 10}%)`, mixBlendMode: 'soft-light'}} />
            )}
          </div>
        </div>
        {/* wordmark */}
        <div style={{position: 'absolute', left: 0, right: 0, top: cy - 40 + L0 / 2 + 6, textAlign: 'center', opacity: wm * wmFade, transform: `translateY(${(1 - wm) * 30}px)`}}>
          <span style={{fontFamily: PF, fontWeight: 700, fontSize: V ? 84 : 78, color: C.navy2, letterSpacing: `${(1 - wm) * 0.5 + 0.14}em`, paddingLeft: `${(1 - wm) * 0.5 + 0.14}em`}}>
            LAYAW <span style={{color: C.teal2}}>SYSTEM</span>
          </span>
        </div>
        {/* "We make software for real businesses." */}
        {V ? (
          <div style={{position: 'absolute', left: 0, right: 0, top: cy - 330, padding: '0 60px', textAlign: 'center'}}>
            <div style={{marginBottom: 4}}><KW t0={TM.weMake} size={70} style={{color: C.slate, letterSpacing: 0, fontWeight: 400}}>We make</KW></div>
            <div><KW t0={17.77} size={150}>software</KW></div>
            <div>
              <KW t0={18.29} size={150} style={{marginRight: 34}}>for</KW>
              <KW t0={18.41} size={150} grad>real</KW>
            </div>
            <div><KW t0={18.75} size={150} grad style={{marginRight: 0}}>businesses.</KW></div>
          </div>
        ) : (
          <div style={{position: 'absolute', left: 0, right: 0, top: cy - 250, padding: '0 100px', textAlign: 'center', whiteSpace: 'nowrap'}}>
            <div>
              <KW t0={TM.weMake} size={74} style={{color: C.slate, letterSpacing: 0, fontWeight: 400}}>We make</KW>
              <KW t0={17.77} size={168} style={{marginRight: 0}}>software</KW>
            </div>
            <div>
              <KW t0={18.29} size={168} style={{marginRight: 40}}>for</KW>
              <KW t0={18.41} size={168} grad style={{marginRight: 40}}>real</KW>
              <KW t0={18.75} size={168} grad style={{marginRight: 0}}>businesses.</KW>
            </div>
          </div>
        )}
        {/* four business tiles */}
        <div style={{position: 'absolute', left: 0, right: 0, top: V ? cy + 320 : cy + 170, display: 'flex', justifyContent: 'center', gap: V ? 22 : 36}}>
          {['cup', 'court', 'hardhat', 'doc'].map((n, i) => {
            const a = pop(t, 18.55 + i * 0.12, 190, 14);
            return (
              <div key={n} style={{transform: `scale(${a})`}}>
                <Hex size={V ? 170 : 150} fill={C.navy2} stroke={C.teal} sw={4}><Icon name={n} size={V ? 76 : 66} color="#fff" /></Hex>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// =========================================================================================
// Product scene wrapper
// =========================================================================================
const ProductFrame: React.FC<{start: number; name: string; sub: string; children: React.ReactNode; tilt?: number; chips?: string[]}> = ({start, name, sub, children, tilt = 1, chips = []}) => {
  const t = useT();
  const {W, H, V} = useLayout();
  const drift = prog(t, start, 2.2, (x) => x);
  const a = pop(t, start + 0.05, 120, 17);
  return (
    <AbsoluteFill>
      <NavyBg glow={V ? 'c' : 'br'} />
      {/* floating hexes (parallax) */}
      {Array.from({length: 6}, (_, i) => (
        <div key={i} style={{position: 'absolute', left: `${10 + i * 16}%`, top: `${(i % 2 ? 78 : 12) + Math.sin(t * 1.4 + i) * 2}%`, opacity: 0.18}}>
          <Hex size={60 + (i % 3) * 40} stroke={C.cyan} sw={2} />
        </div>
      ))}
      <Fit dw={1280} dh={760} cy={V ? 830 : H / 2 + 20} maxW={V ? W * 1.0 : W * 0.8} maxH={V ? H * 0.5 : H * 0.68} rot={[(4 - 3 * drift) * tilt, (-9 + 6 * drift) * tilt, 0]} scaleBoost={0.9 + 0.06 * a + 0.03 * drift}>
        <div style={{opacity: Math.min(1, a * 2), transform: `translateY(${(1 - a) * 80}px)`}}>{children}</div>
      </Fit>
      {V && (
        <div style={{position: 'absolute', left: 0, right: 0, top: 1150, display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', padding: '0 40px'}}>
          {chips.map((c, i) => {
            const a = pop(t, start + 0.45 + i * 0.16, 200, 15);
            return (
              <div key={c} style={{padding: '12px 28px', borderRadius: 30, background: 'rgba(10,163,176,0.22)', border: `2px solid ${C.cyan}`, color: '#fff', fontFamily: PF, fontWeight: 700, fontSize: 34, transform: `scale(${a})`, opacity: Math.min(1, a * 2)}}>{c}</div>
            );
          })}
        </div>
      )}
      <LogoChip />
      <TitleCard start={start} name={name} sub={sub} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------- POS
const posItems = [['Spanish Latte', 'SL', '#0AA3B0'], ['Ube Latte', 'UL', '#7a5bd6'], ['Cappuccino', 'CP', '#c27a43'], ['Ensaymada', 'EN', '#e0a21e'], ['Pandesal', 'PD', '#d4793d'], ['Cheesecake', 'CC', '#c2437b']];
const posLines: [string, number][] = [['Spanish Latte', 19.9], ['Ensaymada', 20.22], ['Ube Latte', 20.5]];

export const POSScene: React.FC = () => {
  const t = useT();
  const paid = pop(t, 21.12, 200, 14);
  const bars = prog(t, 21.2, 0.35, easeOut);
  return (
    <ProductFrame start={TM.pos} name="POS" sub="Sales · Orders · Inventory · Daily reports" chips={['Table select', 'Discounts', 'Daily sales']}>
      <Win w={1280} h={760} title="LAYAW POS — Café Sugbo">
        <div style={{position: 'absolute', inset: 0, display: 'flex', fontFamily: IF}}>
          <div style={{width: 880, padding: 32}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22}}>
              <div style={{fontWeight: 700, fontSize: 30, color: C.navy2, marginRight: 40}}>Menu</div>
              {['Coffee', 'Pastry', 'Cold drinks'].map((c, i) => (
                <div key={c} style={{padding: '9px 22px', borderRadius: 22, fontWeight: 500, fontSize: 20, background: i === 0 ? C.navy2 : '#EEF3F6', color: i === 0 ? '#fff' : C.slate}}>{c}</div>
              ))}
            </div>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: 16}}>
              {posItems.map(([n, ini, col], idx) => {
                const hit = posLines.find(([ln]) => ln === n);
                const k = hit ? Math.max(0, 1 - Math.abs((t - hit[1] - 0.1) / 0.2)) : 0;
                return (
                  <div key={n} style={{width: 262, height: 168, borderRadius: 20, border: `2px solid ${k > 0 ? C.teal : '#E3EBF0'}`, background: k > 0 ? 'rgba(10,163,176,0.08)' : '#fff', padding: 20, transform: `scale(${1 - 0.05 * k})`, boxShadow: '0 6px 18px rgba(11,42,74,0.07)'}}>
                    <div style={{width: 62, height: 62, borderRadius: 18, background: col, color: '#fff', fontWeight: 700, fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{ini}</div>
                    <div style={{marginTop: 18, fontWeight: 700, fontSize: 24, color: C.navy2}}>{n}</div>
                  </div>
                );
              })}
            </div>
            {/* daily sales */}
            <div style={{marginTop: 22, display: 'flex', alignItems: 'flex-end', gap: 12, height: 120}}>
              <div style={{fontWeight: 700, fontSize: 20, color: C.slate, width: 120, alignSelf: 'flex-start', paddingTop: 4}}>Daily sales</div>
              {[0.35, 0.5, 0.42, 0.66, 0.58, 0.8, 0.95].map((h, i) => (
                <div key={i} style={{width: 46, height: 110 * h * bars, borderRadius: 10, background: i === 6 ? C.teal : '#CFE3EA'}} />
              ))}
            </div>
          </div>
          <div style={{width: 400, background: '#F5F9FB', borderLeft: '1px solid #E3EBF0', padding: 28, position: 'relative'}}>
            <div style={{fontWeight: 700, fontSize: 26, color: C.navy2}}>Current order</div>
            <div style={{display: 'flex', gap: 8, marginTop: 14}}>
              {['T1', 'T2', 'T3', 'T4', 'T5', 'T6'].map((tb, i) => {
                const sel = i === 3 && t > 20.82;
                return (
                  <div key={tb} style={{width: 48, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, background: sel ? C.teal : '#fff', color: sel ? '#fff' : C.slate, border: '1px solid #DCE6EC'}}>{tb}</div>
                );
              })}
            </div>
            <div style={{marginTop: 22}}>
              {posLines.map(([n, tt], i) => {
                const a = pop(t, tt, 220, 16);
                return (
                  <div key={n} style={{display: 'flex', alignItems: 'center', height: 68, opacity: Math.min(1, a * 2), transform: `translateX(${(1 - a) * 50}px)`, borderBottom: '1px solid #E3EBF0'}}>
                    <div style={{width: 34, height: 34, borderRadius: 10, background: C.navy2, color: '#fff', fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>1</div>
                    <div style={{marginLeft: 14, fontWeight: 500, fontSize: 22, color: C.navy2, flex: 1}}>{n}</div>
                    <div style={{width: 62, height: 12, borderRadius: 6, background: '#CFE3EA'}} />
                  </div>
                );
              })}
            </div>
            <div style={{display: 'flex', gap: 10, marginTop: 20}}>
              {['Discount', 'Dine-in'].map((c) => (
                <div key={c} style={{padding: '8px 18px', borderRadius: 18, background: '#fff', border: '1px solid #DCE6EC', fontWeight: 500, fontSize: 18, color: C.slate}}>{c}</div>
              ))}
            </div>
            <div style={{position: 'absolute', left: 28, right: 28, bottom: 28}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14}}>
                <div style={{fontWeight: 700, fontSize: 24, color: C.navy2}}>Total</div>
                <div style={{width: 120, height: 18, borderRadius: 9, background: '#BBD3DC'}} />
              </div>
              <div style={{height: 70, borderRadius: 18, background: paid > 0.05 ? '#14B87A' : C.teal, color: '#fff', fontWeight: 700, fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, transform: `scale(${1 + 0.04 * Math.sin(Math.min(1, paid) * Math.PI)})`}}>
                {paid > 0.05 ? (<><Icon name="check" size={34} color="#fff" sw={3.2} />Paid</>) : 'Charge'}
              </div>
              {t > 21.12 && t < 21.55 && Array.from({length: 7}, (_, i) => {
                const a = prog(t, 21.12, 0.4);
                const ang = (-90 + (i - 3) * 28) * (Math.PI / 180);
                return (
                  <div key={i} style={{position: 'absolute', left: 150 + Math.cos(ang) * 150 * a, top: 20 + Math.sin(ang) * 150 * a, opacity: 1 - a}}>
                    <Hex size={26} fill={C.cyan} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <Cursor
          path={[[19.55, 760, 360], [19.88, 163, 247], [20.12, 163, 247], [20.2, 163, 453], [20.44, 163, 453], [20.5, 441, 247], [20.7, 441, 247], [20.82, 1110, 168], [21.0, 1110, 168], [21.1, 1080, 682], [21.5, 1130, 740]]}
          clicks={[19.9, 20.22, 20.5, 20.82, 21.12]}
        />
      </Win>
    </ProductFrame>
  );
};

// ---------------------------------------------------------------------------- Booking
export const BookingScene: React.FC = () => {
  const t = useT();
  const selDay = t > 21.88;
  const selSlot = t > 22.22;
  const selCourt = t > 22.52;
  const booked = pop(t, 23.0, 200, 14);
  const days: (number | null)[] = [null, null, null, null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31];
  const slots = ['3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM'];
  return (
    <ProductFrame start={TM.booking} name="Booking System" sub="Calendar · Time slots · Courts & rentals" chips={['Calendar', 'Time slots', 'Courts & rentals']}>
      <Win w={1280} h={760} title="LAYAW Booking System">
        <div style={{position: 'absolute', inset: 0, fontFamily: IF, display: 'flex'}}>
          <div style={{width: 520, padding: '28px 32px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
              <div style={{fontWeight: 700, fontSize: 30, color: C.navy2}}>October 2026</div>
              <Icon name="cal" size={34} color={C.teal2} />
            </div>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(7, 66px)', gap: 8}}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} style={{textAlign: 'center', fontWeight: 700, fontSize: 18, color: i === 6 ? C.teal2 : C.slate, height: 36}}>{d}</div>
              ))}
              {days.map((d, i) => {
                const sat = i % 7 === 6;
                const sel = d === 17 && selDay;
                return (
                  <div key={i} style={{height: 66, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: sel ? 700 : 500, fontSize: 24, color: sel ? '#fff' : d ? C.navy2 : 'transparent', background: sel ? C.teal : sat && d ? 'rgba(10,163,176,0.10)' : '#F3F7F9', transform: sel ? `scale(${1 + 0.1 * Math.max(0, 1 - (t - 21.88) * 5)})` : 'none'}}>
                    {d}
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{width: 360, padding: '28px 12px', borderLeft: '1px solid #E8EFF3'}}>
            <div style={{fontWeight: 700, fontSize: 26, color: C.navy2, margin: '0 14px 18px'}}>Pick a time</div>
            {slots.map((s, i) => {
              const taken = i === 0 || i === 3;
              const sel = i === 1 && selSlot;
              const a = pop(t, TM.booking + 0.2 + i * 0.07, 200, 16);
              return (
                <div key={s} style={{margin: '0 14px 14px', height: 66, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', fontWeight: 700, fontSize: 24, background: sel ? C.navy2 : taken ? '#F3F7F9' : '#fff', color: sel ? '#fff' : taken ? '#A9BAC6' : C.navy2, border: `2px solid ${sel ? C.navy2 : '#E3EBF0'}`, textDecoration: taken ? 'line-through' : 'none', opacity: a, transform: `translateX(${(1 - a) * 30}px)`}}>
                  {s}
                  {taken && <span style={{fontSize: 16, fontWeight: 500, textDecoration: 'none'}}>Taken</span>}
                </div>
              );
            })}
          </div>
          <div style={{width: 400, padding: '28px 28px', background: '#F5F9FB', borderLeft: '1px solid #E8EFF3', position: 'relative'}}>
            <div style={{fontWeight: 700, fontSize: 26, color: C.navy2, marginBottom: 18}}>Choose court</div>
            {['Court 1', 'Court 2', 'Court 3'].map((c, i) => {
              const taken = i === 0;
              const sel = i === 1 && selCourt;
              return (
                <div key={c} style={{height: 72, marginBottom: 14, borderRadius: 18, display: 'flex', alignItems: 'center', padding: '0 22px', gap: 16, background: sel ? 'rgba(10,163,176,0.14)' : '#fff', border: `2px solid ${sel ? C.teal : '#E3EBF0'}`, opacity: taken ? 0.5 : 1}}>
                  <Icon name="court" size={36} color={sel ? C.teal2 : C.slate} />
                  <div style={{fontWeight: 700, fontSize: 24, color: C.navy2, flex: 1}}>{c}</div>
                  {sel && <Icon name="check" size={30} color={C.teal2} sw={3} />}
                </div>
              );
            })}
            <div style={{position: 'absolute', left: 28, right: 28, bottom: 28, height: 70, borderRadius: 18, background: C.teal, color: '#fff', fontWeight: 700, fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: selCourt ? 1 : 0.5}}>Book now</div>
          </div>
          {/* confirmation */}
          {booked > 0 && (
            <div style={{position: 'absolute', inset: 0, background: `rgba(4,38,74,${0.55 * Math.min(1, booked)})`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <div style={{width: 640, borderRadius: 32, background: '#fff', padding: '40px 44px', textAlign: 'center', transform: `scale(${0.7 + 0.3 * booked})`, opacity: Math.min(1, booked * 2), boxShadow: '0 40px 100px rgba(0,0,0,0.4)'}}>
                <div style={{display: 'flex', justifyContent: 'center'}}>
                  <Hex size={130} fill="#14B87A"><Icon name="check" size={66} color="#fff" sw={3.4} /></Hex>
                </div>
                <div style={{fontWeight: 700, fontSize: 44, color: C.navy2, marginTop: 20}}>Booked!</div>
                <div style={{fontWeight: 500, fontSize: 28, color: C.slate, marginTop: 8}}>Saturday · 4:00 PM · Court 2</div>
              </div>
            </div>
          )}
        </div>
        <Cursor
          path={[[21.54, 700, 640], [21.86, 461, 400], [22.1, 461, 400], [22.2, 720, 294], [22.42, 720, 294], [22.5, 1100, 304], [22.72, 1100, 304], [22.84, 1100, 692], [23.3, 1180, 720]]}
          clicks={[21.88, 22.22, 22.52, 22.86]}
        />
      </Win>
    </ProductFrame>
  );
};

// ---------------------------------------------------------------------------- Project manager
export const PMScene: React.FC = () => {
  const t = useT();
  const {V} = useLayout();
  const mods = ['BOQ', 'Budget', 'Gantt', 'Procurement', 'Warehouse', 'DTR & Labor', 'Billing', 'Accounting'];
  const tasks = [['Site clearing', 0, 1.6], ['Foundation', 1, 2.4], ['Rebar works', 2.5, 2.2], ['Concrete pouring', 3.5, 2.2], ['Masonry', 5, 2.2], ['Roofing', 6.4, 1.6]] as [string, number, number][];
  const colW = 100;
  const today = kf(t, [[24.6, 0.2], [25.5, 4.4]]);
  const activeMod = Math.floor(kf(t, [[23.85, 0], [25.4, 7.99]], (x) => x));
  return (
    <ProductFrame start={TM.pm} name="Project Manager" sub="For construction · BOQ · Budgets · Gantt · Billing" chips={['BOQ', 'Gantt', 'Billing', 'Payroll']}>
      <Win w={1280} h={760} title="LAYAW Project Manager">
        <div style={{position: 'absolute', inset: 0, display: 'flex', fontFamily: IF}}>
          <div style={{width: 230, background: C.navy2, padding: '22px 16px'}}>
            {mods.map((m, i) => (
              <div key={m} style={{height: 54, borderRadius: 14, marginBottom: 6, display: 'flex', alignItems: 'center', padding: '0 18px', fontWeight: i === activeMod ? 700 : 500, fontSize: 21, color: i === activeMod ? '#fff' : 'rgba(255,255,255,0.6)', background: i === activeMod ? C.teal : 'transparent'}}>{m}</div>
            ))}
          </div>
          <div style={{flex: 1, padding: '22px 28px'}}>
            <div style={{display: 'flex', gap: 18, marginBottom: 22}}>
              {[['Budget', 0.72], ['Progress', 0.55], ['Billing', 0.4]].map(([n, v], i) => {
                const a = prog(t, 24.0 + i * 0.12, 0.6);
                return (
                  <div key={n as string} style={{flex: 1, height: 112, borderRadius: 18, background: '#F3F7F9', padding: '16px 20px'}}>
                    <div style={{fontWeight: 700, fontSize: 20, color: C.slate}}>{n}</div>
                    <div style={{height: 16, borderRadius: 8, background: '#DCE8EE', marginTop: 20, overflow: 'hidden'}}>
                      <div style={{height: '100%', width: `${(v as number) * 100 * a}%`, background: i === 1 ? C.teal : C.navy2, borderRadius: 8}} />
                    </div>
                    <div style={{height: 10, width: '40%', borderRadius: 5, background: '#C9D9E1', marginTop: 14}} />
                  </div>
                );
              })}
            </div>
            <div style={{position: 'relative', borderRadius: 18, border: '1px solid #E3EBF0', overflow: 'hidden', height: 470}}>
              <div style={{display: 'flex', height: 46, background: '#F3F7F9', borderBottom: '1px solid #E3EBF0'}}>
                <div style={{width: 210, padding: '0 18px', display: 'flex', alignItems: 'center', fontWeight: 700, fontSize: 19, color: C.slate}}>Tasks</div>
                {Array.from({length: 8}, (_, i) => (
                  <div key={i} style={{width: colW, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 500, fontSize: 18, color: C.slate, borderLeft: '1px solid #E3EBF0'}}>Wk {i + 1}</div>
                ))}
              </div>
              {tasks.map(([n, s, len], i) => {
                const a = prog(t, 23.98 + i * 0.16, 0.5);
                return (
                  <div key={n} style={{display: 'flex', height: 68, borderBottom: '1px solid #EEF3F6', alignItems: 'center'}}>
                    <div style={{width: 210, padding: '0 18px', fontWeight: 500, fontSize: 20, color: C.navy2}}>{n}</div>
                    <div style={{position: 'relative', width: colW * 8, height: 68}}>
                      <div style={{position: 'absolute', left: s * colW, top: 18, width: len * colW * a, height: 32, borderRadius: 10, background: '#BFE4E8', overflow: 'hidden'}}>
                        <div style={{width: `${Math.max(0, Math.min(1, (today - s) / len)) * 100}%`, height: '100%', background: i % 2 ? C.teal2 : C.teal}} />
                      </div>
                    </div>
                  </div>
                );
              })}
              <div style={{position: 'absolute', top: 46, bottom: 0, left: 210 + today * colW, width: 3, background: C.warn, opacity: prog(t, 24.5, 0.2)}}>
                <div style={{position: 'absolute', top: -2, left: -22, padding: '3px 10px', borderRadius: 8, background: C.warn, color: '#fff', fontWeight: 700, fontSize: 14}}>Today</div>
              </div>
            </div>
          </div>
        </div>
      </Win>
    </ProductFrame>
  );
};

// ---------------------------------------------------------------------------- PDF
export const PDFScene: React.FC = () => {
  const t = useT();
  const stack = prog(t, TM.pdf + 1.7, 0.55, easeInOut);
  const hl = prog(t, 25.95, 0.45);
  const sig = prog(t, 26.5, 0.8, (x) => x);
  const scan = prog(t, 27.75, 0.7, (x) => x);
  const page = (i: number, dx: number, rot: number, z: number) => (
    <div key={i} style={{position: 'absolute', left: 420 + dx, top: 28 + Math.abs(dx) * 0.05, width: 460, height: 620, background: '#fff', borderRadius: 10, boxShadow: '0 20px 50px rgba(11,42,74,0.25)', transform: `rotate(${rot}deg)`, zIndex: z, border: '1px solid #E3EBF0'}}>
      {Array.from({length: 9}, (_, k) => <div key={k} style={{position: 'absolute', left: 36, top: 60 + k * 34, height: 10, borderRadius: 5, background: '#DCE6EC', width: `${50 + 40 * rnd(i * 5 + k)}%`}} />)}
    </div>
  );
  return (
    <ProductFrame start={TM.pdf} name="PDF Pro" sub="Edit · Sign · OCR · Merge · Offline" chips={['E-sign', 'OCR', 'Merge & split', 'Offline']}>
      <Win w={1280} h={760} title="LAYAW PDF Pro — Service_Agreement.pdf">
        <div style={{position: 'absolute', inset: 0, display: 'flex', fontFamily: IF, background: '#EDF2F5'}}>
          <div style={{width: 96, background: C.navy2, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 26, gap: 26}}>
            {['pen', 'doc', 'scan', 'merge', 'lock'].map((n, i) => {
              const act = (i === 0 && t > 25.9) || (i === 1 && t > 26.45) || (i === 2 && t > 27.7) || (i === 3 && t > 27.4 && t < 27.7) || (i === 4 && t > 28.15);
              return (
                <div key={n} style={{width: 62, height: 62, borderRadius: 18, background: act ? C.teal : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <Icon name={n} size={34} color="#fff" />
                </div>
              );
            })}
          </div>
          <div style={{position: 'relative', flex: 1}}>
            {/* documents fanning out behind */}
            {stack > 0 && page(1, -170 * stack, -8 * stack, 1)}
            {stack > 0 && page(2, 110 * stack, 7 * stack, 1)}
            {stack > 0 && page(3, 230 * stack, 12 * stack, 0)}
            <div style={{position: 'absolute', left: 420 - 90 * stack - 120 * stack, top: 28, width: 460, height: 620, background: '#fff', borderRadius: 10, boxShadow: '0 20px 60px rgba(11,42,74,0.3)', zIndex: 3, border: '1px solid #E3EBF0', overflow: 'hidden', transform: `scale(${1 - 0.05 * stack}) translateY(${(1 - pop(t, TM.pdf + 0.05, 150, 16)) * 120}px)`}}>
              <div style={{position: 'absolute', left: 36, top: 36, fontWeight: 700, fontSize: 30, color: C.navy2}}>Service Agreement</div>
              {Array.from({length: 9}, (_, k) => (
                <div key={k} style={{position: 'absolute', left: 36, top: 100 + k * 34, height: 11, borderRadius: 6, background: scan > 0 && 100 + k * 34 < 20 + scan * 620 ? '#1F3B57' : '#CBD8E0', width: `${58 + 36 * rnd(k + 4)}%`}} />
              ))}
              {/* highlight */}
              <div style={{position: 'absolute', left: 30, top: 100 + 2 * 34 - 7, height: 28, width: 330 * hl, background: 'rgba(45,224,236,0.45)', borderRadius: 4}} />
              {/* annotation note */}
              <div style={{position: 'absolute', right: 26, top: 190, padding: '8px 14px', borderRadius: 10, background: '#FFD966', fontWeight: 700, fontSize: 17, color: '#5b4a10', transform: `scale(${pop(t, 26.25, 220, 14)}) rotate(4deg)`, boxShadow: '0 8px 18px rgba(0,0,0,0.2)'}}>Review</div>
              {/* signature */}
              <div style={{position: 'absolute', left: 36, bottom: 74, width: 260, height: 3, background: '#9FB2BF'}} />
              <svg width="300" height="100" viewBox="0 0 260 90" style={{position: 'absolute', left: 36, bottom: 62, overflow: 'visible'}}>
                <path d="M4 60 C 20 6, 34 90, 52 36 S 84 8, 96 52 S 126 82, 146 30 S 180 14, 208 56 L 252 48" fill="none" stroke={C.teal2} strokeWidth="5" strokeLinecap="round" strokeDasharray={600} strokeDashoffset={600 * (1 - sig)} />
              </svg>
              <div style={{position: 'absolute', left: 36, bottom: 40, fontWeight: 500, fontSize: 15, color: C.slate}}>e-Signature</div>
              {/* OCR scan line */}
              {scan > 0 && scan < 1 && <div style={{position: 'absolute', left: 0, right: 0, top: 20 + scan * 620, height: 5, background: C.cyan, boxShadow: `0 0 24px 8px ${C.cyan}`}} />}
            </div>
            {/* feature chips */}
            <div style={{position: 'absolute', right: 26, top: 60, display: 'flex', flexDirection: 'column', gap: 14, zIndex: 6}}>
              {[['Merge', 27.45], ['Split', 27.58], ['Compress', 27.71], ['OCR', 27.9], ['Password', 28.15], ['Offline', 28.3]].map(([n, t0]) => {
                const a = pop(t, t0 as number, 200, 15);
                return (
                  <div key={n as string} style={{padding: '10px 22px', borderRadius: 20, background: C.navy2, color: '#fff', fontWeight: 700, fontSize: 22, opacity: Math.min(1, a * 2), transform: `translateX(${(1 - a) * 90}px)`, boxShadow: '0 10px 24px rgba(0,0,0,0.25)'}}>
                    <span style={{color: C.cyan, marginRight: 8}}>●</span>{n}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Win>
    </ProductFrame>
  );
};
