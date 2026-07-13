gsap.registerPlugin(ScrollTrigger);

// jammy-style fade + rise reveal for every .reveal element
// (hero elements are excluded — they get their own load-in and scroll-out)
const reveals = gsap.utils
  .toArray('.reveal')
  .filter((el) => !el.closest('.fuza-hero-inner'));

reveals.forEach((el, i) => {
  gsap.fromTo(
    el,
    { autoAlpha: 0, y: 36 },
    {
      autoAlpha: 1,
      y: 0,
      duration: 1.1,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 88%',
        toggleActions: 'play none none reverse',
      },
    }
  );
});

// hero elements get a slightly staggered entrance on load rather than waiting for scroll
gsap.set('.fuza-hero-inner .reveal, .scroll-cue', { autoAlpha: 0, y: 24 });
gsap.to('.fuza-hero-inner .reveal', {
  autoAlpha: 1,
  y: 0,
  duration: 1.3,
  ease: 'power3.out',
  stagger: 0.15,
  delay: 0.2,
});
gsap.to('.scroll-cue', {
  autoAlpha: 0.6,
  y: 0,
  duration: 1,
  ease: 'power3.out',
  delay: 1.1,
});

// hero content dissolves gently as the first movement scrolls away
gsap.to(['.fuza-hero-inner', '.scroll-cue'], {
  autoAlpha: 0,
  y: -48,
  ease: 'none',
  immediateRender: false,
  scrollTrigger: {
    trigger: '.movement-fuza',
    start: 'top top',
    end: 'bottom 40%',
    scrub: true,
  },
});

// subtle parallax on the itex transition image
gsap.to('.itex-transition-img', {
  yPercent: 14,
  ease: 'none',
  scrollTrigger: {
    trigger: '.itex-transition',
    start: 'top bottom',
    end: 'bottom top',
    scrub: true,
  },
});

// enquiry form — front-end only, no submission target yet
const form = document.getElementById('enquiry-form');
const success = document.getElementById('form-success');
const submitBtn = form.querySelector('.submit-btn');
const submitBtnDefault = submitBtn.innerHTML;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!form.checkValidity()) { form.reportValidity(); return; }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending…';

  try {
    const res = await fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error('Formspree responded ' + res.status);

    form.style.display = 'none';
    success.classList.add('show');
    gsap.fromTo(success, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out' });
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Something went wrong — try again';
    setTimeout(() => { submitBtn.innerHTML = submitBtnDefault; }, 3500);
  }
});

// invitation cards — tap/click (and Enter/Space) toggles the detail unfold.
// desktop hover is handled purely in CSS. The dataset guard makes binding
// idempotent so the listeners can never be attached twice.
// A card with data-opens routes to its overlay instead of toggling
// (室 opens the sample-room 3D inspector).
document.querySelectorAll('.invite-feature').forEach((card) => {
  if (card.dataset.bound === '1') return;
  card.dataset.bound = '1';

  const toggle = () => {
    const open = card.classList.toggle('is-open');
    card.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  const activate = card.dataset.opens === 'sample-room'
    ? () => openSampleRoom(card)
    : toggle;

  card.addEventListener('click', activate);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate();
    }
  });
});

// sample room — three.js and the viewer load lazily on first open
let srLoader = null;
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('failed to load ' + src));
    document.head.appendChild(s);
  });
}
async function openSampleRoom(opener) {
  if (!srLoader) {
    srLoader = (async () => {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
      await loadScript('sample-room.js?v=1');
    })();
  }
  try {
    await srLoader;
    window.SampleRoom.open(opener);
  } catch (err) {
    srLoader = null;   // allow retry if the CDN hiccups
    console.error(err);
  }
}

/* ============================================================
   Cursor-reactive woven-fabric background — dark sections only.
   One <canvas class="weave-canvas"> lives in each dark section
   (the hero and the invitation/form section). The light middle
   sections have none, so they stay clean. All canvases share one
   cursor + one config. Each canvas is
   pointer-events:none, so content and the enquiry form stay fully
   interactive. base 0 => nothing at rest; only the moving sheen
   reveals threads. A per-canvas data-sheen-scale lets the form
   section run gentler if the sheen ever fights legibility.
   ============================================================ */
(() => {
  const nodes = [...document.querySelectorAll('.weave-canvas')];
  if (!nodes.length) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // shared config — the tuned values, baked in (base .000, sheen .150, radius 292)
  const cfg = { base: 0.0, sheen: 0.15, radius: 292 };

  // plain weave of 1px thread highlights; every 24th warp thread a whisper of brass
  function makePattern(W, H) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const p = c.getContext('2d');
    const s = Math.round(4 * dpr), seg = Math.round(7 * dpr), px = Math.max(1, Math.round(dpr));
    let row = 0;
    for (let y = 0; y < H; y += s, row++) {
      for (let x = (row % 2) * seg; x < W; x += seg * 2) {
        const a = 0.45 + 0.55 * Math.random();
        p.fillStyle = `rgba(246,242,234,${0.33 * a})`;
        p.fillRect(x, y, seg, px);
      }
    }
    let col = 0;
    for (let x = 0; x < W; x += s, col++) {
      const brass = col % 24 === 11;
      for (let y = ((col + 1) % 2) * seg; y < H; y += seg * 2) {
        const a = 0.45 + 0.55 * Math.random();
        p.fillStyle = brass ? `rgba(203,171,120,${0.42 * a})` : `rgba(246,242,234,${0.28 * a})`;
        p.fillRect(x, y, px, seg);
      }
    }
    return c;
  }

  const layers = nodes.map((canvas) => {
    const L = {
      canvas,
      host: canvas.parentElement,
      ctx: canvas.getContext('2d'),
      sheenScale: parseFloat(canvas.dataset.sheenScale || '1') || 1,
      W: 0, H: 0, pattern: null, sheen: null, sctx: null, active: true,
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((e) => { L.active = e[0].isIntersecting; }).observe(L.host);
    }
    return L;
  });

  function sizeLayer(L) {
    const w = L.host.clientWidth || innerWidth;
    const h = L.host.clientHeight || innerHeight;
    L.W = L.canvas.width = Math.round(w * dpr);
    L.H = L.canvas.height = Math.round(h * dpr);
    L.pattern = makePattern(L.W, L.H);
    L.sheen = document.createElement('canvas');
    L.sheen.width = L.W; L.sheen.height = L.H;
    L.sctx = L.sheen.getContext('2d');
    drawBase(L);
  }

  function drawBase(L) {
    L.ctx.clearRect(0, 0, L.W, L.H);
    if (cfg.base > 0) {
      L.ctx.globalAlpha = cfg.base;
      L.ctx.drawImage(L.pattern, 0, 0);
      L.ctx.globalAlpha = 1;
    }
  }

  // cursor in viewport CSS px; smoothed; energy builds with speed, decays at rest
  let px = -1e5, py = -1e5, spx = -1e5, spy = -1e5, energy = 0, lastX = null, lastY = null;
  addEventListener('pointermove', (e) => {
    px = e.clientX; py = e.clientY;
    if (lastX !== null) energy = Math.min(1, energy + Math.hypot(px - lastX, py - lastY) / 150);
    lastX = px; lastY = py;
    if (spx < -9e4) { spx = px; spy = py; }
  }, { passive: true });

  function renderLayer(L) {
    drawBase(L);
    if (energy <= 0.004 || spx < -9e4) return;
    const rect = L.canvas.getBoundingClientRect();
    const lx = (spx - rect.left) * dpr;      // cursor mapped into this canvas
    const ly = (spy - rect.top) * dpr;
    const r = cfg.radius * dpr;
    if (lx < -r || ly < -r || lx > L.W + r || ly > L.H + r) return;   // sheen out of this canvas
    const a = cfg.sheen * L.sheenScale * energy;
    if (a <= 0) return;
    const sc = L.sctx;
    sc.clearRect(0, 0, L.W, L.H);
    sc.save();
    sc.translate(lx, ly);
    sc.scale(1.3, 1);                        // sheen runs with the weave, not a circle
    const g = sc.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, `rgba(255,252,244,${a})`);
    g.addColorStop(0.55, `rgba(255,252,244,${a * 0.35})`);
    g.addColorStop(1, 'rgba(255,252,244,0)');
    sc.fillStyle = g;
    sc.fillRect(-r, -r, r * 2, r * 2);
    sc.restore();
    sc.globalCompositeOperation = 'destination-in';   // mask the light to the threads
    sc.drawImage(L.pattern, 0, 0);
    sc.globalCompositeOperation = 'source-over';
    L.ctx.drawImage(L.sheen, 0, 0);
  }

  function frame() {
    spx += (px - spx) * 0.07;
    spy += (py - spy) * 0.07;
    energy *= 0.945;
    for (const L of layers) if (L.active) renderLayer(L);
    requestAnimationFrame(frame);
  }

  function sizeAll() { for (const L of layers) sizeLayer(L); }
  sizeAll();
  addEventListener('resize', sizeAll);
  if (!reduced) requestAnimationFrame(frame);
})();

/* ============================================================
   Closing signature — a single thread stitches "Fuza 复杂".
   Scroll-driven and reversible: each stroke is a hand-authored
   monoline centerline path (italic Latin, then the hanzi in
   stroke order), drawn sequentially via dashoffset — the thread
   traces the letterforms; nothing is uncovered.
   ============================================================ */
(() => {
  const svg = document.getElementById('stitch-svg');
  const section = document.getElementById('signature');
  if (!svg || !section) return;

  const NS = 'http://www.w3.org/2000/svg';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  const IVORY = 'rgba(246,242,234,0.92)';
  const BRASS = '#cbab78';

  /* stroke data — [d, colour, width]; order = sewing order.
     Latin: italic monoline "Fuza", baseline y=250.
     复 (9 strokes) and 杂 (6 strokes) in dictionary stroke order. */
  const STROKES = [
    // F — stem, top arm, mid bar
    ['M 208 120 C 202 160 192 208 179 250', IVORY, 1.6],
    ['M 168 128 C 200 118 250 116 282 124', IVORY, 1.6],
    ['M 162 186 C 185 180 215 180 236 184', IVORY, 1.6],
    // u — one cursive stroke
    ['M 268 172 C 262 200 256 224 258 236 C 260 248 272 252 284 244 C 296 236 306 214 312 176 C 308 204 304 230 308 242 C 312 252 326 250 336 238', IVORY, 1.6],
    // z — one stroke with entry and exit sweeps
    ['M 378 176 C 398 169 432 167 454 172 C 434 194 410 218 390 240 C 410 233 442 232 462 239', IVORY, 1.6],
    // a — bowl then stem, one thread
    ['M 566 178 C 540 168 508 178 500 204 C 494 226 508 246 530 242 C 548 239 560 220 566 196 C 562 218 558 236 564 244 C 570 252 584 248 592 236', IVORY, 1.6],

    // 复 — 9 strokes
    ['M 768 105 C 755 115 738 124 720 130', BRASS, 1.7],                             // ノ
    ['M 706 139 C 740 136 776 136 810 139', BRASS, 1.7],                             // 一
    ['M 726 156 C 725 174 724 191 724 208', BRASS, 1.7],                             // 丨 (日 left)
    ['M 726 156 C 752 154 772 154 794 157 C 794 174 793 191 792 208', BRASS, 1.7],   // ㇕ (日 top+right)
    ['M 728 181 C 748 179 770 179 790 181', BRASS, 1.7],                             // 一 (inside)
    ['M 726 207 C 748 205 770 205 792 207', BRASS, 1.7],                             // 一 (close 日)
    ['M 762 224 C 750 238 732 252 712 262', BRASS, 1.7],                             // ノ (夂)
    ['M 730 232 C 748 230 764 230 778 232 C 762 244 746 254 730 263', BRASS, 1.7],   // ㇇
    ['M 752 240 C 768 248 790 256 812 263', BRASS, 1.7],                             // ㇏

    // 杂 — 6 strokes
    ['M 938 108 C 930 121 920 132 908 141', BRASS, 1.7],                             // ノ (九)
    ['M 912 122 C 932 119 950 118 962 120 C 962 136 962 148 968 156 C 974 163 984 163 992 155', BRASS, 1.7], // ㇈
    ['M 890 188 C 920 185 972 185 1002 188', BRASS, 1.7],                            // 一
    ['M 946 170 C 946 198 946 230 946 258', BRASS, 1.7],                             // 丨
    ['M 940 196 C 928 216 912 234 894 248', BRASS, 1.7],                             // ノ
    ['M 952 196 C 966 214 982 232 1000 246', BRASS, 1.7],                            // ㇏
  ];

  const paths = STROKES.map(([d, colour, w]) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', colour);
    p.setAttribute('stroke-width', w);
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('pathLength', 1);
    p.setAttribute('stroke-dasharray', 1);
    p.setAttribute('stroke-dashoffset', 1);
    svg.appendChild(p);
    return p;
  });

  // the thread's working tip — a small brass glint riding the active stroke
  const tip = document.createElementNS(NS, 'circle');
  tip.setAttribute('r', 2.4);
  tip.setAttribute('fill', BRASS);
  tip.setAttribute('opacity', 0);
  svg.appendChild(tip);

  /* sequential windows, proportional to real stroke length —
     the thread spends its time where the letterform demands it */
  const lens = paths.map((p) => p.getTotalLength());
  const total = lens.reduce((a, b) => a + b, 0);
  const GAP = 0.12;                     // travel time between strokes (thread passes underneath)
  const spanScale = 1 / (1 + GAP);      // draw + travel together fill exactly [0, 1]
  const windows = [];
  let acc = 0;
  lens.forEach((L) => {
    const w = (L / total) * spanScale;
    const g = (GAP * L / total) * spanScale;
    windows.push([acc, acc + w]);
    acc += w + g;
  });

  function update(p) {
    let tipSet = false;
    for (let i = 0; i < paths.length; i++) {
      const [a, b] = windows[i];
      const v = clamp01((p - a) / (b - a));
      paths[i].setAttribute('stroke-dashoffset', String(1 - v));
      if (!tipSet && v > 0 && v < 1) {
        const pt = paths[i].getPointAtLength(v * lens[i]);
        tip.setAttribute('cx', pt.x);
        tip.setAttribute('cy', pt.y);
        tip.setAttribute('opacity', '0.85');
        tipSet = true;
      }
    }
    if (!tipSet) tip.setAttribute('opacity', '0');
  }

  /* section progress: 0 when the stage pins, 1 when the section releases.
     Drawing completes at 86% so the finished mark holds in the void. */
  let target = 0, shown = -1;
  function readScroll() {
    const start = section.offsetTop;
    const span = section.offsetHeight - innerHeight;
    const raw = span > 0 ? clamp01((scrollY - start) / span) : 0;
    target = clamp01(raw / 0.86);
  }
  addEventListener('scroll', readScroll, { passive: true });
  addEventListener('resize', readScroll);
  readScroll();

  function frame() {
    const k = reduced ? 1 : 0.11;
    if (shown < 0) shown = target;
    shown += (target - shown) * k;
    if (Math.abs(target - shown) < 0.0004) shown = target;
    update(shown);
    requestAnimationFrame(frame);
  }
  update(0);
  requestAnimationFrame(frame);

  // debug hook for local review
  window.__stitch = {
    set(p) { target = clamp01(p); shown = target; update(shown); return shown; },
    get: () => ({ target, shown }),
  };
})();
