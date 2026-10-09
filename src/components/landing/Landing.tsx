"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import "lenis/dist/lenis.css";
import "./landing.css";
import { LEDGER_AMOUNTS, initJourney, peso } from "./journey";

const LEDGER = [
  { ref: "EXP-0001", label: "Mobilization & footings" },
  { ref: "EXP-0002", label: "Structural steel, L1–L2" },
  { ref: "EXP-0003", label: "Slab pours & rebar" },
  { ref: "EXP-0004", label: "Facade & glazing" },
];

const MANIFESTO =
  "We don't pour concrete over mistakes. We void them, write the reason beside them, and keep building. " +
  "Every expense, every payroll, every collection and transfer is set down once, in order, in ink, " +
  "so the books can be trusted as far as the beams.";

const FEATURES = [
  { sheet: "A-101", title: "Append-only registers", body: "Expenses, payroll, collections and transfers. Entries are added, never deleted." },
  { sheet: "A-102", title: "Void, never erase", body: "A mistake is voided with a reason. Totals skip it; the record keeps it." },
  { sheet: "A-103", title: "Every write audited", body: "Who changed what, and when, lands in the audit log automatically." },
  { sheet: "A-104", title: "One system per client", body: "Their own branding, modules and data, at /t/your-company." },
];

const ROLES = [
  { n: "R1", name: "Encoder", body: "Logs entries across all four registers. Sees only their own.", can: ["Add ×4"] },
  { n: "R2", name: "Foreman", body: "Logs expenses and payroll for the projects they run, and nothing else.", can: ["Add ×2", "Own projects"] },
  { n: "R3", name: "Bookkeeper", body: "Everything an encoder does, plus the full ledger, voids and reports.", can: ["Add ×4", "Void", "Reports"] },
  { n: "R4", name: "Owner", body: "The whole book, plus who gets access to it.", can: ["Add ×4", "Void", "Reports", "Users"] },
];

function Lines({ lines }: { lines: ReactNode[] }) {
  return (
    <>
      {lines.map((l, i) => (
        <span className="lp-mask" key={i}>
          <span className="lp-line">{l}</span>
        </span>
      ))}
    </>
  );
}

function Chars({ text }: { text: string }) {
  return (
    <span className="lp-chars" aria-label={text}>
      {[...text].map((c, i) => (
        <span key={i} className="lp-ch" aria-hidden="true">{c}</span>
      ))}
    </span>
  );
}

function Words({ text }: { text: string }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <Fragment key={i}>
          <span className="lp-w">
            <span className="lp-w-base">{w}</span>
            <span className="lp-w-lit" aria-hidden="true">{w}</span>
          </span>{" "}
        </Fragment>
      ))}
    </>
  );
}

function ScreenEntry() {
  return (
    <div className="lp-ui">
      <div className="lp-ui-top"><b>New expense</b><span>EXP-0005</span></div>
      <label>Date<i>09 Oct 2026</i></label>
      <label>Project<i>Tower A</i></label>
      <label>Category<i>Structural steel</i></label>
      <label>Supplier<i>Cebu Steel Supply</i></label>
      <div className="lp-ui-amt"><span>Amount</span><b className="num">₱ 128,400.00</b></div>
      <div className="lp-ui-btn">Save entry</div>
    </div>
  );
}

function ScreenLedger() {
  const rows: [string, string, string, boolean?][] = [
    ["EXP-0005", "Structural steel", "−128,400", false],
    ["COL-0012", "Progress billing #2", "+850,000", false],
    ["EXP-0004", "Facade & glazing", "−2,964,500", true],
    ["PAY-0031", "Crew, week 40", "−96,300", false],
    ["EXP-0003", "Slab pours & rebar", "−2,415,500", false],
  ];
  return (
    <div className="lp-ui">
      <div className="lp-ui-top"><b>Ledger</b><span>All registers</span></div>
      {rows.map(([ref, label, amt, voided]) => (
        <div key={ref} className={"lp-ui-row" + (voided ? " is-void" : "")}>
          <div><b>{label}</b><span>{ref}{voided ? " · VOID: duplicate invoice" : ""}</span></div>
          <i className={"num " + (amt.startsWith("+") ? "pos" : "neg")}>{amt}</i>
        </div>
      ))}
    </div>
  );
}

function ScreenReport() {
  const bars = [38, 62, 46, 80, 58, 92];
  return (
    <div className="lp-ui">
      <div className="lp-ui-top"><b>Cash flow</b><span>Tower A · 2026</span></div>
      <div className="lp-ui-kpi"><span>Net position</span><b className="num pos">₱ 4,500,000</b></div>
      <div className="lp-ui-bars" aria-hidden="true">
        {bars.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}
      </div>
      <div className="lp-ui-legend"><span>In</span><span>Out</span><span>By category</span></div>
    </div>
  );
}

export default function Landing() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    return initJourney(root, () => setMode((n) => n + 1));
  }, [mode]);

  return (
    <div ref={rootRef} className="lp-root">
      <a className="lp-skip" href="#lp-paper">Skip to the details</a>

      <div id="lp-stage" className="lp-stage" aria-hidden="true">
        <canvas id="lp-canvas" />
      </div>
      <div id="lp-veil" className="lp-veil" aria-hidden="true" />
      <div id="lp-win" className="lp-win" aria-hidden="true" />
      <div id="lp-cursor" className="lp-cursor" aria-hidden="true">
        <i className="lp-cursor-x" /><i className="lp-cursor-y" />
        <span className="lp-cursor-pill"><span className="lp-cursor-label" /></span>
      </div>

      <header className="lp-nav">
        <a href="#lp-hero" className="lp-brand" aria-label="Layaw System, top of page">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo.png" alt="" width={28} height={28} />
          <span>Layaw System</span>
        </a>
        <a href="/t/genixes/login" className="lp-navlink">Sign in</a>
      </header>

      <main>
        {/* ============================== 01 HERO ============================== */}
        <section id="lp-hero" className="lp-sec lp-hero" aria-label="Layaw System">
          <div className="lp-bg" data-par="0.2" aria-hidden="true">
            <div className="lp-stars" /><div className="lp-hgrid" />
          </div>
          <div id="lp-drag" className="lp-drag" data-cursor="Drag to rotate" />
          <div className="lp-hero-frame">
            <p className="lp-cap lp-cap-tl" data-par="1.1">Layaw System · Construction accounting</p>
            <h1 className="lp-h1" data-par="0.8" data-lines>
              <Lines lines={["Simple.", "Smart.", <span key="s" data-chars className="lp-solid"><Chars text="Solid." /></span>]} />
            </h1>
            <p className="lp-lede lp-hero-lede" data-par="0.8">
              A ledger built the way you build: floor by floor, nothing torn down.
              Every peso on every site, in one append-only book.
            </p>
            <div className="lp-hero-foot" data-par="1.1">
              <p className="lp-cap">Scroll · into the structure</p>
              <p className="lp-cap lp-cap-r">Bldg 01 · 04 floors · 09 columns</p>
              <p className="lp-cap lp-only-touch">Drag to rotate</p>
              <button id="lp-tilt-btn" className="lp-tiltbtn" hidden type="button">Enable tilt</button>
            </div>
          </div>
        </section>

        {/* ============================ 02 MANIFESTO =========================== */}
        <section id="lp-manifesto" className="lp-sec lp-manifesto" aria-labelledby="lp-m-h">
          <div className="lp-bg" data-par="0.2" aria-hidden="true"><div className="lp-hgrid" /></div>
          <div className="lp-bigword lp-bw1" data-drift="-1" aria-hidden="true">Append-only</div>
          <p className="lp-cap lp-cap-m" data-par="1.1">01 — Manifesto</p>
          <div id="lp-mtext" className="lp-mtext">
            <h2 id="lp-m-h" className="lp-sr">Manifesto</h2>
            <p className="lp-mp"><Words text={MANIFESTO} /></p>
          </div>
          <div className="lp-bigword lp-bw2" data-drift="1" aria-hidden="true">Ledger</div>
        </section>

        {/* ============================ 03 CONSTRUCTION ======================== */}
        <section id="lp-build" className="lp-sec lp-build" aria-labelledby="lp-b-h">
          <div id="lp-build-ui" className="lp-build-ui">
            <div className="lp-build-copy">
              <p className="lp-cap">02 — Construction</p>
              <h2 id="lp-b-h" className="lp-h2" data-lines>
                <Lines lines={["Floor by floor,", "entry by entry."]} />
              </h2>
              <p className="lp-lede">
                Each floor that goes up writes a line in the ledger. Scroll back and it comes down again,
                and the numbers rewind with it.
              </p>
              <p className="lp-floorstat">
                <span id="lp-floor-n" className="lp-cap">Floor 04 / 04</span>
                <span id="lp-floor-s">Glazed &amp; sealed</span>
              </p>
            </div>
            <aside className="lp-ledger" data-fade data-sheen aria-label="Site ledger, Tower A">
              <header><span className="lp-cap">Site ledger · Tower A</span><span className="lp-cap">PHP</span></header>
              <ol>
                {LEDGER.map((r, i) => (
                  <li className="lp-lrow" key={r.ref}>
                    <span className="lp-lref">{r.ref}</span>
                    <span className="lp-llabel">{r.label}</span>
                    <span className="lp-amt num">{peso(LEDGER_AMOUNTS[i])}</span>
                  </li>
                ))}
              </ol>
              <footer>
                <span>Spent to date</span>
                <span id="lp-total" className="num">{peso(LEDGER_AMOUNTS.reduce((a, b) => a + b, 0))}</span>
              </footer>
              <p className="lp-note">Nothing is erased. A mistake is voided, with a reason, beside the entry.</p>
            </aside>
          </div>
        </section>

        {/* ============================= 04 PRODUCT ============================ */}
        <section id="lp-product" className="lp-sec lp-product" aria-labelledby="lp-p-h">
          <div className="lp-product-in">
            <div className="lp-product-copy">
              <p className="lp-cap">03 — The product</p>
              <h2 id="lp-p-h" className="lp-h2" data-lines>
                <Lines lines={["One book.", "Three taps."]} />
              </h2>
              <ol className="lp-pcaps">
                <li className="lp-pcap"><b>Log it.</b> On site, in seconds, by whoever is holding the phone.</li>
                <li className="lp-pcap"><b>Read it.</b> A ledger nobody can quietly edit after the fact.</li>
                <li className="lp-pcap"><b>Report it.</b> Cash flow by project, period and category.</li>
              </ol>
            </div>
            <div className="lp-phonestage" data-fade>
              <div id="lp-phone" className="lp-phone" role="img" aria-label="The Layaw System app: entry form, ledger and cash-flow report">
                <div className="lp-phone-notch" />
                <div className="lp-screens">
                  <div className="lp-screen"><ScreenEntry /></div>
                  <div className="lp-screen"><ScreenLedger /></div>
                  <div className="lp-screen"><ScreenReport /></div>
                  <div id="lp-sweep" className="lp-sweep" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================== 05 PAPER + 06 ROLES (light) ==================== */}
        <div id="lp-light" className="lp-light">
          <div id="lp-sheet" className="lp-sheet" />
          <div className="lp-sheet-rest" />
          <div className="lp-grid-bg" aria-hidden="true" />
          <div id="lp-wire" className="lp-wire" aria-hidden="true" />
          <div id="lp-edge" className="lp-edge" aria-hidden="true" />

          <section id="lp-paper" className="lp-sec lp-paper" aria-labelledby="lp-d-h">
            <div id="lp-paper-body" className="lp-wrap">
              <p className="lp-cap lp-dark">04 — The drawing set</p>
              <h2 id="lp-d-h" className="lp-h2 lp-dark" data-lines>
                <Lines lines={["Built like", "a drawing set."]} />
              </h2>
              <p className="lp-lede lp-dark">
                Construction accounting that behaves like construction: measured twice, recorded once,
                and nothing quietly moved after it&apos;s poured.
              </p>
              <div id="lp-cards" className="lp-cards">
                {FEATURES.map((f) => (
                  <article key={f.sheet} className="lp-card" data-sheen data-press data-fade>
                    <span className="lp-cap lp-dark">{f.sheet}</span>
                    <h3>{f.title}</h3>
                    <p>{f.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section id="lp-roles" className="lp-sec lp-roles" aria-labelledby="lp-r-h">
            <div className="lp-wrap">
              <p className="lp-cap lp-dark">05 — On site</p>
              <h2 id="lp-r-h" className="lp-h2 lp-dark" data-lines>
                <Lines lines={["Everyone gets", "exactly their part."]} />
              </h2>
              <div id="lp-rgrid" className="lp-rgrid">
                {ROLES.map((r) => (
                  <article key={r.n} className="lp-role" data-sheen data-press data-fade>
                    <i className="lp-ln lp-ln-h lp-ln-t" /><i className="lp-ln lp-ln-h lp-ln-b" />
                    <i className="lp-ln lp-ln-v lp-ln-l" /><i className="lp-ln lp-ln-v lp-ln-r" />
                    <div className="lp-role-in">
                      <span className="lp-cap lp-dark">{r.n}</span>
                      <h3>{r.name}</h3>
                      <p>{r.body}</p>
                      <ul>{r.can.map((c) => <li key={c}>{c}</li>)}</ul>
                    </div>
                    <div className="lp-wipe" aria-hidden="true" />
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* ============================== 07 CLOSING =========================== */}
        <section id="lp-closing" className="lp-sec lp-closing" aria-labelledby="lp-c-h">
          <div className="lp-bg" data-par="0.2" data-par-mode="enter" aria-hidden="true">
            <div className="lp-stars" />
          </div>
          <div className="lp-bigword lp-bw3" data-drift="1" aria-hidden="true">Solid</div>
          <div className="lp-closing-top">
            <p className="lp-cap" data-par="1.1" data-par-mode="enter">06 — Break ground</p>
            <h2 id="lp-c-h" className="lp-h1 lp-h1-sm" data-par="0.8" data-par-mode="enter" data-lines>
              <Lines lines={["Break", "ground."]} />
            </h2>
          </div>
          <div className="lp-closing-bot">
            <p className="lp-lede" data-par="1.1" data-par-mode="enter">
              Simple. Smart. Solid. Open the demo workspace and see a finished book.
            </p>
            <div id="lp-cta-wrap" className="lp-cta-wrap" data-fade>
              <a className="lp-cta" href="/t/genixes/login" data-magnetic data-cursor="Enter">
                <span className="lp-cta-in" data-press data-sheen>Open the demo workspace →</span>
              </a>
            </div>
            <p className="lp-foot lp-cap">Layaw System · Construction accounting</p>
          </div>
        </section>
      </main>
    </div>
  );
}
