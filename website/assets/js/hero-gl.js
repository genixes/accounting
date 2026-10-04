/* =====================================================================
   LAYAW SYSTEM: hero monogram in WebGL
   The LS mark is extruded from the same vector trace as mark.svg.
   It assembles on load, leans toward the cursor, and opens into an
   exploded view as the visitor scrolls, like an engineering drawing.
   Loaded only when main.js decides the device can carry it.
   ===================================================================== */
import * as THREE from '../vendor/three.module.min.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';

// Vector trace of the monogram (1000 x 1000 artboard, same as mark.svg)
const PIECES = {
  L:  [[157,268],[318,172],[318,584],[545,716],[545,738],[488,770],[245,646],[245,312],[232,320],[232,664],[503,820],[503,918],[157,716]],
  S1: [[407,125],[505,56],[855,256],[855,356],[512,160],[481,174],[481,410],[697,535],[697,816],[517,922],[517,828],[622,768],[622,596],[407,470]],
  S2: [[570,304],[855,462],[855,708],[727,790],[727,715],[777,686],[777,518],[570,398]]
};
const CX = 506, CY = 489, UNIT = 420;

// Where each piece sits in the exploded view (x, y, z)
const EXPLODE = {
  L:  new THREE.Vector3(-0.55, -0.12, -0.55),
  S1: new THREE.Vector3(0.08, 0.18, 0.45),
  S2: new THREE.Vector3(0.62, -0.05, 1.0)
};

const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function init(canvas, { tier = 'high', hero, onReady, onFail } = {}) {
  const high = tier === 'high';
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: high, alpha: true, powerPreference: high ? 'high-performance' : 'low-power' });
  } catch (e) { onFail && onFail(); return; }

  let dpr = Math.min(window.devicePixelRatio || 1, high ? 2 : 1.5);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 0, 8.2);

  // Studio lighting: a soft room for reflections, a warm key, a teal rim
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const key = new THREE.DirectionalLight(0xfff2e2, 1.6);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x08dbde, 3.2);
  rim.position.set(4, 1.5, -3);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0x9ec2cd, 0.5);
  fill.position.set(0, -4, 3);
  scene.add(fill);

  // Materials: lacquered teal and deep navy, the two halves of the mark
  const Mat = high ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const tealMat = new Mat({ color: 0x0b97a6, metalness: 0.15, roughness: 0.38, envMapIntensity: 0.45, ...(high ? { clearcoat: 1, clearcoatRoughness: 0.12 } : {}) });
  const navyMat = new Mat({ color: 0x0d3866, metalness: 0.7, roughness: 0.32, envMapIntensity: 1.0, ...(high ? { clearcoat: 1, clearcoatRoughness: 0.18 } : {}) });

  const extrude = {
    depth: 0.24, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.016,
    bevelSegments: high ? 4 : 1, curveSegments: 1
  };
  const group = new THREE.Group();
  scene.add(group);
  const meshes = {};
  Object.entries(PIECES).forEach(([name, pts]) => {
    const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2((x - CX) / UNIT, -(y - CY) / UNIT)));
    const geo = new THREE.ExtrudeGeometry(shape, extrude);
    geo.translate(0, 0, -extrude.depth / 2);
    const mesh = new THREE.Mesh(geo, name === 'L' ? tealMat : navyMat);
    group.add(mesh);
    meshes[name] = mesh;
  });

  // Blueprint hexagon behind the mark: the isometric cube the logo is drawn on
  const hexPts = [];
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 3;
    hexPts.push(new THREE.Vector3(Math.cos(a) * 1.42, Math.sin(a) * 1.42, -0.5));
  }
  const hexGeo = new THREE.BufferGeometry().setFromPoints(hexPts);
  const hexMat = new THREE.LineDashedMaterial({ color: 0x9ec2cd, dashSize: 0.04, gapSize: 0.06, transparent: true, opacity: 0.28 });
  const hex = new THREE.Line(hexGeo, hexMat);
  hex.computeLineDistances();
  scene.add(hex);

  // ---------- State ----------
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let scrollP = 0;
  let visible = true;
  let running = true;
  const t0 = performance.now();
  const INTRO = 2400;

  const onPointer = (e) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  const onScroll = () => {
    const h = hero ? hero.offsetHeight : window.innerHeight;
    scrollP = clamp01(window.scrollY / (h * 0.9));
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Size to the canvas box
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // Pause when off screen or tab hidden
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) kick(); }, { threshold: 0 });
  io.observe(canvas);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

  // ---------- Frame loop with a simple performance governor ----------
  let raf = 0, frames = 0, slow = 0, last = performance.now(), readySent = false;
  const tmp = new THREE.Vector3();

  function frame(now) {
    raf = 0;
    if (!running || !visible || document.hidden) return;
    const dt = now - last; last = now;

    // Governor: step resolution down, then give up gracefully
    if (frames > 30 && !window.LAYAW_NO_GOVERNOR) {
      slow = dt > 34 ? slow + 1 : Math.max(0, slow - 1);
      if (slow > 45) {
        slow = 0;
        if (dpr > 1) { dpr = 1; renderer.setPixelRatio(1); resize(); }
        else { stop(); onFail && onFail(); return; }
      }
    }
    frames++;

    const t = (now - t0) / 1000;
    const intro = easeOutExpo(clamp01((now - t0) / INTRO));
    // Frame-rate independent smoothing
    const k = (base) => 1 - Math.pow(1 - base, Math.min(dt, 100) / 16.7);
    pointer.x += (pointer.tx - pointer.x) * k(0.05);
    pointer.y += (pointer.ty - pointer.y) * k(0.05);

    // Pieces: start apart, assemble, then open again with scroll
    const open = (1 - intro) * 1.6 + scrollP * 1.1;
    for (const name in meshes) {
      tmp.copy(EXPLODE[name]).multiplyScalar(open);
      meshes[name].position.lerp(tmp, k(0.12));
    }
    group.rotation.y = (1 - intro) * -0.9 + pointer.x * 0.32 + scrollP * 0.55 + Math.sin(t * 0.35) * 0.04;
    group.rotation.x = (1 - intro) * 0.45 + pointer.y * 0.18 + scrollP * 0.2;
    group.position.y = Math.sin(t * 0.6) * 0.03 + scrollP * 0.3;
    hex.rotation.z = t * 0.03;
    hexMat.opacity = 0.28 * intro * (1 - scrollP * 0.7);

    renderer.render(scene, camera);
    if (!readySent) { readySent = true; onReady && onReady(); }
    kick();
  }
  function kick() { if (!raf && running) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', onPointer);
    window.removeEventListener('scroll', onScroll);
    ro.disconnect(); io.disconnect();
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); onFail && onFail(); });
  kick();
  return { stop };
}
