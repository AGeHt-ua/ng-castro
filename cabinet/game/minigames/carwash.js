// Міні-гра «Мийка»: нанеси піну й змий бруд з авто за 60 секунд.
// playCarWash({ practice, onStart }) → Promise<{ score, cancelled }>
import * as THREE from "three";

const TIME_LIMIT = 60;
const CELL = 128;              // клітинка атласу (6 граней = 3×2)
const ATLAS_W = CELL * 3, ATLAS_H = CELL * 2;
const BOTTOM_FACE = 3;         // ny — днище не рахуємо
const PAINTS = [0xe0182d, 0xf4f4f4, 0x15151a, 0x2f6bff, 0xf2c14e, 0x1f8a4c, 0x8a8f99];

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

// BoxGeometry з окремою клітинкою атласу для кожної грані
const atlasBox = (w, h, d) => {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  for (let face = 0; face < 6; face += 1) {
    const col = face % 3, row = Math.floor(face / 3);
    for (let k = 0; k < 4; k += 1) {
      const i = face * 4 + k;
      uv.setXY(i, (col + uv.getX(i)) / 3, (row + uv.getY(i)) / 2);
    }
  }
  return g;
};

const makeLayer = () => {
  const c = document.createElement("canvas");
  c.width = ATLAS_W; c.height = ATLAS_H;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { c, g: c.getContext("2d", { willReadFrequently: true }), tex };
};

const paintDirt = (g) => {
  const muds = ["#5b4630", "#6e5638", "#3f3022", "#7a6244", "#4a3a28"];
  for (let face = 0; face < 6; face += 1) {
    const x0 = (face % 3) * CELL, y0 = (1 - Math.floor(face / 3)) * CELL; // canvas y інвертований відносно uv
    g.fillStyle = "rgba(92,72,50,0.92)";
    g.fillRect(x0, y0, CELL, CELL);
    for (let i = 0; i < 70; i += 1) {
      const x = x0 + Math.random() * CELL, y = y0 + Math.random() * CELL, r = 4 + Math.random() * 16;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, muds[i % muds.length]);
      grad.addColorStop(1, "rgba(60,45,30,0)");
      g.fillStyle = grad;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    // бризки знизу
    for (let i = 0; i < 40; i += 1) {
      g.fillStyle = muds[i % muds.length];
      g.beginPath(); g.arc(x0 + Math.random() * CELL, y0 + CELL * (0.6 + Math.random() * 0.4), 1 + Math.random() * 3, 0, Math.PI * 2); g.fill();
    }
  }
};

const alphaSum = (g) => {
  const data = g.getImageData(0, 0, ATLAS_W, ATLAS_H).data;
  let sum = 0;
  for (let face = 0; face < 6; face += 1) {
    if (face === BOTTOM_FACE) continue;
    const x0 = (face % 3) * CELL, y0 = (1 - Math.floor(face / 3)) * CELL;
    for (let y = y0; y < y0 + CELL; y += 2) for (let x = x0; x < x0 + CELL; x += 2) sum += data[(y * ATLAS_W + x) * 4 + 3];
  }
  return sum;
};

export function playCarWash({ practice = false, onStart } = {}) {
  return new Promise((resolve) => {
    const root = el("div", "mg");
    root.innerHTML = `
      <canvas class="mg__canvas"></canvas>
      <header class="mg__hud">
        <div class="mg__title"><small>${practice ? "Тренування" : "Підміна мийника"}</small><b>🧽 Автомийка «Блиск»</b></div>
        <div class="mg__meter"><span>Чистота</span><b data-clean>0%</b><i><span data-clean-bar></span></i></div>
        <div class="mg__timer" data-timer>${TIME_LIMIT}</div>
        <button class="mg__x" type="button" data-cancel aria-label="Вийти">✕</button>
      </header>
      <div class="mg__tools">
        <button type="button" class="mg__tool is-on" data-tool="foam"><span>🫧</span>Піна</button>
        <button type="button" class="mg__tool" data-tool="water"><span>💦</span>Вода</button>
      </div>
      <div class="mg__rotate">
        <button type="button" data-rot="-1" aria-label="Повернути ліворуч">⟲</button>
        <button type="button" data-rot="1" aria-label="Повернути праворуч">⟳</button>
      </div>
      <button type="button" class="mg__done" data-done>Готово ✓</button>
      <div class="mg__hint" data-hint>Спершу вкрий бруд піною, потім змий водою. Повертай авто, щоб помити всі боки.</div>
      <div class="mg__card" data-intro>
        <span class="mg__card-icon">🚗</span>
        <small>${practice ? "Тренування • без нагороди" : "Тоні захворів — твоя черга"}</small>
        <h2>Помий авто</h2>
        <ol><li><b>🫧 Піна</b> — проводь по брудних місцях</li><li><b>💦 Вода</b> — змивай піну разом із брудом</li><li><b>⟲ ⟳</b> — повертай авто, мий усі боки й дах</li></ol>
        <p>60 секунд. Від 70% чистоти мийка знову працює, за 95% — максимальний бонус.</p>
        <button type="button" class="mg__go" data-go>Почати</button>
      </div>
      <div class="mg__card" data-result hidden>
        <span class="mg__card-icon" data-res-icon>✨</span>
        <small data-res-kicker>Результат</small>
        <h2 data-res-score>0%</h2>
        <div class="mg__stars" data-res-stars></div>
        <p data-res-text></p>
        <button type="button" class="mg__go" data-res-ok>Здати роботу</button>
      </div>`;
    document.body.appendChild(root);
    const q = (s) => root.querySelector(s);

    // ---------- Сцена ----------
    const canvas = q(".mg__canvas");
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c12);
    scene.fog = new THREE.Fog(0x0a0c12, 14, 30);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    const camHome = new THREE.Vector3(0, 4.4, 8.2);
    camera.position.copy(camHome);
    camera.lookAt(0, 1, 0);

    scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x1a1010, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(4, 9, 6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const blue = new THREE.PointLight(0x3fb6ff, 25, 14); blue.position.set(-5, 3, -2); scene.add(blue);
    const red = new THREE.PointLight(0xff2a3d, 18, 14); red.position.set(5, 3, -2); scene.add(red);

    const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...o });
    const neon = (color) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.5 });
    // бокс мийки
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), std(0x14161c, { roughness: 0.25, metalness: 0.6 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(30, 10), std(0x0f1118)); back.position.set(0, 5, -6); scene.add(back);
    [-1, 1].forEach((side) => {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), std(0x10131a)); wall.position.set(side * 7, 5, 0); wall.rotation.y = -side * Math.PI / 2; scene.add(wall);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 10), neon(side < 0 ? 0x3fb6ff : 0xff2a3d)); strip.position.set(side * 6.9, 3.2, 0); scene.add(strip);
      const brush = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 2.6, 16), std(side < 0 ? 0x2f6bff : 0xe0182d, { roughness: 0.95 })); brush.position.set(side * 6.2, 1.4, -4.8); brush.userData.spin = side; scene.add(brush);
    });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, 0.1), neon(0x3fb6ff)); sign.position.set(0, 5.2, -5.9); scene.add(sign);
    const turntable = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.12, 48), std(0x22252e, { metalness: 0.7, roughness: 0.3 }));
    turntable.position.y = 0.06; turntable.receiveShadow = true; scene.add(turntable);
    const ringGlow = new THREE.Mesh(new THREE.TorusGeometry(3.22, 0.04, 6, 64), neon(0x3fb6ff)); ringGlow.rotation.x = Math.PI / 2; ringGlow.position.y = 0.13; scene.add(ringGlow);

    // авто
    const car = new THREE.Group();
    scene.add(car);
    const paint = std(PAINTS[Math.floor(Math.random() * PAINTS.length)], { metalness: 0.55, roughness: 0.35 });
    const glassMat = std(0x0b0d12, { metalness: 0.8, roughness: 0.1 });
    const parts = [
      { geo: atlasBox(4.2, 0.95, 1.9), pos: [0, 0.78, 0], mat: paint },
      { geo: atlasBox(2.3, 0.78, 1.72), pos: [-0.25, 1.64, 0], mat: glassMat },
    ];
    const layers = parts.map((p) => {
      const base = new THREE.Mesh(p.geo, p.mat);
      base.position.set(...p.pos); base.castShadow = true;
      car.add(base);
      const dirt = makeLayer(); paintDirt(dirt.g); dirt.tex.needsUpdate = true;
      const foam = makeLayer();
      const dirtMesh = new THREE.Mesh(p.geo, new THREE.MeshStandardMaterial({ map: dirt.tex, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
      dirtMesh.position.copy(base.position); dirtMesh.scale.setScalar(1.004);
      const foamMesh = new THREE.Mesh(p.geo, new THREE.MeshStandardMaterial({ map: foam.tex, transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      foamMesh.position.copy(base.position); foamMesh.scale.setScalar(1.008);
      car.add(dirtMesh, foamMesh);
      return { base, dirt, foam, dirtMesh, foamMesh, dirt0: alphaSum(dirt.g) };
    });
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 20);
    const wheelMat = std(0x0d0d10, { roughness: 0.9 });
    [[1.35, 0.95], [-1.35, 0.95], [1.35, -0.95], [-1.35, -0.95]].forEach(([x, z]) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat); w.rotation.x = Math.PI / 2; w.position.set(x, 0.42, z); w.castShadow = true; car.add(w);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.34, 12), std(0xb8bcc6, { metalness: 0.9, roughness: 0.2 })); rim.rotation.x = Math.PI / 2; rim.position.set(x, 0.42, z); car.add(rim);
    });
    [[2.11, 0.6], [2.11, -0.6]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.42), neon(0xfff2c0)); l.position.set(x, 0.92, z); car.add(l); });
    [[-2.11, 0.6], [-2.11, -0.6]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.42), neon(0xff1a2a)); l.position.set(x, 0.92, z); car.add(l); });

    // частинки: вода й піна
    const MAXP = 400;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(MAXP * 3);
    const pVel = Array.from({ length: MAXP }, () => new THREE.Vector3());
    const pLife = new Float32Array(MAXP);
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ color: 0x9fd8ff, size: 0.07, transparent: true, opacity: 0.85, depthWrite: false });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);
    let pNext = 0;
    const emit = (from, to, color) => {
      pMat.color.set(color);
      for (let i = 0; i < 6; i += 1) {
        const k = pNext; pNext = (pNext + 1) % MAXP;
        pPos[k * 3] = from.x; pPos[k * 3 + 1] = from.y; pPos[k * 3 + 2] = from.z;
        pVel[k].copy(to).sub(from).normalize().multiplyScalar(9 + Math.random() * 3).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5));
        pLife[k] = 0.35;
      }
    };

    // ---------- Стан гри ----------
    let tool = "foam";
    let running = false, finished = false;
    let timeLeft = TIME_LIMIT;
    let rotTarget = 0;
    let cleanPct = 0, foamLeft = 0;
    const foam0 = ATLAS_W * ATLAS_H * 255 * (5 / 6) / 4; // повне покриття піною (з кроком 2 px)

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let painting = false;
    const nozzle = new THREE.Vector3();

    const brush = (layer, uv, radius) => {
      const x = uv.x * ATLAS_W, y = (1 - uv.y) * ATLAS_H;
      if (tool === "foam") {
        const g = layer.foam.g;
        g.globalCompositeOperation = "source-over";
        for (let i = 0; i < 5; i += 1) {
          const bx = x + (Math.random() - 0.5) * radius, by = y + (Math.random() - 0.5) * radius, br = radius * (0.35 + Math.random() * 0.4);
          const grad = g.createRadialGradient(bx, by, 0, bx, by, br);
          grad.addColorStop(0, "rgba(255,255,255,0.95)"); grad.addColorStop(0.7, "rgba(235,245,255,0.85)"); grad.addColorStop(1, "rgba(220,235,255,0)");
          g.fillStyle = grad; g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fill();
        }
        layer.foam.tex.needsUpdate = true;
      } else {
        const foamHere = layer.foam.g.getImageData(Math.min(ATLAS_W - 1, Math.max(0, x | 0)), Math.min(ATLAS_H - 1, Math.max(0, y | 0)), 1, 1).data[3];
        const strength = foamHere > 40 ? 0.95 : 0.18; // без піни бруд майже не змивається
        [layer.foam.g, layer.dirt.g].forEach((g, idx) => {
          g.globalCompositeOperation = "destination-out";
          const grad = g.createRadialGradient(x, y, 0, x, y, radius);
          const a = idx === 0 ? 0.9 : strength;
          grad.addColorStop(0, `rgba(0,0,0,${a})`); grad.addColorStop(1, "rgba(0,0,0,0)");
          g.fillStyle = grad; g.beginPath(); g.arc(x, y, radius, 0, Math.PI * 2); g.fill();
          g.globalCompositeOperation = "source-over";
        });
        layer.foam.tex.needsUpdate = true;
        layer.dirt.tex.needsUpdate = true;
      }
    };

    const paintAt = (clientX, clientY) => {
      const r = canvas.getBoundingClientRect();
      pointer.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(layers.map((l) => l.base), false)[0];
      if (!hit || !hit.uv) return;
      const layer = layers.find((l) => l.base === hit.object);
      brush(layer, hit.uv, tool === "foam" ? 22 : 20);
      nozzle.copy(camera.position).add(new THREE.Vector3(tool === "foam" ? -1.2 : 1.2, -1.2, 0));
      emit(nozzle, hit.point, tool === "foam" ? 0xffffff : 0x9fd8ff);
    };

    const measure = () => {
      let left = 0, total = 0, foamSum = 0;
      layers.forEach((l) => { left += alphaSum(l.dirt.g); total += l.dirt0; foamSum += alphaSum(l.foam.g); });
      cleanPct = Math.max(0, Math.min(100, (1 - left / total) * 100));
      foamLeft = Math.min(1, foamSum / (foam0 * layers.length));
      const score = Math.round(Math.max(0, cleanPct - foamLeft * 25));
      q("[data-clean]").textContent = `${score}%`;
      q("[data-clean-bar]").style.width = `${score}%`;
      q("[data-clean-bar]").style.background = score >= 95 ? "#22c55e" : score >= 70 ? "#f2c14e" : "#ff2a3d";
      return score;
    };

    // ---------- Керування ----------
    canvas.addEventListener("pointerdown", (e) => { if (!running) return; painting = true; canvas.setPointerCapture(e.pointerId); paintAt(e.clientX, e.clientY); });
    canvas.addEventListener("pointermove", (e) => { if (painting && running) paintAt(e.clientX, e.clientY); });
    const stopPaint = () => { painting = false; };
    canvas.addEventListener("pointerup", stopPaint);
    canvas.addEventListener("pointercancel", stopPaint);
    root.querySelectorAll("[data-tool]").forEach((b) => b.addEventListener("click", () => {
      tool = b.dataset.tool;
      root.querySelectorAll("[data-tool]").forEach((x) => x.classList.toggle("is-on", x === b));
      canvas.style.cursor = tool === "foam" ? "cell" : "crosshair";
    }));
    root.querySelectorAll("[data-rot]").forEach((b) => b.addEventListener("click", () => { rotTarget += Number(b.dataset.rot) * Math.PI / 2; }));
    const onKey = (e) => {
      if (e.key === "q" || e.key === "ArrowLeft") rotTarget -= Math.PI / 2;
      if (e.key === "e" || e.key === "ArrowRight") rotTarget += Math.PI / 2;
      if (e.key === "1") root.querySelector('[data-tool="foam"]').click();
      if (e.key === "2") root.querySelector('[data-tool="water"]').click();
    };
    addEventListener("keydown", onKey);

    let cleanup = () => {};
    const finish = (cancelled) => {
      if (finished) return;
      finished = true;
      running = false;
      const score = measure();
      if (cancelled) { cleanup(); resolve({ cancelled: true, score: 0 }); return; }
      const passed = score >= 70;
      const stars = score >= 95 ? 3 : score >= 85 ? 2 : passed ? 1 : 0;
      q("[data-res-icon]").textContent = passed ? "✨" : "😬";
      q("[data-res-kicker]").textContent = passed ? "Авто сяє!" : "Ще брудно";
      q("[data-res-score]").textContent = `${score}%`;
      q("[data-res-stars]").innerHTML = [1, 2, 3].map((i) => `<i class="${i <= stars ? "is-on" : ""}">★</i>`).join("");
      q("[data-res-text]").textContent = practice
        ? (passed ? "Гарна робота! У справжній підміні це повернуло б мийку до роботи." : "Не вистачило чистоти. Спробуй: спершу піна, потім вода.")
        : (passed ? "Клієнт задоволений — мийка знову працює." : "Потрібно щонайменше 70%. Мийка поки стоїть — спробуй ще раз.");
      q("[data-res-ok]").textContent = practice ? "Закрити" : passed ? "Здати роботу" : "Зрозуміло";
      q("[data-result]").hidden = false;
      if (passed) { paint.metalness = 0.85; paint.roughness = 0.12; }
      q("[data-res-ok]").onclick = () => { cleanup(); resolve({ cancelled: false, score }); };
    };
    q("[data-done]").addEventListener("click", () => finish(false));
    q("[data-cancel]").addEventListener("click", () => finish(true));
    q("[data-go]").addEventListener("click", async () => {
      q("[data-go]").disabled = true;
      if (onStart) {
        const ok = await onStart().catch(() => false);
        if (!ok) { finish(true); return; }
      }
      q("[data-intro]").hidden = true;
      running = true;
    });

    const resize = () => {
      const w = innerWidth, h = innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.position.copy(camHome).multiplyScalar(w < 700 ? 1.45 : 1);
      camera.lookAt(0, 1, 0);
      camera.updateProjectionMatrix();
    };
    addEventListener("resize", resize);
    resize();

    const clock = new THREE.Clock();
    let measureTick = 0, raf = 0;
    const loop = () => {
      const dt = Math.min(clock.getDelta(), 0.1);
      car.rotation.y += (rotTarget - car.rotation.y) * Math.min(1, dt * 8);
      turntable.rotation.y = car.rotation.y;
      scene.children.forEach((o) => { if (o.userData.spin) o.rotation.y += o.userData.spin * dt * 4; });
      for (let k = 0; k < MAXP; k += 1) {
        if (pLife[k] <= 0) continue;
        pLife[k] -= dt;
        pVel[k].y -= 12 * dt;
        pPos[k * 3] += pVel[k].x * dt; pPos[k * 3 + 1] += pVel[k].y * dt; pPos[k * 3 + 2] += pVel[k].z * dt;
        if (pLife[k] <= 0) pPos[k * 3 + 1] = -50;
      }
      pGeo.attributes.position.needsUpdate = true;
      if (running) {
        timeLeft -= dt;
        q("[data-timer]").textContent = Math.max(0, Math.ceil(timeLeft));
        q("[data-timer]").classList.toggle("is-low", timeLeft <= 10);
        measureTick += dt;
        if (measureTick > 0.3) { measureTick = 0; const s = measure(); if (s >= 99) finish(false); }
        if (timeLeft <= 0) finish(false);
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    cleanup = () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
      removeEventListener("keydown", onKey);
      renderer.dispose();
      scene.traverse((o) => { o.geometry?.dispose?.(); [].concat(o.material || []).forEach((m) => { m.map?.dispose?.(); m.dispose?.(); }); });
      root.remove();
    };
  });
}
