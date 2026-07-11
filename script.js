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
   Cursor-reactive woven-fabric hero background
   Merged from the weave-test prototype. Scoped to the hero box
   (.movement-fuza) so no other section, content, or the enquiry
   form is affected. Canvas is pointer-events:none.
   Tuning panel kept active: press D.
   ============================================================ */
(() => {
  const canvas = document.getElementById('weave');
  if (!canvas) return;
  const host = canvas.parentElement;              // the hero section
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const cfg = { base: 0.014, sheen: 0.05, radius: 240 };
  let W, H, pattern, sheenLayer, sctx;

  // plain weave of 1px thread highlights; every 24th warp thread a whisper of brass
  function buildPattern() {
    pattern = document.createElement('canvas');
    pattern.width = W; pattern.height = H;
    const p = pattern.getContext('2d');
    const s = Math.round(4 * dpr);
    const seg = Math.round(7 * dpr);
    const px = Math.max(1, Math.round(dpr));
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
    sheenLayer = document.createElement('canvas');
    sheenLayer.width = W; sheenLayer.height = H;
    sctx = sheenLayer.getContext('2d');
  }

  function resize() {
    const w = host.clientWidth || innerWidth;
    const h = host.clientHeight || innerHeight;
    W = canvas.width = Math.round(w * dpr);
    H = canvas.height = Math.round(h * dpr);
    buildPattern();
    drawStatic();
  }

  // cursor mapped into the hero box (rect-based so it stays correct while scrolling)
  let mx = -1e4, my = -1e4, sx = -1e4, sy = -1e4, energy = 0, lastX = null, lastY = null;
  addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mx = (e.clientX - r.left) * dpr;
    my = (e.clientY - r.top) * dpr;
    if (lastX !== null) {
      energy = Math.min(1, energy + Math.hypot(mx - lastX, my - lastY) / (150 * dpr));
    }
    lastX = mx; lastY = my;
    if (sx < -9e3) { sx = mx; sy = my; }
  }, { passive: true });

  function drawStatic() {
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = cfg.base;
    ctx.drawImage(pattern, 0, 0);
    ctx.globalAlpha = 1;
  }

  function renderOnce() {
    drawStatic();
    if (energy > 0.004 && sx > -9e3) {
      const r = cfg.radius * dpr;
      const a = cfg.sheen * energy;
      sctx.clearRect(0, 0, W, H);
      sctx.save();
      sctx.translate(sx, sy);
      sctx.scale(1.3, 1);
      const g = sctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, `rgba(255,252,244,${a})`);
      g.addColorStop(0.55, `rgba(255,252,244,${a * 0.35})`);
      g.addColorStop(1, 'rgba(255,252,244,0)');
      sctx.fillStyle = g;
      sctx.fillRect(-r, -r, r * 2, r * 2);
      sctx.restore();
      sctx.globalCompositeOperation = 'destination-in';
      sctx.drawImage(pattern, 0, 0);
      sctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(sheenLayer, 0, 0);
    }
  }

  // only animate while the hero is on screen
  let active = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((ents) => { active = ents[0].isIntersecting; })
      .observe(host);
  }

  function frame() {
    if (active) {
      sx += (mx - sx) * 0.07;
      sy += (my - sy) * 0.07;
      energy *= 0.945;
      renderOnce();
    }
    requestAnimationFrame(frame);
  }

  resize();
  addEventListener('resize', resize);
  if (!reduced) requestAnimationFrame(frame);

  // ---- tuning panel (press D) ----
  const panel = document.getElementById('weave-panel');
  addEventListener('keydown', (e) => {
    if ((e.key === 'd' || e.key === 'D') && panel) panel.classList.toggle('show');
  });
  const bind = (id, key, div, fmt) => {
    const el = document.getElementById(id);
    const out = document.getElementById(id + 'V');
    if (!el) return;
    el.addEventListener('input', () => {
      cfg[key] = el.value / div;
      out.textContent = fmt(cfg[key]);
      if (reduced) drawStatic();
    });
  };
  bind('weave-base', 'base', 1000, (v) => v.toFixed(3).slice(1));
  bind('weave-sheen', 'sheen', 1000, (v) => v.toFixed(3).slice(1));
  bind('weave-radius', 'radius', 1, (v) => String(v));
})();
