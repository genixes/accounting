import * as THREE from "three";
import { CAM, REVEAL, clamp01, lerp, smoothstep } from "./ease";

/**
 * One continuous camera. Every number here is a pure function of scroll state
 * (S), so scrolling backwards rewinds the camera, un-builds the floors and
 * un-rotates the building. Nothing in this file runs on a clock.
 */
export type SceneState = {
  hero: number; // 0..1 across the hero
  manifesto: number; // 0..1 across the manifesto
  build: number; // 0..1 floors assembling (pinned)
  win: number; // 0..1 top-floor window growing into the product stage
  closing: number; // 0..1 pull-out to the finished building
  heroRange: number; // px of scroll the hero spans (for structure parallax)
  dragYaw: number; // radians, drag-to-rotate on the hero model
  tiltX: number; // -1..1, cursor or gyroscope
  tiltY: number;
};

export type WindowRect = { cx: number; cy: number; w: number; h: number };

const FH = 1.6; // floor height
const FLOORS = 4;
const HALF = 3; // half footprint
const COLS = [-3, 0, 3];
const HERO_YAW = THREE.MathUtils.degToRad(35);
const UP = new THREE.Vector3(0, 1, 0);

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
// Building-local point → world, with the hero's 35° already applied, so the
// camera keyframes below are authored against the building's final pose.
const W = (x: number, y: number, z: number) => V(x, y, z).applyAxisAngle(UP, HERO_YAW);

type KF = { id: string; pos: THREE.Vector3; look: THREE.Vector3; skipMobile?: boolean };

const KEYFRAMES: KF[] = [
  { id: "start", pos: V(10, 5.5, 17), look: V(0, 3.2, 0) },
  { id: "heroEnd", pos: V(6, 3.6, 10.5), look: V(0, 3, 0) },
  // hero → manifesto: through the bay between two columns, into the frame…
  { id: "in", pos: W(1.5, 2.4, 8), look: W(1.5, 2.4, 0), skipMobile: true },
  { id: "inside", pos: W(1.5, 2.4, 0.2), look: W(1.5, 2.4, -8) },
  // …out the back, then round to the construction viewpoint
  { id: "out", pos: W(1.5, 2.4, -6), look: W(1.5, 2.4, -14) },
  { id: "swing", pos: W(-11, 3.6, -7), look: W(0, 3, 0) },
  { id: "orbit1", pos: W(-12, 4.8, 3.5), look: W(0, 3.4, 0), skipMobile: true },
  { id: "orbit2", pos: W(-8, 6.2, 13), look: W(0, 4.2, 0) },
  // construction → product: square-on to the top-floor window
  { id: "window", pos: W(0, 5.6, 10), look: W(0, 5.6, 0) },
  { id: "pull1", pos: W(5, 6.5, 16), look: W(0, 3.4, 0), skipMobile: true },
  { id: "wide", pos: W(6.5, 5.6, 21), look: W(0, 3.4, 0) },
];

const WIN_W = 2.4;
const WIN_H = 1.15;
const WIN_Y = (FLOORS - 1) * FH + FH / 2 + 0.05;

export type SceneOptions = { mobile: boolean; lowEnd: boolean };

export function createScene(canvas: HTMLCanvasElement, opts: SceneOptions) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !opts.lowEnd,
    alpha: true,
    powerPreference: "high-performance",
  });
  const maxDpr = opts.mobile && opts.lowEnd ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a101f, 24, 78);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 140);

  scene.add(new THREE.HemisphereLight(0x9db6ff, 0x0a101f, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(8, 14, 10);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x22d3ee, 1.6);
  rim.position.set(-10, 6, -8);
  scene.add(rim);

  const building = new THREE.Group();
  scene.add(building);

  // ---------- ground ----------
  const grid = new THREE.GridHelper(90, 90, 0x22d3ee, 0x16264a);
  grid.position.y = -0.31;
  const gm = grid.material as THREE.LineBasicMaterial;
  gm.transparent = true;
  gm.opacity = 0.35;
  scene.add(grid);
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(7.6, 0.3, 7.6),
    new THREE.MeshStandardMaterial({ color: 0x0f1a33, roughness: 0.9 }),
  );
  plinth.position.y = -0.15;
  building.add(plinth);

  // ---------- steel (always present: the hero's skeleton) ----------
  const geoCache = new Map<string, { box: THREE.BoxGeometry; edges: THREE.EdgesGeometry }>();
  const geo = (w: number, h: number, d: number) => {
    const k = `${w}|${h}|${d}`;
    let g = geoCache.get(k);
    if (!g) {
      const box = new THREE.BoxGeometry(w, h, d);
      g = { box, edges: new THREE.EdgesGeometry(box) };
      geoCache.set(k, g);
    }
    return g;
  };

  const steelBase = new THREE.MeshStandardMaterial({ color: 0x6f82ab, metalness: 0.6, roughness: 0.4 });
  const edgeBase = new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.4 });
  const steelMats: THREE.MeshStandardMaterial[] = [];
  const edgeMats: THREE.LineBasicMaterial[] = [];
  const floors: { steel: THREE.Group; fill: THREE.Group; fillMats: { m: THREE.Material; base: number }[] }[] = [];

  const addPiece = (
    g: THREE.Group, f: number, w: number, h: number, d: number,
    x: number, y: number, z: number, rx = 0, rz = 0,
  ) => {
    const { box, edges } = geo(w, h, d);
    const mesh = new THREE.Mesh(box, steelMats[f]);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, 0, rz);
    mesh.add(new THREE.LineSegments(edges, edgeMats[f]));
    g.add(mesh);
  };

  const WINDOW_BORDER = new THREE.LineBasicMaterial({ color: 0x22d3ee });
  let windowMesh!: THREE.Mesh;

  for (let f = 0; f < FLOORS; f++) {
    steelMats.push(steelBase.clone());
    edgeMats.push(edgeBase.clone());
    const steel = new THREE.Group();
    const y0 = f * FH;
    const y1 = (f + 1) * FH;

    // columns
    for (const x of COLS) for (const z of COLS) addPiece(steel, f, 0.22, FH, 0.22, x, y0 + FH / 2, z);
    // beams at the floor's top level
    for (const z of COLS) for (const x of [-1.5, 1.5]) addPiece(steel, f, 3 - 0.22, 0.18, 0.14, x, y1, z);
    for (const x of COLS) for (const z of [-1.5, 1.5]) addPiece(steel, f, 0.14, 0.18, 3 - 0.22, x, y1, z);
    // X-bracing on the outer faces, alternating bays (the camera's bay at
    // x=+1.5 on floor 1 is kept clear so it can fly straight through)
    const bayX = f % 2 === 0 ? 1.5 : -1.5;
    const len = Math.hypot(3, FH);
    const ang = Math.atan2(FH, 3);
    for (const z of [HALF, -HALF]) {
      addPiece(steel, f, len, 0.07, 0.07, bayX, y0 + FH / 2, z, 0, ang);
      addPiece(steel, f, len, 0.07, 0.07, bayX, y0 + FH / 2, z, 0, -ang);
    }
    const bayZ = f % 2 === 0 ? 1.5 : -1.5;
    for (const x of [HALF, -HALF]) {
      addPiece(steel, f, 0.07, 0.07, len, x, y0 + FH / 2, bayZ, ang, 0);
      addPiece(steel, f, 0.07, 0.07, len, x, y0 + FH / 2, bayZ, -ang, 0);
    }
    building.add(steel);

    // ---------- fill: slab + glazing, assembled by scroll ----------
    const fill = new THREE.Group();
    const fillMats: { m: THREE.Material; base: number }[] = [];
    const reg = <T extends THREE.Material>(m: T, base: number) => {
      m.transparent = true;
      fillMats.push({ m, base });
      return m;
    };
    const slabMat = reg(new THREE.MeshStandardMaterial({ color: 0x1b2a4c, roughness: 0.85, metalness: 0.1 }), 1);
    const glassMat = reg(new THREE.MeshBasicMaterial({ color: 0x3b82f6, side: THREE.DoubleSide, depthWrite: false }), 0.16);
    const litMat = reg(new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.DoubleSide, depthWrite: false }), 0.42);

    const slab = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.14, 6.5), slabMat);
    slab.position.y = y0 + 0.07;
    fill.add(slab);
    if (f === FLOORS - 1) {
      const roof = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.14, 6.5), slabMat);
      roof.position.y = y1;
      fill.add(roof);
    }

    const faces: { ry: number; x: number; z: number }[] = [
      { ry: 0, x: 0, z: HALF + 0.06 },
      { ry: Math.PI, x: 0, z: -HALF - 0.06 },
      { ry: Math.PI / 2, x: HALF + 0.06, z: 0 },
      { ry: -Math.PI / 2, x: -HALF - 0.06, z: 0 },
    ];
    faces.forEach((face, fi) => {
      [-2, 0, 2].forEach((off, i) => {
        const isHeroWindow = f === FLOORS - 1 && fi === 0 && i === 1;
        if (isHeroWindow) return;
        const lit = (f * 7 + fi * 3 + i) % 3 === 0;
        const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.8, FH - 0.5), lit ? litMat : glassMat);
        pane.position.set(0, y0 + FH / 2 + 0.05, 0);
        const holder = new THREE.Group();
        holder.position.set(face.x, 0, face.z);
        holder.rotation.y = face.ry;
        pane.position.x = off;
        holder.add(pane);
        fill.add(holder);
      });
    });

    if (f === FLOORS - 1) {
      // The window that becomes the product stage. Flat --sheet so the DOM
      // overlay that scales up from it matches exactly.
      const wm = new THREE.MeshBasicMaterial({ color: 0x111a2e, fog: false });
      reg(wm, 1);
      windowMesh = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W, WIN_H), wm);
      windowMesh.position.set(0, WIN_Y, HALF + 0.1);
      const frame = new THREE.LineSegments(new THREE.EdgesGeometry(windowMesh.geometry), WINDOW_BORDER);
      windowMesh.add(frame);
      fill.add(windowMesh);
    }

    building.add(fill);
    floors.push({ steel, fill, fillMats });
  }

  // ---------- camera path ----------
  const path = KEYFRAMES.filter((k) => !(opts.mobile && k.skipMobile));
  const idx = (id: string) => path.findIndex((k) => k.id === id);
  const curvePos = new THREE.CatmullRomCurve3(path.map((k) => k.pos), false, "centripetal");
  const curveLook = new THREE.CatmullRomCurve3(path.map((k) => k.look), false, "centripetal");
  const seg = {
    hero: [idx("start"), idx("heroEnd")],
    manifesto: [idx("heroEnd"), idx("swing")],
    build: [idx("swing"), idx("window")],
    closing: [idx("window"), idx("wide")],
  };

  const kOf = (S: SceneState) => {
    let k = seg.hero[0];
    k = lerp(seg.hero[0], seg.hero[1], CAM(S.hero));
    if (S.manifesto > 0) k = lerp(seg.manifesto[0], seg.manifesto[1], CAM(S.manifesto));
    if (S.build > 0) k = lerp(seg.build[0], seg.build[1], CAM(S.build));
    if (S.closing > 0) k = lerp(seg.closing[0], seg.closing[1], CAM(S.closing));
    return k;
  };

  let width = 1;
  let height = 1;
  const tmp = new THREE.Vector3();
  const p = new THREE.Vector3();
  const l = new THREE.Vector3();

  function resize() {
    const r = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width));
    height = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.mobile && opts.lowEnd ? 1.5 : 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Keep the building's width in frame on portrait screens.
    const widen = Math.min(1.9, Math.max(1, 0.95 / camera.aspect));
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(38 / 2)) * widen));
    camera.updateProjectionMatrix();
  }

  function update(S: SceneState) {
    // --- building: 35° of yaw over the hero, plus drag / tilt ---
    building.rotation.y = HERO_YAW * CAM(S.hero) + S.dragYaw * (1 - S.manifesto) + S.tiltX * 0.04;

    // --- floors assemble one by one ---
    floors.forEach((fl, f) => {
      const a = clamp01(S.build * 4.2 - f);
      const e = REVEAL(a);
      fl.fill.visible = a > 0.001;
      fl.fill.position.y = (1 - e) * 2.6;
      for (const { m, base } of fl.fillMats) m.opacity = base * e;
      // the floor being set glows, then settles
      const glow = Math.sin(Math.PI * a);
      steelMats[f].emissive.setRGB(0.05 * glow, 0.5 * glow, 0.62 * glow);
      edgeMats[f].opacity = 0.4 + 0.55 * glow;
    });

    // --- camera along the path ---
    const k = kOf(S);
    const u = clamp01(k / (path.length - 1));
    curvePos.getPoint(u, p);
    curveLook.getPoint(u, l);
    camera.position.copy(p);
    camera.up.set(0, 1, 0);
    camera.lookAt(l);
    const tilt = 1 - S.win;
    camera.translateX(S.tiltX * 0.45 * tilt);
    camera.translateY(-S.tiltY * 0.25 * tilt);

    // --- structure parallax (0.5×) via the view window, plus framing shifts
    //     that keep the building clear of the ledger / bottom sheet ---
    const heroOff = 0.5 * S.heroRange * S.hero * (1 - smoothstep(0, 0.25, S.manifesto));
    const closingOff = -(1 - S.closing) * height;
    const presence = smoothstep(0.85, 1, S.manifesto) * (1 - smoothstep(0, 0.5, S.win)) * (S.closing > 0 ? 0 : 1);
    // hero composition: building sits right of the headline (below it on phones)
    const heroSet = 1 - smoothstep(0, 0.7, S.hero);
    const offX = opts.mobile ? 0 : -0.16 * width * heroSet;
    const offY = heroOff + (S.closing > 0 ? closingOff : 0)
      + (opts.mobile ? 0.15 * height * presence - 0.2 * height * heroSet : 0);
    camera.setViewOffset(width, height, offX, offY, width, height);

    camera.updateMatrixWorld();
    scene.updateMatrixWorld(true);
  }

  function windowRect(): WindowRect {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        tmp.set((sx * WIN_W) / 2, (sy * WIN_H) / 2, 0);
        windowMesh.localToWorld(tmp);
        tmp.project(camera);
        const x = (tmp.x * 0.5 + 0.5) * width;
        const y = (-tmp.y * 0.5 + 0.5) * height;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
  }

  function render() {
    renderer.render(scene, camera);
  }

  /** Reduced motion: one composed frame, the finished building. */
  function renderStatic() {
    resize();
    update({
      hero: 1, manifesto: 1, build: 1, win: 0, closing: 1,
      heroRange: 0, dragYaw: 0, tiltX: 0, tiltY: 0,
    });
    render();
  }

  function dispose() {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
    renderer.dispose();
  }

  resize();
  return { resize, update, render, renderStatic, windowRect, dispose };
}

export type Scene3D = ReturnType<typeof createScene>;
