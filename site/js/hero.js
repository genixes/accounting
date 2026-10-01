// Hero monogram. The official L+S mark, extruded from a vector trace of the
// original artwork so its proportions, interlock and spacing stay exact.
import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/addons/RoomEnvironment.js';
import { PATH_L, PATH_S, VIEWBOX } from './monogram-paths.js';

const CENTER = { x: 505, y: 490 };  // optical centre of the mark in trace space
const UNIT = 1 / 260;               // trace units → scene units

// Minimal parser for the potrace output (absolute M, L, C only).
function toShapes(d) {
  const sp = new THREE.ShapePath();
  const tok = d.match(/[MLC]|-?\d*\.?\d+/g);
  let cmd = null;
  const P = (i) => [ (+tok[i] - CENTER.x) * UNIT, -(+tok[i + 1] - CENTER.y) * UNIT ];
  for (let i = 0; i < tok.length;) {
    if (/[MLC]/.test(tok[i])) { cmd = tok[i++]; continue; }
    if (cmd === 'M') { sp.moveTo(...P(i)); i += 2; cmd = 'L'; }
    else if (cmd === 'L') { sp.lineTo(...P(i)); i += 2; }
    else if (cmd === 'C') { sp.bezierCurveTo(...P(i), ...P(i + 2), ...P(i + 4)); i += 6; }
    else i++;
  }
  return sp.toShapes(false);
}

// Bake the brand gradient into vertex colours (top-left light, bottom-right deep).
function paintGradient(geo, from, to, angle = .35) {
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox;
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const a = new THREE.Color(from).convertSRGBToLinear();
  const b = new THREE.Color(to).convertSRGBToLinear();
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const ty = (max.y - pos.getY(i)) / (max.y - min.y);
    const tx = (pos.getX(i) - min.x) / (max.x - min.x);
    c.copy(a).lerp(b, THREE.MathUtils.clamp(ty * (1 - angle) + tx * angle, 0, 1));
    cols.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
}

export function createMonogram(canvas, opts = {}) {
  const { reduced = false, lite = false, onLock = () => {}, onFirstFrame = () => {} } = opts;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lite, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1.25 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, 0, 10.5);

  // Geometry
  const extrude = {
    depth: 0.32, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.022,
    bevelSegments: lite ? 2 : 5, curveSegments: lite ? 6 : 14,
  };
  const geoL = new THREE.ExtrudeGeometry(toShapes(PATH_L), extrude);
  const geoS = new THREE.ExtrudeGeometry(toShapes(PATH_S), extrude);
  geoL.translate(0, 0, -extrude.depth / 2);
  geoS.translate(0, 0, -extrude.depth / 2);
  // Brand gradients, sampled from the original file.
  paintGradient(geoL, '#08A9B8', '#01607A');
  paintGradient(geoS, '#0C4C8A', '#03305C', .5);

  // L: brushed teal metal. S: deep navy lacquer with a clear coat so its
  // bevels catch the teal key light against the night background.
  const matL = new THREE.MeshPhysicalMaterial({
    vertexColors: true, metalness: 0.6, roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.2,
    envMapIntensity: 1.15,
  });
  const matS = new THREE.MeshPhysicalMaterial({
    vertexColors: true, metalness: 0.35, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.1,
    envMapIntensity: 0.9,
  });

  const L = new THREE.Mesh(geoL, matL);
  const S = new THREE.Mesh(geoS, matS);
  const mark = new THREE.Group();
  mark.add(L, S);
  const rig = new THREE.Group();
  rig.add(mark);
  scene.add(rig);

  // Light: teal key from the left, ice rim from behind right, soft top fill.
  const key = new THREE.DirectionalLight('#08DBDE', 2.4); key.position.set(-4, 2.5, 5);
  const rim = new THREE.DirectionalLight('#9EC2CD', 3.2); rim.position.set(5, 3, -4);
  const fill = new THREE.DirectionalLight('#ffffff', 0.6); fill.position.set(0, 6, 3);
  const under = new THREE.PointLight('#0B97A6', 6, 12, 2); under.position.set(1, -3.5, 2);
  scene.add(key, rim, fill, under);

  // ---------- State ----------
  const state = {
    assemble: reduced ? 1 : 0,   // 0 apart → 1 locked
    scroll: 0,                   // 0..1 across the hero
    px: 0, py: 0,                // pointer target
    rx: 0, ry: 0,                // smoothed rotation
    running: false, raf: 0, t0: performance.now(), locked: reduced,
  };

  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Keep the mark the same visual size whatever the frame shape.
    const fit = 4.2;
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const distH = fit / 2 / Math.tan(vfov / 2);
    const distW = fit / 2 / Math.tan(vfov / 2) / camera.aspect;
    camera.position.z = Math.max(distH, distW) * 1.06;
    camera.updateProjectionMatrix();
  }

  const ease = (t) => 1 - Math.pow(1 - t, 4);
  let lastAssembly = -1;

  function frame(now) {
    const t = (now - state.t0) / 1000;

    if (!reduced && state.assemble < 1) {
      state.assemble = Math.min(1, Math.max(0, (t - 0.35) / 1.9));
    }
    const a = ease(state.assemble);
    const pct = Math.round(a * 100);
    if (pct !== lastAssembly) { lastAssembly = pct; onLock(pct, pct >= 100); }

    // Assembly: the two parts slide along their own diagonal and seat.
    const apart = 1 - a;
    L.position.set(-0.9 * apart, -0.35 * apart, 0.9 * apart);
    S.position.set(0.9 * apart, 0.45 * apart, -0.9 * apart);
    L.rotation.y = -0.5 * apart;
    S.rotation.y = 0.5 * apart;

    // Scroll: the machine opens slightly and turns away as you leave.
    const s = state.scroll;
    const open = Math.sin(Math.min(s, 1) * Math.PI) * 0.35 + s * 0.15;
    L.position.z += open;
    S.position.z -= open * 0.6;

    // Pointer and idle drift
    const idle = reduced ? 0 : Math.sin(t * 0.32) * 0.07;
    state.rx += (state.py * 0.16 - state.rx) * 0.05;
    state.ry += (state.px * 0.3 - state.ry) * 0.05;
    rig.rotation.x = state.rx + s * 0.25;
    rig.rotation.y = state.ry + idle - 0.18 + s * 0.9;
    rig.position.y = s * 0.6;

    key.position.x = -4 + state.px * 2;

    renderer.render(scene, camera);
    if (!state.first) { state.first = true; onFirstFrame(); }
    if (state.running) state.raf = requestAnimationFrame(frame);
  }

  function start() {
    if (state.running || reduced) return;
    state.running = true;
    state.raf = requestAnimationFrame(frame);
  }
  function stop() {
    state.running = false;
    cancelAnimationFrame(state.raf);
  }
  function renderOnce() { requestAnimationFrame(frame); }

  // Pointer (desktop only; touch keeps the page scrolling freely)
  const onPointer = (e) => {
    if (e.pointerType === 'touch') return;
    state.px = (e.clientX / window.innerWidth) * 2 - 1;
    state.py = (e.clientY / window.innerHeight) * 2 - 1;
  };
  if (!reduced) window.addEventListener('pointermove', onPointer, { passive: true });

  // Only render while visible
  let inView = true;
  const io = new IntersectionObserver(([en]) => {
    inView = en.isIntersecting;
    inView && !document.hidden ? start() : stop();
  }, { rootMargin: '80px' });
  io.observe(canvas);
  const onVis = () => (document.hidden || !inView ? stop() : start());
  document.addEventListener('visibilitychange', onVis);

  const ro = new ResizeObserver(() => { resize(); if (!state.running) renderOnce(); });
  ro.observe(canvas);
  resize();
  if (reduced) renderOnce(); else start();

  return {
    setScroll(p) { state.scroll = p; if (reduced) renderOnce(); },
    // Used only by the poster/OG capture script.
    pose({ px = 0, py = 0, scroll = 0 } = {}) { state.assemble = 1; state.px = px; state.py = py; state.rx = py * .16; state.ry = px * .3; state.scroll = scroll; },
    destroy() {
      stop(); io.disconnect(); ro.disconnect();
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVis);
      renderer.dispose();
    },
  };
}

export { VIEWBOX };
