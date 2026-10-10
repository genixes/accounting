import {Easing, interpolate, spring} from 'remotion';

export const FPS = 30;
export const DURATION_SEC = 39.13;
export const DURATION_FRAMES = Math.ceil(DURATION_SEC * FPS); // 1174 frames = 39.133 s

export const C = {
  navy0: '#031C38',
  navy: '#04264A',
  navy2: '#0B2A4A',
  navy3: '#0E3A66',
  teal: '#0AA3B0',
  teal2: '#00798C',
  cyan: '#2DE0EC',
  white: '#FFFFFF',
  mist: '#EAF4F7',
  mist2: '#D6E9EE',
  ink: '#0B2A4A',
  slate: '#5B7388',
  warn: '#FF6B5B',
  paper: '#F6EFDD',
};

export const PF = "'Poppins', sans-serif"; // headlines (700) + support (400)
export const IF = "'Inter', sans-serif"; // UI mockups (500 + 700)
export const HF = "'Caveat', cursive"; // handwriting for the paper-notebook problem scenes

export const GRAD_NAVY = `linear-gradient(135deg, ${C.navy0} 0%, ${C.navy2} 55%, #0A3F63 100%)`;
export const GRAD_TEAL = `linear-gradient(135deg, ${C.teal} 0%, ${C.teal2} 100%)`;

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
export const easeIn = Easing.bezier(0.5, 0, 0.9, 0.4);

/** clamped 0..1 progress of t between t0 and t0+dur */
export const prog = (t: number, t0: number, dur: number, e: (n: number) => number = easeOut) =>
  interpolate(t, [t0, t0 + dur], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: e});

/** spring (0 -> 1 with slight overshoot) starting at t0 seconds */
export const pop = (t: number, t0: number, stiffness = 170, damping = 14) =>
  t < t0 ? 0 : spring({frame: (t - t0) * FPS, fps: FPS, config: {stiffness, damping, mass: 0.7}});

/** keyframe interpolation: [[t, v], ...] with easing between */
export const kf = (t: number, pts: [number, number][], e: (n: number) => number = easeInOut) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) {
      const [a, va] = pts[i - 1];
      const [b, vb] = pts[i];
      return va + (vb - va) * e((t - a) / (b - a));
    }
  }
  return pts[pts.length - 1][1];
};

export const hexPts = (cx: number, cy: number, r: number) =>
  Array.from({length: 6}, (_, k) => {
    const a = ((-90 + 60 * k) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

// deterministic pseudo random
export const rnd = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
};

// ---------------------------------------------------------------------------------------
// Narration timing (seconds) taken from the analysed voice over. Every cut lands on these.
// ---------------------------------------------------------------------------------------
export const TM = {
  hook: 0.0,
  court: 1.4,
  saturday: 2.21,
  notebookScene: 3.0,
  notebookWord: 3.98,
  missingScene: 4.7,
  missingWord: 5.89,
  familiar: 6.47,
  alone: 7.69,
  pain: 8.66,
  paper: 10.28,
  chats: 10.9,
  sheet: 11.98,
  oneperson: 12.75,
  exhausting: 14.54,
  suckIn: 15.7,
  logo: 16.5,
  weMake: 17.48,
  pos: 19.55,
  booking: 21.54,
  pm: 23.78,
  pdf: 25.65,
  differently: 28.65,
  fine: 30.08,
  tellUs: 30.79,
  build: 32.1,
  simple: 33.65,
  smart: 34.24,
  solid: 34.79,
  cta: 35.38,
  url: 36.62,
  end: 39.13,
};
