/* ============================================================
   Fuza — Sample Room overlay engine
   Ported unchanged from sample-room-prototype.html: procedural
   quilted puffer (placeholder geometry), orbit + click-to-inspect
   camera choreography, spec-sheet callouts. Loaded lazily (with
   three.js) the first time the 室 card is opened.
   ============================================================ */
(() => {
  if (!window.THREE) { console.error('SampleRoom: three.js missing'); return; }

  let inited = false;
  let isOpen = false;
  let overlay, canvas, renderer, scene, camera;
  let openerEl = null;   // element to return focus to on close

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- everything below runs once, on first open ---------- */
  function init() {
    overlay = document.getElementById('sample-room-overlay');
    canvas = document.getElementById('sr-stage');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x141110);
    camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);

    /* procedural studio environment (equirect canvas -> PMREM) */
    const envCanvas = document.createElement('canvas');
    envCanvas.width = 1024; envCanvas.height = 512;
    const ex = envCanvas.getContext('2d');
    ex.fillStyle = '#0e0b09';
    ex.fillRect(0, 0, 1024, 512);
    let g = ex.createRadialGradient(300, 130, 20, 300, 130, 280);
    g.addColorStop(0, 'rgba(255,240,214,0.95)');
    g.addColorStop(0.35, 'rgba(255,240,214,0.28)');
    g.addColorStop(1, 'rgba(255,240,214,0)');
    ex.fillStyle = g; ex.fillRect(0, 0, 1024, 512);
    g = ex.createRadialGradient(840, 190, 10, 840, 190, 220);
    g.addColorStop(0, 'rgba(203,171,120,0.55)');
    g.addColorStop(0.5, 'rgba(203,171,120,0.12)');
    g.addColorStop(1, 'rgba(203,171,120,0)');
    ex.fillStyle = g; ex.fillRect(0, 0, 1024, 512);
    g = ex.createLinearGradient(0, 380, 0, 512);
    g.addColorStop(0, 'rgba(58,48,38,0)');
    g.addColorStop(1, 'rgba(58,48,38,0.35)');
    ex.fillStyle = g; ex.fillRect(0, 380, 1024, 132);
    const envTex = new THREE.CanvasTexture(envCanvas);
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(envTex).texture;
    envTex.dispose();

    const key = new THREE.DirectionalLight(0xffeed6, 0.85);
    key.position.set(2.4, 3.4, 2.6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -3; key.shadow.camera.right = 3;
    key.shadow.camera.top = 3; key.shadow.camera.bottom = -3;
    key.shadow.radius = 6;
    key.shadow.bias = -0.0004;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xcbab78, 0.35);
    rim.position.set(-3.2, 1.2, -3.0);
    scene.add(rim);

    /* soft-noise bump (shell) + vertical rib (trim) — all generated */
    const noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = noiseCanvas.height = 256;
    const nx = noiseCanvas.getContext('2d');
    nx.fillStyle = '#808080';
    nx.fillRect(0, 0, 256, 256);
    nx.filter = 'blur(3px)';
    for (let i = 0; i < 190; i++) {
      const v = 108 + Math.random() * 40;
      nx.fillStyle = `rgba(${v},${v},${v},0.5)`;
      nx.beginPath();
      nx.arc(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 9, 0, Math.PI * 2);
      nx.fill();
    }
    nx.filter = 'none';
    const bumpTex = new THREE.CanvasTexture(noiseCanvas);
    bumpTex.wrapS = bumpTex.wrapT = THREE.RepeatWrapping;
    bumpTex.repeat.set(3, 2);

    const ribCanvas = document.createElement('canvas');
    ribCanvas.width = ribCanvas.height = 128;
    const rx = ribCanvas.getContext('2d');
    for (let x = 0; x < 128; x += 4) {
      const v = (x / 4) % 2 === 0 ? 140 : 112;
      rx.fillStyle = `rgb(${v},${v},${v})`;
      rx.fillRect(x, 0, 4, 128);
    }
    const ribTex = new THREE.CanvasTexture(ribCanvas);
    ribTex.wrapS = ribTex.wrapT = THREE.RepeatWrapping;
    ribTex.repeat.set(14, 1);

    const shell = new THREE.MeshPhysicalMaterial({
      color: 0xd8cfbc, roughness: 0.6, metalness: 0.0,
      clearcoat: 0.07, clearcoatRoughness: 0.55,
      bumpMap: bumpTex, bumpScale: 0.09,
      envMapIntensity: 0.5, side: THREE.DoubleSide,
    });
    const rib = new THREE.MeshStandardMaterial({
      color: 0x453f2f, roughness: 0.82, metalness: 0.02,
      bumpMap: ribTex, bumpScale: 0.35,
      envMapIntensity: 0.35, side: THREE.DoubleSide,
    });
    const seamMat = new THREE.MeshStandardMaterial({
      color: 0xb9ae97, roughness: 0.6, metalness: 0.02, envMapIntensity: 0.4,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xb08d57, roughness: 0.28, metalness: 0.9, envMapIntensity: 1.0,
    });
    const stitchMat = new THREE.MeshStandardMaterial({
      color: 0x8f7244, roughness: 0.5, metalness: 0.3, envMapIntensity: 0.6,
    });
    const innerDark = new THREE.MeshStandardMaterial({ color: 0x17130f, roughness: 0.9 });

    /* ---------------- procedural garment ---------------- */
    const garment = new THREE.Group();
    scene.add(garment);

    const SE_N = 3.0;
    const HEM_Y = -1.10, NECK_Y = 0.78, SPAN = NECK_Y - HEM_Y;
    const PLAN = [
      [0.00, 0.500, 0.295],
      [0.10, 0.545, 0.315],
      [0.45, 0.560, 0.320],
      [0.66, 0.545, 0.315],
      [0.74, 0.500, 0.300],
      [0.86, 0.340, 0.215],
      [0.94, 0.235, 0.150],
      [1.00, 0.205, 0.132],
    ];
    function planAt(t) {
      for (let i = 0; i < PLAN.length - 1; i++) {
        const a = PLAN[i], b = PLAN[i + 1];
        if (t >= a[0] && t <= b[0]) {
          const u = (t - a[0]) / (b[0] - a[0]);
          const s = u * u * (3 - 2 * u);
          return { w: a[1] + (b[1] - a[1]) * s, d: a[2] + (b[2] - a[2]) * s };
        }
      }
      const e = PLAN[PLAN.length - 1];
      return { w: e[1], d: e[2] };
    }
    const CHANNELS = 8;
    function channel(t) {
      if (t > 0.74) return 1;
      const fade = t > 0.66 ? 1 - (t - 0.66) / 0.08 : 1;
      return 1 + 0.045 * fade * Math.abs(Math.sin(t * Math.PI * CHANNELS));
    }
    const yAt = (t) => HEM_Y + t * SPAN;
    const tAt = (y) => (y - HEM_Y) / SPAN;
    function sePoint(theta, w, d) {
      const c = Math.cos(theta), s = Math.sin(theta);
      return {
        x: w * Math.sign(c) * Math.pow(Math.abs(c), 2 / SE_N),
        z: d * Math.sign(s) * Math.pow(Math.abs(s), 2 / SE_N),
      };
    }
    function frontZ(x, w, d) {
      const q = 1 - Math.pow(Math.min(1, Math.abs(x) / w), SE_N);
      return d * Math.pow(Math.max(0, q), 1 / SE_N);
    }
    function frontNormal(x, z, w, d) {
      const nxv = Math.sign(x) * Math.pow(Math.abs(x) / w, SE_N - 1) / w;
      const nzv = Math.pow(Math.abs(z) / d, SE_N - 1) / d;
      return new THREE.Vector3(nxv, 0, nzv).normalize();
    }
    function loft(ringFn, rows, cols) {
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= rows; i++) {
        const t = i / rows;
        const ring = ringFn(t);
        for (let j = 0; j <= cols; j++) {
          const p = ring[j % cols];
          pos.push(p.x, p.y, p.z);
          uv.push(j / cols, t);
        }
      }
      const stride = cols + 1;
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          const a = i * stride + j, b = a + 1, c = a + stride, e = c + 1;
          idx.push(a, c, b, b, c, e);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      return geo;
    }

    const TCOLS = 96;
    const torsoRing = (t) => {
      const { w, d } = planAt(t);
      const bul = channel(t);
      const y = yAt(t);
      const ring = [];
      for (let j = 0; j < TCOLS; j++) {
        const theta = (j / TCOLS) * Math.PI * 2 - Math.PI / 2;
        const p = sePoint(theta, w * bul, d * bul);
        ring.push(new THREE.Vector3(p.x, y, p.z));
      }
      return ring;
    };
    const torso = new THREE.Mesh(loft(torsoRing, 150, TCOLS), shell);
    torso.castShadow = true;
    torso.receiveShadow = true;
    garment.add(torso);

    const quiltSeamMat = new THREE.MeshStandardMaterial({
      color: 0xb3a891, roughness: 0.65, metalness: 0.02, envMapIntensity: 0.4,
    });
    for (let k = 1; k <= 5; k++) {
      const t = k / CHANNELS;
      const { w, d } = planAt(t);
      const pts = [];
      for (let j = 0; j < 72; j++) {
        const th = (j / 72) * Math.PI * 2 - Math.PI / 2;
        const p = sePoint(th, w * 1.004, d * 1.004);
        pts.push(new THREE.Vector3(p.x, yAt(t), p.z));
      }
      garment.add(new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, 0.006, 8, true),
        quiltSeamMat
      ));
    }

    (() => {
      const { w, d } = planAt(0);
      const shape = new THREE.Shape();
      for (let j = 0; j <= 64; j++) {
        const th = (j / 64) * Math.PI * 2;
        const p = sePoint(th, w, d);
        j === 0 ? shape.moveTo(p.x, p.z) : shape.lineTo(p.x, p.z);
      }
      const cap = new THREE.Mesh(new THREE.ShapeGeometry(shape), innerDark);
      cap.rotation.x = Math.PI / 2;
      cap.position.y = HEM_Y + 0.02;
      garment.add(cap);
    })();

    (() => {
      const ringAt = (t) => {
        const { w, d } = planAt(0.02);
        const k = (0.965 + 0.02 * t);
        const y = HEM_Y - 0.005 + t * 0.11;
        const ring = [];
        for (let j = 0; j < 64; j++) {
          const th = (j / 64) * Math.PI * 2 - Math.PI / 2;
          const p = sePoint(th, w * k, d * k);
          ring.push(new THREE.Vector3(p.x, y, p.z));
        }
        return ring;
      };
      garment.add(new THREE.Mesh(loft(ringAt, 4, 64), rib));
    })();

    (() => {
      const ringAt = (t) => {
        const w = 0.205 + 0.02 * t, d = 0.134 + 0.016 * t;
        const y = NECK_Y - 0.015 + t * 0.15;
        const ring = [];
        for (let j = 0; j < 48; j++) {
          const th = (j / 48) * Math.PI * 2 - Math.PI / 2;
          const p = sePoint(th, w, d);
          ring.push(new THREE.Vector3(p.x, y, p.z));
        }
        return ring;
      };
      const collar = new THREE.Mesh(loft(ringAt, 6, 48), rib);
      collar.castShadow = true;
      garment.add(collar);
    })();

    const hotspotRefs = {};
    function makeSleeve(side) {
      const P = [
        new THREE.Vector3(side * 0.36, 0.40, 0.01),
        new THREE.Vector3(side * 0.575, 0.16, 0.035),
        new THREE.Vector3(side * 0.650, -0.24, 0.06),
        new THREE.Vector3(side * 0.630, -0.70, 0.085),
      ];
      const curve = new THREE.CatmullRomCurve3(P);
      const radiusAt = (t) => {
        const base = 0.157 - 0.05 * t;
        const q = (t > 0.12 && t < 0.95) ? 1 + 0.045 * Math.abs(Math.sin(t * Math.PI * 5)) : 1;
        return base * q;
      };
      const ref = new THREE.Vector3(0, 0, 1);
      const ringAt = (t) => {
        const p = curve.getPoint(t);
        const T = curve.getTangent(t);
        const N = new THREE.Vector3().crossVectors(T, ref).normalize();
        const B = new THREE.Vector3().crossVectors(T, N).normalize();
        const r = radiusAt(t);
        const ring = [];
        for (let j = 0; j < 40; j++) {
          const th = (j / 40) * Math.PI * 2;
          ring.push(new THREE.Vector3().copy(p)
            .addScaledVector(N, Math.cos(th) * r)
            .addScaledVector(B, Math.sin(th) * r));
        }
        return ring;
      };
      const sleeve = new THREE.Mesh(loft(ringAt, 80, 40), shell);
      sleeve.castShadow = true;
      garment.add(sleeve);

      const tJoin = 0.16;
      const jp = curve.getPoint(tJoin), jt = curve.getTangent(tJoin);
      const seamRing = new THREE.Mesh(new THREE.TorusGeometry(radiusAt(tJoin) + 0.004, 0.010, 10, 44), seamMat);
      seamRing.position.copy(jp);
      seamRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), jt);
      garment.add(seamRing);

      [0.2, 0.4, 0.6, 0.8].forEach((t) => {
        const rp = curve.getPoint(t), rt = curve.getTangent(t);
        const r = new THREE.Mesh(new THREE.TorusGeometry(radiusAt(t) + 0.002, 0.0055, 8, 36), quiltSeamMat);
        r.position.copy(rp);
        r.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), rt);
        garment.add(r);
      });

      const ep = curve.getPoint(1), et = curve.getTangent(1);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.104, 0.098, 0.15, 32), rib);
      cuff.position.copy(ep).addScaledVector(et, 0.055);
      cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), et);
      cuff.castShadow = true;
      garment.add(cuff);

      if (side > 0) {
        hotspotRefs.cuff = {
          p: ep.clone().add(new THREE.Vector3(0.06, -0.03, 0.09)),
          n: new THREE.Vector3(0.55, -0.15, 0.82).normalize(),
        };
      }
    }
    makeSleeve(1);
    makeSleeve(-1);

    function shoulderSeam(side) {
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const t = 0.985 - (i / 8) * 0.20;
        const { w, d } = planAt(t);
        pts.push(new THREE.Vector3(side * w * 0.72, yAt(t) + 0.006, frontZ(w * 0.72, w, d) * 0.1 + 0.01));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      garment.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.0105, 10), seamMat));
      if (side < 0) {
        const dotG = new THREE.SphereGeometry(0.0065, 8, 8);
        for (let i = 0; i <= 10; i++) {
          const dm = new THREE.Mesh(dotG, stitchMat);
          dm.position.copy(curve.getPoint(i / 10)).add(new THREE.Vector3(0, 0.014, 0.012));
          garment.add(dm);
        }
        hotspotRefs.seam = {
          p: curve.getPoint(0.5).add(new THREE.Vector3(0, 0.02, 0.02)),
          n: new THREE.Vector3(-0.25, 0.8, 0.55).normalize(),
        };
      }
    }
    shoulderSeam(1);
    shoulderSeam(-1);

    function frontCurvePts(xOff, zOff) {
      const pts = [];
      for (let t = 0.03; t <= 0.985; t += 0.02) {
        const { w, d } = planAt(t);
        const bul = channel(t);
        pts.push(new THREE.Vector3(xOff, yAt(t), frontZ(xOff, w * bul, d * bul) + zOff));
      }
      return new THREE.CatmullRomCurve3(pts);
    }
    garment.add(new THREE.Mesh(new THREE.TubeGeometry(frontCurvePts(-0.030, 0.008), 80, 0.012, 8), rib));
    garment.add(new THREE.Mesh(new THREE.TubeGeometry(frontCurvePts(0.030, 0.008), 80, 0.012, 8), rib));
    garment.add(new THREE.Mesh(new THREE.TubeGeometry(frontCurvePts(0, 0.016), 80, 0.009, 8), brassMat));

    const zipY = 0.18;
    (() => {
      const t = tAt(zipY), { w, d } = planAt(t);
      const zf = frontZ(0, w * channel(t), d * channel(t));
      const slider = new THREE.Group();
      slider.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.072, 0.026), brassMat));
      const pull = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.0055, 8, 20), brassMat);
      pull.position.set(0, -0.06, 0.005);
      slider.add(pull);
      slider.position.set(0, zipY, zf + 0.028);
      slider.rotation.x = -0.12;
      garment.add(slider);
      const topT = 0.975, tp = planAt(topT);
      const stop = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.018, 0.02), brassMat);
      stop.position.set(0, yAt(topT), frontZ(0, tp.w, tp.d) + 0.02);
      garment.add(stop);
      hotspotRefs.zip = { p: slider.position.clone(), n: new THREE.Vector3(0, 0.08, 1).normalize() };
    })();

    function roundedRect(w, h, r) {
      const s = new THREE.Shape();
      s.moveTo(-w / 2 + r, -h / 2);
      s.lineTo(w / 2 - r, -h / 2); s.absarc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0);
      s.lineTo(w / 2, h / 2 - r); s.absarc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2);
      s.lineTo(-w / 2 + r, h / 2); s.absarc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI);
      s.lineTo(-w / 2, -h / 2 + r); s.absarc(-w / 2 + r, -h / 2 + r, r, Math.PI, Math.PI * 1.5);
      return s;
    }
    (() => {
      const group = new THREE.Group();
      const pW = 0.24, pH = 0.19;
      const pocket = new THREE.Mesh(
        new THREE.ExtrudeGeometry(roundedRect(pW, pH, 0.03), { depth: 0.015, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 2 }),
        shell
      );
      pocket.castShadow = true;
      group.add(pocket);
      const flap = new THREE.Mesh(
        new THREE.ExtrudeGeometry(roundedRect(pW + 0.018, 0.065, 0.026), { depth: 0.011, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 }),
        rib
      );
      flap.position.set(0, pH / 2 + 0.012, 0.004);
      flap.rotation.x = 0.16;
      group.add(flap);
      const dotG = new THREE.SphereGeometry(0.0055, 8, 8);
      const inset = 0.02;
      const per = [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]];
      per.forEach(([ax, ay, bx, by]) => {
        for (let i = 1; i <= 6; i++) {
          const u = i / 7;
          const dm = new THREE.Mesh(dotG, stitchMat);
          dm.position.set(
            (ax + (bx - ax) * u) * (pW / 2 - inset),
            (ay + (by - ay) * u) * (pH / 2 - inset),
            0.022
          );
          group.add(dm);
        }
      });
      const px0 = 0.26, py0 = 0.02;
      const t = tAt(py0), { w, d } = planAt(t);
      const bul = channel(t);
      const pz = frontZ(px0, w * bul, d * bul);
      const n = frontNormal(px0, pz, w * bul, d * bul);
      n.y = 0.05; n.normalize();
      const pPos = new THREE.Vector3(px0, py0, pz);
      group.position.copy(pPos).addScaledVector(n, 0.05);
      group.lookAt(group.position.clone().add(n));
      garment.add(group);
      hotspotRefs.pocket = { p: pPos.clone().addScaledVector(n, 0.06), n: n.clone() };
    })();

    const floorY = -1.24;
    const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.35 }));
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = floorY;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = glowCanvas.height = 256;
    const gctx = glowCanvas.getContext('2d');
    const grad = gctx.createRadialGradient(128, 128, 10, 128, 128, 128);
    grad.addColorStop(0, 'rgba(203,171,120,0.14)');
    grad.addColorStop(0.5, 'rgba(203,171,120,0.045)');
    grad.addColorStop(1, 'rgba(203,171,120,0)');
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, 256, 256);
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(2.3, 48),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(glowCanvas), transparent: true, depthWrite: false })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = floorY + 0.002;
    scene.add(glow);

    /* ---------------- hotspots — spec-sheet copy (verbatim) ---------------- */
    const HOTSPOTS = [
      { key: 'pocket', eyebrow: '01 · Patch pocket', title: 'Patch pocket, triple-pass lockstitch.', sub: '8 stitches per inch. Corners turned and set by hand. Seam allowance 10 mm.', dist: 0.85 },
      { key: 'zip', eyebrow: '02 · Centre-front zip', title: 'Coil zip, 5 mm gauge, hand-set.', sub: 'Placket bound with 20 mm tape. Alignment tolerance ±1 mm; zero pucker.', dist: 0.8 },
      { key: 'seam', eyebrow: '03 · Shoulder seam', title: 'Bound seam, 6 mm binding.', sub: 'Binding tape encloses raw edge. Interior finished to exterior standard.', dist: 0.8 },
      { key: 'cuff', eyebrow: '04 · Cuff', title: 'Bar-tack at cuff opening.', sub: '28-stitch bar-tack, doubled thread, placed at the primary stress point.', dist: 0.75 },
    ].map((h) => ({ ...h, p: hotspotRefs[h.key].p, n: hotspotRefs[h.key].n }));

    const markers = HOTSPOTS.map((h, i) => {
      const elm = document.createElement('div');
      elm.className = 'sr-marker';
      elm.innerHTML = '<span class="ring"></span><span class="dot"></span>';
      elm.setAttribute('role', 'button');
      elm.setAttribute('aria-label', h.title);
      elm.addEventListener('click', (e) => { e.stopPropagation(); focusHotspot(i); });
      overlay.appendChild(elm);
      return elm;
    });

    /* ---------------- camera choreography ---------------- */
    const orbitTarget = new THREE.Vector3(0, -0.12, 0);
    let theta = 0.15, phi = 1.40, radius = 5.9;
    let tTheta = 0.5, tPhi = 1.42, tRadius = 4.55;
    const camPos = new THREE.Vector3();
    const camTarget = orbitTarget.clone();

    let mode = 'orbit';
    let focusedIdx = -1;
    let tween = null;
    let T = 0;
    let lastInteract = -10;

    const easeInOutQuart = (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2);

    function sphericalPos(out) {
      out.set(
        orbitTarget.x + radius * Math.sin(phi) * Math.sin(theta),
        orbitTarget.y + radius * Math.cos(phi),
        orbitTarget.z + radius * Math.sin(phi) * Math.cos(theta)
      );
      return out;
    }
    function startTween(fromPos, fromTgt, toPos, toTgt, dur, after) {
      tween = {
        t0: T, dur: reduced ? 0.35 : dur,
        fp: fromPos.clone(), ft: fromTgt.clone(),
        tp: toPos.clone(), tt: toTgt.clone(),
        after,
      };
    }

    const callout = document.getElementById('sr-callout');
    const backChip = document.getElementById('sr-back');
    const hint = document.getElementById('sr-hint');

    function focusHotspot(i) {
      if (mode === 'flying' || mode === 'returning') return;
      const h = HOTSPOTS[i];
      focusedIdx = i;
      mode = 'flying';
      canvas.classList.add('focused');
      hint.classList.add('hidden');
      hideCallout();
      const end = h.p.clone().addScaledVector(h.n, h.dist).add(new THREE.Vector3(0, 0.1, 0));
      startTween(camPos, camTarget, end, h.p, 1.9, () => {
        mode = 'focused';
        showCallout(h);
        backChip.classList.add('show');
      });
    }
    function backToGarment() {
      if (mode !== 'focused') return;
      mode = 'returning';
      focusedIdx = -1;
      hideCallout();
      backChip.classList.remove('show');
      canvas.classList.remove('focused');
      const end = sphericalPos(new THREE.Vector3());
      startTween(camPos, camTarget, end, orbitTarget, 1.6, () => {
        mode = 'orbit';
        hint.classList.remove('hidden');
      });
    }
    function showCallout(h) {
      document.getElementById('sr-co-eyebrow').textContent = h.eyebrow;
      document.getElementById('sr-co-title').textContent = h.title;
      document.getElementById('sr-co-sub').textContent = h.sub;
      callout.classList.add('show');
    }
    function hideCallout() { callout.classList.remove('show'); }

    backChip.addEventListener('click', backToGarment);

    let dragging = false, lastX = 0, lastY = 0, moved = 0;
    canvas.addEventListener('pointerdown', (e) => {
      dragging = true; moved = 0;
      lastX = e.clientX; lastY = e.clientY;
      canvas.classList.add('dragging');
      lastInteract = T;
    });
    addEventListener('pointermove', (e) => {
      if (!isOpen || !dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (mode === 'orbit') {
        tTheta -= dx * 0.0038;
        tPhi = Math.max(1.08, Math.min(1.72, tPhi - dy * 0.0028));
      }
      lastInteract = T;
    });
    addEventListener('pointerup', () => {
      if (!isOpen) return;
      canvas.classList.remove('dragging');
      if (dragging && moved < 6 && mode === 'focused') backToGarment();
      dragging = false;
      lastInteract = T;
    });
    canvas.addEventListener('wheel', (e) => {
      if (!isOpen || mode !== 'orbit') return;
      e.preventDefault();
      tRadius = Math.max(3.2, Math.min(6.2, tRadius + e.deltaY * 0.0018));
      lastInteract = T;
    }, { passive: false });

    addEventListener('keydown', (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        if (mode === 'focused') backToGarment();
        else window.SampleRoom.close();
      }
    });

    const V = new THREE.Vector3();
    function tick(dt) {
      T += dt;
      if (mode === 'orbit') {
        if (!reduced && !dragging && T - lastInteract > 2.5) tTheta += dt * 0.07;
        theta += (tTheta - theta) * Math.min(1, dt * 3.2);
        phi += (tPhi - phi) * Math.min(1, dt * 3.2);
        radius += (tRadius - radius) * Math.min(1, dt * 2.6);
        sphericalPos(camPos);
        camTarget.lerp(orbitTarget, Math.min(1, dt * 3));
      }
      if (tween) {
        const u = Math.min(1, (T - tween.t0) / tween.dur);
        const s = easeInOutQuart(u);
        camPos.lerpVectors(tween.fp, tween.tp, s);
        camTarget.lerpVectors(tween.ft, tween.tt, s);
        if (u >= 1) { const after = tween.after; tween = null; if (after) after(); }
      } else if (mode === 'focused') {
        const h = HOTSPOTS[focusedIdx];
        const end = h.p.clone().addScaledVector(h.n, h.dist).add(new THREE.Vector3(0, 0.1, 0));
        end.x += Math.sin(T * 0.4) * 0.012;
        end.y += Math.sin(T * 0.3 + 1.7) * 0.008;
        camPos.lerp(end, Math.min(1, dt * 2));
      }
      camera.position.copy(camPos);
      camera.lookAt(camTarget);
      if (mode !== 'orbit') { theta = tTheta; phi = tPhi; radius = tRadius; }

      const showMarkers = mode === 'orbit';
      HOTSPOTS.forEach((h, i) => {
        const elm = markers[i];
        if (!showMarkers) { elm.classList.add('gone'); return; }
        elm.classList.remove('gone');
        V.copy(h.p).project(camera);
        if (V.z > 1) { elm.classList.add('gone'); return; }
        elm.style.left = ((V.x * 0.5 + 0.5) * innerWidth) + 'px';
        elm.style.top = ((-V.y * 0.5 + 0.5) * innerHeight) + 'px';
        const toCam = camera.position.clone().sub(h.p).normalize();
        elm.classList.toggle('away', toCam.dot(h.n) < 0.08);
      });

      renderer.render(scene, camera);
    }

    function resize() {
      renderer.setSize(innerWidth, innerHeight);
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
    }
    resize();
    addEventListener('resize', () => { if (inited) resize(); });

    let lastNow = performance.now();
    function loop(now) {
      const dt = Math.min(0.05, (now - lastNow) / 1000);
      lastNow = now;
      if (isOpen) tick(dt);
      requestAnimationFrame(loop);
    }
    sphericalPos(camPos);
    tick(0.016);
    requestAnimationFrame(loop);

    /* debug hook (kept from the prototype for testing) */
    window.__sample = {
      focus: focusHotspot,
      back: backToGarment,
      step(n = 30) { for (let i = 0; i < n; i++) tick(1 / 60); return { mode, T: T.toFixed(2) }; },
      state: () => ({ mode, focusedIdx, cam: camPos.toArray().map((v) => +v.toFixed(2)) }),
    };

    window.__srResize = resize;
  }

  /* ---------------- public open/close ---------------- */
  window.SampleRoom = {
    open(opener) {
      overlay = document.getElementById('sample-room-overlay');
      openerEl = opener || null;
      if (!inited) { init(); inited = true; }
      overlay.removeAttribute('hidden');
      void overlay.offsetWidth;            // commit the un-hide so the fade still transitions
      overlay.classList.add('open');
      isOpen = true;
      document.documentElement.style.overflow = 'hidden';
      window.__srResize && window.__srResize();
    },
    close() {
      if (!overlay) return;
      overlay.classList.remove('open');
      isOpen = false;
      document.documentElement.style.overflow = '';
      setTimeout(() => { if (!isOpen) overlay.setAttribute('hidden', ''); }, 650);
      if (openerEl && openerEl.focus) openerEl.focus();
    },
    isOpen: () => isOpen,
  };

  document.getElementById('sr-close').addEventListener('click', () => window.SampleRoom.close());
})();
