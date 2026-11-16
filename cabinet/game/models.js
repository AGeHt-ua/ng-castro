// CASTRO: Empire — процедурні 3D-моделі (авто, вілла, бізнеси, місто). Без зовнішніх файлів.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// ---------- Матеріали (кешовані) ----------
const cache = new Map();
const once = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
export const M = {
  std: (color, o = {}) => once(`std:${color}:${JSON.stringify(o)}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...o })),
  paint: (color) => new THREE.MeshPhysicalMaterial({ color, metalness: 0.55, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.1 }),
  glass: () => once("glass", () => new THREE.MeshPhysicalMaterial({ color: 0x0b1018, metalness: 0.2, roughness: 0.05, clearcoat: 1, envMapIntensity: 1.4 })),
  neon: (color, intensity = 3) => once(`neon:${color}:${intensity}`, () => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 })),
  chrome: () => once("chrome", () => new THREE.MeshStandardMaterial({ color: 0xd8dce4, metalness: 1, roughness: 0.18, envMapIntensity: 1.2 })),
  rubber: () => once("rubber", () => new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.92 })),
};

const mesh = (geo, mat, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s, cast = true, receive = false } = {}) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  if (s) m.scale.set(...(Array.isArray(s) ? s : [s, s, s]));
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
};
const rbox = (w, h, d, r = 0.08, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));

// Текстура вікон із теплим світлом (для фасадів)
export const windowsTexture = (base = "#1b1d24", lit = "#ffcf8a", cols = 6, rows = 6, density = 0.6) => {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  const w = 256 / cols, h = 256 / rows;
  for (let y = 0; y < rows; y += 1) for (let x = 0; x < cols; x += 1) {
    const on = Math.random() < density;
    const grad = g.createLinearGradient(0, y * h, 0, y * h + h);
    grad.addColorStop(0, on ? lit : "#0e1118");
    grad.addColorStop(1, on ? "#a8652a" : "#07090d");
    g.fillStyle = grad;
    g.globalAlpha = on ? 0.7 + Math.random() * 0.3 : 1;
    g.fillRect(x * w + w * 0.12, y * h + h * 0.16, w * 0.76, h * 0.62);
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};
const litFacade = (tex, repX = 1, repY = 1, intensity = 1.1) => {
  const t = tex.clone(); t.needsUpdate = true; t.repeat.set(repX, repY);
  return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: intensity, roughness: 0.35, metalness: 0.3 });
};

// Текстова вивіска (неон на чорному)
export const signTexture = (text, color = "#ff2a3d", w = 512, h = 128) => {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = "#07070a"; g.fillRect(0, 0, w, h);
  g.font = `400 ${Math.round(h * 0.62)}px Anton, Impact, sans-serif`;
  g.textAlign = "center"; g.textBaseline = "middle";
  g.shadowColor = color; g.shadowBlur = h * 0.25;
  g.fillStyle = color; g.fillText(text, w / 2, h / 2 + 2);
  g.shadowBlur = 0; g.fillStyle = "#fff"; g.globalAlpha = 0.85; g.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
const sign = (text, color, w, h) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: signTexture(text, color), emissiveMap: signTexture(text, color), emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.5 }));

// ---------- UV «коробкова проєкція» в атлас 3×2 (для бруду в міні-грі) ----------
export const boxAtlasUV = (geometry) => {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  g.computeVertexNormals();
  g.computeBoundingBox();
  const bb = g.boundingBox, size = new THREE.Vector3(); bb.getSize(size);
  const pos = g.attributes.position, uv = new Float32Array(pos.count * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    n.copy(c).sub(b).cross(a.clone().sub(b)).normalize();
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    // грань: 0 +x, 1 -x, 2 +y, 3 -y, 4 +z, 5 -z (як у BoxGeometry)
    const face = ax >= ay && ax >= az ? (n.x > 0 ? 0 : 1) : ay >= az ? (n.y > 0 ? 2 : 3) : (n.z > 0 ? 4 : 5);
    const col = face % 3, row = Math.floor(face / 3);
    [a, b, c].forEach((p, k) => {
      let u, v;
      if (face < 2) { u = (p.z - bb.min.z) / size.z; v = (p.y - bb.min.y) / size.y; }
      else if (face < 4) { u = (p.x - bb.min.x) / size.x; v = (p.z - bb.min.z) / size.z; }
      else { u = (p.x - bb.min.x) / size.x; v = (p.y - bb.min.y) / size.y; }
      uv[(i + k) * 2] = (col + Math.min(0.999, Math.max(0.001, u))) / 3;
      uv[(i + k) * 2 + 1] = (row + Math.min(0.999, Math.max(0.001, v))) / 2;
    });
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
};

// =====================================================================
// АВТО
// =====================================================================
const CAR_TYPES = {
  // профіль збоку: [x, y] від задньої нижньої точки; довжина ~4.4
  sedan: { len: 4.5, width: 1.86, wheel: 0.38, wx: 1.42, body: [[-2.25, .3], [2.2, .3], [2.3, .52], [2.18, .74], [1.25, .84], [.48, 1.32], [-.75, 1.36], [-1.7, .98], [-2.22, .9], [-2.3, .55]],
    glass: [[1.2, .86], [.5, 1.3], [-.72, 1.33], [-1.62, .99], [-.1, .9]] },
  suv: { len: 4.7, width: 2.0, wheel: 0.46, wx: 1.5, body: [[-2.3, .38], [2.3, .38], [2.38, .62], [2.32, 1.0], [1.55, 1.08], [1.3, 1.82], [-2.15, 1.86], [-2.32, 1.7], [-2.36, .6]],
    glass: [[1.5, 1.12], [1.28, 1.76], [-2.05, 1.79], [-2.2, 1.14], [0, 1.1]] },
  super: { len: 4.6, width: 1.98, wheel: 0.37, wx: 1.48, body: [[-2.3, .28], [2.25, .28], [2.35, .42], [2.1, .62], [1.0, .74], [.1, 1.1], [-.9, 1.12], [-1.9, .8], [-2.3, .72], [-2.36, .45]],
    glass: [[.98, .76], [.12, 1.06], [-.85, 1.08], [-1.75, .8], [-.4, .76]] },
};

const profileShape = (pts, offset = 0) => {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y + offset) : s.lineTo(x, y + offset)));
  s.closePath();
  return s;
};

const wheel = (r, type) => {
  const g = new THREE.Group();
  const tire = mesh(new THREE.CylinderGeometry(r, r, 0.3, 28), M.rubber(), { rx: Math.PI / 2 });
  const rim = mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.32, 24), M.chrome(), { rx: Math.PI / 2, cast: false });
  g.add(tire, rim);
  for (let i = 0; i < 5; i += 1) {
    const spoke = mesh(new THREE.BoxGeometry(r * 1.05, 0.07, 0.05), type === "super" ? M.std(0x1a1a1f, { metalness: 0.8, roughness: 0.3 }) : M.chrome(), { rz: (i / 5) * Math.PI, z: 0.17, cast: false });
    g.add(spoke);
  }
  const cap = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.34, 12), M.neon(0xe0182d, 1.2), { rx: Math.PI / 2, cast: false });
  g.add(cap);
  return g;
};

/** makeCar(type, color, { atlas }) → Group; userData.paintMeshes — меші для бруду (з атлас-UV при atlas=true) */
export const makeCar = (type = "sedan", color = 0xe0182d, { atlas = false } = {}) => {
  const T = CAR_TYPES[type] || CAR_TYPES.sedan;
  const car = new THREE.Group();
  const depth = T.width - 0.24;
  const extrude = { depth, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 3, curveSegments: 6 };
  let bodyGeo = new THREE.ExtrudeGeometry(profileShape(T.body), extrude);
  bodyGeo.translate(0, 0, -depth / 2);
  let glassGeo = new THREE.ExtrudeGeometry(profileShape(T.glass), { ...extrude, depth: depth + 0.05, bevelThickness: 0.12, bevelSize: 0.03 });
  glassGeo.translate(0, 0.012, -(depth + 0.05) / 2);
  if (atlas) { bodyGeo = boxAtlasUV(bodyGeo); glassGeo = boxAtlasUV(glassGeo); }
  const body = mesh(bodyGeo, M.paint(color));
  const glass = mesh(glassGeo, M.glass());
  car.add(body, glass);
  // фари / ліхтарі / решітка
  const front = T.body[2][0] + 0.06, rear = T.body[T.body.length - 1][0] - 0.06;
  const lampY = type === "suv" ? 0.86 : type === "super" ? 0.5 : 0.64;
  [-1, 1].forEach((side) => {
    car.add(mesh(new THREE.BoxGeometry(0.08, 0.12, 0.42), M.neon(0xfff4d6, 4), { x: front, y: lampY, z: side * (T.width / 2 - 0.32), cast: false }));
    car.add(mesh(new THREE.BoxGeometry(0.08, 0.1, 0.48), M.neon(0xff1a2a, 3), { x: rear, y: lampY + 0.04, z: side * (T.width / 2 - 0.3), cast: false }));
    car.add(mesh(new THREE.BoxGeometry(0.12, 0.08, 0.16), M.std(0x0d0d10), { x: 0.65, y: (type === "suv" ? 1.05 : 0.85), z: side * (T.width / 2 + 0.02), cast: false })); // дзеркала
  });
  car.add(mesh(new THREE.BoxGeometry(0.06, 0.18, T.width * 0.42), M.std(0x0a0a0d, { metalness: 0.6, roughness: 0.4 }), { x: front + 0.01, y: lampY - 0.12, cast: false }));
  if (type === "suv") { // запаска і багажник на даху
    car.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.22, 20), M.rubber(), { x: rear - 0.1, y: 1.05, rz: Math.PI / 2 }));
    [-0.62, 0.62].forEach((z) => car.add(mesh(new THREE.BoxGeometry(2.6, 0.06, 0.07), M.chrome(), { x: -0.4, y: 1.98, z }))); // рейлінги
  }
  if (type === "super") car.add(mesh(new THREE.BoxGeometry(0.3, 0.05, 1.7), M.std(0x0d0d10), { x: -2.1, y: 0.95 })); // спойлер
  // колеса
  [[T.wx, 1], [-T.wx + 0.02, 1], [T.wx, -1], [-T.wx + 0.02, -1]].forEach(([x, side]) => {
    const w = wheel(T.wheel, type);
    w.position.set(x, T.wheel, side * (T.width / 2 - 0.12));
    if (side < 0) w.rotation.y = Math.PI;
    car.add(w);
  });
  car.userData.paintMeshes = [body, glass];
  car.userData.length = T.len;
  return car;
};

// =====================================================================
// ПРИРОДА І МІСТО
// =====================================================================
export const makePalm = (height = 5) => {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.25, height * 0.4, 0.1), new THREE.Vector3(0.55, height * 0.8, 0.05), new THREE.Vector3(0.7, height, 0)]);
  g.add(mesh(new THREE.TubeGeometry(curve, 12, 0.14, 7), M.std(0x6b4a33, { roughness: 0.95 })));
  const top = curve.getPoint(1);
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0); leafShape.quadraticCurveTo(0.9, 0.35, 2.2, 0); leafShape.quadraticCurveTo(0.9, -0.35, 0, 0);
  const leafGeo = new THREE.ShapeGeometry(leafShape, 6);
  const pos = leafGeo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) { const x = pos.getX(i); pos.setZ(i, -0.18 * x * x); } // провисання
  leafGeo.computeVertexNormals();
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f7a3e, roughness: 0.85, side: THREE.DoubleSide });
  for (let i = 0; i < 8; i += 1) {
    const leaf = mesh(leafGeo, leafMat, { x: top.x, y: top.y, z: top.z });
    leaf.rotation.set(-Math.PI / 2 + 0.25, (i / 8) * Math.PI * 2, 0, "YXZ");
    g.add(leaf);
  }
  g.add(mesh(new THREE.SphereGeometry(0.22, 8, 6), M.std(0x4a3524), { x: top.x, y: top.y - 0.05, z: top.z }));
  return g;
};

export const makeTree = (scale = 1) => {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.1 * scale, 0.16 * scale, 1.2 * scale, 6), M.std(0x5a3d29), { y: 0.6 * scale }));
  const crown = new THREE.IcosahedronGeometry(1 * scale, 1);
  const leaves = M.std(0x245c33, { roughness: 0.9, flatShading: true });
  g.add(mesh(crown, leaves, { y: 1.8 * scale }));
  g.add(mesh(crown, leaves, { x: 0.45 * scale, y: 1.5 * scale, z: 0.2 * scale, s: 0.7 }));
  return g;
};

export const makeHedge = (w, d) => mesh(rbox(w, 0.7, d, 0.25, 3), M.std(0x1f4f2b, { roughness: 0.95 }), { y: 0.35 });

let poolTex = null;
const lightPoolTexture = () => {
  if (poolTex) return poolTex;
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,200,130,0.22)"); grad.addColorStop(1, "rgba(255,210,140,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  poolTex = new THREE.CanvasTexture(c);
  return poolTex;
};
export const makeLamp = () => {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.09, 4, 8), M.std(0x2a2c33, { metalness: 0.7, roughness: 0.4 }), { y: 2 }));
  g.add(mesh(new THREE.BoxGeometry(1.1, 0.06, 0.08), M.std(0x2a2c33, { metalness: 0.7 }), { x: 0.5, y: 3.98 }));
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.1, 0.25), M.neon(0xffd9a0, 3.5), { x: 0.95, y: 3.92, cast: false }));
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({ map: lightPoolTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(0.95, 0.04, 0);
  g.add(pool);
  return g;
};

// Асфальт із шумом
export const asphaltTexture = () => {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#1a1b20"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6000; i += 1) { const v = 20 + Math.random() * 22; g.fillStyle = `rgb(${v},${v},${v + 3})`; g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};

// =====================================================================
// ВІЛЛА-ШТАБ
// =====================================================================
export const makeMansion = (hq = 1, logoTexture = null) => {
  const g = new THREE.Group();
  const white = M.std(0xece8e1, { roughness: 0.55 });
  const dark = M.std(0x22232a, { roughness: 0.6, metalness: 0.2 });
  const wood = M.std(0x6e4b33, { roughness: 0.8 });
  const warm = windowsTexture("#2a1d12", "#ffd39a", 8, 2, 0.9);

  // ділянка
  g.add(mesh(new THREE.CylinderGeometry(13.2, 13.6, 0.5, 72), M.std(0x1b1c21, { roughness: 0.9 }), { y: 0.25, receive: true, cast: false }));
  g.add(mesh(new THREE.CylinderGeometry(12.6, 12.6, 0.06, 72), M.std(0x1e3a24, { roughness: 1 }), { y: 0.53, receive: true, cast: false }));
  g.add(mesh(new THREE.TorusGeometry(13.25, 0.07, 6, 120), M.neon(0xe0182d, 2), { y: 0.52, rx: Math.PI / 2, cast: false }));

  // плита-подіум
  g.add(mesh(rbox(15, 0.4, 10, 0.1), M.std(0xbfb9ae, { roughness: 0.7 }), { x: -0.5, y: 0.75, z: -1.2, receive: true }));

  // 1 поверх — скло
  const glass1 = litFacade(warm, 3, 1, 1.2);
  g.add(mesh(new THREE.BoxGeometry(11, 2.6, 6.6), [glass1, glass1, white, white, glass1, glass1], { x: -1.2, y: 2.25, z: -1.6, receive: true }));
  // колони
  [-6.4, -2.6, 1.2, 4.0].forEach((x) => g.add(mesh(new THREE.BoxGeometry(0.25, 2.6, 0.25), white, { x, y: 2.25, z: 1.85 })));
  // 2 поверх — консольний білий об'єм
  const floors = Math.min(3, 1 + Math.floor((hq + 1) / 4));
  const glass2 = litFacade(warm, 4, 1, 1);
  for (let f = 1; f <= floors; f += 1) {
    const w = 12.5 - f * 1.4, d = 5.6 - f * 0.4, y = 2.25 + f * 2.75;
    const vol = mesh(rbox(w, 2.5, d, 0.06), white, { x: 0.6 - f * 0.5, y, z: -1.2 + (f % 2 ? 0.9 : -0.3) });
    g.add(vol);
    g.add(mesh(new THREE.PlaneGeometry(w * 0.86, 1.5), glass2, { x: vol.position.x, y, z: vol.position.z + d / 2 + 0.01, cast: false }));
    g.add(mesh(new THREE.BoxGeometry(w + 0.5, 0.18, d + 0.5), dark, { x: vol.position.x, y: y + 1.32, z: vol.position.z }));
    // дерев'яні ламелі
    for (let i = 0; i < 6; i += 1) g.add(mesh(new THREE.BoxGeometry(0.08, 2.3, 0.12), wood, { x: vol.position.x - w / 2 + 0.4 + i * 0.22, y, z: vol.position.z + d / 2 + 0.07, cast: false }));
  }
  const roofY = 2.25 + floors * 2.75 + 1.4;
  // басейн
  g.add(mesh(new THREE.BoxGeometry(7.4, 0.25, 3.3), M.std(0xd8d2c8), { x: 2.6, y: 0.68, z: 5.4, receive: true }));
  const water = new THREE.MeshStandardMaterial({ color: 0x1aa6ff, emissive: 0x0c8ce0, emissiveIntensity: 1.3, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.92 });
  g.add(mesh(new THREE.BoxGeometry(6.8, 0.1, 2.8), water, { x: 2.6, y: 0.79, z: 5.4, cast: false }));
  const poolLight = new THREE.PointLight(0x3fb6ff, 14, 9, 1.8); poolLight.position.set(2.6, 1.4, 5.4); g.add(poolLight);
  // шезлонги
  [0.4, 1.6].forEach((x) => g.add(mesh(rbox(0.7, 0.18, 1.7, 0.06), M.std(0xf2efe9), { x: x - 1.6, y: 0.75, z: 5.4 })));
  // тераса
  g.add(mesh(new THREE.BoxGeometry(4, 0.12, 3), wood, { x: -4.8, y: 0.66, z: 5.2, receive: true }));
  // пальми, живопліт
  [[-10, 5, 5.4], [9.5, 6, 6], [-9.8, -6.5, 5.8], [9.6, -6.8, 5.2], [6.6, 7.8, 4.6], [-7.2, 8.3, 4.8]].forEach(([x, z, h]) => {
    const p = makePalm(h); p.position.set(x, 0.55, z); p.rotation.y = Math.random() * Math.PI * 2; g.add(p);
  });
  [[0, -9.4, 16, 0.8], [-11.4, -1, 0.8, 9], [11.4, -1, 0.8, 9]].forEach(([x, z, w, d]) => { const h = makeHedge(w, d); h.position.set(x, 0.55, z); g.add(h); });
  // під'їзд і авто
  g.add(mesh(new THREE.BoxGeometry(4, 0.05, 6), M.std(0x2a2b31, { roughness: 0.85 }), { x: -7.5, y: 0.56, z: 2.5, receive: true, cast: false }));
  const c1 = makeCar("suv", 0x0d0d10); c1.position.set(-7.5, 0.56, 1.3); c1.rotation.y = Math.PI / 2; c1.scale.setScalar(0.7); g.add(c1);
  if (hq >= 3) { const c2 = makeCar("super", 0xe0182d); c2.position.set(-7.5, 0.56, 4.6); c2.rotation.y = Math.PI / 2; c2.scale.setScalar(0.7); g.add(c2); }
  // золоті кільця за рівнем штабу
  for (let i = 0; i < hq - 1; i += 1) g.add(mesh(new THREE.TorusGeometry(10.4 + i * 0.32, 0.045, 6, 120), M.neon(0xf2c14e, 1.6), { y: 0.58, rx: Math.PI / 2, cast: false }));
  // логотип над дахом
  const ring = mesh(new THREE.TorusGeometry(3.6, 0.1, 10, 72), M.neon(0xff2a3d, 3.5), { y: roofY + 2.2, rx: Math.PI / 2, cast: false });
  g.add(ring);
  if (logoTexture) {
    const logo = new THREE.Sprite(new THREE.SpriteMaterial({ map: logoTexture, transparent: true, depthWrite: false }));
    logo.scale.set(5.8, 5.8, 1); logo.position.set(0, roofY + 4.6, 0);
    g.add(logo);
    g.userData.logo = logo;
  }
  g.userData.ring = ring;
  g.userData.top = roofY + 7.5;
  return g;
};

// =====================================================================
// БІЗНЕСИ — кожен свій, рівні добудовують деталі
// =====================================================================
export const tierOf = (level) => (level <= 0 ? 0 : level < 10 ? 1 : level < 25 ? 2 : level < 50 ? 3 : level < 100 ? 4 : 5);

const pad = (g, color, active) => {
  g.add(mesh(new THREE.CylinderGeometry(6.4, 6.7, 0.35, 56), M.std(0x17181d, { roughness: 0.85 }), { y: 0.17, receive: true, cast: false }));
  g.add(mesh(new THREE.CylinderGeometry(6.0, 6.0, 0.04, 56), M.std(0x23242b, { roughness: 0.6, metalness: 0.2 }), { y: 0.36, receive: true, cast: false }));
  g.add(mesh(new THREE.TorusGeometry(6.55, 0.06, 6, 72), M.neon(color, active ? 2 : 0.5), { y: 0.36, rx: Math.PI / 2, cast: false }));
};
const roofUnits = (g, w, d, y, n = 3) => {
  for (let i = 0; i < n; i += 1) g.add(mesh(rbox(0.8, 0.5, 0.8, 0.05), M.std(0x9a9da6, { metalness: 0.6, roughness: 0.4 }), { x: -w / 2 + 0.8 + i * ((w - 1.6) / Math.max(1, n - 1)), y: y + 0.25, z: -d / 4 }));
};
const goldTrim = (g, w, d, y) => g.add(mesh(new THREE.BoxGeometry(w + 0.12, 0.12, d + 0.12), M.neon(0xf2c14e, 1.8), { y, cast: false }));

const BUILDERS = {
  wash(g, b, t) {
    const blue = M.std(0x2f6bff, { roughness: 0.5 });
    const wall = M.std(0xe9edf2, { roughness: 0.6 });
    const len = t >= 3 ? 8 : 6.5;
    // бокс з наскрізним тунелем: дві стіни + дах
    [-1.6, 1.6].forEach((z) => g.add(mesh(rbox(len, 2.6, 0.4, 0.06), wall, { y: 1.65, z })));
    g.add(mesh(rbox(len + 0.4, 0.4, 3.8, 0.08), blue, { y: 3.15 }));
    // арки-ролики
    for (let i = 0; i < (t >= 2 ? 3 : 2); i += 1) {
      const x = -len / 2 + 1.4 + i * 2;
      g.add(mesh(new THREE.TorusGeometry(1.35, 0.12, 8, 24, Math.PI), M.neon(0x3fb6ff, 1.5), { x, y: 0.4, ry: Math.PI / 2, cast: false }));
      [-1.0, 1.0].forEach((z) => g.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 2.0, 14), M.std(i % 2 ? 0xe0182d : 0x2f6bff, { roughness: 0.95 }), { x, y: 1.4, z })));
    }
    const s = sign("WASH", "#3fb6ff", 2.6, 0.7); s.position.set(0, 3.7, 1.95); g.add(s);
    // авто в черзі
    const car = makeCar("sedan", 0xf2f2f2); car.scale.setScalar(0.55); car.position.set(-len / 2 - 1.6, 0.36, 0); g.add(car);
    if (t >= 2) { const c2 = makeCar("suv", 0x111114); c2.scale.setScalar(0.5); c2.position.set(len / 2 + 1.4, 0.36, 0.2); g.add(c2); }
    if (t >= 3) { g.add(mesh(rbox(2.4, 2.2, 2.4, 0.05), wall, { x: 0, y: 1.45, z: -3.6 })); const o = sign("CASH", "#22c55e", 1.6, 0.45); o.position.set(0, 2.2, -2.38); g.add(o); }
    if (t >= 4) { const p = mesh(new THREE.BoxGeometry(len + 2, 0.12, 2.2), M.std(0x1b1d24), { y: 3.6, z: 2.9 }); g.add(p); }
    if (t >= 5) goldTrim(g, len + 0.4, 3.8, 3.38);
    return t >= 3 ? 5 : 4.4;
  },
  garage(g, b, t) {
    const wall = M.std(0x3a3d46, { roughness: 0.7 });
    const orange = M.std(0xffb02e, { roughness: 0.5 });
    const bays = t >= 3 ? 3 : 2;
    const w = bays * 2.6 + 0.6;
    g.add(mesh(rbox(w, 3.2, 4.2, 0.06), wall, { y: 1.95, z: -0.4 }));
    g.add(mesh(new THREE.BoxGeometry(w + 0.3, 0.3, 4.6), orange, { y: 3.65, z: -0.4 }));
    for (let i = 0; i < bays; i += 1) {
      const x = -w / 2 + 1.6 + i * 2.6;
      // ворота з ламелями
      const door = new THREE.Group();
      for (let k = 0; k < 6; k += 1) door.add(mesh(new THREE.BoxGeometry(2.1, 0.36, 0.05), M.std(k % 2 ? 0xb9bcc4 : 0xa4a8b1, { metalness: 0.6, roughness: 0.4 }), { y: 0.55 + k * 0.38, cast: false }));
      door.position.set(x, 0, 1.72);
      g.add(door);
      g.add(mesh(new THREE.BoxGeometry(2.2, 0.08, 0.1), M.neon(0xffb02e, 2.5), { x, y: 2.95, z: 1.75, cast: false }));
    }
    const s = sign("CASTRO MOTORS", "#ffb02e", 4.2, 0.7); s.position.set(0, 4.25, 1.85); g.add(s);
    // шини
    for (let i = 0; i < 4; i += 1) g.add(mesh(new THREE.TorusGeometry(0.38, 0.16, 8, 16), M.rubber(), { x: w / 2 + 0.9, y: 0.55 + i * 0.3, z: 1.4, rx: Math.PI / 2 }));
    if (t >= 2) { // підйомник з авто зовні
      [-0.9, 0.9].forEach((z) => g.add(mesh(new THREE.BoxGeometry(0.2, 2.2, 0.2), M.std(0xe0182d, { metalness: 0.5 }), { x: -w / 2 - 1.4, y: 1.45, z: 2.4 + z })));
      const c = makeCar("super", 0xe0182d); c.scale.setScalar(0.5); c.position.set(-w / 2 - 1.4, 1.5, 2.4); g.add(c);
    }
    if (t >= 4) roofUnits(g, w, 4.2, 3.8, 4);
    if (t >= 5) goldTrim(g, w + 0.3, 4.6, 3.86);
    return 5.2;
  },
  club(g, b, t) {
    const black = M.std(0x0c0c10, { roughness: 0.35, metalness: 0.5 });
    const h = t >= 3 ? 6.2 : 4.6;
    g.add(mesh(rbox(7, h, 5, 0.12), black, { y: 0.35 + h / 2 }));
    // неонові смуги
    const purple = 0xc04bff, pink = 0xff3ea5;
    for (let i = 0; i < (t >= 2 ? 4 : 2); i += 1) g.add(mesh(new THREE.BoxGeometry(7.08, 0.08, 5.08), M.neon(i % 2 ? pink : purple, 3), { y: 1.2 + i * (h / 4.4), cast: false }));
    // неоновий контур по ребрах + вертикальні LED-смуги + засклений вхід
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(7.04, h, 5.04)), new THREE.LineBasicMaterial({ color: pink }));
    edges.position.y = 0.35 + h / 2; g.add(edges);
    for (let i = 0; i < 6; i += 1) g.add(mesh(new THREE.BoxGeometry(0.1, h * 0.7, 0.06), M.neon(i % 2 ? purple : pink, 2.6), { x: -3 + i * 1.2, y: 0.35 + h * 0.5, z: 2.55, cast: false }));
    const lobby = new THREE.MeshStandardMaterial({ color: 0x2a0a3a, emissive: 0x9a2cff, emissiveIntensity: 1.4, roughness: 0.2, metalness: 0.4 });
    g.add(mesh(new THREE.PlaneGeometry(2.2, 2.0), lobby, { y: 1.35, z: 2.56, cast: false }));
    const vip = sign("VIP", "#ff3ea5", 1.2, 0.5); vip.position.set(-2.4, 2.4, 2.57); g.add(vip);
    const s = sign("CASTRO LOUNGE", "#c04bff", 5, 0.9); s.position.set(0, h - 0.2, 2.58); g.add(s);
    // вхід з козирком і червоною доріжкою
    g.add(mesh(new THREE.BoxGeometry(2.6, 0.12, 1.8), M.std(0x1b1b22, { metalness: 0.6 }), { y: 2.6, z: 3.3 }));
    g.add(mesh(new THREE.BoxGeometry(1.4, 0.04, 2.6), M.std(0x8a0d1c, { roughness: 0.9 }), { y: 0.38, z: 3.6, cast: false }));
    [-0.9, 0.9].forEach((x) => g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), M.chrome(), { x, y: 0.78, z: 4.4 })));
    // прожектори в небо
    const beams = [];
    for (let i = 0; i < (t >= 2 ? 2 : 1) + (t >= 4 ? 2 : 0); i += 1) {
      const beam = new THREE.Mesh(new THREE.ConeGeometry(1.2, 22, 16, 1, true), new THREE.MeshBasicMaterial({ color: i % 2 ? pink : purple, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      beam.geometry.translate(0, -11, 0);
      const pivot = new THREE.Group(); pivot.position.set(i % 2 ? 2.6 : -2.6, 0.35 + h, i < 2 ? 1.6 : -1.6);
      beam.rotation.x = Math.PI; pivot.add(beam); g.add(pivot);
      beams.push(pivot);
    }
    g.userData.beams = beams;
    if (t >= 5) goldTrim(g, 7, 5, 0.35 + h);
    return 0.35 + h + 1;
  },
  dealer(g, b, t) {
    const frame = M.std(0xe7e9ee, { metalness: 0.4, roughness: 0.3 });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x9fd8c6, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.28, envMapIntensity: 1.5, depthWrite: false });
    const w = t >= 3 ? 9 : 7.6, h = t >= 4 ? 5 : 3.6;
    g.add(mesh(new THREE.BoxGeometry(w, 0.2, 4.6), M.std(0xf0f0f2, { roughness: 0.2, metalness: 0.3 }), { y: 0.46, receive: true }));
    g.add(mesh(new THREE.BoxGeometry(w, h, 4.6), glassMat, { y: 0.56 + h / 2, cast: false }));
    g.add(mesh(rbox(w + 0.4, 0.35, 5, 0.06), frame, { y: 0.56 + h + 0.15 }));
    for (let i = 0; i <= 4; i += 1) g.add(mesh(new THREE.BoxGeometry(0.12, h, 0.12), frame, { x: -w / 2 + (i * w) / 4, y: 0.56 + h / 2, z: 2.3 }));
    const inside = new THREE.PointLight(0xffffff, 18, 10, 1.6); inside.position.set(0, h - 0.3, 0); g.add(inside);
    // авто на вітрині
    const show = [["super", 0x22c55e], ["sedan", 0x15151a], ["suv", 0xf2f2f2]].slice(0, t >= 3 ? 3 : 2);
    show.forEach(([type, color], i) => { const c = makeCar(type, color); c.scale.setScalar(0.62); c.position.set(-w / 2 + 1.9 + i * 2.6, 0.56, 0.2); c.rotation.y = -0.5; g.add(c); });
    const s = sign("VINEWOOD CARS", "#22c55e", 4.4, 0.7); s.position.set(0, 0.56 + h + 0.75, 2.4); g.add(s);
    // прапорці
    for (let i = 0; i < (t >= 2 ? 3 : 0); i += 1) {
      g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.2, 8), M.chrome(), { x: w / 2 + 0.9, y: 2.4, z: 2 - i * 1.6 }));
      g.add(mesh(new THREE.PlaneGeometry(0.6, 1.4), M.std(i % 2 ? 0xe0182d : 0x22c55e, { side: THREE.DoubleSide }), { x: w / 2 + 1.2, y: 3.6, z: 2 - i * 1.6, cast: false }));
    }
    if (t >= 5) goldTrim(g, w + 0.4, 5, 0.56 + h + 0.34);
    return 0.56 + h + 1.6;
  },
  port(g, b, t) {
    const colors = [0xe0182d, 0x2f6bff, 0xffb02e, 0x22c55e, 0xe7e9ee, 0x8a4bff];
    g.add(mesh(new THREE.BoxGeometry(11, 0.1, 4), new THREE.MeshStandardMaterial({ color: 0x0b2a44, emissive: 0x062038, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.4 }), { y: 0.3, z: -3.2, cast: false }));
    const cont = (x, y, z, c) => {
      const box = mesh(new THREE.BoxGeometry(2.4, 1, 1, 1, 1, 1), M.std(c, { roughness: 0.6, metalness: 0.3 }), { x, y, z });
      g.add(box);
      for (let k = -2; k <= 2; k += 1) g.add(mesh(new THREE.BoxGeometry(0.04, 0.9, 1.02), M.std(0x000000, { transparent: true, opacity: 0.25 }), { x: x + k * 0.45, y, z, cast: false }));
    };
    const rows = t >= 3 ? 3 : 2, stack = Math.min(4, 1 + t);
    for (let r = 0; r < rows; r += 1) for (let i = 0; i < 3; i += 1) {
      const hgt = 1 + ((i + r) % stack);
      for (let k = 0; k < hgt; k += 1) cont(-3 + i * 2.6, 0.86 + k * 1.02, 1.6 - r * 1.15, colors[(i * 3 + r + k) % colors.length]);
    }
    // портальний кран
    const crane = M.std(0xffb02e, { metalness: 0.5, roughness: 0.4 });
    const ch = t >= 4 ? 7.5 : 6;
    [-4.6, 4.6].forEach((x) => [-1.6, 0.6].forEach((z) => g.add(mesh(new THREE.BoxGeometry(0.25, ch, 0.25), crane, { x, y: 0.35 + ch / 2, z }))));
    g.add(mesh(new THREE.BoxGeometry(10, 0.45, 0.45), crane, { y: 0.35 + ch, z: -0.5 }));
    g.add(mesh(new THREE.BoxGeometry(0.45, 0.45, 5.5), crane, { x: 1.5, y: 0.35 + ch + 0.2, z: -2 }));
    g.add(mesh(new THREE.BoxGeometry(0.06, 2.4, 0.06), M.std(0x222222), { x: 1.5, y: 0.35 + ch - 1.2, z: -3.6, cast: false }));
    g.add(mesh(new THREE.SphereGeometry(0.16, 8, 8), M.neon(0xff2a3d, 4), { x: 1.5, y: 0.35 + ch + 0.6, z: -4.6, cast: false }));
    if (t >= 5) goldTrim(g, 10, 0.45, 0.35 + ch + 0.25);
    return 0.35 + ch + 1.6;
  },
  hangar(g, b, t) {
    const metal = M.std(0x8d929c, { metalness: 0.75, roughness: 0.35 });
    const arch = new THREE.CylinderGeometry(3, 3, 6.4, 28, 1, true, 0, Math.PI);
    g.add(mesh(arch, new THREE.MeshStandardMaterial({ color: 0x8d929c, metalness: 0.75, roughness: 0.35, side: THREE.DoubleSide }), { y: 0.35, z: -1.4, rz: Math.PI / 2, ry: Math.PI / 2 }));
    g.add(mesh(new THREE.CircleGeometry(3, 28, 0, Math.PI), M.std(0x2a2c33, { side: THREE.DoubleSide }), { y: 0.35, z: -4.6, cast: false }));
    const s = sign("CASTRO AIR", "#f2c14e", 3.4, 0.6); s.position.set(0, 2.6, 1.85); g.add(s);
    // гелімайданчик
    g.add(mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.1, 40), M.std(0x23252c), { x: 0, y: 0.42, z: 3.6, cast: false, receive: true }));
    g.add(mesh(new THREE.TorusGeometry(2.1, 0.05, 6, 48), M.neon(0xf2c14e, 2.5), { y: 0.48, z: 3.6, rx: Math.PI / 2, cast: false }));
    const H = sign("H", "#f2c14e", 1.4, 1.4); H.rotation.x = -Math.PI / 2; H.position.set(0, 0.49, 3.6); g.add(H);
    // гелікоптер
    const heli = new THREE.Group();
    heli.add(mesh(new THREE.SphereGeometry(0.85, 18, 14), M.paint(0x111116), { s: [1.5, 0.8, 0.8], y: 0.95 }));
    heli.add(mesh(new THREE.SphereGeometry(0.6, 14, 10), M.glass(), { x: 0.75, y: 1.0, s: [1, 0.75, 0.8] }));
    heli.add(mesh(new THREE.CylinderGeometry(0.12, 0.05, 2.3, 8), M.paint(0x111116), { x: -1.9, y: 1.05, rz: Math.PI / 2 }));
    heli.add(mesh(new THREE.BoxGeometry(0.1, 0.5, 0.05), M.paint(0xe0182d), { x: -3, y: 1.25 }));
    [-0.5, 0.5].forEach((z) => heli.add(mesh(new THREE.BoxGeometry(2, 0.06, 0.08), M.chrome(), { y: 0.2, z })));
    const rotor = new THREE.Group(); rotor.position.y = 1.75;
    for (let i = 0; i < 4; i += 1) rotor.add(mesh(new THREE.BoxGeometry(4.2, 0.03, 0.18), M.std(0x1a1a1f), { ry: (i / 4) * Math.PI, cast: false }));
    heli.add(rotor);
    heli.position.set(0, 0.47, 3.6); heli.rotation.y = -0.6;
    g.add(heli);
    g.userData.rotor = rotor;
    if (t >= 3) roofUnits(g, 5, 2, 3.2, 2);
    if (t >= 5) goldTrim(g, 6.4, 0.2, 3.4);
    return 5;
  },
};

/** Будівля бізнесу. level 0 → голограма. Повертає висоту (для підпису). */
export const buildBusiness = (group, b, level) => {
  group.clear();
  const t = tierOf(level);
  pad(group, new THREE.Color(b.color), t > 0);
  if (t === 0) {
    const box = new THREE.BoxGeometry(5.2, 4.4, 4.2);
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: b.color, transparent: true, opacity: 0.7 }));
    lines.position.y = 2.6;
    const holo = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: b.color, transparent: true, opacity: 0.07, depthWrite: false }));
    holo.position.y = 2.6;
    group.add(lines, holo);
    group.userData.holo = [lines, holo];
    return 5.6;
  }
  group.userData.holo = null;
  const top = (BUILDERS[b.id] || BUILDERS.wash)(group, b, t);
  return top;
};

// Нічне оточення для відблисків: темне небо + кілька кольорових «вивісок»
export const nightEnvironment = (renderer) => {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x05060a);
  const panel = (color, intensity, w, h, x, y, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
  };
  panel(0xffd7a8, 2.2, 8, 3, 0, 14, 0);      // м'яке «місто» згори
  panel(0xff2a3d, 3.0, 6, 1.4, 12, 3, -6);   // червоний неон
  panel(0x3fb6ff, 3.0, 6, 1.4, -12, 3, 5);   // синій неон
  panel(0xffffff, 1.4, 14, 1, 0, 4, 14);     // відблиск-смуга
  panel(0xc04bff, 2.0, 4, 1, -6, 2, -13);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.02).texture;
  pm.dispose();
  return tex;
};

