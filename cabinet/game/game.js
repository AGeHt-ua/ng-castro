// CASTRO: Empire — клієнт (3D-сцена + інтерфейс). Економіку рахує сервер; формули — спільний модуль.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import * as E from "/workers/auth/src/empire.js";
import { playCarWash } from "/cabinet/game/minigames/carwash.js";

const API = "https://auth.family-castro.com";
const SITE = "https://family-castro.com";
const $ = (id) => document.getElementById(id);
const DEMO = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has("demo");
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Формат чисел ----------
const SUFFIX = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp"];
const fmt = (n) => {
  n = Number(n) || 0;
  if (Math.abs(n) < 1000) return `$${Math.floor(n).toLocaleString("uk-UA")}`;
  const tier = Math.min(SUFFIX.length - 1, Math.floor(Math.log10(Math.abs(n)) / 3));
  const v = n / Math.pow(1000, tier);
  return `$${v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0)}${SUFFIX[tier]}`;
};
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeAvatar = (u) => (/^https:\/\/cdn\.discordapp\.com\//.test(String(u || "")) ? String(u) : "");

// ---------- Стан ----------
const game = {
  config: null,
  state: null,       // від сервера
  syncedAt: 0,       // коли отримали state (ms, локальний час)
  selected: null,    // id бізнесу або "hq"
  busy: false,
  player: null,
};
const liveCash = () => (game.state ? game.state.cash + game.state.rate * Math.max(0, (performance.now() - game.syncedAt) / 1000) : 0);
const levelOf = (id) => (id === "hq" ? game.state.hq : game.state.levels[id] || 0);
const isDown = (id) => !!game.state?.incidents?.[id];

// ---------- API (або демо на localhost) ----------
let demoState = null;
const api = async (path, body) => {
  if (DEMO) return demoApi(path, body);
  const res = await fetch(API + path, {
    method: body ? "POST" : "GET",
    credentials: "include",
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({ ok: false, error: "bad_response" }));
  return { status: res.status, data };
};
const demoApi = async (path, body) => {
  const now = Date.now();
  if (!demoState) { demoState = E.freshState(now - 3 * 3600e3); demoState.cash = 25000; demoState.levels = { wash: 32, garage: 12, club: 1 }; demoState.earned = 3e5; demoState.incidents = { wash: { type: "sick", started_at: now - 40 * 60e3 } }; }
  if (path === "/game/state") {
    const offline = E.settle(demoState, now);
    return { status: 200, data: { ok: true, player: { id: "demo", name: "Dominic Castro", avatar: null }, config: E.publicConfig(), state: E.view(demoState), offline: offline.seconds >= 60 ? offline : null, place: { place: 1, total: 12 } } };
  }
  if (path === "/game/upgrade") {
    E.settle(demoState, now);
    const result = E.upgrade(demoState, body.target, body.count);
    return { status: 200, data: { ok: true, result, state: E.view(demoState) } };
  }
  if (path.startsWith("/game/incident/")) {
    E.settle(demoState, now, () => 1);
    const action = path.slice("/game/incident/".length);
    try {
      const result = action === "start" ? E.startIncidentGame(demoState, body.id, now)
        : action === "finish" ? E.finishIncidentGame(demoState, body.id, body.token, body.score, now + 20e3)
          : E.hireForIncident(demoState, body.id, now);
      return { status: 200, data: { ok: true, result, state: E.view(demoState) } };
    } catch (error) { return { status: 409, data: { ok: false, error: error.message, state: E.view(demoState) } }; }
  }
  if (path === "/game/top") {
    return { status: 200, data: { ok: true, me: { id: "demo", place: 1, total: 5 }, top: [
      { id: "demo", name: "Dominic Castro", earned: demoState.earned, hq: demoState.hq, rank: E.rankFor(demoState.earned).name },
      { id: "2", name: "Kevin Castro", earned: 2.1e5, hq: 1, rank: "Солдат" },
      { id: "3", name: "Madara Castro", earned: 8.4e4, hq: 1, rank: "Боєць" },
    ] } };
  }
  return { status: 404, data: { ok: false } };
};

// ---------- Екран завантаження ----------
const gate = $("gate");
const gateText = (t) => { $("gateText").textContent = t; };
const gateBar = (p) => { $("gateBar").style.width = `${p}%`; };
const gateFail = (text, actions) => {
  gateText(text);
  gateBar(100);
  $("gateBar").style.background = "#555";
  $("gateActions").innerHTML = actions;
  gate.querySelector(".gx-gate__logo span").style.animation = "none";
};

// =====================================================================
// 3D-СЦЕНА
// =====================================================================
const canvas = $("scene");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
} catch {
  gateFail("Твій пристрій не підтримує 3D (WebGL). Спробуй інший браузер.", `<a class="gx-btn" href="/cabinet/">Назад у кабінет</a>`);
  throw new Error("WebGL unavailable");
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const labelRenderer = new CSS2DRenderer({ element: $("labels") });

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07070a);
scene.fog = new THREE.Fog(0x07070a, 55, 140);

const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 400);
camera.position.set(34, 36, 42);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 18;
controls.maxDistance = 95;
controls.minPolarAngle = 0.35;
controls.maxPolarAngle = 1.22;
controls.screenSpacePanning = false;
controls.autoRotate = !REDUCED;
controls.autoRotateSpeed = 0.35;
let idleTimer = 0;
controls.addEventListener("start", () => { controls.autoRotate = false; clearTimeout(idleTimer); });
controls.addEventListener("end", () => { idleTimer = setTimeout(() => { if (!game.selected && !REDUCED) controls.autoRotate = true; }, 9000); });

// Світло
scene.add(new THREE.HemisphereLight(0x8fa2ff, 0x140808, 0.55));
const moon = new THREE.DirectionalLight(0xc9d6ff, 1.25);
moon.position.set(-40, 60, 25);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
Object.assign(moon.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 10, far: 160 });
scene.add(moon);
const hqLight = new THREE.PointLight(0xff2a3d, 60, 40, 1.6);
hqLight.position.set(0, 14, 0);
scene.add(hqLight);

// Матеріали
const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.1, ...opts });
const glow = (color, intensity = 2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });

// Земля, площа, дороги
const ground = new THREE.Mesh(new THREE.CircleGeometry(150, 64), mat(0x0c0c10, { roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(260, 65, 0x2a0a10, 0x15151b);
grid.position.y = 0.01;
grid.material.transparent = true;
grid.material.opacity = 0.55;
scene.add(grid);

const PLOT_R = 26;
const ROAD_R = 17;
const ring = new THREE.Mesh(new THREE.RingGeometry(ROAD_R - 2.2, ROAD_R + 2.2, 96), mat(0x17171d, { roughness: 0.95 }));
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.02;
ring.receiveShadow = true;
scene.add(ring);
for (let i = 0; i < 48; i += 1) {
  const a = (i / 48) * Math.PI * 2;
  const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.16), glow(0xffd27a, 0.6));
  dash.rotation.x = -Math.PI / 2;
  dash.rotation.z = -a;
  dash.position.set(Math.cos(a) * ROAD_R, 0.03, Math.sin(a) * ROAD_R);
  scene.add(dash);
}
const outerRing = new THREE.Mesh(new THREE.RingGeometry(ROAD_R + 2.2, ROAD_R + 2.45, 96), glow(0xe0182d, 1.2));
outerRing.rotation.x = -Math.PI / 2;
outerRing.position.y = 0.03;
scene.add(outerRing);

// ---------- Особняк (штаб) ----------
const textureLoader = new THREE.TextureLoader();
const hqGroup = new THREE.Group();
hqGroup.userData.target = "hq";
scene.add(hqGroup);

const windowTexture = (base, lit, cols = 6, rows = 10) => {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = base; g.fillRect(0, 0, c.width, c.height);
  const w = c.width / cols, h = c.height / rows;
  for (let y = 0; y < rows; y += 1) for (let x = 0; x < cols; x += 1) {
    const on = Math.random() < 0.62;
    g.fillStyle = on ? lit : "rgba(255,255,255,0.05)";
    g.globalAlpha = on ? 0.6 + Math.random() * 0.4 : 1;
    g.fillRect(x * w + w * 0.18, y * h + h * 0.22, w * 0.64, h * 0.5);
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};

const logoSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
textureLoader.load("/assets/castro-logo.webp", (t) => { t.colorSpace = THREE.SRGBColorSpace; logoSprite.material.map = t; logoSprite.material.needsUpdate = true; });
logoSprite.scale.set(6.5, 6.5, 1);
const logoRing = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.12, 8, 64), glow(0xff2a3d, 3));
logoRing.rotation.x = Math.PI / 2;

const buildHQ = (hq) => {
  hqGroup.clear();
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(13, 13.4, 0.5, 64), mat(0x16161b, { roughness: 0.9 }));
  plaza.position.y = 0.25; plaza.receiveShadow = true;
  hqGroup.add(plaza);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(13.2, 0.08, 6, 96), glow(0xe0182d, 1.6));
  trim.rotation.x = Math.PI / 2; trim.position.y = 0.52;
  hqGroup.add(trim);

  const floors = 1 + Math.min(3, Math.floor((hq - 1) / 3) + 1);
  const wall = mat(0xe8e2d8, { roughness: 0.6 });
  const tex = windowTexture("#d9d2c6", "#ffcf8a", 8, 3);
  const glass = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.5 });
  for (let f = 0; f < floors; f += 1) {
    const w = 11 - f * 1.8, d = 7.5 - f * 1.1;
    const block = new THREE.Mesh(new THREE.BoxGeometry(w, 2.6, d), [glass, glass, wall, wall, glass, glass]);
    block.position.set(-1.2 + f * 0.3, 0.5 + 1.3 + f * 2.6, -1 + f * 0.2);
    block.castShadow = true; block.receiveShadow = true;
    hqGroup.add(block);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.25, d + 0.6), mat(0x2a2a30));
    slab.position.set(block.position.x, block.position.y + 1.42, block.position.z);
    slab.castShadow = true;
    hqGroup.add(slab);
  }
  const pool = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 2.6), glow(0x2fb6ff, 0.9));
  pool.position.set(2.5, 0.6, 5.4);
  hqGroup.add(pool);
  const palm = (x, z) => {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 4.2, 6), mat(0x5a3e2b));
    trunk.position.set(x, 0.5 + 2.1, z); trunk.castShadow = true;
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.2, 7), mat(0x1f6b3a, { roughness: 0.9 }));
    leaves.position.set(x, 0.5 + 4.4, z); leaves.rotation.x = Math.PI; leaves.castShadow = true;
    hqGroup.add(trunk, leaves);
  };
  [[-9, 6], [9, 6], [-9, -7], [9, -7], [-4.5, 8], [7.5, 2]].forEach(([x, z]) => palm(x, z));
  // золоті кільця за рівнем штабу
  for (let i = 0; i < hq - 1; i += 1) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(10 + i * 0.35, 0.05, 6, 96), glow(0xf2c14e, 1.4));
    r.rotation.x = Math.PI / 2; r.position.y = 0.56;
    hqGroup.add(r);
  }
  const top = 0.5 + floors * 2.6 + 3.2;
  logoSprite.position.set(0, top + 2.6, 0);
  logoRing.position.set(0, top, 0);
  hqGroup.add(logoSprite, logoRing);
  hqLight.position.y = top + 2;
  hqGroup.userData.top = top + 6;
};

// ---------- Бізнеси ----------
const plots = new Map(); // id -> { group, label, pos, level, top }
const tmpColor = new THREE.Color();

const buildBusinessMesh = (b, level, group) => {
  group.clear();
  const color = new THREE.Color(b.color);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.5, 0.35, 48), mat(0x131318, { roughness: 0.9 }));
  pad.position.y = 0.17; pad.receiveShadow = true;
  group.add(pad);
  const padGlow = new THREE.Mesh(new THREE.TorusGeometry(6.35, 0.06, 6, 64), glow(color, level > 0 ? 1.8 : 0.5));
  padGlow.rotation.x = Math.PI / 2; padGlow.position.y = 0.36;
  group.add(padGlow);

  if (level <= 0) {
    const box = new THREE.BoxGeometry(5, 6, 5);
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 }));
    lines.position.y = 3.4;
    const holo = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.06, depthWrite: false }));
    holo.position.y = 3.4;
    group.add(lines, holo);
    group.userData.holo = [lines, holo];
    return 7;
  }
  group.userData.holo = null;
  const height = 3 + Math.log2(level + 1) * 2.1;
  tmpColor.copy(color).multiplyScalar(0.18);
  const tex = windowTexture(`#${tmpColor.getHexString()}`, b.color, 6, Math.max(4, Math.round(height * 1.2)));
  const facade = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 1.1, roughness: 0.55, metalness: 0.2 });
  const roofMat = mat(0x1d1d23);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(4.6, height, 4.6), [facade, facade, roofMat, roofMat, facade, facade]);
  tower.position.y = 0.35 + height / 2;
  tower.castShadow = true; tower.receiveShadow = true;
  group.add(tower);
  const band = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.3, 4.9), glow(color, 2.6));
  band.position.y = 0.35 + height + 0.15;
  group.add(band);
  // прибудова з рівнем
  if (level >= 5) {
    const wingH = Math.min(height * 0.55, 6);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.6, wingH, 3.6), [facade, facade, roofMat, roofMat, facade, facade]);
    wing.position.set(3.4, 0.35 + wingH / 2, 0.4);
    wing.castShadow = true;
    group.add(wing);
  }
  // віхи — дахові елементи
  const ms = E.MILESTONES.filter((m) => level >= m).length;
  for (let i = 0; i < ms; i += 1) {
    const ringM = new THREE.Mesh(new THREE.TorusGeometry(2.9 + i * 0.25, 0.05, 6, 48), glow(i % 2 ? 0xf2c14e : color, 2));
    ringM.rotation.x = Math.PI / 2;
    ringM.position.y = 0.35 + height + 0.5 + i * 0.35;
    group.add(ringM);
  }
  if (level >= 25) {
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 3, 6), mat(0x8a8a92, { metalness: 0.8 }));
    antenna.position.y = 0.35 + height + 1.5;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), glow(0xff2a3d, 4));
    tip.position.y = 0.35 + height + 3.05;
    group.add(antenna, tip);
    group.userData.tip = tip;
  }
  return 0.35 + height + 2;
};

const labelFor = (b) => {
  const el = document.createElement("div");
  el.className = "gx-label";
  el.style.setProperty("--c", b.color);
  el.innerHTML = `<span class="gx-label__name">${esc(b.icon)} ${esc(b.short)}</span><span class="gx-label__lvl"></span>`;
  return new CSS2DObject(el);
};

const setupPlots = () => {
  game.config.businesses.forEach((b, i) => {
    const a = (i / game.config.businesses.length) * Math.PI * 2 - Math.PI / 2;
    const pos = new THREE.Vector3(Math.cos(a) * PLOT_R, 0, Math.sin(a) * PLOT_R);
    const group = new THREE.Group();
    group.position.copy(pos);
    group.userData.target = b.id;
    scene.add(group);
    // дорога від кільця до ділянки
    const spoke = new THREE.Mesh(new THREE.PlaneGeometry(3.2, PLOT_R - ROAD_R - 6), mat(0x17171d, { roughness: 0.95 }));
    spoke.rotation.x = -Math.PI / 2;
    spoke.rotation.z = -a + Math.PI / 2;
    const mid = (ROAD_R + 2 + PLOT_R - 6.2) / 2;
    spoke.position.set(Math.cos(a) * mid, 0.025, Math.sin(a) * mid);
    spoke.receiveShadow = true;
    scene.add(spoke);
    const label = labelFor(b);
    scene.add(label);
    const beacon = new THREE.Group();
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), glow(0xff2a3d, 4));
    const halo = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xff2a3d, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
    halo.position.y = -2.6;
    const beam = new THREE.PointLight(0xff2a3d, 30, 16, 1.5);
    beacon.add(bulb, halo, beam);
    beacon.visible = false;
    beacon.userData = { bulb, beam };
    scene.add(beacon);
    plots.set(b.id, { b, group, label, pos, level: -1, top: 7, beacon });
  });
  const hqLabelEl = document.createElement("div");
  hqLabelEl.className = "gx-label";
  hqLabelEl.style.setProperty("--c", "#e0182d");
  hqLabelEl.innerHTML = `<span class="gx-label__name">🏛️ Штаб CASTRO</span><span class="gx-label__lvl"></span>`;
  const hqLabel = new CSS2DObject(hqLabelEl);
  scene.add(hqLabel);
  plots.set("hq", { b: null, group: hqGroup, label: hqLabel, pos: new THREE.Vector3(), level: -1, top: 14 });
};

// Підсвітка вибраного
const selRing = new THREE.Mesh(new THREE.RingGeometry(6.8, 7.3, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
selRing.rotation.x = -Math.PI / 2;
selRing.position.y = 0.05;
selRing.visible = false;
scene.add(selRing);

// ---------- Машини на кільці ----------
const cars = [];
const CAR_COLORS = [0xe0182d, 0xf2f2f2, 0x111111, 0x2fb6ff, 0xf2c14e, 0x22c55e, 0xc04bff, 0xff7a1a];
const makeCar = (color) => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 0.95), mat(color, { metalness: 0.6, roughness: 0.35 }));
  body.position.y = 0.45; body.castShadow = true;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.45, 0.85), mat(0x0d0d12, { metalness: 0.5, roughness: 0.2 }));
  cabin.position.set(-0.1, 0.92, 0);
  const lights = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.8), glow(0xfff2c0, 3));
  lights.position.set(0.96, 0.5, 0);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.8), glow(0xff1a2a, 3));
  tail.position.set(-0.96, 0.5, 0);
  g.add(body, cabin, lights, tail);
  return g;
};
const syncCars = () => {
  const unlocked = game.config.businesses.filter((b) => (game.state.levels[b.id] || 0) > 0).length;
  const want = Math.min(16, 2 + unlocked * 2 + Math.floor(game.state.hq / 2));
  while (cars.length < want) {
    const car = makeCar(CAR_COLORS[cars.length % CAR_COLORS.length]);
    const lane = cars.length % 2;
    car.userData = { a: Math.random() * Math.PI * 2, r: ROAD_R + (lane ? 1.05 : -1.05), dir: lane ? 1 : -1, speed: 0.12 + Math.random() * 0.08 };
    scene.add(car);
    cars.push(car);
  }
};

// ---------- Частинки (вибух при покращенні) ----------
const bursts = [];
const burst = (pos, color) => {
  if (REDUCED) return;
  const n = 60;
  const geo = new THREE.BufferGeometry();
  const p = new Float32Array(n * 3);
  const v = [];
  for (let i = 0; i < n; i += 1) {
    p[i * 3] = pos.x; p[i * 3 + 1] = pos.y; p[i * 3 + 2] = pos.z;
    v.push(new THREE.Vector3((Math.random() - 0.5) * 9, Math.random() * 10 + 4, (Math.random() - 0.5) * 9));
  }
  geo.setAttribute("position", new THREE.BufferAttribute(p, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.35, transparent: true, depthWrite: false }));
  scene.add(pts);
  bursts.push({ pts, v, life: 1.4 });
};

// ---------- Плаваючий дохід ----------
const floatMoney = (id, amount) => {
  const plot = plots.get(id);
  if (!plot || document.hidden) return;
  const el = document.createElement("div");
  el.className = "gx-float";
  el.textContent = `+${fmt(amount)}`;
  const obj = new CSS2DObject(el);
  obj.position.set(plot.pos.x + (Math.random() - 0.5) * 2, plot.top + 1, plot.pos.z + (Math.random() - 0.5) * 2);
  scene.add(obj);
  setTimeout(() => { scene.remove(obj); el.remove(); }, 1600);
};

// ---------- Камера до обʼєкта ----------
const camGoal = { target: new THREE.Vector3(), active: false };
const focusOn = (id) => {
  const plot = plots.get(id);
  if (!plot) return;
  camGoal.target.copy(plot.pos).setY(id === "hq" ? 4 : 3);
  camGoal.active = true;
  controls.autoRotate = false;
};

// ---------- Оновлення сцени під стан ----------
const refreshWorld = (changedId) => {
  if (!game.state) return;
  if (plots.get("hq").level !== game.state.hq) {
    buildHQ(game.state.hq);
    plots.get("hq").level = game.state.hq;
    plots.get("hq").top = hqGroup.userData.top;
  }
  game.config.businesses.forEach((b) => {
    const plot = plots.get(b.id);
    const lvl = game.state.levels[b.id] || 0;
    if (plot.level !== lvl) {
      plot.top = buildBusinessMesh(b, lvl, plot.group);
      plot.level = lvl;
      if (changedId === b.id) {
        plot.group.scale.setScalar(0.6);
        plot.pop = 0;
      }
    }
    plot.label.position.set(plot.pos.x, plot.top + 1.2, plot.pos.z);
    plot.beacon.position.set(plot.pos.x, plot.top + 0.6, plot.pos.z);
    plot.beacon.visible = isDown(b.id);
  });
  const hqPlot = plots.get("hq");
  hqPlot.label.position.set(0, hqPlot.top + 2.4, 0);
  syncCars();
  refreshLabels();
};

const refreshLabels = () => {
  const cash = liveCash();
  plots.forEach((plot, id) => {
    const el = plot.label.element;
    const lvlEl = el.querySelector(".gx-label__lvl");
    const lvl = levelOf(id);
    const cost = nextCost(id);
    const locked = id !== "hq" && lvl === 0;
    const down = isDown(id);
    el.classList.toggle("is-locked", locked);
    el.classList.toggle("is-alert", down);
    el.classList.toggle("is-ready", !down && cost != null && cash >= cost);
    lvlEl.textContent = down ? "⚠️ ПРОСТІЙ" : locked ? `🔒 ${fmt(cost)}` : id === "hq" ? `РІВ. ${lvl}/${game.config.hqMax}` : `РІВ. ${lvl}`;
  });
};

// =====================================================================
// ІНТЕРФЕЙС
// =====================================================================
const bizById = (id) => game.config.businesses.find((b) => b.id === id);
const nextCost = (id) => {
  if (id === "hq") return game.state.hq < game.config.hqMax ? E.hqCost(game.state.hq) : null;
  const b = bizById(id);
  const lvl = game.state.levels[id] || 0;
  return lvl >= game.config.maxLevel ? null : E.levelCost(b, lvl);
};
const costOfN = (id, n) => {
  let total = 0, lvl = levelOf(id), bought = 0;
  const b = bizById(id);
  while (bought < n) {
    const c = id === "hq" ? (lvl < game.config.hqMax ? E.hqCost(lvl) : null) : (lvl < game.config.maxLevel ? E.levelCost(b, lvl) : null);
    if (c == null) break;
    total += c; lvl += 1; bought += 1;
  }
  return { total, bought };
};
const maxAffordable = (id) => {
  let cash = liveCash(), lvl = levelOf(id), bought = 0, total = 0;
  const b = bizById(id);
  while (bought < 500) {
    const c = id === "hq" ? (lvl < game.config.hqMax ? E.hqCost(lvl) : null) : (lvl < game.config.maxLevel ? E.levelCost(b, lvl) : null);
    if (c == null || cash < c) break;
    cash -= c; total += c; lvl += 1; bought += 1;
  }
  return { bought, total };
};

const toast = (() => {
  let t = 0;
  return (text) => {
    const el = $("toast");
    el.textContent = text;
    el.classList.add("is-on");
    clearTimeout(t);
    t = setTimeout(() => el.classList.remove("is-on"), 2600);
  };
})();

const rankProgress = () => {
  const r = game.state.rank;
  if (!r.next) return 100;
  const cur = game.config.ranks[r.index].min;
  const lo = Math.log10(Math.max(1, cur)), hi = Math.log10(r.next.min), v = Math.log10(Math.max(1, game.state.earned));
  return Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
};

const renderHud = () => {
  $("cash").textContent = fmt(liveCash());
  $("rate").textContent = `+${fmt(game.state.rate)} / сек`;
  $("rank").textContent = game.state.rank.name;
  $("rankBar").style.width = `${rankProgress()}%`;
};

const renderPanel = () => {
  const id = game.selected;
  const panel = $("panel");
  if (!id) { panel.hidden = true; selRing.visible = false; return; }
  panel.hidden = false;
  const isHQ = id === "hq";
  const b = isHQ ? null : bizById(id);
  const lvl = levelOf(id);
  const color = isHQ ? "#e0182d" : b.color;
  panel.style.setProperty("--c", color);
  $("pIcon").textContent = isHQ ? "🏛️" : b.icon;
  $("pKind").textContent = isHQ ? "Штаб сімʼї" : lvl ? "Бізнес" : "Не куплено";
  $("pName").textContent = isHQ ? "Особняк CASTRO" : b.name;
  $("pDesc").textContent = isHQ
    ? `Серце імперії. Кожен рівень штабу збільшує дохід УСІХ бізнесів. Зараз ×${game.state.hqMult.toFixed(1)}.`
    : b.desc;
  $("pLevel").textContent = isHQ ? `${lvl}/${game.config.hqMax}` : lvl;
  const inc = !isHQ && game.state.incidents?.[id];
  const incCfg = inc && game.config.incidents?.[id];
  panel.classList.toggle("is-down", !!inc);
  $("pIncident").hidden = !inc;
  if (inc && incCfg) {
    $("iIcon").textContent = incCfg.icon;
    $("iTitle").textContent = incCfg.title;
    const mins = Math.max(1, Math.round((Date.now() - inc.started_at) / 60000));
    $("iText").textContent = `${incCfg.text} Простій уже ${mins} хв.`;
    $("iPlay").querySelector("span").textContent = `🧽 ${incCfg.action}`;
    $("iHireCost").textContent = fmt(inc.hireCost);
    $("iHire").disabled = liveCash() < inc.hireCost || game.busy;
    $("iPlay").disabled = game.busy;
  }
  if (isHQ) {
    $("pIncome").textContent = `×${E.hqMult(lvl).toFixed(1)}`;
    $("pNext").textContent = lvl < game.config.hqMax ? `×${E.hqMult(lvl + 1).toFixed(1)}` : "MAX";
    $("pMilestone").hidden = true;
  } else {
    const mult = game.state.hqMult;
    const now = E.businessIncome(b, lvl) * mult;
    const next = E.businessIncome(b, lvl + 1) * mult;
    $("pIncome").textContent = inc ? "$0/с ⚠️" : `${fmt(now)}/с`;
    $("pNext").textContent = `+${fmt(next - now)}/с`;
    const nextMs = game.config.milestones.find((m) => m > lvl);
    $("pMilestone").hidden = !nextMs;
    if (nextMs) {
      const prevMs = [0, ...game.config.milestones].filter((m) => m <= lvl).pop();
      $("pMsText").textContent = `Віха: дохід ×2 на рівні ${nextMs}`;
      $("pMsVal").textContent = `${lvl}/${nextMs}`;
      $("pMsBar").style.width = `${((lvl - prevMs) / (nextMs - prevMs)) * 100}%`;
    }
  }
  const cash = liveCash();
  const c1 = nextCost(id);
  const c10 = costOfN(id, 10);
  const cm = maxAffordable(id);
  const [b1, b10, bm] = panel.querySelectorAll(".gx-buy .gx-btn");
  b1.querySelector("span").textContent = !isHQ && lvl === 0 ? "Купити" : "Покращити";
  $("pCost1").textContent = c1 == null ? "MAX" : fmt(c1);
  b1.disabled = c1 == null || cash < c1 || game.busy;
  $("pCost10").textContent = c10.bought ? fmt(c10.total) : "—";
  b10.disabled = c10.bought < 10 || cash < c10.total || game.busy || (!isHQ && lvl === 0);
  b10.hidden = isHQ;
  $("pCostMax").textContent = cm.bought ? `+${cm.bought}` : "—";
  bm.disabled = cm.bought < 1 || game.busy;
  selRing.visible = true;
  selRing.material.color.set(color);
  const plot = plots.get(id);
  selRing.position.set(plot.pos.x, 0.05, plot.pos.z);
  selRing.scale.setScalar(isHQ ? 2 : 1);
};

const renderList = () => {
  if ($("sheet-list").hidden) return;
  const cash = liveCash();
  const rows = [{ id: "hq", icon: "🏛️", name: "Особняк CASTRO", color: "#e0182d" }, ...game.config.businesses.map((b) => ({ id: b.id, icon: b.icon, name: b.name, color: b.color }))];
  $("list").innerHTML = rows.map((r) => {
    const lvl = levelOf(r.id);
    const cost = nextCost(r.id);
    const locked = r.id !== "hq" && lvl === 0;
    const income = r.id === "hq" ? `Множник ×${game.state.hqMult.toFixed(1)}` : locked ? "Не куплено" : isDown(r.id) ? `⚠️ Простій • рів. ${lvl}` : `${fmt(E.businessIncome(bizById(r.id), lvl) * game.state.hqMult)}/с • рів. ${lvl}`;
    const ready = cost != null && cash >= cost;
    return `<button type="button" class="gx-item ${locked ? "is-locked" : ""} ${ready ? "is-ready" : ""}" data-pick="${r.id}" style="--c:${r.color}">
      <span class="gx-item__icon">${esc(r.icon)}</span>
      <span><b>${esc(r.name)}</b><small>${esc(income)}</small></span>
      <span class="gx-item__cost">${cost == null ? "MAX" : fmt(cost)}<em>${locked ? "купити" : "покращити"}</em></span>
    </button>`;
  }).join("");
};

const select = (id) => {
  game.selected = id;
  if (id) focusOn(id);
  renderPanel();
  if (innerWidth <= 760) closeSheets();
};

const closeSheets = () => {
  document.querySelectorAll(".gx-sheet").forEach((s) => { s.hidden = true; });
  document.querySelectorAll(".gx-dock button").forEach((b) => b.classList.remove("is-active"));
};
const openSheet = async (name) => {
  const sheet = $(`sheet-${name}`);
  const wasOpen = !sheet.hidden;
  closeSheets();
  if (wasOpen) return;
  if (innerWidth <= 760) { game.selected = null; renderPanel(); }
  sheet.hidden = false;
  document.querySelector(`.gx-dock [data-open="${name}"]`)?.classList.add("is-active");
  if (name === "list") renderList();
  if (name === "top") loadTop();
};

const loadTop = async () => {
  $("top").innerHTML = `<li><span></span><span></span><span class="gx-top__name"><b>Завантаження…</b></span></li>`;
  const { data } = await api("/game/top");
  if (!data?.ok) { $("top").innerHTML = `<li><span></span><span></span><span class="gx-top__name"><b>Не вдалося завантажити ТОП</b></span></li>`; return; }
  $("top").innerHTML = data.top.map((p, i) => {
    const av = safeAvatar(p.avatar);
    return `<li class="${p.id === data.me.id ? "is-me" : ""}"><span class="gx-top__pos">${i + 1}</span>${av ? `<img src="${esc(av)}" alt="">` : `<span class="gx-ava">${esc((p.name || "?").charAt(0))}</span>`}
      <span class="gx-top__name"><b>${esc(p.name || "Гравець")}</b><small>${esc(p.rank)} • штаб ${p.hq}</small></span><span class="gx-top__val">${fmt(p.earned)}</span></li>`;
  }).join("") || `<li><span></span><span></span><span class="gx-top__name"><b>Поки порожньо</b></span></li>`;
  $("myPlace").textContent = `Твоє місце: ${data.me.place} з ${data.me.total}. Рейтинг — за всіма заробленими грошима.`;
};

// Покупка
const buy = async (count) => {
  const id = game.selected;
  if (!id || game.busy) return;
  const beforeLvl = levelOf(id);
  const beforeMs = E.MILESTONES.filter((m) => beforeLvl >= m).length;
  const beforeRank = game.state.rank.index;
  game.busy = true;
  renderPanel();
  try {
    const { status, data } = await api("/game/upgrade", { target: id, count });
    if (status === 401 || status === 403) { location.reload(); return; }
    if (!data?.ok) { toast("Не вдалося. Спробуй ще раз."); return; }
    game.state = data.state;
    game.syncedAt = performance.now();
    if (!data.result.bought) { toast("Не вистачає грошей"); return; }
    const lvl = levelOf(id);
    refreshWorld(id);
    const plot = plots.get(id);
    burst(new THREE.Vector3(plot.pos.x, plot.top, plot.pos.z), new THREE.Color(id === "hq" ? 0xf2c14e : bizById(id).color));
    $("cash").parentElement.classList.remove("is-pop"); void $("cash").offsetWidth; $("cash").parentElement.classList.add("is-pop");
    if (id !== "hq" && beforeLvl === 0) toast(`🔓 Відкрито: ${bizById(id).name}!`);
    else if (id === "hq") toast(`🏛️ Штаб ${lvl} рівня — дохід усіх бізнесів ×${game.state.hqMult.toFixed(1)}`);
    else if (E.MILESTONES.filter((m) => lvl >= m).length > beforeMs) toast(`⚡ Віха! ${bizById(id).short}: дохід ×2`);
    if (game.state.rank.index > beforeRank) showModal({ icon: "🎖️", kicker: "Новий ранг", title: game.state.rank.name, text: "Імперія росте. Сімʼя помічає твої успіхи.", ok: "Далі" });
  } catch {
    toast("Немає звʼязку з сервером");
  } finally {
    game.busy = false;
    renderPanel();
    renderHud();
    renderList();
  }
};

// ---------- Події: підміна (міні-гра) або найм ----------
const fixIncident = async (id) => {
  if (game.busy || !isDown(id)) return;
  let token = null;
  const res = await playCarWash({
    practice: false,
    onStart: async () => {
      const { data } = await api("/game/incident/start", { id });
      if (!data?.ok) { toast("Подію вже вирішено або сталася помилка"); if (data?.state) { game.state = data.state; game.syncedAt = performance.now(); refreshWorld(); } return false; }
      token = data.result.token;
      return true;
    },
  });
  if (res.cancelled || !token) return;
  game.busy = true;
  try {
    const { data } = await api("/game/incident/finish", { id, token, score: res.score });
    if (data?.state) { game.state = data.state; game.syncedAt = performance.now(); }
    if (!data?.ok) { toast(data?.error === "bad_timing" ? "Надто швидко — спробуй ще раз" : "Не вдалося зарахувати. Спробуй ще раз."); return; }
    refreshWorld(id);
    if (data.result.passed) {
      const plot = plots.get(id);
      burst(new THREE.Vector3(plot.pos.x, plot.top, plot.pos.z), new THREE.Color(0x3fb6ff));
      showModal({ icon: "✨", kicker: `${"★".repeat(data.result.stars)} Мийка знову працює`, title: `+${fmt(data.result.bonus)}`, text: `Чистота ${data.result.score}%. Клієнти повертаються, а за якісну роботу — бонус.`, ok: "Супер" });
    } else {
      toast(`Чистота ${data.result.score}% — замало. Мийка ще стоїть.`);
    }
  } finally {
    game.busy = false;
    renderPanel(); renderHud(); renderList(); renderGames();
  }
};

const hireIncident = async (id) => {
  if (game.busy || !isDown(id)) return;
  game.busy = true;
  try {
    const { data } = await api("/game/incident/hire", { id });
    if (data?.state) { game.state = data.state; game.syncedAt = performance.now(); }
    if (!data?.ok || !data.result.hired) { toast("Не вистачає грошей на підміну"); return; }
    refreshWorld(id);
    toast(`👷 Підміну найнято за ${fmt(data.result.cost)} — бізнес знову працює`);
  } finally {
    game.busy = false;
    renderPanel(); renderHud(); renderList(); renderGames();
  }
};

const renderGames = () => {
  const down = isDown("wash");
  $("gameWash").classList.toggle("is-alert", down);
  $("gameWashBadge").textContent = down ? "⚠️ Мийка стоїть — врятуй!" : "Тренування";
};

// Сповіщення про нову подію — один раз на кожну
const seenIncidents = new Set(JSON.parse(sessionStorage.getItem("gx-seen-incidents") || "[]"));
const announceIncidents = () => {
  Object.entries(game.state.incidents || {}).forEach(([id, inc]) => {
    const key = `${id}:${inc.started_at}`;
    if (seenIncidents.has(key)) return;
    seenIncidents.add(key);
    try { sessionStorage.setItem("gx-seen-incidents", JSON.stringify([...seenIncidents])); } catch {}
    const cfg = game.config.incidents?.[id];
    if (!cfg || !$("modal").hidden) return;
    showModal({ icon: "⚠️", kicker: `${bizById(id).short} • простій`, title: cfg.title, text: `${cfg.text} Підміни працівника в міні-грі або найми когось.`, ok: "До бізнесу" });
    $("mOk").onclick = () => { $("modal").hidden = true; $("mOk").onclick = null; select(id); };
  });
};

const showModal = ({ icon, kicker, title, text, ok }) => {
  $("mIcon").textContent = icon;
  $("mKicker").textContent = kicker;
  $("mTitle").textContent = title;
  $("mText").textContent = text;
  $("mOk").textContent = ok || "OK";
  $("modal").hidden = false;
};

// ---------- Події ----------
$("panelClose").addEventListener("click", () => select(null));
document.querySelectorAll(".gx-buy .gx-btn").forEach((btn) => btn.addEventListener("click", () => buy(btn.dataset.count === "max" ? "max" : Number(btn.dataset.count))));
document.querySelectorAll(".gx-dock [data-open]").forEach((btn) => btn.addEventListener("click", () => openSheet(btn.dataset.open)));
document.querySelectorAll(".gx-sheet [data-close]").forEach((btn) => btn.addEventListener("click", closeSheets));
$("list").addEventListener("click", (e) => { const item = e.target.closest("[data-pick]"); if (item) select(item.dataset.pick); });
$("mOk").addEventListener("click", () => { $("modal").hidden = true; });
$("iPlay").addEventListener("click", () => fixIncident(game.selected));
$("iHire").addEventListener("click", () => hireIncident(game.selected));
const openWashGame = () => {
  if (isDown("wash")) { closeSheets(); fixIncident("wash"); }
  else playCarWash({ practice: true });
};
$("gameWash").addEventListener("click", openWashGame);
$("gameWash").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openWashGame(); } });
addEventListener("keydown", (e) => {
  if (e.key === "Escape") { if (!$("modal").hidden) $("modal").hidden = true; else if (game.selected) select(null); else closeSheets(); }
});

// Клік по 3D-обʼєкту (відрізняємо від перетягування камери)
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downAt = null;
canvas.addEventListener("pointerdown", (e) => { downAt = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener("pointerup", (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6 || !game.state) return;
  const r = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const groups = [...plots.values()].map((p) => p.group);
  const hit = raycaster.intersectObjects(groups, true)[0];
  if (!hit) { select(null); return; }
  let o = hit.object;
  while (o && !o.userData.target) o = o.parent;
  if (o) select(o.userData.target);
});

const resize = () => {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  labelRenderer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w < 760 ? 58 : 45;
  camera.updateProjectionMatrix();
};
addEventListener("resize", resize);
resize();

// ---------- Цикл ----------
const clock = new THREE.Clock();
let incomeTick = 0, uiTick = 0;
const loop = () => {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  if (camGoal.active) {
    controls.target.lerp(camGoal.target, 1 - Math.pow(0.002, dt));
    if (controls.target.distanceTo(camGoal.target) < 0.05) camGoal.active = false;
  }
  controls.update();
  logoSprite.position.y += Math.sin(t * 1.6) * 0.004;
  logoRing.rotation.z += dt * 0.8;
  hqLight.intensity = 55 + Math.sin(t * 2.2) * 10;
  selRing.material.opacity = 0.5 + Math.sin(t * 4) * 0.3;
  outerRing.material.emissiveIntensity = 1 + Math.sin(t * 1.4) * 0.4;
  plots.forEach((plot) => {
    if (plot.pop != null) {
      plot.pop = Math.min(1, plot.pop + dt * 2.4);
      const k = plot.pop - 1;
      const easeBack = 1 + 2.70158 * k * k * k + 1.70158 * k * k; // easeOutBack
      plot.group.scale.setScalar(0.6 + 0.4 * easeBack);
      if (plot.pop >= 1) { plot.group.scale.setScalar(1); plot.pop = null; }
    }
    const holo = plot.group.userData.holo;
    if (holo) { holo[0].material.opacity = 0.35 + Math.sin(t * 2.5) * 0.3; holo[0].rotation.y += dt * 0.3; holo[1].rotation.y = holo[0].rotation.y; }
    if (plot.beacon?.visible) {
      const on = Math.sin(t * 9) > 0;
      plot.beacon.userData.bulb.material.emissiveIntensity = on ? 6 : 0.6;
      plot.beacon.userData.beam.intensity = on ? 40 : 4;
      plot.beacon.rotation.y += dt * 3;
      plot.beacon.position.y = plot.top + 0.6 + Math.sin(t * 3) * 0.15;
    }
    const tip = plot.group.userData.tip;
    if (tip) tip.material.emissiveIntensity = Math.sin(t * 5) > 0 ? 5 : 0.3;
  });
  cars.forEach((car) => {
    const d = car.userData;
    d.a += d.dir * d.speed * dt;
    car.position.set(Math.cos(d.a) * d.r, 0, Math.sin(d.a) * d.r);
    car.rotation.y = -d.a + (d.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
  });
  for (let i = bursts.length - 1; i >= 0; i -= 1) {
    const bst = bursts[i];
    bst.life -= dt;
    const arr = bst.pts.geometry.attributes.position.array;
    bst.v.forEach((v, k) => { v.y -= 18 * dt; arr[k * 3] += v.x * dt; arr[k * 3 + 1] += v.y * dt; arr[k * 3 + 2] += v.z * dt; });
    bst.pts.geometry.attributes.position.needsUpdate = true;
    bst.pts.material.opacity = Math.max(0, bst.life / 1.4);
    if (bst.life <= 0) { scene.remove(bst.pts); bst.pts.geometry.dispose(); bst.pts.material.dispose(); bursts.splice(i, 1); }
  }
  if (game.state) {
    uiTick += dt;
    if (uiTick > 0.1) { uiTick = 0; renderHud(); }
    incomeTick += dt;
    if (incomeTick > 2.5) {
      incomeTick = 0;
      game.config.businesses.forEach((b) => {
        const lvl = game.state.levels[b.id] || 0;
        if (lvl > 0 && !isDown(b.id)) floatMoney(b.id, E.businessIncome(b, lvl) * game.state.hqMult * 2.5);
      });
      refreshLabels();
      if (game.selected) renderPanel();
      renderList();
    }
  }
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  requestAnimationFrame(loop);
};

// ---------- Старт ----------
const resync = async () => {
  try {
    const { status, data } = await api("/game/state");
    if (status === 200 && data?.ok) { game.state = data.state; game.syncedAt = performance.now(); refreshWorld(); renderPanel(); renderGames(); announceIncidents(); }
  } catch { /* наступного разу */ }
};

const start = async () => {
  gateBar(25);
  gateText("Підключення до серверу сімʼї…");
  let res;
  try { res = await api("/game/state"); } catch { res = null; }
  if (!res) return gateFail("Немає звʼязку з сервером. Спробуй трохи пізніше.", `<button class="gx-btn gx-btn--red" type="button" onclick="location.reload()"><b>Спробувати ще</b></button>`);
  const { status, data } = res;
  if (status === 401) {
    const login = `${API}/auth/login?return=${encodeURIComponent(SITE + "/cabinet/game/")}`;
    return gateFail("Увійди через Discord, щоб грати. Прогрес зберігається у твоєму акаунті.", `<a class="gx-btn gx-btn--red" href="${esc(login)}"><b>Увійти через Discord</b></a>`);
  }
  if (status === 403) return gateFail("Поки що гра доступна лише учасникам сімʼї CASTRO.", `<a class="gx-btn gx-btn--red" href="/join/"><b>Вступити в сімʼю</b></a><a class="gx-btn" href="/"><b>На головну</b></a>`);
  if (!data?.ok) return gateFail("Гра тимчасово недоступна. Спробуй трохи пізніше.", `<button class="gx-btn gx-btn--red" type="button" onclick="location.reload()"><b>Спробувати ще</b></button>`);

  gateBar(70);
  gateText("Будуємо місто…");
  game.config = data.config;
  game.state = data.state;
  game.player = data.player;
  game.syncedAt = performance.now();
  $("meAvatar").src = safeAvatar(data.player?.avatar) || "/assets/castro-logo.webp";
  setupPlots();
  refreshWorld();
  loop();
  await new Promise((r) => setTimeout(r, 350));
  gateBar(100);
  gate.classList.add("is-done");
  $("hud").hidden = false;
  $("dock").hidden = false;
  renderHud();
  if (data.offline?.gain > 0) {
    const h = Math.floor(data.offline.seconds / 3600), m = Math.floor((data.offline.seconds % 3600) / 60);
    showModal({ icon: "💰", kicker: "Поки тебе не було", title: `+${fmt(data.offline.gain)}`,
      text: `Бізнеси працювали ${h ? `${h} год ` : ""}${m} хв${data.offline.capped ? " (максимум 8 год — заходь частіше!)" : ""}.`, ok: "Забрати" });
  } else if (data.isNew) {
    showModal({ icon: "🏛️", kicker: "Ласкаво просимо", title: "CASTRO: Empire", text: "Твоя імперія починається з автомийки. Клікай на будівлі, прокачуй бізнеси, відкривай нові точки й піднімайся в ТОП сімʼї.", ok: "Почати" });
  }
  renderGames();
  if ($("modal").hidden) announceIncidents();
  else {
    const prev = $("mOk").onclick;
    $("mOk").onclick = () => { $("modal").hidden = true; $("mOk").onclick = prev; setTimeout(announceIncidents, 250); };
  }
  setInterval(resync, 45000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) resync(); });
};

start();
