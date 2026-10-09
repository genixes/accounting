import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { CAM, REVEAL, clamp01, smoothstep } from "./ease";
import { createScene, type Scene3D, type SceneState } from "./scene";
import { initGyro, initPointerFx } from "./pointer";

export const LEDGER_AMOUNTS = [1240000, 3880000, 2415500, 2964500];
export const peso = (n: number) => "₱ " + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const FLOOR_STATUS = ["Footings set", "Steel erected", "Slabs poured", "Glazed & sealed"];

/**
 * Wires the whole page into one scroll-driven journey. Returns a teardown.
 * All story state lives in S and is written only by scrubbed tweens, so every
 * sequence is reversible.
 */
export function initJourney(root: HTMLElement, onModeChange: () => void): () => void {
  gsap.registerPlugin(ScrollTrigger);
  const html = document.documentElement;
  const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mqMobile = window.matchMedia("(max-width: 767px)");
  const reduced = mqReduce.matches;
  const mobile = mqMobile.matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const lowEnd = (navigator.hardwareConcurrency || 8) <= 4;

  const teardown: Array<() => void> = [];
  const listen = (t: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions) => {
    t.addEventListener(type, fn, opts);
    teardown.push(() => t.removeEventListener(type, fn, opts));
  };
  listen(mqReduce, "change", onModeChange);
  listen(mqMobile, "change", onModeChange);

  const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const qa = (s: string) => Array.from(root.querySelectorAll<HTMLElement>(s));
  const canvas = q<HTMLCanvasElement>("#lp-canvas");
  const stage = q("#lp-stage");

  let scene: Scene3D | null = null;
  try {
    scene = createScene(canvas, { mobile, lowEnd });
  } catch {
    html.classList.add("lp-nogl"); // no WebGL: the page still reads and scrolls
  }

  const tilt = { x: 0, y: 0 };
  const pointerOff = initPointerFx(root, {
    reduced,
    coarse,
    onTilt: (x, y) => { tilt.x = x; tilt.y = y; },
  });
  teardown.push(pointerOff);

  // ------------------------------------------------------------------ reduced
  if (reduced) {
    html.classList.remove("lp-pre");
    html.classList.add("lp-reduced");
    scene?.renderStatic();
    listen(window, "resize", () => scene?.renderStatic());
    // simple 200ms opacity fades, nothing else moves
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    }), { threshold: 0.12 });
    qa("[data-fade]").forEach((el) => io.observe(el));
    teardown.push(() => io.disconnect());
    teardown.push(() => { html.classList.remove("lp-reduced"); scene?.dispose(); });
    return () => teardown.splice(0).reverse().forEach((f) => f());
  }

  // ------------------------------------------------------------------ motion
  html.classList.remove("lp-pre");
  html.classList.add("lp-motion");
  teardown.push(() => html.classList.remove("lp-motion"));
  ScrollTrigger.config({ ignoreMobileResize: true });

  const lenis = mobile && lowEnd
    ? null // low-end phones keep native scroll
    : new Lenis({ lerp: 0.09, smoothWheel: true, syncTouch: mobile, syncTouchLerp: 0.1, touchInertiaExponent: 1.4 });
  if (lenis) {
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    teardown.push(() => { gsap.ticker.remove(raf); lenis.destroy(); });
  }

  const S: SceneState = {
    hero: 0, manifesto: 0, build: 0, win: 0, closing: 0,
    heroRange: 0, dragYaw: 0, tiltX: 0, tiltY: 0,
  };
  let dirty = true;
  let active = true;
  let productCovers = false;
  let dragging = false;
  const mark = () => { dirty = true; };

  const veil = q("#lp-veil");
  const winEl = q("#lp-win");

  // Ledger rows write themselves as the floors go up, and rewind on the way back.
  const rows = qa(".lp-lrow");
  const amtEls = rows.map((r) => r.querySelector<HTMLElement>(".lp-amt")!);
  const totalEl = q("#lp-total");
  const floorN = q("#lp-floor-n");
  const floorS = q("#lp-floor-s");
  let lastLedger = "";
  const updateLedger = () => {
    let total = 0;
    let sig = "";
    rows.forEach((row, i) => {
      const a = clamp01(S.build * 4.2 - i);
      const v = LEDGER_AMOUNTS[i] * a;
      total += v;
      const clip = `inset(0 ${((1 - a) * 100).toFixed(1)}% 0 0)`;
      sig += clip + Math.round(v);
      row.style.clipPath = clip;
      amtEls[i].textContent = peso(v);
    });
    if (sig === lastLedger) return;
    lastLedger = sig;
    totalEl.textContent = peso(total);
    const f = Math.min(3, Math.floor(S.build * 4.2));
    floorN.textContent = `Floor 0${f + 1} / 04`;
    floorS.textContent = FLOOR_STATUS[f];
  };

  // The completed top-floor window → full-viewport product stage.
  const updateWindow = () => {
    const visible = S.win > 0.0005 && !productCovers && !!scene;
    winEl.style.opacity = visible ? "1" : "0";
    if (!visible) return;
    const r = scene!.windowRect();
    const cover = Math.max(innerWidth / r.w, innerHeight / r.h) * 1.06;
    const sc = 1 + (cover - 1) * CAM(S.win);
    winEl.style.transform = `translate3d(${r.cx - 50}px, ${r.cy - 50}px, 0) scale(${(r.w / 100) * sc}, ${(r.h / 100) * sc})`;
  };

  const updateVeil = () => {
    // darken the structure behind the manifesto so the words read; clear it as
    // the camera leaves the frame.
    const v = 0.66 * smoothstep(0, 0.12, S.manifesto) * (1 - smoothstep(0.8, 1, S.manifesto));
    veil.style.opacity = v.toFixed(3);
  };

  const tick = () => {
    // easing of pointer-fed values (no idle work once settled)
    const tx = tilt.x, ty = tilt.y;
    if (Math.abs(S.tiltX - tx) > 0.001 || Math.abs(S.tiltY - ty) > 0.001) {
      S.tiltX += (tx - S.tiltX) * 0.08;
      S.tiltY += (ty - S.tiltY) * 0.08;
      mark();
    }
    if (!dragging && Math.abs(S.dragYaw) > 0.0005) { S.dragYaw *= 0.88; mark(); }
    else if (!dragging && S.dragYaw !== 0) { S.dragYaw = 0; mark(); }

    if (!dirty || document.hidden) return;
    dirty = false;
    updateVeil();
    if (scene) {
      scene.update(S); // cheap; keeps the window overlay exact even when not drawing
      if (active) scene.render();
    }
    updateWindow();
  };
  gsap.ticker.add(tick);
  teardown.push(() => gsap.ticker.remove(tick));

  // Pause WebGL when its sections are off-screen or the tab is hidden.
  const vis = new Map<Element, boolean>();
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => vis.set(e.target, e.isIntersecting));
    active = [...vis.values()].some(Boolean);
    stage.style.visibility = active ? "visible" : "hidden";
    if (active) mark();
  });
  ["#lp-hero", "#lp-manifesto", "#lp-build", "#lp-closing"].forEach((s) => io.observe(q(s)));
  teardown.push(() => io.disconnect());
  listen(document, "visibilitychange", mark);
  listen(window, "resize", () => { scene?.resize(); mark(); });

  // Drag-to-rotate on the hero model (mouse and touch). Vertical scrolling
  // still belongs to the page (touch-action: pan-y).
  const drag = q("#lp-drag");
  let lastX = 0;
  listen(drag, "pointerdown", ((e: PointerEvent) => {
    dragging = true; lastX = e.clientX;
    drag.setPointerCapture?.(e.pointerId);
  }) as EventListener);
  listen(drag, "pointermove", ((e: PointerEvent) => {
    if (!dragging) return;
    S.dragYaw = Math.max(-Math.PI, Math.min(Math.PI, S.dragYaw + (e.clientX - lastX) * 0.008));
    lastX = e.clientX;
    mark();
  }) as EventListener);
  const endDrag = () => { dragging = false; };
  listen(drag, "pointerup", endDrag);
  listen(drag, "pointercancel", endDrag);

  if (coarse) {
    teardown.push(initGyro(root.querySelector<HTMLElement>("#lp-tilt-btn"), (x, y) => { tilt.x = x; tilt.y = y; }));
  }

  // Focus must never land on something off-screen.
  listen(document, "focusin", ((e: FocusEvent) => {
    const t = e.target as HTMLElement | null;
    if (!t || t === document.body || !root.contains(t)) return;
    const r = t.getBoundingClientRect();
    if (r.top >= 0 && r.bottom <= innerHeight) return;
    if (lenis) lenis.scrollTo(t, { offset: -innerHeight * 0.3, duration: 0.7 });
    else t.scrollIntoView({ block: "center" });
  }) as EventListener);

  // ---------------------------------------------------------------- triggers
  const ctx = gsap.context(() => {
    const heroEl = q("#lp-hero");
    const willChange = (el: Element) => (self: ScrollTrigger) => {
      (el as HTMLElement).style.willChange = self.isActive ? "transform" : "auto";
    };

    // --- 1. camera / state, scrubbed ---
    const scrub = (target: Partial<SceneState>, trigger: string, start: string, end: string) =>
      gsap.to(S, {
        ...target, ease: "none", onUpdate: mark,
        scrollTrigger: { trigger, start, end, scrub: 1 },
      });
    scrub({ hero: 1 }, "#lp-hero", "top top", "bottom bottom");
    scrub({ manifesto: 1 }, "#lp-manifesto", "top bottom", "bottom top");
    scrub({ closing: 1 }, "#lp-closing", "top bottom", "bottom bottom");
    ScrollTrigger.addEventListener("refresh", () => {
      S.heroRange = Math.max(0, heroEl.offsetHeight - innerHeight);
      mark();
    });

    // --- 2. Section 3: construction, pinned ~300vh (200vh mobile) ---
    const buildUI = q("#lp-build-ui");
    gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: "#lp-build", start: "top top",
        end: () => "+=" + innerHeight * (mobile ? 2 : 3),
        pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true,
        onToggle: willChange(q("#lp-build")),
      },
    })
      .to(S, { build: 1, duration: 0.78, onUpdate: () => { mark(); updateLedger(); } })
      .to(buildUI, { opacity: 0, duration: 0.1 }, 0.8)
      .to(S, { win: 1, duration: 0.22, onUpdate: mark }, 0.78);
    updateLedger();

    ScrollTrigger.create({
      trigger: "#lp-product", start: "top top", end: "+=999999", // never "completes", so it stays active to the page end
     
      onToggle: (self) => { productCovers = self.isActive; mark(); },
    });

    // --- 3. Section 4: product stage, pinned ~150vh (100vh mobile) ---
    const phone = q("#lp-phone");
    const screens = qa(".lp-screen");
    const caps = qa(".lp-pcap");
    const hide = "inset(0 0 0 100%)";
    gsap.set(screens.slice(1), { clipPath: hide });
    gsap.set(caps.slice(1), { opacity: 0.3 });
    const pt = gsap.timeline({
      defaults: { ease: CAM },
      scrollTrigger: {
        trigger: "#lp-product", start: "top top",
        end: () => "+=" + innerHeight * (mobile ? 1 : 1.5),
        pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true,
        onToggle: willChange(phone),
      },
    });
    pt.fromTo(phone, { rotateY: -30, rotateX: 14, rotateZ: -4 }, { rotateY: 0, rotateX: 0, rotateZ: 0, duration: 0.2 }, 0)
      .fromTo("#lp-sweep", { xPercent: -160 }, { xPercent: 160, ease: "none", duration: 0.78 }, 0.1)
      .to(screens[1], { clipPath: "inset(0 0 0 0%)", duration: 0.1 }, 0.3)
      .to(caps[0], { opacity: 0.3, duration: 0.08 }, 0.3)
      .to(caps[1], { opacity: 1, duration: 0.08 }, 0.3)
      .to(screens[2], { clipPath: "inset(0 0 0 0%)", duration: 0.1 }, 0.58)
      .to(caps[1], { opacity: 0.3, duration: 0.08 }, 0.58)
      .to(caps[2], { opacity: 1, duration: 0.08 }, 0.58)
      .to(phone, { rotateY: 24, rotateX: -10, rotateZ: 3, duration: 0.2 }, 0.8);

    // --- 4. Dark → light: one wireframe line grows into the drafting sheet ---
    const light = q("#lp-light");
    gsap.set("#lp-sheet", { clipPath: "inset(0 0 100% 0)" });
    gsap.set("#lp-wire", { clipPath: "inset(0 0 100% 0)" });
    gsap.set("#lp-edge", { scaleX: 0, y: 0 });
    gsap.set("#lp-paper-body", { opacity: 0 });
    gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: { trigger: light, start: "top 100%", end: "top 12%", scrub: 1, invalidateOnRefresh: true },
    })
      .to("#lp-edge", { scaleX: 1, duration: 0.3 })
      .to("#lp-edge", { y: () => q("#lp-sheet").offsetHeight, duration: 0.7, ease: CAM }, 0.3)
      .to("#lp-wire", { clipPath: "inset(0 0 0% 0)", duration: 0.7, ease: CAM }, 0.3)
      .to("#lp-sheet", { clipPath: "inset(0 0 0% 0)", duration: 0.7, ease: CAM }, 0.38)
      .to("#lp-paper-body", { opacity: 1, duration: 0.2 }, 0.82)
      .to(["#lp-edge", "#lp-wire"], { opacity: 0, duration: 0.1 }, 0.9);

    // --- 5. Light → roles: grid lines extend and become the panel borders ---
    const roleLines = qa(".lp-ln");
    gsap.set(qa(".lp-ln-h"), { scaleX: 0, transformOrigin: "0 50%" });
    gsap.set(qa(".lp-ln-v"), { scaleY: 0, transformOrigin: "50% 0" });
    gsap.timeline({
      defaults: { ease: CAM },
      scrollTrigger: { trigger: "#lp-rgrid", start: "top 85%", end: "top 35%", scrub: 1 },
    })
      .to(qa(".lp-ln-v"), { scaleY: 1, duration: 0.5, stagger: 0.06 }, 0)
      .to(qa(".lp-ln-h"), { scaleX: 1, duration: 0.5, stagger: 0.04 }, 0.15);
    void roleLines;
    // layered wipes: the dark layer slides off to reveal each role
    qa(".lp-wipe").forEach((w, i) => {
      gsap.fromTo(w, { xPercent: 0 }, {
        xPercent: 101, duration: 1.1, ease: REVEAL, delay: i * 0.1,
        scrollTrigger: { trigger: "#lp-rgrid", start: "top 55%", toggleActions: "play none none reverse" },
      });
    });

    // --- 6. blueprint cards: rectangles growing from a single grid line ---
    qa(".lp-card").forEach((c, i) => {
      gsap.fromTo(c, { clipPath: "inset(0 0 calc(100% - 1px) 0)" }, {
        clipPath: "inset(0 0 0% 0)", duration: 1.1, ease: REVEAL, delay: i * 0.08,
        scrollTrigger: { trigger: "#lp-cards", start: "top 80%", toggleActions: "play none none reverse" },
      });
    });

    // --- 7. closing CTA: clip-path inset ---
    gsap.fromTo("#lp-cta-wrap", { clipPath: "inset(0 100% 0 0)" }, {
      clipPath: "inset(0 0% 0 0)", duration: 1, ease: REVEAL,
      scrollTrigger: { trigger: "#lp-cta-wrap", start: "top 95%", toggleActions: "play none none reverse" },
    });

    // --- 8. typography ---
    qa("[data-lines]").forEach((h) => {
      gsap.fromTo(h.querySelectorAll(".lp-line"), { yPercent: 110, visibility: "visible" }, {
        yPercent: 0, visibility: "visible", duration: 1.1, ease: REVEAL, stagger: 0.08, delay: h.dataset.delay ? +h.dataset.delay : 0,
        scrollTrigger: { trigger: h, start: "top 90%", toggleActions: "play none none reverse" },
      });
    });
    qa("[data-chars]").forEach((h) => {
      gsap.fromTo(h.querySelectorAll(".lp-ch"),
        { y: "0.4em", opacity: 0, filter: "blur(4px)" },
        {
          y: 0, opacity: 1, filter: "blur(0px)", duration: 0.9, ease: REVEAL, stagger: 0.035, delay: 0.35,
          clearProps: "filter",
          scrollTrigger: { trigger: h, start: "top 90%", toggleActions: "play none none reverse" },
        });
    });
    // manifesto: the reader lights the sentence up by scrolling
    gsap.to(qa(".lp-w-lit"), {
      opacity: 1, ease: "none", stagger: { each: 0.12 }, duration: 0.5,
      scrollTrigger: { trigger: "#lp-mtext", start: "top 78%", end: "bottom 52%", scrub: true },
    });
    // oversized words drift ±5vw
    qa("[data-drift]").forEach((el) => {
      const dir = +(el.dataset.drift || 1);
      gsap.fromTo(el, { x: `${-5 * dir}vw` }, {
        x: `${5 * dir}vw`, ease: "none",
        scrollTrigger: { trigger: el.closest("section")!, start: "top bottom", end: "bottom top", scrub: true },
      });
    });

    // --- 9. parallax: 4 layers on desktop, 2 on mobile ---
    qa("[data-par]").forEach((el) => {
      const speed = +(el.dataset.par || 1);
      if (mobile && speed > 0.5) return;
      const sec = el.closest("section")!;
      const enter = el.dataset.parMode === "enter";
      const dist = () => (1 - speed) * sec.offsetHeight;
      gsap.fromTo(el, { y: () => (enter ? -dist() : 0) }, {
        y: () => (enter ? 0 : dist()), ease: "none", immediateRender: true,
        scrollTrigger: {
          trigger: sec,
          start: enter ? "top bottom" : "top top",
          end: enter ? "bottom bottom" : "bottom top",
          scrub: true, invalidateOnRefresh: true, onToggle: willChange(el),
        },
      });
    });
  }, root);
  teardown.push(() => { ctx.revert(); ScrollTrigger.getAll().forEach((t) => t.kill()); });

  if (document.fonts?.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  S.heroRange = Math.max(0, q("#lp-hero").offsetHeight - innerHeight);
  teardown.push(() => scene?.dispose());

  return () => teardown.splice(0).reverse().forEach((f) => f());
}
