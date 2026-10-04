/* =====================================================================
   LAYAW SYSTEM: site behaviour
   Plain script, no build step. Every feature checks for its own markup,
   so a missing section never breaks the rest.
   ===================================================================== */
(function () {
  'use strict';

  var doc = document.documentElement;
  var SCRIPT_URL = document.currentScript && document.currentScript.src;
  var mq = function (q) { return window.matchMedia && window.matchMedia(q).matches; };
  var REDUCED = mq('(prefers-reduced-motion: reduce)');
  var FINE = mq('(hover: hover) and (pointer: fine)');
  var MESSENGER = 'https://m.me/61591455718209';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- Safe storage (private windows can throw) ---------- */
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };

  /* ---------- Interest memory: which systems this visitor engages with ---------- */
  var interest = store.get('layaw.interest', {});
  function noteInterest(id, weight) {
    interest[id] = (interest[id] || 0) + (weight || 1);
    store.set('layaw.interest', interest);
    renderPersonal();
  }
  function topInterest() {
    var best = null, score = 0;
    Object.keys(interest).forEach(function (k) { if (interest[k] > score) { best = k; score = interest[k]; } });
    return score >= 2 ? best : null;
  }

  /* =====================================================================
     1. Cebu clock and Cebuano greeting
     ===================================================================== */
  function cebuParts(now) {
    var f = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true });
    var h = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', hourCycle: 'h23' }).format(now), 10);
    return { label: f.format(now), hour: h % 24 };
  }
  function greeting(h) {
    if (h >= 4 && h < 12) return ['Maayong buntag', 'Good morning'];
    if (h === 12) return ['Maayong udto', 'Good noon'];
    if (h > 12 && h < 18) return ['Maayong hapon', 'Good afternoon'];
    return ['Maayong gabii', 'Good evening'];
  }
  function offsetNote() {
    var visitor = -new Date().getTimezoneOffset() / 60;
    var diff = 8 - visitor;
    if (diff === 0) return '';
    var n = Math.abs(diff);
    var hrs = (n % 1 === 0 ? n : n.toFixed(1)) + (n === 1 ? ' hour' : ' hours');
    return ', ' + hrs + (diff > 0 ? ' ahead of you' : ' behind you');
  }
  function tick() {
    var p = cebuParts(new Date());
    var g = greeting(p.hour);
    $$('[data-greet]').forEach(function (el) { el.textContent = g[0]; el.title = 'Cebuano for "' + g[1] + '"'; });
    $$('[data-clock]').forEach(function (el) { el.textContent = p.label + ' in Cebu' + offsetNote(); });
    $$('[data-clock-short]').forEach(function (el) { el.textContent = 'Cebu ' + p.label; });
  }
  try { tick(); setInterval(tick, 30000); } catch (e) { /* Intl missing: static text stays */ }
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* =====================================================================
     2. Navigation: solid on scroll, hides going down, current section
     ===================================================================== */
  var nav = $('[data-nav]');
  var menu = $('[data-menu]');
  var menuBtn = $('[data-menu-toggle]');
  var lastY = window.scrollY;
  function onScrollNav() {
    var y = window.scrollY;
    if (!nav) return;
    nav.classList.toggle('is-solid', y > 40);
    var menuOpen = menu && !menu.hidden;
    nav.classList.toggle('is-away', !menuOpen && y > 640 && y > lastY + 2);
    if (y < lastY - 2) nav.classList.remove('is-away');
    lastY = y;
  }

  if ('IntersectionObserver' in window) {
    var links = $$('.nav__links a');
    var secIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle('is-current', a.getAttribute('href') === '#' + en.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['systems', 'builder', 'work', 'standard', 'contact'].forEach(function (id) { var s = document.getElementById(id); if (s) secIO.observe(s); });
  }

  /* Menu overlay */
  function setMenu(open) {
    if (!menu || !menuBtn) return;
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    $('.nav__menu-text', menuBtn).textContent = open ? 'Close' : 'Menu';
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) { nav.classList.remove('is-away'); var first = $('a', menu); if (first) first.focus(); }
  }
  if (menuBtn) {
    menuBtn.addEventListener('click', function () { setMenu(menu.hidden); });
    $$('[data-menu-link]').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); } });
  }

  /* =====================================================================
     3. Reveals (content is visible without JS; see CSS guards)
     ===================================================================== */
  var revealEls = $$('[data-reveal], .steps');
  if ('IntersectionObserver' in window && !REDUCED) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* =====================================================================
     4. Custom cursor (fine pointers only, never with reduced motion)
     ===================================================================== */
  var cursor = $('.cursor');
  if (cursor && FINE && !REDUCED) {
    doc.classList.add('has-cursor');
    var dot = $('.cursor__dot', cursor), ring = $('.cursor__ring', cursor), label = $('.cursor__label', cursor);
    var mx = -100, my = -100, rx = -100, ry = -100;
    window.addEventListener('pointermove', function (e) {
      mx = e.clientX; my = e.clientY;
      cursor.classList.remove('is-hidden');
      var t = e.target.closest ? e.target : null;
      var lab = t && t.closest('[data-cursor]');
      var link = t && t.closest('a, button, label, [role="tab"]');
      cursor.classList.toggle('is-label', !!lab);
      cursor.classList.toggle('is-link', !lab && !!link);
      cursor.classList.toggle('on-paper', !!(t && t.closest('.paper')));
      label.textContent = lab ? lab.getAttribute('data-cursor') : '';
    }, { passive: true });
    document.addEventListener('pointerleave', function () { cursor.classList.add('is-hidden'); });
    (function loop() {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
      ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
      requestAnimationFrame(loop);
    })();
  }

  /* =====================================================================
     5. The ecosystem: seven systems, one standard
     ===================================================================== */
  var SYSTEMS = [
    { id: 'builder', name: 'System Builder', kind: 'Discovery studio', live: false, state: 'Every build starts here', pos: [50, 50],
      lede: 'The discovery studio that scopes every LAYAW build. We map how your business really runs before a single screen is drawn, so you only pay for what you will use.',
      caps: ['Workflow mapping', 'People and roles', 'Where every number comes from', 'Written scope and price', 'What we will not build', 'Launch and training plan'],
      fits: 'Any business about to spend on software, and any business that already did and regrets it.',
      links: ['company', 'accounting', 'pos', 'booking', 'pm', 'pdf'] },
    { id: 'accounting', name: 'LAYAW Accounting', kind: 'Books and registers', live: false, state: 'Built on request', pos: [50, 13],
      lede: 'Books that stay current on their own. Expenses, payroll, collections and transfers live in registers where nothing is ever deleted: mistakes are voided with a reason, and every change is audited.',
      caps: ['Expense, payroll and collection registers', 'Void with reason, never delete', 'Audit trail on every entry', 'Roles for encoder, foreman, bookkeeper, owner', 'Project and period reports', 'Your branding, your modules'],
      fits: 'Contractors, multi-site operators and owners who want to trust the numbers without redoing them.',
      links: ['pos', 'booking', 'pm', 'company'] },
    { id: 'pos', name: 'LAYAW POS', kind: 'Point of sale', live: true, state: 'Available now', pos: [82, 31.5],
      lede: 'Point of sale for retail and food. Sales, inventory, supply flow and the daily report, on the tablet or phone you already own.',
      caps: ['Fast counter sales', 'Inventory that counts down as it sells', 'Supply runs logged where they happen', 'Daily report on the owner\'s phone', 'Works on tablet and phone', 'Café demo workspace to try'],
      fits: 'Cafés, restaurants, bakeries, sari-sari and specialty retail.',
      links: ['accounting', 'company'] },
    { id: 'booking', name: 'Booking System', kind: 'Online booking', live: true, state: 'Available now', pos: [82, 68.5],
      lede: 'Online booking for courts, clinics, rooms and services. Real-time slots so nobody double-books, and payment taken at the moment of booking.',
      caps: ['Real-time availability', 'Card and e-wallet payments', 'Multi-date booking', 'Vouchers and promo codes', 'Live rates', 'Your own domain'],
      fits: 'Sports clubs, clinics, short-term rentals, salons and studios.',
      links: ['accounting', 'company'] },
    { id: 'pdf', name: 'LAYAW PDF Pro', kind: 'Windows PDF editor', live: true, state: 'Available now', pos: [50, 87],
      lede: 'A full offline PDF editor for Windows. Edit, annotate, merge, split, convert, e-sign, OCR and protect. One-time licence, no subscription, and nothing is ever uploaded.',
      caps: ['Edit text and images', 'Annotate and comment', 'Merge and split', 'Convert to and from Office', 'E-sign', 'OCR scanned pages', 'Password protect', 'Works fully offline'],
      fits: 'Any office that handles contracts, permits, payslips or receipts.',
      links: ['company'] },
    { id: 'company', name: 'Company System', kind: 'Full company platform', live: false, state: 'Built on request', pos: [18, 68.5],
      lede: 'One platform for the whole company, shaped around your departments, approvals and reports instead of someone else\'s org chart.',
      caps: ['Departments and roles', 'Approvals that follow your rules', 'One login across systems', 'Company-wide reporting', 'Connects every LAYAW system', 'Grows as you add branches'],
      fits: 'Growing companies running several teams, sites or branches.',
      links: ['accounting', 'pos', 'booking', 'pm', 'pdf'] },
    { id: 'pm', name: 'LAYAW Project Manager', kind: 'Construction jobs', live: true, state: 'Available now', pos: [18, 31.5],
      lede: 'An entire construction job in one record: schedule, bill of quantities, warehouse, purchasing, billing, books and payroll.',
      caps: ['Schedule', 'Bill of quantities', 'Warehouse and issues', 'Purchasing', 'Progress billing', 'Books and payroll'],
      fits: 'General contractors, specialty trades and developers.',
      links: ['accounting', 'company'] }
  ];
  var BY_ID = {}; SYSTEMS.forEach(function (s) { BY_ID[s.id] = s; });
  // Data flows (entered once, lands in the second system)
  var FLOWS = [['pos', 'accounting'], ['booking', 'accounting'], ['pm', 'accounting'], ['company', 'accounting'], ['pdf', 'company'], ['pm', 'company']];

  var eco = $('[data-eco]');
  if (eco) {
    var nodesWrap = $('[data-eco-nodes]', eco), lines = $('[data-eco-lines]', eco), panel = $('[data-eco-panel]', eco);
    var NS = 'http://www.w3.org/2000/svg';
    var cubeSVG = '<svg class="node__cube" viewBox="0 0 54 62" aria-hidden="true"><path class="t" d="M27 1 L53 16 L27 31 L1 16 Z"/><path class="l" d="M1 16 L27 31 L27 61 L1 46 Z"/><path class="r" d="M27 31 L53 16 L53 46 L27 61 Z"/></svg>';

    // Hexagon outline through the six outer nodes
    var outer = SYSTEMS.filter(function (s) { return s.id !== 'builder'; });
    var hexRing = ['accounting', 'pos', 'booking', 'pdf', 'company', 'pm'].map(function (id) { return BY_ID[id].pos; });
    var hex = document.createElementNS(NS, 'path');
    hex.setAttribute('class', 'hex');
    hex.setAttribute('d', 'M' + hexRing.map(function (p) { return p[0] + ' ' + p[1]; }).join(' L') + ' Z');
    lines.appendChild(hex);

    var lineEls = [];
    outer.forEach(function (s) {
      var l = document.createElementNS(NS, 'path');
      l.setAttribute('class', 'scope');
      l.setAttribute('d', 'M50 50 L' + s.pos[0] + ' ' + s.pos[1]);
      l.dataset.a = 'builder'; l.dataset.b = s.id;
      lines.appendChild(l); lineEls.push(l);
    });
    FLOWS.forEach(function (f, i) {
      var a = BY_ID[f[0]].pos, b = BY_ID[f[1]].pos;
      // Straight chords: a clean constellation, never through the hub
      var d = 'M' + a[0] + ' ' + a[1] + ' L' + b[0] + ' ' + b[1];
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('class', 'flow'); p.setAttribute('d', d); p.id = 'flow-' + i;
      p.dataset.a = f[0]; p.dataset.b = f[1];
      lines.appendChild(p); lineEls.push(p);
      if (!REDUCED) {
        var c = document.createElementNS(NS, 'circle');
        c.setAttribute('class', 'pulse'); c.setAttribute('r', '0.9');
        var am = document.createElementNS(NS, 'animateMotion');
        am.setAttribute('dur', (3.2 + i * 0.4) + 's'); am.setAttribute('repeatCount', 'indefinite');
        am.setAttribute('path', d);
        c.appendChild(am); lines.appendChild(c);
      }
    });

    // Nodes as an accessible tab list
    SYSTEMS.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'node' + (s.id === 'builder' ? ' node--hub' : '');
      b.setAttribute('role', 'tab');
      b.id = 'node-' + s.id;
      b.setAttribute('aria-controls', 'eco-panel');
      b.dataset.id = s.id;
      b.style.left = s.pos[0] + '%'; b.style.top = s.pos[1] + '%';
      b.innerHTML = cubeSVG + '<span class="node__name">' + s.name + '</span><span class="node__state">' + s.state + '</span>';
      b.addEventListener('click', function () { select(s.id, true); });
      b.addEventListener('pointerenter', function () { highlight(s.id); });
      b.addEventListener('pointerleave', function () { highlight(current); });
      nodesWrap.appendChild(b);
    });
    panel.id = 'eco-panel';

    // Arrow keys move between systems (roving tabindex)
    nodesWrap.addEventListener('keydown', function (e) {
      var keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (!(e.key in keys) && e.key !== 'Home' && e.key !== 'End') return;
      e.preventDefault();
      var i = SYSTEMS.findIndex(function (s) { return s.id === current; });
      if (e.key === 'Home') i = 0; else if (e.key === 'End') i = SYSTEMS.length - 1;
      else i = (i + keys[e.key] + SYSTEMS.length) % SYSTEMS.length;
      select(SYSTEMS[i].id, true);
      document.getElementById('node-' + SYSTEMS[i].id).focus();
    });

    var current = null;
    function highlight(id) {
      lineEls.forEach(function (l) {
        var hot = id === 'builder' ? l.classList.contains('scope') : (l.dataset.a === id || l.dataset.b === id);
        l.classList.toggle('hot', hot);
      });
    }
    function select(id, byUser) {
      var s = BY_ID[id]; if (!s) return;
      current = id;
      $$('.node', nodesWrap).forEach(function (n) {
        var on = n.dataset.id === id;
        n.setAttribute('aria-selected', String(on));
        n.tabIndex = on ? 0 : -1;
      });
      panel.setAttribute('aria-labelledby', 'node-' + id);
      highlight(id);
      var connects = s.links.map(function (l) { return '<button type="button" data-go="' + l + '">' + BY_ID[l].name + '</button>'; }).join('');
      panel.innerHTML =
        '<div class="panel__top"><span class="mono" style="color:var(--ice)">' + s.kind + '</span><span class="pill' + (s.live ? ' pill--live' : '') + '">' + s.state + '</span></div>' +
        '<h3 class="panel__name">' + s.name + '</h3>' +
        '<p class="panel__lede">' + s.lede + '</p>' +
        '<ul class="panel__caps">' + s.caps.map(function (c) { return '<li>' + c + '</li>'; }).join('') + '</ul>' +
        '<dl class="panel__meta"><dt class="mono">Fits</dt><dd>' + s.fits + '</dd><dt class="mono">Connects to</dt><dd><div class="panel__links">' + connects + '</div></dd></dl>' +
        '<a class="btn btn--line panel__cta" href="' + MESSENGER + '" target="_blank" rel="noopener">' + (id === 'builder' ? 'Start with a free discovery call' : 'Ask about ' + s.name) + '</a>';
      panel.classList.remove('swap'); void panel.offsetWidth; panel.classList.add('swap');
      $$('[data-go]', panel).forEach(function (b) { b.addEventListener('click', function () { select(b.dataset.go, true); }); });
      if (byUser) noteInterest(id, 1);
    }
    var startId = topInterest();
    select(startId && BY_ID[startId] ? startId : 'pos', false);
  }

  /* =====================================================================
     6. System Builder configurator
     ===================================================================== */
  var INDUSTRIES = [
    { id: 'cafe', label: 'Café or restaurant', title: 'The café build', needs: ['counter', 'stock', 'payments', 'reports', 'books'] },
    { id: 'retail', label: 'Retail shop', title: 'The shop build', needs: ['counter', 'stock', 'reports', 'books'] },
    { id: 'club', label: 'Sports club or courts', title: 'The club build', needs: ['bookings', 'payments', 'reports'] },
    { id: 'clinic', label: 'Clinic', title: 'The clinic build', needs: ['bookings', 'payments', 'docs'] },
    { id: 'rental', label: 'Rooms and rentals', title: 'The stay build', needs: ['bookings', 'payments', 'reports'] },
    { id: 'construction', label: 'Construction', title: 'The site build', needs: ['projects', 'stock', 'payroll', 'billing', 'books'] },
    { id: 'office', label: 'Office or services', title: 'The office build', needs: ['docs', 'billing', 'payroll', 'books'] }
  ];
  var NEEDS = [
    ['bookings', 'Take bookings online'], ['payments', 'Card and e-wallet payments'], ['counter', 'Sell at the counter'],
    ['stock', 'Track stock and supplies'], ['reports', 'Daily reports'], ['projects', 'Manage jobs and projects'],
    ['payroll', 'Run payroll'], ['billing', 'Bill clients'], ['books', 'Keep the books'], ['docs', 'Sign and manage documents']
  ];
  var TEAMS = [['s', '1 to 5'], ['m', '6 to 20'], ['l', '21 to 50'], ['xl', '50+']];

  var cfg = $('[data-cfg]');
  if (cfg) {
    var indWrap = $('[data-cfg-industry]', cfg), needWrap = $('[data-cfg-needs]', cfg), teamWrap = $('[data-cfg-team]', cfg);
    var chip = function (type, name, value, text) {
      return '<label class="chip"><input type="' + type + '" name="' + name + '" value="' + value + '" id="cfg-' + name + '-' + value + '"><span>' + text + '</span></label>';
    };
    indWrap.innerHTML = INDUSTRIES.map(function (i) { return chip('radio', 'industry', i.id, i.label); }).join('');
    needWrap.innerHTML = NEEDS.map(function (n) { return chip('checkbox', 'needs', n[0], n[1]); }).join('');
    teamWrap.innerHTML = TEAMS.map(function (t) { return chip('radio', 'team', t[0], t[1]); }).join('');

    function setIndustry(id) {
      var ind = INDUSTRIES.filter(function (i) { return i.id === id; })[0] || INDUSTRIES[0];
      $('#cfg-industry-' + ind.id).checked = true;
      $$('input[name="needs"]', cfg).forEach(function (n) { n.checked = ind.needs.indexOf(n.value) > -1; });
    }

    // Personal start: pick the industry that matches what the visitor explored
    var hint = topInterest();
    var startInd = { pos: 'cafe', booking: 'club', pm: 'construction', pdf: 'office', accounting: 'office', company: 'office' }[hint] || 'cafe';
    setIndustry(startInd);
    $('#cfg-team-m').checked = true;

    cfg.addEventListener('change', function (e) {
      if (e.target.name === 'industry') setIndustry(e.target.value);
      render(true);
    });
    cfg.addEventListener('submit', function (e) { e.preventDefault(); });

    var state = {};
    function read() {
      var ind = $('input[name="industry"]:checked', cfg).value;
      var needs = $$('input[name="needs"]:checked', cfg).map(function (n) { return n.value; });
      var team = $('input[name="team"]:checked', cfg).value;
      return { ind: INDUSTRIES.filter(function (i) { return i.id === ind; })[0], needs: needs, team: team };
    }
    function has(n) { return state.needs.indexOf(n) > -1; }

    // Turn needs into a stack of LAYAW systems, bottom to top
    function plan() {
      var mods = [], c = state.ind.id === 'construction';
      var add = function (id, name, detail) { mods.push({ id: id, name: name, detail: detail }); };
      add('builder', 'System Builder', 'Scope first');
      var usePM = has('projects') || (c && (has('payroll') || has('billing') || has('stock')));
      var usePOS = has('counter') || (has('stock') && !usePM);
      var useBooking = has('bookings');
      var useAcc = has('books') || has('billing') || (has('payroll') && !usePM);
      var payHome = useBooking || usePOS;
      var reportHome = usePOS || useBooking || useAcc || usePM;
      if (useBooking) add('booking', 'Booking System', has('payments') ? 'Slots and payments' : 'Real-time slots');
      if (usePOS) add('pos', 'LAYAW POS', [has('stock') ? 'Inventory' : 'Sales', has('reports') ? 'reports' : null].filter(Boolean).join(', '));
      if (usePM) add('pm', 'Project Manager', has('payroll') ? 'Jobs and payroll' : 'One record per job');
      if (useAcc) add('accounting', 'LAYAW Accounting', has('payroll') && !usePM ? 'Books and payroll' : 'Books and registers');
      if (has('docs')) add('pdf', 'LAYAW PDF Pro', 'One-time licence');
      var count = mods.length - 1;
      var bigTeam = state.team === 'l' || state.team === 'xl';
      if (count >= 3 || bigTeam || (has('payments') && !payHome) || (has('reports') && !reportHome)) add('company', 'Company System', 'Ties it together');
      return mods;
    }
    function flows(mods) {
      var ids = mods.map(function (m) { return m.id; });
      var on = function (id) { return ids.indexOf(id) > -1; };
      var out = [];
      if (on('pos') && has('stock')) out.push('Every sale takes its items off the stock count.');
      if (on('pos') && on('accounting')) out.push('Each day\'s sales close straight into the books.');
      if (on('booking') && has('payments')) out.push('Payment confirms the slot, so nobody chases deposits in chat.');
      if (on('booking') && on('accounting')) out.push('Paid bookings post as income, already matched to the guest.');
      if (on('pm') && has('stock')) out.push('Warehouse issues are charged to the job that used them.');
      if (on('pm') && has('payroll')) out.push('Payroll comes from the job\'s own crew records.');
      if (on('pm') && on('accounting')) out.push('Billing and payroll post to the books once, from the job.');
      if (on('pdf')) out.push(on('company') || on('accounting') ? 'Signed documents are filed beside the record they belong to.' : 'Documents are edited and signed offline, on your own machine.');
      if (has('reports') && (on('pos') || on('booking'))) out.push('Your daily report builds itself by closing time.');
      if (on('company')) out.push('One login and one set of numbers for every team.');
      if (!out.length) out.push('Every figure is entered once, where it happens.');
      return out.slice(0, 5);
    }

    /* Isometric stack drawing */
    var iso = $('[data-cfg-iso]', cfg);
    var NSI = 'http://www.w3.org/2000/svg';
    var defs = document.createElementNS(NSI, 'defs');
    defs.innerHTML = '<linearGradient id="isoGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#08DBDE"/><stop offset="1" stop-color="#0B97A6"/></linearGradient>';
    iso.appendChild(defs);
    var S = 176, H = 26, GAP = 20, CX = 186, VIEW_H = 490;
    var k = 0.866;
    function slabGeom() {
      var T = [CX, 0], R = [CX + S * k, S / 2], B = [CX, S], L = [CX - S * k, S / 2];
      var pt = function (p, dy) { return p[0].toFixed(1) + ' ' + (p[1] + (dy || 0)).toFixed(1); };
      return '<path class="l" d="M' + pt(L) + ' L' + pt(B) + ' L' + pt(B, H) + ' L' + pt(L, H) + ' Z"/>' +
             '<path class="r" d="M' + pt(B) + ' L' + pt(R) + ' L' + pt(R, H) + ' L' + pt(B, H) + ' Z"/>' +
             '<path class="t" d="M' + pt(T) + ' L' + pt(R) + ' L' + pt(B) + ' L' + pt(L) + ' Z"/>';
    }
    var slabs = {};
    function drawStack(mods, animate) {
      var keep = {};
      // Centre the whole stack vertically, whatever its height
      var total = S + H + (mods.length - 1) * (H + GAP);
      var top = Math.max(8, (VIEW_H - total) / 2);
      mods.forEach(function (m, i) {
        keep[m.id] = true;
        var y = top + (mods.length - 1 - i) * (H + GAP);
        var g = slabs[m.id];
        var lx = CX + S * k, ly = S / 2 + H / 2;
        var label = '<path class="lead" d="M' + (lx + 6) + ' ' + ly + ' L' + (lx + 26) + ' ' + ly + '"/><circle class="lead-dot" cx="' + (lx + 6) + '" cy="' + ly + '" r="2"/>' +
          '<text class="lbl" x="' + (lx + 32) + '" y="' + (ly + 1) + '">' + m.name + '</text>' +
          '<text class="lbl-k" x="' + (lx + 32) + '" y="' + (ly + 14) + '">' + m.detail + '</text>';
        if (!g) {
          g = document.createElementNS(NSI, 'g');
          g.setAttribute('class', 'slab' + (m.id === 'builder' ? ' base' : ''));
          g.innerHTML = slabGeom() + '<g class="lab"></g>';
          iso.appendChild(g);
          slabs[m.id] = g;
          if (animate && !REDUCED) {
            g.style.transition = 'none'; g.style.opacity = '0';
            g.style.transform = 'translate(0px,' + (y - 70) + 'px)';
            void g.getBoundingClientRect();
            g.style.transition = '';
          }
        }
        $('.lab', g).innerHTML = label;
        // Re-append in order so higher slabs paint over lower ones
        iso.appendChild(g);
        requestAnimationFrame(function () { g.style.opacity = '1'; g.style.transform = 'translate(0px,' + y + 'px)'; });
      });
      Object.keys(slabs).forEach(function (id) {
        if (keep[id]) return;
        var g = slabs[id]; delete slabs[id];
        g.style.opacity = '0';
        setTimeout(function () { if (g.parentNode) g.parentNode.removeChild(g); }, REDUCED ? 0 : 600);
      });
    }

    var briefText = '';
    function render(animate) {
      state = read();
      var mods = plan();
      var teamLabel = TEAMS.filter(function (t) { return t[0] === state.team; })[0][1];
      $('[data-cfg-name]', cfg).textContent = state.ind.title;
      $('[data-cfg-kicker]', cfg).textContent = 'Draft scope · ' + teamLabel + ' people';
      $('[data-cfg-mods]', cfg).innerHTML = mods.map(function (m) { return '<li><span>' + m.name + '</span><span>' + m.detail + '</span></li>'; }).join('');
      var fl = state.needs.length ? flows(mods) : ['Pick at least one need and we will stack the system.'];
      $('[data-cfg-flows]', cfg).innerHTML = fl.map(function (f) { return '<li>' + f + '</li>'; }).join('');
      drawStack(mods, animate);
      var needLabels = NEEDS.filter(function (n) { return has(n[0]); }).map(function (n) { return n[1]; });
      briefText = 'Hi LAYAW, here is my draft from System Builder.\n' +
        'Business: ' + state.ind.label + '\nTeam: ' + teamLabel + ' people\n' +
        'Needs: ' + (needLabels.join(', ') || 'not sure yet') + '\n' +
        'Suggested: ' + mods.map(function (m) { return m.name; }).join(', ') + '\n' +
        'Can we book a free discovery call?';
      if (animate) {
        mods.forEach(function (m) { if (m.id !== 'builder') noteInterest(m.id, 0.5); });
        noteInterest('builder', 0.5);
        store.set('layaw.industry', state.ind.label);
      }
    }
    render(false);

    var hintEl = $('[data-cfg-hint]', cfg);
    function copyBrief(msg) {
      var done = function () { hintEl.textContent = msg; };
      var fallback = function () {
        var ta = document.createElement('textarea'); ta.value = briefText; ta.setAttribute('readonly', '');
        ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { hintEl.textContent = 'Copy did not work here. Select and copy: ' + briefText.replace(/\n/g, ' / '); }
        document.body.removeChild(ta);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(briefText).then(done, fallback);
      else fallback();
    }
    $('[data-cfg-copy]', cfg).addEventListener('click', function () { copyBrief('Brief copied. Paste it into Messenger or an email to layawsystem@gmail.com.'); });
    $('[data-cfg-messenger]', cfg).addEventListener('click', function () { copyBrief('Brief copied. Paste it into the Messenger chat that just opened.'); });
  }

  /* =====================================================================
     7. Selected work: generated screen details and scroll progress
     ===================================================================== */
  // dayonkamu calendar: October 2026 starts on a Thursday
  $$('.cal__g').forEach(function (g) {
    var html = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(function (d) { return '<span class="e">' + d + '</span>'; }).join('');
    for (var e = 0; e < 3; e++) html += '<span class="e"></span>';
    var booked = [3, 4, 9, 10, 11, 23, 24, 25];
    for (var d = 1; d <= 31; d++) {
      var cls = booked.indexOf(d) > -1 ? 'x' : (d === 16 || d === 18) ? 'sel' : d === 17 ? 'rng' : '';
      html += '<span class="' + cls + '">' + d + '</span>';
    }
    g.innerHTML = html;
  });
  // Kitchen Arena court grid
  $$('[data-courts]').forEach(function (g) {
    var times = ['6 AM', '8 AM', '10 AM', '4 PM', '5 PM', '6 PM', '7 PM', '8 PM', '9 PM'];
    var taken = { '0-1': 1, '0-3': 1, '1-0': 1, '3-2': 1, '4-0': 1, '4-1': 1, '5-0': 1, '5-1': 1, '5-2': 1, '5-3': 1, '6-0': 1, '6-3': 1, '7-1': 1, '7-2': 1, '8-0': 1 };
    var html = '<span class="h"></span>' + [1, 2, 3, 4].map(function (c) { return '<span class="h">Court ' + c + '</span>'; }).join('');
    times.forEach(function (t, r) {
      html += '<span class="t">' + t + '</span>';
      for (var c = 0; c < 4; c++) html += '<span class="' + (r === 6 && c === 1 ? 'me' : taken[r + '-' + c] ? 'b' : '') + '">' + (r === 6 && c === 1 ? 'You' : '·') + '</span>';
    });
    g.innerHTML = html;
  });

  var cases = $$('[data-case]');
  var ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      onScrollNav();
      if (REDUCED) return;
      var vh = window.innerHeight;
      cases.forEach(function (c) {
        var r = c.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        var p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (vh * 0.75)));
        c.style.setProperty('--p', p.toFixed(3));
      });
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* =====================================================================
     8. Copy buttons and personal closing line
     ===================================================================== */
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var text = b.getAttribute('data-copy');
      var ok = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 2000); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, function () { b.textContent = 'Select the address'; });
    });
  });

  var PERSONAL = {
    pos: 'You spent the most time on LAYAW POS. Ask for the café demo on the call and we will run it on a tablet with you.',
    booking: 'You looked closely at the Booking System. Bring your current schedule, even if it lives in a notebook, and we will map it together.',
    pdf: 'You looked at LAYAW PDF Pro. Message us for licence pricing. You pay once and keep it.',
    pm: 'Project Manager caught your eye. Bring the BOQ of one live job and we will show you how it sits in a single record.',
    accounting: 'You explored LAYAW Accounting. Bring last month\'s books, however messy, and we will show you what changes.',
    company: 'Company System interested you. Bring a rough org chart and we will sketch the platform around it.',
    builder: 'You tried System Builder. Send your draft and we will pick up from there.'
  };
  function renderPersonal() {
    var el = $('[data-personal]'); if (!el) return;
    var t = topInterest();
    if (t && PERSONAL[t]) { el.textContent = PERSONAL[t]; el.hidden = false; }
  }
  renderPersonal();

  /* =====================================================================
     9. Hero WebGL: only where it will run smoothly
     ===================================================================== */
  var hero = $('[data-hero]'), canvas = $('[data-gl]');
  function glSupported() {
    try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
  }
  if (hero && canvas && SCRIPT_URL && !REDUCED && glSupported()) {
    var conn = navigator.connection || {};
    var cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
    var skip = conn.saveData || /2g/.test(conn.effectiveType || '') || cores < 3 || mem < 2;
    if (!skip) {
      var tier = (!FINE || cores <= 4 || mem <= 4) ? 'low' : 'high';
      var start = function () {
        import(new URL('hero-gl.js', SCRIPT_URL).href).then(function (m) {
          m.init(canvas, { tier: tier, hero: hero, onReady: function () { hero.classList.add('gl-on'); }, onFail: function () { hero.classList.remove('gl-on'); } });
        }).catch(function () { /* static mark stays */ });
      };
      if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1200 }); else setTimeout(start, 400);
    }
  }
})();
