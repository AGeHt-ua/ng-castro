// Бій «Рейд»: вигляд від третьої особи. Рухаєшся вліво-вправо, стріляєш сам.
// Праворуч коробки зі зброєю, ліворуч — з бійцями. 3 хвилі + бос.
// playRaid({ mode: "defend"|"attack", family, arsenal, practice, onStart }) → Promise<{ cancelled, won, boss, kills, wave }>
import * as THREE from "three";
import { makeCar, makeLamp, makePalm, makeMansion, asphaltTexture, nightEnvironment, signTexture } from "/cabinet/game/models.js?v=20261117d";

const WEAPONS = [
  { name: "Пістолет", icon: "🔫", rate: 2.8, dmg: 1, pellets: 1, spread: 0 },
  { name: "Автомат", icon: "🔫", rate: 7, dmg: 1, pellets: 1, spread: 0.02 },
  { name: "Дробовик", icon: "💥", rate: 1.9, dmg: 1.3, pellets: 6, spread: 0.2 },
  { name: "Штурмова гвинтівка", icon: "🎯", rate: 6.5, dmg: 2.2, pellets: 1, spread: 0.015 },
  { name: "Кулемет", icon: "🔥", rate: 13, dmg: 2, pellets: 1, spread: 0.04 },
];
const ENEMY = {
  normal: { hp: 3, speed: 3.9, dmg: 6, scale: 1 },
  fast: { hp: 2, speed: 5.8, dmg: 5, scale: 0.92 },
  armored: { hp: 9, speed: 2.8, dmg: 11, scale: 1.12 },
};
const MIX = { // імовірності типів у хвилях за стилем сім'ї
  swarm: [[0.6, 0.4, 0], [0.45, 0.5, 0.05], [0.35, 0.55, 0.1]],
  armored: [[0.75, 0.05, 0.2], [0.6, 0.1, 0.3], [0.45, 0.15, 0.4]],
  vehicle: [[0.7, 0.2, 0.1], [0.6, 0.2, 0.2], [0.5, 0.25, 0.25]],
};
const WAVES = [{ count: 14, time: 20 }, { count: 24, time: 24 }, { count: 34, time: 26 }];
const ROAD_HALF = 5.4, LINE_Z = 1.2, SPAWN_Z = -58;
const SQUAD_SLOTS = [[-0.95, 0.7], [0.95, 0.7], [-1.9, 1.3], [1.9, 1.3], [0, 1.5], [-2.8, 1.9], [2.8, 1.9]];

const el = (html) => { const d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; };
const rand = (a, b) => a + Math.random() * (b - a);

const person = (cloth, { armored = false, gun = true, scale = 1 } = {}) => {
  const g = new THREE.Group();
  const clothMat = new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.7, emissive: 0x000000 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x16161b, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: [0xf1c7a5, 0xd9a07a, 0xa86b45][Math.floor(Math.random() * 3)], roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.46, 4, 10), clothMat); body.position.y = 0.86; body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), skin); head.position.y = 1.32; head.castShadow = true;
  g.add(body, head);
  if (armored) {
    const steel = new THREE.MeshStandardMaterial({ color: 0x2b2f38, metalness: 0.6, roughness: 0.4 });
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.34), steel); vest.position.set(0, 0.92, 0);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), steel); helmet.position.set(0, 1.36, 0);
    g.add(vest, helmet);
  }
  const legs = [-0.09, 0.09].map((x) => {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.52, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.5, 0.12), dark); leg.position.y = -0.25; pivot.add(leg); g.add(pivot); return pivot;
  });
  if (gun) {
    const gunMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.5), new THREE.MeshStandardMaterial({ color: 0x111114, metalness: 0.7, roughness: 0.3 }));
    gunMesh.position.set(0.18, 0.95, -0.28); g.add(gunMesh);
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
    flash.position.set(0.18, 0.95, -0.58); flash.visible = false; g.add(flash);
    g.userData.flash = flash;
  }
  g.scale.setScalar(scale);
  g.userData.legs = legs;
  g.userData.mat = clothMat;
  g.userData.phase = Math.random() * 6;
  return g;
};

const numberSprite = () => {
  const c = document.createElement("canvas"); c.width = 128; c.height = 64;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(1.6, 0.8, 1);
  sprite.userData.draw = (text, color) => {
    const g = c.getContext("2d"); g.clearRect(0, 0, 128, 64);
    g.font = "400 46px Anton, Impact, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.lineWidth = 8; g.strokeStyle = "#000"; g.strokeText(text, 64, 34); g.fillStyle = color; g.fillText(text, 64, 34);
    tex.needsUpdate = true;
  };
  return sprite;
};

export function playRaid({ mode = "defend", family, arsenal = {}, practice = false, onStart } = {}) {
  return new Promise((resolve) => {
    const fam = family || { name: "Medellin", color: "#ffb02e", style: "swarm" };
    const famColor = new THREE.Color(fam.color);
    const attack = mode === "attack";
    const hpLabel = attack ? "Загін" : "Ворота";
    const maxHp = 100 + (attack ? 0 : (arsenal.gate || 0) * 20) + (attack ? (arsenal.gate || 0) * 10 : 0);

    const root = el(`<div class="mg rd">
      <canvas class="mg__canvas rd__canvas"></canvas>
      <header class="rd__hud">
        <div class="rd__fam" style="--fc:${fam.color}"><small>${practice ? "Тренування" : attack ? "Напад на сім'ю" : "Рейд сім'ї"}</small><b>${fam.name}</b></div>
        <div class="rd__hp"><span>${hpLabel}</span><i><span data-hp></span></i><b data-hp-text>${maxHp}</b></div>
        <div class="rd__wave" data-wave>Хвиля 1/3</div>
        <button class="mg__x" type="button" data-cancel aria-label="Вийти">✕</button>
      </header>
      <div class="rd__boss" data-boss hidden><span data-boss-name>Бос</span><i><span data-boss-hp></span></i></div>
      <div class="rd__loadout"><span data-weapon>🔫 Пістолет</span><span data-squad>👥 1</span><span data-kills>☠ 0</span></div>
      <div class="rd__banner" data-banner></div>
      <div class="rd__hint">Тягни пальцем або ← → / A D. Праворуч — зброя, ліворуч — бійці.</div>
      <div class="mg__card" data-intro>
        <span class="mg__card-icon">${attack ? "⚔️" : "🛡️"}</span>
        <small style="color:${fam.color}">${practice ? "Тренування • без нагороди" : attack ? "Штурм особняка" : "Напад на особняк CASTRO"}</small>
        <h2>${attack ? `Атакуй ${fam.name}` : `Відбий ${fam.name}`}</h2>
        <ol>
          <li><b>← →</b> — рухайся по дорозі, стріляєш сам</li>
          <li><b>🟨 Праворуч</b> — коробки зі зброєю: розбий, щоб стріляти сильніше</li>
          <li><b>🟦 Ліворуч</b> — коробки з бійцями: +1 до загону</li>
          <li><b>☠ 3 хвилі + бос</b> — ${attack ? "не дай знищити загін" : "не пусти ворогів до воріт"}</li>
        </ol>
        <button type="button" class="mg__go" data-go>Почати</button>
      </div>
      <div class="mg__card" data-result hidden>
        <span class="mg__card-icon" data-res-icon>🏆</span>
        <small data-res-kicker>Результат</small>
        <h2 data-res-title>Перемога</h2>
        <p data-res-text></p>
        <button type="button" class="mg__go" data-res-ok>Готово</button>
      </div>
    </div>`);
    document.body.appendChild(root);
    const q = (s) => root.querySelector(s);

    // ---------- Сцена ----------
    const canvas = q(".rd__canvas");
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    const LOW = innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4;
    renderer.setPixelRatio(Math.min(devicePixelRatio, LOW ? 1.25 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !LOW;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07070b);
    scene.fog = new THREE.Fog(0x07070b, 30, attack ? 135 : 100);
    scene.environment = nightEnvironment(renderer);
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
    scene.add(new THREE.HemisphereLight(0x8fa2ff, 0x140808, 0.55));
    const moon = new THREE.DirectionalLight(0xc9d6ff, 1.1);
    moon.position.set(-10, 25, 10); moon.castShadow = !LOW; moon.shadow.mapSize.set(1024, 1024);
    Object.assign(moon.shadow.camera, { left: -15, right: 15, top: 20, bottom: -40, near: 1, far: 80 });
    scene.add(moon);

    const asph = asphaltTexture(); asph.repeat.set(3, 26);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2 + 1, 110), new THREE.MeshStandardMaterial({ map: asph, roughness: 0.9 }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -45); road.receiveShadow = true; scene.add(road);
    [-1, 1].forEach((s) => {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(4, 110), new THREE.MeshStandardMaterial({ color: 0x24262c, roughness: 0.9 }));
      walk.rotation.x = -Math.PI / 2; walk.position.set(s * (ROAD_HALF + 2.5), 0.02, -45); walk.receiveShadow = true; scene.add(walk);
      for (let z = 4; z > -95; z -= 12) {
        const lamp = makeLamp(); lamp.position.set(s * (ROAD_HALF + 1.2), 0, z); lamp.rotation.y = s > 0 ? Math.PI : 0; scene.add(lamp);
        if (z % 24 === 4) { const palm = makePalm(5); palm.position.set(s * (ROAD_HALF + 3.6), 0, z - 6); scene.add(palm); }
      }
    });
    for (let z = 0; z > -95; z -= 4) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 1.8), new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffd27a, emissiveIntensity: 0.3 }));
      dash.rotation.x = -Math.PI / 2; dash.position.set(0, 0.01, z); scene.add(dash);
    }
    // лінія оборони
    const line = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2 + 1, 0.25), new THREE.MeshStandardMaterial({ color: 0xe0182d, emissive: 0xe0182d, emissiveIntensity: 2 }));
    line.rotation.x = -Math.PI / 2; line.position.set(0, 0.02, LINE_Z + 0.4); scene.add(line);
    // в кінці дороги — особняк ворожої сім'ї (напад) або їхні машини (захист)
    if (attack) {
      const villa = makeMansion(4, null); villa.position.set(0, 0, -98); villa.scale.setScalar(1.1); scene.add(villa);
      villa.traverse((o) => { if (o.material?.emissive && o.material.color?.getHex?.() === 0xff2a3d) { o.material = o.material.clone(); o.material.color.copy(famColor); o.material.emissive.copy(famColor); } });
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.2), new THREE.MeshStandardMaterial({ map: signTexture(fam.name.toUpperCase(), fam.color, 1024, 160), emissive: 0xffffff, emissiveMap: signTexture(fam.name.toUpperCase(), fam.color, 1024, 160), emissiveIntensity: 1.4 }));
      banner.position.set(0, 14, -88); scene.add(banner);
    } else {
      for (let i = 0; i < 3; i += 1) { const c = makeCar(["suv", "sedan", "super"][i], famColor.getHex()); c.position.set(-4 + i * 4, 0, -92); c.rotation.y = Math.PI / 2; scene.add(c); }
      // ворота особняка — за спиною камери
    }
    const familyLight = new THREE.PointLight(famColor, 40, 50, 1.4); familyLight.position.set(0, 6, -70); scene.add(familyLight);

    // ---------- Герой і загін ----------
    const heroColor = 0xe0182d;
    const hero = person(heroColor); scene.add(hero);
    hero.position.set(0, 0, 2.2);
    const squad = [];
    let weaponLevel = Math.min(4, arsenal.weapon || 0);
    const addSoldier = () => {
      if (squad.length >= SQUAD_SLOTS.length) return false;
      const s = person(0x1b1b22); s.position.copy(hero.position).add(new THREE.Vector3(0, 0, 3)); scene.add(s); squad.push(s); return true;
    };
    for (let i = 0; i < (arsenal.squad || 0); i += 1) addSoldier();

    // ---------- Пули (пул) ----------
    const BULLETS = 260;
    const bulletGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6); bulletGeo.rotateX(Math.PI / 2);
    const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const bullets = Array.from({ length: BULLETS }, () => { const m = new THREE.Mesh(bulletGeo, bulletMat); m.visible = false; scene.add(m); return { m, vx: 0, vz: 0, dmg: 1, alive: false }; });
    let bNext = 0;
    const fire = (from, w, rateMult) => {
      for (let p = 0; p < w.pellets; p += 1) {
        const b = bullets[bNext]; bNext = (bNext + 1) % BULLETS;
        const ang = (w.pellets > 1 ? (p / (w.pellets - 1) - 0.5) * w.spread * 2 : (Math.random() - 0.5) * w.spread * 2);
        b.m.position.set(from.position.x + 0.18 * from.scale.x, 0.95 * from.scale.x, from.position.z - 0.6);
        b.vx = Math.sin(ang) * 46; b.vz = -Math.cos(ang) * 46; b.dmg = w.dmg * (rateMult < 1 ? 0.8 : 1); b.alive = true; b.m.visible = true;
        b.m.rotation.y = -ang;
      }
      if (from.userData.flash) { from.userData.flash.visible = true; from.userData.flashT = 0.05; }
    };

    // ---------- Вороги, коробки, бос ----------
    const enemies = [];
    const dying = [];
    const boxes = [];
    const pieces = [];
    const spawnEnemy = (type, x = rand(-ROAD_HALF + 0.5, ROAD_HALF - 0.5), z = SPAWN_Z - rand(0, 8)) => {
      const cfg = ENEMY[type];
      const m = person(famColor.getHex(), { armored: type === "armored", scale: cfg.scale });
      m.userData.glow = famColor.clone().multiplyScalar(0.35);
      m.userData.mat.emissive.copy(m.userData.glow);
      m.position.set(x, 0, z); m.rotation.y = Math.PI; scene.add(m);
      enemies.push({ m, type, hp: cfg.hp, speed: cfg.speed * rand(0.9, 1.1), dmg: cfg.dmg, wobble: rand(0, 6), flash: 0 });
    };
    const spawnBox = (side) => {
      const isWeapon = side > 0;
      if (isWeapon && weaponLevel >= 4) return;
      if (!isWeapon && squad.length >= SQUAD_SLOTS.length) return;
      const g = new THREE.Group();
      const color = isWeapon ? 0xf2c14e : 0x3fb6ff;
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 1.4), new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.8 }));
      crate.position.y = 0.7; crate.castShadow = true; g.add(crate);
      [-0.71, 0.71].forEach((z) => { const band = new THREE.Mesh(new THREE.BoxGeometry(1.84, 1.44, 0.06), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9 })); band.position.set(0, 0.7, z); band.scale.set(1, 1, 1); g.add(band); });
      const label = numberSprite(); label.position.y = 2.2; g.add(label);
      const icon = numberSprite(); icon.position.set(0, 0.75, 0.74); icon.scale.set(1.3, 0.65, 1); icon.userData.draw(isWeapon ? "🔫" : "+1", isWeapon ? "#f2c14e" : "#3fb6ff"); icon.material.depthTest = true; g.add(icon);
      const hp = isWeapon ? 14 + weaponLevel * 12 : 10 + squad.length * 7;
      g.position.set(side * 3.7, 0, SPAWN_Z);
      scene.add(g);
      const box = { g, side, isWeapon, hp, max: hp, label, color };
      label.userData.draw(String(hp), isWeapon ? "#f2c14e" : "#3fb6ff");
      boxes.push(box);
    };
    let boss = null;
    const spawnBoss = () => {
      const vehicle = fam.style === "vehicle";
      let m;
      if (vehicle) { m = makeCar("suv", 0x0d0d10); m.scale.setScalar(1.25); m.rotation.y = Math.PI / 2; }
      else { m = person(famColor.getHex(), { armored: true, scale: 2.3 }); m.rotation.y = Math.PI; }
      m.position.set(0, 0, SPAWN_Z);
      scene.add(m);
      const hp = vehicle ? 340 : 280;
      boss = { m, hp, max: hp, speed: vehicle ? 2.1 : 1.5, vehicle, spawnT: 3, x: 0 };
      q("[data-boss]").hidden = false;
      q("[data-boss-name]").textContent = vehicle ? `Броньований позашляховик ${fam.name}` : `Бос сім'ї ${fam.name}`;
      banner(vehicle ? "🚙 БОС: таран!" : "💀 БОС СІМ'Ї");
    };

    // ---------- Стан ----------
    let running = false, finished = false;
    let hp = maxHp, kills = 0;
    let waveIndex = 0, waveSpawned = 0, waveTimer = 0, gap = 0.4;
    let bossDone = false, bossKilled = false;
    let boxTimer = 1.2, boxSide = 1;
    let targetX = 0, shake = 0;
    const fireTimers = new Map();

    const banner = (text) => { const b = q("[data-banner]"); b.textContent = text; b.classList.remove("is-on"); void b.offsetWidth; b.classList.add("is-on"); };
    const updateHud = () => {
      q("[data-hp]").style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
      q("[data-hp-text]").textContent = Math.max(0, Math.round(hp));
      q("[data-weapon]").textContent = `${WEAPONS[weaponLevel].icon} ${WEAPONS[weaponLevel].name}`;
      q("[data-squad]").textContent = `👥 ${squad.length + 1}`;
      q("[data-kills]").textContent = `☠ ${kills}`;
      q("[data-wave]").textContent = waveIndex < WAVES.length ? `Хвиля ${waveIndex + 1}/${WAVES.length}` : "Бос";
      if (boss) q("[data-boss-hp]").style.width = `${Math.max(0, (boss.hp / boss.max) * 100)}%`;
    };

    const burstPieces = (pos, color, n = 14) => {
      for (let i = 0; i < n; i += 1) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4 }));
        p.position.copy(pos).add(new THREE.Vector3(rand(-0.5, 0.5), rand(0.4, 1.2), rand(-0.5, 0.5)));
        scene.add(p);
        pieces.push({ p, v: new THREE.Vector3(rand(-5, 5), rand(4, 9), rand(-4, 4)), life: 1 });
      }
    };

    const damageLine = (amount) => {
      shake = 0.35;
      if (squad.length) { const s = squad.pop(); burstPieces(s.position, 0x1b1b22, 8); scene.remove(s); }
      hp -= amount;
      root.classList.remove("is-hit"); void root.offsetWidth; root.classList.add("is-hit");
      if (hp <= 0) end(false);
    };

    const end = (won) => {
      if (finished) return;
      finished = true; running = false;
      const ok = won;
      q("[data-res-icon]").textContent = ok ? "🏆" : "💀";
      q("[data-res-kicker]").textContent = ok ? (bossKilled ? "Бос знищений" : "Відбились") : attack ? "Загін розбитий" : "Ворота впали";
      q("[data-res-title]").textContent = ok ? "Перемога" : "Поразка";
      q("[data-res-text]").textContent = practice
        ? `Тренування: ☠ ${kills}. ${ok ? "Так тримати!" : "Спробуй балансувати між зброєю і бійцями."}`
        : ok
          ? `${attack ? `Особняк ${fam.name} взято` : `Сім'я ${fam.name} відступила`}. ☠ ${kills}${bossKilled ? " • бос знищений (+50% нагороди)" : ""}.`
          : attack ? `Цього разу ${fam.name} сильніші. ☠ ${kills}. Новий напад — через 10 хв.` : `${fam.name} пограбували особняк: дохід −50% на годину. ☠ ${kills}.`;
      q("[data-result]").hidden = false;
      if (ok) burstPieces(hero.position.clone().add(new THREE.Vector3(0, 1, -2)), 0xf2c14e, 30);
      q("[data-res-ok]").onclick = () => { cleanup(); resolve({ cancelled: false, won: ok, boss: bossKilled, kills, wave: waveIndex }); };
    };

    // ---------- Керування ----------
    let drag = null;
    canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, t: targetX }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", (e) => { if (drag) targetX = Math.max(-ROAD_HALF + 0.6, Math.min(ROAD_HALF - 0.6, drag.t + ((e.clientX - drag.x) / canvas.clientWidth) * 16)); });
    const stopDrag = () => { drag = null; };
    canvas.addEventListener("pointerup", stopDrag); canvas.addEventListener("pointercancel", stopDrag);
    const keys = new Set();
    const onKey = (e) => { if (["ArrowLeft", "ArrowRight", "a", "d", "A", "D", "ф", "в"].includes(e.key)) { e.type === "keydown" ? keys.add(e.key) : keys.delete(e.key); e.preventDefault(); } };
    addEventListener("keydown", onKey); addEventListener("keyup", onKey);

    q("[data-cancel]").addEventListener("click", () => { if (!finished) { finished = true; cleanup(); resolve({ cancelled: true }); } });
    q("[data-go]").addEventListener("click", async () => {
      q("[data-go]").disabled = true;
      if (onStart) { const ok = await onStart().catch(() => false); if (!ok) { finished = true; cleanup(); resolve({ cancelled: true }); return; } }
      q("[data-intro]").hidden = true;
      running = true;
      banner(`Хвиля 1 • ${fam.name}`);
    });

    const resize = () => {
      const w = innerWidth, h = innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w < 700 ? 68 : 55;
      camera.updateProjectionMatrix();
    };
    addEventListener("resize", resize);
    resize();

    // ---------- Кадр ----------
    const clock = new THREE.Clock();
    let raf = 0;
    const walk = (m, t, speedFactor = 1) => {
      const sw = Math.sin(t * 10 * speedFactor + m.userData.phase) * 0.7;
      if (m.userData.legs) { m.userData.legs[0].rotation.x = sw; m.userData.legs[1].rotation.x = -sw; }
    };
    const loop = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      // рух героя
      if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A") || keys.has("ф")) targetX = Math.max(-ROAD_HALF + 0.6, targetX - 9 * dt);
      if (keys.has("ArrowRight") || keys.has("d") || keys.has("D") || keys.has("в")) targetX = Math.min(ROAD_HALF - 0.6, targetX + 9 * dt);
      const prevX = hero.position.x;
      hero.position.x += (targetX - hero.position.x) * Math.min(1, dt * 12);
      hero.rotation.z = (prevX - hero.position.x) * 0.6;
      walk(hero, t, Math.abs(prevX - hero.position.x) > 0.01 ? 1 : 0.2);
      squad.forEach((s, i) => {
        const [ox, oz] = SQUAD_SLOTS[i];
        const tx = Math.max(-ROAD_HALF + 0.4, Math.min(ROAD_HALF - 0.4, hero.position.x + ox));
        s.position.x += (tx - s.position.x) * Math.min(1, dt * 7);
        s.position.z += (hero.position.z + oz - s.position.z) * Math.min(1, dt * 5);
        walk(s, t, 0.3);
      });
      // камера
      camera.position.set(hero.position.x * 0.55 + (Math.random() - 0.5) * shake, 5.4 + (Math.random() - 0.5) * shake, 10.5);
      camera.lookAt(hero.position.x * 0.55, 0.8, -12);
      shake = Math.max(0, shake - dt);

      if (running) {
        // стрільба
        const w = WEAPONS[weaponLevel];
        [hero, ...squad].forEach((shooter, i) => {
          const rate = i === 0 ? w.rate : w.rate * 0.6;
          const timer = (fireTimers.get(shooter) || rand(0, 1 / rate)) - dt;
          if (timer <= 0) { fire(shooter, w, i === 0 ? 1 : 0.6); fireTimers.set(shooter, 1 / rate); } else fireTimers.set(shooter, timer);
        });
        // хвилі
        if (waveIndex < WAVES.length) {
          if (gap > 0) gap -= dt;
          else {
            const wv = WAVES[waveIndex];
            waveTimer += dt;
            const shouldHave = Math.min(wv.count, Math.floor((waveTimer / wv.time) * wv.count));
            while (waveSpawned < shouldHave) {
              const [pn, pf] = MIX[fam.style] ? MIX[fam.style][waveIndex] : MIX.swarm[waveIndex];
              const r = Math.random();
              spawnEnemy(r < pn ? "normal" : r < pn + pf ? "fast" : "armored");
              waveSpawned += 1;
            }
            if (waveSpawned >= wv.count && enemies.length === 0) {
              waveIndex += 1; waveSpawned = 0; waveTimer = 0; gap = 2.2;
              if (waveIndex < WAVES.length) banner(`Хвиля ${waveIndex + 1}`);
            }
          }
        } else if (!boss && !bossDone) { if (gap > 0) gap -= dt; else spawnBoss(); }
        // коробки
        boxTimer -= dt;
        if (boxTimer <= 0 && !boss) { spawnBox(boxSide); boxSide = -boxSide; boxTimer = rand(3.6, 5); }
        // вороги
        for (let i = enemies.length - 1; i >= 0; i -= 1) {
          const e = enemies[i];
          e.m.position.z += e.speed * dt;
          e.m.position.x += Math.sin(t * 2 + e.wobble) * 0.6 * dt;
          walk(e.m, t, e.speed / 3);
          if (e.flash > 0) { e.flash -= dt; if (e.flash > 0) e.m.userData.mat.emissive.setScalar(0.9); else e.m.userData.mat.emissive.copy(e.m.userData.glow); }
          // біжать на героя: ближче до лінії — сильніше звертають до нього
          const pull = Math.max(0, 1 - Math.abs(e.m.position.z) / 50) * 1.6;
          e.m.position.x += (hero.position.x - e.m.position.x) * pull * dt;
          if (e.m.position.z >= LINE_Z) { scene.remove(e.m); enemies.splice(i, 1); damageLine(e.dmg); }
        }
        // бос
        if (boss) {
          boss.m.position.z += boss.speed * dt;
          boss.x = Math.sin(t * 0.7) * 2.2;
          boss.m.position.x += (boss.x - boss.m.position.x) * dt;
          if (!boss.vehicle) {
            walk(boss.m, t, 0.4);
            boss.spawnT -= dt;
            if (boss.spawnT <= 0) { for (let k = 0; k < 3; k += 1) spawnEnemy("fast", boss.m.position.x + rand(-2, 2), boss.m.position.z + 1); boss.spawnT = 3.2; }
          }
          if (boss.m.position.z >= LINE_Z - (boss.vehicle ? 1.5 : 0.5)) {
            burstPieces(boss.m.position, 0x333333, 26);
            scene.remove(boss.m); boss = null; bossDone = true; q("[data-boss]").hidden = true;
            damageLine(45);
            if (hp > 0 && !finished) end(true);
          }
        }
        // пули і влучання
        for (const b of bullets) {
          if (!b.alive) continue;
          b.m.position.x += b.vx * dt; b.m.position.z += b.vz * dt;
          if (b.m.position.z < SPAWN_Z - 15 || Math.abs(b.m.position.x) > ROAD_HALF + 3) { b.alive = false; b.m.visible = false; continue; }
          const bx = b.m.position.x, bz = b.m.position.z;
          let hit = false;
          for (let i = enemies.length - 1; i >= 0 && !hit; i -= 1) {
            const e = enemies[i];
            if (Math.abs(e.m.position.z - bz) < 0.6 && Math.abs(e.m.position.x - bx) < 0.45 * ENEMY[e.type].scale + 0.1) {
              hit = true; e.hp -= b.dmg; e.flash = 0.06;
              if (e.hp <= 0) { kills += 1; enemies.splice(i, 1); dying.push({ m: e.m, t: 0.6 }); }
            }
          }
          if (!hit && boss && Math.abs(boss.m.position.z - bz) < (boss.vehicle ? 2.6 : 0.9) && Math.abs(boss.m.position.x - bx) < (boss.vehicle ? 1.4 : 0.9)) {
            hit = true; boss.hp -= b.dmg;
            if (boss.hp <= 0) {
              kills += 1; bossKilled = true; bossDone = true;
              burstPieces(boss.m.position, famColor.getHex(), 40); scene.remove(boss.m); boss = null; q("[data-boss]").hidden = true;
              banner("💀 БОС ЗНИЩЕНИЙ"); setTimeout(() => end(true), 900);
            }
          }
          for (let i = boxes.length - 1; i >= 0 && !hit; i -= 1) {
            const box = boxes[i];
            if (Math.abs(box.g.position.z - bz) < 0.8 && Math.abs(box.g.position.x - bx) < 1.0) {
              hit = true; box.hp -= b.dmg;
              box.label.userData.draw(String(Math.max(0, Math.ceil(box.hp))), box.isWeapon ? "#f2c14e" : "#3fb6ff");
              if (box.hp <= 0) {
                burstPieces(box.g.position, box.color, 16); scene.remove(box.g); boxes.splice(i, 1);
                if (box.isWeapon) { weaponLevel = Math.min(4, weaponLevel + 1); banner(`${WEAPONS[weaponLevel].icon} ${WEAPONS[weaponLevel].name}!`); }
                else if (addSoldier()) banner("👥 +1 боєць");
              }
            }
          }
          if (hit) { b.alive = false; b.m.visible = false; }
        }
        // коробки рухаються до нас
        for (let i = boxes.length - 1; i >= 0; i -= 1) {
          const box = boxes[i];
          box.g.position.z += 4.2 * dt;
          box.g.rotation.y = Math.sin(t * 2 + i) * 0.08;
          if (box.g.position.z > LINE_Z + 1) { scene.remove(box.g); boxes.splice(i, 1); }
        }
        updateHud();
      }
      // спалахи, падіння, уламки
      [hero, ...squad].forEach((s) => { if (s.userData.flash?.visible) { s.userData.flashT -= dt; if (s.userData.flashT <= 0) s.userData.flash.visible = false; } });
      for (let i = dying.length - 1; i >= 0; i -= 1) {
        const d = dying[i]; d.t -= dt;
        d.m.rotation.x = Math.min(Math.PI / 2, d.m.rotation.x + dt * 5); d.m.position.y -= dt * 0.4;
        if (d.t <= 0) { scene.remove(d.m); dying.splice(i, 1); }
      }
      for (let i = pieces.length - 1; i >= 0; i -= 1) {
        const p = pieces[i]; p.life -= dt; p.v.y -= 18 * dt; p.p.position.addScaledVector(p.v, dt); p.p.rotation.x += dt * 8;
        if (p.life <= 0 || p.p.position.y < -1) { scene.remove(p.p); p.p.geometry.dispose(); p.p.material.dispose(); pieces.splice(i, 1); }
      }
      familyLight.intensity = 35 + Math.sin(t * 3) * 10;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    updateHud();
    loop();

    const cleanup = () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize); removeEventListener("keydown", onKey); removeEventListener("keyup", onKey);
      renderer.dispose();
      scene.traverse((o) => { o.geometry?.dispose?.(); [].concat(o.material || []).forEach((m) => { m.map?.dispose?.(); m.dispose?.(); }); });
      root.remove();
    };
  });
}
