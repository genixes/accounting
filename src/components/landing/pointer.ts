import gsap from "gsap";

/**
 * Micro-interactions. Everything here responds to a pointer or a touch and
 * nothing runs while idle. Durations stay 150–300ms (CSS transitions); the
 * magnetic CTA is a spring (stiffness 150, damping 15) and is the only thing
 * here that uses one.
 */
export type PointerOptions = {
  reduced: boolean;
  coarse: boolean;
  onTilt: (x: number, y: number) => void;
};

export function initPointerFx(root: HTMLElement, o: PointerOptions): () => void {
  const off: Array<() => void> = [];
  const on = <K extends keyof GlobalEventHandlersEventMap>(
    t: EventTarget, type: K, fn: (e: GlobalEventHandlersEventMap[K]) => void, opts?: AddEventListenerOptions,
  ) => {
    t.addEventListener(type, fn as EventListener, opts);
    off.push(() => t.removeEventListener(type, fn as EventListener, opts));
  };

  // ---- pointer-follow sheen (mouse) + sheen at the touch point (touch) ----
  root.querySelectorAll<HTMLElement>("[data-sheen]").forEach((el) => {
    const sheen = document.createElement("span");
    sheen.className = "lp-sheen";
    sheen.setAttribute("aria-hidden", "true");
    el.appendChild(sheen);
    const place = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      sheen.style.transform = `translate3d(${e.clientX - r.left - 170}px, ${e.clientY - r.top - 170}px, 0)`;
    };
    const show = (e: PointerEvent) => { place(e); sheen.style.opacity = "1"; };
    const hide = () => { sheen.style.opacity = "0"; };
    on(el, "pointerenter", (e) => { if (e.pointerType === "mouse") show(e); });
    on(el, "pointermove", (e) => { if (e.pointerType === "mouse") place(e); });
    on(el, "pointerleave", hide);
    on(el, "pointerdown", (e) => { if (e.pointerType !== "mouse") show(e); });
    on(el, "pointerup", hide);
    on(el, "pointercancel", hide);
    off.push(() => sheen.remove());
  });

  if (o.coarse) return () => off.splice(0).forEach((f) => f());

  // ---- cursor parallax feed (desktop replacement for the gyroscope) ----
  if (!o.reduced) {
    on(window, "pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      o.onTilt((e.clientX / innerWidth - 0.5) * 2, (e.clientY / innerHeight - 0.5) * 2);
    }, { passive: true });
  }

  // ---- crosshair cursor that expands into a label ----
  const cursor = root.querySelector<HTMLElement>("#lp-cursor");
  const label = cursor?.querySelector<HTMLElement>(".lp-cursor-label");
  if (cursor && label) {
    const html = document.documentElement;
    on(window, "pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      html.classList.add("lp-has-cursor");
      cursor.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      const t = (e.target as Element | null)?.closest<HTMLElement>("[data-cursor]");
      if (t) {
        label.textContent = t.dataset.cursor || "";
        cursor.classList.add("is-label");
      } else {
        cursor.classList.remove("is-label");
      }
    }, { passive: true });
    on(document.documentElement, "pointerleave", () => html.classList.remove("lp-has-cursor"));
    off.push(() => html.classList.remove("lp-has-cursor"));
  }

  // ---- magnetic CTA: 60px radius, spring k=150 c=15 ----
  if (!o.reduced) {
    type M = { el: HTMLElement; x: number; y: number; vx: number; vy: number; tx: number; ty: number; live: boolean };
    const ms: M[] = Array.from(root.querySelectorAll<HTMLElement>("[data-magnetic]")).map((el) => ({
      el, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, live: false,
    }));
    const K = 150, C = 15, RADIUS = 60;
    let running = false;
    const step = (_t: number, dtMs: number) => {
      const dt = Math.min(dtMs, 33) / 1000;
      let any = false;
      for (const m of ms) {
        if (!m.live) continue;
        m.vx += (-K * (m.x - m.tx) - C * m.vx) * dt;
        m.vy += (-K * (m.y - m.ty) - C * m.vy) * dt;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        const settled = m.tx === 0 && m.ty === 0 && Math.abs(m.x) < 0.05 && Math.abs(m.y) < 0.05 && Math.abs(m.vx) < 0.5 && Math.abs(m.vy) < 0.5;
        if (settled) { m.x = m.y = m.vx = m.vy = 0; m.live = false; }
        else any = true;
        m.el.style.transform = `translate3d(${m.x.toFixed(2)}px, ${m.y.toFixed(2)}px, 0)`;
      }
      if (!any) { gsap.ticker.remove(step); running = false; }
    };
    on(window, "pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      for (const m of ms) {
        const r = m.el.getBoundingClientRect();
        // The element is displaced by the spring; measure from its rest box.
        const left = r.left - m.x, right = r.right - m.x, top = r.top - m.y, bottom = r.bottom - m.y;
        const ex = Math.max(left - e.clientX, 0, e.clientX - right);
        const ey = Math.max(top - e.clientY, 0, e.clientY - bottom);
        const near = Math.hypot(ex, ey) <= RADIUS;
        const nx = near ? (e.clientX - (left + right) / 2) * 0.35 : 0;
        const ny = near ? (e.clientY - (top + bottom) / 2) * 0.35 : 0;
        if (nx !== m.tx || ny !== m.ty) {
          m.tx = nx; m.ty = ny; m.live = true;
          if (!running) { running = true; gsap.ticker.add(step); }
        }
      }
    }, { passive: true });
    off.push(() => { gsap.ticker.remove(step); ms.forEach((m) => { m.el.style.transform = ""; }); });
  }

  return () => off.splice(0).forEach((f) => f());
}

/**
 * Gyroscope tilt for touch devices. iOS needs a permission request from a user
 * gesture, so it hangs off a button; if it's refused, drag-to-rotate (always
 * available on the hero) remains the fallback.
 */
export function initGyro(button: HTMLElement | null, onTilt: (x: number, y: number) => void): () => void {
  if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return () => {};
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  const handler = (e: DeviceOrientationEvent) => {
    if (e.gamma == null || e.beta == null) return;
    onTilt(clamp(e.gamma / 30), clamp((e.beta - 45) / 30));
  };
  let attached = false;
  const attach = () => {
    if (attached) return;
    attached = true;
    window.addEventListener("deviceorientation", handler);
  };
  const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
  const cleanups: Array<() => void> = [() => window.removeEventListener("deviceorientation", handler)];
  if (typeof DOE.requestPermission === "function") {
    if (button) {
      button.hidden = false;
      const click = async () => {
        try {
          if ((await DOE.requestPermission!()) === "granted") { attach(); button.hidden = true; }
        } catch { /* denied → drag fallback */ }
      };
      button.addEventListener("click", click);
      cleanups.push(() => button.removeEventListener("click", click));
    }
  } else {
    attach();
  }
  return () => cleanups.forEach((f) => f());
}
