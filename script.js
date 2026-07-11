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
document.querySelectorAll('.invite-feature').forEach((card) => {
  if (card.dataset.bound === '1') return;
  card.dataset.bound = '1';

  const toggle = () => {
    const open = card.classList.toggle('is-open');
    card.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  card.addEventListener('click', toggle);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  });
});

/* ============================================================
   Cursor-reactive woven-fabric background — dark sections only.
   One <canvas class="weave-canvas"> lives in each dark section
   (the hero and the invitation/form section). The light middle
   sections have none, so they stay clean. All canvases share one
   cursor + one config (tunable via the D panel). Each canvas is
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

  // shared, panel-tunable — defaults are the tuned values
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

  // ---- tuning panel (press D) ----
  const panel = document.getElementById('weave-panel');
  // hidden tuning panel — open with Cmd+D (Mac) / Ctrl+D (Win/Linux);
  // preventDefault stops the browser's bookmark dialog
  addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      if (panel) panel.classList.toggle('show');
    }
  });
  const bind = (id, key, div, fmt) => {
    const el = document.getElementById(id);
    const out = document.getElementById(id + 'V');
    if (!el) return;
    el.addEventListener('input', () => {
      cfg[key] = el.value / div;
      out.textContent = fmt(cfg[key]);
      if (reduced) for (const L of layers) drawBase(L);
    });
  };
  bind('weave-base', 'base', 1000, (v) => v.toFixed(3).slice(1));
  bind('weave-sheen', 'sheen', 1000, (v) => v.toFixed(3).slice(1));
  bind('weave-radius', 'radius', 1, (v) => String(v));
})();
