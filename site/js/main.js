// LAYAW SYSTEM · site behaviour
// Everything here enhances a page that already works without it.

/* ---------------------------------------------------------
   Config: verify MESSENGER_URL against the real Facebook page.
   --------------------------------------------------------- */
const MESSENGER_URL = 'https://m.me/layawsystem';
const EMAIL = 'layawsystem@gmail.com';
const TZ = 'Asia/Manila';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;

const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = mqReduce.matches;
if (reduced) root.classList.add('reduced');

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  sget(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  sset(k, v) { try { sessionStorage.setItem(k, v); } catch {} },
};

$$('[data-messenger]').forEach((a) => (a.href = MESSENGER_URL));

/* ---------------------------------------------------------
   Loader: once per session, never longer than ~1.2s.
   --------------------------------------------------------- */
const firstVisit = !store.sget('layaw.seen') && !reduced;
if (!firstVisit) root.classList.add('skip-loader');
store.sset('layaw.seen', '1');
const loaded = new Promise((res) => {
  if (!firstVisit) return res();
  const done = () => { root.classList.add('is-loaded'); res(); };
  Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 900))])
    .then(() => setTimeout(done, 350));
});

/* ---------------------------------------------------------
   Cebu clock
   --------------------------------------------------------- */
const fmt = {
  hm: new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }),
  hms: new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
  h12: new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }),
  hour: new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: 'numeric', hour12: false }),
  date: new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' }),
};
const clocks = $$('[data-clock]');
const nowLine = $('[data-now-line]');
function partOfDay(h) {
  if (h < 5) return 'at night';
  if (h < 12) return 'in the morning';
  if (h < 13) return 'around noon';
  if (h < 18) return 'in the afternoon';
  if (h < 22) return 'in the evening';
  return 'at night';
}
function tick() {
  const d = new Date();
  clocks.forEach((el) => {
    el.textContent = fmt[el.dataset.format || 'hm'].format(d);
    el.dateTime = d.toISOString();
  });
  if (nowLine) {
    const h = +fmt.hour.format(d) % 24;
    nowLine.textContent = `It is ${fmt.h12.format(d).replace(/\s?(AM|PM)/, '')} ${partOfDay(h)} in Cebu.`;
  }
}
tick();
setInterval(tick, 1000);

/* ---------------------------------------------------------
   Smooth scroll (Lenis) + GSAP
   --------------------------------------------------------- */
const gsap = window.gsap;
const ST = window.ScrollTrigger;
const hasGsap = !!(gsap && ST);
if (!hasGsap) root.classList.add('no-gsap');
if (hasGsap) gsap.registerPlugin(ST);

let lenis = null;
if (!reduced && window.Lenis) {
  lenis = new window.Lenis({ lerp: 0.11, smoothWheel: true, wheelMultiplier: 0.95 });
  if (hasGsap) {
    lenis.on('scroll', ST.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
}

function scrollToTarget(target) {
  if (!target) return;
  if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.4 });
  else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  const target = id === '#top' ? $('#top') : $(id);
  if (!target) return;
  e.preventDefault();
  if (!menu.hidden) closeMenu(false);
  scrollToTarget(target);
  try { history.replaceState(null, '', id === '#top' ? location.pathname + location.search : id); } catch {}
});

/* ---------------------------------------------------------
   Navigation: condense, hide on the way down, return on the way up
   --------------------------------------------------------- */
const nav = $('[data-nav]');
let lastY = 0;
function onScrollNav(y) {
  nav.classList.toggle('is-scrolled', y > 24);
  const down = y > lastY && y > 320;
  if (Math.abs(y - lastY) > 6) nav.classList.toggle('is-hidden', down && menu.hidden);
  lastY = y;
}
if (lenis) lenis.on('scroll', ({ scroll }) => onScrollNav(scroll));
else addEventListener('scroll', () => onScrollNav(scrollY), { passive: true });
nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));

/* ---------------------------------------------------------
   Full-screen index (dialog with focus trap)
   --------------------------------------------------------- */
const menu = $('#index-menu');
const openBtn = $('[data-menu-open]');
function openMenu() {
  menu.hidden = false;
  openBtn.setAttribute('aria-expanded', 'true');
  root.classList.add('menu-open');
  lenis?.stop();
  $('.menu__list a', menu).focus();
  if (hasGsap && !reduced) {
    gsap.fromTo(menu, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: .8, ease: 'expo.inOut' });
    gsap.fromTo($$('.menu__list a', menu), { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .9, ease: 'expo.out', stagger: .045, delay: .25 });
    gsap.fromTo($$('.menu__side > *', menu), { opacity: 0 }, { opacity: 1, duration: .6, stagger: .06, delay: .5 });
  }
}
function closeMenu(returnFocus = true) {
  const finish = () => {
    menu.hidden = true;
    root.classList.remove('menu-open');
    lenis?.start();
    if (returnFocus) openBtn.focus();
  };
  openBtn.setAttribute('aria-expanded', 'false');
  if (hasGsap && !reduced && returnFocus) {
    gsap.to(menu, { clipPath: 'inset(0 0 100% 0)', duration: .6, ease: 'expo.inOut', onComplete: finish });
  } else finish();
}
openBtn.addEventListener('click', openMenu);
$('[data-menu-close]').addEventListener('click', () => closeMenu());
menu.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
  if (e.key !== 'Tab') return;
  const f = $$('a, button', menu).filter((el) => el.offsetParent !== null);
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

/* ---------------------------------------------------------
   Type: split headings into words (text stays readable to AT)
   --------------------------------------------------------- */
function splitWords(el, cls = 'w') {
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(' '); return; }
          const w = document.createElement('span');
          w.className = cls;
          if (cls === 'w') { const i = document.createElement('span'); i.className = 'wi'; i.textContent = part; w.append(i); }
          else w.textContent = part;
          frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
    });
  };
  walk(el);
  return $$(cls === 'w' ? '.wi' : '.' + cls, el);
}

/* ---------------------------------------------------------
   Hero monogram: real-time 3D where the device can afford it
   --------------------------------------------------------- */
const stage = $('[data-hero-stage]');
const canvas = $('[data-hero-canvas]');
const assemblyEl = $('[data-assembly]');
const lockEl = $('[data-lockstate]');
let monogram = null;

function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
  catch { return false; }
}
const conn = navigator.connection || {};
const mem = navigator.deviceMemory || 8;
const cores = navigator.hardwareConcurrency || 8;
const lowPower = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '') || mem <= 2 || cores <= 2;
const lite = innerWidth < 900 || mem <= 4 || cores <= 4;

async function initHero() {
  if (reduced || lowPower || !webglOK()) return;           // poster stays: same mark, no cost
  try {
    const { createMonogram } = await import('./hero.js');
    monogram = createMonogram(canvas, {
      lite,
      onLock(pct, locked) {
        assemblyEl.textContent = String(pct).padStart(3, '0');
        lockEl.textContent = locked ? 'Locked' : 'Seating';
      },
      onFirstFrame() { root.classList.add('has-3d'); },
    });
  } catch (err) {
    console.warn('Monogram fell back to poster.', err);
  }
}
// Let the first paint and the headline win; bring the 3D in right after.
const whenIdle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 300));
if (document.readyState === 'complete') whenIdle(initHero);
else addEventListener('load', () => whenIdle(initHero), { once: true });

/* ---------------------------------------------------------
   Ecosystem wiring: every system routes to the shared core
   --------------------------------------------------------- */
const eco = $('.eco');
const wires = $('[data-eco-wires]');
const core = $('[data-eco-core]');
const sysRows = $$('[data-sys]');
const SVGNS = 'http://www.w3.org/2000/svg';
const wireEls = sysRows.map(() => {
  const base = document.createElementNS(SVGNS, 'path');
  const pulse = document.createElementNS(SVGNS, 'path');
  pulse.classList.add('pulse');
  wires.append(base, pulse);
  return { base, pulse };
});
function routeWires() {
  const box = eco.getBoundingClientRect();
  const c = core.getBoundingClientRect();
  const side = innerWidth >= 900;
  sysRows.forEach((row, i) => {
    const n = $('[data-node]', row).getBoundingClientRect();
    const nx = n.left + n.width / 2 - box.left;
    const ny = n.top + n.height / 2 - box.top;
    let d;
    if (side) {
      const cx = c.right - box.left;
      const cy = c.top + c.height / 2 - box.top + (i - 3) * 6;  // fan out at the core
      // Route the bus through the empty gutter between the intro and the list.
      const gapL = $('.eco__intro').getBoundingClientRect().right - box.left + 16;
      const gapR = $('.eco__list').getBoundingClientRect().left - box.left - 16;
      const mid = gapL + (gapR - gapL) * (0.15 + i * 0.1);
      d = `M${nx - 6} ${ny} H${mid} V${cy} H${cx}`;
    } else {
      const cx = c.left - box.left + 12;
      const cy = c.bottom - box.top;
      d = `M${nx} ${ny} H${cx} V${cy}`;
    }
    wireEls[i].base.setAttribute('d', d);
    wireEls[i].pulse.setAttribute('d', d);
  });
}
function pulse(i) {
  const { pulse: p } = wireEls[i];
  const len = p.getTotalLength();
  p.style.setProperty('--len', -(len + 26));
  p.classList.remove('go');
  void p.getBoundingClientRect();
  p.classList.add('go');
  sysRows[i].classList.add('is-hot');
  clearTimeout(p._t);
  p._t = setTimeout(() => { core.classList.add('is-hot'); sysRows[i].classList.remove('is-hot'); setTimeout(() => core.classList.remove('is-hot'), 500); }, reduced ? 0 : 1000);
}
let wireRaf = 0;
const scheduleRoute = () => { cancelAnimationFrame(wireRaf); wireRaf = requestAnimationFrame(routeWires); };
routeWires();
addEventListener('resize', scheduleRoute);
if (lenis) lenis.on('scroll', scheduleRoute); else addEventListener('scroll', scheduleRoute, { passive: true });
document.fonts?.ready.then(scheduleRoute);
sysRows.forEach((row, i) => {
  row.addEventListener('pointerenter', () => pulse(i));
  row.addEventListener('focusin', () => pulse(i));
});
// Ambient traffic while the section is on screen: the systems talk to the core.
if (!reduced) {
  let amb = 0;
  new IntersectionObserver(([en]) => {
    clearInterval(amb);
    if (en.isIntersecting) amb = setInterval(() => pulse(Math.floor(Math.random() * sysRows.length)), 2400);
  }, { threshold: 0.2 }).observe(eco);
}

/* ---------------------------------------------------------
   Work mockups: fill calendar and court grid
   --------------------------------------------------------- */
(function fillCalendar() {
  const grid = $('[data-cal]');
  if (!grid) return;
  const first = new Date(2026, 10, 1).getDay();             // Nov 2026
  const booked = new Set([3, 4, 5, 9, 10, 20, 21, 22, 27, 28]);
  const stay = new Set([13, 14, 15]);
  let html = '';
  for (let i = 0; i < first; i++) html += '<span class="e"></span>';
  for (let d = 1; d <= 30; d++) html += `<span class="${booked.has(d) ? 'b' : stay.has(d) ? 's' : ''}">${d}</span>`;
  grid.innerHTML = html;
})();
(function fillCourts() {
  const grid = $('[data-courts]');
  if (!grid) return;
  const times = ['6a', '7a', '8a', '9a', '4p', '5p', '6p', '7p', '8p'];
  const taken = ['0-1', '0-3', '1-0', '1-1', '2-2', '4-1', '5-0', '5-1', '5-3', '6-0', '6-1', '6-2', '6-3', '7-2', '8-0'];
  let html = '<span class="h"></span>' + [1, 2, 3, 4].map((c) => `<span class="h">C${c}</span>`).join('');
  times.forEach((t, r) => {
    html += `<span class="t">${t}</span>`;
    for (let c = 0; c < 4; c++) {
      const k = `${r}-${c}`;
      html += `<span class="${taken.includes(k) ? 'x' : k === '7-1' ? 'p' : ''}"></span>`;
    }
  });
  grid.innerHTML = html;
})();

/* ---------------------------------------------------------
   System Builder configurator + light personalisation
   --------------------------------------------------------- */
const INDUSTRIES = {
  cafe: {
    code: 'CAF', noun: 'café', title: 'A system for a café',
    summary: 'Built around the counter. The queue moves, the stock keeps up, and the day closes itself.',
    hero: 'Point of sale, stock, and the daily report for Philippine cafés, built in Cebu. We build the one that fits. Then we stay.',
    modules: [
      ['Counter POS', 'LAYAW POS', 'Orders, add-ons, and split payments on one tablet.'],
      ['Stock and supply', 'LAYAW POS', 'Beans, milk, and cups go down with every sale. Low stock flags itself.'],
      ['Owner\'s phone', 'LAYAW POS', 'Live sales and the closing report, wherever you are.'],
      ['Books', 'LAYAW Accounting', 'Daily totals flow into the ledger. Nothing typed twice.'],
    ],
    devices: 'Counter tablet and the owner\'s phone.',
    wins: ['Closing takes minutes, not an hour of tallying.', 'You know what sold and what ran out, today.', 'A new cashier learns it in one shift.'],
  },
  clinic: {
    code: 'CLN', noun: 'clinic', title: 'A system for a clinic',
    summary: 'Patients book a real open slot. The front desk stops guessing. Every doctor sees the same day.',
    hero: 'Appointments, payments, and one shared schedule for Philippine clinics, built in Cebu. We build the one that fits. Then we stay.',
    modules: [
      ['Online appointments', 'Booking System', 'Patients choose from slots that are actually free. No double bookings.'],
      ['Front desk schedule', 'Booking System', 'One calendar for every doctor, room, and service.'],
      ['Payments at booking', 'Booking System', 'Card or e-wallet when they book, so fewer empty slots.'],
      ['Staff and records', 'Company System', 'Schedules, requests, and files for the team, in one place.'],
    ],
    devices: 'Front desk computer and your patients\' phones.',
    wins: ['The phone stops ringing just to ask what is free.', 'Fewer no-shows once a slot is paid for.', 'Doctors and the desk read the same schedule.'],
  },
  court: {
    code: 'CRT', noun: 'court', title: 'A system for a sports court',
    summary: 'Players book and pay on their own. The schedule is always right. Promos apply themselves.',
    hero: 'Court booking, payments, and vouchers for Philippine sports clubs, built in Cebu. We build the one that fits. Then we stay.',
    modules: [
      ['Court booking', 'Booking System', 'Real-time slots for every court, on any phone.'],
      ['Multi-date and vouchers', 'Booking System', 'Book several dates at once. Promo codes that check themselves.'],
      ['Advance window', 'Booking System', 'Open bookings up to 30 days ahead, on your rules.'],
      ['Pro shop and drinks', 'LAYAW POS', 'Paddles, balls, and drinks rung up at the same desk.'],
    ],
    devices: 'Players\' phones and a desk tablet.',
    wins: ['No more "may bakante pa ba?" messages all day.', 'Courts are paid for before players arrive.', 'Promos run without manual discounts.'],
  },
  construction: {
    code: 'CON', noun: 'construction company', title: 'A system for a contractor',
    summary: 'Every site, every crew, every peso, traced to a project. The office and the site finally agree.',
    hero: 'Projects, site expenses, payroll, and collections for Philippine contractors, built in Cebu. We build the one that fits. Then we stay.',
    modules: [
      ['Projects and sites', 'Construction Manager', 'Each site with its budget, crew, and progress.'],
      ['Site expenses', 'Construction Manager', 'Logged from the site on a phone. The office sees it the same day.'],
      ['Payroll and collections', 'LAYAW Accounting', 'Append-only registers. Mistakes are voided, never deleted.'],
      ['Contracts and sign-offs', 'LAYAW PDF Pro', 'Sign and protect documents offline, no upload.'],
    ],
    devices: 'Office computer and the foremen\'s phones.',
    wins: ['The office and the site agree on the numbers.', 'Every expense is tied to a project.', 'Payroll stops living in a second spreadsheet.'],
  },
  rental: {
    code: 'RNT', noun: 'rental', title: 'A system for a rental',
    summary: 'Your own booking site with live rates and a real calendar. Guests pay up front. Channels stay in sync.',
    hero: 'Direct bookings, live rates, and channel sync for Philippine rentals, built in Cebu. We build the one that fits. Then we stay.',
    modules: [
      ['Direct booking site', 'Booking System', 'Your own site with live rates and a real availability calendar.'],
      ['Card and e-wallet', 'Booking System', 'Guests pay when they book, in pesos.'],
      ['Channel sync', 'Booking System', 'Calendars stay aligned with the platforms you list on.'],
      ['Owner view', 'Company System', 'Occupancy, payments, and turnovers at a glance.'],
    ],
    devices: 'Guests\' phones and the owner\'s phone.',
    wins: ['More bookings that skip the platform fee.', 'No double bookings across channels.', 'Guests pay before they arrive.'],
  },
};

const build = $('[data-build]');
const enquiry = $('[data-enquiry]');
const mailBtn = $('[data-send-mail]');
const copiedEl = $('[data-copied]');
const defaults = {
  hero: $('[data-personal="hero"]').textContent,
  contact: $('[data-personal="contact"]').textContent,
};

function message(ind) {
  return [
    'Hi LAYAW,',
    '',
    `I run a ${ind.noun} and I would like to talk about a system for it.`,
    '',
    'What I have in mind:',
    ...ind.modules.map(([n]) => `- ${n}`),
    '',
    'What slows us down today:',
    '',
    '',
    'Best time to call:',
    '',
    'Thank you.',
  ].join('\n');
}
function syncMail() {
  const ind = INDUSTRIES[build.dataset.industry];
  const subject = ind ? `New project: ${ind.title.replace(/^A /, '')}` : 'New project';
  mailBtn.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(enquiry.value)}`;
}
enquiry.addEventListener('input', syncMail);

function renderBuild(key, animate) {
  const ind = INDUSTRIES[key];
  if (!ind) return;
  build.dataset.industry = key;
  const d = new Date();
  $('[data-build-code]').textContent = `LYW-${ind.code}-${fmt.hm.format(d).replace(':', '')}${String(d.getSeconds()).padStart(2, '0')}`;
  $('[data-build-date]').textContent = fmt.date.format(d);
  $('[data-build-title]').textContent = ind.title;
  $('[data-build-summary]').textContent = ind.summary;
  $('[data-build-devices]').textContent = ind.devices;
  $('[data-build-wins]').innerHTML = ind.wins.map((w) => `<li>${w}</li>`).join('');
  $('[data-build-modules]').innerHTML = ind.modules.map(([n, s, desc], i) => `
    <li class="mod">
      <span class="mono mod__no">M${String(i + 1).padStart(2, '0')}</span>
      <p class="mod__name">${n}</p>
      <p class="mod__desc">${desc}</p>
      <p class="mono mod__sys">${s}</p>
      <span class="mod__bar" aria-hidden="true"></span>
    </li>`).join('');
  enquiry.value = message(ind);
  syncMail();
  copiedEl.textContent = '';
  build.dataset.state = 'ready';

  if (animate && hasGsap && !reduced) {
    const sheet = $('.build__sheet', build);
    const tl = gsap.timeline();
    tl.fromTo(sheet, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 1.1, ease: 'power3.inOut' })
      .from($$('.build__top, .build__title, .build__summary', sheet), { y: 16, opacity: 0, duration: .6, stagger: .08, ease: 'expo.out' }, .15)
      .from($$('.mod', sheet), { y: 40, opacity: 0, duration: .8, stagger: .12, ease: 'expo.out' }, .35)
      .fromTo($$('.mod__bar', sheet), { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: .7, stagger: .12, ease: 'power2.inOut' }, .5)
      .to($$('.mod__bar', sheet), { opacity: 0, duration: .5, stagger: .12 }, '>-0.2')
      .from($$('.build__meta, .build__send', sheet), { opacity: 0, y: 20, duration: .7, stagger: .1, ease: 'expo.out' }, 1.0)
      .add(() => ST?.refresh());
  } else ST?.refresh();
}

function personalise(key) {
  const ind = INDUSTRIES[key];
  if (!ind) return;
  $('[data-personal="hero"]').textContent = ind.hero;
  $('[data-personal="contact"]').textContent = `Tell us how your ${ind.noun} runs.`;
  const mail = $('[data-contact-mail]');
  mail.href = `mailto:${EMAIL}?subject=${encodeURIComponent(`New project: ${ind.title.replace(/^A /, '')}`)}`;

  // Featured work: lead with the closest match.
  const track = $('[data-reel-track]');
  const frames = $$('.frame', track);
  frames.forEach((f) => {
    const match = f.dataset.industry.split(' ').includes(key);
    f.classList.toggle('is-match', match);
    $('[data-for-label]', f).textContent = match ? `Closest to your ${ind.noun}` : '';
  });
  const lead = frames.find((f) => f.classList.contains('is-match'));
  if (lead && track.firstElementChild !== lead) track.prepend(lead);
  $$('.frame', track).forEach((f, i) => { $('.frame__tc span', f).textContent = `Reel ${String(i + 1).padStart(2, '0')}`; });
}

$$('[data-picker] input').forEach((input) => {
  input.addEventListener('change', () => {
    renderBuild(input.value, true);
    personalise(input.value);
    store.set('layaw.industry', input.value);
    try {
      const u = new URL(location.href);
      u.searchParams.set('for', input.value);
      history.replaceState(null, '', u);
    } catch {}
  });
});

$('[data-send-messenger]').addEventListener('click', async () => {
  let ok = false;
  try { await navigator.clipboard.writeText(enquiry.value); ok = true; } catch {}
  copiedEl.textContent = ok ? 'Copied. Paste it into the chat.' : 'Select the message above and copy it.';
  window.open(MESSENGER_URL, '_blank', 'noopener');
});
$('[data-copy-email]').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  try { await navigator.clipboard.writeText(EMAIL); btn.textContent = 'Copied'; }
  catch { btn.textContent = EMAIL; }
  setTimeout(() => (btn.textContent = 'Copy email address'), 2400);
});

// Restore: ?for=court (shareable, for ads) wins over a remembered choice.
const param = new URLSearchParams(location.search).get('for');
const remembered = INDUSTRIES[param] ? param : store.get('layaw.industry');
if (INDUSTRIES[remembered]) {
  const input = $(`[data-picker] input[value="${remembered}"]`);
  input.checked = true;
  renderBuild(remembered, false);
  personalise(remembered);
}

/* ---------------------------------------------------------
   Choreography
   --------------------------------------------------------- */
const statement = $('[data-scrub-words]');
const statementWords = splitWords(statement, 'sw');

if (!hasGsap || reduced) {
  statementWords.forEach((w) => w.classList.add('on'));
  root.classList.add('no-gsap');
} else {
  // Headline words rise into place once the loader clears.
  const heads = $$('[data-split]').map((el) => ({ el, words: splitWords(el) }));
  const heroHead = heads.shift();
  gsap.set(heroHead.words, { yPercent: 110 });
  gsap.set('.hero__sub, .hero__foot, .eyebrow', { opacity: 0, y: 18 });
  loaded.then(() => {
    gsap.to(heroHead.words, { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: .06, delay: .1 });
    gsap.to('.eyebrow, .hero__sub, .hero__foot', { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: .1, delay: .45 });
  });
  heads.forEach(({ el, words }) => {
    gsap.set(words, { yPercent: 110 });
    ST.create({ trigger: el, start: 'top 86%', once: true, onEnter: () => gsap.to(words, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: .045 }) });
  });

  // Hero: the monogram turns and opens as you leave.
  ST.create({
    trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true,
    onUpdate: (self) => monogram?.setScroll(self.progress),
  });
  gsap.to('.hero__copy', { yPercent: -12, opacity: .2, ease: 'none', scrollTrigger: { trigger: '.hero', start: '30% top', end: 'bottom top', scrub: true } });

  // Position: the statement lights word by word as it is read.
  ST.create({
    trigger: statement, start: 'top 78%', end: 'bottom 42%', scrub: true,
    onUpdate: (self) => {
      const n = Math.round(self.progress * statementWords.length);
      statementWords.forEach((w, i) => w.classList.toggle('on', i < n));
    },
  });

  // Generic reveals
  ST.batch('[data-reveal]', {
    start: 'top 88%', once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: .1 }),
  });

  // Ecosystem: rows settle, wires draw from each system toward the core.
  gsap.from('.sys', { opacity: 0, y: 24, duration: 1, ease: 'expo.out', stagger: .07, scrollTrigger: { trigger: '.eco__list', start: 'top 80%', once: true } });
  ST.create({
    trigger: '.eco', start: 'top 70%', once: true,
    onEnter: () => {
      routeWires();
      wireEls.forEach(({ base }, i) => {
        const len = base.getTotalLength();
        gsap.fromTo(base, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut', delay: .25 + i * .08, onComplete: () => { base.style.strokeDasharray = ''; } });
      });
    },
  });

  // PDF Pro: highlight, scan, sign, protect, in that order as you read.
  const sig = $('[data-signature]');
  const sigLen = sig.getTotalLength();
  gsap.set(sig, { strokeDasharray: sigLen, strokeDashoffset: sigLen });
  gsap.set('.sheet__lines .hl', { '--hl': 0 });
  gsap.set('[data-stamp]', { opacity: 0, scale: 1.8 });
  // The headline gets highlighted the way PDF Pro highlights a page.
  gsap.fromTo('[data-hl-mark]', { '--mark': '0%' }, { '--mark': '100%', duration: 1.1, ease: 'power2.inOut', scrollTrigger: { trigger: '.pdf__title', start: 'top 72%', once: true } });
  const doc = gsap.timeline({ scrollTrigger: { trigger: '.pdf', start: 'top 60%', end: 'center 40%', scrub: 0.8 } });
  doc.to('.sheet__lines .hl', { '--hl': 1, duration: .6, ease: 'none' })
    .fromTo('[data-ocr]', { top: '0%', opacity: 0 }, { top: '100%', opacity: 1, duration: 1, ease: 'none' }, .2)
    .to('[data-ocr]', { opacity: 0, duration: .15 })
    .to(sig, { strokeDashoffset: 0, duration: 1.4, ease: 'none' })
    .to('[data-stamp]', { opacity: 1, scale: 1, duration: .3, ease: 'back.out(2)' });

  // Work: a horizontal film reel on desktop, a vertical one on phones.
  const mm = gsap.matchMedia();
  mm.add('(min-width: 1200px)', () => {
    const work = $('.work');
    const track = $('[data-reel-track]');
    work.classList.add('is-horizontal');
    const dist = () => track.scrollWidth - innerWidth;
    const tween = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: '[data-reel]', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1,
        onUpdate: (self) => {
          const n = $$('.frame', track).length;
          $('[data-reel-bar]').style.setProperty('--rp', self.progress.toFixed(3));
          $('[data-reel-count]').textContent = `${String(Math.min(n, Math.round(self.progress * (n - 1)) + 1)).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
        },
      },
    });
    $$('.frame__device', track).forEach((dev) => {
      gsap.fromTo(dev, { xPercent: 6 }, { xPercent: -4, ease: 'none', scrollTrigger: { trigger: dev.closest('.frame'), containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
    });
    return () => work.classList.remove('is-horizontal');
  });
  mm.add('(max-width: 1199px)', () => {
    $$('.frame').forEach((f) => {
      gsap.from($('.frame__device', f), { y: 60, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: f, start: 'top 80%', once: true } });
    });
  });

  // S.E.C.: letters settle with a small, heavy drift.
  $$('.sec__letter').forEach((l) => {
    gsap.fromTo(l, { yPercent: 18 }, { yPercent: -6, ease: 'none', scrollTrigger: { trigger: l, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // Process: the rail fills as the steps pass.
  gsap.fromTo('[data-process-fill]', { '--p': 0 }, { '--p': 1, ease: 'none', scrollTrigger: { trigger: '.process__steps', start: 'top 75%', end: 'bottom 60%', scrub: true } });
  $('[data-process-fill]').style.transform = 'scaleX(var(--p))';

  document.fonts?.ready.then(() => ST.refresh());
}
